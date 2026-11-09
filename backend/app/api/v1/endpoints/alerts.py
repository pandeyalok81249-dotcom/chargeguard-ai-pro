"""Alerts and diagnostic notifications endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.datetime_utils import utc_now

from app.db.database import get_db
from app.models import Alert
from app.schemas import AlertResponse, AlertAcknowledgeRequest

router = APIRouter()

@router.get("/alerts", response_model=List[AlertResponse], summary="List Alerts")
def list_alerts(
    severity: Optional[str] = Query(None, description="Filter by severity: info, warning, critical"),
    unacknowledged_only: bool = Query(False, description="Filter only unacknowledged alerts"),
    test_id: Optional[str] = Query(None, description="Filter by test session ID"),
    limit: int = Query(50, ge=1, le=200),
    db: Session = Depends(get_db)
):
    """Retrieve security and safety alerts logged during testing."""
    query = db.query(Alert)

    if severity:
        query = query.filter(Alert.severity == severity)
    if unacknowledged_only:
        query = query.filter(Alert.acknowledged_at == None)
    if test_id:
        from app.models import TestSession
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
    db.commit()
    db.refresh(alert)
    return alert
