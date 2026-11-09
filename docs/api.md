# ChargeGuard AI Pro — API Documentation

ChargeGuard AI Pro exposes a REST API and a real-time WebSocket interface for hardware ingestion, live session monitoring, cable inventory, analytics, diagnostics, and test session execution.

- **Base URL**: `http://localhost:8000/api/v1`
- **Interactive OpenAPI Documentation**: `http://localhost:8000/docs`
- **Alternative ReDoc**: `http://localhost:8000/redoc`
- **Real-Time WebSocket Endpoint**: `ws://localhost:8000/ws`

---

## 1. Authentication & Protocols

In this prototype and laboratory release, standard HTTP JSON requests are unauthenticated for local LAN / bench operation, or bound to local loopback `127.0.0.1`. In production deployments, standard Bearer token authentication (OAuth2 / JWT) is configured at the gateway layer.

### Common Response Status Codes

| Code | Meaning | Description |
|---|---|---|
| `200 OK` | Success | The request was processed successfully. |
| `201 Created` | Created | A new resource (e.g. Cable, Device, Test Session) was created. |
| `400 Bad Request` | Validation Error | Missing required fields, out-of-range sensor values, or invalid state. |
| `404 Not Found` | Not Found | Target resource ID does not exist in the database. |
| `422 Unprocessable Entity` | Pydantic Schema Failure | Ingestion contract or schema validation failure. |
| `500 Server Error` | Internal Server Error | Unhandled server exception with structured JSON message. |

---

## 2. Ingestion API (Version 1 Ingestion Contract)

### `POST /api/v1/ingest/telemetry`
High-speed endpoint for ESP32 hardware, python serial bridge, or external test benches.

#### Request Headers
`Content-Type: application/json`

#### Request Body
```json
{
  "device_id": "esp32-bench-01",
  "firmware_version": "1.0.4",
  "session_id": "s-uuid-or-null",
  "source_voltage": 5.08,
  "sink_voltage": 4.88,
  "current": 1.95,
  "temperature": 28.4,
  "load_level": 2.0,
  "status_code": "RUNNING",
  "error_flags": []
}
```

#### Fields Description:
- `device_id` (string, required): Hardware identifier registered or auto-discovered in the system.
- `firmware_version` (string, optional): Firmware build string.
- `session_id` (string, optional): Active test session identifier, or `null` for idle telemetry.
- `source_voltage` (float, required): Input voltage at power supply/source side in Volts DC. Valid range: `0.0 - 6.0`.
- `sink_voltage` (float, optional): Output voltage at cable load side in Volts DC. Valid range: `0.0 - 6.0`. If omitted, drop/resistance calculations are disabled.
- `current` (float, required): Measured test current in Amperes. Valid range: `0.0 - 4.0`.
- `temperature` (float, required): Temperature probe reading at connector neck in °C. Valid range: `-10.0 - 120.0`.
- `load_level` (float, optional): Programmed dummy load setting in Amperes (e.g. 0.0, 1.0, 2.0).
- `status_code` (string, optional): Bench status (`IDLE`, `BASELINE`, `TESTING_1A`, `TESTING_2A`, `COMPLETED`, `EMERGENCY_STOP`).
- `error_flags` (list of strings, optional): Hardware hardware fault flags (e.g., `["OVER_TEMP", "OVER_VOLTAGE"]`).

#### Response: `200 OK`
```json
{
  "status": "accepted",
  "measurement_id": "m-8f7a9e2d-3c4b",
  "timestamp": "2026-10-24T18:15:30.123456Z",
  "voltage_drop": 0.20,
  "resistance_ohms": 0.1026,
  "power_watts": 9.516,
  "safety_status": "NORMAL",
  "active_alerts_count": 0
}
```

---

## 3. Test Sessions API

### `POST /api/v1/tests/start`
Starts a controlled, automated test session with a specified cable, device, and load profile.

#### Request Body
```json
{
  "cable_id": "cbl-anker-5a-01",
  "device_id": "esp32-bench-01",
  "operator_name": "Senior Test Eng. Alex",
  "load_profile": "STANDARD_5V_DUAL_STEP",
  "notes": "Routine batch verification"
}
```

#### Response: `201 Created`
```json
{
  "id": "ts-4a1e9b72-f38c",
  "cable_id": "cbl-anker-5a-01",
  "device_id": "esp32-bench-01",
  "status": "RUNNING",
  "started_at": "2026-10-24T18:20:00Z",
  "load_profile": "STANDARD_5V_DUAL_STEP",
  "operator_name": "Senior Test Eng. Alex"
}
```

### `POST /api/v1/tests/{session_id}/stop`
Manually stops or completes an active test session, executing final rule diagnostics and ML classification.

### `POST /api/v1/tests/{session_id}/emergency-stop`
Triggers an immediate emergency stop, disconnecting the electronic load interlock and raising a critical safety alert.

### `GET /api/v1/tests/{session_id}`
Returns complete test session details, summary statistics (min/max/avg voltage, current, drop, resistance, temperature), all raw measurements, rule evaluation flags, and ML confidence metrics.

