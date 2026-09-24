"""
AI Early Warning & Anomaly Detection Microservice â€” Delhi NCR Edition

FastAPI application that automates ingestion from OpenWeatherMap-backed IMD/CWC
streams for Delhi-NCR districts (Noida, Gautam Buddha Nagar, Ghaziabad, Faridabad,
Gurugram, Delhi), evaluates multivariate anomalies across flood, heatwave, and
storm hazard categories, and proposes actionable alerts to the Cloud Backend.
"""

import os
import asyncio
from datetime import datetime, timezone
from typing import Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, BackgroundTasks, Query
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
import requests
from dotenv import load_dotenv

load_dotenv()

from ingestors.imd_ingestor import ImdIngestor, DISTRICT_BASELINES
from ingestors.cwc_ingestor import CwcIngestor, RIVER_STATIONS
from models.anomaly_detector import AnomalyDetector
from engine.risk_rules import RiskEngine

# â”€â”€ Configuration â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
SCAN_INTERVAL_SECONDS = int(os.getenv("SCAN_INTERVAL_SECONDS", "300"))
ANOMALY_THRESHOLD = float(os.getenv("ANOMALY_THRESHOLD", "0.55"))

# Heatwave thresholds for Delhi-NCR (IMD standard: â‰¥40Â°C or â‰¥4.5Â°C above normal)
HEATWAVE_TEMP_C = float(os.getenv("HEATWAVE_TEMP_C", "40.0"))
HEATWAVE_DEVIATION_C = float(os.getenv("HEATWAVE_DEVIATION_C", "4.5"))

# In-memory status tracking
last_scan_info = {
    "timestamp": None,
    "districts_scanned": 0,
    "anomalies_detected": 0,
    "alerts_pushed": 0,
    "last_error": None,
}

imd_ingestor = ImdIngestor(state="Delhi NCR")
cwc_ingestor = CwcIngestor(state="Delhi NCR")
anomaly_detector = AnomalyDetector(anomaly_threshold=ANOMALY_THRESHOLD)
risk_engine = RiskEngine()


def _push_to_backend(endpoint: str, payload: dict, label: str = "") -> bool:
    """Helper: POST to backend API; returns True on success."""
    try:
        res = requests.post(f"{BACKEND_API_URL}{endpoint}", json=payload, timeout=8)
        if res.status_code in [200, 201]:
            return True
        print(f"[AI Service] Backend rejected {label} ({res.status_code}): {res.text[:200]}")
    except Exception as exc:
        print(f"[AI Service] Could not reach backend for {label}: {exc}")
    return False


