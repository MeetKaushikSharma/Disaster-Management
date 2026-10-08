"""
Open-Meteo Free Data Ingestor — GloFAS Flood + ECMWF/GFS Atmospheric Forecasts

Fetches real hydrometeorological forecast data from the Open-Meteo API ecosystem:
  - Atmospheric Forecast API  : hourly precipitation, temperature, wind speed
  - Global Flood API (GloFAS) : daily river discharge forecasts at 5km resolution

No API key required — free for non-commercial use with attribution.
Attribution: Open-Meteo.com (CC BY 4.0) | GloFAS: Copernicus Emergency Management Service
"""

import time
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import requests
from requests.adapters import HTTPAdapter
from urllib3.util import Retry

logger = logging.getLogger(__name__)

# ── Open-Meteo API endpoints ──────────────────────────────────────────────────
OPEN_METEO_FORECAST_URL = "https://api.open-meteo.com/v1/forecast"
OPEN_METEO_FLOOD_URL = "https://flood-api.open-meteo.com/v1/flood"
OPEN_METEO_ARCHIVE_URL = "https://archive-api.open-meteo.com/v1/archive"

# In-memory telemetry cache (district -> (timestamp, telemetry_dict))
# Prevents duplicate calls across IMD & CWC and saves bandwidth.
_DISTRICT_CACHE: Dict[str, Tuple[float, Dict[str, Any]]] = {}
CACHE_TTL_SECONDS = 600.0  # 10 minutes

_SESSION: Optional[requests.Session] = None


def _get_om_session() -> requests.Session:
    """Returns a shared session with connection pooling and retries."""
    global _SESSION
    if _SESSION is None:
        _SESSION = requests.Session()
        retries = Retry(
            total=2,
            backoff_factor=1.0,
            status_forcelist=[429, 500, 502, 503, 504],
            raise_on_status=False,
        )
        adapter = HTTPAdapter(
            max_retries=retries,
            pool_connections=10,
            pool_maxsize=10,
            pool_block=False,
        )
        _SESSION.mount("https://", adapter)
        _SESSION.mount("http://", adapter)
    return _SESSION


# ── IMD Heavy Rainfall Classification Thresholds (24-hour totals, mm) ─────────
IMD_THRESHOLD_HEAVY_MM = 64.5       # Heavy rain (yellow alert)
IMD_THRESHOLD_VERY_HEAVY_MM = 115.6 # Very heavy rain (orange alert)
IMD_THRESHOLD_EXTREMELY_HEAVY_MM = 204.4  # Extremely heavy rain (red alert)


def _safe_max(arr: List, fallback: float = 0.0) -> float:
    """Returns max of list, ignoring None values, with a fallback."""
    valid = [v for v in (arr or []) if v is not None]
    return float(max(valid)) if valid else fallback


def _safe_list(arr: Any, fallback_val: float = 0.0) -> List[float]:
    """Ensures a list of floats, replacing None with fallback_val."""
    if not arr:
        return []
    return [float(v) if v is not None else fallback_val for v in arr]


