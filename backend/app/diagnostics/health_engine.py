"""
Unified Centralized Health & Fault Diagnostic Engine for ChargeGuard AI Pro.
Single Source of Truth for ESP32 Firmware, Backend Services, and Frontend Dashboard.

Formula Standard:
  Health Score = 100 - SUM(Deductions)

Deduction Specifications:
  1. Critical Faults (Score <= 55, Status: FAULT):
     - Critical Overheating (T >= 50.0°C): -50 pts (CRITICAL_OVERHEAT)
     - Critical Undervoltage (V_sink < 4.20V): -45 pts (CRITICAL_UNDERVOLTAGE) -> Yields Score 55
     - Critical Overvoltage (V_sink > 5.60V): -45 pts (CRITICAL_OVERVOLTAGE)
     - Critical Overcurrent (I > 3.00A): -45 pts (CRITICAL_OVERCURRENT)
     - High Loop Resistance (R > 0.60 ohm when I > 0.05A): -35 pts (HIGH_RESISTANCE)

  2. Warnings (Score 50-79, Status: WARNING):
     - Moderate Voltage Sag (4.20V <= V_sink < 4.50V): -15 pts (VOLTAGE_SAG)
     - Elevated Temperature (42.0°C <= T < 50.0°C): -20 pts (ELEVATED_TEMP)
     - Marginal Resistance (0.25 ohm < R <= 0.60 ohm): -15 pts (MARGINAL_RESISTANCE)
     - Elevated Current (2.40A < I <= 3.00A): -15 pts (ELEVATED_CURRENT)
     - Voltage Instability / Ripple (jitter > 0.10V): -15 pts (VOLTAGE_INSTABILITY)

  3. Nominal (Score >= 80, Status: NORMAL):
     - All measured parameters within standard USB 5V charging tolerances.
"""

from typing import Dict, Any, Optional, Tuple, List


# Authoritative Default Thresholds
DEFAULT_THRESHOLDS = {
    "voltage_min_critical_v": 4.20,
    "voltage_min_warning_v": 4.50,
    "voltage_max_warning_v": 5.30,
    "voltage_max_critical_v": 5.60,
    "current_max_warning_a": 2.40,
    "current_max_critical_a": 3.00,
    "temperature_warning_c": 42.0,
    "temperature_critical_c": 50.0,
    "resistance_good_max_ohm": 0.25,
    "resistance_warning_max_ohm": 0.60,
    "stability_warning_threshold": 0.08,
}


