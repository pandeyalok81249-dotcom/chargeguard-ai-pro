"""Tests for measurement ingestion contract and calculations."""

import pytest
from datetime import datetime
from app.core.datetime_utils import utc_now_iso

def test_ingest_valid_pair(client):
    """Test ingestion when both source and sink voltages are present."""
    payload = {
        "schema_version": 1,
        "device_id": "cg-sim-01",
        "cable_id": "cable-anker-c2c-01",
        "test_id": "test-ingest-pair-01",
        "timestamp": utc_now_iso(),
        "mode": "demo",
        "source_voltage_v": 5.02,
        "sink_voltage_v": 4.90,
        "current_a": 1.00,
        "temperature_c": 28.5,
        "measurement_valid": True
    }
    res = client.post("/api/ingest/measurement", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["source_voltage_v"] == 5.02
    assert data["sink_voltage_v"] == 4.90
    assert data["current_a"] == 1.00
    # Power = 4.90 * 1.00 = 4.90W
    assert data["power_w"] == 4.90
    # Voltage drop = 5.02 - 4.90 = 0.12V
    assert abs(data["voltage_drop_v"] - 0.12) < 0.001
    # Resistance = 0.12 / 1.00 = 0.12 ohm
    assert abs(data["effective_resistance_ohm"] - 0.12) < 0.001

def test_ingest_single_ended_null_source(client):
    """
    CRITICAL RULE TEST: Single-ended measurement (null source voltage)
    MUST NOT fabricate voltage drop or cable resistance!
    """
    payload = {
        "schema_version": 1,
        "device_id": "cg-sim-01",
        "cable_id": "cable-anker-c2c-01",
        "test_id": "test-ingest-single-02",
        "timestamp": utc_now_iso(),
        "mode": "demo",
        "source_voltage_v": None,  # Explicitly null
        "sink_voltage_v": 4.92,
        "current_a": 0.85,
        "temperature_c": 29.0,
        "measurement_valid": True
    }
    res = client.post("/api/ingest/measurement", json=payload)
    assert res.status_code == 201
    data = res.json()
    assert data["source_voltage_v"] is None
    assert data["sink_voltage_v"] == 4.92
    assert data["voltage_drop_v"] is None
    assert data["effective_resistance_ohm"] is None

def test_reject_impossible_voltage(client):
    """Reject voltage outside credible physical range (>25V or <0V)."""
    payload = {
        "schema_version": 1,
        "device_id": "cg-sim-01",
        "cable_id": "cable-anker-c2c-01",
        "test_id": "test-reject-01",
        "sink_voltage_v": 32.0,  # Invalid
        "current_a": 1.0,
        "measurement_valid": True
    }
    res = client.post("/api/ingest/measurement", json=payload)
    assert res.status_code == 422

def test_reject_impossible_temperature(client):
    """Reject temperature outside sensor operational envelope."""
    payload = {
        "schema_version": 1,
        "device_id": "cg-sim-01",
        "cable_id": "cable-anker-c2c-01",
        "test_id": "test-reject-02",
        "sink_voltage_v": 4.90,
        "temperature_c": 190.0,  # Exceeds max DS18B20 125°C
        "measurement_valid": True
    }
    res = client.post("/api/ingest/measurement", json=payload)
    assert res.status_code == 422