async def run_scheduled_scan(surge_district: Optional[str] = None):
    """
    Executes a full detection cycle over all Delhi-NCR districts.

    For each district:
      1. Fetches live IMD (weather) + CWC (river gauge) data from OpenWeatherMap
      2. Runs multivariate anomaly scoring (flood + heatwave + storm)
      3. Applies rule-based risk engine to determine if alert proposals are warranted
      4. Pushes telemetry batch & alert proposals to backend MongoDB via REST API
    """
    global last_scan_info
    print(f"\n[AI Service] -- Starting scan at {datetime.now(timezone.utc).isoformat()} --")

    anomalies_found = 0
    alerts_pushed = 0
    readings_to_ingest = []

    for district, base in DISTRICT_BASELINES.items():
        is_surge = (district == surge_district) if surge_district else False

        # â”€â”€ Step 1: Fetch live OWM data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        imd_data = imd_ingestor.fetch_district_telemetry(district, simulate_surge=is_surge)
        cwc_info = RIVER_STATIONS.get(district, {
            "river": "Local River",
            "station": f"{district} Gauge",
            "warning_level": 50.0,
            "danger_level": 51.0,
            "normal_level": 48.0,
        })
        cwc_data = cwc_ingestor.fetch_gauge_reading(district, simulate_surge=is_surge)
        cwc_data["normal_level_m"] = cwc_info["normal_level"]

        temp_c = imd_data.get("temperature_c", 0.0)
        rain_mm = imd_data.get("rainfall_mm", 0.0)
        wind_kmh = imd_data.get("wind_speed_kmh", 0.0)
        humidity = imd_data.get("humidity_pct", 50)

        # â”€â”€ Step 2: Build telemetry batch for backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        readings_to_ingest.extend([
            {
                "timestamp": imd_data["timestamp"],
                "state": imd_data["state"],
                "district": district,
                "stationId": imd_data["stationId"],
                "stationName": f"{district} IMD Weather Station",
                "location": {"type": "Point", "coordinates": imd_data["coordinates"]},
                "indicator": "rainfall_mm",
                "value": rain_mm,
                "unit": "mm",
                "source": "IMD+OWM",
                "isAnomaly": rain_mm > 50 or is_surge,
                "anomalyScore": 0.85 if is_surge else round(min(1.0, rain_mm / 80.0), 2),
            },
            {
                "timestamp": imd_data["timestamp"],
                "state": imd_data["state"],
                "district": district,
                "stationId": imd_data["stationId"],
                "stationName": f"{district} IMD Weather Station",
                "location": {"type": "Point", "coordinates": imd_data["coordinates"]},
                "indicator": "temperature_c",
                "value": temp_c,
                "unit": "°C",
                "source": "IMD+OWM",
                "isAnomaly": temp_c >= HEATWAVE_TEMP_C,
                "anomalyScore": round(min(1.0, max(0.0, (temp_c - 35.0) / 10.0)), 2),
            },
            {
                "timestamp": imd_data["timestamp"],
                "state": imd_data["state"],
                "district": district,
                "stationId": imd_data["stationId"],
                "stationName": f"{district} IMD Weather Station",
                "location": {"type": "Point", "coordinates": imd_data["coordinates"]},
                "indicator": "wind_speed_kmh",
                "value": wind_kmh,
                "unit": "km/h",
                "source": "IMD+OWM",
                "isAnomaly": wind_kmh >= 60,
                "anomalyScore": round(min(1.0, max(0.0, (wind_kmh - 30.0) / 60.0)), 2),
            },
            {
                "timestamp": cwc_data["timestamp"],
                "state": cwc_data["state"],
                "district": district,
                "stationId": cwc_data["stationId"],
                "stationName": cwc_data["stationName"],
                "location": {"type": "Point", "coordinates": imd_data["coordinates"]},
                "indicator": "river_level_m",
                "value": cwc_data["water_level_m"],
                "unit": "m",
                "warningLevel": cwc_data["warning_level_m"],
                "dangerLevel": cwc_data["danger_level_m"],
                "source": "CWC+OWM",
                "isAnomaly": cwc_data["is_above_warning"] or is_surge,
                "anomalyScore": 0.90 if cwc_data["is_above_danger"] else (0.70 if cwc_data["is_above_warning"] else 0.10),
            },
        ])

        # â”€â”€ Step 3: Anomaly Detection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        baseline_stats = {
            "rainfall": {"mean": base["normal_rain"], "std": 12.0},
            "river_level": {"mean": cwc_info["normal_level"], "std": 0.8},
            "temperature": {"mean": base["normal_temp"], "std": 3.5},
        }

        score, features, rec_sev, explanation = anomaly_detector.evaluate_telemetry(
            district, imd_data, cwc_data, baseline_stats
        )

        # ── Step 4: Heatwave check (independent of flood score) ─────────────────
        heatwave_triggered = False
        if temp_c >= HEATWAVE_TEMP_C or (temp_c - base["normal_temp"]) >= HEATWAVE_DEVIATION_C:
            heatwave_triggered = True
            hw_score = round(min(1.0, 0.55 + (temp_c - HEATWAVE_TEMP_C) * 0.02), 2) if temp_c >= HEATWAVE_TEMP_C \
                else round(min(1.0, 0.55 + (temp_c - base["normal_temp"] - HEATWAVE_DEVIATION_C) * 0.03), 2)
            hw_sev = "Emergency" if temp_c >= 45.0 else ("Warning" if temp_c >= 42.0 else "Watch")
            hw_explanation = (
                f"IMD Heatwave condition: {district} temperature {temp_c}°C "
                f"(normal: {base['normal_temp']}°C, deviation: +{round(temp_c - base['normal_temp'], 1)}°C). "
                f"High humidity ({humidity}%) amplifies heat stress. "
                f"IMD heatwave criteria met (>= {HEATWAVE_TEMP_C}°C or >= {HEATWAVE_DEVIATION_C}°C above normal)."
            )
            hw_actions = [
                f"Issue IMD Heatwave advisory for {district}",
                "Activate cooling centres and public water kiosks",
                "Alert ASHA workers and community health volunteers",
                "Restrict outdoor labour between 11:00 AM - 4:00 PM",
                "Deploy mobile ORS distribution teams at transit hubs",
            ]
            hw_payload = {
                "state": base.get("state", imd_data.get("state", "Delhi NCR")),
                "district": district,
                "hazardType": "Heatwave",
                "score": hw_score,
                "threshold": ANOMALY_THRESHOLD,
                "recommendedSeverity": hw_sev,
                "suggestedCentre": imd_data["coordinates"],
                "suggestedRadiusKm": 20,
                "anomalyFeatures": [
                    {"indicator": "temperature_c", "currentValue": temp_c, "baselineMean": base["normal_temp"],
                     "deviationScore": round((temp_c - base["normal_temp"]) / 3.5, 2), "unit": "°C"},
                    {"indicator": "humidity_pct", "currentValue": humidity, "baselineMean": 55,
                     "deviationScore": round(max(0, (humidity - 55) / 20), 2), "unit": "%"},
                ],
                "explanation": hw_explanation,
                "suggestedActions": hw_actions,
            }
            if _push_to_backend("/ai-alerts/ingest", hw_payload, f"Heatwave alert for {district}"):
                alerts_pushed += 1
                anomalies_found += 1
                print(f"[AI Service] [OK] Heatwave alert pushed for {district} ({temp_c}°C, {hw_sev})")

        # â”€â”€ Step 5: Storm / High Wind check â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        if wind_kmh >= 60:
            storm_score = round(min(1.0, 0.55 + (wind_kmh - 60) / 80.0), 2)
            storm_sev = "Emergency" if wind_kmh >= 100 else ("Warning" if wind_kmh >= 75 else "Watch")
            storm_explanation = (
                f"High wind speed detected in {district}: {wind_kmh} km/h. "
                f"Storm / squall conditions may disrupt power, transportation, and outdoor activities. "
                f"Combined with {rain_mm}mm rainfall."
            )
            storm_payload = {
                "state": base.get("state", "Delhi NCR"),
                "district": district,
                "hazardType": "Storm",
                "score": storm_score,
                "threshold": ANOMALY_THRESHOLD,
                "recommendedSeverity": storm_sev,
                "suggestedCentre": imd_data["coordinates"],
                "suggestedRadiusKm": 15,
                "anomalyFeatures": [
                    {"indicator": "wind_speed_kmh", "currentValue": wind_kmh, "baselineMean": 20,
                     "deviationScore": round(max(0, (wind_kmh - 20) / 30), 2), "unit": "km/h"},
                ],
                "explanation": storm_explanation,
                "suggestedActions": [
                    f"Issue storm warning advisory for {district}",
                    "Alert NDRF for preventive positioning",
                    "Coordinate with local authorities to secure loose structures",
                ],
            }
            if _push_to_backend("/ai-alerts/ingest", storm_payload, f"Storm alert for {district}"):
                alerts_pushed += 1
                anomalies_found += 1
                print(f"[AI Service] âœ“ Storm alert pushed for {district} ({wind_kmh} km/h, {storm_sev})")

        # â”€â”€ Step 6: Flood / Rule-based Risk Assessment â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
        hazard_type = "FlashFlood" if rain_mm > 80 else "Flood"
        decision = risk_engine.evaluate_risk(
            district, hazard_type, score, rec_sev,
            imd_data.get("official_warning"), cwc_data
        )

        if decision["should_propose"]:
            anomalies_found += 1
            payload = {
                "state": base.get("state", imd_data.get("state", "Delhi NCR")),
                "district": district,
                "hazardType": hazard_type,
                "score": score,
                "threshold": ANOMALY_THRESHOLD,
                "recommendedSeverity": decision["final_severity"],
                "suggestedCentre": imd_data["coordinates"],
                "suggestedRadiusKm": 18 if decision["final_severity"] in ["Warning", "Emergency"] else 12,
                "anomalyFeatures": features,
                "explanation": explanation,
                "suggestedActions": decision["suggested_actions"],
            }
            if _push_to_backend("/ai-alerts/ingest", payload, f"Flood alert for {district}"):
                alerts_pushed += 1
                print(f"[AI Service] âœ“ {hazard_type} alert pushed for {district} ({decision['final_severity']})")

    # â”€â”€ Step 7: Push telemetry batch to backend â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
    if readings_to_ingest:
        ok = _push_to_backend(
            "/hazard-readings/batch",
            {"readings": readings_to_ingest},
            "batch telemetry"
        )
        print(f"[AI Service] Batch telemetry ({len(readings_to_ingest)} readings): {'OK' if ok else 'FAILED'}")

    last_scan_info = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "districts_scanned": len(DISTRICT_BASELINES),
        "anomalies_detected": anomalies_found,
        "alerts_pushed": alerts_pushed,
        "last_error": None,
    }
    print(f"[AI Service] -- Scan complete: {len(DISTRICT_BASELINES)} districts, "
          f"{anomalies_found} anomalies, {alerts_pushed} alerts pushed --\n")


