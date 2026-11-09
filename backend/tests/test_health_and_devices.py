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
