@echo off
title ChargeGuard AI Pro - Backend Server
cd /d "%~dp0backend"
echo [ChargeGuard AI Pro] Starting FastAPI Backend on http://127.0.0.1:8000...
if exist ".venv\Scripts\python.exe" (
    ".venv\Scripts\python.exe" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
) else (
    python -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
)
pause
