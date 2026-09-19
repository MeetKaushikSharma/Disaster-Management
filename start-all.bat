@echo off
title 🇮🇳 India Disaster Management Platform
echo ===================================================================
echo   STARTING INDIA DISASTER MANAGEMENT & AI EARLY WARNING SYSTEM
echo ===================================================================

echo [1/3] Starting Express Backend API on Port 5000...
start "Disaster Backend API (:5000)" cmd /k "cd backend && npm run dev"

timeout /t 2 /nobreak >nul

echo [2/3] Starting AI Anomaly Detection Microservice on Port 8000...
start "AI Anomaly Microservice (:8000)" cmd /k "cd ai-service && python main.py"

timeout /t 2 /nobreak >nul

echo [3/3] Starting React 19 Admin Web Portal on Port 5173...
start "Admin Web Console (:5173)" cmd /k "cd admin-web && npm run dev"

echo.
echo ===================================================================
echo All 3 core services launched in their own dedicated windows!
echo - Express Backend:   http://localhost:5000
echo - AI Microservice:   http://localhost:8000
echo - Admin Operations:  http://localhost:5173
echo - OASIS CAP Feed:    http://localhost:5000/api/feeds/cap.xml
echo ===================================================================
echo.
echo To run the Citizen Mobile App, launch in a separate terminal:
echo cd disaster_app ^&^& flutter run
echo.
pause
