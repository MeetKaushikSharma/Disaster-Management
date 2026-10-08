"""
Historical Data Backfill Script — Delhi NCR

Bootstraps the MongoDB HazardReading collection with historical weather data
by leveraging the OpenWeatherMap 5-day / 3-hour forecast API (FREE tier).

This provides ~40 data points per city spanning 5 days at 3-hour intervals,
giving the ML pipeline enough training data to start making predictions.

Usage:
    python scripts/backfill_history.py

The script:
  1. Fetches 5-day/3hr forecast for all 6 Delhi-NCR districts from OWM
  2. Maps each forecast point to HazardReading format
  3. POSTs batches to backend /api/hazard-readings/batch
  4. Reports total readings ingested
"""

import os
import sys
import time
import requests
from datetime import datetime, timezone
from dotenv import load_dotenv

# Load .env from ai-service root
sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))
load_dotenv(os.path.join(os.path.dirname(__file__), "..", ".env"))

OWM_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OWM_FORECAST_URL = "https://api.openweathermap.org/data/2.5/forecast"
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")

# Delhi-NCR District definitions (same as imd_ingestor.py)
DISTRICTS = {
    "Noida": {
        "lat": 28.5355, "lng": 77.3910, "state": "Uttar Pradesh",
        "owm_city": "Noida,IN", "normal_rain": 8.0, "normal_temp": 33.5,
    },
    "Gautam Buddha Nagar": {
        "lat": 28.4744, "lng": 77.5040, "state": "Uttar Pradesh",
        "owm_city": "Greater Noida,IN", "normal_rain": 7.5, "normal_temp": 33.0,
    },
    "Ghaziabad": {
        "lat": 28.6692, "lng": 77.4538, "state": "Uttar Pradesh",
        "owm_city": "Ghaziabad,IN", "normal_rain": 9.0, "normal_temp": 33.8,
    },
    "Faridabad": {
        "lat": 28.4089, "lng": 77.3178, "state": "Haryana",
        "owm_city": "Faridabad,IN", "normal_rain": 7.0, "normal_temp": 34.2,
    },
    "Gurugram": {
        "lat": 28.4595, "lng": 77.0266, "state": "Haryana",
        "owm_city": "Gurugram,IN", "normal_rain": 6.5, "normal_temp": 34.5,
    },
    "Delhi": {
        "lat": 28.7041, "lng": 77.1025, "state": "Delhi",
        "owm_city": "New Delhi,IN", "normal_rain": 8.5, "normal_temp": 33.0,
    },
}

# River station normal levels (from cwc_ingestor.py)
RIVER_NORMALS = {
    "Noida": {"normal": 198.80, "warning": 200.50, "danger": 201.50},
    "Gautam Buddha Nagar": {"normal": 198.10, "warning": 199.80, "danger": 200.80},
    "Ghaziabad": {"normal": 196.50, "warning": 198.00, "danger": 199.00},
    "Faridabad": {"normal": 199.70, "warning": 201.50, "danger": 202.50},
    "Gurugram": {"normal": 215.50, "warning": 217.00, "danger": 218.00},
    "Delhi": {"normal": 202.18, "warning": 204.50, "danger": 205.33},
}


