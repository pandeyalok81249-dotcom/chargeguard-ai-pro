"""Main FastAPI application entrypoint for ChargeGuard AI Pro."""

from contextlib import asynccontextmanager
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.core.config import settings
from app.core.logging import setup_logging, logger
from app.db.init_db import init_db
from app.api.v1.router import api_router
from app.websocket.manager import ws_manager

setup_logging()

@asynccontextmanager
async def lifespan(app: FastAPI):
    """Application startup and shutdown lifecycle handler."""
    logger.info(f"Starting {settings.PROJECT_NAME} v{settings.VERSION}...")
    # Initialize database and seed tables
    init_db()
    logger.info(f"{settings.PROJECT_NAME} started successfully.")
    yield
    logger.info(f"Shutting down {settings.PROJECT_NAME}...")

app = FastAPI(
    title=settings.PROJECT_NAME,
    description=(
        "AI-Assisted Predictive Health Monitoring System for USB Charging Cables and Adapters. "
        "Provides real-time telemetry streaming, explainable diagnostic rule evaluation, "
        "and persistent test reporting."
    ),
    version=settings.VERSION,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc"
)

# CORS Configuration
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all localhost frontend dev ports
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API Router on both /api and /api/v1 for backward and forward compatibility
app.include_router(api_router, prefix="/api")
app.include_router(api_router, prefix="/api/v1")

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    """Real-time WebSocket endpoint for live sensor measurements and test state alerts."""
    await ws_manager.connect(websocket)
    try:
        while True:
            # Keep connection alive; accept any heartbeat or ping messages
            data = await websocket.receive_text()
            if data == "ping":
                await websocket.send_text('{"type": "pong"}')
    except WebSocketDisconnect:
        ws_manager.disconnect(websocket)
    except Exception as e:
        logger.warning(f"WebSocket error: {e}")
        ws_manager.disconnect(websocket)

@app.get("/", summary="Root Endpoint")
def root():
    """ChargeGuard AI Pro API Root."""
    return {
        "app": settings.PROJECT_NAME,
        "version": settings.VERSION,
        "status": "online",
        "docs_url": "/docs",
        "api_v1_prefix": settings.API_V1_PREFIX,
        "websocket_url": "/ws"
    }
