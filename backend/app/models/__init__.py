"""SQLAlchemy models for ChargeGuard AI Pro."""

from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, Float, Boolean, DateTime, ForeignKey, Text, UniqueConstraint
)
from sqlalchemy.orm import relationship
from app.db.database import Base
from app.core.datetime_utils import utc_now

class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_id = Column(String(64), unique=True, nullable=False, index=True)
    display_name = Column(String(128), nullable=False)
    connection_mode = Column(String(32), default="demo", nullable=False)  # "demo" or "hardware"
    firmware_version = Column(String(32), nullable=True)
    online_status = Column(Boolean, default=False, nullable=False)
    last_seen_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)

    test_sessions = relationship("TestSession", back_populates="device", cascade="all, delete-orphan")


class Cable(Base):
    __tablename__ = "cables"

    id = Column(Integer, primary_key=True, index=True)
    cable_id = Column(String(64), unique=True, nullable=False, index=True)
    display_name = Column(String(128), nullable=False)
    connector_type = Column(String(64), nullable=False)  # "USB-C to USB-C", "USB-A to USB-C", etc.
    cable_type = Column(String(64), nullable=False)      # "Braided Nylon", "TPE", "Silicone"
    manufacturer_metadata = Column(String(128), nullable=False)  # "Anker (User Provided)", "Apple", etc.
    rated_power_w = Column(Float, nullable=True)        # 60.0, 100.0, etc.
    rated_current_a = Column(Float, nullable=True)      # 3.0, 5.0, etc.
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)

    test_sessions = relationship("TestSession", back_populates="cable", cascade="all, delete-orphan")


class TestSession(Base):
    __tablename__ = "test_sessions"

    id = Column(Integer, primary_key=True, index=True)
    test_id = Column(String(64), unique=True, nullable=False, index=True)
    device_id = Column(String(64), ForeignKey("devices.device_id", ondelete="CASCADE"), nullable=False, index=True)
    cable_id = Column(String(64), ForeignKey("cables.cable_id", ondelete="CASCADE"), nullable=False, index=True)
    mode = Column(String(32), default="demo", nullable=False)  # "demo" or "hardware"
    profile_voltage_v = Column(Float, default=5.0, nullable=False)
    started_at = Column(DateTime, default=utc_now, nullable=False)
    ended_at = Column(DateTime, nullable=True)
    status = Column(String(32), default="running", nullable=False)  # "pending", "running", "completed", "stopped", "failed"
    final_result = Column(String(32), nullable=True)  # "healthy", "warning", "critical", "insufficient_data"
    diagnostic_summary = Column(Text, nullable=True)

    device = relationship("Device", back_populates="test_sessions")
    cable = relationship("Cable", back_populates="test_sessions")
    measurements = relationship("Measurement", back_populates="test_session", cascade="all, delete-orphan", order_by="Measurement.timestamp")
    alerts = relationship("Alert", back_populates="test_session", cascade="all, delete-orphan", order_by="Alert.created_at")
    analysis_result = relationship("AnalysisResult", back_populates="test_session", uselist=False, cascade="all, delete-orphan")


class Measurement(Base):
    __tablename__ = "measurements"

    id = Column(Integer, primary_key=True, index=True)
    test_session_id = Column(Integer, ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    timestamp = Column(DateTime, default=utc_now, nullable=False, index=True)
    source_voltage_v = Column(Float, nullable=True)
    sink_voltage_v = Column(Float, nullable=True)
    current_a = Column(Float, nullable=True)
    power_w = Column(Float, nullable=True)
    temperature_c = Column(Float, nullable=True)
    voltage_drop_v = Column(Float, nullable=True)
    effective_resistance_ohm = Column(Float, nullable=True)
    measurement_valid = Column(Boolean, default=True, nullable=False)
    validity_reason = Column(String(256), nullable=True)

    test_session = relationship("TestSession", back_populates="measurements")


class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    test_session_id = Column(Integer, ForeignKey("test_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    severity = Column(String(16), nullable=False)  # "info", "warning", "critical"
    code = Column(String(64), nullable=False)
    message = Column(String(256), nullable=False)
    observed_value = Column(Float, nullable=True)
    threshold_value = Column(Float, nullable=True)
    created_at = Column(DateTime, default=utc_now, nullable=False)
    acknowledged_at = Column(DateTime, nullable=True)

    test_session = relationship("TestSession", back_populates="alerts")


class AnalysisResult(Base):
    __tablename__ = "analysis_results"

    id = Column(Integer, primary_key=True, index=True)
    test_session_id = Column(Integer, ForeignKey("test_sessions.id", ondelete="CASCADE"), unique=True, nullable=False, index=True)
    health_score = Column(Float, nullable=True)  # 0 to 100, or null
    health_category = Column(String(32), nullable=False)  # "Healthy", "Warning", "Critical", "Insufficient Data"
    confidence = Column(Float, nullable=True)  # 0.0 to 1.0
    model_version = Column(String(64), default="rules-v1.0", nullable=False)
    explanation = Column(Text, nullable=False)  # JSON formatted explanation details
    created_at = Column(DateTime, default=utc_now, nullable=False)

    test_session = relationship("TestSession", back_populates="analysis_result")


class SystemSetting(Base):
    __tablename__ = "system_settings"

    id = Column(Integer, primary_key=True, index=True)
    key = Column(String(64), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=False)
    updated_at = Column(DateTime, default=utc_now, onupdate=utc_now, nullable=False)