def fetch_owm_forecast(city: str) -> dict | None:
    """Fetches 5-day/3hr forecast from OWM free tier."""
    if not OWM_API_KEY:
        print("[Backfill] ERROR: OPENWEATHER_API_KEY not set in .env")
        return None
    try:
        resp = requests.get(
            OWM_FORECAST_URL,
            params={"q": city, "appid": OWM_API_KEY, "units": "metric"},
            timeout=10,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        print(f"[Backfill] OWM forecast request failed for '{city}': {exc}")
        return None


def forecast_to_readings(district: str, info: dict, forecast_data: dict) -> list[dict]:
    """Converts OWM forecast JSON to a list of HazardReading-compatible dicts."""
    readings = []
    forecast_list = forecast_data.get("list", [])

    for entry in forecast_list:
        dt_unix = entry.get("dt", 0)
        timestamp = datetime.fromtimestamp(dt_unix, tz=timezone.utc).isoformat()

        main = entry.get("main", {})
        wind_data = entry.get("wind", {})
        rain_data = entry.get("rain", {})

        temp_c = round(float(main.get("temp", info["normal_temp"])), 1)
        humidity = round(float(main.get("humidity", 65)), 1)
        wind_ms = float(wind_data.get("speed", 10.0))
        wind_kmh = round(wind_ms * 3.6, 1)
        rain_3h = float(rain_data.get("3h", 0.0))
        rain_1h = round(rain_3h / 3.0, 2)  # Approximate hourly from 3hr total

        station_id = f"IMD_{district.upper().replace(' ', '_')}_AWS"
        location = {"type": "Point", "coordinates": [info["lng"], info["lat"]]}

        # Rainfall reading
        readings.append({
            "timestamp": timestamp,
            "state": info["state"],
            "district": district,
            "stationId": station_id,
            "stationName": f"{district} IMD Weather Station",
            "location": location,
            "indicator": "rainfall_mm",
            "value": rain_1h,
            "unit": "mm",
            "source": "IMD+OWM",
            "isAnomaly": rain_1h > 50,
            "anomalyScore": round(min(1.0, rain_1h / 80.0), 2),
        })

        # Temperature reading
        readings.append({
            "timestamp": timestamp,
            "state": info["state"],
            "district": district,
            "stationId": station_id,
            "stationName": f"{district} IMD Weather Station",
            "location": location,
            "indicator": "temperature_c",
            "value": temp_c,
            "unit": "°C",
            "source": "IMD+OWM",
            "isAnomaly": temp_c >= 40.0,
            "anomalyScore": round(min(1.0, max(0.0, (temp_c - 35.0) / 10.0)), 2),
        })

        # Wind speed reading
        readings.append({
            "timestamp": timestamp,
            "state": info["state"],
            "district": district,
            "stationId": station_id,
            "stationName": f"{district} IMD Weather Station",
            "location": location,
            "indicator": "wind_speed_kmh",
            "value": wind_kmh,
            "unit": "km/h",
            "source": "IMD+OWM",
            "isAnomaly": wind_kmh >= 60,
            "anomalyScore": round(min(1.0, max(0.0, (wind_kmh - 30.0) / 60.0)), 2),
        })

        # Derived river level reading (estimate from rainfall + humidity)
        river_info = RIVER_NORMALS.get(district, {"normal": 200.0, "warning": 202.0, "danger": 203.0})
        rain_rise = max(0.0, (rain_1h - 5.0) * 0.08)
        humidity_rise = max(0.0, (humidity - 80) * 0.002)
        river_level = round(river_info["normal"] + rain_rise + humidity_rise, 2)

        readings.append({
            "timestamp": timestamp,
            "state": info["state"],
            "district": district,
            "stationId": f"CWC_{district.upper().replace(' ', '_')}_GAUGE",
            "stationName": f"{district} CWC River Gauge",
            "location": location,
            "indicator": "river_level_m",
            "value": river_level,
            "unit": "m",
            "source": "CWC+OWM",
            "warningLevel": river_info["warning"],
            "dangerLevel": river_info["danger"],
            "isAnomaly": river_level >= river_info["warning"],
            "anomalyScore": 0.90 if river_level >= river_info["danger"] else (
                0.70 if river_level >= river_info["warning"] else 0.10
            ),
        })

    return readings


def push_batch(readings: list[dict]) -> bool:
    """POSTs a batch of readings to the backend."""
    try:
        res = requests.post(
            f"{BACKEND_API_URL}/hazard-readings/batch",
            json={"readings": readings},
            timeout=15,
        )
        if res.status_code in [200, 201]:
            return True
        print(f"[Backfill] Backend rejected batch ({res.status_code}): {res.text[:200]}")
    except Exception as exc:
        print(f"[Backfill] Could not reach backend: {exc}")
    return False


def main():
    print("=" * 70)
    print("  AI Disaster Management — Historical Data Backfill")
    print("  OWM 5-day/3hr Forecast → MongoDB HazardReadings")
    print("=" * 70)

    if not OWM_API_KEY:
        print("\n[ERROR] OPENWEATHER_API_KEY not found in .env")
        print("  Set it in ai-service/.env and retry.")
        sys.exit(1)

    total_readings = 0
    total_pushed = 0

    for district, info in DISTRICTS.items():
        print(f"\n[{district}] Fetching 5-day forecast from OWM...")
        forecast = fetch_owm_forecast(info["owm_city"])

        if not forecast:
            print(f"[{district}] SKIPPED — OWM fetch failed")
            continue

        entries = len(forecast.get("list", []))
        print(f"[{district}] Got {entries} forecast entries (5 days × 3hr intervals)")

        readings = forecast_to_readings(district, info, forecast)
        total_readings += len(readings)
        print(f"[{district}] Generated {len(readings)} hazard readings (4 indicators × {entries} entries)")

        # Push in batches of 100 to avoid payload size issues
        batch_size = 100
        for i in range(0, len(readings), batch_size):
            batch = readings[i:i + batch_size]
            ok = push_batch(batch)
            if ok:
                total_pushed += len(batch)
                print(f"[{district}] Batch {i // batch_size + 1}: {len(batch)} readings pushed ✓")
            else:
                print(f"[{district}] Batch {i // batch_size + 1}: FAILED ✗")

        # Respect OWM rate limit (60 calls/min)
        time.sleep(1.5)

    print(f"\n{'=' * 70}")
    print(f"  BACKFILL COMPLETE")
    print(f"  Total readings generated: {total_readings}")
    print(f"  Total readings pushed:    {total_pushed}")
    print(f"  Districts processed:      {len(DISTRICTS)}")
    print(f"{'=' * 70}")


if __name__ == "__main__":
    main()
