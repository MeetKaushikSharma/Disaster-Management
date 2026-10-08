# ==============================================================================
# India AI Disaster Early Warning & Management System
# Master 1-Click Startup Script (PowerShell)
#
# Launches all services in dedicated, monitored console windows:
#   1. Backend API (Node.js/Express)               -> http://localhost:5000
#   2. AI Early Warning Microservice (FastAPI)     -> http://localhost:8000
#   3. Admin Web & Windy Heatmap Portal (Vite)     -> http://localhost:5173/heatmap
#   4. Streamlit GIS & River Hydrograph Dashboard   -> http://localhost:8501
#   5. Telegram HITL Approval Bot (Optional/Auto)  -> If TELEGRAM_BOT_TOKEN set
# ==============================================================================

param (
    [switch]$IncludeTelegram,
    [switch]$NoDashboard,
    [switch]$Stop
)

$rootDir = Split-Path -Parent $MyInvocation.MyCommand.Path

# -- Function: Stop running services ------------------------------------------
function Stop-DisasterServices {
    Write-Host "`nStopping any existing Disaster Management processes..." -ForegroundColor Yellow
    $ports = @(5000, 8000, 5173, 8501)
    foreach ($port in $ports) {
        try {
            $connections = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue
            if ($connections) {
                foreach ($conn in $connections) {
                    $procId = $conn.OwningProcess
                    if ($procId -gt 0) {
                        Stop-Process -Id $procId -Force -ErrorAction SilentlyContinue
                        Write-Host "  -> Stopped process on port $port (PID: $procId)" -ForegroundColor DarkGray
                    }
                }
            }
        } catch {}
    }
    Write-Host "All existing service listeners cleared.`n" -ForegroundColor Green
}

if ($Stop) {
    Stop-DisasterServices
    exit 0
}

Clear-Host
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "   INDIA DISASTER MANAGEMENT & AI EARLY WARNING PLATFORM" -ForegroundColor Cyan
Write-Host "                 Unified Zero-Cost System Launcher" -ForegroundColor Cyan
Write-Host "==========================================================================" -ForegroundColor Cyan
Write-Host "Root Directory: $rootDir`n" -ForegroundColor DarkGray

# -- Step 0: Check Prerequisites ----------------------------------------------
Write-Host "[Checking Prerequisites]..." -ForegroundColor Yellow

$nodeOk = Get-Command node -ErrorAction SilentlyContinue
$pythonOk = Get-Command python -ErrorAction SilentlyContinue
$npmOk = Get-Command npm -ErrorAction SilentlyContinue

if (-not $nodeOk) {
    Write-Host "Error: Node.js is not found in PATH. Please install Node.js 18+." -ForegroundColor Red
    exit 1
}
if (-not $pythonOk) {
    Write-Host "Error: Python is not found in PATH. Please install Python 3.10+." -ForegroundColor Red
    exit 1
}
$nodeVer = & node -v
$pyVer = & python --version
$npmVer = & npm -v

Write-Host "  [OK] Node.js ($nodeVer) detected" -ForegroundColor Green
Write-Host "  [OK] Python ($pyVer) detected" -ForegroundColor Green
Write-Host "  [OK] npm ($npmVer) detected" -ForegroundColor Green

# Clear any conflicting previous processes on target ports
Stop-DisasterServices

# -- 1. Cloud Backend API (Node.js/Express) -> Port 5000 ---------------------
Write-Host "[1/4] Launching Cloud Backend API (Port 5000)..." -ForegroundColor Cyan
$backendCmd = "`$host.UI.RawUI.WindowTitle = 'Disaster Backend API (:5000)'; Set-Location '$rootDir\backend'; Write-Host 'CLOUD BACKEND REST API (:5000)' -ForegroundColor Cyan; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $backendCmd
Start-Sleep -Seconds 2

# -- 2. AI Early Warning Microservice (Python/FastAPI) -> Port 8000 ----------
Write-Host "[2/4] Launching AI Prediction Microservice (Port 8000)..." -ForegroundColor Yellow
$aiCmd = "`$host.UI.RawUI.WindowTitle = 'AI Prediction Microservice (:8000)'; Set-Location '$rootDir\ai-service'; Write-Host 'AI EARLY WARNING MICROSERVICE (:8000)' -ForegroundColor Yellow; python main.py"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $aiCmd
Start-Sleep -Seconds 2

