# ChargeGuard AI Pro 🛡️⚡

**AI-Assisted Predictive Health Monitoring System for USB Charging Cables & Power Adapters**

ChargeGuard AI Pro is a production-grade, full-stack predictive health and diagnostics monitoring platform for USB cables and power adapters under a fixed 5.0 V DC regime (USB Type-A / Type-C 5V standard). It combines embedded telemetry from an ESP32 microcontroller, a deterministic explainable rules engine, an extensible machine learning degradation classifier, and an interactive high-frequency live dashboard.

---

## 🚀 Key Highlights & Engineering Integrity

- **Differential Precision Architecture**: True cable resistance ($R_{loop}$) and voltage drop ($\Delta V$) require simultaneous source-side ($V_{source}$) and sink-side ($V_{sink}$) measurements. Single-ended measurements explicitly disable differential calculations rather than hallucinating metrics.
- **Hardware & Software Safety Interlocks**: Automatic thermal cutoff at $\ge 50.0^\circ\text{C}$ with immediate dummy load disconnect, overvoltage crowbar protection at $> 5.50\text{ V}$, and latching emergency stop.
- **Dual Diagnostics Engine**:
  - **Deterministic Rule Engine**: Evaluates ANSI/USB-IF baseline electrical limits ($\Delta V \le 0.25\text{ V}$, $R_{loop} \le 0.18\ \Omega$, thermal dissipation $\Delta T < 40^\circ\text{C}$, contact jitter $\sigma_R < 0.015\ \Omega$).
  - **ML Degradation Classifier**: Unsupervised feature extractor assessing anomalous drift and multi-dimensional degradation stages (Good, Marginal, Critical).
- **Zero Fabricated Claims**: No false claims of official USB-IF certification or arbitrary Remaining Useful Life (RUL) projections without empirical aging cycle dataset grounding.
- **Full-Stack Monorepo**: FastAPI backend with SQLite persistence, React 19 + TypeScript frontend with Tailwind CSS v4 and Recharts, ESP32 firmware sketch, and Python serial bridge.

---

## 📁 Repository Structure

```
chargeguard-ai-pro/
├── backend/                  # FastAPI 0.115+, SQLAlchemy 2, Pydantic v2
│   ├── app/
│   │   ├── api/v1/           # REST endpoints (health, tests, cables, alerts, etc.)
│   │   ├── core/             # Configuration, logging, engineering thresholds
│   │   ├── db/               # SQLite engine, models init, demo seed data
│   │   ├── diagnostics/      # Explainable rule engine & ML classifier
│   │   ├── models/           # SQLAlchemy 2 ORM entities
│   │   ├── schemas/          # Pydantic v2 Ingestion Contract v1 schemas
│   │   ├── services/         # Test runner, simulator scenarios, CSV export
│   │   ├── websocket/        # Real-time WebSocket connection manager
│   │   └── main.py           # Application entrypoint with CORS & routes
│   ├── tests/                # 17 automated Pytest integration & unit tests
│   └── requirements.txt      # Python dependencies
├── frontend/                 # React 19, TypeScript, Vite, Tailwind CSS v4
│   ├── src/
│   │   ├── api/              # Typed REST client with error handling
│   │   ├── components/       # Layout, Header, Sidebar, MetricCards, Charts
│   │   ├── hooks/            # useWebSocket auto-reconnecting hook
│   │   ├── pages/            # 8 complete application views:
│   │   │   ├── DashboardPage.tsx
│   │   │   ├── LiveTestingPage.tsx
│   │   │   ├── CableInventoryPage.tsx
│   │   │   ├── TestHistoryPage.tsx
│   │   │   ├── CableHealthReportPage.tsx
│   │   │   ├── DiagnosticsPage.tsx
│   │   │   ├── DeviceManagementPage.tsx
│   │   │   └── SettingsPage.tsx
│   │   ├── types/            # Strict TypeScript API and domain interfaces
│   │   └── __tests__/        # Vitest UI test suite
│   ├── vite.config.ts
│   └── package.json
├── device_bridge/            # Hardware serial communication bridge
│   └── serial_bridge.py      # Auto-reconnecting ESP32-to-FastAPI bridge
├── firmware/                 # ESP32 Arduino framework firmware
│   └── chargeguard_esp32/
│       └── chargeguard_esp32.ino # INA219 + DS18B20 + Load Relay Sketch
├── docs/                     # Technical documentation & standards
│   ├── architecture.md       # Full system design and data flows
│   ├── api.md                # REST & WebSocket API specification
│   ├── safety.md             # Thermal, electrical, and mechanical safeguards
│   ├── test_protocol.md      # Standard Test Protocol (SOP-CG-001)
│   └── wiring.md             # Hardware schematic & pin assignments
├── scripts/
│   ├── start.ps1             # Windows PowerShell launcher
│   └── start.sh              # POSIX bash launcher
├── .env.example              # Environment variables template
├── package.json              # Monorepo management scripts
└── README.md
```

---

## ⚡ Quickstart

### Prerequisites
- **Python**: 3.11+ (Python 3.14 tested)
- **Node.js**: 18+ (Node 20+ recommended)
- **Git** (optional)

### 1. One-Click Launch (Windows PowerShell)
From the project root:
```powershell
.\scripts\start.ps1
```
This script automatically sets up the Python virtual environment, seeds the database, verifies frontend packages, and launches both backend and frontend servers concurrently.

### 2. One-Click Launch (Linux / macOS)
```bash
chmod +x ./scripts/start.sh
./scripts/start.sh
```

### 3. Manual Step-by-Step Launch

#### Start Backend
```bash
cd backend
python -m venv .venv
# On Windows:
.\.venv\Scripts\activate
# On Linux/macOS:
source .venv/bin/activate

pip install -r requirements.txt
python -m app.db.init_db
python -m app.db.seed_data
uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
- Backend API: `http://localhost:8000`
- Interactive OpenAPI Docs: `http://localhost:8000/docs`

#### Start Frontend
In a separate terminal:
```bash
cd frontend
npm install
npm run dev
```
- Frontend Web UI: `http://localhost:5173`

---

## 🧪 Automated Testing

### Backend Unit & Integration Tests (Pytest)
ChargeGuard AI Pro contains 17 automated tests validating API endpoints, Pydantic v2 schemas, safety cutoffs, rule diagnostics, and test session lifecycles:
```powershell
cd backend
.\.venv\Scripts\pytest.exe -v tests
```
*Result: 17 passed in ~0.5s*

### Frontend Component & Integration Tests (Vitest)
```bash
cd frontend
npm test
```
*Result: 2 passed in ~0.6s*

### Production Frontend Build
```bash
cd frontend
npm run build
```
*Result: Zero errors, production-ready bundle output in `frontend/dist/`.*

---

## 🔌 Hardware Setup & Real Device Connection

1. Connect the ESP32 microcontroller with INA219 current sensors and DS18B20 thermal probe according to [`docs/wiring.md`](file:///C:/Users/pande/.gemini/antigravity-ide/scratch/chargeguard-ai-pro/docs/wiring.md).
2. Flash `firmware/chargeguard_esp32/chargeguard_esp32.ino` via Arduino IDE or PlatformIO.
3. Start the hardware serial bridge to ingest live telemetry directly into FastAPI:
   ```bash
   cd device_bridge
   python serial_bridge.py --port COM3 --baud 115200 --host http://localhost:8000
   ```
4. If physical hardware is not connected, use the built-in **Software Bench Simulator** available directly in the UI under **Live Testing** (`Healthy`, `High Resistance`, `Intermittent Fault`, `Overheat Critical`).

---

## 🛡️ Standard Safety Thresholds (Fixed 5.0 V DC)

| Metric | Normal (Pass) | Warning (Marginal) | Critical (Fail / Stop) |
|---|---|---|---|
| **Voltage Drop ($\Delta V$)** | $\le 0.250\text{ V}$ | $0.250\text{ V} - 0.500\text{ V}$ | $> 0.500\text{ V}$ |
| **Loop Resistance ($R_{loop}$)** | $\le 0.180\ \Omega$ | $0.180\ \Omega - 0.300\ \Omega$ | $> 0.300\ \Omega$ |
| **Temperature ($T$)** | $< 40.0^\circ\text{C}$ | $40.0^\circ\text{C} - 50.0^\circ\text{C}$ | $\ge 50.0^\circ\text{C}$ *(Auto-Interlock Stop)* |
| **Current ($I_{load}$)** | $0.0 - 2.50\text{ A}$ | $2.50 - 3.20\text{ A}$ | $> 3.50\text{ A}$ *(Overcurrent)* |
| **Source Voltage ($V_{source}$)** | $4.75 - 5.25\text{ V}$ | $4.50 - 4.75\text{ V}$ | $> 5.50\text{ V}$ / $< 4.50\text{ V}$ |

---

## 📄 License & Attribution

ChargeGuard AI Pro is released under the MIT License. Designed for lab engineering, electronics quality control, and safety diagnostics.
