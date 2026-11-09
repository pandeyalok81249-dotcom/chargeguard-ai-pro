import {
  Cable,
  Device,
  TestSession,
  TestSessionSummary,
  Measurement,
  Alert,
  DashboardSummary,
  SystemSettings,
  SerialPortInfo,
  BridgeStatus,
  User,
  AuthResponse,
  UserProfileUpdate,
  DeviceConfiguration,
  DeviceConfigurationUpdate,
  MLModelMetadata,
  MLAnomalyDetectionResponse,
  MLFaultClassificationResponse,
  MLPredictiveMaintenanceResponse,
  MLRetrainResponse,
  MaintenanceRecommendation,
  MaintenanceRecord,
  AssistantMessageResponse,
  DiagnosticConversationRecord
} from '../types';

const API_BASE = '/api';

function getAuthHeader(): Record<string, string> {
  const token = localStorage.getItem('chargeguard_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const headers = {
    'Content-Type': 'application/json',
    ...getAuthHeader(),
    ...options?.headers,
  };

  const res = await fetch(url, {
    ...options,
    headers,
  });

  if (!res.ok) {
    let errorDetail = res.statusText;
    try {
      const err = await res.json();
      errorDetail = err.detail || errorDetail;
    } catch {
      // Use statusText
    }
    throw new Error(errorDetail);
  }

  if (res.status === 204) {
    return {} as T;
  }

  return res.json();
}

