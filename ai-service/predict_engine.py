"""
predict_engine.py — Standalone AI Disaster Prediction Pipeline

Callable by GitHub Actions cron schedule or locally.
Fetches real Open-Meteo hydrometeorological data (free, no API key),
runs the XGBoost + LSTM ensemble prediction, and pushes high-risk
alerts to the backend with PENDING_REVIEW status for HITL approval.

Usage:
  python predict_engine.py                    # Full pipeline
  python predict_engine.py --district Delhi   # Single district
  python predict_engine.py --dry-run          # No backend writes

Data sources:
  - Open-Meteo Atmospheric API (ECMWF IFS / GFS)
  - Open-Meteo Flood API (GloFAS v4, 5km resolution)
  - OpenWeatherMap (supplementary, optional)
"""

import os
import sys
import argparse
import logging
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(encoding='utf-8')
        sys.stderr.reconfigure(encoding='utf-8')
    except Exception:
        pass

import requests
from dotenv import load_dotenv

load_dotenv()

# Ensure ai-service root is in path (when invoked from project root or GitHub Actions)
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from ingestors.open_meteo_ingestor import OpenMeteoIngestor
from ingestors.imd_ingestor import ImdIngestor, DISTRICT_BASELINES
from models.prediction_engine import PredictionEngine
from models.feature_engineer import FeatureEngineer
from engine.risk_rules import RiskEngine
from grid.delhi_ncr_grid import PRIMARY_STATIONS

# ── Configuration ─────────────────────────────────────────────────────────────
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
RISK_ALERT_THRESHOLD = float(os.getenv("RISK_ALERT_THRESHOLD", "0.50"))
EXTREME_THRESHOLD = float(os.getenv("EXTREME_THRESHOLD", "0.75"))

logging.basicConfig(
    level=logging.INFO,
    format="[%(asctime)s] %(levelname)s %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%S",
)
logger = logging.getLogger("predict_engine")


def _post_to_backend(endpoint: str, payload: Dict[str, Any], label: str = "") -> bool:
    """POST payload to backend REST API. Returns True on success."""
    try:
        res = requests.post(
            f"{BACKEND_API_URL}{endpoint}",
            json=payload,
            timeout=10,
        )
        if res.status_code in [200, 201]:
            return True
        logger.warning(f"Backend rejected {label} ({res.status_code}): {res.text[:200]}")
    except requests.RequestException as exc:
        logger.error(f"Cannot reach backend for {label}: {exc}")
    return False


def _push_telemetry_batch(readings: List[Dict[str, Any]]) -> bool:
    """Pushes a batch of telemetry readings to the backend."""
    if not readings:
        return True
    return _post_to_backend(
        "/hazard-readings/batch",
        {"readings": readings},
        "telemetry batch",
    )


