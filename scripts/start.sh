#!/usr/bin/env bash
# ChargeGuard AI Pro — Linux / macOS / POSIX Startup Script
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"

echo -e "\033[36m============================================================\033[0m"
echo -e "\033[36m         ChargeGuard AI Pro — System Launch Script         \033[0m"
echo -e "\033[36m============================================================\033[0m"
echo "Project Root: ${PROJECT_ROOT}"

BACKEND_DIR="${PROJECT_ROOT}/backend"
FRONTEND_DIR="${PROJECT_ROOT}/frontend"
VENV_PYTHON="${BACKEND_DIR}/.venv/bin/python"

# 1. Setup virtual environment if missing
if [ ! -f "${VENV_PYTHON}" ]; then
    echo -e "\033[33m[1/3] Setting up Python virtual environment...\033[0m"
    python3 -m venv "${BACKEND_DIR}/.venv"
    "${BACKEND_DIR}/.venv/bin/pip" install --upgrade pip
    "${BACKEND_DIR}/.venv/bin/pip" install -r "${BACKEND_DIR}/requirements.txt"
else
    echo -e "\033[32m[1/3] Python virtual environment detected.\033[0m"
fi

# 2. Initialize database
echo -e "\033[33m[2/3] Checking SQLite database and seed data...\033[0m"
cd "${BACKEND_DIR}"
"${VENV_PYTHON}" -m app.db.init_db
"${VENV_PYTHON}" -m app.db.seed_data

# 3. Check frontend dependencies
echo -e "\033[33m[3/3] Checking frontend dependencies...\033[0m"
cd "${FRONTEND_DIR}"
if [ ! -d "node_modules" ]; then
    npm install
fi

echo ""
echo -e "\033[36mStarting ChargeGuard AI Pro services...\033[0m"
echo -e "  -> \033[32mBackend API:     http://localhost:8000\033[0m"
echo -e "  -> \033[32mAPI Docs:        http://localhost:8000/docs\033[0m"
echo -e "  -> \033[32mFrontend Web UI: http://localhost:5173\033[0m"
echo ""

cleanup() {
    echo -e "\n\033[33mStopping services...\033[0m"
    if [ -n "${BACKEND_PID}" ]; then
        kill "${BACKEND_PID}" 2>/dev/null || true
    fi
    echo -e "\033[32mChargeGuard AI Pro stopped.\033[0m"
}
trap cleanup EXIT INT TERM

# Start Backend
cd "${BACKEND_DIR}"
"${VENV_PYTHON}" -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload &
BACKEND_PID=$!

# Start Frontend
cd "${FRONTEND_DIR}"
npm run dev
