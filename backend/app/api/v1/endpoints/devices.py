"""Device management endpoints."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from typing import List
from datetime import datetime
from app.core.datetime_utils import utc_now

from app.db.database import get_db
from app.models import Device
from app.schemas import DeviceCreate, DeviceUpdate, DeviceResponse

router = APIRouter()

@router.get("/devices", response_model=List[DeviceResponse], summary="List All Devices")
def list_devices(db: Session = Depends(get_db)):
    """Retrieve all registered hardware and simulator devices."""
    return db.query(Device).order_by(Device.created_at.desc()).all()

@router.post("/devices", response_model=DeviceResponse, status_code=status.HTTP_201_CREATED, summary="Register Device")
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    """Register a new ESP32 bridge or simulator device ID."""
    existing = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Device with ID '{payload.device_id}' already registered"
        )
    device = Device(
        device_id=payload.device_id,
        display_name=payload.display_name,
        connection_mode=payload.connection_mode,
        firmware_version=payload.firmware_version,
        online_status=(payload.connection_mode == "demo"),
        last_seen_at=utc_now() if payload.connection_mode == "demo" else None
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return device

@router.get("/devices/{device_id}", response_model=DeviceResponse, summary="Get Device Details")
def get_device(device_id: str, db: Session = Depends(get_db)):
    """Get device specifications and status."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    return device

@router.put("/devices/{device_id}", response_model=DeviceResponse, summary="Update Device")
def update_device(device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db)):
    """Update device metadata, mode, or connection state."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    
    if payload.display_name is not None:
        device.display_name = payload.display_name
    if payload.connection_mode is not None:
        device.connection_mode = payload.connection_mode
    if payload.firmware_version is not None:
        device.firmware_version = payload.firmware_version
    if payload.online_status is not None:
        device.online_status = payload.online_status
        if payload.online_status:
            device.last_seen_at = utc_now()

    db.commit()
    db.refresh(device)
    return device

@router.delete("/devices/{device_id}", status_code=status.HTTP_204_NO_CONTENT, summary="Delete Device")
def delete_device(device_id: str, db: Session = Depends(get_db)):
    """Remove a device registration."""
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"Device '{device_id}' not found")
    db.delete(device)
    db.commit()
    return None
