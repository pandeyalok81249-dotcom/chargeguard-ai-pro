# ChargeGuard AI Pro — Windows PowerShell Startup Script
# Starts both FastAPI backend and Vite React frontend concurrently

$ErrorActionPreference = "Stop"
$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Resolve-Path "$ScriptDir\.."

Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "         ChargeGuard AI Pro — System Launch Script         " -ForegroundColor Cyan
Write-Host "============================================================" -ForegroundColor Cyan
Write-Host "Project Root: $ProjectRoot" -ForegroundColor Gray

# 1. Check or activate Python virtual environment in backend
$BackendDir = Join-Path $ProjectRoot "backend"
$VenvPython = Join-Path $BackendDir ".venv\Scripts\python.exe"

if (-not (Test-Path $VenvPython)) {
    Write-Host "[1/3] Setting up Python virtual environment..." -ForegroundColor Yellow
    python -m venv "$BackendDir\.venv"
    & "$BackendDir\.venv\Scripts\pip.exe" install --upgrade pip
    & "$BackendDir\.venv\Scripts\pip.exe" install -r "$BackendDir\requirements.txt"
} else {
    Write-Host "[1/3] Python virtual environment detected." -ForegroundColor Green
}

# 2. Initialize database if needed
Write-Host "[2/3] Checking SQLite database and seed data..." -ForegroundColor Yellow
& $VenvPython -m app.db.init_db
& $VenvPython -m app.db.seed_data

# 3. Check frontend node_modules
$FrontendDir = Join-Path $ProjectRoot "frontend"
if (-not (Test-Path "$FrontendDir\node_modules")) {
    Write-Host "[3/3] Installing frontend dependencies..." -ForegroundColor Yellow
    Push-Location $FrontendDir
    npm install
    Pop-Location
} else {
    Write-Host "[3/3] Frontend dependencies detected." -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting ChargeGuard AI Pro services..." -ForegroundColor Cyan
Write-Host "  -> Backend API:     http://localhost:8000" -ForegroundColor Green
Write-Host "  -> API Docs:        http://localhost:8000/docs" -ForegroundColor Green
Write-Host "  -> Frontend Web UI: http://localhost:5173" -ForegroundColor Green
Write-Host ""
Write-Host "Press Ctrl+C in this terminal to stop all services." -ForegroundColor Gray
Write-Host "------------------------------------------------------------" -ForegroundColor DarkGray

# Launch Backend in a background process
$BackendJob = Start-Process -FilePath $VenvPython -ArgumentList "-m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload" -WorkingDirectory $BackendDir -PassThru

# Launch Frontend in foreground
Push-Location $FrontendDir
try {
    npm run dev
} finally {
    Pop-Location
    Write-Host "`nStopping backend process (PID: $($BackendJob.Id))..." -ForegroundColor Yellow
    Stop-Process -Id $BackendJob.Id -Force -ErrorAction SilentlyContinue
    Write-Host "ChargeGuard AI Pro stopped cleanly." -ForegroundColor Green
}
