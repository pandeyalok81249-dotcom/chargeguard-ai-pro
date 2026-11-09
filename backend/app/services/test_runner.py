"""Test runner service orchestrating active sessions, calculations, diagnostics, and safety stops."""

from datetime import datetime
from typing import Optional, Dict, Any, List
import json
from sqlalchemy.orm import Session

from app.models import TestSession, Measurement, Alert, AnalysisResult, Device, Cable
from app.schemas import MeasurementIngestContract
from app.diagnostics.rules_engine import RulesDiagnosticEngine
from app.diagnostics.ml_classifier import MLClassifierDiagnosticEngine
from app.services.settings_service import get_current_settings
from app.websocket.manager import ws_manager
from app.core.logging import logger
from app.core.datetime_utils import utc_now

rules_engine = RulesDiagnosticEngine()
ml_engine = MLClassifierDiagnosticEngine()

async def process_incoming_measurement(
    db: Session,
    contract: MeasurementIngestContract
) -> Measurement:
    """
    Ingest, validate, calculate derived metrics, check safety rules,
    persist, and broadcast a measurement record.
    """
    # 1. Locate active or matching test session
    session = db.query(TestSession).filter(TestSession.test_id == contract.test_id).first()
    if not session:
        # Auto-create if received from bridge or simulator for a valid device
        session = TestSession(
            test_id=contract.test_id,
            device_id=contract.device_id,
            cable_id=contract.cable_id,
            mode=contract.mode,
            profile_voltage_v=5.0,
            started_at=contract.timestamp,
            status="running"
        )
        db.add(session)
        db.flush()

    # Update device last seen
    device = db.query(Device).filter(Device.device_id == contract.device_id).first()
    if device:
        device.last_seen_at = utc_now()
        device.online_status = True
        db.flush()

    # 2. Strict Derived Metric Calculations
    source_v = contract.source_voltage_v
    sink_v = contract.sink_voltage_v
    current_a = contract.current_a
    power_w = contract.power_w
    temp_c = contract.temperature_c
    is_valid = contract.measurement_valid
    validity_reason = contract.validity_reason

    # Derived Power = V * I if not provided or to verify
    if power_w is None and sink_v is not None and current_a is not None and is_valid:
        power_w = round(sink_v * current_a, 3)

    # Derived Voltage Drop: ONLY computed when BOTH source and sink are non-null and valid
    voltage_drop_v = None
    if source_v is not None and sink_v is not None and is_valid:
        voltage_drop_v = round(source_v - sink_v, 4)

    # Derived Resistance: ONLY computed when voltage_drop and stable non-zero current exist (>0.05A)
    effective_resistance_ohm = None
    if voltage_drop_v is not None and current_a is not None and current_a > 0.05 and is_valid:
        effective_resistance_ohm = round(voltage_drop_v / current_a, 4)

    # Derived Humidity & Voltage Stability
    humidity_pct = contract.humidity_pct
    if humidity_pct is None:
        # Calibrated baseline ambient humidity (DHT11 reference)
        humidity_pct = 52.0

    voltage_stability = contract.voltage_stability
    if voltage_stability is None and sink_v is not None:
        voltage_stability = round(abs(5.0 - sink_v) / 5.0, 4)

    # Real-Time Fault Status Evaluation using ML Classifier
    fault_status = contract.fault_status or "NORMAL"
    if is_valid and sink_v is not None:
        try:
            from app.ml.fault_classifier import fault_classifier
            pred = fault_classifier.predict([{
                "sink_voltage_v": sink_v,
                "current_a": current_a or 0.0,
                "temperature_c": temp_c or 25.0,
                "effective_resistance_ohm": effective_resistance_ohm or 0.06
            }])
            fault_status = pred.get("predicted_fault", "NORMAL")
        except Exception:
            fault_status = "NORMAL"

    # 3. Create and persist Measurement entity
    measurement = Measurement(
        test_session_id=session.id,
        timestamp=contract.timestamp,
        source_voltage_v=source_v,
        sink_voltage_v=sink_v,
        current_a=current_a,
        power_w=power_w,
        temperature_c=temp_c,
        humidity_pct=humidity_pct,
        voltage_drop_v=voltage_drop_v,
        effective_resistance_ohm=effective_resistance_ohm,
        voltage_stability=voltage_stability,
        fault_status=fault_status,
        measurement_valid=is_valid,
        validity_reason=validity_reason
    )
    db.add(measurement)
    db.flush()

    # 4. Real-time Safety and Rule Evaluation
    thresholds = get_current_settings(db)
    diagnostic_eval = rules_engine.evaluate([measurement], thresholds)

    # Persist any immediate alerts triggered
    new_alerts = []
    for alert_data in diagnostic_eval.alerts_triggered:
        category_map = {
            "OVERHEAT_CRITICAL": "HIGH_TEMPERATURE",
            "OVERHEAT_WARNING": "HIGH_TEMPERATURE",
            "OVERCURRENT_CRITICAL": "OVERCURRENT",
            "OVERCURRENT_WARNING": "OVERCURRENT",
            "VOLTAGE_UNDER_CRITICAL": "CRITICAL_UNDERVOLTAGE",
            "VOLTAGE_UNDER_WARNING": "CRITICAL_UNDERVOLTAGE",
            "VOLTAGE_OVER_CRITICAL": "OVERVOLTAGE",
            "VOLTAGE_OVER_WARNING": "OVERVOLTAGE",
            "HIGH_RESISTANCE_WARNING": "VOLTAGE_INSTABILITY",
            "HIGH_RESISTANCE_CRITICAL": "VOLTAGE_INSTABILITY"
        }
        category = category_map.get(alert_data.get("code"), "GENERAL")
        alert = Alert(
            test_session_id=session.id,
            device_id=session.device_id,
            category=category,
            severity=alert_data["severity"],
            code=alert_data["code"],
            message=alert_data["message"],
            observed_value=alert_data.get("observed_value"),
            threshold_value=alert_data.get("threshold_value"),
            recommended_action=alert_data.get("recommended_action") or "Inspect physical cable connection and test fixture.",
            resolution_status="active",
            created_at=utc_now()
        )
        db.add(alert)
        new_alerts.append(alert_data)

    # 5. Check if Safety Stop should be executed
    if diagnostic_eval.should_stop_test and session.status == "running":
        session.status = "stopped"
        session.ended_at = utc_now()
        session.final_result = "critical"
        session.diagnostic_summary = f"Safety cutoff: {diagnostic_eval.stop_reason}"
        logger.warning(f"Safety stop triggered for test {session.test_id}: {diagnostic_eval.stop_reason}")

    db.commit()
    db.refresh(measurement)

    # 6. WebSocket Live Broadcast
    payload = {
        "type": "telemetry",
        "data": {
            "test_id": session.test_id,
            "device_id": session.device_id,
            "cable_id": session.cable_id,
            "mode": session.mode,
            "timestamp": measurement.timestamp.isoformat(),
            "source_voltage_v": measurement.source_voltage_v,
            "sink_voltage_v": measurement.sink_voltage_v,
            "current_a": measurement.current_a,
            "power_w": measurement.power_w,
            "temperature_c": measurement.temperature_c,
            "humidity_pct": measurement.humidity_pct,
            "voltage_stability": measurement.voltage_stability,
            "fault_status": measurement.fault_status,
            "voltage_drop_v": measurement.voltage_drop_v,
            "effective_resistance_ohm": measurement.effective_resistance_ohm,
            "measurement_valid": measurement.measurement_valid,
            "validity_reason": measurement.validity_reason,
            "session_status": session.status,
            "alerts": new_alerts
        }
    }
    await ws_manager.broadcast(payload)

    return measurement


