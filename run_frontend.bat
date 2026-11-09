@echo off
title ChargeGuard AI Pro - Frontend Dashboard
cd /d "%~dp0frontend"
echo [ChargeGuard AI Pro] Starting Vite Frontend on http://localhost:5173...
call npm run dev
pause
