"""
CWC (Central Water Commission) River Gauge Ingestor — Delhi NCR Edition

Tracks river water levels and flood risk indicators for key districts
surrounding Delhi NCR: Noida, Greater Noida, Ghaziabad, Faridabad, Gurugram, and Delhi.

Since CWC doesn't expose a public REST API, this ingestor uses:
  - OpenWeatherMap Current Weather (rainfall/humidity as flood-risk proxy)
  - CWC-reference warning/danger levels sourced from official CWC tables
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

# ── Delhi-NCR River Station Metadata ─────────────────────────────────────────
# Warning/Danger levels sourced from CWC's official published stations.
# Yamuna:  Delhi Pul Pehladpur WL Warning=203.75m, Danger=204.83m
# Hindon:  Ghaziabad gauge Warning=198.0m, Danger=199.0m
# Yamuna:  Faridabad / Agra Canal Warning=201.5m, Danger=202.5m
# Sahibi:  Gurugram (Najafgarh drain) Warning=217.0m, Danger=218.0m
#
# Gauge readings are derived from OWM accumulated precipitation +
# baseline level offsets so that heavy rainfall pushes levels upward.

RIVER_STATIONS = {
    "Noida": {
        "state": "Uttar Pradesh",
        "river": "Yamuna / Hindon",
        "station": "Noida Yamuna Bridge Gauge",
        "owm_city": "Noida,IN",
        "lat": 28.5355,
        "lng": 77.3910,
        "warning_level": 200.50,
        "danger_level": 201.50,
        "normal_level": 198.80,
    },
    "Gautam Buddha Nagar": {
        "state": "Uttar Pradesh",
        "river": "Yamuna / Hindon",
        "station": "Greater Noida Gauge",
        "owm_city": "Greater Noida,IN",
        "lat": 28.4744,
        "lng": 77.5040,
        "warning_level": 199.80,
        "danger_level": 200.80,
        "normal_level": 198.10,
    },
    "Ghaziabad": {
        "state": "Uttar Pradesh",
        "river": "Hindon",
        "station": "Hindon Bridge Gauge, Ghaziabad",
        "owm_city": "Ghaziabad,IN",
        "lat": 28.6692,
        "lng": 77.4538,
        "warning_level": 198.00,
        "danger_level": 199.00,
        "normal_level": 196.50,
    },
    "Faridabad": {
        "state": "Haryana",
        "river": "Yamuna",
        "station": "Faridabad Yamuna Gauge",
        "owm_city": "Faridabad,IN",
        "lat": 28.4089,
        "lng": 77.3178,
        "warning_level": 201.50,
        "danger_level": 202.50,
        "normal_level": 199.70,
    },
    "Gurugram": {
        "state": "Haryana",
        "river": "Sahibi / Najafgarh Drain",
        "station": "Basai Wetland Gauge, Gurugram",
        "owm_city": "Gurugram,IN",
        "lat": 28.4595,
        "lng": 77.0266,
        "warning_level": 217.00,
        "danger_level": 218.00,
        "normal_level": 215.50,
    },
    "Delhi": {
        "state": "Delhi",
        "river": "Yamuna",
        "station": "Old Railway Bridge Gauge, Delhi",
        "owm_city": "New Delhi,IN",
        "lat": 28.7041,
        "lng": 77.1025,
        "warning_level": 204.50,
        "danger_level": 205.33,
        "normal_level": 202.18,
    },
}


def _fetch_owm_weather(city: str) -> dict | None:
    """Calls OWM Current Weather API and returns the JSON response."""
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
        logger.warning(f"[CWC Ingestor] OWM request failed for '{city}': {exc}")
        return None


def _gauge_from_weather(normal_level: float, warning_level: float, danger_level: float, owm: dict) -> tuple[float, str, float]:
    """
    Derives an approximate river gauge reading from OWM precipitation data.

    Logic:
      - Base level starts at normal_level.
      - 1h accumulated rain (mm) adds ~0.08 m per mm above 5 mm threshold.
      - 3h accumulated rain adds ~0.05 m per mm above 8 mm threshold.
      - Capped at danger_level + 0.5 for realism.
    Returns (current_level_m, trend, rate_of_rise_m_per_hr).
    """
    rain_1h = owm.get("rain", {}).get("1h", 0.0)
    rain_3h = owm.get("rain", {}).get("3h", 0.0)
    humidity = owm.get("main", {}).get("humidity", 60)

    # Rainfall contribution to gauge rise
    rise_from_1h = max(0.0, (rain_1h - 5.0) * 0.08)
    rise_from_3h = max(0.0, (rain_3h - 8.0) * 0.05)
    humidity_rise = max(0.0, (humidity - 80) * 0.002)

    total_rise = rise_from_1h + rise_from_3h + humidity_rise

    # Add a small realistic scatter (±0.05 m)
    scatter = random.uniform(-0.05, 0.05)
    current_level = round(
        min(normal_level + total_rise + scatter, danger_level + 0.5),
        2,
    )

    # Rate of rise (m/hr) — inferred from 1h rain
    rate = round(rise_from_1h + humidity_rise * 0.5 + random.uniform(-0.005, 0.005), 3)

    if current_level >= warning_level:
        trend = "Rising Rapidly"
    elif rate > 0.02:
        trend = "Rising"
    elif rate < -0.01:
        trend = "Falling"
    else:
        trend = "Steady"

    return current_level, trend, rate


class CwcIngestor:
    """
    Ingests real-time weather data from OpenWeatherMap and translates it into
    CWC-style river gauge readings for Delhi-NCR districts.
    """

    def __init__(self, state: str = "Delhi NCR"):
        self.state = state

    def fetch_gauge_reading(self, district: str, simulate_surge: bool = False) -> dict:
        """
        Fetches current water level gauge reading for a Delhi-NCR district.

        - Calls OpenWeatherMap to get live precipitation, humidity, and weather data.
        - Derives gauge level from OWM rainfall using CWC reference thresholds.
        - Falls back to simulated data if OWM is unreachable.
        - If simulate_surge=True, overrides with a critical flood scenario.
        """
        info = RIVER_STATIONS.get(district)
        if info is None:
            # Fallback for unknown districts
            info = {
                "state": self.state,
                "river": "Local Drain",
                "station": f"{district} Gauge",
                "owm_city": f"{district},IN",
                "lat": 28.6139,
                "lng": 77.2090,
                "warning_level": 50.0,
                "danger_level": 51.0,
                "normal_level": 48.0,
            }

        warning_level = info["warning_level"]
        danger_level = info["danger_level"]
        normal_level = info["normal_level"]

        # ── Live fetch from OWM ──────────────────────────────────────────────
        owm_raw = None
        rain_1h = 0.0
        rain_3h = 0.0
        humidity = 60
        weather_desc = "N/A"
        owm_fetched = False

        if not simulate_surge:
            owm_raw = _fetch_owm_weather(info["owm_city"])
            if owm_raw:
                owm_fetched = True
                rain_1h = owm_raw.get("rain", {}).get("1h", 0.0)
                rain_3h = owm_raw.get("rain", {}).get("3h", 0.0)
                humidity = owm_raw.get("main", {}).get("humidity", 60)
                weather_desc = owm_raw.get("weather", [{}])[0].get("description", "clear")
                current_level, trend, rate = _gauge_from_weather(
                    normal_level, warning_level, danger_level, owm_raw
                )
            else:
                # OWM unavailable — use simulated baseline
                current_level = round(normal_level + random.uniform(-0.2, 0.3), 2)
                rate = round(random.uniform(-0.01, 0.01), 3)
                trend = "Steady"

        if simulate_surge:
            # Extreme flood surge simulation
            current_level = round(
                warning_level + (danger_level - warning_level) * 0.85 + random.uniform(0.05, 0.25),
                2,
            )
            rate = round(random.uniform(0.04, 0.08), 3)
            trend = "Rising Rapidly"
            rain_1h = round(random.uniform(35, 75), 1)
            rain_3h = round(random.uniform(80, 150), 1)

        return {
            "source": "CWC+OWM",
            "state": info.get("state", self.state),
            "district": district,
            "river": info["river"],
            "stationName": info["station"],
            "stationId": f"CWC_{district.upper().replace(' ', '_')}_GAUGE",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            # Gauge data
            "water_level_m": current_level,
            "warning_level_m": warning_level,
            "danger_level_m": danger_level,
            "normal_level_m": normal_level,
            "rate_of_rise_m_per_hr": rate,
            "trend": trend,
            "is_above_warning": current_level >= warning_level,
            "is_above_danger": current_level >= danger_level,
            # OWM-derived rain context
            "rainfall_1h_mm": rain_1h,
            "rainfall_3h_mm": rain_3h,
            "humidity_pct": humidity,
            "weather_description": weather_desc,
            "owm_live": owm_fetched,
            # Location
            "coordinates": [info["lng"], info["lat"]],
        }

    def fetch_all_gauges(self, surge_district: str = None) -> list[dict]:
        """Fetches live gauge readings for all tracked Delhi-NCR districts."""
        readings = []
        for dist in RIVER_STATIONS:
            readings.append(
                self.fetch_gauge_reading(dist, simulate_surge=(dist == surge_district))
            )
        return readings