# -- 3. Admin Web & Windy Radar Portal (React/Vite) -> Port 5173 -------------
Write-Host "[3/4] Launching Admin Web Portal (Port 5173)..." -ForegroundColor Green
$webCmd = "`$host.UI.RawUI.WindowTitle = 'Admin Web & Windy Radar Portal (:5173)'; Set-Location '$rootDir\admin-web'; Write-Host 'ADMIN WEB & WINDY RADAR HEATMAP (:5173)' -ForegroundColor Green; npm run dev"
Start-Process powershell -ArgumentList "-NoExit", "-Command", $webCmd
Start-Sleep -Seconds 2

# -- 4. Streamlit GIS Dashboard (Python/Streamlit) -> Port 8501 --------------
if (-not $NoDashboard) {
    Write-Host "[4/4] Launching Streamlit GIS Portal (Port 8501)..." -ForegroundColor Magenta
    $dashCmd = "`$host.UI.RawUI.WindowTitle = 'Streamlit GIS Portal (:8501)'; Set-Location '$rootDir\dashboard'; Write-Host 'STREAMLIT GIS & HYDROGRAPH PORTAL (:8501)' -ForegroundColor Magenta; python -m streamlit run app.py --server.port 8501 --server.headless true"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $dashCmd
    Start-Sleep -Seconds 1
}

# -- 5. Optional: Telegram HITL Governance Bot --------------------------------
$aiEnvPath = Join-Path "$rootDir\ai-service" ".env"
$telegramToken = ""
if (Test-Path $aiEnvPath) {
    Get-Content $aiEnvPath | ForEach-Object {
        if ($_ -match "^\s*TELEGRAM_BOT_TOKEN\s*=\s*(.+)$") {
            $telegramToken = $matches[1].Trim()
        }
    }
}

if ($IncludeTelegram -or ($telegramToken -and $telegramToken -ne "your_telegram_bot_token_here")) {
    Write-Host "`n[Bonus] Launching Telegram HITL Governance Bot..." -ForegroundColor Blue
    $botCmd = "`$host.UI.RawUI.WindowTitle = 'Telegram HITL Governance Bot'; Set-Location '$rootDir\ai-service'; Write-Host 'TELEGRAM HITL APPROVAL BOT' -ForegroundColor Blue; python telegram_bot\alert_bot.py"
    Start-Process powershell -ArgumentList "-NoExit", "-Command", $botCmd
}

# -- Final Launch Summary -----------------------------------------------------
Write-Host "`n==========================================================================" -ForegroundColor Green
Write-Host "   ALL CORE DISASTER MANAGEMENT SERVICES ARE NOW RUNNING!" -ForegroundColor Green
Write-Host "==========================================================================" -ForegroundColor Green

Write-Host "`nOperational Endpoints:" -ForegroundColor White
Write-Host "  * Admin Web & Windy Radar:  http://localhost:5173/heatmap" -ForegroundColor Cyan
Write-Host "  * Streamlit GIS Portal:      http://localhost:8501" -ForegroundColor Magenta
Write-Host "  * Cloud Backend API:         http://localhost:5000" -ForegroundColor Blue
Write-Host "  * AI Microservice:           http://localhost:8000" -ForegroundColor Yellow
Write-Host "  * CAP 1.2 XML Feed:          http://localhost:5000/api/feeds/cap.xml" -ForegroundColor Gray
Write-Host "  * Backend Health:            http://localhost:5000/health" -ForegroundColor Gray
Write-Host "  * AI Service Health:         http://localhost:8000/health" -ForegroundColor Gray

Write-Host "`nTo launch the Citizen Mobile App in Flutter:" -ForegroundColor DarkYellow
Write-Host "  cd disaster_app" -ForegroundColor White
Write-Host "  flutter run" -ForegroundColor White

Write-Host "`nTo stop all services at any time, run:" -ForegroundColor DarkYellow
Write-Host "  .\run-system.ps1 -Stop" -ForegroundColor White
Write-Host "==========================================================================`n" -ForegroundColor Green