# â”€â”€ Background Worker Loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
async def background_scheduler():
    while True:
        try:
            await run_scheduled_scan()
        except Exception as exc:
            last_scan_info["last_error"] = str(exc)
            print(f"[AI Service] Background worker error: {exc}")
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Run an immediate scan on startup, then schedule repeating scans
    asyncio.create_task(background_scheduler())
    yield


# â”€â”€ FastAPI App â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
app = FastAPI(
    title="India Disaster Management â€” AI Anomaly Detection Service (Delhi NCR)",
    description=(
        "Live OWM-backed IMD/CWC telemetry ingestion for Delhi-NCR districts, "
        "multivariate anomaly detection across flood, heatwave, and storm hazards, "
        "and explainable early-warning alert proposals."
    ),
    version="3.0.0",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {
        "status": "ok",
        "service": "AI Anomaly Detection Microservice v3.0",
        "region": "Delhi NCR",
        "backendUrl": BACKEND_API_URL,
        "anomalyThreshold": ANOMALY_THRESHOLD,
        "heatwaveTrigger": f">= {HEATWAVE_TEMP_C}°C or +{HEATWAVE_DEVIATION_C}°C above normal",
        "lastScan": last_scan_info,
    }


@app.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks, surge_district: Optional[str] = Query(None)):
    """Triggers an immediate anomaly scan across all Delhi-NCR districts."""
    background_tasks.add_task(run_scheduled_scan, surge_district)
    return {
        "success": True,
        "message": f"Scan task dispatched{f' with surge in {surge_district}' if surge_district else ''}.",
    }


