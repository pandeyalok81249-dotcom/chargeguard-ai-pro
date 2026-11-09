"""Pydantic schemas for request and response validation in ChargeGuard AI Pro."""

from pydantic import BaseModel, Field, field_validator, ConfigDict
from typing import Optional, List, Dict, Any
from datetime import datetime
import math
from app.core.datetime_utils import utc_now

# ==================== DEVICE SCHEMAS ====================
class DeviceBase(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=128)
    connection_mode: str = Field("demo", pattern="^(demo|hardware)$")
    firmware_version: Optional[str] = Field(None, max_length=32)

class DeviceCreate(DeviceBase):
    device_id: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")

class DeviceUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=128)
    connection_mode: Optional[str] = Field(None, pattern="^(demo|hardware)$")
    firmware_version: Optional[str] = None
    online_status: Optional[bool] = None

class DeviceResponse(DeviceBase):
    id: int
    device_id: str
    online_status: bool
    last_seen_at: Optional[datetime] = None
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)

class SerialPortInfo(BaseModel):
    device: str
    description: str
    hwid: str
    is_esp: bool = False

class DeviceHeartbeatRequest(BaseModel):
    device_id: str
    port: Optional[str] = None
    status: str = Field("online", pattern="^(online|offline)$")
    firmware_version: Optional[str] = None
    sensor_status: Optional[Dict[str, str]] = None
    last_error: Optional[str] = None

class DeviceCommandResponse(BaseModel):
    command: Optional[str] = None
    cable_id: Optional[str] = None
    test_id: Optional[str] = None
    reason: Optional[str] = None
    params: Optional[Dict[str, Any]] = None

class BridgeConnectRequest(BaseModel):
    port: Optional[str] = None
    baud: int = 115200
    force_unlock: bool = True
    device_id: Optional[str] = "cg-esp32-001"

class BridgeStatusResponse(BaseModel):
    connected: bool
    port: Optional[str] = None
    baud: int = 115200
    device_id: str = "cg-esp32-001"
    firmware_version: str = "cg-fw-1.2.0"
    sensor_status: Dict[str, str] = Field(default_factory=dict)
    last_seen_at: Optional[str] = None
    last_error: Optional[str] = None
    rx_frame_count: int = 0
    active_test_id: Optional[str] = None



# ==================== CABLE SCHEMAS ====================
class CableBase(BaseModel):
    display_name: str = Field(..., min_length=2, max_length=128)
    connector_type: str = Field(..., min_length=3, max_length=64)
    cable_type: str = Field(..., min_length=2, max_length=64)
    manufacturer_metadata: str = Field(..., min_length=1, max_length=128)
    rated_power_w: Optional[float] = Field(None, ge=0.0, le=240.0)
    rated_current_a: Optional[float] = Field(None, ge=0.0, le=10.0)
    rated_voltage_v: Optional[float] = Field(None, ge=0.0, le=100.0)
    length_m: Optional[float] = Field(None, ge=0.0, le=50.0)
    serial_number: Optional[str] = Field(None, max_length=64)
    purchase_date: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None

class CableCreate(CableBase):
    cable_id: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")

class CableUpdate(BaseModel):
    display_name: Optional[str] = Field(None, min_length=2, max_length=128)
    connector_type: Optional[str] = Field(None, min_length=3, max_length=64)
    cable_type: Optional[str] = Field(None, min_length=2, max_length=64)
    manufacturer_metadata: Optional[str] = Field(None, min_length=1, max_length=128)
    rated_power_w: Optional[float] = Field(None, ge=0.0, le=240.0)
    rated_current_a: Optional[float] = Field(None, ge=0.0, le=10.0)
    rated_voltage_v: Optional[float] = Field(None, ge=0.0, le=100.0)
    length_m: Optional[float] = Field(None, ge=0.0, le=50.0)
    serial_number: Optional[str] = Field(None, max_length=64)
    purchase_date: Optional[str] = Field(None, max_length=32)
    notes: Optional[str] = None