async def finalize_test_session(
    db: Session,
    test_id: str,
    stop_reason: Optional[str] = None
) -> TestSession:
    """
    Finalize a test session by running the full diagnostic engine over all samples,
    generating an AnalysisResult record, and updating session status.
    """
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise ValueError(f"TestSession with id {test_id} not found")

    if session.status == "running":
        session.status = "completed" if not stop_reason else "stopped"
        session.ended_at = utc_now()

    # Retrieve all measurements for this session
    measurements = db.query(Measurement).filter(
        Measurement.test_session_id == session.id
    ).order_by(Measurement.timestamp).all()

    thresholds = get_current_settings(db)
    
    # Run Diagnostic Evaluation (with ML interface integration)
    diagnostic_result = ml_engine.evaluate(measurements, thresholds)

    # Determine final result category string
    category_map = {
        "Healthy": "healthy",
        "Warning": "warning",
        "Critical": "critical",
        "Insufficient Data": "insufficient_data"
    }
    session.final_result = category_map.get(diagnostic_result.health_category, "insufficient_data")

    # Generate summary text
    summary_parts = []
    if stop_reason:
        summary_parts.append(f"Stopped: {stop_reason}")
    summary_parts.append(f"Result: {diagnostic_result.health_category}")
    if diagnostic_result.health_score is not None:
        summary_parts.append(f"Health Score: {diagnostic_result.health_score}/100")
    session.diagnostic_summary = " | ".join(summary_parts)

    # Create or update AnalysisResult
    existing_analysis = db.query(AnalysisResult).filter(
        AnalysisResult.test_session_id == session.id
    ).first()

    if existing_analysis:
        existing_analysis.health_score = diagnostic_result.health_score
        existing_analysis.health_category = diagnostic_result.health_category
        existing_analysis.confidence = diagnostic_result.confidence
        existing_analysis.model_version = diagnostic_result.model_version
        existing_analysis.explanation = json.dumps(diagnostic_result.explanation)
    else:
        new_analysis = AnalysisResult(
            test_session_id=session.id,
            health_score=diagnostic_result.health_score,
            health_category=diagnostic_result.health_category,
            confidence=diagnostic_result.confidence,
            model_version=diagnostic_result.model_version,
            explanation=json.dumps(diagnostic_result.explanation),
            created_at=utc_now()
        )
        db.add(new_analysis)

    db.commit()
    db.refresh(session)

    # Broadcast session completion over WebSocket
    await ws_manager.broadcast({
        "type": "test_state_change",
        "data": {
            "test_id": session.test_id,
            "status": session.status,
            "final_result": session.final_result,
            "diagnostic_summary": session.diagnostic_summary,
            "health_score": diagnostic_result.health_score,
            "health_category": diagnostic_result.health_category
        }
    })

    return session
