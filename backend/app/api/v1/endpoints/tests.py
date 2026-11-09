"""Test sessions and health report endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from sqlalchemy import String
from typing import List, Optional, Dict, Any
from datetime import datetime
import uuid
import json
from app.core.datetime_utils import utc_now, utc_now_iso

from app.db.database import get_db
from app.models import TestSession, Measurement, Alert, AnalysisResult, Device, Cable
from app.schemas import (
    TestStartRequest, TestStopRequest, TestControlRequest, TestSessionResponse,
    TestSessionSummary, MeasurementResponse, AnalysisResultResponse
)
from app.services.simulator import simulator_service
from app.services.test_runner import finalize_test_session
from app.services.settings_service import get_current_settings
from app.api.v1.endpoints.devices import enqueue_device_command
from app.core.logging import logger

router = APIRouter()

@router.get("/tests", response_model=List[TestSessionSummary], summary="List Test Sessions")
def list_tests(
    cable_id: Optional[str] = Query(None, description="Filter by cable ID"),
    mode: Optional[str] = Query(None, description="Filter by mode: demo or hardware"),
    result: Optional[str] = Query(None, description="Filter by result: healthy, warning, critical, insufficient_data"),
    status: Optional[str] = Query(None, description="Filter by status: running, completed, stopped, failed"),
    date: Optional[str] = Query(None, description="Filter by date YYYY-MM-DD"),
    sort_order: Optional[str] = Query("desc", description="Sort order: desc or asc"),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db)
):
    """Retrieve paginated test history with cable details and computed averages."""
    query = db.query(TestSession).join(Cable, TestSession.cable_id == Cable.cable_id, isouter=True)

    if cable_id:
        query = query.filter(TestSession.cable_id == cable_id)
    if mode:
        query = query.filter(TestSession.mode == mode)
    if result:
        query = query.filter(TestSession.final_result == result)
    if status:
        query = query.filter(TestSession.status == status)
    if date:
        query = query.filter(TestSession.started_at.cast(String).like(f"{date}%"))

    if sort_order and sort_order.lower() == "asc":
        query = query.order_by(TestSession.started_at.asc())
    else:
        query = query.order_by(TestSession.started_at.desc())

    sessions = query.offset(offset).limit(limit).all()

    summaries = []
    for s in sessions:
        valid_m = [m for m in s.measurements if m.measurement_valid]
        v_drops = [m.voltage_drop_v for m in valid_m if m.voltage_drop_v is not None]
        resists = [m.effective_resistance_ohm for m in valid_m if m.effective_resistance_ohm is not None]
        temps = [m.temperature_c for m in valid_m if m.temperature_c is not None]

        health_score = s.analysis_result.health_score if s.analysis_result else None

        summaries.append(TestSessionSummary(
            id=s.id,
            test_id=s.test_id,
            device_id=s.device_id,
            cable_id=s.cable_id,
            cable_name=s.cable.display_name if s.cable else s.cable_id,
            mode=s.mode,
            started_at=s.started_at,
            ended_at=s.ended_at,
            status=s.status,
            final_result=s.final_result,
            health_score=health_score,
            avg_voltage_drop_v=round(sum(v_drops) / len(v_drops), 4) if v_drops else None,
            avg_resistance_ohm=round(sum(resists) / len(resists), 4) if resists else None,
            max_temperature_c=round(max(temps), 1) if temps else None,
            alert_count=len(s.alerts)
        ))

    return summaries

@router.post("/tests/start", response_model=TestSessionResponse, status_code=status.HTTP_201_CREATED, summary="Start Test Session")
async def start_test(payload: TestStartRequest, db: Session = Depends(get_db)):
    """
    Initialize and start a new test session.
    In DEMO mode, deterministic simulated telemetry is automatically started.
    In HARDWARE mode, checks device connectivity before arming.
    """
    # 1. Validate Cable
    cable = db.query(Cable).filter(Cable.cable_id == payload.cable_id).first()
    if not cable:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Cable '{payload.cable_id}' not found. Please register the cable first."
        )

    # 2. Validate Device
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        # Create default device if not present
        device = Device(
            device_id=payload.device_id,
            display_name="ChargeGuard Rig " + payload.device_id[-4:],
            connection_mode=payload.mode,
            online_status=(payload.mode == "demo"),
            last_seen_at=utc_now()
        )
        db.add(device)
        db.commit()
        db.refresh(device)

    # 3. Hardware mode safety check
    if payload.mode == "hardware":
        if not device.online_status:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Cannot start test: Hardware device is OFFLINE. Start the Python serial bridge or verify ESP32 USB connection."
            )

    # Check if there is already a running test on this device
    active = db.query(TestSession).filter(
        TestSession.device_id == payload.device_id,
        TestSession.status == "running"
    ).first()
    if active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"A test session ({active.test_id}) is already running on device '{payload.device_id}'. Stop it first."
        )

    # 4. Create new TestSession
    test_id = f"test-{utc_now().strftime('%Y%m%d%H%M%S')}-{uuid.uuid4().hex[:4]}"
    session = TestSession(
        test_id=test_id,
        device_id=payload.device_id,
        cable_id=payload.cable_id,
        mode=payload.mode,
        profile_voltage_v=payload.profile_voltage_v,
        started_at=utc_now(),
        status="running"
    )
    db.add(session)
    db.commit()
    db.refresh(session)

    # 5. Launch Simulator if Demo mode, or dispatch hardware command to serial bridge
    if payload.mode == "demo":
        scenario = payload.simulated_scenario or "normal"
        simulator_service.start_simulation(
            test_id=test_id,
            device_id=payload.device_id,
            cable_id=payload.cable_id,
            scenario=scenario
        )
    elif payload.mode == "hardware":
        enqueue_device_command(payload.device_id, {
            "command": "START",
            "cable_id": payload.cable_id,
            "test_id": test_id
        })
        from app.services.hardware_bridge import hardware_bridge_service
        if not hardware_bridge_service.is_connected:
            logger.info("Attempting auto-connect to ESP32 on hardware test start...")
            hardware_bridge_service.connect(port="auto", force_unlock=True)
        if hardware_bridge_service.is_connected:
            hardware_bridge_service.start_hardware_test(payload.cable_id, test_id)
        logger.info(f"Queued hardware START command for device '{payload.device_id}', test '{test_id}'")

    return session

@router.post("/tests/{test_id}/stop", response_model=TestSessionResponse, summary="Stop Test Session")
async def stop_test(test_id: str, payload: Optional[TestStopRequest] = None, db: Session = Depends(get_db)):
    """Manually terminate a running test session and compute final diagnostics."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test '{test_id}' not found")

    reason = payload.reason if payload else "User requested stop"

    # Stop simulator if running, or dispatch STOP command to hardware
    if session.mode == "demo":
        simulator_service.stop_simulation(test_id)
    elif session.mode == "hardware":
        enqueue_device_command(session.device_id, {
            "command": "STOP",
            "reason": reason,
            "test_id": session.test_id
        })
        from app.services.hardware_bridge import hardware_bridge_service
        if hardware_bridge_service.is_connected:
            hardware_bridge_service.stop_hardware_test(reason)
        logger.info(f"Queued hardware STOP command for device '{session.device_id}', test '{session.test_id}'")

    updated_session = await finalize_test_session(db, test_id, stop_reason=reason)
    return updated_session

