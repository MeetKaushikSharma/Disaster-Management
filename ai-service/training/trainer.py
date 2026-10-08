"""
Automated Model Training Pipeline & Scheduler

Fetches real historical time-series data from Open-Meteo Archive API
(free, no API key required) for the past N days, supplemented by
backend /api/ml-features/training-data if available.

Fits XGBoost nowcasters and PyTorch LSTM forecasters, then persists
optimized weights into ai-service/trained_models/.
"""

import os
import sys

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import time
import requests
import numpy as np
from datetime import datetime, timezone, timedelta, date
from typing import Dict, List, Any

# Ensure ai-service root in path
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from models.xgb_nowcaster import XGBNowcaster
from models.lstm_forecaster import LSTMForecaster
from models.feature_engineer import FeatureEngineer
from grid.delhi_ncr_grid import PRIMARY_STATIONS

BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"


def fetch_open_meteo_historical(
    district: str,
    lat: float,
    lon: float,
    days: int = 90,
    discharge_scale: float = 10.0,
) -> List[Dict[str, Any]]:
    """
    Fetches real historical daily weather data from Open-Meteo Archive API.
    No API key required — free for non-commercial use.

    Covers up to 90 days of real historical observations:
      - Daily precipitation sum (mm)
      - Daily max temperature (°C)
      - Daily max wind speed (km/h)
      - River level proxy: derived from precipitation accumulation

    Args:
        district       : District name for labelling records
        lat, lon       : Geographic coordinates
        days           : Number of historical days to fetch (default 90)
        discharge_scale: Used to normalize river level proxy
    Returns:
        List of reading dicts compatible with FeatureEngineer.raw_to_dataframe()
    """
    end_date = date.today().strftime("%Y-%m-%d")
    start_date = (date.today() - timedelta(days=days)).strftime("%Y-%m-%d")

    print(f"  [OpenMeteo Archive] {district}: fetching {start_date} → {end_date}")

    try:
        resp = requests.get(
            OPEN_METEO_ARCHIVE_URL,
            params={
                "latitude": round(lat, 4),
                "longitude": round(lon, 4),
                "start_date": start_date,
                "end_date": end_date,
                "daily": ",".join([
                    "precipitation_sum",
                    "temperature_2m_max",
                    "temperature_2m_min",
                    "wind_speed_10m_max",
                ]),
                "timezone": "Asia/Kolkata",
            },
            timeout=20,
        )
        resp.raise_for_status()
        data = resp.json().get("daily", {})
    except Exception as exc:
        print(f"  [OpenMeteo Archive] Failed for {district}: {exc}. Using synthetic fallback.")
        return generate_synthetic_bootstrap(district, days * 24)

    dates = data.get("time", [])
    precip_list = data.get("precipitation_sum", [])
    temp_max_list = data.get("temperature_2m_max", [])
    temp_min_list = data.get("temperature_2m_min", [])
    wind_list = data.get("wind_speed_10m_max", [])

    if not dates or len(dates) < 14:
        print(f"  [OpenMeteo Archive] Insufficient data for {district} ({len(dates)} days). Using synthetic.")
        return generate_synthetic_bootstrap(district, days * 24)

    records = []
    # Build a 3-day rolling cumulative precipitation as a river level proxy
    rolling_precip = 0.0
    station = PRIMARY_STATIONS.get(district, {})
    base_river = station.get("normal_river_level", 200.0)

    for i, date_str in enumerate(dates):
        rain = float(precip_list[i]) if i < len(precip_list) and precip_list[i] is not None else 0.0
        temp = float(temp_max_list[i]) if i < len(temp_max_list) and temp_max_list[i] is not None else 32.0
        wind = float(wind_list[i]) if i < len(wind_list) and wind_list[i] is not None else 10.0

        # Rolling 3-day precipitation sum → river level proxy
        rolling_precip = rolling_precip * 0.6 + rain * 0.4  # Exponential decay
        river_proxy = base_river + (rolling_precip / discharge_scale)

        records.append({
            "timestamp": f"{date_str}T12:00:00+05:30",
            "district": district,
            "rainfall_mm": max(0.0, rain),
            "temperature_c": temp,
            "wind_speed_kmh": max(0.0, wind),
            "river_level_m": round(river_proxy, 2),
        })

    print(f"  [OpenMeteo Archive] {district}: {len(records)} real daily records fetched.")
    return records


def generate_synthetic_bootstrap(district: str, hours: int = 168) -> List[Dict[str, Any]]:
    """
    Generates realistic historical weather data matching Delhi-NCR climatology
    if real data is unavailable. Used as fallback only.
    """
    station = PRIMARY_STATIONS.get(district, {
        "normal_river_level": 200.0,
        "danger_river_level": 202.0,
    })
    now = datetime.now(timezone.utc).timestamp()
    records = []

    np.random.seed(hash(district) % 2**32)

    base_temp = 32.0 + np.random.uniform(-2, 3)
    base_river = station.get("normal_river_level", 200.0)

    for h in range(hours, 0, -1):
        ts = datetime.fromtimestamp(now - h * 3600, tz=timezone.utc).isoformat()
        hour_of_day = (datetime.fromtimestamp(now - h * 3600, tz=timezone.utc)).hour

        # Diurnal temperature cycle
        temp_cycle = 6.0 * np.sin(2 * np.pi * (hour_of_day - 9) / 24.0)
        temp = max(18.0, min(47.0, base_temp + temp_cycle + np.random.normal(0, 1.2)))

        # Periodic rain episodes
        is_rain_storm = np.random.random() < 0.12
        if is_rain_storm:
            rain = max(0.0, np.random.exponential(18.0))
            wind = max(15.0, np.random.normal(38.0, 12.0))
        else:
            rain = 0.0 if np.random.random() > 0.15 else max(0.0, np.random.exponential(2.5))
            wind = max(5.0, np.random.normal(14.0, 5.0))

        # River level correlates with recent rain
        river = base_river + (rain * 0.03) + np.random.normal(0, 0.05)

        records.append({
            "timestamp": ts,
            "district": district,
            "rainfall_mm": round(rain, 2),
            "temperature_c": round(temp, 1),
            "wind_speed_kmh": round(wind, 1),
            "river_level_m": round(river, 2),
        })

    return records


