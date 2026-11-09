"""Cable inventory management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime
from app.core.datetime_utils import utc_now

from app.db.database import get_db
from app.models import Cable, TestSession
from app.schemas import CableCreate, CableUpdate, CableResponse

router = APIRouter()

@router.get("/cables", response_model=List[CableResponse], summary="List Cables")
def list_cables(
    search: Optional[str] = Query(None, description="Search by cable ID, name, or manufacturer"),
    connector_type: Optional[str] = Query(None, description="Filter by connector type"),
    cable_type: Optional[str] = Query(None, description="Filter by jacket material"),
    db: Session = Depends(get_db)
):
    """Retrieve registered cables with search and filter capabilities."""
    query = db.query(Cable)
    
    if search:
        s = f"%{search}%"
        query = query.filter(
            (Cable.cable_id.ilike(s)) |
            (Cable.display_name.ilike(s)) |
            (Cable.manufacturer_metadata.ilike(s))
        )
    if connector_type:
        query = query.filter(Cable.connector_type == connector_type)
    if cable_type:
        query = query.filter(Cable.cable_type == cable_type)

    return query.order_by(Cable.created_at.desc()).all()

@router.post("/cables", response_model=CableResponse, status_code=status.HTTP_201_CREATED, summary="Add Cable")
def create_cable(payload: CableCreate, db: Session = Depends(get_db)):
    """Register a new cable in the test inventory."""
    existing = db.query(Cable).filter(Cable.cable_id == payload.cable_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Cable ID '{payload.cable_id}' already exists in inventory."
        )

    cable = Cable(
        cable_id=payload.cable_id,
        display_name=payload.display_name,
        connector_type=payload.connector_type,
        cable_type=payload.cable_type,
        manufacturer_metadata=payload.manufacturer_metadata,
        rated_power_w=payload.rated_power_w,
        rated_current_a=payload.rated_current_a,
        notes=payload.notes,
        created_at=utc_now(),
        updated_at=utc_now()
    )
    db.add(cable)
    db.commit()
    db.refresh(cable)
    return cable

@router.get("/cables/{cable_id}", response_model=CableResponse, summary="Get Cable Details")
def get_cable(cable_id: str, db: Session = Depends(get_db)):
    """Retrieve full details of a cable by its unique ID."""
    cable = db.query(Cable).filter(Cable.cable_id == cable_id).first()
    if not cable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Cable '{cable_id}' not found")
    return cable

@router.put("/cables/{cable_id}", response_model=CableResponse, summary="Update Cable")
def update_cable(cable_id: str, payload: CableUpdate, db: Session = Depends(get_db)):
    """Update cable specifications and user metadata."""
    cable = db.query(Cable).filter(Cable.cable_id == cable_id).first()
    if not cable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Cable '{cable_id}' not found")

    if payload.display_name is not None:
        cable.display_name = payload.display_name
    if payload.connector_type is not None:
        cable.connector_type = payload.connector_type
    if payload.cable_type is not None:
        cable.cable_type = payload.cable_type
    if payload.manufacturer_metadata is not None:
        cable.manufacturer_metadata = payload.manufacturer_metadata
    if payload.rated_power_w is not None:
        cable.rated_power_w = payload.rated_power_w
    if payload.rated_current_a is not None:
        cable.rated_current_a = payload.rated_current_a
    if payload.notes is not None:
        cable.notes = payload.notes
        
    cable.updated_at = utc_now()
    db.commit()
    db.refresh(cable)
    return cable

@router.delete("/cables/{cable_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Cable")
def delete_cable(cable_id: str, db: Session = Depends(get_db)):
    """Delete a cable and cascade-delete its associated test sessions."""
    cable = db.query(Cable).filter(Cable.cable_id == cable_id).first()
    if not cable:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Cable '{cable_id}' not found")
    db.delete(cable)
    db.commit()
    return None
