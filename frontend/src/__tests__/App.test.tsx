import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import App from '../App';

// Mock the API client
vi.mock('../api/client', () => ({
  api: {
    getDashboardSummary: vi.fn().mockResolvedValue({
      total_cables: 4,
      total_tests: 12,
      healthy_count: 8,
      warning_count: 3,
      critical_count: 1,
      insufficient_data_count: 0,
      active_test: null,
      latest_completed_test: null,
      latest_alerts: [],
      connection_mode: 'demo',
      current_device_id: 'cg-sim-01',
      current_device_online: true,
    }),
    getTests: vi.fn().mockResolvedValue([]),
    getCables: vi.fn().mockResolvedValue([]),
    getDevices: vi.fn().mockResolvedValue([
      { device_id: 'cg-sim-01', display_name: 'Simulator', connection_mode: 'demo', online_status: true }
    ]),
    getAlerts: vi.fn().mockResolvedValue([]),
    getSettings: vi.fn().mockResolvedValue({
      profile_voltage_nominal_v: 5.0,
      voltage_min_warning_v: 4.5,
      voltage_min_critical_v: 4.2,
      voltage_max_warning_v: 5.3,
      voltage_max_critical_v: 5.6,
      current_max_warning_a: 2.4,
      current_max_critical_a: 3.0,
      temperature_warning_c: 42.0,
      temperature_critical_c: 50.0,
      resistance_good_max_ohm: 0.25,
      resistance_warning_max_ohm: 0.60,
      default_connection_mode: 'demo',
      sampling_interval_ms: 1000,
      serial_port: 'COM3',
      baud_rate: 115200,
    }),
    getExportCsvUrl: vi.fn().mockReturnValue('/api/export/tests.csv'),
    getSingleTestExportCsvUrl: vi.fn().mockReturnValue('/api/export/tests/t1/measurements.csv')
  },
}));

describe('ChargeGuard AI Pro Frontend Smoke & Navigation Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders application branding and sidebar navigation', async () => {
    render(<App />);

    expect(screen.getByText('ChargeGuard')).toBeInTheDocument();
    expect(screen.getByText('PRO')).toBeInTheDocument();
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Live Testing')).toBeInTheDocument();
    expect(screen.getByText('Cable Inventory')).toBeInTheDocument();
    expect(screen.getByText('Test History')).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByText('Health Monitoring Dashboard')).toBeInTheDocument();
    });
  });

  it('displays dashboard KPI metrics loaded from API', async () => {
    render(<App />);

    await waitFor(() => {
      expect(screen.getByText('Health Monitoring Dashboard')).toBeInTheDocument();
      expect(screen.getByText('Registered Cables')).toBeInTheDocument();
      expect(screen.getByText('Tests Run')).toBeInTheDocument();
    });
  });
});
