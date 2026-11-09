"""Alerts and diagnostic notifications endpoints for ChargeGuard AI Pro."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.core.datetime_utils import utc_now
from app.db.database import get_db
from app.models import Alert, TestSession
from app.schemas import AlertResponse, AlertAcknowledgeRequest, AlertResolveRequest

router = APIRouter()


@router.get("/alerts", response_model=List[AlertResponse], summary="List Alerts")
def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, critical"),
    category: Optional[str] = Query(None, description="Filter by category"),
    resolution_status: Optional[str] = Query(None, description="Filter by status: active, acknowledged, resolved"),
    unacknowledged_only: bool = Query(False, description="Filter only unacknowledged alerts"),
    device_id: Optional[str] = Query(None, description="Filter by device ID"),
    test_id: Optional[str] = Query(None, description="Filter by test session ID"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve security and safety alerts logged during testing with flexible filtering."""
    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity)
    if category:
        query = query.filter(Alert.category == category)
    if resolution_status:
        query = query.filter(Alert.resolution_status == resolution_status)
    if unacknowledged_only:
        query = query.filter(Alert.acknowledged_at == None)
    if device_id:
        query = query.filter(Alert.device_id == device_id)
    if test_id:
        session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
        if session:
            query = query.filter(Alert.test_session_id == session.id)

    return query.order_by(Alert.created_at.desc()).limit(limit).all()


@router.post("/alerts/{alert_id}/acknowledge", response_model=AlertResponse, summary="Acknowledge Alert")
def acknowledge_alert(alert_id: int, payload: AlertAcknowledgeRequest, db: Session = Depends(get_db)):
    """Acknowledge a safety or threshold alert."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    alert.acknowledged_at = utc_now() if payload.acknowledged else None
    if payload.acknowledged and alert.resolution_status == "active":
        alert.resolution_status = "acknowledged"
    db.commit()
    db.refresh(alert)
    return alert


@router.post("/alerts/{alert_id}/resolve", response_model=AlertResponse, summary="Resolve Alert")
def resolve_alert(alert_id: int, payload: Optional[AlertResolveRequest] = None, db: Session = Depends(get_db)):
    """Mark an alert as resolved with optional resolution notes."""
    alert = db.query(Alert).filter(Alert.id == alert_id).first()
    if not alert:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Alert {alert_id} not found")

    alert.resolution_status = "resolved"
    alert.resolved_at = utc_now()
    if not alert.acknowledged_at:
        alert.acknowledged_at = utc_now()
    if payload and payload.resolution_notes:
        alert.message = f"{alert.message} | Resolution: {payload.resolution_notes}"

    db.commit()
    db.refresh(alert)
    return alert