### `GET /api/v1/tests`
List test history with optional query parameters:
- `cable_id`: filter by cable
- `device_id`: filter by test bench device
- `status`: filter by status (`RUNNING`, `COMPLETED`, `ABORTED`, `FAILED`)
- `limit`: page size (default 50)
- `offset`: page offset (default 0)

---

## 4. Cable Inventory API

### `GET /api/v1/cables`
List registered cables with their latest health score, health category (`Good`, `Marginal`, `Critical`, `Insufficient Data`), test count, and total aging cycles.

### `POST /api/v1/cables`
Register a new cable specimen.

#### Request Body
```json
{
  "serial_number": "CG-CBL-2026-099",
  "brand": "Anker",
  "model": "PowerLine III Flow",
  "connector_type": "USB-C to USB-C",
  "length_meters": 1.8,
  "rated_current_amps": 5.0,
  "max_resistance_spec_ohms": 0.18,
  "notes": "Lab reference specimen"
}
```

### `GET /api/v1/cables/{cable_id}`
Retrieve cable metadata, lifetime usage stats, baseline resistance, and historical test sessions.

### `GET /api/v1/cables/{cable_id}/health-report`
Generates a comprehensive diagnostic report:
- Overall Health Score (0–100)
- Category: Good, Marginal, Critical, or Insufficient Data
- Aging degradation trend over successive test runs
- Loop resistance stability and contact wear metrics
- Temperature rise per Ampere thermal efficiency
- Actionable engineer recommendations

---

## 5. Devices & Test Benches API

### `GET /api/v1/devices`
List all registered test bench units (e.g., `esp32-bench-01`) with connection status (`ONLINE`, `OFFLINE`, `FAULT`), IP/COM address, calibration timestamp, and active session.

### `POST /api/v1/devices`
Register or update a test bench hardware node.

---

## 6. Alerts & Diagnostics API

### `GET /api/v1/alerts`
Query safety and quality alerts with filters:
- `severity`: `CRITICAL`, `WARNING`, `INFO`
- `resolved`: `true` or `false`
- `session_id`: specific test run
- `limit`: default 50

### `POST /api/v1/alerts/{alert_id}/resolve`
Acknowledge and mark an alert as resolved with operator notes.

### `GET /api/v1/diagnostics/rules`
Returns the active diagnostic rule matrix, including mathematical definitions, trigger conditions, severity levels, and USB-IF engineering reference citations.

---

## 7. Data Export API

### `GET /api/v1/export/session/{session_id}/csv`
Downloads an ISO-compliant, timestamped CSV dataset of all raw high-frequency measurements for the test session:
`timestamp, elapsed_sec, source_voltage, sink_voltage, voltage_drop, current, power, loop_resistance, temperature, load_step`

### `GET /api/v1/export/cables/csv`
Exports the entire cable fleet inventory with cumulative health scores, cycle counts, and pass/fail statistics.

---

## 8. Simulator API (Development & Demo Bench)

### `POST /api/v1/simulator/start`
Starts an asynchronous background hardware emulation routine. Supports pre-configured degradation modes:
- `HEALTHY`: Premium low-resistance cable (0.09 Ω), smooth 5V profile, <32°C.
- `HIGH_RESISTANCE`: Aged cable with corroded contacts, 0.42V drop at 2A (0.21 Ω).
- `INTERMITTENT_FAULT`: Loose solder joint exhibiting resistance and voltage spikes.
- `OVERHEAT_CRITICAL`: Defective wire strand triggering thermal runaway (>50°C safety stop).

### `POST /api/v1/simulator/stop`
Stops the simulator loop and resets virtual bench hardware.

---

## 9. Real-Time WebSocket API

- **Endpoint**: `ws://localhost:8000/ws`
- **Direction**: Bi-directional (receives live broadcast; accepts client command pings).

### Outgoing Broadcast Message Formats

#### Telemetry Frame
```json
{
  "type": "telemetry",
  "data": {
    "session_id": "ts-4a1e9b72-f38c",
    "timestamp": "2026-10-24T18:20:15.543Z",
    "source_voltage": 5.05,
    "sink_voltage": 4.84,
    "voltage_drop": 0.21,
    "current": 1.98,
    "power": 9.58,
    "resistance_ohms": 0.106,
    "temperature": 32.1,
    "load_level": 2.0,
    "status": "RUNNING"
  }
}
```

#### Alert Notification Frame
```json
{
  "type": "alert",
  "data": {
    "id": "alt-3b91",
    "rule_name": "EXCESSIVE_VOLTAGE_DROP",
    "severity": "WARNING",
    "message": "Voltage drop of 0.380V exceeds nominal 0.250V threshold at 2.0A load.",
    "timestamp": "2026-10-24T18:20:18.000Z"
  }
}
```

#### Session State Change Frame
```json
{
  "type": "session_state",
  "data": {
    "session_id": "ts-4a1e9b72-f38c",
    "status": "COMPLETED",
    "final_health_score": 88.5,
    "health_category": "Good"
  }
}
```
