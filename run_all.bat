@echo off
title ChargeGuard AI Pro - Launcher
cd /d "%~dp0"
echo ========================================================
echo   Launching ChargeGuard AI Pro (Backend & Frontend)
echo ========================================================
echo.
echo Starting FastAPI Backend in new window (http://127.0.0.1:8000)...
start "ChargeGuard AI Pro - Backend" cmd /c "%~dp0run_backend.bat"

timeout /t 2 /nobreak >nul

echo Starting React Frontend in new window (http://localhost:5173)...
start "ChargeGuard AI Pro - Frontend" cmd /c "%~dp0run_frontend.bat"

echo.
echo All services launched!
echo - Web Dashboard: http://localhost:5173
echo - API Docs:     http://127.0.0.1:8000/docs
echo.
echo To connect your physical ESP32 hardware, run:
echo   run_serial_bridge.bat
echo.
pause
