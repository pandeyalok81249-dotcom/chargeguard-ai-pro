"""Deterministic, explainable rule-based diagnostic engine for ChargeGuard AI Pro."""

import math
from typing import List, Dict, Any, Optional
from app.diagnostics.base import BaseDiagnosticEngine, DiagnosticResult

class RulesDiagnosticEngine(BaseDiagnosticEngine):
    VERSION = "rules-v1.0"

    def evaluate(self, measurements: list, thresholds: Dict[str, Any]) -> DiagnosticResult:
        """
        Evaluate a sequence of measurements for a test session.
        Applies explainable engineering rules:
        - Voltage drop calculations (ONLY when paired source and sink measurements exist)
        - Cable resistance (ONLY when voltage drop and stable non-zero current exist)
        - Voltage threshold violations (under-voltage / over-voltage)
        - Over-current protection thresholds
        - Surface temperature escalation and safety stops
        - Voltage stability / contact ripple detection
        - Missing source-side reference handling
        """
        v_min_warn = thresholds.get("voltage_min_warning_v", 4.50)
        v_min_crit = thresholds.get("voltage_min_critical_v", 4.20)
        v_max_warn = thresholds.get("voltage_max_warning_v", 5.30)
        v_max_crit = thresholds.get("voltage_max_critical_v", 5.60)
        
        i_max_warn = thresholds.get("current_max_warning_a", 2.40)
        i_max_crit = thresholds.get("current_max_critical_a", 3.00)
        
        t_warn = thresholds.get("temperature_warning_c", 42.0)
        t_crit = thresholds.get("temperature_critical_c", 50.0)
        
        r_good_max = thresholds.get("resistance_good_max_ohm", 0.25)
        r_warn_max = thresholds.get("resistance_warning_max_ohm", 0.60)
        min_samples = thresholds.get("min_samples_for_health_score", 5)

        valid_measurements = [m for m in measurements if getattr(m, "measurement_valid", True)]
        total_samples = len(measurements)
        valid_samples = len(valid_measurements)

        alerts_triggered: List[Dict[str, Any]] = []
        rule_evaluations: List[Dict[str, Any]] = []
        should_stop_test = False
        stop_reason = None

        # Check for empty or minimal samples
        if valid_samples == 0:
            return DiagnosticResult(
                health_score=None,
                health_category="Insufficient Data",
                confidence=0.0,
                model_version=self.VERSION,
                explanation={
                    "status": "Insufficient Data",
                    "reason": "No valid sensor measurements recorded in this session.",
                    "valid_samples": 0,
                    "total_samples": total_samples,
                    "recommended_action": "Verify sensor wiring and ensure ESP32 power delivery is active."
                },
                alerts_triggered=[{
                    "severity": "warning",
                    "code": "NO_VALID_DATA",
                    "message": "Test session ended without valid sensor measurements.",
                    "observed_value": 0.0,
                    "threshold_value": float(min_samples)
                }]
            )

        # Extract numerical arrays
        sink_voltages = [m.sink_voltage_v for m in valid_measurements if m.sink_voltage_v is not None]
        source_voltages = [m.source_voltage_v for m in valid_measurements if m.source_voltage_v is not None]
        currents = [m.current_a for m in valid_measurements if m.current_a is not None]
        temperatures = [m.temperature_c for m in valid_measurements if m.temperature_c is not None]
        v_drops = [m.voltage_drop_v for m in valid_measurements if m.voltage_drop_v is not None]
        resistances = [m.effective_resistance_ohm for m in valid_measurements if m.effective_resistance_ohm is not None]

        # 1. Source Voltage Availability Evaluation
        has_source_measurement = len(source_voltages) > 0 and len(source_voltages) == len(sink_voltages)
        if not has_source_measurement:
            rule_evaluations.append({
                "rule": "SOURCE_VOLTAGE_CHECK",
                "status": "LIMITED",
                "description": "Single-ended measurement: only sink-side voltage available. Source-side voltage is not monitored.",
                "impact": "True cable voltage drop and physical conductor resistance cannot be calculated without assuming or measuring source voltage."
            })

        # 2. Temperature Safety Check (Cable Surface)
        max_temp = max(temperatures) if temperatures else None
        if max_temp is not None:
            if max_temp >= t_crit:
                should_stop_test = True
                stop_reason = f"Critical cable surface temperature {max_temp:.1f}°C exceeded safety limit ({t_crit:.1f}°C)"
                alerts_triggered.append({
                    "severity": "critical",
                    "code": "OVERHEAT_CRITICAL",
                    "message": f"Critical overheating detected: {max_temp:.1f}°C (Limit: {t_crit:.1f}°C). Automated safety cutoff recommended.",
                    "observed_value": round(max_temp, 2),
                    "threshold_value": float(t_crit)
                })
                rule_evaluations.append({
                    "rule": "THERMAL_SAFETY",
                    "status": "FAIL",
                    "observed": f"{max_temp:.1f}°C",
                    "limit": f"Critical limit {t_crit:.1f}°C",
                    "action": "Safe stop triggered. Check for high contact resistance or internal conductor fraying."
                })
            elif max_temp >= t_warn:
                alerts_triggered.append({
                    "severity": "warning",
                    "code": "OVERHEAT_WARNING",
                    "message": f"Elevated temperature detected: {max_temp:.1f}°C (Warning: {t_warn:.1f}°C).",
                    "observed_value": round(max_temp, 2),
                    "threshold_value": float(t_warn)
                })
                rule_evaluations.append({
                    "rule": "THERMAL_SAFETY",
                    "status": "WARN",
                    "observed": f"{max_temp:.1f}°C",
                    "limit": f"Warning limit {t_warn:.1f}°C",
                    "action": "Monitor thermal trend during sustained charging."
                })
            else:
                rule_evaluations.append({
                    "rule": "THERMAL_SAFETY",
                    "status": "PASS",
                    "observed": f"{max_temp:.1f}°C",
                    "limit": f"< {t_warn:.1f}°C",
                    "action": "Thermal profile is within safe operational envelope."
                })

        # 3. Current Overload Check
        max_current = max(currents) if currents else None
        if max_current is not None:
            if max_current >= i_max_crit:
                should_stop_test = True
                stop_reason = f"Current {max_current:.2f}A exceeded critical threshold ({i_max_crit:.2f}A)"
                alerts_triggered.append({
                    "severity": "critical",
                    "code": "CURRENT_OVERLOAD_CRITICAL",
                    "message": f"Critical current draw {max_current:.2f}A exceeded maximum safety limit ({i_max_crit:.2f}A).",
                    "observed_value": round(max_current, 2),
                    "threshold_value": float(i_max_crit)
                })
                rule_evaluations.append({
                    "rule": "CURRENT_SAFETY",
                    "status": "FAIL",
                    "observed": f"{max_current:.2f}A",
                    "limit": f"Critical limit {i_max_crit:.2f}A",
                    "action": "Immediate test termination recommended to protect sink trigger."
                })
            elif max_current >= i_max_warn:
                alerts_triggered.append({
                    "severity": "warning",
                    "code": "CURRENT_ELEVATED_WARNING",
                    "message": f"Current {max_current:.2f}A approached safety margin ({i_max_warn:.2f}A).",
                    "observed_value": round(max_current, 2),
                    "threshold_value": float(i_max_warn)
                })
                rule_evaluations.append({
                    "rule": "CURRENT_SAFETY",
                    "status": "WARN",
                    "observed": f"{max_current:.2f}A",
                    "limit": f"Warning limit {i_max_warn:.2f}A",
                    "action": "Verify load rating of cable under test."
                })
            else:
                rule_evaluations.append({
                    "rule": "CURRENT_SAFETY",
                    "status": "PASS",
                    "observed": f"{max_current:.2f}A",
                    "limit": f"< {i_max_warn:.2f}A",
                    "action": "Current draw is within tested profile envelope."
                })

        # 4. Voltage Limits (Sink-side Under/Over-Voltage)
        min_sink_v = min(sink_voltages) if sink_voltages else None
        max_sink_v = max(sink_voltages) if sink_voltages else None
        if min_sink_v is not None and max_sink_v is not None:
            if min_sink_v <= v_min_crit:
                alerts_triggered.append({
                    "severity": "critical",
                    "code": "VOLTAGE_SEVERE_SAG",
                    "message": f"Sink voltage sagged to {min_sink_v:.2f}V (Critical min: {v_min_crit:.2f}V).",
                    "observed_value": round(min_sink_v, 2),
                    "threshold_value": float(v_min_crit)
                })
                rule_evaluations.append({
                    "rule": "VOLTAGE_BOUNDS",
                    "status": "FAIL",
                    "observed": f"Min {min_sink_v:.2f}V",
                    "limit": f">= {v_min_crit:.2f}V",
                    "action": "Severe voltage sag: causes charging negotiation drops or device resets."
                })
            elif min_sink_v <= v_min_warn:
                alerts_triggered.append({
                    "severity": "warning",
                    "code": "VOLTAGE_MODERATE_SAG",
                    "message": f"Sink voltage dropped to {min_sink_v:.2f}V (Warning min: {v_min_warn:.2f}V).",
                    "observed_value": round(min_sink_v, 2),
                    "threshold_value": float(v_min_warn)
                })
                rule_evaluations.append({
                    "rule": "VOLTAGE_BOUNDS",
                    "status": "WARN",
                    "observed": f"Min {min_sink_v:.2f}V",
                    "limit": f">= {v_min_warn:.2f}V",
                    "action": "Moderate voltage drop under load. Suggests thin gauge or worn connectors."
                })
            elif max_sink_v >= v_max_crit:
                should_stop_test = True
                stop_reason = f"Overvoltage detected: {max_sink_v:.2f}V exceeded safety threshold ({v_max_crit:.2f}V)"
                alerts_triggered.append({
                    "severity": "critical",
                    "code": "OVERVOLTAGE_CRITICAL",
                    "message": f"Overvoltage event {max_sink_v:.2f}V exceeded safe profile limit ({v_max_crit:.2f}V).",
                    "observed_value": round(max_sink_v, 2),
                    "threshold_value": float(v_max_crit)
                })
                rule_evaluations.append({
                    "rule": "VOLTAGE_BOUNDS",
                    "status": "FAIL",
                    "observed": f"Max {max_sink_v:.2f}V",
                    "limit": f"<= {v_max_crit:.2f}V",
                    "action": "Supply regulator overvoltage. Stop test immediately."
                })
            else:
                rule_evaluations.append({
                    "rule": "VOLTAGE_BOUNDS",
                    "status": "PASS",
                    "observed": f"{min_sink_v:.2f}V - {max_sink_v:.2f}V",
                    "limit": f"{v_min_warn:.2f}V - {v_max_warn:.2f}V",
                    "action": "Sink voltage regulation is within normal 5V USB tolerance."
                })

        # 5. Voltage Stability & Ripple Analysis (Contact integrity)
        if len(sink_voltages) >= 4:
            mean_v = sum(sink_voltages) / len(sink_voltages)
            variance_v = sum((v - mean_v) ** 2 for v in sink_voltages) / len(sink_voltages)
            std_dev_v = math.sqrt(variance_v)
            if std_dev_v > 0.15:
                alerts_triggered.append({
                    "severity": "warning",
                    "code": "CONTACT_INTERMITTENT_RIPPLE",
                    "message": f"High voltage variance detected (std dev: {std_dev_v:.3f}V). Likely intermittent contact or cable flex damage.",
                    "observed_value": round(std_dev_v, 3),
                    "threshold_value": 0.15
                })
                rule_evaluations.append({
                    "rule": "VOLTAGE_STABILITY",
                    "status": "WARN",
                    "observed": f"Std Dev {std_dev_v:.3f}V",
                    "limit": "< 0.15V",
                    "action": "Inspect connector pins for oxidation, dirt, or bent contact springs."
                })
            else:
                rule_evaluations.append({
                    "rule": "VOLTAGE_STABILITY",
                    "status": "PASS",
                    "observed": f"Std Dev {std_dev_v:.3f}V",
                    "limit": "< 0.15V",
                    "action": "Contact resistance is stable over the test duration."
                })

        # 6. Resistance Analysis (When pairs exist)
        avg_resistance = None
        if resistances:
            avg_resistance = sum(resistances) / len(resistances)
            if avg_resistance > r_warn_max:
                alerts_triggered.append({
                    "severity": "critical" if avg_resistance > 1.0 else "warning",
                    "code": "RESISTANCE_EXCESSIVE",
                    "message": f"Calculated effective test-path resistance {avg_resistance:.3f}Ω exceeds safe threshold ({r_warn_max:.2f}Ω).",
                    "observed_value": round(avg_resistance, 3),
                    "threshold_value": float(r_warn_max)
                })
                rule_evaluations.append({
                    "rule": "EFFECTIVE_RESISTANCE",
                    "status": "FAIL" if avg_resistance > 1.0 else "WARN",
                    "observed": f"{avg_resistance:.3f}Ω",
                    "limit": f"<= {r_warn_max:.2f}Ω",
                    "action": "High loop resistance causes power dissipation and reduced fast charging speed."
                })
            elif avg_resistance > r_good_max:
                rule_evaluations.append({
                    "rule": "EFFECTIVE_RESISTANCE",
                    "status": "WARN",
                    "observed": f"{avg_resistance:.3f}Ω",
                    "limit": f"<= {r_good_max:.2f}Ω",
                    "action": "Moderate cable loop resistance. Acceptable for standard charging, suboptimal for high wattage."
                })
            else:
                rule_evaluations.append({
                    "rule": "EFFECTIVE_RESISTANCE",
                    "status": "PASS",
                    "observed": f"{avg_resistance:.3f}Ω",
                    "limit": f"<= {r_good_max:.2f}Ω",
                    "action": "Low resistance test path indicates good conductor and connector integrity."
                })

        # 7. Health Score and Category Calculation
        health_score, health_category, confidence = self._calculate_health_score(
            valid_samples=valid_samples,
            min_samples=min_samples,
            has_source_measurement=has_source_measurement,
            min_sink_v=min_sink_v,
            max_temp=max_temp,
            avg_resistance=avg_resistance,
            alerts_triggered=alerts_triggered
        )

        explanation = {
            "health_score": health_score,
            "health_category": health_category,
            "confidence": confidence,
            "total_samples": total_samples,
            "valid_samples": valid_samples,
            "has_calibrated_source_measurement": has_source_measurement,
            "rules_evaluated": rule_evaluations,
            "recommended_actions": self._generate_recommendations(health_category, alerts_triggered),
            "disclaimer": "ChargeGuard AI Pro is an engineering screening prototype for 5V test profiles. Cable surface temperature does not represent internal core conductor temperature. This test does not certify official USB-IF compliance."
        }

        return DiagnosticResult(
            health_score=health_score,
            health_category=health_category,
            confidence=confidence,
            model_version=self.VERSION,
            explanation=explanation,
            alerts_triggered=alerts_triggered,
            should_stop_test=should_stop_test,
            stop_reason=stop_reason
        )

    def _calculate_health_score(
        self,
        valid_samples: int,
        min_samples: int,
        has_source_measurement: bool,
        min_sink_v: Optional[float],
        max_temp: Optional[float],
        avg_resistance: Optional[float],
        alerts_triggered: List[Dict[str, Any]]
    ):
        """Derive a defensible 0-100 score or return Insufficient Data."""
        # Count critical and warning alerts
        has_critical = any(a["severity"] == "critical" for a in alerts_triggered)
        warning_count = sum(1 for a in alerts_triggered if a["severity"] == "warning")

        # Critical safety faults immediately classify as Critical regardless of sample count
        if has_critical:
            score = 30.0
            if max_temp and max_temp >= 50.0:
                score -= 15.0
            if avg_resistance and avg_resistance > 1.0:
                score -= 10.0
            score = max(5.0, score)
            confidence = 0.85 if has_source_measurement else 0.70
            return round(score, 1), "Critical", confidence

        # Check minimum data sufficiency for non-critical cables
        if valid_samples < min_samples:
            return None, "Insufficient Data", round(valid_samples / min_samples * 0.4, 2)

        # Base starting score
        base_score = 100.0

        # Penalty for warnings
        base_score -= (warning_count * 15.0)

        # Resistance deductions if available
        if avg_resistance is not None:
            if avg_resistance > 0.60:
                base_score -= 25.0
            elif avg_resistance > 0.35:
                base_score -= 12.0
            elif avg_resistance > 0.25:
                base_score -= 5.0

        # Thermal deductions
        if max_temp is not None:
            if max_temp > 45.0:
                base_score -= 15.0
            elif max_temp > 38.0:
                base_score -= 6.0

        # Voltage sag deductions
        if min_sink_v is not None and min_sink_v < 4.60:
            base_score -= 10.0

        score = max(10.0, min(100.0, base_score))

        if score >= 80.0:
            category = "Healthy"
        elif score >= 50.0:
            category = "Warning"
        else:
            category = "Critical"

        confidence = 0.90 if has_source_measurement else 0.65

        return round(score, 1), category, confidence

    def _generate_recommendations(self, category: str, alerts: List[Dict[str, Any]]) -> List[str]:
        recs = []
        if category == "Critical":
            recs.append("Cease using this cable for charging high-current or valuable consumer electronics.")
            recs.append("Check physical connector housings for charring, bending, or insulation shrinkage.")
        elif category == "Warning":
            recs.append("Use with caution. Monitor connection for warmth and unexpected charging pauses.")
            recs.append("Clean connector contacts with a dry anti-static brush or electrical contact cleaner.")
        elif category == "Healthy":
            recs.append("Cable operates within nominal electrical and thermal limits for the tested profile.")
            recs.append("Store cable loosely coiled without sharp 90-degree bends to prolong lifespan.")
        else:
            recs.append("Collect at least 5 complete measurement samples to establish health trend.")
        return recs
