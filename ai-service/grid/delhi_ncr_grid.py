"""
Delhi-NCR Dense Spatial Grid Generator

Generates a uniform dense geographic grid across the National Capital Region (NCR)
for spatial interpolation and multi-layer heat map visualization (Windy style).
"""

from dataclasses import dataclass
from typing import List, Dict, Any

# Delhi-NCR Bounding Box
NCR_BOUNDS = {
    "min_lat": 28.35,
    "max_lat": 28.75,
    "min_lng": 76.95,
    "max_lng": 77.55,
    "center": [28.58, 77.25],
    "zoom": 10,
}

# The 6 primary monitoring stations in Delhi-NCR
# rain_threshold_mm       : IMD heavy rainfall 24h threshold for this area (mm)
# discharge_threshold_m3s : Historical CWC danger-level river discharge proxy (m³/s)
#                           Used to normalize GloFAS forecast discharge to a 0–1 risk ratio
# discharge_scale         : Divisor converting GloFAS discharge (m³/s) → gauge level proxy (m)
PRIMARY_STATIONS = {
    "Delhi": {
        "lat": 28.7041,
        "lng": 77.1025,
        "state": "Delhi",
        "river_basin": "Yamuna",
        "normal_river_level": 202.18,
        "danger_river_level": 205.33,
        # IMD Delhi heavy rain threshold (64.5 mm = yellow, 115.6 = orange)
        "rain_threshold_mm": 64.5,
        # Yamuna at Old Railway Bridge: danger discharge ~9,500 m³/s (CWC)
        "discharge_threshold_m3s": 9500.0,
        # Scale factor: Yamuna discharge ÷ 9500 approximates 0–1 breach index
        "discharge_scale": 50.0,
    },
    "Noida": {
        "lat": 28.5355,
        "lng": 77.3910,
        "state": "Uttar Pradesh",
        "river_basin": "Yamuna/Hindon",
        "normal_river_level": 198.80,
        "danger_river_level": 201.50,
        "rain_threshold_mm": 64.5,
        "discharge_threshold_m3s": 3500.0,
        "discharge_scale": 20.0,
    },
    "Ghaziabad": {
        "lat": 28.6692,
        "lng": 77.4538,
        "state": "Uttar Pradesh",
        "river_basin": "Hindon",
        "normal_river_level": 196.50,
        "danger_river_level": 199.00,
        "rain_threshold_mm": 64.5,
        "discharge_threshold_m3s": 1200.0,
        "discharge_scale": 10.0,
    },
    "Faridabad": {
        "lat": 28.4089,
        "lng": 77.3178,
        "state": "Haryana",
        "river_basin": "Yamuna",
        "normal_river_level": 199.70,
        "danger_river_level": 202.50,
        "rain_threshold_mm": 64.5,
        "discharge_threshold_m3s": 4000.0,
        "discharge_scale": 20.0,
    },
    "Gurugram": {
        "lat": 28.4595,
        "lng": 77.0266,
        "state": "Haryana",
        "river_basin": "Najafgarh",
        "normal_river_level": 215.50,
        "danger_river_level": 218.00,
        "rain_threshold_mm": 64.5,
        "discharge_threshold_m3s": 500.0,
        "discharge_scale": 5.0,
    },
    "Gautam Buddha Nagar": {
        "lat": 28.4744,
        "lng": 77.5040,
        "state": "Uttar Pradesh",
        "river_basin": "Yamuna",
        "normal_river_level": 198.10,
        "danger_river_level": 200.80,
        "rain_threshold_mm": 64.5,
        "discharge_threshold_m3s": 3000.0,
        "discharge_scale": 15.0,
    },
}


@dataclass
class GridPoint:
    lat: float
    lng: float
    nearest_district: str
    distance_to_nearest_km: float


def generate_ncr_grid(resolution_deg: float = 0.025) -> List[Dict[str, Any]]:
    """
    Generates a list of geographic coordinate points covering Delhi-NCR.
    resolution_deg: 0.025 degrees is approximately 2.7 km between sample points.
    Produces ~280-350 dense points.
    """
    points = []
    lat = NCR_BOUNDS["min_lat"]
    while lat <= NCR_BOUNDS["max_lat"] + 1e-6:
        lng = NCR_BOUNDS["min_lng"]
        while lng <= NCR_BOUNDS["max_lng"] + 1e-6:
            # Find nearest primary station
            nearest_district = "Delhi"
            min_dist_sq = float("inf")
            for dist_name, station in PRIMARY_STATIONS.items():
                d2 = (lat - station["lat"]) ** 2 + (lng - station["lng"]) ** 2
                if d2 < min_dist_sq:
                    min_dist_sq = d2
                    nearest_district = dist_name

            # Rough km conversion for NCR latitude
            approx_dist_km = (min_dist_sq ** 0.5) * 111.0

            points.append({
                "lat": round(lat, 4),
                "lng": round(lng, 4),
                "nearestDistrict": nearest_district,
                "distanceToStationKm": round(approx_dist_km, 2),
            })
            lng += resolution_deg
        lat += resolution_deg

    return points
