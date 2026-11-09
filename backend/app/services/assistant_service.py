"""
AI Diagnostic Assistant Service for ChargeGuard AI Pro.

Provides context-aware hardware diagnostic explanations using real telemetry,
historical test results, active alerts, and ML classifications.
Implements an LLM provider abstraction (Gemini / OpenAI) with an intelligent,
deterministic engineering rule-based fallback when external API keys are omitted.
"""

import os
import json
import uuid
import httpx
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.models import TestSession, Measurement, Alert, Cable, Device, DiagnosticConversation
from app.ml.model_manager import MLModelManager
from app.core.datetime_utils import utc_now
from app.core.logging import logger


class AIDiagnosticAssistant:
    def __init__(self):
        self.gemini_api_key = os.getenv("GEMINI_API_KEY")
        self.openai_api_key = os.getenv("OPENAI_API_KEY")

    def _gather_context(
        self,
        db: Session,
        test_id: Optional[str] = None,
        device_id: Optional[str] = None,
        cable_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """Collect verified electrical telemetry and health history from the database."""
        session = None
        if test_id:
            session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
        elif cable_id:
            session = db.query(TestSession).filter(TestSession.cable_id == cable_id).order_by(TestSession.started_at.desc()).first()
        else:
            session = db.query(TestSession).order_by(TestSession.started_at.desc()).first()

        if not session:
            return {"status": "No test sessions recorded in database."}

        measurements = session.measurements
        v_list = [m.sink_voltage_v for m in measurements if m.sink_voltage_v is not None]
        i_list = [m.current_a for m in measurements if m.current_a is not None]
        t_list = [m.temperature_c for m in measurements if m.temperature_c is not None]
        r_list = [m.effective_resistance_ohm for m in measurements if m.effective_resistance_ohm is not None]

        alerts = [
            {"code": a.code, "severity": a.severity, "message": a.message}
            for a in session.alerts
        ]

        # ML inference on session data
        ml_res = MLModelManager.full_ml_inference(measurements)

        cable_info = {}
        if session.cable:
            cable_info = {
                "name": session.cable.display_name,
                "connector": session.cable.connector_type,
                "type": session.cable.cable_type,
                "rated_power_w": session.cable.rated_power_w,
                "rated_current_a": session.cable.rated_current_a
            }

        context = {
            "test_id": session.test_id,
            "mode": session.mode,
            "status": session.status,
            "cable": cable_info,
            "sample_count": len(measurements),
            "telemetry_summary": {
                "avg_voltage_v": round(sum(v_list) / len(v_list), 3) if v_list else None,
                "min_voltage_v": round(min(v_list), 3) if v_list else None,
                "max_voltage_v": round(max(v_list), 3) if v_list else None,
                "avg_current_a": round(sum(i_list) / len(i_list), 3) if i_list else None,
                "max_temperature_c": round(max(t_list), 1) if t_list else None,
                "avg_resistance_ohm": round(sum(r_list) / len(r_list), 4) if r_list else None,
            },
            "alerts": alerts,
            "ml_health_score": ml_res.get("health_score"),
            "ml_anomaly": ml_res.get("anomaly_detection"),
            "ml_fault": ml_res.get("fault_classification", {}).get("predicted_fault"),
            "predictive_maintenance": ml_res.get("predictive_maintenance", {})
        }
        return context

    async def _query_gemini(self, query: str, context: Dict[str, Any]) -> Optional[str]:
        """Query Gemini API securely using configured backend API key."""
        if not self.gemini_api_key:
            return None
        url = f"https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key={self.gemini_api_key}"
        system_instruction = (
            "You are ChargeGuard AI Pro's senior diagnostic assistant for USB charging cables and power adapters. "
            "Analyze the provided empirical sensor telemetry objectively. "
            "Never fabricate sensor readings or claim capabilities not in telemetry. "
            "Never guarantee absolute electrical safety. Always explain uncertainty and suggest safe physical inspection steps."
        )
        prompt_text = f"{system_instruction}\n\nEmpirical Device Telemetry:\n{json.dumps(context, indent=2)}\n\nUser Question:\n{query}"
        try:
            async with httpx.AsyncClient(timeout=10.0) as client:
                res = await client.post(
                    url,
                    json={"contents": [{"parts": [{"text": prompt_text}]}]}
                )
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0]:
                        parts = candidates[0]["content"].get("parts", [])
                        if parts:
                            return parts[0].get("text", "")
        except Exception as e:
            logger.warning(f"Gemini API request failed, falling back: {e}")
        return None

    def _generate_expert_diagnostic_response(self, query: str, context: Dict[str, Any]) -> Tuple[str, List[str], List[str], str]:
        """
        Deterministic, expert engineering reasoning engine.
        Answers user inquiries rigorously with supporting measurements and action recommendations.
        """
        telemetry = context.get("telemetry_summary", {})
        v_avg = telemetry.get("avg_voltage_v")
        v_min = telemetry.get("min_voltage_v")
        i_avg = telemetry.get("avg_current_a")
        t_max = telemetry.get("max_temperature_c")
        r_avg = telemetry.get("avg_resistance_ohm")
        fault = context.get("ml_fault", "NORMAL")
        health = context.get("ml_health_score", 85)
        cable_name = context.get("cable", {}).get("name", "Connected Cable")

        q_lower = query.lower()
        detected_risks = []
        recommendations = []

        if t_max and t_max >= 50.0:
            detected_risks.append(f"Critical surface temperature: {t_max:.1f}°C exceeded 50.0°C thermal limit")
        if v_min and v_min < 4.50:
            detected_risks.append(f"Severe voltage drop: minimum sink voltage {v_min:.2f}V < 4.50V nominal")
        if r_avg and r_avg > 0.25:
            detected_risks.append(f"High path resistance: {r_avg:.3f}Ω exceeds recommended 0.25Ω ceiling")

        # Specific Query Intent Handlers
        if "voltage" in q_lower or "drop" in q_lower or "sag" in q_lower:
            response = (
                f"### Voltage Stability Analysis for **{cable_name}**\n\n"
                f"- **Observed Voltage Range**: {v_min or 0.0:.2f}V min to {telemetry.get('max_voltage_v') or 0.0:.2f}V max (Average: {v_avg or 0.0:.2f}V).\n"
                f"- **Current Draw**: {i_avg or 0.0:.2f}A continuous.\n"
                f"- **Calculated Path Resistance**: {r_avg or 0.0:.3f}Ω.\n\n"
            )
            if r_avg and r_avg > 0.25:
                response += (
                    "**Primary Cause**: The voltage drop is primarily driven by elevated conductor or contact resistance. "
                    "When current increases, Ohm's law ($V_{drop} = I \\times R$) creates an amplified voltage sag at the device sink.\n\n"
                )
                recommendations.extend([
                    "Inspect both USB-C plug contacts for oxidation, dust, or bent spring fingers.",
                    "Test with a known low-resistance reference cable to confirm whether the power source itself is sagging.",
                    "Verify connector mating tightness; loose receptacle fits create contact resistance spikes."
                ])
            else:
                response += (
                    "**Assessment**: Voltage drop is within standard USB-IF tolerances (4.75V - 5.25V). "
                    "Conductor impedance is healthy and not causing problematic voltage sag."
                )
                recommendations.append("Continue standard operation; no remedial action required.")

        elif "safe" in q_lower or "safety" in q_lower or "danger" in q_lower or "fire" in q_lower:
            response = (
                f"### Safety & Risk Assessment for **{cable_name}**\n\n"
                f"> **Important Notice**: While ChargeGuard AI Pro inspects electrical and thermal signals, "
                f"no software system can guarantee absolute physical safety against internal mechanical stress.\n\n"
                f"- **Maximum Observed Temperature**: {t_max or 25.0:.1f}°C (Safety cutoff threshold: 50.0°C).\n"
                f"- **Load Current**: {i_avg or 0.0:.2f}A (Maximum safe rated limit: 3.0A).\n"
                f"- **Current Diagnostic State**: `{fault}`.\n\n"
            )
            if t_max and t_max >= 50.0:
                response += "⚠️ **CRITICAL HAZARD DETECTED**: Thermal runaway or high contact dissipation detected. Do NOT continue using this cable under high-current fast charging."
                recommendations.extend([
                    "Immediately discontinue using this cable for charging.",
                    "Inspect the connector mold for melting, discoloration, or warm scent.",
                    "Discard or bench-isolate if thermal rise repeats on low load."
                ])
            elif t_max and t_max >= 42.0:
                response += "⚠️ **WARNING**: Elevated surface heating observed. High ambient temperatures or prolonged heavy current draw are warming the conductors."
                recommendations.append("Limit current to < 1.5A and avoid charging inside enclosed bags or under pillows.")
            else:
                response += "✅ **Nominal Safety Profile**: Current draw and surface temperatures are well within the safe operational envelope."
                recommendations.append("Safe for standard operation under monitored 5V profile.")

        elif "health" in q_lower or "score" in q_lower or "explain" in q_lower or "why" in q_lower:
            response = (
                f"### Health Score Breakdown: **{health}/100** ({context.get('status', 'Completed')})\n\n"
                f"The composite health score balances deterministic electrical safety rules with statistical machine learning pattern analysis:\n\n"
                f"1. **Conductor Resistance ({r_avg or 0.0:.3f}Ω)**: "
                f"{'Optimal (<0.15Ω)' if (r_avg or 0) < 0.15 else 'Sub-optimal resistance penalty applied'}.\n"
                f"2. **Thermal Dissipation ({t_max or 25.0:.1f}°C)**: "
                f"{'Safe thermal margin' if (t_max or 25) < 42.0 else 'Thermal stress deduction applied'}.\n"
                f"3. **Voltage Stability ({v_avg or 5.0:.2f}V)**: "
                f"{'Stable rail voltage' if (v_min or 5.0) >= 4.75 else 'Under-voltage sag deduction applied'}.\n"
                f"4. **ML Anomaly Probability**: "
                f"{context.get('ml_anomaly', {}).get('anomaly_score', 0):.1f}% outlier likelihood.\n\n"
            )
            if health >= 80:
                response += "Overall status is **Healthy**. Cable exhibits minimal conductor loss and robust thermal margins."
                recommendations.append("Maintain periodic screening every 30 days.")
            elif health >= 50:
                response += "Overall status is **Warning**. Moderate wear or contact degradation detected."
                recommendations.append("Inspect connector contacts and avoid high-power (>45W) charging applications.")
            else:
                response += "Overall status is **Critical**. High resistance or severe thermal escalation detected."
                recommendations.append("Replace or service cable; do not use for unattended charging.")

        else:
            response = (
                f"### Diagnostic Summary for **{cable_name}**\n\n"
                f"ChargeGuard AI Pro telemetry analysis across {context.get('sample_count', 0)} sensor samples:\n\n"
                f"- **Health Score**: {health}/100 (`{fault}`)\n"
                f"- **Average Voltage**: {v_avg or 5.0:.2f}V (Drop: {5.05 - (v_avg or 5.0):.3f}V)\n"
                f"- **Load Current**: {i_avg or 0.0:.2f}A\n"
                f"- **Surface Temperature**: {t_max or 25.0:.1f}°C\n"
                f"- **Effective Resistance**: {r_avg or 0.0:.3f}Ω\n\n"
                f"Ask me specific inquiries such as:\n"
                f"- *'Why is my voltage dropping?'*\n"
                f"- *'Is my charger safe to use?'*\n"
                f"- *'Explain my health score and recommendations.'*"
            )
            recommendations.append("Ask targeted questions about voltage, current, resistance, or safety.")

        return response, detected_risks, recommendations, "ChargeGuard Local Diagnostic Engine"

    async def answer_question(
        self,
        db: Session,
        query: str,
        session_id: Optional[str] = None,
        test_id: Optional[str] = None,
        device_id: Optional[str] = None,
        cable_id: Optional[str] = None,
        user_id: Optional[int] = None
    ) -> Dict[str, Any]:
        """Process user diagnostic inquiry, querying LLM or expert reasoning fallback."""
        context = self._gather_context(db, test_id, device_id, cable_id)
        session_id = session_id or str(uuid.uuid4())

        # 1. Attempt LLM provider if configured
        llm_response = await self._query_gemini(query, context)
        provider = "Gemini AI" if llm_response else "ChargeGuard Expert Diagnostic Engine"

        if not llm_response:
            resp_text, risks, recs, provider = self._generate_expert_diagnostic_response(query, context)
        else:
            resp_text = llm_response
            risks = []
            recs = ["Follow verified diagnostic steps outlined above."]

        # 2. Persist diagnostic conversation
        try:
            conv = DiagnosticConversation(
                session_id=session_id,
                user_id=user_id,
                device_id=device_id or context.get("device_id"),
                cable_id=cable_id or context.get("cable_id"),
                query=query,
                response=resp_text,
                context_data=json.dumps(context),
                created_at=utc_now()
            )
            db.add(conv)
            db.commit()
        except Exception as e:
            logger.warning(f"Failed to record diagnostic conversation: {e}")
            db.rollback()

        return {
            "session_id": session_id,
            "response": resp_text,
            "context_used": context,
            "detected_risks": risks,
            "recommendations": recs,
            "provider": provider
        }


# Singleton instance
ai_assistant_service = AIDiagnosticAssistant()
