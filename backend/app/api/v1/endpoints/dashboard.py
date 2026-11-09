"""Dashboard summary aggregated telemetry endpoint."""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import Optional

from app.db.database import get_db
from app.models import Cable, TestSession, Alert, Device, Measurement, AnalysisResult
from app.schemas import DashboardSummaryResponse, TestSessionSummary, AlertResponse
from app.services.settings_service import get_current_settings

router = APIRouter()

@router.get("/dashboard/summary", response_model=DashboardSummaryResponse, summary="Dashboard KPI Summary")
def get_dashboard_summary(db: Session = Depends(get_db)):
    """Fetch high-level counters, active test status, recent alerts, and device status."""
    total_cables = db.query(Cable).count()
    total_tests = db.query(TestSession).count()
    
    healthy_count = db.query(TestSession).filter(TestSession.final_result == "healthy").count()
    warning_count = db.query(TestSession).filter(TestSession.final_result == "warning").count()
    critical_count = db.query(TestSession).filter(TestSession.final_result == "critical").count()
    insufficient_count = db.query(TestSession).filter(TestSession.final_result == "insufficient_data").count()

    # Active running test if any
    active_test_row = db.query(TestSession).filter(TestSession.status == "running").order_by(TestSession.started_at.desc()).first()
    active_test = None
    if active_test_row:
        active_test = TestSessionSummary(
            id=active_test_row.id,
            test_id=active_test_row.test_id,
            device_id=active_test_row.device_id,
            cable_id=active_test_row.cable_id,
            cable_name=active_test_row.cable.display_name if active_test_row.cable else active_test_row.cable_id,
            mode=active_test_row.mode,
            started_at=active_test_row.started_at,
            ended_at=active_test_row.ended_at,
            status=active_test_row.status,
            final_result=active_test_row.final_result
        )

    # Latest completed test
    latest_completed_row = db.query(TestSession).filter(
        TestSession.status.in_(["completed", "stopped"])
    ).order_by(TestSession.ended_at.desc(), TestSession.started_at.desc()).first()

    latest_completed = None
    if latest_completed_row:
        health_score = latest_completed_row.analysis_result.health_score if latest_completed_row.analysis_result else None
        
        # Calculate averages for summary
        valid_m = [m for m in latest_completed_row.measurements if m.measurement_valid]
        v_drops = [m.voltage_drop_v for m in valid_m if m.voltage_drop_v is not None]
        resists = [m.effective_resistance_ohm for m in valid_m if m.effective_resistance_ohm is not None]
        temps = [m.temperature_c for m in valid_m if m.temperature_c is not None]

        latest_completed = TestSessionSummary(
            id=latest_completed_row.id,
            test_id=latest_completed_row.test_id,
            device_id=latest_completed_row.device_id,
            cable_id=latest_completed_row.cable_id,
            cable_name=latest_completed_row.cable.display_name if latest_completed_row.cable else latest_completed_row.cable_id,
            mode=latest_completed_row.mode,
            started_at=latest_completed_row.started_at,
            ended_at=latest_completed_row.ended_at,
            status=latest_completed_row.status,
            final_result=latest_completed_row.final_result,
            health_score=health_score,
            avg_voltage_drop_v=round(sum(v_drops) / len(v_drops), 4) if v_drops else None,
            avg_resistance_ohm=round(sum(resists) / len(resists), 4) if resists else None,
            max_temperature_c=round(max(temps), 1) if temps else None,
            alert_count=len(latest_completed_row.alerts)
        )

    # Latest 5 alerts
    alerts_rows = db.query(Alert).order_by(Alert.created_at.desc()).limit(6).all()
    latest_alerts = [AlertResponse.model_validate(a) for a in alerts_rows]

    # Device connection mode & status
    settings_dict = get_current_settings(db)
    current_mode = settings_dict.get("default_connection_mode", "demo")
    
    # Check default device
    device = db.query(Device).filter(Device.connection_mode == current_mode).first()
    if not device:
        device = db.query(Device).first()

    device_id = device.device_id if device else None
    device_online = device.online_status if device else False

    return DashboardSummaryResponse(
        total_cables=total_cables,
        total_tests=total_tests,
        healthy_count=healthy_count,
        warning_count=warning_count,
        critical_count=critical_count,
        insufficient_data_count=insufficient_count,
        active_test=active_test,
        latest_completed_test=latest_completed,
        latest_alerts=latest_alerts,
        connection_mode=current_mode,
        current_device_id=device_id,
        current_device_online=device_online
    )
