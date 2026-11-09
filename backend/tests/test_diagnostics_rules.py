"""Unit tests for diagnostic rules engine and boundary conditions."""

import pytest
from app.diagnostics.rules_engine import RulesDiagnosticEngine
from app.models import Measurement

class MockMeasurement:
    def __init__(self, sink_v, source_v=5.0, current_a=1.0, temp_c=28.0, valid=True):
        self.sink_voltage_v = sink_v
        self.source_voltage_v = source_v
        self.current_a = current_a
        self.temperature_c = temp_c
        self.voltage_drop_v = (source_v - sink_v) if (source_v and sink_v) else None
        self.effective_resistance_ohm = (self.voltage_drop_v / current_a) if (self.voltage_drop_v and current_a) else None
        self.measurement_valid = valid

@pytest.fixture
def engine():
    return RulesDiagnosticEngine()

@pytest.fixture
def default_thresholds():
    return {
        "voltage_min_warning_v": 4.50,
        "voltage_min_critical_v": 4.20,
        "voltage_max_warning_v": 5.30,
        "voltage_max_critical_v": 5.60,
        "current_max_warning_a": 2.40,
        "current_max_critical_a": 3.00,
        "temperature_warning_c": 42.0,
        "temperature_critical_c": 50.0,
        "resistance_good_max_ohm": 0.25,
        "resistance_warning_max_ohm": 0.60,
        "min_samples_for_health_score": 5
    }

def test_nominal_pass(engine, default_thresholds):
    samples = [MockMeasurement(sink_v=4.90, source_v=5.00, current_a=1.0, temp_c=28.0) for _ in range(6)]
    result = engine.evaluate(samples, default_thresholds)
    assert result.health_category == "Healthy"
    assert result.health_score >= 80.0
    assert result.should_stop_test is False
    assert len(result.alerts_triggered) == 0

def test_overheat_safety_stop(engine, default_thresholds):
    """Test that cable surface temp >= 50°C triggers critical alert and should_stop_test=True."""
    samples = [
        MockMeasurement(sink_v=4.80, temp_c=35.0),
        MockMeasurement(sink_v=4.75, temp_c=44.0),
        MockMeasurement(sink_v=4.65, temp_c=52.5)  # Breaches 50°C critical
    ]
    result = engine.evaluate(samples, default_thresholds)
    assert result.should_stop_test is True
    assert "Critical cable surface temperature" in result.stop_reason
    assert any(a["code"] == "OVERHEAT_CRITICAL" for a in result.alerts_triggered)
    assert result.health_category == "Critical"

def test_severe_voltage_sag(engine, default_thresholds):
    """Test sink voltage below critical limit (<4.20V)."""
    samples = [MockMeasurement(sink_v=4.10) for _ in range(6)]
    result = engine.evaluate(samples, default_thresholds)
    assert any(a["code"] == "VOLTAGE_SEVERE_SAG" for a in result.alerts_triggered)
    assert result.health_category in ("Warning", "Critical")

def test_high_resistance_alert(engine, default_thresholds):
    """Test high loop resistance (>0.60 ohm)."""
    # 5.0V source - 4.25V sink = 0.75V drop / 1.0A = 0.75 ohm
    samples = [MockMeasurement(sink_v=4.25, source_v=5.00, current_a=1.0) for _ in range(6)]
    result = engine.evaluate(samples, default_thresholds)
    assert any(a["code"] == "RESISTANCE_EXCESSIVE" for a in result.alerts_triggered)

def test_insufficient_samples(engine, default_thresholds):
    """Fewer than 5 samples must return 'Insufficient Data' and null health_score."""
    samples = [MockMeasurement(sink_v=4.90) for _ in range(2)]
    result = engine.evaluate(samples, default_thresholds)
    assert result.health_category == "Insufficient Data"
    assert result.health_score is None

def test_intermittent_contact_ripple(engine, default_thresholds):
    """Std dev > 0.15V in sink voltage indicates contact bounce or loose pin."""
    samples = [
        MockMeasurement(sink_v=4.90),
        MockMeasurement(sink_v=4.30),
        MockMeasurement(sink_v=4.85),
        MockMeasurement(sink_v=4.20),
        MockMeasurement(sink_v=4.92)
    ]
    result = engine.evaluate(samples, default_thresholds)
    assert any(a["code"] == "CONTACT_INTERMITTENT_RIPPLE" for a in result.alerts_triggered)
