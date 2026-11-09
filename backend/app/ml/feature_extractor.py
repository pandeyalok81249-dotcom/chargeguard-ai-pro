"""
Feature Extraction Pipeline for ChargeGuard AI Pro Machine Learning.

Transforms raw or time-series sensor measurements into standardized statistical
feature vectors for Isolation Forest Anomaly Detection and Random Forest Fault Classification.
"""

from typing import List, Dict, Any, Optional
import numpy as np


class SensorFeatureExtractor:
    """Extracts rolling engineering features from sequences of electrical sensor readings."""

    FEATURE_NAMES = [
        "v_mean",
        "v_std",
        "v_min",
        "v_max",
        "v_range",
        "i_mean",
        "i_std",
        "i_min",
        "i_max",
        "t_mean",
        "t_max",
        "t_slope",
        "v_stability",
        "iv_ratio",
        "resistance_est"
    ]

    @classmethod
    def extract_features(cls, measurements: List[Any]) -> Optional[np.ndarray]:
        """
        Extract numerical feature vector from a list of measurements.
        Measurements can be SQLAlchemy Measurement objects or dictionaries.
        Returns a 1D numpy array of length 15, or None if insufficient valid data.
        """
        if not measurements:
            return None

        voltages = []
        currents = []
        temperatures = []
        resistances = []

        for m in measurements:
            # Handle both dictionary and ORM object
            if isinstance(m, dict):
                v = m.get("sink_voltage_v") or m.get("voltage")
                i = m.get("current_a") or m.get("current")
                t = m.get("temperature_c") or m.get("temperature")
                r = m.get("effective_resistance_ohm")
            else:
                v = getattr(m, "sink_voltage_v", None)
                i = getattr(m, "current_a", None)
                t = getattr(m, "temperature_c", None)
                r = getattr(m, "effective_resistance_ohm", None)

            if v is not None and not np.isnan(v):
                voltages.append(float(v))
            if i is not None and not np.isnan(i):
                currents.append(float(i))
            if t is not None and not np.isnan(t):
                temperatures.append(float(t))
            if r is not None and not np.isnan(r):
                resistances.append(float(r))

        if not voltages:
            return None

        # Fallback values if current or temp was not populated
        if not currents:
            currents = [0.0] * len(voltages)
        if not temperatures:
            temperatures = [25.0] * len(voltages)

        v_arr = np.array(voltages, dtype=float)
        i_arr = np.array(currents, dtype=float)
        t_arr = np.array(temperatures, dtype=float)

        v_mean = float(np.mean(v_arr))
        v_std = float(np.std(v_arr)) if len(v_arr) > 1 else 0.001
        v_min = float(np.min(v_arr))
        v_max = float(np.max(v_arr))
        v_range = v_max - v_min

        i_mean = float(np.mean(i_arr))
        i_std = float(np.std(i_arr)) if len(i_arr) > 1 else 0.001
        i_min = float(np.min(i_arr))
        i_max = float(np.max(i_arr))

        t_mean = float(np.mean(t_arr))
        t_max = float(np.max(t_arr))
        # Linear slope of temperature over sample index (degrees per sample)
        if len(t_arr) >= 2:
            x = np.arange(len(t_arr))
            t_slope = float(np.polyfit(x, t_arr, 1)[0])
        else:
            t_slope = 0.0

        # Normalized Voltage Stability (coefficient of variation: std / mean)
        v_stability = float(v_std / (v_mean + 1e-6))

        # Current-to-Voltage Relationship Ratio
        iv_ratio = float(i_mean / (v_mean + 1e-6))

        # Effective resistance estimate
        if resistances:
            resistance_est = float(np.mean(resistances))
        elif i_mean > 0.05 and v_mean < 5.05:
            resistance_est = float((5.05 - v_mean) / (i_mean + 1e-6))
        else:
            resistance_est = 0.06

        return np.array([
            v_mean,
            v_std,
            v_min,
            v_max,
            v_range,
            i_mean,
            i_std,
            i_min,
            i_max,
            t_mean,
            t_max,
            t_slope,
            v_stability,
            iv_ratio,
            resistance_est
        ], dtype=float)

    @classmethod
    def get_feature_dict(cls, feature_array: np.ndarray) -> Dict[str, float]:
        """Convert feature array to dictionary for explainability mapping."""
        return {name: round(float(val), 4) for name, val in zip(cls.FEATURE_NAMES, feature_array)}
