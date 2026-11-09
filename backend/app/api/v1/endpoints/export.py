"""Data export endpoints for CSV downloads."""

from fastapi import APIRouter, Depends, Query, Response, HTTPException, status
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime
from app.core.datetime_utils import utc_now

from app.db.database import get_db
from app.services.export_service import export_tests_to_csv, export_single_test_measurements_csv

router = APIRouter()

@router.get("/export/tests.csv", summary="Export Tests to CSV")
def export_tests_csv(
    cable_id: Optional[str] = Query(None, description="Filter by cable ID"),
    mode: Optional[str] = Query(None, description="Filter by mode: demo or hardware"),
    result: Optional[str] = Query(None, description="Filter by result"),
    db: Session = Depends(get_db)
):
    """
    Download a CSV file containing all actual persisted test records
    with cable metadata and key health metrics.
    """
    csv_data = export_tests_to_csv(db, cable_id=cable_id, mode=mode, result_filter=result)
    filename = f"chargeguard_tests_{utc_now().strftime('%Y%m%d_%H%M%S')}.csv"

    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@router.get("/export/tests/{test_id}/measurements.csv", summary="Export Test Time-series to CSV")
def export_test_measurements_csv(test_id: str, db: Session = Depends(get_db)):
    """
    Download a detailed time-series CSV of raw and derived sensor measurements
    for an individual test session.
    """
    try:
        csv_data = export_single_test_measurements_csv(db, test_id)
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))

    filename = f"chargeguard_{test_id}_measurements.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )
