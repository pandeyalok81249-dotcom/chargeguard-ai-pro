# ChargeGuard AI Pro — System Architecture

## 1. System Overview
ChargeGuard AI Pro is a full-stack, predictive health monitoring system engineered to test, benchmark, and evaluate USB charging cables and power adapters under controlled fixed 5.0 V DC profiles.

```
+-------------------------------------------------------------------+
|                        ChargeGuard AI Pro                         |
+-------------------------------------------------------------------+
|                                                                   |
|   +--------------------------+       +------------------------+   |
|   |   React + Vite Frontend  |<=====>|   FastAPI REST API     |   |
|   |   (TypeScript, Tailwind) |  HTTP |   & WebSocket (/ws)    |   |
|   +--------------------------+       +------------------------+   |
|                                                  ||               |
|                                       +-----------------------+   |
|                                       |   SQLite / SQLAlchemy |   |
|                                       +-----------------------+   |
|                                                  ^                |
|                    +-----------------------------+                |
|                    |                             |                |
|         +--------------------+        +--------------------+      |
|         |  Demo Simulator    |        |   Serial Bridge    |      |
|         |  (Deterministic)   |        |   (pyserial/JSON)  |      |
|         +--------------------+        +--------------------+      |
|                                                  ^                |
|                                                  | USB Serial     |
|                                       +--------------------+      |
|                                       |   ESP32 Test Rig   |      |
|                                       |  (INA219 + DS18B20)|      |
|                                       +--------------------+      |
+-------------------------------------------------------------------+
```

## 2. Core Architectural Components

### A. Frontend Layer
- **Framework**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS with custom dark technical palette (Dark navy/charcoal `#0B0F19`, `#111827`, `#1E293B` with electric cyan `#06B6D4` and amber/rose indicators).
- **Navigation**: React Router v6 with 8 distinct views:
  1. **Dashboard**: High-level KPIs, live sensor gauges, time-series charts, and recent alerts.
  2. **Live Testing**: Real-time test cockpit with device and cable selectors, scenario selection, start/stop actions, and safety monitoring.
  3. **Cable Inventory**: Comprehensive CRUD for registered cables with metadata distinction between user-provided claims and verified test data.
  4. **Test History**: Paginated, searchable, and filterable test history with CSV export and report viewer.
  5. **Cable Health Report**: Printable engineering report with metric breakdown, explainable diagnostic evaluations, and safety disclaimers.
  6. **AI Diagnostics**: Transparent rule evaluations, real-time anomaly log, and ML classifier status.
  7. **Device Management**: Status, firmware version, and connection state for both physical rigs and simulator.
  8. **Settings**: Configurable voltage, current, and thermal thresholds with demo data reset.

### B. Backend Layer
- **Framework**: FastAPI (Python) with Pydantic v2.
- **Database**: SQLite with SQLAlchemy 2.0 ORM.
- **Streaming**: Native WebSocket manager (`/ws`) broadcasting sub-second telemetry and test state changes.
- **Export Engine**: CSV generator providing downloadable records directly from database rows.

### C. Diagnostic & Health Engine
- **Explainable Rules Engine**:
  - Requires simultaneous source and sink measurements to calculate true cable voltage drop.
  - Derives effective test-path resistance only when current > 0.05 A is verified.
  - Never fabricates or estimates resistance from single-ended measurements.
  - Automatically recommends safety cutoffs when cable surface temperature or current exceeds configured critical limits.
- **Machine Learning Classifier Architecture**:
  - Defines an abstract `BaseDiagnosticEngine` interface.
  - Transparently explains that Remaining Useful Life (RUL) estimation requires multi-hundred-hour accelerated cycling datasets.
  - Operates in rule-based verification mode while collecting feature vectors.

### D. IoT & Hardware Layer
- **Micro-controller**: ESP32 running Arduino C++ firmware.
- **Sensors**:
  - INA219 High-side I2C current and bus voltage sensor.
  - DS18B20 1-Wire digital thermometer clamped to cable connector neck.
- **Serial Bridge**: Python bridge with automatic USB disconnect recovery and validation against the Versioned Ingestion Contract.
