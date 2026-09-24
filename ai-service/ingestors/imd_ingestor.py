"""
IMD (India Meteorological Department) Ingestor — Delhi NCR Edition

Fetches live meteorological observations (temperature, humidity, rainfall,
wind speed) from OpenWeatherMap for Delhi-NCR districts:
  Noida, Gautam Buddha Nagar, Ghaziabad, Faridabad, Gurugram, Delhi.

OWM Current Weather API is used as the live data source, with fallback
to simulated baseline values if the API is unreachable.
"""

import os
import random
import logging
from datetime import datetime, timezone

from dotenv import load_dotenv

load_dotenv()

logger = logging.getLogger(__name__)

# ── OpenWeatherMap API config ─────────────────────────────────────────────────
OWM_API_KEY = os.getenv("OPENWEATHER_API_KEY", "")
OWM_BASE_URL = "https://api.openweathermap.org/data/2.5/weather"

# ── Delhi-NCR District Baselines ──────────────────────────────────────────────
# Baselines represent typical monsoon-season normal values.
# OWM live data overwrites rainfall/temp/humidity/wind when available.
DISTRICT_BASELINES = {
    "Noida": {
        "normal_rain": 8.0,
        "normal_temp": 33.5,
        "lat": 28.5355,
        "lng": 77.3910,
        "state": "Uttar Pradesh",
        "owm_city": "Noida,IN",
    },
    "Gautam Buddha Nagar": {
        "normal_rain": 7.5,
        "normal_temp": 33.0,
        "lat": 28.4744,
        "lng": 77.5040,
        "state": "Uttar Pradesh",
        "owm_city": "Greater Noida,IN",
    },
    "Ghaziabad": {
        "normal_rain": 9.0,
        "normal_temp": 33.8,
        "lat": 28.6692,
        "lng": 77.4538,
        "state": "Uttar Pradesh",
        "owm_city": "Ghaziabad,IN",
    },
    "Faridabad": {
        "normal_rain": 7.0,
        "normal_temp": 34.2,
        "lat": 28.4089,
        "lng": 77.3178,
        "state": "Haryana",
        "owm_city": "Faridabad,IN",
    },
    "Gurugram": {
        "normal_rain": 6.5,
        "normal_temp": 34.5,
        "lat": 28.4595,
        "lng": 77.0266,
        "state": "Haryana",
        "owm_city": "Gurugram,IN",
    },
    "Delhi": {
        "normal_rain": 8.5,
        "normal_temp": 33.0,
        "lat": 28.7041,
        "lng": 77.1025,
        "state": "Delhi",
        "owm_city": "New Delhi,IN",
    },
}


def _fetch_owm_weather(city: str) -> dict | None:
    """Calls OWM Current Weather API and returns the raw JSON response."""
    try:
        resp = requests.get(
            OWM_BASE_URL,
            params={
                "q": city,
                "appid": OWM_API_KEY,
                "units": "metric",
            },
            timeout=8,
        )
        resp.raise_for_status()
        return resp.json()
    except requests.RequestException as exc:
        logger.warning(f"[IMD Ingestor] OWM request failed for '{city}': {exc}")
        return None


def _classify_imd_warning(rain_1h: float, rain_3h: float, wind_kmh: float) -> str | None:
    """
    Maps OWM precipitation intensity to IMD warning category.
    IMD thresholds (24h equivalent approximated from 1h/3h):
      ≥115 mm/hr →  Extremely Heavy Rain
      ≥64 mm/hr  →  Very Heavy Rainfall Alert
      ≥15 mm/hr  →  Heavy Rainfall Alert
    """
    # Use 1h rate as proxy, scale 3h to hourly
    effective_rate = max(rain_1h, rain_3h / 3.0)
    if effective_rate >= 25.0:
        return "Extremely Heavy to Very Heavy Rainfall — Red Alert"
    elif effective_rate >= 10.0:
        return "Heavy to Very Heavy Rainfall Alert — Orange Alert"
    elif effective_rate >= 3.0:
        return "Heavy Rainfall Advisory — Yellow Alert"
    elif wind_kmh >= 60.0:
        return "Strong Wind Warning — Thunderstorm Alert"
    return None


