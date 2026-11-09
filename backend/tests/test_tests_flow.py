"""Integration tests for test lifecycle, report generation, and CSV export."""

def test_test_lifecycle_and_report(client):
    # 1. Start a simulated test session
    start_payload = {
        "device_id": "cg-sim-01",
        "cable_id": "cable-anker-c2c-01",
        "mode": "demo",
        "profile_voltage_v": 5.0,
        "simulated_scenario": "normal"
    }
    res = client.post("/api/tests/start", json=start_payload)
    assert res.status_code == 201
    test_session = res.json()
    test_id = test_session["test_id"]
    assert test_session["status"] == "running"
    assert test_session["mode"] == "demo"

    # 2. Ingest a couple of sample measurements to simulate data
    for i in range(5):
        client.post("/api/ingest/measurement", json={
            "schema_version": 1,
            "device_id": "cg-sim-01",
            "cable_id": "cable-anker-c2c-01",
            "test_id": test_id,
            "mode": "demo",
            "source_voltage_v": 5.01,
            "sink_voltage_v": 4.88,
            "current_a": 0.95,
            "temperature_c": 28.0 + (i * 0.2),
            "measurement_valid": True
        })

    # 3. Retrieve measurements
    res = client.get(f"/api/tests/{test_id}/measurements")
    assert res.status_code == 200
    measurements = res.json()
    assert len(measurements) >= 5

    # Test dynamic physics tuning control
    ctrl_res = client.post(f"/api/tests/{test_id}/control", json={
        "load_current_a": 2.2,
        "thermal_stress": True
    })
    assert ctrl_res.status_code == 200
    assert ctrl_res.json()["status"] == "updated"

    # 4. Stop test
    res = client.post(f"/api/tests/{test_id}/stop", json={"reason": "User completed verification"})
    assert res.status_code == 200
    stopped = res.json()
    assert stopped["status"] in ("completed", "stopped")
    assert stopped["final_result"] is not None

    # 5. Fetch full health report
    res = client.get(f"/api/tests/{test_id}/report")
    assert res.status_code == 200
    report = res.json()
    assert report["report_id"] == f"REP-{test_id}"
    assert "health_assessment" in report
    assert "cable_specifications" in report
    assert "disclaimer" in report
    assert "screening" in report["disclaimer"].lower()
    assert "prototype" in report["disclaimer"].lower()

    # 6. Export all tests to CSV
    res = client.get("/api/export/tests.csv")
    assert res.status_code == 200
    assert "text/csv" in res.headers["content-type"]
    csv_text = res.text
    assert "test_id,device_id,cable_id" in csv_text
    assert test_id in csv_text

    # 7. Export single test measurements to CSV
    res = client.get(f"/api/export/tests/{test_id}/measurements.csv")
    assert res.status_code == 200
    csv_meas = res.text
    assert "timestamp_utc,source_voltage_v,sink_voltage_v" in csv_meas

def test_hardware_mode_offline_rejected(client):
    """Test that starting a hardware test on an offline device is rejected safely."""
    res = client.post("/api/tests/start", json={
        "device_id": "cg-esp32-001",  # offline hardware rig
        "cable_id": "cable-anker-c2c-01",
        "mode": "hardware",
        "profile_voltage_v": 5.0
    })
    assert res.status_code == 400
    assert "Hardware device is OFFLINE" in res.json()["detail"]
