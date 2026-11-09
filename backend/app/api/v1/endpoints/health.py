"""Health and system status endpoints."""

from fastapi import APIRouter
from app.core.config import settings
from app.core.datetime_utils import utc_now_iso

router = APIRouter()

@router.get("/health", summary="System Health Check")
def health_check():
    """Verify backend API readiness and operational status."""
    return {
        "status": "ok",
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "environment": settings.ENV,
        "timestamp": utc_now_iso()
    }