class CableResponse(CableBase):
    id: int
    cable_id: str
    created_at: datetime
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==================== MEASUREMENT INGESTION CONTRACT ====================
class MeasurementIngestContract(BaseModel):
    """
    ESP32 / Bridge Ingestion Contract (Schema Version 1).
    Explicitly handles nullable source voltage.
    """
    schema_version: int = Field(1, description="Schema contract version, currently 1")
    device_id: str = Field(..., min_length=1, max_length=64)
    cable_id: str = Field(..., min_length=1, max_length=64)
    test_id: str = Field(..., min_length=1, max_length=64)
    timestamp: datetime = Field(default_factory=utc_now)
    mode: str = Field("hardware", pattern="^(demo|hardware)$")
    source_voltage_v: Optional[float] = Field(None, description="Source-side voltage in Volts (null if single-ended)")
    sink_voltage_v: Optional[float] = Field(None, description="Sink-side measured voltage in Volts")
    current_a: Optional[float] = Field(None, description="Measured current in Amperes")
    power_w: Optional[float] = Field(None, description="Power in Watts (can be computed or verified)")
    temperature_c: Optional[float] = Field(None, description="Measured cable surface temperature in °C")
    humidity_pct: Optional[float] = Field(None, ge=0.0, le=100.0, description="Ambient or enclosure humidity percentage")
    voltage_stability: Optional[float] = Field(None, description="Voltage stability deviation index")
    fault_status: Optional[str] = Field("NORMAL", description="Current detected fault code")
    measurement_valid: bool = Field(True, description="Sensor health validity flag")
    validity_reason: Optional[str] = Field(None, max_length=256)

    @field_validator("source_voltage_v", "sink_voltage_v", "current_a", "power_w", "temperature_c")
    @classmethod
    def validate_finite_numbers(cls, v):
        if v is not None:
            if math.isnan(v) or math.isinf(v):
                raise ValueError("Measurement value must be a finite number")
        return v

    @field_validator("sink_voltage_v")
    @classmethod
    def validate_sink_voltage_bounds(cls, v):
        if v is not None and (v < 0.0 or v > 25.0):
            raise ValueError(f"Sink voltage {v}V is out of credible physical bounds (0 - 25V)")
        return v

    @field_validator("current_a")
    @classmethod
    def validate_current_bounds(cls, v):
        if v is not None and (v < 0.0 or v > 10.0):
            raise ValueError(f"Current {v}A is out of safe range (0 - 10A)")
        return v

    @field_validator("temperature_c")
    @classmethod
    def validate_temperature_bounds(cls, v):
        if v is not None and (v < -40.0 or v > 125.0):
            raise ValueError(f"Temperature {v}°C is outside valid sensor operational limits (-40 to 125°C)")
        return v


class MeasurementResponse(BaseModel):
    id: int
    test_session_id: int
    timestamp: datetime
    source_voltage_v: Optional[float]
    sink_voltage_v: Optional[float]
    current_a: Optional[float]
    power_w: Optional[float]
    temperature_c: Optional[float]
    humidity_pct: Optional[float] = None
    voltage_drop_v: Optional[float]
    effective_resistance_ohm: Optional[float]
    voltage_stability: Optional[float] = None
    fault_status: str = "NORMAL"
    measurement_valid: bool
    validity_reason: Optional[str]

    model_config = ConfigDict(from_attributes=True)


# ==================== ALERT SCHEMAS ====================
class AlertResponse(BaseModel):
    id: int
    test_session_id: int
    device_id: Optional[str] = None
    category: str = "GENERAL"
    severity: str
    code: str
    message: str
    observed_value: Optional[float]
    threshold_value: Optional[float]
    recommended_action: Optional[str] = None
    resolution_status: str = "active"
    created_at: datetime
    acknowledged_at: Optional[datetime] = None
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class AlertAcknowledgeRequest(BaseModel):
    acknowledged: bool = True

class AlertResolveRequest(BaseModel):
    resolution_notes: Optional[str] = None


# ==================== ANALYSIS RESULT SCHEMAS ====================
class AnalysisResultResponse(BaseModel):
    id: int
    test_session_id: int
    health_score: Optional[float]
    health_category: str
    confidence: Optional[float]
    model_version: str
    explanation: str
    created_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==================== TEST SESSION SCHEMAS ====================
class TestStartRequest(BaseModel):
    device_id: str
    cable_id: str
    mode: str = Field("demo", pattern="^(demo|hardware)$")
    profile_voltage_v: float = Field(5.0, ge=4.5, le=5.5, description="Fixed 5V USB test profile")
    simulated_scenario: Optional[str] = Field("normal", description="Scenario for demo mode: normal, high_resistance, overheating, unstable, single_ended")

class TestStopRequest(BaseModel):
    reason: Optional[str] = "User requested stop"

class TestControlRequest(BaseModel):
    load_current_a: Optional[float] = Field(None, ge=0.1, le=5.0, description="Dynamic target load current in Amperes")
    thermal_stress: Optional[bool] = Field(None, description="Trigger thermal runaway / overheat")
    flex_stress: Optional[bool] = Field(None, description="Trigger cable flexing / contact ripple")
    simulated_scenario: Optional[str] = Field(None, description="Switch simulated scenario dynamically")

