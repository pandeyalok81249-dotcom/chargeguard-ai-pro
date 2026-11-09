"""Machine Learning & Predictive Maintenance Endpoints for ChargeGuard AI Pro."""

from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.orm import Session

from app.db.database import get_db
from app.models import TestSession, Measurement
from app.schemas import (
    MLModelMetadataResponse, MLAnomalyDetectionResponse,
    MLFaultClassificationResponse, MLPredictiveMaintenanceResponse,
    MLRetrainRequest, MLRetrainResponse
)
from app.ml.anomaly_detector import anomaly_detector
from app.ml.fault_classifier import fault_classifier
from app.ml.predictive_maintenance import predictive_maintenance_engine
from app.ml.model_manager import MLModelManager

router = APIRouter(prefix="/ml", tags=["Machine Learning"])


@router.get("/models", response_model=List[MLModelMetadataResponse], summary="List ML Models and Metrics")
def list_models(db: Session = Depends(get_db)):
    """List all registered Machine Learning models, active versions, and evaluation metrics."""
    MLModelManager.sync_models_to_db(db)
    return MLModelManager.get_all_models_status(db)


@router.post("/anomaly-detect", response_model=MLAnomalyDetectionResponse, summary="Run Anomaly Detection Inference")
def run_anomaly_detection(test_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Run Isolation Forest anomaly detection on sensor readings.
    If test_id is supplied, analyzes that session's stored measurements.
    """
    if test_id:
        measurements = db.query(Measurement).join(TestSession).filter(
            TestSession.test_id == test_id
        ).order_by(Measurement.timestamp).all()
        if not measurements:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No measurements found for test {test_id}")
    else:
        # Latest test measurements
        latest = db.query(TestSession).order_by(TestSession.started_at.desc()).first()
        measurements = latest.measurements if latest else []

    res = anomaly_detector.predict(measurements)
    return MLAnomalyDetectionResponse(**res)


@router.post("/classify-fault", response_model=MLFaultClassificationResponse, summary="Run Fault Classification Inference")
def run_fault_classification(test_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Classify sensor readings into one of the 7 supervised electrical fault classes:
    NORMAL, UNDERVOLTAGE, OVERVOLTAGE, OVERCURRENT, OVERHEATING, VOLTAGE_INSTABILITY, CONNECTION_PROBLEM.
    """
    if test_id:
        measurements = db.query(Measurement).join(TestSession).filter(
            TestSession.test_id == test_id
        ).order_by(Measurement.timestamp).all()
        if not measurements:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=f"No measurements found for test {test_id}")
    else:
        latest = db.query(TestSession).order_by(TestSession.started_at.desc()).first()
        measurements = latest.measurements if latest else []

    res = fault_classifier.predict(measurements)
    return MLFaultClassificationResponse(**res)


@router.post("/predictive-maintenance", response_model=MLPredictiveMaintenanceResponse, summary="Run Degradation & Maintenance Inference")
def run_predictive_maintenance(cable_id: Optional[str] = Query(None), db: Session = Depends(get_db)):
    """
    Evaluate physical degradation risk (resistance drift, thermal coefficient creep, contact instability)
    and project remaining useful cycles based on current and historical test trends.
    """
    query = db.query(TestSession)
    if cable_id:
        query = query.filter(TestSession.cable_id == cable_id)
    recent_sessions = query.order_by(TestSession.started_at.desc()).limit(5).all()

    measurements = []
    if recent_sessions and recent_sessions[0].measurements:
        measurements = recent_sessions[0].measurements

    res = predictive_maintenance_engine.evaluate_degradation(measurements, recent_sessions)
    return MLPredictiveMaintenanceResponse(**res)


@router.post("/retrain", response_model=MLRetrainResponse, summary="Retrain and Validate ML Pipelines")
def retrain_models(payload: MLRetrainRequest, db: Session = Depends(get_db)):
    """
    Trigger retraining and validation of the Isolation Forest and Random Forest pipelines.
    Updates the database with fresh classification reports, macro F1, and confusion matrices.
    """
    result = MLModelManager.retrain_models(db, model_type=payload.model_type, sample_size=payload.sample_size)
    return MLRetrainResponse(**result)
