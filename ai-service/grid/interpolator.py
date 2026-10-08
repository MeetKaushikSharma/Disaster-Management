"""
Spatial Interpolation Engine (IDW) — Delhi NCR

Uses Inverse Distance Weighting (IDW) to smoothly interpolate discrete
monitoring station telemetry across the dense NCR grid for Windy-style
heat map rendering.
"""

import numpy as np
from typing import Dict, List, Any
from .delhi_ncr_grid import PRIMARY_STATIONS, generate_ncr_grid

LAYER_SCALES = {
    "rainfall": {"min": 0.0, "max": 100.0, "unit": "mm/h"},
    "temperature": {"min": 15.0, "max": 50.0, "unit": "°C"},
    "wind": {"min": 0.0, "max": 120.0, "unit": "km/h"},
    "river": {"min": 0.0, "max": 100.0, "unit": "% capacity"},
    "risk": {"min": 0.0, "max": 100.0, "unit": "Score"},
}


class SpatialInterpolator:
    def __init__(self, p_power: float = 2.0):
        self.p_power = p_power
        self.grid_points = generate_ncr_grid(resolution_deg=0.025)
        self._init_station_coords()

    def _init_station_coords(self):
        self.station_names = list(PRIMARY_STATIONS.keys())
        self.station_coords = np.array([
            [PRIMARY_STATIONS[name]["lat"], PRIMARY_STATIONS[name]["lng"]]
            for name in self.station_names
        ])

    def interpolate_layer(
        self,
        station_values: Dict[str, float],
        layer: str = "rainfall"
    ) -> List[Dict[str, Any]]:
        """
        Interpolates a single layer across all grid points using IDW.

        station_values: mapping of district -> numerical value
        layer: 'rainfall' | 'temperature' | 'wind' | 'river' | 'risk'
        """
        scale = LAYER_SCALES.get(layer, LAYER_SCALES["rainfall"])
        min_val, max_val = scale["min"], scale["max"]

        # Extract values in fixed station order
        known_values = np.array([
            station_values.get(name, (min_val + max_val) / 2.0)
            for name in self.station_names
        ], dtype=float)

        grid_coords = np.array([
            [pt["lat"], pt["lng"]] for pt in self.grid_points
        ])

        # Compute Euclidean distance matrix: (num_grid, num_stations)
        # diff: (num_grid, 1, 2) - (1, num_stations, 2) => (num_grid, num_stations, 2)
        diff = grid_coords[:, np.newaxis, :] - self.station_coords[np.newaxis, :, :]
        dist = np.sqrt(np.sum(diff ** 2, axis=2))

        # Avoid zero-division at exact station locations
        eps = 1e-5
        weights = 1.0 / (np.power(dist, self.p_power) + eps)
        weights_sum = np.sum(weights, axis=1, keepdims=True)
        normalized_weights = weights / weights_sum

        interpolated_vals = np.sum(normalized_weights * known_values, axis=1)

        # Normalize intensity between 0.0 and 1.0 for heatmap rendering
        denom = max_val - min_val if max_val != min_val else 1.0
        normalized_intensity = np.clip((interpolated_vals - min_val) / denom, 0.0, 1.0)

        results = []
        for i, pt in enumerate(self.grid_points):
            val = float(interpolated_vals[i])
            intensity = float(normalized_intensity[i])
            results.append({
                "lat": pt["lat"],
                "lng": pt["lng"],
                "value": round(val, 2),
                "intensity": round(intensity, 3),
                "nearestDistrict": pt["nearestDistrict"],
            })

        return results

    def interpolate_all_layers(
        self,
        readings_by_district: Dict[str, Dict[str, float]]
    ) -> Dict[str, List[Dict[str, Any]]]:
        """
        readings_by_district: {
            'Delhi': {'rainfall_mm': 12.0, 'temperature_c': 34.0, ...},
            ...
        }
        """
        all_layers = {}

        # 1. Rainfall
        rain_vals = {d: readings_by_district.get(d, {}).get("rainfall_mm", 0.0) for d in self.station_names}
        all_layers["rainfall"] = self.interpolate_layer(rain_vals, "rainfall")

        # 2. Temperature
        temp_vals = {d: readings_by_district.get(d, {}).get("temperature_c", 32.0) for d in self.station_names}
        all_layers["temperature"] = self.interpolate_layer(temp_vals, "temperature")

        # 3. Wind
        wind_vals = {d: readings_by_district.get(d, {}).get("wind_speed_kmh", 12.0) for d in self.station_names}
        all_layers["wind"] = self.interpolate_layer(wind_vals, "wind")

        # 4. River (% towards danger level)
        river_vals = {}
        for d in self.station_names:
            st = PRIMARY_STATIONS[d]
            norm = st["normal_river_level"]
            dang = st["danger_river_level"]
            actual = readings_by_district.get(d, {}).get("river_level_m", norm)
            pct = max(0.0, min(100.0, ((actual - norm) / (dang - norm + 1e-4)) * 100.0))
            river_vals[d] = pct
        all_layers["river"] = self.interpolate_layer(river_vals, "river")

        # 5. Composite Risk
        risk_vals = {d: readings_by_district.get(d, {}).get("risk_score", 20.0) for d in self.station_names}
        all_layers["risk"] = self.interpolate_layer(risk_vals, "risk")

        return all_layers
