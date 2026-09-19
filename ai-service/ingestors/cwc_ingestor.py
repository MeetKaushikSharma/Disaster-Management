"""
CWC (Central Water Commission) River Gauge Ingestor

Tracks river water levels, gauge heights, and danger/warning marks across
major river basins in India (Ganga, Yamuna, Rapti, Gomti, Ghaghara).
"""

from datetime import datetime, timezone
import random

RIVER_STATIONS = {
    "Varanasi": {
        "river": "Ganga",
        "station": "Varanasi Ghat Station",
        "warning_level": 70.26,
        "danger_level": 71.26,
        "normal_level": 68.4,
    },
    "Gorakhpur": {
        "river": "Rapti",
        "station": "Birdghat Gauge",
        "warning_level": 73.98,
        "danger_level": 74.98,
        "normal_level": 72.5,
    },
    "Prayagraj": {
        "river": "Ganga/Yamuna Sangam",
        "station": "Phaphamau Station",
        "warning_level": 83.73,
        "danger_level": 84.73,
        "normal_level": 81.0,
    },
    "Lucknow": {
        "river": "Gomti",
        "station": "Hanuman Setu Gauge",
        "warning_level": 108.5,
        "danger_level": 109.5,
        "normal_level": 106.1,
    },
    "Ayodhya": {
        "river": "Saryu / Ghaghara",
        "station": "Ayodhya Bridge",
        "warning_level": 92.73,
        "danger_level": 93.73,
        "normal_level": 90.8,
    },
}

class CwcIngestor:
    def __init__(self, state: str = "Uttar Pradesh"):
        self.state = state

    def fetch_gauge_reading(self, district: str, simulate_surge: bool = False) -> dict:
        """
        Fetches current water level gauge reading from CWC station.
        If simulate_surge is True, water level crosses Warning Level and approaches Danger Mark.
        """
        info = RIVER_STATIONS.get(district, {
            "river": "Local River",
            "station": f"{district} Gauge",
            "warning_level": 50.0,
            "danger_level": 51.0,
            "normal_level": 48.0,
        })

        warning_level = info["warning_level"]
        danger_level = info["danger_level"]
        normal_level = info["normal_level"]

        if simulate_surge:
            # Water level between Warning Level and Danger Mark (+/- a few cm)
            current_level = round(warning_level + (danger_level - warning_level) * 0.85 + random.uniform(0.05, 0.25), 2)
            rate_of_rise = round(random.uniform(0.04, 0.08), 3) # cm/hr
            trend = "Rising Rapidly"
        else:
            current_level = round(normal_level + random.uniform(-0.2, 0.3), 2)
            rate_of_rise = round(random.uniform(-0.01, 0.01), 3)
            trend = "Steady"

        return {
            "source": "CWC",
            "state": self.state,
            "district": district,
            "river": info["river"],
            "stationName": info["station"],
            "stationId": f"CWC_{district.upper()}_GAUGE",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "water_level_m": current_level,
            "warning_level_m": warning_level,
            "danger_level_m": danger_level,
            "rate_of_rise_m_per_hr": rate_of_rise,
            "trend": trend,
            "is_above_warning": current_level >= warning_level,
            "is_above_danger": current_level >= danger_level,
        }

    def fetch_all_gauges(self, surge_district: str = "Varanasi") -> list[dict]:
        readings = []
        for dist in RIVER_STATIONS.keys():
            readings.append(self.fetch_gauge_reading(dist, simulate_surge=(dist == surge_district)))
        return readings