def build_history_from_open_meteo(
    telemetry: Dict[str, Any],
    district: str,
    fe: FeatureEngineer,
    station: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Builds a history sequence from Open-Meteo 7-day daily arrays.
    Used as input to the XGBoost + LSTM ensemble.
    """
    discharge_scale = station.get("discharge_scale", 10.0)
    return fe.open_meteo_telemetry_to_readings(telemetry, discharge_scale=discharge_scale)


def run_pipeline(
    target_district: Optional[str] = None,
    dry_run: bool = False,
    simulate_surge: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Executes the full AI disaster prediction pipeline.

    Steps:
      1. Fetch Open-Meteo atmospheric + GloFAS flood forecasts (free, no key)
      2. Build feature sequences from 7-day forecast arrays
      3. Run XGBoost + LSTM ensemble prediction (6h horizon)
      4. Compute composite risk score per district
      5. Push telemetry batch to backend
      6. Push high-risk (score ≥ 0.50) alerts as PENDING_REVIEW to backend

    Args:
        target_district: If set, runs only for this district
        dry_run        : If True, skips backend writes (testing mode)
        simulate_surge : If set, injects extreme flood conditions for this district
    Returns:
        Summary dict with per-district predictions and alert counts
    """
    logger.info("=" * 60)
    logger.info("  AI Disaster Prediction Pipeline Starting")
    logger.info(f"  Time: {datetime.now(timezone.utc).isoformat()}")
    logger.info(f"  Threshold: HIGH ≥ {RISK_ALERT_THRESHOLD}, EXTREME ≥ {EXTREME_THRESHOLD}")
    if dry_run:
        logger.info("  [DRY RUN] Backend writes DISABLED")
    if simulate_surge:
        logger.info(f"  [SIMULATED SURGE] Simulating extreme flood surge for: {simulate_surge}")
    logger.info("=" * 60)

    open_meteo = OpenMeteoIngestor()
    imd_ingestor = ImdIngestor(state="Delhi NCR")
    prediction_engine = PredictionEngine()
    feature_engineer = FeatureEngineer()

    districts_to_scan = (
        {target_district: PRIMARY_STATIONS[target_district]}
        if target_district and target_district in PRIMARY_STATIONS
        else PRIMARY_STATIONS
    )

    telemetry_readings = []  # Flat list for batch backend push
    predictions_summary = []
    alerts_generated = 0
    alerts_pushed = 0

    for district, station in districts_to_scan.items():
        logger.info(f"\n── Processing: {district} ──")

        # ── Step 1: Fetch Open-Meteo free data ────────────────────────────────
        om_telemetry = open_meteo.get_district_telemetry(
            district=district,
            lat=station["lat"],
            lon=station["lng"],
            rain_threshold_mm=station.get("rain_threshold_mm", 64.5),
            discharge_threshold_m3s=station.get("discharge_threshold_m3s", 150.0),
        )

        if simulate_surge and (district.lower() == simulate_surge.lower() or simulate_surge.lower() == "all"):
            om_telemetry["rainfall_mm"] = 165.0  # Extremely Heavy
            om_telemetry["river_discharge_m3s"] = station.get("discharge_threshold_m3s", 150.0) * 1.5
            om_telemetry["discharge_ratio"] = 1.0
            om_telemetry["rain_ratio"] = 1.0
            om_telemetry["flood_risk_index"] = 0.98
            om_telemetry["daily_precip_mm"] = [35.0, 75.0, 165.0, 140.0, 80.0, 45.0, 20.0]
            om_telemetry["daily_discharge"] = [om_telemetry["river_discharge_m3s"] * f for f in [0.4, 0.7, 1.2, 1.5, 1.1, 0.8, 0.5]]
            om_telemetry["imd_warning"] = "Extremely Heavy Rainfall — Red Alert"
            logger.info(f"  [SIMULATED SURGE] Applied critical flood parameters to {district}")

        logger.info(
            f"  Open-Meteo: rain={om_telemetry['rainfall_mm']}mm "
            f"temp={om_telemetry['temperature_c']}°C "
            f"wind={om_telemetry['wind_speed_kmh']}km/h "
            f"discharge={om_telemetry['river_discharge_m3s']}m³/s "
            f"FRI={om_telemetry['flood_risk_index']:.3f}"
        )

        # IMD warning classification
        if om_telemetry.get("imd_warning"):
            logger.info(f"  IMD Warning: {om_telemetry['imd_warning']}")

        # ── Step 2: Supplementary OWM live data (optional, for anomaly scoring) ─
        owm_imd_data = None
        try:
            base = DISTRICT_BASELINES.get(district, {})
            owm_imd_data = imd_ingestor.fetch_district_telemetry(district)
            logger.info(
                f"  OWM Live: temp={owm_imd_data.get('temperature_c', 'N/A')}°C "
                f"rain={owm_imd_data.get('rainfall_mm', 'N/A')}mm"
            )
        except Exception as exc:
            logger.warning(f"  OWM fetch failed (non-critical): {exc}")

        # ── Step 3: Build feature history from Open-Meteo forecast arrays ─────
        history = build_history_from_open_meteo(
            om_telemetry, district, feature_engineer, station
        )

        # Extend with real-time observation or simulated surge reading
        is_surge_target = bool(simulate_surge and (district.lower() == simulate_surge.lower() or simulate_surge.lower() == "all"))
        if is_surge_target:
            history.append({
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "district": district,
                "rainfall_mm": om_telemetry["rainfall_mm"],
                "temperature_c": 28.0,
                "wind_speed_kmh": 65.0,
                "river_level_m": station.get("danger_river_level", 205.0) + 1.2,
            })
        elif owm_imd_data:
            history.append({
                "timestamp": owm_imd_data.get("timestamp", datetime.now(timezone.utc).isoformat()),
                "district": district,
                "rainfall_mm": owm_imd_data.get("rainfall_mm", 0.0),
                "temperature_c": owm_imd_data.get("temperature_c", 32.0),
                "wind_speed_kmh": owm_imd_data.get("wind_speed_kmh", 10.0),
                "river_level_m": station.get("normal_river_level", 200.0),
            })

        # ── Step 4: ML Ensemble Prediction ────────────────────────────────────
        prediction = prediction_engine.predict_district_ensemble(district, history)
        risk_scores = prediction.get("riskScores", {})
        composite_score = risk_scores.get("composite", 0.0)
        severity = prediction.get("predictedSeverity", "Advisory")
        dominant_hazard = prediction.get("dominantHazard", "Unknown")

        logger.info(
            f"  ML Prediction → Composite={composite_score:.3f} "
            f"Severity={severity} Hazard={dominant_hazard}"
        )
        logger.info(
            f"  Risk Breakdown: Flood={risk_scores.get('flood', 0):.2f} "
            f"RiverBreach={risk_scores.get('riverBreach', 0):.2f} "
            f"Storm={risk_scores.get('storm', 0):.2f} "
            f"Heatwave={risk_scores.get('heatwave', 0):.2f}"
        )

        # ── Step 5: Build telemetry batch records ──────────────────────────────
        coords = [station["lng"], station["lat"]]
        ts_now = datetime.now(timezone.utc).isoformat()
        state = station.get("state", "Delhi NCR")

        telemetry_readings.extend([
            {
                "timestamp": ts_now,
                "state": state,
                "district": district,
                "stationId": f"OM_{district.upper().replace(' ', '_')}_FORECAST",
                "stationName": f"{district} Open-Meteo Station",
                "location": {"type": "Point", "coordinates": coords},
                "indicator": "rainfall_mm",
                "value": om_telemetry["rainfall_mm"],
                "unit": "mm",
                "source": "Open-Meteo (ECMWF/GFS)",
                "isAnomaly": om_telemetry["rain_ratio"] >= 0.5,
                "anomalyScore": round(om_telemetry["rain_ratio"], 3),
            },
            {
                "timestamp": ts_now,
                "state": state,
                "district": district,
                "stationId": f"OM_{district.upper().replace(' ', '_')}_FORECAST",
                "stationName": f"{district} Open-Meteo Station",
                "location": {"type": "Point", "coordinates": coords},
                "indicator": "river_discharge_m3s",
                "value": om_telemetry["river_discharge_m3s"],
                "unit": "m³/s",
                "source": "Open-Meteo (GloFAS v4)",
                "isAnomaly": om_telemetry["discharge_ratio"] >= 0.5,
                "anomalyScore": round(om_telemetry["discharge_ratio"], 3),
            },
            {
                "timestamp": ts_now,
                "state": state,
                "district": district,
                "stationId": f"OM_{district.upper().replace(' ', '_')}_FORECAST",
                "stationName": f"{district} Open-Meteo Station",
                "location": {"type": "Point", "coordinates": coords},
                "indicator": "flood_risk_index",
                "value": om_telemetry["flood_risk_index"],
                "unit": "index",
                "source": "Open-Meteo (Computed)",
                "isAnomaly": om_telemetry["flood_risk_index"] >= 0.5,
                "anomalyScore": round(om_telemetry["flood_risk_index"], 3),
            },
        ])

        # ── Step 6: Generate alert for high/extreme risk ───────────────────────
        should_alert = composite_score >= RISK_ALERT_THRESHOLD or om_telemetry["flood_risk_index"] >= 0.5

        pred_entry = {
            "district": district,
            "state": state,
            "composite_score": composite_score,
            "severity": severity,
            "dominant_hazard": dominant_hazard,
            "flood_risk_index": om_telemetry["flood_risk_index"],
            "imd_warning": om_telemetry.get("imd_warning"),
            "should_alert": should_alert,
            "prediction": prediction,
        }
        predictions_summary.append(pred_entry)

        if should_alert:
            alerts_generated += 1

            # Determine CAP urgency based on severity
            urgency_map = {
                "Emergency": "Immediate",
                "Warning": "Expected",
                "Watch": "Future",
                "Advisory": "Past",
            }

            alert_payload = {
                "state": state,
                "district": district,
                "hazardType": dominant_hazard,
                "score": round(composite_score, 4),
                "threshold": RISK_ALERT_THRESHOLD,
                "recommendedSeverity": severity,
                "suggestedCentre": coords,
                "suggestedRadiusKm": 20 if severity in ["Emergency", "Warning"] else 12,
                "isPredictive": True,
                "predictionHorizon": "6h",
                "explanation": (
                    f"[Open-Meteo AI Prediction] {prediction.get('explanation', '')} "
                    f"Flood Risk Index: {om_telemetry['flood_risk_index']:.3f}. "
                    f"Forecast Rainfall: {om_telemetry['rainfall_mm']} mm/24h. "
                    f"GloFAS River Discharge: {om_telemetry['river_discharge_m3s']} m³/s. "
                    + (f"IMD Warning: {om_telemetry['imd_warning']}." if om_telemetry.get("imd_warning") else "")
                ),
                "forecastData": {
                    "precip_24h_mm": om_telemetry["rainfall_mm"],
                    "discharge_m3s": om_telemetry["river_discharge_m3s"],
                    "discharge_p75_m3s": om_telemetry["river_discharge_p75_m3s"],
                    "flood_risk_index": om_telemetry["flood_risk_index"],
                    "rain_ratio": om_telemetry["rain_ratio"],
                    "discharge_ratio": om_telemetry["discharge_ratio"],
                    "temperature_c": om_telemetry["temperature_c"],
                    "wind_speed_kmh": om_telemetry["wind_speed_kmh"],
                    "imd_threshold_mm": om_telemetry["rain_threshold_mm"],
                    "data_source": "Open-Meteo (GloFAS v4 + ECMWF IFS)",
                },
                "anomalyFeatures": prediction.get("predictions", {}),
                "riskScores": risk_scores,
                "capUrgency": urgency_map.get(severity, "Future"),
                "capSeverity": severity,
                "status": "pending_review",
            }

            if not dry_run:
                ok = _post_to_backend("/ai-alerts/ingest", alert_payload, f"alert for {district}")
                if ok:
                    alerts_pushed += 1
                    logger.info(f"  ✅ Alert pushed to backend (PENDING_REVIEW) — {severity} {dominant_hazard}")
                else:
                    logger.warning(f"  ⚠️  Failed to push alert for {district}")
            else:
                logger.info(f"  [DRY RUN] Alert would be pushed: {severity} {dominant_hazard} (score={composite_score:.3f})")
                alerts_pushed += 1

    # ── Step 7: Push telemetry batch ──────────────────────────────────────────
    if telemetry_readings and not dry_run:
        ok = _push_telemetry_batch(telemetry_readings)
        logger.info(
            f"\nTelemetry batch ({len(telemetry_readings)} readings): "
            f"{'✅ OK' if ok else '⚠️ FAILED'}"
        )

    # ── Step 8: Push ML predictions batch ─────────────────────────────────────
    if not dry_run:
        ml_predictions_payload = [p["prediction"] for p in predictions_summary]
        _post_to_backend(
            "/heatmap/predictions/batch",
            {"predictions": ml_predictions_payload},
            "ML predictions batch",
        )

    logger.info("\n" + "=" * 60)
    logger.info(f"  Pipeline Complete")
    logger.info(f"  Districts scanned: {len(districts_to_scan)}")
    logger.info(f"  Alerts generated:  {alerts_generated}")
    logger.info(f"  Alerts pushed:     {alerts_pushed}")
    logger.info("=" * 60 + "\n")

    return {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "districts_scanned": len(districts_to_scan),
        "alerts_generated": alerts_generated,
        "alerts_pushed": alerts_pushed,
        "predictions": predictions_summary,
    }


def main():
    parser = argparse.ArgumentParser(
        description="AI Disaster Early Warning Prediction Pipeline (Open-Meteo + XGBoost + LSTM)"
    )
    parser.add_argument(
        "--district",
        type=str,
        default=None,
        help=f"Run for a single district. Options: {', '.join(PRIMARY_STATIONS.keys())}",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        default=False,
        help="Fetch data and predict, but do NOT write to backend (safe for testing)",
    )
    parser.add_argument(
        "--threshold",
        type=float,
        default=None,
        help="Override risk alert threshold (0.0–1.0). Default from env RISK_ALERT_THRESHOLD.",
    )
    parser.add_argument(
        "--simulate-surge",
        type=str,
        default=None,
        help="Simulate an extreme hydrometeorological surge for a district (or 'all').",
    )
    args = parser.parse_args()

    if args.threshold is not None:
        global RISK_ALERT_THRESHOLD
        RISK_ALERT_THRESHOLD = args.threshold
        logger.info(f"Threshold override: {RISK_ALERT_THRESHOLD}")

    summary = run_pipeline(
        target_district=args.district,
        dry_run=args.dry_run,
        simulate_surge=args.simulate_surge,
    )

    # Print structured summary for GitHub Actions log
    print("\n── PREDICTION RESULTS ──────────────────────────────────────")
    for p in summary.get("predictions", []):
        icon = "🔴" if p["composite_score"] >= EXTREME_THRESHOLD else (
            "🟠" if p["should_alert"] else "🟢"
        )
        print(
            f"  {icon} {p['district']:22s} | "
            f"Score={p['composite_score']:.3f} | "
            f"FRI={p['flood_risk_index']:.3f} | "
            f"{p['severity']:10s} | "
            f"{p['dominant_hazard']}"
        )
    print()


if __name__ == "__main__":
    main()
