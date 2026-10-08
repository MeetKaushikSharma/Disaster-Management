"""
Disaster Early Warning Prediction & Ensemble Engine

Fuses XGBoost nowcasts and LSTM sequential trend predictions with probabilistic
risk equations to produce 6-hour disaster forecasts across Delhi-NCR.
"""

import math
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional
try:
    from .xgb_nowcaster import XGBNowcaster
    from .lstm_forecaster import LSTMForecaster
    from ..grid.delhi_ncr_grid import PRIMARY_STATIONS
except (ImportError, ValueError):
    from models.xgb_nowcaster import XGBNowcaster
    from models.lstm_forecaster import LSTMForecaster
    from grid.delhi_ncr_grid import PRIMARY_STATIONS


def sigmoid(x: float, k: float = 1.0, x0: float = 0.0) -> float:
    try:
        return 1.0 / (1.0 + math.exp(-k * (x - x0)))
    except OverflowError:
        return 0.0 if (x - x0) < 0 else 1.0


class PredictionEngine:
    def __init__(self):
        self.xgb_model = XGBNowcaster()
        self.lstm_model = LSTMForecaster()

    def predict_district_ensemble(
        self,
        district: str,
        readings_history: List[Dict[str, Any]]
    ) -> Dict[str, Any]:
        """
        Combines XGBoost and LSTM predictions for a single district.
        """
        xgb_res = self.xgb_model.predict_district(district, readings_history)
        lstm_res = self.lstm_model.predict_district(district, readings_history)

        station_info = PRIMARY_STATIONS.get(district, {
            "lat": 28.58, "lng": 77.25,
            "normal_river_level": 200.0, "danger_river_level": 202.0
        })

        fused_predictions = {}
        model_tag = "trend_baseline"

        indicators = ["rainfall_mm", "temperature_c", "wind_speed_kmh", "river_level_m"]

        has_xgb = xgb_res is not None and "predictions" in xgb_res
        has_lstm = lstm_res is not None and "predictions" in lstm_res

        if has_xgb and has_lstm:
            model_tag = "xgboost+lstm_ensemble"
            for ind in indicators:
                x_val = xgb_res["predictions"].get(ind, {}).get("value", 0.0)
                l_val = lstm_res["predictions"].get(ind, {}).get("value", x_val)
                fused_val = (0.60 * x_val) + (0.40 * l_val)
                conf = xgb_res["predictions"].get(ind, {}).get("confidence", 0.75)
                fused_predictions[ind] = {
                    "value": round(fused_val, 2),
                    "confidence": conf,
                    "range": xgb_res["predictions"].get(ind, {}).get("range", [fused_val * 0.8, fused_val * 1.2]),
                    "xgb_val": round(x_val, 2),
                    "lstm_val": round(l_val, 2),
                }
        elif has_xgb:
            model_tag = xgb_res.get("model", "xgboost_nowcaster")
            for ind in indicators:
                p = xgb_res["predictions"].get(ind, {})
                fused_predictions[ind] = {
                    "value": p.get("value", 0.0),
                    "confidence": p.get("confidence", 0.70),
                    "range": p.get("range", [0, 0]),
                }
        else:
            model_tag = "fallback_heuristic"
            for ind in indicators:
                fused_predictions[ind] = {
                    "value": 0.0 if ind != "temperature_c" else 32.0,
                    "confidence": 0.50,
                    "range": [0, 0],
                }

        # Calculate probabilistic hazard risk scores (0.0 to 1.0)
        p_rain = fused_predictions.get("rainfall_mm", {}).get("value", 0.0)
        p_temp = fused_predictions.get("temperature_c", {}).get("value", 32.0)
        p_wind = fused_predictions.get("wind_speed_kmh", {}).get("value", 10.0)
        p_river = fused_predictions.get("river_level_m", {}).get("value", station_info["normal_river_level"])

        # 1. Flood Probability: S-curve centered around 40 mm/h rain
        flood_prob = sigmoid(p_rain, k=0.08, x0=35.0)

        # 2. Heatwave Probability: S-curve centered around 41 °C
        heatwave_prob = sigmoid(p_temp, k=0.45, x0=40.5)

        # 3. Storm/Squall Probability: S-curve centered around 55 km/h
        storm_prob = sigmoid(p_wind, k=0.08, x0=50.0)

        # 4. River Breach Probability
        danger = station_info["danger_river_level"]
        normal = station_info["normal_river_level"]
        river_diff = p_river - normal
        river_capacity = danger - normal
        river_breach_prob = max(0.0, min(1.0, river_diff / (river_capacity + 1e-4)))

        # Composite risk calculation
        composite = (
            (0.35 * flood_prob) +
            (0.30 * river_breach_prob) +
            (0.20 * storm_prob) +
            (0.15 * heatwave_prob)
        )

        # Priority override if any single hazard is acute
        max_single = max(flood_prob, river_breach_prob, storm_prob, heatwave_prob)
        if max_single >= 0.70:
            composite = max(composite, max_single)

        composite = round(min(1.0, max(0.0, composite)), 2)

        # Determine severity and dominant hazard
        hazard_map = {
            "Flood / Flash Flooding": flood_prob,
            "River Breach / Inundation": river_breach_prob,
            "Severe Storm / High Winds": storm_prob,
            "Extreme Heatwave": heatwave_prob,
        }
        dominant_hazard = max(hazard_map, key=hazard_map.get)

        if composite >= 0.75:
            severity = "Emergency"
        elif composite >= 0.55:
            severity = "Warning"
        elif composite >= 0.35:
            severity = "Watch"
        else:
            severity = "Advisory"

        # Generate natural language explanation
        explanation = (
            f"6-hour forecast for {district} ({model_tag}): "
            f"Rainfall {p_rain} mm/h (Flood risk {int(flood_prob*100)}%), "
            f"Temperature {p_temp}°C (Heat risk {int(heatwave_prob*100)}%), "
            f"Wind {p_wind} km/h (Storm risk {int(storm_prob*100)}%), "
            f"River gauge {p_river} m (Breach risk {int(river_breach_prob*100)}%). "
            f"Dominant anticipated risk: {dominant_hazard}."
        )

        return {
            "district": district,
            "state": station_info.get("state", "Delhi NCR"),
            "coordinates": [station_info["lng"], station_info["lat"]],
            "predictionHorizon": "6h",
            "modelUsed": model_tag,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "predictions": fused_predictions,
            "riskScores": {
                "flood": round(flood_prob, 2),
                "riverBreach": round(river_breach_prob, 2),
                "storm": round(storm_prob, 2),
                "heatwave": round(heatwave_prob, 2),
                "composite": composite,
            },
            "predictedSeverity": severity,
            "dominantHazard": dominant_hazard,
            "explanation": explanation,
            "shouldAlert": composite >= 0.60,
        }

    def predict_all_districts(
        self,
        district_histories: Dict[str, List[Dict[str, Any]]]
    ) -> List[Dict[str, Any]]:
        results = []
        for district in PRIMARY_STATIONS.keys():
            history = district_histories.get(district, [])
            pred = self.predict_district_ensemble(district, history)
            results.append(pred)
        return results