@router.post("/tests/{test_id}/control", summary="Adjust Live Test Physics Parameters")
def control_test(
    test_id: str,
    payload: TestControlRequest,
    db: Session = Depends(get_db)
):
    """Dynamically adjust load current, thermal stress, or cable flex for a running test."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test '{test_id}' not found")
    if session.status != "running":
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Test '{test_id}' is not currently running")

    updated = simulator_service.update_simulation_controls(
        test_id=test_id,
        load_current_a=payload.load_current_a,
        thermal_stress=payload.thermal_stress,
        flex_stress=payload.flex_stress,
        scenario=payload.simulated_scenario
    )
    return {
        "status": "updated" if updated else "noop",
        "test_id": test_id,
        "controls": payload.model_dump(exclude_unset=True)
    }

@router.get("/tests/{test_id}", response_model=TestSessionResponse, summary="Get Test Session")
def get_test(test_id: str, db: Session = Depends(get_db)):
    """Retrieve full test details, alerts, and analysis results."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test '{test_id}' not found")
    return session

@router.get("/tests/{test_id}/measurements", response_model=List[MeasurementResponse], summary="Get Test Measurements")
def get_test_measurements(test_id: str, db: Session = Depends(get_db)):
    """Retrieve the full sequence of telemetry readings recorded during a test."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test '{test_id}' not found")
    return session.measurements

@router.get("/tests/{test_id}/report", summary="Get Cable Health Report")
def get_test_health_report(test_id: str, db: Session = Depends(get_db)):
    """
    Produce a complete, print-ready engineering test report payload
    including metadata, measurement distribution, explainable rules, and safety disclaimer.
    """
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Test '{test_id}' not found")

    cable = session.cable
    measurements = session.measurements
    analysis = session.analysis_result
    alerts = session.alerts

    # Parse explanation JSON
    explanation_data = {}
    if analysis and analysis.explanation:
        try:
            explanation_data = json.loads(analysis.explanation)
        except Exception:
            explanation_data = {"raw": analysis.explanation}

    # Aggregate key stats
    valid_m = [m for m in measurements if m.measurement_valid]
    sink_vs = [m.sink_voltage_v for m in valid_m if m.sink_voltage_v is not None]
    source_vs = [m.source_voltage_v for m in valid_m if m.source_voltage_v is not None]
    currents = [m.current_a for m in valid_m if m.current_a is not None]
    temps = [m.temperature_c for m in valid_m if m.temperature_c is not None]
    v_drops = [m.voltage_drop_v for m in valid_m if m.voltage_drop_v is not None]
    resists = [m.effective_resistance_ohm for m in valid_m if m.effective_resistance_ohm is not None]

    report = {
        "report_id": f"REP-{session.test_id}",
        "generated_at": utc_now_iso(),
        "application": "ChargeGuard AI Pro",
        "version": "1.0.0",
        "test_metadata": {
            "test_id": session.test_id,
            "mode": session.mode,
            "device_id": session.device_id,
            "profile_voltage_v": session.profile_voltage_v,
            "started_at": session.started_at.isoformat() if session.started_at else None,
            "ended_at": session.ended_at.isoformat() if session.ended_at else None,
            "status": session.status,
            "final_result": session.final_result or "insufficient_data",
            "diagnostic_summary": session.diagnostic_summary
        },
        "cable_specifications": {
            "cable_id": cable.cable_id if cable else session.cable_id,
            "display_name": cable.display_name if cable else "Unknown",
            "connector_type": cable.connector_type if cable else "N/A",
            "cable_type": cable.cable_type if cable else "N/A",
            "manufacturer_metadata": cable.manufacturer_metadata if cable else "User Provided",
            "rated_power_w": cable.rated_power_w if cable else None,
            "rated_current_a": cable.rated_current_a if cable else None,
            "rated_voltage_v": getattr(cable, 'rated_voltage_v', None) if cable else None,
            "length_m": getattr(cable, 'length_m', None) if cable else None,
            "serial_number": getattr(cable, 'serial_number', None) if cable else None,
            "purchase_date": getattr(cable, 'purchase_date', None) if cable else None,
            "notes": cable.notes if cable else None
        },
        "health_assessment": {
            "health_score": analysis.health_score if analysis else None,
            "health_category": analysis.health_category if analysis else "Insufficient Data",
            "confidence": analysis.confidence if analysis else None,
            "model_version": analysis.model_version if analysis else "rules-v1.0",
            "explanation": explanation_data
        },
        "metrics_summary": {
            "total_samples": len(measurements),
            "valid_samples": len(valid_m),
            "has_calibrated_source_measurement": len(source_vs) > 0,
            "avg_source_voltage_v": round(sum(source_vs) / len(source_vs), 3) if source_vs else None,
            "avg_sink_voltage_v": round(sum(sink_vs) / len(sink_vs), 3) if sink_vs else None,
            "min_sink_voltage_v": round(min(sink_vs), 3) if sink_vs else None,
            "max_sink_voltage_v": round(max(sink_vs), 3) if sink_vs else None,
            "avg_current_a": round(sum(currents) / len(currents), 3) if currents else None,
            "max_current_a": round(max(currents), 3) if currents else None,
            "avg_voltage_drop_v": round(sum(v_drops) / len(v_drops), 4) if v_drops else None,
            "avg_effective_resistance_ohm": round(sum(resists) / len(resists), 4) if resists else None,
            "max_temperature_c": round(max(temps), 1) if temps else None,
            "min_temperature_c": round(min(temps), 1) if temps else None,
        },
        "alerts_recorded": [
            {
                "id": a.id,
                "severity": a.severity,
                "code": a.code,
                "message": a.message,
                "observed_value": a.observed_value,
                "threshold_value": a.threshold_value,
                "created_at": a.created_at.isoformat()
            }
            for a in alerts
        ],
        "disclaimer": (
            "NOTICE: ChargeGuard AI Pro is an engineering screening and health monitoring prototype "
            "for a verified 5 V test profile. It does NOT certify official USB-IF compliance, "
            "cannot verify USB-C PD 100W/240W E-marker protocols without certified bench instruments, "
            "and cable-surface temperature does not measure internal conductor temperature. "
            "Measurements must be considered screening indicators only."
        )
    }

    return report