export const api = {
  // Authentication
  login: (formData: FormData | URLSearchParams) =>
    fetchJson<AuthResponse>(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: formData.toString(),
    }),

  register: (payload: { email: string; password: string; full_name: string; role?: string }) =>
    fetchJson<User>(`${API_BASE}/auth/register`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getMe: () => fetchJson<User>(`${API_BASE}/auth/me`),

  updateProfile: (payload: UserProfileUpdate) =>
    fetchJson<User>(`${API_BASE}/auth/profile`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    }),

  forgotPassword: (email: string) =>
    fetchJson<{ message: string; simulated_token?: string }>(`${API_BASE}/auth/forgot-password`, {
      method: 'POST',
      body: JSON.stringify({ email }),
    }),

  resetPassword: (payload: { token: string; new_password: string }) =>
    fetchJson<{ message: string }>(`${API_BASE}/auth/reset-password`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  // Health
  getHealth: () => fetchJson<{ status: string; app: string; version: string }>(`${API_BASE}/health`),

  // Dashboard
  getDashboardSummary: () => fetchJson<DashboardSummary>(`${API_BASE}/dashboard/summary`),

  // Device Calibration & Configuration
  getDeviceConfig: (deviceId: string) =>
    fetchJson<DeviceConfiguration>(`${API_BASE}/devices/${deviceId}/config`),

  updateDeviceConfig: (deviceId: string, data: DeviceConfigurationUpdate) =>
    fetchJson<DeviceConfiguration>(`${API_BASE}/devices/${deviceId}/config`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  // Machine Learning
  getMLModels: () => fetchJson<MLModelMetadata[]>(`${API_BASE}/ml/models`),

  runAnomalyDetection: (testId?: string) => {
    const qs = testId ? `?test_id=${encodeURIComponent(testId)}` : '';
    return fetchJson<MLAnomalyDetectionResponse>(`${API_BASE}/ml/anomaly-detect${qs}`, {
      method: 'POST',
    });
  },

  classifyFault: (testId?: string) => {
    const qs = testId ? `?test_id=${encodeURIComponent(testId)}` : '';
    return fetchJson<MLFaultClassificationResponse>(`${API_BASE}/ml/classify-fault${qs}`, {
      method: 'POST',
    });
  },

  getPredictiveMaintenance: (cableId?: string) => {
    const qs = cableId ? `?cable_id=${encodeURIComponent(cableId)}` : '';
    return fetchJson<MLPredictiveMaintenanceResponse>(`${API_BASE}/ml/predictive-maintenance${qs}`, {
      method: 'POST',
    });
  },

  retrainML: (modelType: string = 'all', sampleSize: number = 500) =>
    fetchJson<MLRetrainResponse>(`${API_BASE}/ml/retrain`, {
      method: 'POST',
      body: JSON.stringify({ model_type: modelType, sample_size: sampleSize }),
    }),

  // AI Diagnostic Assistant
  askAssistant: (payload: {
    query: string;
    test_id?: string;
    device_id?: string;
    cable_id?: string;
    session_id?: string;
  }) =>
    fetchJson<AssistantMessageResponse>(`${API_BASE}/assistant/chat`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  getAssistantHistory: (sessionId?: string) => {
    const qs = sessionId ? `?session_id=${encodeURIComponent(sessionId)}` : '';
    return fetchJson<DiagnosticConversationRecord[]>(`${API_BASE}/assistant/history${qs}`);
  },

  // Maintenance Center
  getMaintenanceRecommendations: () =>
    fetchJson<MaintenanceRecommendation[]>(`${API_BASE}/maintenance/recommendations`),

  getMaintenanceRecords: (cableId?: string, resolved?: boolean) => {
    const qs = new URLSearchParams();
    if (cableId) qs.append('cable_id', cableId);
    if (resolved !== undefined) qs.append('resolved', resolved.toString());
    const query = qs.toString();
    return fetchJson<MaintenanceRecord[]>(`${API_BASE}/maintenance/records${query ? `?${query}` : ''}`);
  },

  createMaintenanceRecord: (payload: {
    cable_id: string;
    action_type: string;
    notes: string;
    performed_by?: string;
  }) =>
    fetchJson<MaintenanceRecord>(`${API_BASE}/maintenance/records`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  resolveMaintenanceRecord: (recordId: number) =>
    fetchJson<MaintenanceRecord>(`${API_BASE}/maintenance/records/${recordId}/resolve`, {
      method: 'PUT',
    }),

  // Cables
  getCables: (search?: string, connectorType?: string, sortBy?: string, sortOrder?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (connectorType) params.append('connector_type', connectorType);
    if (sortBy) params.append('sort_by', sortBy);
    if (sortOrder) params.append('sort_order', sortOrder);
    const qs = params.toString();
    return fetchJson<Cable[]>(`${API_BASE}/cables${qs ? `?${qs}` : ''}`);
  },

  getCable: (cableId: string) => fetchJson<Cable>(`${API_BASE}/cables/${cableId}`),

  createCable: (data: Partial<Cable>) =>
    fetchJson<Cable>(`${API_BASE}/cables`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateCable: (cableId: string, data: Partial<Cable>) =>
    fetchJson<Cable>(`${API_BASE}/cables/${cableId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteCable: (cableId: string) =>
    fetchJson<void>(`${API_BASE}/cables/${cableId}`, {
      method: 'DELETE',
    }),

  // Devices
  getDevices: () => fetchJson<Device[]>(`${API_BASE}/devices`),
  getSerialPorts: () => fetchJson<SerialPortInfo[]>(`${API_BASE}/devices/ports`),

  connectBridge: (port?: string, baud?: number, forceUnlock: boolean = true) =>
    fetchJson<BridgeStatus>(`${API_BASE}/devices/bridge/connect`, {
      method: 'POST',
      body: JSON.stringify({ port, baud: baud || 115200, force_unlock: forceUnlock }),
    }),

  disconnectBridge: () =>
    fetchJson<BridgeStatus>(`${API_BASE}/devices/bridge/disconnect`, {
      method: 'POST',
    }),

  getBridgeStatus: () => fetchJson<BridgeStatus>(`${API_BASE}/devices/bridge/status`),

  createDevice: (data: Partial<Device>) =>
    fetchJson<Device>(`${API_BASE}/devices`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  updateDevice: (deviceId: string, data: Partial<Device>) =>
    fetchJson<Device>(`${API_BASE}/devices/${deviceId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  deleteDevice: (deviceId: string) =>
    fetchJson<void>(`${API_BASE}/devices/${deviceId}`, {
      method: 'DELETE',
    }),

  // Tests
  getTests: (params?: { cable_id?: string; mode?: string; result?: string; status?: string; date?: string; sort_order?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.cable_id) qs.append('cable_id', params.cable_id);
    if (params?.mode) qs.append('mode', params.mode);
    if (params?.result) qs.append('result', params.result);
    if (params?.status) qs.append('status', params.status);
    if (params?.date) qs.append('date', params.date);
    if (params?.sort_order) qs.append('sort_order', params.sort_order);
    if (params?.limit) qs.append('limit', params.limit.toString());
    if (params?.offset) qs.append('offset', params.offset.toString());
    const query = qs.toString();
    return fetchJson<TestSessionSummary[]>(`${API_BASE}/tests${query ? `?${query}` : ''}`);
  },

  getTest: (testId: string) => fetchJson<TestSession>(`${API_BASE}/tests/${testId}`),

  getTestMeasurements: (testId: string) => fetchJson<Measurement[]>(`${API_BASE}/tests/${testId}/measurements`),

  getTestReport: (testId: string) => fetchJson<any>(`${API_BASE}/tests/${testId}/report`),

  startTest: (payload: { device_id: string; cable_id: string; mode: string; profile_voltage_v?: number; simulated_scenario?: string }) =>
    fetchJson<TestSession>(`${API_BASE}/tests/start`, {
      method: 'POST',
      body: JSON.stringify(payload),
    }),

  stopTest: (testId: string, reason?: string) =>
    fetchJson<TestSession>(`${API_BASE}/tests/${testId}/stop`, {
      method: 'POST',
      body: JSON.stringify({ reason: reason || 'User requested stop' }),
    }),

  controlTest: (testId: string, controls: { load_current_a?: number; thermal_stress?: boolean; flex_stress?: boolean; simulated_scenario?: string }) =>
    fetchJson<{ status: string; test_id: string; controls: any }>(`${API_BASE}/tests/${testId}/control`, {
      method: 'POST',
      body: JSON.stringify(controls),
    }),

  // Alerts
  getAlerts: (params?: { severity?: string; unacknowledged_only?: boolean; test_id?: string; limit?: number }) => {
    const qs = new URLSearchParams();
    if (params?.severity) qs.append('severity', params.severity);
    if (params?.unacknowledged_only) qs.append('unacknowledged_only', 'true');
    if (params?.test_id) qs.append('test_id', params.test_id);
    if (params?.limit) qs.append('limit', params.limit.toString());
    const query = qs.toString();
    return fetchJson<Alert[]>(`${API_BASE}/alerts${query ? `?${query}` : ''}`);
  },

  acknowledgeAlert: (alertId: number) =>
    fetchJson<Alert>(`${API_BASE}/alerts/${alertId}/acknowledge`, {
      method: 'POST',
      body: JSON.stringify({ acknowledged: true }),
    }),

  // Settings
  getSettings: () => fetchJson<SystemSettings>(`${API_BASE}/settings`),

  updateSettings: (data: Partial<SystemSettings>) =>
    fetchJson<SystemSettings>(`${API_BASE}/settings`, {
      method: 'PUT',
      body: JSON.stringify(data),
    }),

  resetDemoData: () =>
    fetchJson<{ status: string; message: string }>(`${API_BASE}/settings/reset-demo`, {
      method: 'POST',
    }),

  // CSV Export URL builder
  getExportCsvUrl: (cableId?: string, mode?: string, result?: string, date?: string) => {
    const qs = new URLSearchParams();
    if (cableId) qs.append('cable_id', cableId);
    if (mode) qs.append('mode', mode);
    if (result) qs.append('result', result);
    if (date) qs.append('date', date);
    const query = qs.toString();
    return `${API_BASE}/export/tests.csv${query ? `?${query}` : ''}`;
  },

  getSingleTestExportCsvUrl: (testId: string) => `${API_BASE}/export/tests/${testId}/measurements.csv`,
  getTestReportPdfUrl: (testId: string) => `${API_BASE}/export/tests/${testId}/report.pdf`
};
