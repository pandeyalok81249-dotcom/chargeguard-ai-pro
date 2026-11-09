"""Database seeding for initial startup and demo resets."""

from datetime import datetime, timedelta
import json
from sqlalchemy.orm import Session
from app.core.datetime_utils import utc_now

from app.models import (
    Device, DeviceConfiguration, Cable, TestSession, Measurement, Alert, AnalysisResult, User, MaintenanceRecord, MLModelMetadata
)
from app.core.security import hash_password
from app.core.logging import logger

def seed_database(db: Session, force_reset_demo: bool = False):
    """Seed initial demonstration hardware devices, cables, users, and test history."""
    if force_reset_demo:
        logger.info("Purging existing demo test sessions and measurements...")
        # Delete demo sessions (cascade deletes measurements, alerts, analysis_result)
        demo_sessions = db.query(TestSession).filter(TestSession.mode == "demo").all()
        for ds in demo_sessions:
            db.delete(ds)
        db.commit()

    # 0. Seed Users
    admin_user = db.query(User).filter(User.username == "admin").first()
    if not admin_user:
        admin_user = User(
            username="admin",
            email="admin@chargeguard.io",
            full_name="ChargeGuard Chief Engineer",
            hashed_password=hash_password("ChargeGuardAdmin123!"),
            role="admin",
            is_active=True
        )
        db.add(admin_user)

    engineer_user = db.query(User).filter(User.username == "engineer").first()
    if not engineer_user:
        engineer_user = User(
            username="engineer",
            email="engineer@chargeguard.io",
            full_name="Test Bench Operator",
            hashed_password=hash_password("ChargeGuardDev123!"),
            role="engineer",
            is_active=True
        )
        db.add(engineer_user)
    db.commit()

    # 1. Devices & Configurations
    dev_sim = db.query(Device).filter(Device.device_id == "cg-sim-01").first()
    if not dev_sim:
        dev_sim = Device(
            device_id="cg-sim-01",
            display_name="ChargeGuard Demo Simulator",
            connection_mode="demo",
            firmware_version="sim-v1.0",
            online_status=True,
            last_seen_at=utc_now()
        )
        db.add(dev_sim)

    dev_hw = db.query(Device).filter(Device.device_id == "cg-esp32-001").first()
    if not dev_hw:
        dev_hw = Device(
            device_id="cg-esp32-001",
            display_name="ESP32 Lab Rig Bench #1",
            connection_mode="hardware",
            firmware_version="cg-fw-1.2.0",
            online_status=False,
            last_seen_at=None
        )
        db.add(dev_hw)
    db.commit()

    # Configurations
    for dev_id in ["cg-sim-01", "cg-esp32-001"]:
        conf = db.query(DeviceConfiguration).filter(DeviceConfiguration.device_id == dev_id).first()
        if not conf:
            conf = DeviceConfiguration(
                device_id=dev_id,
                voltage_divider_ratio=1.0,
                acs712_sensitivity_mv_per_a=185.0,
                acs712_zero_v_offset=2.50,
                temp_offset_c=0.0,
                humidity_offset_pct=0.0,
                dht_installed=True
            )
            db.add(conf)
    db.commit()

    # Sample Maintenance Records
    m_rec = db.query(MaintenanceRecord).first()
    if not m_rec:
        db.add(MaintenanceRecord(
            device_id="cg-esp32-001",
            cable_id="cable-worn-c2c-04",
            issue_detected="Intermittent Voltage Drop and Contact Resistance Spike",
            severity="warning",
            supporting_measurements=json.dumps({"voltage_drop_v": 0.48, "resistance_ohm": 0.42, "current_a": 1.48}),
            possible_causes="Deformed CC/VBUS connector pins or fraying braided ground sheath.",
            recommended_inspection="Inspect USB-C plug contacts under magnification and clean with contact cleaner spray.",
            action_taken="Scheduled bench pin retention test.",
            status="pending"
        ))
        db.commit()

    # 2. Cables
    cables_data = [
        {
            "cable_id": "cable-anker-c2c-01",
            "display_name": "Anker PowerLine III 60W",
            "connector_type": "USB-C to USB-C",
            "cable_type": "Braided Nylon",
            "manufacturer_metadata": "Anker (User Provided)",
            "rated_power_w": 60.0,
            "rated_current_a": 3.0,
            "notes": "Verified good baseline reference cable. Low resistance."
        },
        {
            "cable_id": "cable-apple-c2c-02",
            "display_name": "Apple Woven USB-C Cable",
            "connector_type": "USB-C to USB-C",
            "cable_type": "Braided Fabric",
            "manufacturer_metadata": "Apple (User Provided)",
            "rated_power_w": 60.0,
            "rated_current_a": 3.0,
            "notes": "Standard OEM MacBook charging cable."
        },
        {
            "cable_id": "cable-generic-a2c-03",
            "display_name": "Generic Thin USB-A to USB-C",
            "connector_type": "USB-A to USB-C",
            "cable_type": "PVC",
            "manufacturer_metadata": "Unbranded (User Provided)",
            "rated_power_w": 15.0,
            "rated_current_a": 2.0,
            "notes": "Suspected high resistance with thin 28AWG power conductors."
        },
        {
            "cable_id": "cable-worn-c2c-04",
            "display_name": "Baseus Desk Cable (Worn)",
            "connector_type": "USB-C to USB-C",
            "cable_type": "TPE",
            "manufacturer_metadata": "Baseus (User Provided)",
            "rated_power_w": 100.0,
            "rated_current_a": 5.0,
            "notes": "Physical wear near plug neck; exhibits intermittent drops."
        }
    ]

    for c in cables_data:
        existing = db.query(Cable).filter(Cable.cable_id == c["cable_id"]).first()
        if not existing:
            new_cable = Cable(
                cable_id=c["cable_id"],
                display_name=c["display_name"],
                connector_type=c["connector_type"],
                cable_type=c["cable_type"],
                manufacturer_metadata=c["manufacturer_metadata"],
                rated_power_w=c["rated_power_w"],
                rated_current_a=c["rated_current_a"],
                notes=c["notes"]
            )
            db.add(new_cable)
    db.commit()

    # 3. Seed historical test sessions if empty
    existing_tests = db.query(TestSession).count()
    if existing_tests == 0 or force_reset_demo:
        now = utc_now()

        # Session 1: Healthy Reference Test
        t1_id = "test-demo-anker-pass"
        t1 = TestSession(
            test_id=t1_id,
            device_id="cg-sim-01",
            cable_id="cable-anker-c2c-01",
            mode="demo",
            profile_voltage_v=5.0,
            started_at=now - timedelta(hours=3),
            ended_at=now - timedelta(hours=2, minutes=58),
            status="completed",
            final_result="healthy",
            diagnostic_summary="Result: Healthy | Health Score: 96.5/100"
        )
        db.add(t1)
        db.flush()

        for step in range(10):
            m_time = t1.started_at + timedelta(seconds=step * 2)
            db.add(Measurement(
                test_session_id=t1.id,
                timestamp=m_time,
                source_voltage_v=5.01,
                sink_voltage_v=4.89,
                current_a=0.96,
                power_w=round(4.89 * 0.96, 3),
                temperature_c=27.2 + (step * 0.1),
                voltage_drop_v=0.12,
                effective_resistance_ohm=round(0.12 / 0.96, 4),
                measurement_valid=True
            ))

        db.add(AnalysisResult(
            test_session_id=t1.id,
            health_score=96.5,
            health_category="Healthy",
            confidence=0.92,
            model_version="rules-v1.0",
            explanation=json.dumps({
                "health_score": 96.5,
                "health_category": "Healthy",
                "rules_evaluated": [
                    {"rule": "THERMAL_SAFETY", "status": "PASS", "observed": "28.1°C", "limit": "< 42.0°C"},
                    {"rule": "VOLTAGE_BOUNDS", "status": "PASS", "observed": "4.89V", "limit": "4.50V - 5.30V"},
                    {"rule": "EFFECTIVE_RESISTANCE", "status": "PASS", "observed": "0.125Ω", "limit": "<= 0.250Ω"}
                ],
                "recommended_actions": ["Cable is in excellent operating condition. Maintain clean contacts."]
            })
        ))

        # Session 2: Warning - High Resistance
        t2_id = "test-demo-generic-warn"
        t2 = TestSession(
            test_id=t2_id,
            device_id="cg-sim-01",
            cable_id="cable-generic-a2c-03",
            mode="demo",
            profile_voltage_v=5.0,
            started_at=now - timedelta(hours=1, minutes=30),
            ended_at=now - timedelta(hours=1, minutes=28),
            status="completed",
            final_result="warning",
            diagnostic_summary="Result: Warning | Health Score: 64.0/100"
        )
        db.add(t2)
        db.flush()

        for step in range(10):
            m_time = t2.started_at + timedelta(seconds=step * 2)
            db.add(Measurement(
                test_session_id=t2.id,
                timestamp=m_time,
                source_voltage_v=5.00,
                sink_voltage_v=4.38,
                current_a=0.94,
                power_w=round(4.38 * 0.94, 3),
                temperature_c=31.5 + (step * 0.2),
                voltage_drop_v=0.62,
                effective_resistance_ohm=round(0.62 / 0.94, 4),
                measurement_valid=True
            ))

        db.add(Alert(
            test_session_id=t2.id,
            severity="warning",
            code="RESISTANCE_EXCESSIVE",
            message="Calculated effective test-path resistance 0.660Ω exceeds threshold (0.60Ω).",
            observed_value=0.660,
            threshold_value=0.600,
            created_at=t2.started_at + timedelta(seconds=4)
        ))

        db.add(AnalysisResult(
            test_session_id=t2.id,
            health_score=64.0,
            health_category="Warning",
            confidence=0.88,
            model_version="rules-v1.0",
            explanation=json.dumps({
                "health_score": 64.0,
                "health_category": "Warning",
                "rules_evaluated": [
                    {"rule": "THERMAL_SAFETY", "status": "PASS", "observed": "33.5°C", "limit": "< 42.0°C"},
                    {"rule": "VOLTAGE_BOUNDS", "status": "WARN", "observed": "4.38V", "limit": ">= 4.50V"},
                    {"rule": "EFFECTIVE_RESISTANCE", "status": "WARN", "observed": "0.660Ω", "limit": "<= 0.600Ω"}
                ],
                "recommended_actions": ["Use with caution for fast charging. Inspect connectors for pin wear."]
            })
        ))

        # Session 3: Critical Overheating Safe Stop
        t3_id = "test-demo-worn-critical"
        t3 = TestSession(
            test_id=t3_id,
            device_id="cg-sim-01",
            cable_id="cable-worn-c2c-04",
            mode="demo",
            profile_voltage_v=5.0,
            started_at=now - timedelta(minutes=45),
            ended_at=now - timedelta(minutes=43),
            status="stopped",
            final_result="critical",
            diagnostic_summary="Safety cutoff: Critical cable surface temperature 52.4°C exceeded safety limit (50.0°C)"
        )
        db.add(t3)
        db.flush()

        for step in range(8):
            temp = 32.0 + (step * 3.0)
            m_time = t3.started_at + timedelta(seconds=step * 2)
            db.add(Measurement(
                test_session_id=t3.id,
                timestamp=m_time,
                source_voltage_v=5.00,
                sink_voltage_v=4.22 - (step * 0.03),
                current_a=1.85,
                power_w=round((4.22 - step * 0.03) * 1.85, 3),
                temperature_c=temp,
                voltage_drop_v=round(5.00 - (4.22 - step * 0.03), 4),
                effective_resistance_ohm=round((5.00 - (4.22 - step * 0.03)) / 1.85, 4),
                measurement_valid=True
            ))

        db.add(Alert(
            test_session_id=t3.id,
            severity="critical",
            code="OVERHEAT_CRITICAL",
            message="Critical overheating detected: 52.4°C (Limit: 50.0°C). Automated safety cutoff triggered.",
            observed_value=52.4,
            threshold_value=50.0,
            created_at=t3.started_at + timedelta(seconds=14)
        ))

        db.add(AnalysisResult(
            test_session_id=t3.id,
            health_score=15.0,
            health_category="Critical",
            confidence=0.91,
            model_version="rules-v1.0",
            explanation=json.dumps({
                "health_score": 15.0,
                "health_category": "Critical",
                "rules_evaluated": [
                    {"rule": "THERMAL_SAFETY", "status": "FAIL", "observed": "52.4°C", "limit": "50.0°C", "action": "Automated safety stop executed."}
                ],
                "recommended_actions": ["Cease using this cable immediately. Risk of connector melting or charge port damage."]
            })
        ))

        # Session 4: Insufficient Data (Single-ended Sink Only)
        t4_id = "test-demo-single-ended"
        t4 = TestSession(
            test_id=t4_id,
            device_id="cg-sim-01",
            cable_id="cable-apple-c2c-02",
            mode="demo",
            profile_voltage_v=5.0,
            started_at=now - timedelta(minutes=15),
            ended_at=now - timedelta(minutes=14),
            status="completed",
            final_result="insufficient_data",
            diagnostic_summary="Result: Insufficient Data | Single-ended measurement (no source reference)"
        )
        db.add(t4)
        db.flush()

        for step in range(5):
            m_time = t4.started_at + timedelta(seconds=step * 2)
            db.add(Measurement(
                test_session_id=t4.id,
                timestamp=m_time,
                source_voltage_v=None,  # Intentionally null
                sink_voltage_v=4.92,
                current_a=0.90,
                power_w=round(4.92 * 0.90, 3),
                temperature_c=26.5 + (step * 0.1),
                voltage_drop_v=None,
                effective_resistance_ohm=None,
                measurement_valid=True
            ))

        db.add(AnalysisResult(
            test_session_id=t4.id,
            health_score=None,
            health_category="Insufficient Data",
            confidence=0.40,
            model_version="rules-v1.0",
            explanation=json.dumps({
                "health_score": None,
                "health_category": "Insufficient Data",
                "reason": "Single-ended measurement: source voltage not measured. Resistance and voltage drop cannot be derived.",
                "rules_evaluated": [
                    {"rule": "SOURCE_VOLTAGE_CHECK", "status": "LIMITED", "description": "Single-ended monitoring only."}
                ],
                "recommended_actions": ["Connect calibrated source-side measurement probe to calculate true cable voltage drop."]
            })
        ))

        db.commit()
        logger.info("Database successfully seeded with demo baseline records.")
