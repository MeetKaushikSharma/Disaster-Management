"""
AI Early Warning & Anomaly Detection Microservice

FastAPI application that automates ingestion from IMD and CWC streams, evaluates
multivariate time-series anomalies, and proposes actionable alerts to the Cloud Backend.
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

from ingestors.imd_ingestor import ImdIngestor, DISTRICT_BASELINES
from ingestors.cwc_ingestor import CwcIngestor, RIVER_STATIONS
from models.anomaly_detector import AnomalyDetector
from engine.risk_rules import RiskEngine

# ── Configuration ─────────────────────────────────────────────────────────────
BACKEND_API_URL = os.getenv("BACKEND_API_URL", "http://localhost:5000/api")
SCAN_INTERVAL_SECONDS = int(os.getenv("SCAN_INTERVAL_SECONDS", "300"))
ANOMALY_THRESHOLD = float(os.getenv("ANOMALY_THRESHOLD", "0.65"))

# In-memory status tracking
last_scan_info = {
    "timestamp": None,
    "districts_scanned": 0,
    "anomalies_detected": 0,
    "alerts_pushed": 0,
}

imd_ingestor = ImdIngestor()
cwc_ingestor = CwcIngestor()
anomaly_detector = AnomalyDetector(anomaly_threshold=ANOMALY_THRESHOLD)
risk_engine = RiskEngine()

async def run_scheduled_scan(surge_district: Optional[str] = None):
    """Executes a detection cycle over all regional districts."""
    global last_scan_info
    print(f"[AI Service] Starting scan at {datetime.now(timezone.utc).isoformat()}...")

    anomalies_found = 0
    alerts_pushed = 0
    readings_to_ingest = []

    for district, base in DISTRICT_BASELINES.items():
        is_surge = (district == surge_district) if surge_district else (district in ["Varanasi"])

        # 1. Ingest IMD & CWC data
        imd_data = imd_ingestor.fetch_district_telemetry(district, simulate_surge=is_surge)
        cwc_info = RIVER_STATIONS.get(district, {
            "river": "Local River", "station": f"{district} Gauge",
            "warning_level": 50.0, "danger_level": 51.0, "normal_level": 48.0
        })
        cwc_data = cwc_ingestor.fetch_gauge_reading(district, simulate_surge=is_surge)
        cwc_data["normal_level_m"] = cwc_info["normal_level"]

        # Prepare telemetry batch for backend
        readings_to_ingest.extend([
            {
                "timestamp": imd_data["timestamp"],
                "state": imd_data["state"],
                "district": district,
                "stationId": imd_data["stationId"],
                "stationName": f"{district} Weather Station",
                "location": {"type": "Point", "coordinates": imd_data["coordinates"]},
                "indicator": "rainfall_mm",
                "value": imd_data["rainfall_mm"],
                "unit": "mm",
                "source": "IMD",
                "isAnomaly": is_surge,
                "anomalyScore": 0.85 if is_surge else 0.05,
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
                "source": "CWC",
                "isAnomaly": is_surge and cwc_data["is_above_warning"],
                "anomalyScore": 0.90 if is_surge else 0.08,
            },
        ])

        # 2. Anomaly Detection
        baseline_stats = {
            "rainfall": {"mean": base["normal_rain"], "std": 12.0},
            "river_level": {"mean": cwc_info["normal_level"], "std": 0.8},
        }

        score, features, rec_sev, explanation = anomaly_detector.evaluate_telemetry(
            district, imd_data, cwc_data, baseline_stats
        )

        # 3. Rule-based Risk Assessment
        hazard_type = "FlashFlood" if imd_data["rainfall_mm"] > 80 else "Flood"
        decision = risk_engine.evaluate_risk(
            district, hazard_type, score, rec_sev,
            imd_data.get("official_warning"), cwc_data
        )

        if decision["should_propose"]:
            anomalies_found += 1
            payload = {
                "state": "Uttar Pradesh",
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

            try:
                res = requests.post(f"{BACKEND_API_URL}/ai-alerts/ingest", json=payload, timeout=5)
                if res.status_code in [200, 201]:
                    alerts_pushed += 1
                    print(f"[AI Service] Pushed alert for {district} ({decision['final_severity']})")
                else:
                    print(f"[AI Service] Backend rejected alert ({res.status_code}): {res.text}")
            except Exception as e:
                print(f"[AI Service] Could not reach backend to push alert: {e}")

    # Push batch telemetry to backend
    if readings_to_ingest:
        try:
            requests.post(f"{BACKEND_API_URL}/hazard-readings/batch", json={"readings": readings_to_ingest}, timeout=5)
        except Exception as e:
            print(f"[AI Service] Batch telemetry upload error: {e}")

    last_scan_info = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "districts_scanned": len(DISTRICT_BASELINES),
        "anomalies_detected": anomalies_found,
        "alerts_pushed": alerts_pushed,
    }
    print(f"[AI Service] Scan complete. Found {anomalies_found} anomalies, pushed {alerts_pushed} alerts.")

# ── Background Worker Loop ───────────────────────────────────────────────────
async def background_scheduler():
    while True:
        try:
            await run_scheduled_scan()
        except Exception as e:
            print(f"[AI Service] Background worker error: {e}")
        await asyncio.sleep(SCAN_INTERVAL_SECONDS)

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Start background scanner
    task = asyncio.create_task(background_scheduler())
    yield
    task.cancel()

# ── FastAPI App ──────────────────────────────────────────────────────────────
app = FastAPI(
    title="India Disaster Management — AI Anomaly Detection Service",
    description="Automated IMD/CWC telemetry ingestion, multivariate anomaly detection, and explainable early warnings.",
    version="1.0.0",
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
        "service": "AI Anomaly Detection Microservice",
        "backendUrl": BACKEND_API_URL,
        "anomalyThreshold": ANOMALY_THRESHOLD,
        "lastScan": last_scan_info,
    }

@app.post("/scan")
async def trigger_scan(background_tasks: BackgroundTasks, surge_district: Optional[str] = Query(None)):
    """Triggers an immediate anomaly scan across all districts."""
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
    """In-depth simulation of an extreme hydrological surge for demonstrations."""
    await run_scheduled_scan(surge_district=req.district)
    return {
        "success": True,
        "message": f"Extreme weather surge simulated and processed for {req.district}.",
        "district": req.district,
    }

@app.get("/telemetry/{district}")
def get_district_analysis(district: str):
    """Returns live telemetry snapshot and anomaly calculation for a district."""
    base = DISTRICT_BASELINES.get(district)
    if not base:
        return {"success": False, "message": f"District {district} not tracked."}

    imd_data = imd_ingestor.fetch_district_telemetry(district)
    cwc_info = RIVER_STATIONS.get(district, {
        "river": "Local River", "station": f"{district} Gauge",
        "warning_level": 50.0, "danger_level": 51.0, "normal_level": 48.0
    })
    cwc_data = cwc_ingestor.fetch_gauge_reading(district)
    cwc_data["normal_level_m"] = cwc_info["normal_level"]

    baseline_stats = {
        "rainfall": {"mean": base["normal_rain"], "std": 12.0},
        "river_level": {"mean": cwc_info["normal_level"], "std": 0.8},
    }

    score, features, rec_sev, explanation = anomaly_detector.evaluate_telemetry(
        district, imd_data, cwc_data, baseline_stats
    )

    return {
        "success": True,
        "district": district,
        "state": "Uttar Pradesh",
        "anomalyScore": score,
        "recommendedSeverity": rec_sev,
        "explanation": explanation,
        "features": features,
        "imdTelemetry": imd_data,
        "cwcTelemetry": cwc_data,
    }

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
