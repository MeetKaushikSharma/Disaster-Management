@echo off
title India Disaster Early Warning System Launcher
echo ==========================================================================
echo   INDIA DISASTER MANAGEMENT AND AI EARLY WARNING SYSTEM
echo   Launching all services via PowerShell unified orchestrator...
echo ==========================================================================
echo.
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0run-system.ps1" %*
