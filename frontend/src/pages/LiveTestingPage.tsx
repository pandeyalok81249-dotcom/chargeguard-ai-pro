import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Play,
  Square,
  Zap,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Thermometer,
  Layers,
  Radio,
  FileText,
  Activity,
  CheckCircle,
  XCircle,
  Clock
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer
} from 'recharts';

import { api } from '../api/client';
import { Cable, Device, DashboardSummary } from '../types';
import { LiveTelemetryPayload } from '../hooks/useWebSocket';

interface TestingContext {
  summary: DashboardSummary | null;
  onRefreshSummary: () => void;
  latestTelemetry: LiveTelemetryPayload | null;
  wsConnected: boolean;
}

export const LiveTestingPage: React.FC = () => {
  const { summary, onRefreshSummary, latestTelemetry, wsConnected } = useOutletContext<TestingContext>();
  const navigate = useNavigate();

  const [cables, setCables] = useState<Cable[]>([]);
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedCableId, setSelectedCableId] = useState<string>('');
  const [selectedDeviceId, setSelectedDeviceId] = useState<string>('');
  const [testMode, setTestMode] = useState<'demo' | 'hardware'>('demo');
  const [simScenario, setSimScenario] = useState<string>('normal');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [chartData, setChartData] = useState<any[]>([]);

  // Active test ID if a test is ongoing
  const activeTest = summary?.active_test;
  const isRunning = activeTest != null;

  // Load cables & devices
  useEffect(() => {
    api.getCables()
      .then((data) => {
        setCables(data);
        if (data.length > 0 && !selectedCableId) {
          setSelectedCableId(data[0].cable_id);
        }
      })
      .catch((err) => console.error('Error fetching cables:', err));

    api.getDevices()
      .then((data) => {
        setDevices(data);
        // Default device based on mode
        const defaultDev = data.find((d) => d.connection_mode === testMode) || data[0];
        if (defaultDev) {
          setSelectedDeviceId(defaultDev.device_id);
        }
      })
      .catch((err) => console.error('Error fetching devices:', err));
  }, [testMode]);

  // Append incoming telemetry to chart
  useEffect(() => {
    if (latestTelemetry && isRunning) {
      setChartData((prev) => {
        const timeLabel = new Date(latestTelemetry.timestamp).toLocaleTimeString();
        const pt = {
          time: timeLabel,
          sinkVoltage: latestTelemetry.sink_voltage_v ?? 0,
          sourceVoltage: latestTelemetry.source_voltage_v ?? null,
          current: latestTelemetry.current_a ?? 0,
          temperature: latestTelemetry.temperature_c ?? 0,
          resistance: latestTelemetry.effective_resistance_ohm ?? null,
        };
        const updated = [...prev, pt];
        return updated.slice(-30);
      });
    }
  }, [latestTelemetry, isRunning]);

  const handleStartTest = async () => {
    if (!selectedCableId || !selectedDeviceId) {
      setErrorMessage('Please select both a cable and a device.');
      return;
    }
    setErrorMessage(null);
    setIsSubmitting(true);
    setChartData([]);

    try {
      await api.startTest({
        device_id: selectedDeviceId,
        cable_id: selectedCableId,
        mode: testMode,
        profile_voltage_v: 5.0,
        simulated_scenario: testMode === 'demo' ? simScenario : undefined,
      });
      onRefreshSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start test');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStopTest = async () => {
    if (!activeTest) return;
    setIsSubmitting(true);
    try {
      await api.stopTest(activeTest.test_id, 'User clicked stop in test cockpit');
      onRefreshSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to stop test');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Find selected hardware device to verify online status
  const currentDev = devices.find((d) => d.device_id === selectedDeviceId);
  const isHardwareOffline = testMode === 'hardware' && (!currentDev || !currentDev.online_status);

  // Derived telemetry metrics
  const liveSinkV = latestTelemetry?.sink_voltage_v ?? 0;
  const liveSourceV = latestTelemetry?.source_voltage_v ?? null;
  const liveCurrent = latestTelemetry?.current_a ?? 0;
  const livePower = latestTelemetry?.power_w ?? 0;
  const liveTemp = latestTelemetry?.temperature_c ?? 0;
  const liveDrop = latestTelemetry?.voltage_drop_v ?? null;
  const liveResist = latestTelemetry?.effective_resistance_ohm ?? null;
  const isPaired = liveSourceV != null && liveSinkV > 0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Test Cockpit & Sensor Stream</span>
            {testMode === 'demo' ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                DEMO SIMULATION
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ESP32 HARDWARE RIG
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Execute controlled 5.0 V electrical tests, verify differential voltage drop, and monitor thermal stability.
          </p>
        </div>

        {/* View Report if recent test ended */}
        {latestTelemetry && !isRunning && (
          <button
            onClick={() => navigate(`/report/${latestTelemetry.test_id}`)}
            className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>View Finished Test Report</span>
          </button>
        )}
      </div>

      {/* Error / Alert Notice */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold text-xs">
            Dismiss
          </button>
        </div>
      )}

      {/* Safety Cutoff Notice if test was auto-stopped */}
      {latestTelemetry?.session_status === 'stopped' && (
        <div className="p-4 rounded-xl bg-rose-950/60 border border-rose-800 text-rose-100 space-y-1">
          <div className="flex items-center space-x-2 font-bold text-sm text-rose-300">
            <AlertOctagon className="w-5 h-5 text-rose-400" />
            <span>Automated Safety Cutoff Executed</span>
          </div>
          <p className="text-xs text-rose-200">
            The safety diagnostic engine or ESP32 firmware disconnected the load switch due to critical threshold breach. Check thermal contacts and resistance metrics.
          </p>
        </div>
      )}

      {/* Configuration & Controls Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Test Setup Form */}
        <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Layers className="w-4 h-4 text-cyan-400" />
              <span>Test Configuration</span>
            </h3>
            <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
              Profile: 5.0 V DC Fixed
            </span>
          </div>

          {/* Mode Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Test Execution Mode</label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setTestMode('demo')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                  testMode === 'demo'
                    ? 'bg-blue-950/80 border-blue-600 text-blue-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>Demo (Simulator)</span>
              </button>
              <button
                type="button"
                disabled={isRunning}
                onClick={() => setTestMode('hardware')}
                className={`py-2 px-3 rounded-lg text-xs font-semibold flex items-center justify-center gap-1.5 border cursor-pointer transition-colors ${
                  testMode === 'hardware'
                    ? 'bg-emerald-950/80 border-emerald-600 text-emerald-200'
                    : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
                } ${isRunning ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                <span>Hardware Rig</span>
              </button>
            </div>
          </div>

          {/* Cable Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Cable Under Test</label>
            <select
              disabled={isRunning}
              value={selectedCableId}
              onChange={(e) => setSelectedCableId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            >
              {cables.map((c) => (
                <option key={c.cable_id} value={c.cable_id}>
                  {c.display_name} ({c.connector_type})
                </option>
              ))}
            </select>
          </div>

          {/* Device Picker */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-slate-300">Device Interface</label>
            <select
              disabled={isRunning}
              value={selectedDeviceId}
              onChange={(e) => setSelectedDeviceId(e.target.value)}
              className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-100 focus:outline-none focus:border-cyan-500 disabled:opacity-50"
            >
              {devices
                .filter((d) => d.connection_mode === testMode)
                .map((d) => (
                  <option key={d.device_id} value={d.device_id}>
                    {d.display_name} [{d.online_status ? 'ONLINE' : 'OFFLINE'}]
                  </option>
                ))}
            </select>
          </div>

          {/* Demo Scenario Picker (when Demo mode is active) */}
          {testMode === 'demo' && (
            <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
              <label className="text-xs font-medium text-cyan-300 flex items-center justify-between">
                <span>Simulated Scenario</span>
                <span className="text-[10px] text-slate-400">Reproducible profiles</span>
              </label>
              <select
                disabled={isRunning}
                value={simScenario}
                onChange={(e) => setSimScenario(e.target.value)}
                className="w-full bg-slate-900 border border-cyan-800/40 rounded-lg px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
              >
                <option value="normal">Normal Cable (Healthy 0.12Ω drop, 28°C)</option>
                <option value="high_resistance">High Resistance Sag (Warning 0.68Ω, 4.35V)</option>
                <option value="overheating">Overheating Thermal Runaway (Triggers &gt;50°C Cutoff)</option>
                <option value="unstable">Contact Bounce / Jitter (&gt;0.15V ripple)</option>
                <option value="single_ended">Single-ended Sink-Only (No source reference)</option>
              </select>
            </div>
          )}

          {/* Start / Stop Controls */}
          <div className="pt-3 border-t border-slate-800">
            {!isRunning ? (
              <button
                type="button"
                disabled={isSubmitting || isHardwareOffline}
                onClick={handleStartTest}
                className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm ${
                  isHardwareOffline
                    ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                    : 'bg-cyan-600 hover:bg-cyan-500 text-white cursor-pointer shadow-cyan-950'
                }`}
              >
                <Play className="w-4 h-4 fill-current" />
                <span>START CONTROLLED TEST</span>
              </button>
            ) : (
              <button
                type="button"
                disabled={isSubmitting}
                onClick={handleStopTest}
                className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-sm shadow-rose-950 animate-pulse"
              >
                <Square className="w-4 h-4 fill-current" />
                <span>STOP / TERMINATE TEST</span>
              </button>
            )}

            {isHardwareOffline && (
              <p className="text-[11px] text-amber-400 mt-2 text-center leading-snug">
                Hardware rig is offline. Start the Python serial bridge on port COM3 or switch to Demo mode.
              </p>
            )}
          </div>
        </div>

        {/* Right: Live Telemetry Gauges & Sensor Status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Live Telemetry Cockpit</h3>
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-slate-400">
                  Status:{' '}
                  <span
                    className={`font-semibold ${
                      isRunning ? 'text-cyan-400 animate-pulse' : 'text-slate-300'
                    }`}
                  >
                    {isRunning ? 'TEST IN PROGRESS' : 'IDLE / READY'}
                  </span>
                </span>
              </div>
            </div>

            {/* Gauges Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Sink Voltage</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveSinkV > 0 ? liveSinkV.toFixed(2) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">V</span>
                </div>
                <div className="text-[10px] text-cyan-400 mt-1">
                  {liveSinkV >= 4.5 ? 'Nominal' : liveSinkV > 0 ? 'Voltage Sag' : 'No Load'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Current Draw</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveCurrent > 0 ? liveCurrent.toFixed(2) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">A</span>
                </div>
                <div className="text-[10px] text-amber-400 mt-1">
                  {liveCurrent > 0 ? 'Active Load' : 'Zero Current'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">V-Drop / Resistance</div>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  {liveResist != null ? (
                    `${liveResist.toFixed(3)}Ω`
                  ) : (
                    <span className="text-xs font-normal text-slate-500">Insufficient Data</span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Drop: {liveDrop != null ? `${liveDrop.toFixed(3)}V` : 'Need source ref'}
                </div>
              </div>

              <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800">
                <div className="text-[11px] text-slate-400">Surface Temp</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveTemp > 0 ? liveTemp.toFixed(1) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">°C</span>
                </div>
                <div className="text-[10px] text-rose-400 mt-1">
                  {liveTemp >= 50 ? 'Critical' : liveTemp >= 42 ? 'Warning' : 'Normal'}
                </div>
              </div>
            </div>

            {/* Measurement Validity & Pair Verification Indicator */}
            <div className="p-3.5 rounded-lg bg-slate-900/60 border border-slate-800/80 text-xs space-y-2">
              <div className="flex items-center justify-between text-slate-300 font-medium">
                <span>Measurement Integrity & Reference Checks</span>
                <span className="text-[11px] text-slate-400">Scientific Rigor Notice</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-[11px]">
                <div className="flex items-center space-x-1.5 text-slate-300">
                  {liveSourceV != null ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>
                    Source Ref: {liveSourceV != null ? `${liveSourceV.toFixed(2)}V` : 'None (Single-ended)'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-slate-300">
                  {isPaired ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                  )}
                  <span>
                    Drop Calculation: {isPaired ? 'Verified Differential' : 'Single-Ended Blocked'}
                  </span>
                </div>

                <div className="flex items-center space-x-1.5 text-slate-300">
                  {liveTemp < 50 ? (
                    <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                  ) : (
                    <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                  )}
                  <span>Thermal Envelope: {liveTemp < 50 ? 'Safe' : 'OVERHEAT TRIP'}</span>
                </div>
              </div>
            </div>

            {/* Live Chart Visualizer */}
            <div className="h-60 w-full bg-[#0a0e17] rounded-lg border border-slate-800 p-2">
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                    <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                    <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                    <Tooltip contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }} />
                    <Line type="monotone" dataKey="sinkVoltage" stroke="#06b6d4" strokeWidth={2} dot={false} name="Sink Voltage (V)" />
                    <Line type="monotone" dataKey="current" stroke="#f59e0b" strokeWidth={2} dot={false} name="Current (A)" />
                    <Line type="monotone" dataKey="temperature" stroke="#f43f5e" strokeWidth={1.5} dot={false} name="Temp (°C)" />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="h-full flex items-center justify-center text-xs text-slate-500">
                  Click 'Start Controlled Test' to stream real-time waveforms.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