class OpenMeteoIngestor:
    """
    Fetches structured hydrometeorological forecast data from Open-Meteo APIs.

    No API key required. Rate limiting applies on free tier (~10k req/day per IP).
    All data is derived from global numerical weather prediction (NWP) models:
      - ECMWF IFS / GFS for atmospheric parameters
      - GloFAS v4 for river discharge (5km grid resolution)
    """

    def __init__(self, timeout: int = 25):
        self.timeout = timeout
        self.session = _get_om_session()

    def fetch_atmospheric_forecast(
        self, lat: float, lon: float, forecast_days: int = 7
    ) -> Dict[str, Any]:
        """
        Fetches hourly + daily atmospheric forecast from ECMWF/GFS via Open-Meteo.

        Returns:
            Raw Open-Meteo JSON response with 'hourly' and 'daily' keys.
        """
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "hourly": ",".join([
                "precipitation",
                "temperature_2m",
                "wind_speed_10m",
                "relative_humidity_2m",
                "soil_moisture_0_to_7cm",
            ]),
            "daily": ",".join([
                "precipitation_sum",
                "precipitation_hours",
                "temperature_2m_max",
                "temperature_2m_min",
                "wind_speed_10m_max",
                "wind_gusts_10m_max",
            ]),
            "timezone": "Asia/Kolkata",
            "forecast_days": forecast_days,
        }
        try:
            resp = self.session.get(OPEN_METEO_FORECAST_URL, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.info(f"[OpenMeteo] Atmospheric endpoint temporarily slow/unreachable ({lat},{lon}): {exc.__class__.__name__}")
            return {}

    def fetch_flood_forecast(
        self, lat: float, lon: float, forecast_days: int = 7
    ) -> Dict[str, Any]:
        """
        Fetches GloFAS river discharge forecast from Open-Meteo Flood API.

        Spatial resolution: 5km grid (GloFAS v4)
        Returns daily median discharge (m³/s) + 25th and 75th percentile ensemble values.
        """
        params = {
            "latitude": round(lat, 4),
            "longitude": round(lon, 4),
            "daily": "river_discharge,river_discharge_p25,river_discharge_p75",
            "forecast_days": forecast_days,
        }
        try:
            resp = self.session.get(OPEN_METEO_FLOOD_URL, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.info(f"[OpenMeteo] GloFAS flood endpoint temporarily slow/unreachable ({lat},{lon}): {exc.__class__.__name__}")
            return {}

    def fetch_historical_weather(
        self,
        lat: float,
        lon: float,
        start_date: str,
        end_date: str,
    ) -> Dict[str, Any]:
        """
        Fetches historical daily weather data from Open-Meteo Archive API.
        No API key required. Useful for model training with real data.

        Args:
            start_date: ISO date string 'YYYY-MM-DD'
            end_date: ISO date string 'YYYY-MM-DD'
        """
        params = {
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
        }
        try:
            resp = requests.get(OPEN_METEO_ARCHIVE_URL, params=params, timeout=self.timeout)
            resp.raise_for_status()
            return resp.json()
        except requests.RequestException as exc:
            logger.warning(f"[OpenMeteo] Historical fetch failed ({lat},{lon}): {exc}")
            return {}

    def classify_imd_warning(
        self, precip_24h_mm: float, wind_kmh: float
    ) -> Optional[str]:
        """
        Classifies rainfall/wind into IMD warning categories.

        IMD 24-hour rainfall thresholds:
          ≥ 64.5 mm  → Heavy Rainfall (Yellow Alert)
          ≥ 115.6 mm → Very Heavy Rainfall (Orange Alert)
          ≥ 204.4 mm → Extremely Heavy Rainfall (Red Alert)
        """
        if precip_24h_mm >= IMD_THRESHOLD_EXTREMELY_HEAVY_MM:
            return "Extremely Heavy Rainfall — Red Alert (≥204.4 mm)"
        elif precip_24h_mm >= IMD_THRESHOLD_VERY_HEAVY_MM:
            return "Very Heavy Rainfall Alert — Orange Alert (≥115.6 mm)"
        elif precip_24h_mm >= IMD_THRESHOLD_HEAVY_MM:
            return "Heavy Rainfall Advisory — Yellow Alert (≥64.5 mm)"
        elif wind_kmh >= 60.0:
            return "Strong Wind Warning — Thunderstorm Alert (≥60 km/h)"
        return None

    def get_district_telemetry(
        self,
        district: str,
        lat: float,
        lon: float,
        rain_threshold_mm: float = 64.5,
        discharge_threshold_m3s: float = 150.0,
        forecast_days: int = 7,
    ) -> Dict[str, Any]:
        """
        Primary method: fetches + processes Open-Meteo data for a single district.

        Computes:
          - Max forecast precipitation over next 3 days
          - Max GloFAS river discharge over next 3 days
          - Rain ratio vs IMD threshold (0.0 – 1.0)
          - Discharge ratio vs historical threshold (0.0 – 1.0)
          - Composite Flood Risk Index (FRI) = 0.5*rain_ratio + 0.5*discharge_ratio
          - IMD warning classification string

        Returns:
            A flat telemetry dict compatible with ML feature engineering.
        """
        now = time.time()
        if district in _DISTRICT_CACHE:
            cached_time, cached_data = _DISTRICT_CACHE[district]
            if (now - cached_time) < CACHE_TTL_SECONDS:
                return cached_data

        atm_data = self.fetch_atmospheric_forecast(lat, lon, forecast_days=forecast_days)
        flood_data = self.fetch_flood_forecast(lat, lon, forecast_days=forecast_days)

        daily = atm_data.get("daily", {})
        flood_daily = flood_data.get("daily", {})

        # Extract daily arrays (next 3 days = indices 0,1,2)
        daily_precip = _safe_list(daily.get("precipitation_sum", []), 0.0)
        daily_temp_max = _safe_list(daily.get("temperature_2m_max", []), 32.0)
        daily_temp_min = _safe_list(daily.get("temperature_2m_min", []), 25.0)
        daily_wind_max = _safe_list(daily.get("wind_speed_10m_max", []), 10.0)
        daily_wind_gusts = _safe_list(daily.get("wind_gusts_10m_max", []), 10.0)
        daily_precip_hours = _safe_list(daily.get("precipitation_hours", []), 0.0)

        daily_discharge = _safe_list(flood_daily.get("river_discharge", []), 0.0)
        daily_discharge_p25 = _safe_list(flood_daily.get("river_discharge_p25", []), 0.0)
        daily_discharge_p75 = _safe_list(flood_daily.get("river_discharge_p75", []), 0.0)

        # Peak values over next 3 forecast days
        max_precip_24h = _safe_max(daily_precip[:3], 0.0)
        max_temp = _safe_max(daily_temp_max[:3], 32.0)
        min_temp = min(daily_temp_min[:3]) if daily_temp_min[:3] else 25.0
        max_wind = _safe_max(daily_wind_max[:3], 10.0)
        max_gusts = _safe_max(daily_wind_gusts[:3], 10.0)
        max_discharge = _safe_max(daily_discharge[:3], 0.0)
        max_discharge_p75 = _safe_max(daily_discharge_p75[:3], 0.0)

        # ── Risk ratio calculations ───────────────────────────────────────────
        rain_ratio = round(
            min(1.0, max_precip_24h / rain_threshold_mm) if rain_threshold_mm > 0 else 0.0,
            4,
        )
        discharge_ratio = round(
            min(1.0, max_discharge / discharge_threshold_m3s)
            if discharge_threshold_m3s > 0 else 0.0,
            4,
        )

        # Composite Flood Risk Index (FRI) — document equation: 0.5*rain + 0.5*discharge
        flood_risk_index = round(0.5 * rain_ratio + 0.5 * discharge_ratio, 4)

        imd_warning = self.classify_imd_warning(max_precip_24h, max_wind)

        result = {
            "district": district,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "source": "Open-Meteo (GloFAS v4 + ECMWF IFS)",
            "lat": lat,
            "lon": lon,
            # ── Primary ML Features ───────────────────────────────────────────
            "rainfall_mm": round(max_precip_24h, 2),
            "temperature_c": round(max_temp, 1),
            "min_temperature_c": round(min_temp, 1),
            "wind_speed_kmh": round(max_wind, 1),
            "wind_gusts_kmh": round(max_gusts, 1),
            "river_discharge_m3s": round(max_discharge, 2),
            "river_discharge_p75_m3s": round(max_discharge_p75, 2),
            "precipitation_hours": daily_precip_hours[0] if daily_precip_hours else 0.0,
            # ── Risk Indices ──────────────────────────────────────────────────
            "rain_ratio": rain_ratio,
            "discharge_ratio": discharge_ratio,
            "flood_risk_index": flood_risk_index,
            "rain_threshold_mm": rain_threshold_mm,
            "discharge_threshold_m3s": discharge_threshold_m3s,
            # ── IMD Classification ────────────────────────────────────────────
            "imd_warning": imd_warning,
            # ── Raw Forecast Arrays (for LSTM sequence building) ──────────────
            "daily_precip_mm": daily_precip,
            "daily_temp_max_c": daily_temp_max,
            "daily_wind_max_kmh": daily_wind_max,
            "daily_discharge_m3s": daily_discharge,
            "daily_discharge_p25": daily_discharge_p25,
            "daily_discharge_p75": daily_discharge_p75,
            # ── Data availability flags ───────────────────────────────────────
            "has_atmospheric_data": bool(daily_precip),
            "has_flood_data": bool(daily_discharge),
        }
        _DISTRICT_CACHE[district] = (now, result)
        return result

    def get_all_districts_telemetry(
        self, district_configs: Dict[str, Dict[str, Any]]
    ) -> Dict[str, Dict[str, Any]]:
        """
        Fetches Open-Meteo telemetry for all districts in the provided config.

        Args:
            district_configs: Dict of {district_name: {lat, lng, rain_threshold_mm, discharge_threshold_m3s}}
        Returns:
            Dict of {district_name: telemetry_dict}
        """
        results = {}
        for district, cfg in district_configs.items():
            try:
                telemetry = self.get_district_telemetry(
                    district=district,
                    lat=cfg["lat"],
                    lon=cfg["lng"],
                    rain_threshold_mm=cfg.get("rain_threshold_mm", IMD_THRESHOLD_HEAVY_MM),
                    discharge_threshold_m3s=cfg.get("discharge_threshold_m3s", 150.0),
                )
                results[district] = telemetry
                logger.info(
                    f"[OpenMeteo] {district}: rain={telemetry['rainfall_mm']}mm "
                    f"discharge={telemetry['river_discharge_m3s']}m³/s "
                    f"FRI={telemetry['flood_risk_index']:.3f}"
                )
            except Exception as exc:
                logger.error(f"[OpenMeteo] Failed to fetch telemetry for {district}: {exc}")
                results[district] = {
                    "district": district,
                    "error": str(exc),
                    "flood_risk_index": 0.0,
                    "rainfall_mm": 0.0,
                    "temperature_c": 32.0,
                    "wind_speed_kmh": 10.0,
                    "river_discharge_m3s": 0.0,
                    "has_atmospheric_data": False,
                    "has_flood_data": False,
                }
        return results
