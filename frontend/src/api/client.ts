import {
  Cable,
  Device,
  TestSession,
  TestSessionSummary,
  Measurement,
  Alert,
  DashboardSummary,
  SystemSettings
} from '../types';

const API_BASE = '/api';

async function fetchJson<T>(url: string, options?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
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
  // Health
  getHealth: () => fetchJson<{ status: string; app: string; version: string }>(`${API_BASE}/health`),

  // Dashboard
  getDashboardSummary: () => fetchJson<DashboardSummary>(`${API_BASE}/dashboard/summary`),

  // Cables
  getCables: (search?: string, connectorType?: string) => {
    const params = new URLSearchParams();
    if (search) params.append('search', search);
    if (connectorType) params.append('connector_type', connectorType);
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
  getTests: (params?: { cable_id?: string; mode?: string; result?: string; status?: string; limit?: number; offset?: number }) => {
    const qs = new URLSearchParams();
    if (params?.cable_id) qs.append('cable_id', params.cable_id);
    if (params?.mode) qs.append('mode', params.mode);
    if (params?.result) qs.append('result', params.result);
    if (params?.status) qs.append('status', params.status);
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
  getExportCsvUrl: (cableId?: string, mode?: string, result?: string) => {
    const qs = new URLSearchParams();
    if (cableId) qs.append('cable_id', cableId);
    if (mode) qs.append('mode', mode);
    if (result) qs.append('result', result);
    const query = qs.toString();
    return `${API_BASE}/export/tests.csv${query ? `?${query}` : ''}`;
  },

  getSingleTestExportCsvUrl: (testId: string) => `${API_BASE}/export/tests/${testId}/measurements.csv`
};