class SurgeRequest(BaseModel):
    district: str
    hazardType: Optional[str] = "Flood"


@app.post("/simulate-surge")
async def simulate_surge(req: SurgeRequest):
    """Simulates an extreme hydrological surge for demonstration and training."""
    await run_scheduled_scan(surge_district=req.district)
    return {
        "success": True,
        "message": f"Extreme weather surge simulated and processed for {req.district}.",
        "district": req.district,
    }


@app.get("/telemetry/{district}")
def get_district_analysis(district: str):
    """Returns live telemetry snapshot and full anomaly calculation for a single district."""
    base = DISTRICT_BASELINES.get(district)
    if not base:
        return {"success": False, "message": f"District '{district}' not tracked. Available: {list(DISTRICT_BASELINES.keys())}"}

    imd_data = imd_ingestor.fetch_district_telemetry(district)
    cwc_info = RIVER_STATIONS.get(district, {
        "river": "Local River", "station": f"{district} Gauge",
        "warning_level": 50.0, "danger_level": 51.0, "normal_level": 48.0,
    })
    cwc_data = cwc_ingestor.fetch_gauge_reading(district)
    cwc_data["normal_level_m"] = cwc_info["normal_level"]

    baseline_stats = {
        "rainfall": {"mean": base["normal_rain"], "std": 12.0},
        "river_level": {"mean": cwc_info["normal_level"], "std": 0.8},
        "temperature": {"mean": base["normal_temp"], "std": 3.5},
    }

    score, features, rec_sev, explanation = anomaly_detector.evaluate_telemetry(
        district, imd_data, cwc_data, baseline_stats
    )

    temp_c = imd_data.get("temperature_c", 0.0)
    wind_kmh = imd_data.get("wind_speed_kmh", 0.0)
    heatwave = temp_c >= HEATWAVE_TEMP_C or (temp_c - base["normal_temp"]) >= HEATWAVE_DEVIATION_C

    return {
        "success": True,
        "district": district,
        "state": base.get("state", "Delhi NCR"),
        "anomalyScore": score,
        "recommendedSeverity": rec_sev,
        "explanation": explanation,
        "features": features,
        "heatwaveTriggered": heatwave,
        "currentTemp_c": temp_c,
        "currentWind_kmh": wind_kmh,
        "imdTelemetry": imd_data,
        "cwcTelemetry": cwc_data,
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
