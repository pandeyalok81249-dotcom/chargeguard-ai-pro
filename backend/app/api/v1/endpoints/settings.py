"""System settings and demo data reset endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import Dict, Any

from app.db.database import get_db
from app.schemas import SettingsSchema, SettingsUpdate
from app.services.settings_service import get_current_settings, update_settings

router = APIRouter()

@router.get("/settings", response_model=SettingsSchema, summary="Get Threshold Settings")
def get_settings_endpoint(db: Session = Depends(get_db)):
    """Retrieve active test safety thresholds, profile voltage, and serial defaults."""
    return get_current_settings(db)

@router.put("/settings", response_model=SettingsSchema, summary="Update Threshold Settings")
def update_settings_endpoint(payload: SettingsUpdate, db: Session = Depends(get_db)):
    """Update system thresholds. Never allows hardware protection bypass."""
    updates = payload.dict(exclude_unset=True)
    return update_settings(db, updates)

@router.post("/settings/reset-demo", summary="Reset Demo Data")
def reset_demo_data(db: Session = Depends(get_db)):
    """
    Reset all simulated test records and re-seed clean demonstration cables
    and historical benchmark tests. Does not touch hardware records.
    """
    from app.db.seed_data import seed_database
    seed_database(db, force_reset_demo=True)
    return {
        "status": "success",
        "message": "Demo test history and baseline cables reset successfully."
    }
