"""
Multivariate Time-Series Anomaly Detector & Explainability Engine

Analyzes daily telemetry streams (rainfall, river level, temperature, wind speed),
evaluates statistical deviations against historical baselines, and generates
human-understandable justification reports.
"""

from typing import Dict, Any, List, Tuple
import math

class AnomalyDetector:
    def __init__(self, anomaly_threshold: float = 0.65):
        self.anomaly_threshold = anomaly_threshold

    def calculate_z_score(self, value: float, mean: float, std: float) -> float:
        """Calculates standard score (z-score) with safety floor for small std."""
        effective_std = max(std, 0.5)
        return round((value - mean) / effective_std, 2)

    def evaluate_telemetry(
        self,
        district: str,
        imd_data: Dict[str, Any],
        cwc_data: Dict[str, Any],
        baseline_stats: Dict[str, Dict[str, float]]
    ) -> Tuple[float, List[Dict[str, Any]], str, str]:
        """
        Evaluates current IMD and CWC readings against district baseline.

        Returns:
            (anomaly_score, anomaly_features, recommended_severity, explanation_text)
        """
        rain_stats = baseline_stats.get("rainfall", {"mean": 12.0, "std": 10.0})
        river_stats = baseline_stats.get("river_level", {"mean": cwc_data["normal_level_m"], "std": 0.8})

        current_rain = imd_data.get("rainfall_mm", 0.0)
        current_river = cwc_data.get("water_level_m", 0.0)
        warning_level = cwc_data.get("warning_level_m", 0.0)
        danger_level = cwc_data.get("danger_level_m", 0.0)
        rate_of_rise = cwc_data.get("rate_of_rise_m_per_hr", 0.0)

        rain_z = self.calculate_z_score(current_rain, rain_stats["mean"], rain_stats["std"])
        river_z = self.calculate_z_score(current_river, river_stats["mean"], river_stats["std"])

        features = [
            {
                "indicator": "rainfall_mm",
                "currentValue": current_rain,
                "baselineMean": rain_stats["mean"],
                "baselineStd": rain_stats["std"],
                "deviationScore": max(0.0, rain_z),
                "unit": "mm",
            },
            {
                "indicator": "river_level_m",
                "currentValue": current_river,
                "baselineMean": river_stats["mean"],
                "baselineStd": river_stats["std"],
                "deviationScore": max(0.0, river_z),
                "unit": "m",
            },
        ]

        # Multi-factor anomaly fusion
        # Weighting: River level proximity to danger mark has highest gravity for floods
        rain_score = min(1.0, max(0.0, rain_z / 6.0)) # z=6 reaches 1.0
        river_margin = danger_level - warning_level
        if river_margin > 0 and current_river >= warning_level:
            river_danger_ratio = min(1.2, (current_river - warning_level) / river_margin)
            river_score = min(1.0, 0.65 + river_danger_ratio * 0.35)
        else:
            river_score = min(1.0, max(0.0, river_z / 4.0))

        # Composite anomaly score (60% river level + 40% rainfall)
        fused_score = round(0.40 * rain_score + 0.60 * river_score, 2)

        # Rate of rise penalty
        if rate_of_rise >= 0.04:
            fused_score = min(1.0, round(fused_score + 0.10, 2))

        # Determine recommended severity
        if fused_score >= 0.85 or current_river >= danger_level:
            severity = "Emergency"
        elif fused_score >= 0.70 or current_river >= warning_level:
            severity = "Warning"
        elif fused_score >= self.anomaly_threshold:
            severity = "Watch"
        else:
            severity = "Advisory"

        # Generate human-readable explainability
        explanations = []
        if rain_z >= 2.5:
            explanations.append(f"24h precipitation ({current_rain} mm) is {rain_z}σ above 30-day baseline")
        if current_river >= danger_level:
            explanations.append(f"{cwc_data.get('river', 'River')} water level ({current_river} m) has breached the CWC Danger Mark ({danger_level} m)")
        elif current_river >= warning_level:
            delta = round(current_river - warning_level, 2)
            explanations.append(f"{cwc_data.get('river', 'River')} level ({current_river} m) is {delta}m above the Warning Mark ({warning_level} m)")
        elif river_z >= 2.0:
            explanations.append(f"{cwc_data.get('river', 'River')} height is elevated ({river_z}σ above seasonal normal)")

        if rate_of_rise >= 0.04:
            explanations.append(f"rapid catchment influx detected ({rate_of_rise * 100:.1f} cm/hr rise rate)")

        if not explanations:
            explanation_text = f"Telemetry parameters within normal statistical variance for {district}."
        else:
            explanation_text = f"Multivariate anomaly score {fused_score}: " + "; ".join(explanations) + "."

        return fused_score, features, severity, explanation_text
