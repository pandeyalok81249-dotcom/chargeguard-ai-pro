"""Maintenance Center & Recommendation API Endpoints for ChargeGuard AI Pro."""

import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import MaintenanceRecord, Cable, TestSession, Alert
from app.schemas import (
    MaintenanceRecordCreate, MaintenanceRecordUpdate, MaintenanceRecordResponse
)
from app.core.datetime_utils import utc_now
from app.core.logging import logger

router = APIRouter(prefix="/maintenance", tags=["Maintenance Center"])


@router.get("", response_model=List[MaintenanceRecordResponse], summary="List Maintenance Records")
def list_maintenance_records(
    cable_id: Optional[str] = Query(None),
    status_filter: Optional[str] = Query(None, alias="status"),
    limit: int = Query(50, ge=1, le=100),
    db: Session = Depends(get_db)
):
    """Retrieve maintenance inspection and service history."""
    query = db.query(MaintenanceRecord)
    if cable_id:
        query = query.filter(MaintenanceRecord.cable_id == cable_id)
    if status_filter:
        query = query.filter(MaintenanceRecord.status == status_filter)

    records = query.order_by(MaintenanceRecord.created_at.desc()).limit(limit).all()
    return records


@router.post("", response_model=MaintenanceRecordResponse, status_code=status.HTTP_201_CREATED, summary="Create Maintenance Record")
def create_maintenance_record(payload: MaintenanceRecordCreate, db: Session = Depends(get_db)):
    """Log a physical inspection, cleaning, or maintenance action."""
    measurements_json = json.dumps(payload.supporting_measurements) if payload.supporting_measurements else None
    record = MaintenanceRecord(
        device_id=payload.device_id,
        cable_id=payload.cable_id,
        issue_detected=payload.issue_detected,
        severity=payload.severity,
        supporting_measurements=measurements_json,
        possible_causes=payload.possible_causes,
        recommended_inspection=payload.recommended_inspection,
        action_taken=payload.action_taken,
        status="pending",
        created_at=utc_now()
    )
    db.add(record)
    db.commit()
    db.refresh(record)
    logger.info(f"Maintenance record logged: {record.issue_detected} for cable {record.cable_id}")
    return record


@router.put("/{record_id}", response_model=MaintenanceRecordResponse, summary="Update Maintenance Record")
def update_maintenance_record(
    record_id: int,
    payload: MaintenanceRecordUpdate,
    db: Session = Depends(get_db)
):
    """Update maintenance issue status, actions taken, or resolve record."""
    record = db.query(MaintenanceRecord).filter(MaintenanceRecord.id == record_id).first()
    if not record:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Maintenance record #{record_id} not found")

    if payload.issue_detected is not None:
        record.issue_detected = payload.issue_detected
    if payload.severity is not None:
        record.severity = payload.severity
    if payload.action_taken is not None:
        record.action_taken = payload.action_taken
    if payload.status is not None:
        record.status = payload.status
        if payload.status == "resolved" and not record.resolved_at:
            record.resolved_at = utc_now()

    db.commit()
    db.refresh(record)
    return record


@router.get("/recommendations", summary="Generate Dynamic Maintenance Recommendations")
def get_recommendations(cable_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Generate actionable maintenance recommendations by analyzing recent test telemetry,
    detected faults, and active alerts across registered cables.
    """
    recommendations = []

    cables_to_check = db.query(Cable).all()
    if cable_id:
        cables_to_check = [c for c in cables_to_check if c.cable_id == cable_id]

    for c in cables_to_check:
        latest_test = db.query(TestSession).filter(
            TestSession.cable_id == c.cable_id
        ).order_by(TestSession.started_at.desc()).first()

        if not latest_test:
            continue

        measurements = latest_test.measurements
        if not measurements:
            continue

        v_drops = [m.voltage_drop_v for m in measurements if m.voltage_drop_v is not None]
        resists = [m.effective_resistance_ohm for m in measurements if m.effective_resistance_ohm is not None]
        temps = [m.temperature_c for m in measurements if m.temperature_c is not None]

        max_t = max(temps) if temps else 25.0
        avg_r = (sum(resists) / len(resists)) if resists else 0.06
        avg_vd = (sum(v_drops) / len(v_drops)) if v_drops else 0.08

        # 1. Thermal Degradation Check
        if max_t >= 48.0:
            recommendations.append({
                "cable_id": c.cable_id,
                "cable_name": c.display_name,
                "category": "Thermal Dissipation Hazard",
                "severity": "critical",
                "detected_issue": f"Surface temperature hit {max_t:.1f}°C under test load.",
                "supporting_evidence": f"Peak surface temperature: {max_t:.1f}°C (Limit: 50.0°C).",
                "possible_causes": "High contact resistance at plug crimp or partially fractured VBUS conductor.",
                "recommended_inspection": "Cease high-power fast charging immediately. Inspect plug neck for discoloration, melting, or flexibility kinks.",
                "suggested_action": "Retire cable or restrict to low-power (<5W) auxiliary use."
            })
        elif max_t >= 42.0:
            recommendations.append({
                "cable_id": c.cable_id,
                "cable_name": c.display_name,
                "category": "Thermal Warning",
                "severity": "warning",
                "detected_issue": f"Elevated surface temperature ({max_t:.1f}°C) observed during load.",
                "supporting_evidence": f"Max temp: {max_t:.1f}°C exceeds nominal 40°C threshold.",
                "possible_causes": "Continuous current draw through thin gauge wire or high ambient enclosure temp.",
                "recommended_inspection": "Check thermal dissipation in an open-air environment and re-screen.",
                "suggested_action": "Avoid charging inside bags or closed compartments."
            })

        # 2. Conductor Resistance Check
        if avg_r > 0.35:
            recommendations.append({
                "cable_id": c.cable_id,
                "cable_name": c.display_name,
                "category": "High Conductor Resistance",
                "severity": "warning",
                "detected_issue": f"Effective resistance ({avg_r:.3f}Ω) exceeds standard 0.25Ω ceiling.",
                "supporting_evidence": f"Calculated resistance: {avg_r:.3f}Ω, average voltage drop: {avg_vd:.3f}V.",
                "possible_causes": "Surface oxidation on CC/VBUS connector pins or broken copper wire strands from repeated flexing.",
                "recommended_inspection": "Inspect plug pins with magnification glass. Clean pins using isopropyl alcohol or electrical contact cleaner spray.",
                "suggested_action": "Perform 4-point Kelvin probe inspection or replace cable."
            })

    return recommendations
