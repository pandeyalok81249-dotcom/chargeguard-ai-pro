"""CSV export service generating real tabular data from the database."""

import csv
import io
from typing import Optional
from sqlalchemy.orm import Session
from sqlalchemy import String
from app.models import TestSession, Measurement, Cable, Device

def export_tests_to_csv(
    db: Session,
    cable_id: Optional[str] = None,
    mode: Optional[str] = None,
    result_filter: Optional[str] = None,
    date: Optional[str] = None
) -> str:
    """
    Generate CSV content containing actual persisted test session summaries
    and their latest key electrical metrics.
    """
    query = db.query(TestSession).join(Cable, TestSession.cable_id == Cable.cable_id, isouter=True)

    if cable_id:
        query = query.filter(TestSession.cable_id == cable_id)
    if mode:
        query = query.filter(TestSession.mode == mode)
    if result_filter:
        query = query.filter(TestSession.final_result == result_filter)
    if date:
        query = query.filter(TestSession.started_at.cast(String).like(f"{date}%"))

    sessions = query.order_by(TestSession.started_at.desc()).all()

    output = io.StringIO()
    writer = csv.writer(output)

    # Header Row
    writer.writerow([
        "test_id",
        "device_id",
        "cable_id",
        "cable_name",
        "connector_type",
        "mode",
        "profile_voltage_v",
        "started_at_utc",
        "ended_at_utc",
        "status",
        "final_result",
        "health_score",
        "health_category",
        "diagnostic_summary",
        "total_measurements",
        "avg_sink_voltage_v",
        "avg_voltage_drop_v",
        "avg_resistance_ohm",
        "max_temperature_c"
    ])

    for s in sessions:
        cable_name = s.cable.display_name if s.cable else ""
        connector_type = s.cable.connector_type if s.cable else ""

        # Aggregate measurements
        measurements = s.measurements
        total_m = len(measurements)

        valid_m = [m for m in measurements if m.measurement_valid]
        sink_vs = [m.sink_voltage_v for m in valid_m if m.sink_voltage_v is not None]
        v_drops = [m.voltage_drop_v for m in valid_m if m.voltage_drop_v is not None]
        resists = [m.effective_resistance_ohm for m in valid_m if m.effective_resistance_ohm is not None]
        temps = [m.temperature_c for m in valid_m if m.temperature_c is not None]

        avg_sink_v = round(sum(sink_vs) / len(sink_vs), 3) if sink_vs else ""
        avg_v_drop = round(sum(v_drops) / len(v_drops), 4) if v_drops else ""
        avg_resist = round(sum(resists) / len(resists), 4) if resists else ""
        max_temp = round(max(temps), 1) if temps else ""

        health_score = s.analysis_result.health_score if s.analysis_result else ""
        health_cat = s.analysis_result.health_category if s.analysis_result else ""

        writer.writerow([
            s.test_id,
            s.device_id,
            s.cable_id,
            cable_name,
            connector_type,
            s.mode,
            s.profile_voltage_v,
            s.started_at.isoformat() if s.started_at else "",
            s.ended_at.isoformat() if s.ended_at else "",
            s.status,
            s.final_result or "",
            health_score,
            health_cat,
            s.diagnostic_summary or "",
            total_m,
            avg_sink_v,
            avg_v_drop,
            avg_resist,
            max_temp
        ])

    return output.getvalue()


def export_single_test_measurements_csv(db: Session, test_id: str) -> str:
    """Generate detailed time-series CSV for an individual test session."""
    session = db.query(TestSession).filter(TestSession.test_id == test_id).first()
    if not session:
        raise ValueError(f"TestSession {test_id} not found")

    output = io.StringIO()
    writer = csv.writer(output)

    writer.writerow([
        "timestamp_utc",
        "source_voltage_v",
        "sink_voltage_v",
        "current_a",
        "power_w",
        "temperature_c",
        "voltage_drop_v",
        "effective_resistance_ohm",
        "measurement_valid",
        "validity_reason"
    ])

    for m in session.measurements:
        writer.writerow([
            m.timestamp.isoformat(),
            m.source_voltage_v if m.source_voltage_v is not None else "",
            m.sink_voltage_v if m.sink_voltage_v is not None else "",
            m.current_a if m.current_a is not None else "",
            m.power_w if m.power_w is not None else "",
            m.temperature_c if m.temperature_c is not None else "",
            m.voltage_drop_v if m.voltage_drop_v is not None else "",
            m.effective_resistance_ohm if m.effective_resistance_ohm is not None else "",
            m.measurement_valid,
            m.validity_reason or ""
        ])

    return output.getvalue()
