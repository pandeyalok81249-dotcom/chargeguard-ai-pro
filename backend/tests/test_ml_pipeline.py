"""Tests for Machine Learning Models, Anomaly Detection, and Fault Classification."""

import pytest
from app.ml.feature_extractor import SensorFeatureExtractor
from app.ml.anomaly_detector import anomaly_detector
from app.ml.fault_classifier import fault_classifier
from app.ml.predictive_maintenance import predictive_maintenance_engine
from app.ml.model_manager import MLModelManager
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_feature_extractor():
    sample_measurements = [
        {"sink_voltage_v": 4.98, "current_a": 1.45, "temperature_c": 28.2, "effective_resistance_ohm": 0.055},
        {"sink_voltage_v": 4.96, "current_a": 1.48, "temperature_c": 28.5, "effective_resistance_ohm": 0.058},
        {"sink_voltage_v": 4.95, "current_a": 1.50, "temperature_c": 28.9, "effective_resistance_ohm": 0.060},
    ]
    feats = SensorFeatureExtractor.extract_features(sample_measurements)
    assert feats is not None
    assert len(feats) == len(SensorFeatureExtractor.FEATURE_NAMES)
    f_dict = SensorFeatureExtractor.get_feature_dict(feats)
    assert "v_mean" in f_dict
    assert "v_stability" in f_dict
    assert f_dict["v_mean"] > 4.90


def test_anomaly_detection_nominal_vs_outlier():
    # Nominal readings
    nominal_measurements = [
        {"sink_voltage_v": 4.98, "current_a": 1.45, "temperature_c": 28.0},
        {"sink_voltage_v": 4.97, "current_a": 1.46, "temperature_c": 28.2},
    ]
    nom_res = anomaly_detector.predict(nominal_measurements)
    assert "is_anomaly" in nom_res
    assert "anomaly_score" in nom_res
    assert nom_res["confidence"] > 0.0

    # Severe Anomaly (extreme drop & high temp)
    outlier_measurements = [
        {"sink_voltage_v": 3.80, "current_a": 3.40, "temperature_c": 56.5},
        {"sink_voltage_v": 3.65, "current_a": 3.55, "temperature_c": 58.0},
    ]
    out_res = anomaly_detector.predict(outlier_measurements)
    assert out_res["is_anomaly"] is True
    assert out_res["anomaly_score"] > 60.0


def test_fault_classifier_predictions():
    # Test Undervoltage
    uv_data = [
        {"sink_voltage_v": 4.10, "current_a": 1.80, "temperature_c": 31.0},
        {"sink_voltage_v": 4.05, "current_a": 1.85, "temperature_c": 31.5},
    ]
    uv_pred = fault_classifier.predict(uv_data)
    assert uv_pred["predicted_fault"] in ("UNDERVOLTAGE", "VOLTAGE_INSTABILITY")

    # Test Overheating
    oh_data = [
        {"sink_voltage_v": 4.80, "current_a": 2.20, "temperature_c": 52.5},
    ]
    oh_pred = fault_classifier.predict(oh_data)
    assert oh_pred["predicted_fault"] == "OVERHEATING"


def test_predictive_maintenance_degradation():
    worn_data = [
        {"sink_voltage_v": 4.40, "current_a": 1.50, "temperature_c": 44.0, "effective_resistance_ohm": 0.42},
        {"sink_voltage_v": 4.35, "current_a": 1.55, "temperature_c": 45.2, "effective_resistance_ohm": 0.45},
    ]
    deg_res = predictive_maintenance_engine.evaluate_degradation(worn_data)
    assert deg_res["degradation_risk_score"] > 30.0
    assert "risk_category" in deg_res
    assert "limitations" in deg_res


def test_ml_api_endpoints():
    res_models = client.get("/api/ml/models")
    assert res_models.status_code == 200
    models_list = res_models.json()
    assert len(models_list) >= 2

    res_anom = client.post("/api/ml/anomaly-detect")
    assert res_anom.status_code == 200

    res_fault = client.post("/api/ml/classify-fault")
    assert res_fault.status_code == 200

    res_maint = client.post("/api/ml/predictive-maintenance")
    assert res_maint.status_code == 200
