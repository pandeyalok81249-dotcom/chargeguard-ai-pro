@echo off
title ChargeGuard AI Pro - ESP32 Hardware Serial Bridge
cd /d "%~dp0"
echo ========================================================
echo   ChargeGuard AI Pro - ESP32 Serial Hardware Bridge
echo ========================================================
echo.

if exist "backend\.venv\Scripts\python.exe" (
    set "PY_CMD=backend\.venv\Scripts\python.exe"
) else (
    set "PY_CMD=python"
)

echo [1] Checking connected Windows COM ports:
%PY_CMD% device_bridge/serial_bridge.py --list-ports
echo.

set /p COMPORT="Enter COM port (e.g. COM3) or press Enter to auto-scan: "
if "%COMPORT%"=="" (
    echo Auto-detecting ESP32 on available COM ports...
    %PY_CMD% device_bridge/serial_bridge.py --baud 115200
) else (
    echo Connecting to %COMPORT% at 115200 baud...
    %PY_CMD% device_bridge/serial_bridge.py --port %COMPORT% --baud 115200
)

pause