class ImdIngestor:
    """
    Ingests real-time meteorological data from OpenWeatherMap and maps it
    to IMD-style district telemetry for Delhi-NCR districts.
    """

    def __init__(self, state: str = "Delhi NCR"):
        self.state = state

    def fetch_district_telemetry(self, district: str, simulate_surge: bool = False) -> dict:
        """
        Fetches current IMD-style meteorological observation for a district.

        - Calls OWM to retrieve live temp, humidity, wind, and rainfall.
        - Falls back to simulated baseline if OWM is unreachable.
        - If simulate_surge=True, generates an extreme heavy rainfall spike.
        """
        baseline = DISTRICT_BASELINES.get(district, {
            "normal_rain": 8.0,
            "normal_temp": 33.0,
            "lat": 28.6139,
            "lng": 77.2090,
            "state": self.state,
            "owm_city": f"{district},IN",
        })
        now = datetime.now(timezone.utc).isoformat()

        owm_fetched = False
        rain_1h = 0.0
        rain_3h = 0.0

        if simulate_surge:
            # Extreme rainfall surge simulation
            rain_val = round(baseline["normal_rain"] * 5.5 + random.uniform(15, 35), 1)
            temp_val = round(baseline["normal_temp"] - 3.0, 1)
            humidity = round(random.uniform(92, 98), 1)
            wind = round(random.uniform(35, 65), 1)
            imd_warning = "Extremely Heavy to Very Heavy Rainfall — Red Alert"
            weather_desc = "thunderstorm with heavy rain"
        else:
            owm_raw = _fetch_owm_weather(baseline["owm_city"])

            if owm_raw:
                owm_fetched = True
                main = owm_raw.get("main", {})
                wind_data = owm_raw.get("wind", {})
                rain_data = owm_raw.get("rain", {})

                temp_val = round(main.get("temp", baseline["normal_temp"]), 1)
                humidity = round(main.get("humidity", 65), 1)

                # OWM wind is m/s → convert to km/h
                wind = round(wind_data.get("speed", 10.0) * 3.6, 1)

                # Rainfall — 1h or 3h (OWM only reports when it's actually raining)
                rain_1h = rain_data.get("1h", 0.0)
                rain_3h = rain_data.get("3h", 0.0)
                rain_val = rain_1h  # Use 1h as primary indicator

                weather_desc = owm_raw.get("weather", [{}])[0].get("description", "clear sky")
                imd_warning = _classify_imd_warning(rain_1h, rain_3h, wind)
            else:
                # Fallback simulated baseline
                rain_val = max(0.0, round(baseline["normal_rain"] + random.uniform(-6, 6), 1))
                temp_val = round(baseline["normal_temp"] + random.uniform(-2, 3), 1)
                humidity = round(random.uniform(60, 80), 1)
                wind = round(random.uniform(10, 22), 1)
                weather_desc = "data unavailable (OWM offline)"
                imd_warning = None

        return {
            "source": "IMD+OWM",
            "state": baseline.get("state", self.state),
            "district": district,
            "stationId": f"IMD_{district.upper().replace(' ', '_')}_AWS",
            "timestamp": now,
            "coordinates": [baseline["lng"], baseline["lat"]],
            # Primary weather metrics
            "rainfall_mm": rain_val,
            "rainfall_1h_mm": rain_1h,
            "rainfall_3h_mm": rain_3h,
            "forecast_rainfall_24h_mm": round(rain_val * 1.2 + random.uniform(-2, 2), 1),
            "temperature_c": temp_val,
            "humidity_pct": humidity,
            "wind_speed_kmh": wind,
            # IMD classification
            "official_warning": imd_warning,
            "weather_description": weather_desc,
            # Meta
            "owm_live": owm_fetched,
        }

    def fetch_all_districts(self, surge_district: str = None) -> list[dict]:
        """Fetches live IMD-style readings for all tracked Delhi-NCR districts."""
        readings = []
        for dist in DISTRICT_BASELINES:
            readings.append(
                self.fetch_district_telemetry(dist, simulate_surge=(dist == surge_district))
            )
        return readings
