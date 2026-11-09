"""Tests for AI Diagnostic Assistant, Maintenance Recommendations, and Calibration."""

import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_ai_diagnostic_assistant():
    payload = {
        "query": "Why is my voltage dropping under load?",
        "cable_id": "cable-worn-c2c-04"
    }
    res = client.post("/api/assistant/chat", json=payload)
    assert res.status_code == 200
    data = res.json()
    assert "response" in data
    assert "Voltage" in data["response"] or "voltage" in data["response"]
    assert "recommendations" in data
    assert len(data["recommendations"]) > 0

    # History endpoint
    res_hist = client.get("/api/assistant/history")
    assert res_hist.status_code == 200
    history = res_hist.json()
    assert len(history) > 0


def test_maintenance_recommendations_and_records():
    # 1. Fetch dynamic recommendations
    res_rec = client.get("/api/maintenance/recommendations")
    assert res_rec.status_code == 200
    recs = res_rec.json()
    assert isinstance(recs, list)

    # 2. Create a maintenance inspection record
    new_maint = {
        "device_id": "cg-esp32-001",
        "cable_id": "cable-worn-c2c-04",
        "issue_detected": "Connector pin oxidation inspection",
        "severity": "warning",
        "possible_causes": "Frequent insertion cycles in dusty environment",
        "recommended_inspection": "Clean with electrical solvent",
        "action_taken": "Cleaned contacts and performed baseline resistance check"
    }
    res_create = client.post("/api/maintenance", json=new_maint)
    assert res_create.status_code == 201
    created_rec = res_create.json()
    assert created_rec["status"] == "pending"
    rec_id = created_rec["id"]

    # 3. Resolve the record
    res_resolve = client.put(f"/api/maintenance/{rec_id}", json={"status": "resolved"})
    assert res_resolve.status_code == 200
    assert res_resolve.json()["status"] == "resolved"


def test_device_sensor_calibration():
    # 1. Get calibration for default device
    res_conf = client.get("/api/devices/cg-esp32-001/config")
    assert res_conf.status_code == 200
    conf = res_conf.json()
    assert "acs712_sensitivity_mv_per_a" in conf

    # 2. Update calibration
    update_payload = {
        "acs712_sensitivity_mv_per_a": 100.0,
        "temp_offset_c": 0.5
    }
    res_up = client.put("/api/devices/cg-esp32-001/config", json=update_payload)
    assert res_up.status_code == 200
    updated = res_up.json()
    assert updated["acs712_sensitivity_mv_per_a"] == 100.0
    assert updated["temp_offset_c"] == 0.5


def test_pdf_report_export():
    # Fetch an existing test ID
    res_tests = client.get("/api/tests")
    assert res_tests.status_code == 200
    tests = res_tests.json()
    if tests:
        test_id = tests[0]["test_id"]
        res_pdf = client.get(f"/api/export/tests/{test_id}/report.pdf")
        assert res_pdf.status_code == 200
        assert res_pdf.headers["content-type"] == "application/pdf"
        assert len(res_pdf.content) > 1000  # Valid non-empty PDF bytes