class TestSessionResponse(BaseModel):
    id: int
    test_id: str
    device_id: str
    cable_id: str
    mode: str
    profile_voltage_v: float
    started_at: datetime
    ended_at: Optional[datetime]
    status: str
    final_result: Optional[str]
    diagnostic_summary: Optional[str]
    analysis_result: Optional[AnalysisResultResponse] = None
    alerts: List[AlertResponse] = []

    model_config = ConfigDict(from_attributes=True)

class TestSessionSummary(BaseModel):
    id: int
    test_id: str
    device_id: str
    cable_id: str
    cable_name: Optional[str] = None
    mode: str
    started_at: datetime
    ended_at: Optional[datetime]
    status: str
    final_result: Optional[str]
    health_score: Optional[float] = None
    avg_voltage_drop_v: Optional[float] = None
    avg_resistance_ohm: Optional[float] = None
    max_temperature_c: Optional[float] = None
    alert_count: int = 0


# ==================== SETTINGS SCHEMAS ====================
class SettingsSchema(BaseModel):
    profile_voltage_nominal_v: float = 5.0
    voltage_min_warning_v: float = 4.50
    voltage_min_critical_v: float = 4.20
    voltage_max_warning_v: float = 5.30
    voltage_max_critical_v: float = 5.60
    current_max_warning_a: float = 2.40
    current_max_critical_a: float = 3.00
    temperature_warning_c: float = 42.0
    temperature_critical_c: float = 50.0
    resistance_good_max_ohm: float = 0.25
    resistance_warning_max_ohm: float = 0.60
    default_connection_mode: str = "demo"
    sampling_interval_ms: int = 1000
    serial_port: str = "COM3"
    baud_rate: int = 115200

class SettingsUpdate(BaseModel):
    profile_voltage_nominal_v: Optional[float] = Field(None, ge=4.5, le=5.5)
    voltage_min_warning_v: Optional[float] = Field(None, ge=3.5, le=5.0)
    voltage_min_critical_v: Optional[float] = Field(None, ge=3.0, le=4.8)
    voltage_max_warning_v: Optional[float] = Field(None, ge=5.1, le=6.0)
    voltage_max_critical_v: Optional[float] = Field(None, ge=5.3, le=7.0)
    current_max_warning_a: Optional[float] = Field(None, ge=0.5, le=4.0)
    current_max_critical_a: Optional[float] = Field(None, ge=1.0, le=5.0)
    temperature_warning_c: Optional[float] = Field(None, ge=30.0, le=70.0)
    temperature_critical_c: Optional[float] = Field(None, ge=40.0, le=85.0)
    resistance_good_max_ohm: Optional[float] = Field(None, ge=0.05, le=1.0)
    resistance_warning_max_ohm: Optional[float] = Field(None, ge=0.1, le=2.0)
    default_connection_mode: Optional[str] = Field(None, pattern="^(demo|hardware)$")
    sampling_interval_ms: Optional[int] = Field(None, ge=200, le=10000)
    serial_port: Optional[str] = None
    baud_rate: Optional[int] = Field(None, ge=9600, le=921600)


# ==================== DASHBOARD SUMMARY SCHEMAS ====================
class DashboardSummaryResponse(BaseModel):
    total_cables: int
    total_tests: int
    healthy_count: int
    warning_count: int
    critical_count: int
    insufficient_data_count: int
    connected_hardware_devices: int = 0
    active_tests_count: int = 0
    completed_tests_count: int = 0
    avg_health_score: Optional[float] = None
    cables_requiring_attention: int = 0
    active_test: Optional[TestSessionSummary] = None
    latest_completed_test: Optional[TestSessionSummary] = None
    latest_alerts: List[AlertResponse] = []
    recent_activity: List[Dict[str, Any]] = []
    connection_mode: str = "demo"
    current_device_id: Optional[str] = None
    current_device_online: bool = False


# ==================== AUTH SCHEMAS ====================
class UserBase(BaseModel):
    username: str = Field(..., min_length=3, max_length=64, pattern=r"^[a-zA-Z0-9_\-]+$")
    email: str = Field(..., min_length=5, max_length=128)
    full_name: Optional[str] = Field(None, max_length=128)
    role: str = Field("engineer", pattern="^(admin|engineer|viewer)$")

class UserCreate(UserBase):
    password: str = Field(..., min_length=6, max_length=128)

class UserLogin(BaseModel):
    username: str
    password: str

class UserResponse(UserBase):
    id: int
    is_active: bool
    created_at: datetime
    last_login_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)

class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    expires_in: int
    user: UserResponse

class PasswordResetRequest(BaseModel):
    email: str

class PasswordResetConfirm(BaseModel):
    token: str
    new_password: str = Field(..., min_length=6, max_length=128)

class UserProfileUpdate(BaseModel):
    full_name: Optional[str] = None
    email: Optional[str] = None
    current_password: Optional[str] = None
    new_password: Optional[str] = None


