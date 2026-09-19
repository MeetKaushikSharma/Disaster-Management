"""
IMD (India Meteorological Department) Ingestor

Fetches and normalizes district-wise meteorological data, rainfall forecasts,
and temperature observations across Indian monitoring stations.
"""

from datetime import datetime, timezone
import random

DISTRICT_BASELINES = {
    "Varanasi": {"normal_rain": 12.0, "normal_temp": 32.0, "lat": 25.3176, "lng": 82.9739},
    "Gorakhpur": {"normal_rain": 18.0, "normal_temp": 31.0, "lat": 26.7606, "lng": 83.3732},
    "Prayagraj": {"normal_rain": 14.0, "normal_temp": 33.5, "lat": 25.4358, "lng": 81.8463},
    "Lucknow": {"normal_rain": 10.0, "normal_temp": 34.0, "lat": 26.8467, "lng": 80.9462},
    "Ayodhya": {"normal_rain": 11.0, "normal_temp": 32.5, "lat": 26.7922, "lng": 82.1998},
    "Kanpur": {"normal_rain": 9.5, "normal_temp": 34.5, "lat": 26.4499, "lng": 80.3319},
}

class ImdIngestor:
    def __init__(self, state: str = "Uttar Pradesh"):
        self.state = state

    def fetch_district_telemetry(self, district: str, simulate_surge: bool = False) -> dict:
        """
        Fetches current IMD meteorological observation for a district.
        If simulate_surge is True, generates extreme heavy rainfall spike.
        """
        baseline = DISTRICT_BASELINES.get(district, {"normal_rain": 10.0, "normal_temp": 32.0, "lat": 25.3, "lng": 82.9})
        now = datetime.now(timezone.utc).isoformat()

        if simulate_surge:
            rain_val = round(baseline["normal_rain"] * 5.5 + random.uniform(15, 35), 1)
            temp_val = round(baseline["normal_temp"] - 3.0, 1)
            humidity = round(random.uniform(92, 98), 1)
            wind = round(random.uniform(35, 65), 1)
            imd_warning = "Heavy to Very Heavy Rainfall Alert"
        else:
            rain_val = max(0.0, round(baseline["normal_rain"] + random.uniform(-6, 6), 1))
            temp_val = round(baseline["normal_temp"] + random.uniform(-2, 3), 1)
            humidity = round(random.uniform(60, 80), 1)
            wind = round(random.uniform(10, 22), 1)
            imd_warning = None

        return {
            "source": "IMD",
            "state": self.state,
            "district": district,
            "stationId": f"IMD_{district.upper()}_AWS",
            "timestamp": now,
            "coordinates": [baseline["lng"], baseline["lat"]],
            "rainfall_mm": rain_val,
            "forecast_rainfall_24h_mm": round(rain_val * 1.2, 1),
            "temperature_c": temp_val,
            "humidity_pct": humidity,
            "wind_speed_kmh": wind,
            "official_warning": imd_warning,
        }

    def fetch_all_districts(self, surge_district: str = "Varanasi") -> list[dict]:
        """Fetches readings for all tracked districts in the region."""
        readings = []
        for dist in DISTRICT_BASELINES.keys():
            readings.append(self.fetch_district_telemetry(dist, simulate_surge=(dist == surge_district)))
        return readings
