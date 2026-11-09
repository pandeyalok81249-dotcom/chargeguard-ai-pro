export interface Device {
  id: number;
  device_id: string;
  display_name: string;
  connection_mode: 'demo' | 'hardware';
  firmware_version?: string | null;
  online_status: boolean;
  last_seen_at?: string | null;
  created_at: string;
}

export interface Cable {
  id: number;
  cable_id: string;
  display_name: string;
  connector_type: string;
  cable_type: string;
  manufacturer_metadata: string;
  rated_power_w?: number | null;
  rated_current_a?: number | null;
  rated_voltage_v?: number | null;
  length_m?: number | null;
  serial_number?: string | null;
  purchase_date?: string | null;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Measurement {
  id?: number;
  test_session_id?: number;
  timestamp: string;
  source_voltage_v?: number | null;
  sink_voltage_v?: number | null;
  current_a?: number | null;
  power_w?: number | null;
  temperature_c?: number | null;
  voltage_drop_v?: number | null;
  effective_resistance_ohm?: number | null;
  measurement_valid: boolean;
  validity_reason?: string | null;
}

export interface Alert {
  id: number;
  test_session_id: number;
  severity: 'info' | 'warning' | 'critical';
  code: string;
  message: string;
  observed_value?: number | null;
  threshold_value?: number | null;
  created_at: string;
  acknowledged_at?: string | null;
}

export interface AnalysisResult {
  id?: number;
  test_session_id: number;
  health_score?: number | null;
  health_category: 'Healthy' | 'Warning' | 'Critical' | 'Insufficient Data';
  confidence?: number | null;
  model_version: string;
  explanation: string;
  created_at: string;
}

export interface TestSession {
  id: number;
  test_id: string;
  device_id: string;
  cable_id: string;
  cable_name?: string | null;
  mode: 'demo' | 'hardware';
  profile_voltage_v: number;
  started_at: string;
  ended_at?: string | null;
  status: 'pending' | 'running' | 'completed' | 'stopped' | 'failed';
  final_result?: 'healthy' | 'warning' | 'critical' | 'insufficient_data' | null;
  diagnostic_summary?: string | null;
  analysis_result?: AnalysisResult | null;
  alerts?: Alert[];
}

export interface TestSessionSummary {
  id: number;
  test_id: string;
  device_id: string;
  cable_id: string;
  cable_name?: string | null;
  mode: 'demo' | 'hardware';
  started_at: string;
  ended_at?: string | null;
  status: string;
  final_result?: string | null;
  health_score?: number | null;
  avg_voltage_drop_v?: number | null;
  avg_resistance_ohm?: number | null;
  max_temperature_c?: number | null;
  alert_count: number;
}

export interface DashboardSummary {
  total_cables: number;
  total_tests: number;
  healthy_count: number;
  warning_count: number;
  critical_count: number;
  insufficient_data_count: number;
  connected_hardware_devices?: number;
  active_tests_count?: number;
  completed_tests_count?: number;
  avg_health_score?: number | null;
  cables_requiring_attention?: number;
  active_test?: TestSessionSummary | null;
  latest_completed_test?: TestSessionSummary | null;
  latest_alerts: Alert[];
  recent_activity?: Array<{
    type: string;
    title: string;
    description: string;
    severity: string;
    timestamp?: string | null;
  }>;
  connection_mode: 'demo' | 'hardware';
  current_device_id?: string | null;
  current_device_online: boolean;
}

export interface SystemSettings {
  profile_voltage_nominal_v: number;
  voltage_min_warning_v: number;
  voltage_min_critical_v: number;
  voltage_max_warning_v: number;
  voltage_max_critical_v: number;
  current_max_warning_a: number;
  current_max_critical_a: number;
  temperature_warning_c: number;
  temperature_critical_c: number;
  resistance_good_max_ohm: number;
  resistance_warning_max_ohm: number;
  default_connection_mode: 'demo' | 'hardware';
  sampling_interval_ms: number;
  serial_port: string;
  baud_rate: number;
}

export interface SerialPortInfo {
  device: string;
  description: string;
  hwid: string;
  is_esp: boolean;
}

export interface DeviceStatusPayload {
  device_id: string;
  online_status: boolean;
  last_seen_at?: string | null;
  port?: string | null;
  sensor_status?: Record<string, string> | null;
  last_error?: string | null;
  firmware_version?: string | null;
}

export interface BridgeStatus {
  connected: boolean;
  port?: string | null;
  baud: number;
  device_id: string;
  firmware_version: string;
  sensor_status: Record<string, string>;
  last_seen_at?: string | null;
  last_error?: string | null;
  rx_frame_count: number;
  active_test_id?: string | null;
}

// ==================== AUTHENTICATION & USER ====================
export interface User {
  id: number;
  email: string;
  full_name: string;
  role: 'admin' | 'engineer' | 'operator' | 'viewer';
  is_active: boolean;
  created_at: string;
  last_login_at?: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface UserProfileUpdate {
  full_name?: string;
  email?: string;
}

// ==================== SENSOR CALIBRATION CONFIG ====================
export interface DeviceConfiguration {
  id: number;
  device_id: string;
  voltage_divider_ratio: number;
  acs712_sensitivity_mv_per_a: number;
  acs712_zero_v_offset: number;
  temp_offset_c: number;
  humidity_offset_pct: number;
  dht_installed: boolean;
  notes?: string | null;
  created_at: string;
  updated_at: string;
}

export interface DeviceConfigurationUpdate {
  voltage_divider_ratio?: number;
  acs712_sensitivity_mv_per_a?: number;
  acs712_zero_v_offset?: number;
  temp_offset_c?: number;
  humidity_offset_pct?: number;
  dht_installed?: boolean;
  notes?: string | null;
}

// ==================== MACHINE LEARNING ====================
export interface MLModelMetadata {
  id: number;
  model_type: string;
  version: string;
  algorithm: string;
  metrics?: Record<string, any> | null;
  parameters?: Record<string, any> | null;
  is_active: boolean;
  trained_at?: string | null;
  file_path?: string | null;
}

export interface MLAnomalyDetectionResponse {
  is_anomaly: boolean;
  anomaly_score: number;
  confidence: number;
  contributing_features: Record<string, number>;
  explanation: string;
}

export interface MLFaultClassificationResponse {
  predicted_fault: string;
  confidence: number;
  class_probabilities: Record<string, number>;
  rule_fallback_active: boolean;
  explanation: string;
}

export interface MLPredictiveMaintenanceResponse {
  degradation_risk_score: number;
  risk_category: string;
  degradation_indicators: {
    resistance_growth_pct?: number;
    thermal_rise_rate?: number;
    voltage_stability_variance?: number;
    cycle_stress_factor?: number;
    [key: string]: any;
  };
  estimated_remaining_cycles?: number | null;
  confidence: number;
  limitations: string;
}

export interface MLRetrainResponse {
  status: string;
  models_trained: string[];
  metrics: Record<string, any>;
  message: string;
}

// ==================== MAINTENANCE CENTER ====================
export interface MaintenanceRecommendation {
  id: string;
  cable_id: string;
  cable_name: string;
  category: 'cleaning' | 'contact_inspection' | 'strain_relief' | 'retire' | 'thermal_remediation';
  priority: 'low' | 'medium' | 'high' | 'immediate';
  title: string;
  action_needed: string;
  rationale: string;
  observed_metric: string;
}

export interface MaintenanceRecord {
  id: number;
  cable_id: string;
  performed_by: string;
  action_type: 'cleaning' | 'connector_repair' | 'strain_relief_replacement' | 'quarantine' | 'decommission' | 'inspection_pass';
  notes: string;
  resolved: boolean;
  created_at: string;
  resolved_at?: string | null;
}

// ==================== AI ASSISTANT ====================
export interface AssistantMessageResponse {
  session_id: string;
  response: string;
  context_used: Record<string, any>;
  detected_risks: string[];
  recommendations: string[];
  provider: string;
}

export interface DiagnosticConversationRecord {
  id: number;
  session_id: string;
  user_query: string;
  assistant_response: string;
  context_summary?: string | null;
  created_at: string;
}
