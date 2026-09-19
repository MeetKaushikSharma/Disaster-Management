# ==============================================================================
# 🇮🇳 India Disaster Management Platform — 1-Click Startup Script (PowerShell)
# Launches Backend (:5000), AI Microservice (:8000), and Admin Web (:5173)
# ==============================================================================

Write-Host "===================================================================" -ForegroundColor Cyan
Write-Host "  🇮🇳 STARTING INDIA DISASTER MANAGEMENT & AI EARLY WARNING SYSTEM" -ForegroundColor Cyan
Write-Host "===================================================================" -ForegroundColor Cyan

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# 1. Cloud Backend API (Node.js/Express) -> Port 5000
Write-Host "`n[1/3] Launching Express Backend API (Port 5000)..." -ForegroundColor Blue
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\backend'; Write-Host '--- CLOUD BACKEND API (:5000) ---' -ForegroundColor Cyan; npm run dev"

Start-Sleep -Seconds 2

# 2. AI Anomaly Detection Microservice (Python/FastAPI) -> Port 8000
Write-Host "[2/3] Launching FastAPI AI Anomaly Microservice (Port 8000)..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\ai-service'; Write-Host '--- AI ANOMALY MICROSERVICE (:8000) ---' -ForegroundColor Yellow; python main.py"

Start-Sleep -Seconds 2

# 3. SDMA Admin Web Portal (React/Vite) -> Port 5173
Write-Host "[3/3] Launching React 19 Admin Web Portal (Port 5173)..." -ForegroundColor Green
Start-Process powershell -ArgumentList "-NoExit", "-Command", "cd '$rootDir\admin-web'; Write-Host '--- ADMIN WEB PORTAL (:5173) ---' -ForegroundColor Green; npm run dev"

Write-Host "`nAll 3 core services launched in their own dedicated windows!" -ForegroundColor Green
Write-Host "-------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "• Express Backend:   http://localhost:5000" -ForegroundColor Gray
Write-Host "• AI Microservice:   http://localhost:8000" -ForegroundColor Gray
Write-Host "• Admin Operations:  http://localhost:5173" -ForegroundColor Gray
Write-Host "• CAP XML Feed:      http://localhost:5000/api/feeds/cap.xml" -ForegroundColor Gray
Write-Host "• CAP Browser Alert: http://localhost:5173/browser-alerts.html" -ForegroundColor Gray
Write-Host "-------------------------------------------------------------------" -ForegroundColor Gray
Write-Host "`nTo run the Citizen Flutter Mobile App on an emulator or USB device:" -ForegroundColor Magenta
Write-Host "  cd disaster_app; flutter run`n" -ForegroundColor White
