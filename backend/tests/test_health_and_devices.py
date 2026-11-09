"""Tests for health, dashboard summary, and device endpoints."""

def test_health_check(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["app"] == "ChargeGuard AI Pro"
    assert "timestamp" in data

def test_root_endpoint(client):
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "online"
    assert data["docs_url"] == "/docs"

def test_dashboard_summary(client):
    response = client.get("/api/dashboard/summary")
    assert response.status_code == 200
    data = response.json()
    assert "total_cables" in data
    assert data["total_cables"] >= 4
    assert "total_tests" in data
    assert data["total_tests"] >= 4
    assert "healthy_count" in data
    assert "connection_mode" in data

def test_device_crud(client):
    # 1. List devices
    res = client.get("/api/devices")
    assert res.status_code == 200
    devices = res.json()
    assert len(devices) >= 2

    # 2. Register new device
    new_dev = {
        "device_id": "esp32-bench-02",
        "display_name": "Lab Bench 2 Rig",
        "connection_mode": "hardware",
        "firmware_version": "1.0.0"
    }
    res = client.post("/api/devices", json=new_dev)
    assert res.status_code == 201
    created = res.json()
    assert created["device_id"] == "esp32-bench-02"

    # 3. Duplicate device rejected
    res = client.post("/api/devices", json=new_dev)
    assert res.status_code == 409

    # 4. Get device
    res = client.get("/api/devices/esp32-bench-02")
    assert res.status_code == 200
    assert res.json()["display_name"] == "Lab Bench 2 Rig"

    # 5. Update device
    res = client.put("/api/devices/esp32-bench-02", json={"display_name": "Updated Rig", "online_status": True})
    assert res.status_code == 200
    assert res.json()["display_name"] == "Updated Rig"
    assert res.json()["online_status"] is True

    # 6. Delete device
    res = client.delete("/api/devices/esp32-bench-02")
    assert res.status_code == 204

def test_list_serial_ports(client):
    res = client.get("/api/devices/ports")
    assert res.status_code == 200
    assert isinstance(res.json(), list)

def test_device_heartbeat_and_commands(client):
    # 1. Heartbeat turns hardware device online
    heartbeat_payload = {
        "device_id": "cg-esp32-001",
        "port": "COM4",
        "status": "online",
        "firmware_version": "cg-fw-1.2.0",
        "sensor_status": {"ina219": "ok", "ds18b20": "ok"}
    }
    res = client.post("/api/devices/heartbeat", json=heartbeat_payload)
    assert res.status_code == 200
    assert res.json()["online_status"] is True

    # 2. Check pending command when queue is empty
    res = client.get("/api/devices/cg-esp32-001/command")
    assert res.status_code == 200
    assert res.json()["command"] is None

    # 3. Now start a hardware test on online device
    start_payload = {
        "device_id": "cg-esp32-001",
        "cable_id": "cable-anker-c2c-01",
        "mode": "hardware",
        "profile_voltage_v": 5.0
    }
    start_res = client.post("/api/tests/start", json=start_payload)
    assert start_res.status_code == 201
    test_id = start_res.json()["test_id"]

    # 4. Bridge fetches the queued START command
    cmd_res = client.get("/api/devices/cg-esp32-001/command")
    assert cmd_res.status_code == 200
    assert cmd_res.json()["command"] == "START"
    assert cmd_res.json()["test_id"] == test_id
    assert cmd_res.json()["cable_id"] == "cable-anker-c2c-01"

    # 5. Stop test queues STOP command
    stop_res = client.post(f"/api/tests/{test_id}/stop", json={"reason": "Test ended"})
    assert stop_res.status_code == 200

    cmd_res = client.get("/api/devices/cg-esp32-001/command")
    assert cmd_res.status_code == 200
    assert cmd_res.json()["command"] == "STOP"

    # 6. Bridge disconnect sends offline heartbeat
    res = client.post("/api/devices/heartbeat", json={
        "device_id": "cg-esp32-001",
        "status": "offline",
        "last_error": "User shutdown"
    })
    assert res.status_code == 200
    assert res.json()["online_status"] is False

def test_serial_bridge_line_parser():
    import sys
    from pathlib import Path
    root_dir = str(Path(__file__).resolve().parent.parent.parent)
    if root_dir not in sys.path:
        sys.path.insert(0, root_dir)
    from device_bridge.serial_bridge import parse_line

    # 1. Valid JSON measurement
    json_line = '{"schema_version": 1, "device_id": "cg-esp32-001", "cable_id": "cable-001", "test_id": "t-1", "sink_voltage_v": 4.95, "current_a": 1.2, "temperature_c": 28.5, "measurement_valid": true}'
    parsed = parse_line(json_line)
    assert parsed is not None
    assert parsed["sink_voltage_v"] == 4.95
    assert parsed["current_a"] == 1.2
    assert parsed["measurement_valid"] is True

    # 2. Handshake IDENTIFY event
    ident_line = '{"event": "IDENTIFY", "device_id": "cg-esp32-001", "firmware_version": "cg-fw-1.2.0"}'
    parsed = parse_line(ident_line)
    assert parsed is not None
    assert parsed["event"] == "IDENTIFY"
    assert parsed["device_id"] == "cg-esp32-001"

    # 3. Malformed line returns None
    assert parse_line("GARBAGE DATA NO COMMAS OR BRACKETS") is None

    # 4. Empty line returns None
    assert parse_line("   \n") is None

