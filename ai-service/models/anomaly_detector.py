"""
Multivariate Time-Series Anomaly Detector & Explainability Engine

Analyzes daily telemetry streams (rainfall, river level, temperature, wind speed,
humidity) for Delhi-NCR districts, evaluates statistical deviations against
historical baselines, and generates human-understandable justification reports.

Hazard categories:
  - Flood / FlashFlood  (rainfall + river level)
  - Heatwave            (temperature + humidity)
  - Storm               (wind speed + rainfall)
"""

from typing import Dict, Any, List, Tuple
import math


class AnomalyDetector:
    def __init__(self, anomaly_threshold: float = 0.55):
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
        baseline_stats: Dict[str, Dict[str, float]],
    ) -> Tuple[float, List[Dict[str, Any]], str, str]:
        """
        Evaluates current IMD and CWC readings against district baselines.

        Now covers:
          - Rainfall (IMD)
          - River level (CWC)
          - Temperature (IMD) — heatwave pressure
          - Wind speed (IMD) — storm pressure

        Returns:
            (anomaly_score, anomaly_features, recommended_severity, explanation_text)
        """
        rain_stats = baseline_stats.get("rainfall", {"mean": 12.0, "std": 10.0})
        river_stats = baseline_stats.get("river_level", {"mean": cwc_data["normal_level_m"], "std": 0.8})
        temp_stats = baseline_stats.get("temperature", {"mean": 33.5, "std": 3.5})

        current_rain = imd_data.get("rainfall_mm", 0.0)
        current_river = cwc_data.get("water_level_m", 0.0)
        warning_level = cwc_data.get("warning_level_m", 0.0)
        danger_level = cwc_data.get("danger_level_m", 0.0)
        rate_of_rise = cwc_data.get("rate_of_rise_m_per_hr", 0.0)
        current_temp = imd_data.get("temperature_c", 0.0)
        current_wind = imd_data.get("wind_speed_kmh", 0.0)
        humidity = imd_data.get("humidity_pct", 50)

        rain_z = self.calculate_z_score(current_rain, rain_stats["mean"], rain_stats["std"])
        river_z = self.calculate_z_score(current_river, river_stats["mean"], river_stats["std"])
        temp_z = self.calculate_z_score(current_temp, temp_stats["mean"], temp_stats["std"])
        wind_z = self.calculate_z_score(current_wind, 20.0, 15.0)  # baseline: 20 km/h, std 15

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
            {
                "indicator": "temperature_c",
                "currentValue": current_temp,
                "baselineMean": temp_stats["mean"],
                "baselineStd": temp_stats["std"],
                "deviationScore": max(0.0, temp_z),
                "unit": "°C",
            },
            {
                "indicator": "wind_speed_kmh",
                "currentValue": current_wind,
                "baselineMean": 20.0,
                "baselineStd": 15.0,
                "deviationScore": max(0.0, wind_z),
                "unit": "km/h",
            },
        ]

        # ── Flood score (60% river proximity + 40% rainfall) ─────────────────
        rain_score = min(1.0, max(0.0, rain_z / 6.0))  # z=6 → score=1.0

        river_margin = danger_level - warning_level
        if river_margin > 0 and current_river >= warning_level:
            river_danger_ratio = min(1.2, (current_river - warning_level) / river_margin)
            river_score = min(1.0, 0.65 + river_danger_ratio * 0.35)
        else:
            river_score = min(1.0, max(0.0, river_z / 4.0))

        flood_score = round(0.40 * rain_score + 0.60 * river_score, 3)

        # Rate of rise penalty
        if rate_of_rise >= 0.04:
            flood_score = min(1.0, round(flood_score + 0.10, 3))

        # ── Temperature pressure score ────────────────────────────────────────
        # Humidity amplifies heat stress (wet-bulb effect)
        humidity_factor = 1.0 + max(0.0, (humidity - 60) / 100.0)
        temp_score = min(1.0, max(0.0, temp_z / 4.0) * humidity_factor)

        # ── Wind pressure score ───────────────────────────────────────────────
        wind_score = min(1.0, max(0.0, wind_z / 5.0))

        # ── Fused composite anomaly (flood dominant, temp/wind augment) ───────
        fused_score = round(
            0.60 * flood_score + 0.25 * temp_score + 0.15 * wind_score,
            3
        )

        # ── Determine recommended severity ────────────────────────────────────
        if fused_score >= 0.85 or current_river >= danger_level:
            severity = "Emergency"
        elif fused_score >= 0.70 or current_river >= warning_level:
            severity = "Warning"
        elif fused_score >= self.anomaly_threshold:
            severity = "Watch"
        else:
            severity = "Advisory"

        # ── Generate explainability text ──────────────────────────────────────
        explanations = []

        if rain_z >= 2.0:
            explanations.append(
                f"Rainfall ({current_rain:.1f} mm/h) is {rain_z}σ above the 30-day normal "
                f"of {rain_stats['mean']:.1f} mm"
            )

        if current_river >= danger_level:
            explanations.append(
                f"{cwc_data.get('river', 'River')} water level ({current_river} m) has "
                f"breached the CWC Danger Mark ({danger_level} m)"
            )
        elif current_river >= warning_level:
            delta = round(current_river - warning_level, 2)
            explanations.append(
                f"{cwc_data.get('river', 'River')} level ({current_river} m) is "
                f"{delta} m above Warning Mark ({warning_level} m)"
            )
        elif river_z >= 1.5:
            explanations.append(
                f"River height elevated ({river_z}σ above seasonal normal of {river_stats['mean']:.2f} m)"
            )

        if rate_of_rise >= 0.04:
            explanations.append(
                f"Rapid catchment influx: {rate_of_rise * 100:.1f} cm/hr rise rate"
            )

        if temp_z >= 1.5:
            explanations.append(
                f"Elevated temperature ({current_temp}°C, {temp_z}σ above baseline of {temp_stats['mean']}°C)"
            )

        if wind_z >= 2.0:
            explanations.append(
                f"High wind speed ({current_wind} km/h, {wind_z}σ above normal)"
            )

        if not explanations:
            explanation_text = (
                f"All telemetry parameters within normal statistical variance for {district}. "
                f"Current conditions: {current_temp}°C, {current_rain} mm rain, "
                f"river at {current_river} m (warning: {warning_level} m)."
            )
        else:
            explanation_text = (
                f"Composite anomaly score {fused_score} for {district}: "
                + "; ".join(explanations) + "."
            )

        return fused_score, features, severity, explanation_text