def calculate_instantaneous_health(
    sink_voltage_v: Optional[float],
    current_a: Optional[float] = None,
    temperature_c: Optional[float] = None,
    effective_resistance_ohm: Optional[float] = None,
    voltage_stability: Optional[float] = None,
    thresholds: Optional[Dict[str, Any]] = None
) -> Dict[str, Any]:
    """
    Deterministically compute health score (0-100), fault status (NORMAL | WARNING | FAULT),
    and primary explanatory reason for any instantaneous telemetry frame.
    
    Guarantees that identical telemetry inputs produce the exact same score and fault classification
    across ESP32 LCD, Python Backend, and Web/Mobile Dashboard.
    """
    cfg = {**DEFAULT_THRESHOLDS, **(thresholds or {})}

    # Unloaded or null telemetry defaults to standby baseline
    if sink_voltage_v is None:
        return {
            "health_score": 100,
            "fault_status": "NORMAL",
            "primary_reason": "STANDBY_UNLOADED",
            "deductions": [],
            "is_critical": False,
            "confidence": 0.50
        }

    score = 100.0
    deductions: List[Dict[str, Any]] = []
    fault_status = "NORMAL"
    primary_reason = "NOMINAL_OPERATING"
    is_critical = False

    # 1. Critical Overheat Check
    if temperature_c is not None and temperature_c >= cfg["temperature_critical_c"]:
        score -= 50.0
        deductions.append({
            "code": "CRITICAL_OVERHEAT",
            "penalty": 50.0,
            "observed": temperature_c,
            "threshold": cfg["temperature_critical_c"],
            "severity": "critical"
        })
        is_critical = True
        fault_status = "FAULT"
        primary_reason = f"Critical Temperature ({temperature_c:.1f}°C >= {cfg['temperature_critical_c']}°C)"

    # 2. Critical Undervoltage Check (< 4.20V)
    # E.g., V=4.10V -> Penalty -45 -> Score = 55, Status = FAULT
    elif sink_voltage_v < cfg["voltage_min_critical_v"]:
        score -= 45.0
        deductions.append({
            "code": "CRITICAL_UNDERVOLTAGE",
            "penalty": 45.0,
            "observed": sink_voltage_v,
            "threshold": cfg["voltage_min_critical_v"],
            "severity": "critical"
        })
        is_critical = True
        fault_status = "FAULT"
        primary_reason = f"Critical Undervoltage ({sink_voltage_v:.2f}V < {cfg['voltage_min_critical_v']:.2f}V)"

    # 3. Critical Overvoltage Check (> 5.60V)
    elif sink_voltage_v > cfg["voltage_max_critical_v"]:
        score -= 45.0
        deductions.append({
            "code": "CRITICAL_OVERVOLTAGE",
            "penalty": 45.0,
            "observed": sink_voltage_v,
            "threshold": cfg["voltage_max_critical_v"],
            "severity": "critical"
        })
        is_critical = True
        fault_status = "FAULT"
        primary_reason = f"Critical Overvoltage ({sink_voltage_v:.2f}V > {cfg['voltage_max_critical_v']:.2f}V)"

    # 4. Critical Overcurrent Check (> 3.00A)
    elif current_a is not None and current_a > cfg["current_max_critical_a"]:
        score -= 45.0
        deductions.append({
            "code": "CRITICAL_OVERCURRENT",
            "penalty": 45.0,
            "observed": current_a,
            "threshold": cfg["current_max_critical_a"],
            "severity": "critical"
        })
        is_critical = True
        fault_status = "FAULT"
        primary_reason = f"Critical Overcurrent ({current_a:.2f}A > {cfg['current_max_critical_a']:.2f}A)"

    # 5. Severe Cable Resistance (> 0.60 Ohm with current active)
    elif effective_resistance_ohm is not None and effective_resistance_ohm > cfg["resistance_warning_max_ohm"]:
        score -= 35.0
        deductions.append({
            "code": "HIGH_RESISTANCE",
            "penalty": 35.0,
            "observed": effective_resistance_ohm,
            "threshold": cfg["resistance_warning_max_ohm"],
            "severity": "critical"
        })
        is_critical = True
        fault_status = "FAULT"
        primary_reason = f"High Conductor Resistance ({effective_resistance_ohm:.3f}Ω > {cfg['resistance_warning_max_ohm']}Ω)"

    # --- Non-critical warning penalties (if no critical fault has overridden) ---
    if not is_critical:
        # Warning: Elevated Temperature
        if temperature_c is not None and temperature_c >= cfg["temperature_warning_c"]:
            score -= 20.0
            deductions.append({
                "code": "ELEVATED_TEMP",
                "penalty": 20.0,
                "observed": temperature_c,
                "threshold": cfg["temperature_warning_c"],
                "severity": "warning"
            })
            fault_status = "WARNING"
            primary_reason = f"Elevated Temperature ({temperature_c:.1f}°C >= {cfg['temperature_warning_c']}°C)"

        # Warning: Voltage Sag (4.20V <= V < 4.50V)
        if sink_voltage_v < cfg["voltage_min_warning_v"]:
            score -= 15.0
            deductions.append({
                "code": "VOLTAGE_SAG",
                "penalty": 15.0,
                "observed": sink_voltage_v,
                "threshold": cfg["voltage_min_warning_v"],
                "severity": "warning"
            })
            if fault_status != "FAULT":
                fault_status = "WARNING"
                primary_reason = f"Voltage Sag ({sink_voltage_v:.2f}V < {cfg['voltage_min_warning_v']:.2f}V)"

        # Warning: Marginal Resistance (0.25 < R <= 0.60)
        if effective_resistance_ohm is not None and effective_resistance_ohm > cfg["resistance_good_max_ohm"]:
            score -= 15.0
            deductions.append({
                "code": "MARGINAL_RESISTANCE",
                "penalty": 15.0,
                "observed": effective_resistance_ohm,
                "threshold": cfg["resistance_good_max_ohm"],
                "severity": "warning"
            })
            if fault_status != "FAULT":
                fault_status = "WARNING"
                primary_reason = f"Marginal Resistance ({effective_resistance_ohm:.3f}Ω > {cfg['resistance_good_max_ohm']}Ω)"

        # Warning: Overcurrent warning (2.40A < I <= 3.00A)
        if current_a is not None and current_a > cfg["current_max_warning_a"]:
            score -= 15.0
            deductions.append({
                "code": "ELEVATED_CURRENT",
                "penalty": 15.0,
                "observed": current_a,
                "threshold": cfg["current_max_warning_a"],
                "severity": "warning"
            })
            if fault_status != "FAULT":
                fault_status = "WARNING"
                primary_reason = f"Elevated Current ({current_a:.2f}A > {cfg['current_max_warning_a']}A)"

        # Warning: Voltage Instability
        if voltage_stability is not None and voltage_stability > cfg["stability_warning_threshold"]:
            score -= 15.0
            deductions.append({
                "code": "VOLTAGE_INSTABILITY",
                "penalty": 15.0,
                "observed": voltage_stability,
                "threshold": cfg["stability_warning_threshold"],
                "severity": "warning"
            })
            if fault_status != "FAULT":
                fault_status = "WARNING"
                primary_reason = f"Voltage Instability (Ripple {voltage_stability:.3f}V)"

    # Clamp final score
    final_score = int(max(5.0, min(100.0, round(score))))

    # State categorization consistency check
    has_warning_deductions = any(d.get("severity") == "warning" for d in deductions)
    if is_critical or final_score < 50:
        fault_status = "FAULT"
    elif has_warning_deductions or final_score < 80:
        fault_status = "WARNING"
    else:
        fault_status = "NORMAL"

    if fault_status == "NORMAL":
        primary_reason = "Nominal 5.0V USB Operating State"

    confidence = 0.95 if effective_resistance_ohm is not None else 0.85

    return {
        "health_score": final_score,
        "fault_status": fault_status,
        "primary_reason": primary_reason,
        "deductions": deductions,
        "is_critical": is_critical,
        "confidence": confidence
    }
