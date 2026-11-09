"""API v1 Router aggregation."""

from fastapi import APIRouter
from app.api.v1.endpoints import (
    health,
    dashboard,
    devices,
    cables,
    tests,
    alerts,
    settings,
    export,
    ingest
)

api_router = APIRouter()

api_router.include_router(health.router, tags=["Health"])
api_router.include_router(dashboard.router, tags=["Dashboard"])
api_router.include_router(devices.router, tags=["Devices"])
api_router.include_router(cables.router, tags=["Cables"])
api_router.include_router(tests.router, tags=["Tests"])
api_router.include_router(alerts.router, tags=["Alerts"])
api_router.include_router(settings.router, tags=["Settings"])
api_router.include_router(export.router, tags=["Export"])
api_router.include_router(ingest.router, tags=["Ingestion"])
