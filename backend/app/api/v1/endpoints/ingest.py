"""Sensor measurement ingestion endpoint."""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from datetime import datetime

from app.db.database import get_db
from app.schemas import MeasurementIngestContract, MeasurementResponse
from app.services.test_runner import process_incoming_measurement

router = APIRouter()

@router.post("/ingest/measurement", response_model=MeasurementResponse, status_code=status.HTTP_201_CREATED, summary="Ingest Sensor Reading")
async def ingest_sensor_measurement(payload: MeasurementIngestContract, db: Session = Depends(get_db)):
    """
    Ingest a single sensor frame from the ESP32 serial bridge or test client.
    Enforces Versioned JSON Schema 1.
    Calculates derived metrics (power, voltage drop, resistance) according to data completeness.
    Evaluates real-time threshold rules and broadcasts to WebSocket clients.
    """
    try:
        measurement = await process_incoming_measurement(db, payload)
        return measurement
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Failed to process sensor measurement: {str(e)}"
        )