# ==================== DEVICE CONFIGURATION SCHEMAS ====================
class DeviceConfigurationBase(BaseModel):
    voltage_divider_ratio: float = 1.0
    acs712_sensitivity_mv_per_a: float = 185.0
    acs712_zero_v_offset: float = 2.50
    temp_offset_c: float = 0.0
    humidity_offset_pct: float = 0.0
    dht_installed: bool = True

class DeviceConfigurationUpdate(BaseModel):
    voltage_divider_ratio: Optional[float] = Field(None, ge=0.1, le=20.0)
    acs712_sensitivity_mv_per_a: Optional[float] = Field(None, ge=10.0, le=500.0)
    acs712_zero_v_offset: Optional[float] = Field(None, ge=1.0, le=4.0)
    temp_offset_c: Optional[float] = Field(None, ge=-20.0, le=20.0)
    humidity_offset_pct: Optional[float] = Field(None, ge=-30.0, le=30.0)
    dht_installed: Optional[bool] = None

class DeviceConfigurationResponse(DeviceConfigurationBase):
    id: int
    device_id: str
    updated_at: datetime

    model_config = ConfigDict(from_attributes=True)


# ==================== MAINTENANCE RECORD SCHEMAS ====================
class MaintenanceRecordCreate(BaseModel):
    device_id: Optional[str] = None
    cable_id: Optional[str] = None
    issue_detected: str = Field(..., min_length=3, max_length=256)
    severity: str = Field("warning", pattern="^(info|warning|critical)$")
    supporting_measurements: Optional[Dict[str, Any]] = None
    possible_causes: Optional[str] = None
    recommended_inspection: Optional[str] = None
    action_taken: Optional[str] = None

class MaintenanceRecordUpdate(BaseModel):
    issue_detected: Optional[str] = None
    severity: Optional[str] = None
    action_taken: Optional[str] = None
    status: Optional[str] = Field(None, pattern="^(pending|in_progress|resolved)$")

class MaintenanceRecordResponse(BaseModel):
    id: int
    device_id: Optional[str]
    cable_id: Optional[str]
    issue_detected: str
    severity: str
    supporting_measurements: Optional[str] = None
    possible_causes: Optional[str] = None
    recommended_inspection: Optional[str] = None
    action_taken: Optional[str] = None
    status: str
    created_at: datetime
    resolved_at: Optional[datetime] = None

    model_config = ConfigDict(from_attributes=True)


# ==================== ML & INTELLIGENCE SCHEMAS ====================
class MLModelMetadataResponse(BaseModel):
    id: int
    model_type: str
    version: str
    algorithm: str
    metrics: Optional[Dict[str, Any]] = None
    parameters: Optional[Dict[str, Any]] = None
    is_active: bool
    trained_at: Optional[datetime] = None
    file_path: Optional[str] = None

    model_config = ConfigDict(from_attributes=True)

class MLAnomalyDetectionResponse(BaseModel):
    is_anomaly: bool
    anomaly_score: float  # 0 to 100, where higher means more anomalous
    confidence: float
    contributing_features: Dict[str, float]
    explanation: str

class MLFaultClassificationResponse(BaseModel):
    predicted_fault: str  # NORMAL, UNDERVOLTAGE, OVERVOLTAGE, OVERCURRENT, OVERHEATING, VOLTAGE_INSTABILITY, CONNECTION_PROBLEM
    confidence: float
    class_probabilities: Dict[str, float]
    rule_fallback_active: bool
    explanation: str

class MLPredictiveMaintenanceResponse(BaseModel):
    degradation_risk_score: float  # 0 to 100
    risk_category: str  # Nominal, Moderate Degradation, Severe Degradation, Critical Wear
    degradation_indicators: Dict[str, Any]
    estimated_remaining_cycles: Optional[int] = None
    confidence: float
    limitations: str

class MLRetrainRequest(BaseModel):
    model_type: str = Field("all", pattern="^(all|anomaly_detection|fault_classification)$")
    sample_size: int = Field(500, ge=50, le=10000)

class MLRetrainResponse(BaseModel):
    status: str
    models_trained: List[str]
    metrics: Dict[str, Any]
    message: str


# ==================== AI ASSISTANT SCHEMAS ====================
class AssistantMessageRequest(BaseModel):
    query: str = Field(..., min_length=2, max_length=2000)
    test_id: Optional[str] = None
    device_id: Optional[str] = None
    cable_id: Optional[str] = None
    session_id: Optional[str] = None

class AssistantMessageResponse(BaseModel):
    session_id: str
    response: str
    context_used: Dict[str, Any]
    detected_risks: List[str]
    recommendations: List[str]
    provider: str

