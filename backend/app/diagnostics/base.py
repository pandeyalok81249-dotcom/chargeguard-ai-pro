"""Base diagnostic interface for ChargeGuard AI Pro."""

from abc import ABC, abstractmethod
from typing import List, Dict, Any, Optional
from datetime import datetime

class DiagnosticResult:
    def __init__(
        self,
        health_score: Optional[float],
        health_category: str,
        confidence: Optional[float],
        model_version: str,
        explanation: Dict[str, Any],
        alerts_triggered: List[Dict[str, Any]],
        should_stop_test: bool = False,
        stop_reason: Optional[str] = None
    ):
        self.health_score = health_score
        self.health_category = health_category
        self.confidence = confidence
        self.model_version = model_version
        self.explanation = explanation
        self.alerts_triggered = alerts_triggered
        self.should_stop_test = should_stop_test
        self.stop_reason = stop_reason

class BaseDiagnosticEngine(ABC):
    @abstractmethod
    def evaluate(self, measurements: list, thresholds: Dict[str, Any]) -> DiagnosticResult:
        """Evaluate a sequence of measurements against diagnostic models and thresholds."""
        pass
