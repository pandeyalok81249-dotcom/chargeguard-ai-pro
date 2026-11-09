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
  active_test?: TestSessionSummary | null;
  latest_completed_test?: TestSessionSummary | null;
  latest_alerts: Alert[];
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
