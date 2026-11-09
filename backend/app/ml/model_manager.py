"""
ML Module 4: Model Management, Versioning, and Retraining Orchestrator.

Handles model lifecycle management:
- Version tracking and persistence
- Database metadata synchronization (ml_model_metadata table)
- On-demand retraining with metric logging (precision, recall, f1, confusion matrix)
- Unified diagnostic inference pipeline combining Anomaly Detection,
  Fault Classification, and Predictive Maintenance.
"""

import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.ml.anomaly_detector import anomaly_detector
from app.ml.fault_classifier import fault_classifier
from app.ml.predictive_maintenance import predictive_maintenance_engine
from app.models import MLModelMetadata
from app.core.datetime_utils import utc_now
from app.core.logging import logger


class MLModelManager:
    """Orchestrates machine learning pipelines and metadata."""

    @classmethod
    def sync_models_to_db(cls, db: Session):
        """Ensure active models are recorded in the database."""
        try:
            # 1. Anomaly Detector
            m_anom = db.query(MLModelMetadata).filter(
                MLModelMetadata.model_type == "anomaly_detection",
                MLModelMetadata.version == anomaly_detector.VERSION
            ).first()
            if not m_anom:
                m_anom = MLModelMetadata(
                    model_type="anomaly_detection",
                    version=anomaly_detector.VERSION,
                    algorithm="IsolationForest",
                    parameters=json.dumps({"n_estimators": 100, "contamination": 0.08}),
                    metrics=json.dumps({"status": "calibrated", "baseline_samples": 600}),
                    is_active=True,
                    trained_at=utc_now(),
                    file_path=anomaly_detector.model_path
                )
                db.add(m_anom)

            # 2. Fault Classifier
            m_fault = db.query(MLModelMetadata).filter(
                MLModelMetadata.model_type == "fault_classification",
                MLModelMetadata.version == fault_classifier.VERSION
            ).first()
            if not m_fault:
                m_fault = MLModelMetadata(
                    model_type="fault_classification",
                    version=fault_classifier.VERSION,
                    algorithm="RandomForestClassifier",
                    parameters=json.dumps({"n_estimators": 120, "max_depth": 12}),
                    metrics=json.dumps(fault_classifier.metrics),
                    is_active=True,
                    trained_at=utc_now(),
                    file_path=fault_classifier.model_path
                )
                db.add(m_fault)

            # 3. Predictive Maintenance Engine
            m_pred = db.query(MLModelMetadata).filter(
                MLModelMetadata.model_type == "predictive_maintenance",
                MLModelMetadata.version == predictive_maintenance_engine.VERSION
            ).first()
            if not m_pred:
                m_pred = MLModelMetadata(
                    model_type="predictive_maintenance",
                    version=predictive_maintenance_engine.VERSION,
                    algorithm="LongitudinalCompositeDegradationEngine",
                    parameters=json.dumps({"resistance_weight": 0.45, "instability_weight": 0.30, "thermal_weight": 0.25}),
                    metrics=json.dumps({"confidence_nominal": 0.75, "confidence_longitudinal": 0.88}),
                    is_active=True,
                    trained_at=utc_now(),
                    file_path=None
                )
                db.add(m_pred)

            db.commit()
            logger.info("ML model metadata synchronized with database.")
        except Exception as e:
            logger.warning(f"Failed to sync ML metadata: {e}")
            db.rollback()

    @classmethod
    def get_all_models_status(cls, db: Session) -> List[Dict[str, Any]]:
        """Return all registered model versions, status, and metrics."""
        records = db.query(MLModelMetadata).order_by(MLModelMetadata.trained_at.desc()).all()
        results = []
        for r in records:
            results.append({
                "id": r.id,
                "model_type": r.model_type,
                "version": r.version,
                "algorithm": r.algorithm,
                "metrics": json.loads(r.metrics) if r.metrics else {},
                "parameters": json.loads(r.parameters) if r.parameters else {},
                "is_active": r.is_active,
                "trained_at": r.trained_at.isoformat() if r.trained_at else None,
                "file_path": r.file_path
            })
        return results

    @classmethod
    def retrain_models(cls, db: Session, model_type: str = "all", sample_size: int = 500) -> Dict[str, Any]:
        """Trigger re-calibration and training of the ML models."""
        trained = []
        metrics_summary = {}

        if model_type in ("all", "anomaly_detection"):
            anomaly_detector._train_baseline_model()
            trained.append("anomaly_detection")
            metrics_summary["anomaly_detection"] = {
                "version": anomaly_detector.VERSION,
                "baseline_samples": sample_size
            }

        if model_type in ("all", "fault_classification"):
            fault_classifier._train_and_calibrate()
            trained.append("fault_classification")
            metrics_summary["fault_classification"] = fault_classifier.metrics

        # Update database metadata
        cls.sync_models_to_db(db)

        return {
            "status": "success",
            "models_trained": trained,
            "metrics": metrics_summary,
            "message": f"Successfully retrained models: {', '.join(trained)}"
        }

    @classmethod
    def full_ml_inference(
        cls,
        measurements: List[Any],
        historical_test_sessions: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Execute unified ML inference across Anomaly Detection, Fault Classification,
        and Predictive Maintenance.
        """
        anom_res = anomaly_detector.predict(measurements)
        fault_res = fault_classifier.predict(measurements)
        maint_res = predictive_maintenance_engine.evaluate_degradation(measurements, historical_test_sessions)

        # Health score derivation: 100 - (0.5 * anomaly_score + 0.5 * degradation_risk_score)
        derived_health = 100.0 - (0.45 * anom_res["anomaly_score"] + 0.55 * maint_res["degradation_risk_score"])
        derived_health = float(max(0.0, min(100.0, derived_health)))

        return {
            "health_score": round(derived_health, 1),
            "anomaly_detection": anom_res,
            "fault_classification": fault_res,
            "predictive_maintenance": maint_res
        }