class ModelTrainer:
    def __init__(self):
        self.xgb = XGBNowcaster()
        self.lstm = LSTMForecaster()
        self.fe = FeatureEngineer()

    def fetch_training_data(self, days: int = 90) -> Dict[str, List[Dict[str, Any]]]:
        """
        Acquires training data for all districts using a priority waterfall:
          1. Open-Meteo Archive API (real historical data — preferred)
          2. Backend /api/ml-features/training-data (existing stored readings)
          3. Synthetic bootstrap (fallback only if both above fail/insufficient)

        Args:
            days: Number of historical days to fetch (default 90 = ~3 months)
        Returns:
            Dict of {district: [reading_dicts, ...]}
        """
        all_data: Dict[str, List[Dict[str, Any]]] = {}

        # ── Priority 1: Open-Meteo Archive API (real, free, no key) ──────────
        print("\n[Trainer] Fetching real historical data from Open-Meteo Archive API...")
        for dist, station in PRIMARY_STATIONS.items():
            records = fetch_open_meteo_historical(
                district=dist,
                lat=station["lat"],
                lon=station["lng"],
                days=days,
                discharge_scale=station.get("discharge_scale", 10.0),
            )
            if len(records) >= 14:
                all_data[dist] = records

        # ── Priority 2: Backend stored telemetry (supplement if sparse) ──────
        try:
            res = requests.get(
                f"{BACKEND_API_URL}/ml-features/training-data",
                params={"hours": days * 24, "resample": "1h"},
                timeout=12,
            )
            if res.status_code == 200:
                payload = res.json()
                backend_data = payload.get("data", {})
                for dist in PRIMARY_STATIONS.keys():
                    backend_readings = backend_data.get(dist, [])
                    if len(backend_readings) >= 24:
                        existing = all_data.get(dist, [])
                        # Merge and deduplicate by timestamp
                        combined = existing + backend_readings
                        seen_ts = set()
                        deduped = []
                        for r in combined:
                            ts = r.get("timestamp", "")
                            if ts not in seen_ts:
                                seen_ts.add(ts)
                                deduped.append(r)
                        all_data[dist] = sorted(deduped, key=lambda x: x.get("timestamp", ""))
                        print(f"  [Backend] Merged {len(backend_readings)} readings for {dist}")
        except Exception as e:
            print(f"[Trainer] Backend fetch skipped: {e}")

        # ── Priority 3: Synthetic bootstrap for any district still missing ────
        for dist in PRIMARY_STATIONS.keys():
            if dist not in all_data or len(all_data[dist]) < 24:
                print(f"[Trainer] Falling back to synthetic bootstrap for {dist}...")
                all_data[dist] = generate_synthetic_bootstrap(dist, days * 24)

        return all_data

    def run_training_cycle(self, days: int = 90) -> Dict[str, Any]:
        print("=" * 60)
        print("  Disaster ML Model Training Cycle (Delhi-NCR)")
        print(f"  Data source: Open-Meteo Archive API + Backend")
        print(f"  Time: {datetime.now(timezone.utc).isoformat()}")
        print("=" * 60)

        data_by_dist = self.fetch_training_data(days=days)
        summary = {}

        for dist, readings in data_by_dist.items():
            print(f"\n--- Training Models for: {dist} ({len(readings)} time-steps) ---")

            # 1. XGBoost
            print(f"[{dist}] Fitting multi-target XGBoost Nowcaster...")
            xgb_metrics = self.xgb.train_district(dist, readings, horizon_steps=6)
            print(f"[{dist}] XGBoost complete: {xgb_metrics}")

            # 2. LSTM
            print(f"[{dist}] Fitting PyTorch LSTM Forecaster (CPU)...")
            lstm_metrics = self.lstm.train_district(dist, readings, epochs=35)
            print(f"[{dist}] LSTM complete: {lstm_metrics}")

            summary[dist] = {
                "readingsCount": len(readings),
                "dataSource": "open_meteo_archive",
                "xgb": xgb_metrics,
                "lstm": lstm_metrics,
                "trainedAt": datetime.now(timezone.utc).isoformat(),
            }

        print("\n" + "=" * 60)
        print("  Disaster ML Training Cycle Complete!")
        print("=" * 60)
        return summary


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Train disaster prediction models")
    parser.add_argument("--days", type=int, default=90,
                        help="Number of historical days to fetch (default: 90)")
    args = parser.parse_args()

    trainer = ModelTrainer()
    summary = trainer.run_training_cycle(days=args.days)

    print("\n--- Training Summary ---")
    for dist, metrics in summary.items():
        xgb = metrics.get("xgb", {})
        lstm = metrics.get("lstm", {})
        print(f"  {dist}: {metrics['readingsCount']} readings | "
              f"XGB MAEs={xgb} | LSTM loss={lstm}")


if __name__ == "__main__":
    main()
