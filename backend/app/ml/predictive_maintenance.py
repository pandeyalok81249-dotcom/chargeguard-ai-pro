"""
ML Module 3: Predictive Maintenance and Degradation Assessment Engine.

Analyzes longitudinal degradation markers:
- Conductor resistance drift (ΔR over operational life)
- Thermal coefficient escalation (heat generation per Ampere squared)
- Micro-intermittent contact ripple frequency
- Voltage drop rate under rated loads

Provides calibrated degradation risk scoring (0-100), risk tiers,
maintenance recommendations, and transparent physical limitations.
"""

from typing import List, Dict, Any, Optional
import numpy as np


class PredictiveMaintenanceEngine:
    VERSION = "predictive-maint-v1.0"

    @classmethod
    def evaluate_degradation(
        cls,
        current_measurements: List[Any],
        historical_test_sessions: Optional[List[Any]] = None
    ) -> Dict[str, Any]:
        """
        Evaluate physical degradation risk based on current test session
        and historical session trends.
        """
        from app.ml.feature_extractor import SensorFeatureExtractor
        feats = SensorFeatureExtractor.extract_features(current_measurements)

        if feats is None:
            return {
                "degradation_risk_score": 0.0,
                "risk_category": "Nominal",
                "degradation_indicators": {},
                "estimated_remaining_cycles": None,
                "confidence": 0.0,
                "limitations": "Insufficient sensor telemetry to evaluate degradation indicators."
            }

        feature_dict = SensorFeatureExtractor.get_feature_dict(feats)

        # Baseline parameters
        r_est = feature_dict["resistance_est"]
        v_std = feature_dict["v_std"]
        t_max = feature_dict["t_max"]
        t_slope = feature_dict["t_slope"]
        i_mean = feature_dict["i_mean"]

        # 1. Resistance Degradation Factor (Nominal USB-C cable: 0.05 - 0.15 ohms)
        # > 0.25 ohms indicates contact oxidation, worn spring fingers, or broken strands
        if r_est <= 0.12:
            r_score = 5.0
        elif r_est <= 0.25:
            r_score = 15.0 + ((r_est - 0.12) / 0.13) * 25.0
        elif r_est <= 0.50:
            r_score = 40.0 + ((r_est - 0.25) / 0.25) * 35.0
        else:
            r_score = 75.0 + min(25.0, ((r_est - 0.50) / 0.50) * 25.0)

        # 2. Voltage Ripple / Contact Instability Factor
        if v_std <= 0.02:
            instability_score = 5.0
        elif v_std <= 0.08:
            instability_score = 20.0 + ((v_std - 0.02) / 0.06) * 30.0
        else:
            instability_score = 50.0 + min(50.0, ((v_std - 0.08) / 0.15) * 50.0)

        # 3. Thermal Creep Factor
        if t_max <= 35.0:
            thermal_score = 5.0
        elif t_max <= 45.0:
            thermal_score = 20.0 + ((t_max - 35.0) / 10.0) * 35.0
        else:
            thermal_score = 55.0 + min(45.0, ((t_max - 45.0) / 15.0) * 45.0)

        # Longitudinal trend analysis if historical tests exist
        historical_r_trend = 0.0
        if historical_test_sessions and len(historical_test_sessions) >= 3:
            past_resists = []
            for s in historical_test_sessions:
                r_val = getattr(s, "avg_resistance_ohm", None)
                if r_val is not None:
                    past_resists.append(float(r_val))
            if len(past_resists) >= 3:
                # Upward drift in resistance over successive tests
                diff = past_resists[-1] - past_resists[0]
                if diff > 0.05:
                    historical_r_trend = min(20.0, diff * 100.0)

        # Weighted composite degradation risk score (0 to 100)
        composite_score = (
            (r_score * 0.45) +
            (instability_score * 0.30) +
            (thermal_score * 0.25) +
            historical_r_trend
        )
        composite_score = float(np.clip(composite_score, 0.0, 100.0))

        # Risk categories
        if composite_score < 25.0:
            risk_category = "Nominal"
            estimated_cycles = 1000
        elif composite_score < 50.0:
            risk_category = "Moderate Degradation"
            estimated_cycles = 400
        elif composite_score < 75.0:
            risk_category = "Severe Degradation"
            estimated_cycles = 120
        else:
            risk_category = "Critical Wear"
            estimated_cycles = 25

        confidence = 0.88 if (historical_test_sessions and len(historical_test_sessions) >= 2) else 0.75

        indicators = {
            "effective_resistance_ohm": round(r_est, 4),
            "resistance_score": round(r_score, 1),
            "voltage_instability_std_v": round(v_std, 4),
            "instability_score": round(instability_score, 1),
            "max_surface_temp_c": round(t_max, 1),
            "thermal_score": round(thermal_score, 1),
            "historical_resistance_drift_ohm": round(historical_r_trend / 100.0, 4) if historical_r_trend > 0 else 0.0
        }

        limitations = (
            "RUL cycle estimate is an engineering projection based on contact impedance and thermal rise. "
            "Definitive physical Remaining Useful Life (RUL) requires standardized continuous bend-cycle testing "
            "under IEC 62680-1-3 specifications."
        )

        return {
            "degradation_risk_score": round(composite_score, 1),
            "risk_category": risk_category,
            "degradation_indicators": indicators,
            "estimated_remaining_cycles": estimated_cycles,
            "confidence": round(confidence, 2),
            "limitations": limitations
        }


# Singleton instance
predictive_maintenance_engine = PredictiveMaintenanceEngine()
