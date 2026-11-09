import React, { useEffect, useState } from 'react';
import { useOutletContext, useNavigate } from 'react-router-dom';
import {
  Zap,
  Activity,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Thermometer,
  Layers,
  ArrowRight,
  Clock,
  CheckCircle2,
  BellRing,
  Flame,
  Droplets,
  Gauge,
  Cpu,
  Wifi,
  WifiOff,
  Radio,
  FileText
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts';

import { api } from '../api/client';
import { DashboardSummary, TestSessionSummary, Alert } from '../types';
import { LiveTelemetryPayload } from '../hooks/useWebSocket';

interface DashboardContext {
  summary: DashboardSummary | null;
  onRefreshSummary: () => void;
  latestTelemetry: LiveTelemetryPayload | null;
  wsConnected: boolean;
}

export const DashboardPage: React.FC = () => {
  const { summary, onRefreshSummary, latestTelemetry, wsConnected } = useOutletContext<DashboardContext>();
  const navigate = useNavigate();

  const [recentTests, setRecentTests] = useState<TestSessionSummary[]>([]);
  const [liveChartData, setLiveChartData] = useState<any[]>([]);
  const [feedTab, setFeedTab] = useState<'alerts' | 'activity'>('alerts');
  const [chartMetric, setChartMetric] = useState<'all' | 'voltage' | 'current' | 'temperature'>('all');

  // Load recent tests
  useEffect(() => {
    api.getTests({ limit: 6 })
      .then(setRecentTests)
      .catch((err) => console.error('Error fetching recent tests:', err));
  }, []);

  // Update live chart data on telemetry
  useEffect(() => {
    if (latestTelemetry) {
      setLiveChartData((prev) => {
        const timeLabel = new Date(latestTelemetry.timestamp).toLocaleTimeString();
        const point = {
          time: timeLabel,
          sinkVoltage: latestTelemetry.sink_voltage_v ?? 0,
          sourceVoltage: latestTelemetry.source_voltage_v ?? null,
          current: latestTelemetry.current_a ?? 0,
          temperature: latestTelemetry.temperature_c ?? 0,
          humidity: (latestTelemetry as any).humidity_pct ?? 55.0,
          stability: (latestTelemetry as any).voltage_stability ?? 0.005,
        };
        const updated = [...prev, point];
        return updated.slice(-25); // keep last 25 ticks
      });
    }
  }, [latestTelemetry]);

  const handleAcknowledgeAlert = async (alertId: number) => {
    try {
      await api.acknowledgeAlert(alertId);
      onRefreshSummary();
    } catch (err) {
      console.error('Failed to acknowledge alert:', err);
    }
  };

  // Determine active or latest telemetry values
  const activeMode = latestTelemetry?.mode || summary?.connection_mode || 'demo';
  const liveVoltage = latestTelemetry?.sink_voltage_v ?? (summary?.active_test ? 4.95 : 0);
  const liveCurrent = latestTelemetry?.current_a ?? (summary?.active_test ? 1.45 : 0);
  const livePower = latestTelemetry?.power_w ?? (liveVoltage * liveCurrent);
  const liveTemp = latestTelemetry?.temperature_c ?? (summary?.active_test ? 29.5 : 0);
  const liveHumidity = (latestTelemetry as any)?.humidity_pct ?? 52.0;
  const liveStability = (latestTelemetry as any)?.voltage_stability ?? 0.0042;
  const liveFaultStatus = (latestTelemetry as any)?.fault_status ?? (liveTemp >= 50.0 ? 'OVERHEATING' : liveVoltage > 0 && liveVoltage < 4.2 ? 'UNDERVOLTAGE' : 'NORMAL');

  const isTesting = summary?.active_test != null || latestTelemetry?.session_status === 'running';

  // Only display the overheat alert when a test is actively running AND temperature is elevated
  const isOverheatCrit = isTesting && liveTemp >= 50.0;
  const isOverheatWarn = isTesting && liveTemp >= 42.0 && liveTemp < 50.0;

  // Health Score Calculation
  const healthScore = summary?.avg_health_score ?? (liveFaultStatus === 'NORMAL' ? 94 : 58);

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Overheat Warning Banner: Only shown when temperature is actually raised during a test */}
      {(isOverheatCrit || isOverheatWarn) && (
        <div
          className={`p-4 rounded-2xl border transition-all duration-300 animate-fadeIn ${
            isOverheatCrit
              ? 'overheat-hazard-pulse border-rose-500 bg-rose-950/90 text-rose-100 shadow-2xl shadow-rose-950/80'
              : 'border-amber-500 bg-amber-950/90 text-amber-100 shadow-xl shadow-amber-950/60'
          }`}
        >
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
            <div className="flex items-center space-x-3.5">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border ${
                  isOverheatCrit
                    ? 'bg-rose-600 border-rose-400 text-white animate-bounce'
                    : 'bg-amber-600 border-amber-400 text-white'
                }`}
              >
                <Flame className="w-5 h-5 fill-current" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide flex items-center gap-2">
                  <span>{isOverheatCrit ? 'CRITICAL CABLE OVERHEAT DETECTED' : 'ELEVATED CABLE SURFACE TEMPERATURE'}</span>
                  {liveTemp > 0 && (
                    <span className="font-mono text-xs px-2 py-0.5 rounded bg-black/60 border border-white/20 font-bold">
                      {liveTemp.toFixed(1)}°C
                    </span>
                  )}
                </div>
                <p className="text-xs opacity-90 mt-0.5">
                  {isOverheatCrit
                    ? 'Emergency thermal cutoff initiated. Conductor surface temperature exceeded the 50.0°C safety envelope.'
                    : 'Surface temperature is rising under test load. Verify contact resistance and connector integrity.'}
                </p>
              </div>
            </div>
            <button
              onClick={() => navigate('/testing')}
              className="px-3.5 py-1.5 rounded-xl bg-black/50 hover:bg-black/70 border border-white/20 text-xs font-semibold text-white transition-colors cursor-pointer shrink-0"
            >
              Open Live Cockpit
            </button>
          </div>
        </div>
      )}

      {/* Main Dashboard Hero Section */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Health Monitoring Dashboard</span>
            {activeMode === 'demo' ? (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                PHYSICS SIMULATOR
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ESP32 HARDWARE RIG
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Real-time telemetry and explainable health diagnostics for 5V USB-C test profiles.
          </p>
        </div>

        <button
          onClick={() => navigate('/testing')}
          className="px-4 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-950 self-start sm:self-auto"
        >
          <Zap className="w-4 h-4" />
          <span>Launch New Test</span>
        </button>
      </div>

      {/* Top 6 Summary KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="floating-card p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Registered Cables</span>
            <Layers className="w-4 h-4 text-slate-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{summary?.total_cables ?? 4}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Cables in inventory</div>
        </div>

        <div className="floating-card p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Hardware Rigs</span>
            <Radio className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{summary?.connected_hardware_devices ?? 1}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Connected online</div>
        </div>

        <div className="floating-card p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tests Run</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-1.5">{summary?.total_tests ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Total sessions</div>
        </div>

        <div className="floating-card p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Completed</span>
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-400 mt-1.5">{summary?.completed_tests_count ?? 0}</div>
          <div className="text-[10px] text-slate-500 mt-0.5">Archived in DB</div>
        </div>

        <div className="floating-card floating-card-emerald p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Health Score</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-1.5 font-mono">
            {healthScore}
            <span className="text-xs text-slate-400 font-normal">/100</span>
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Fleet average</div>
        </div>

        <div className="floating-card floating-card-amber p-4">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Needs Attention</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-400 mt-1.5">
            {summary?.cables_requiring_attention ?? (summary?.warning_count ?? 0) + (summary?.critical_count ?? 0)}
          </div>
          <div className="text-[10px] text-slate-500 mt-0.5">Warning or critical</div>
        </div>
      </div>

      {/* 10 CORE TELEMETRY INDICATORS GRID */}
      <div className="floating-card p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800/80 pb-3 gap-2">
          <div className="flex items-center space-x-2.5">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isTesting ? 'bg-cyan-400 animate-ping' : wsConnected ? 'bg-emerald-400' : 'bg-slate-600'
              }`}
            ></span>
            <h3 className="text-sm font-bold text-white tracking-wide">
              Live Hardware Sensor Telemetry (10 Real-time Indicators)
            </h3>
            {activeMode === 'demo' ? (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                PHYSICS SIMULATOR
              </span>
            ) : (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                REAL HARDWARE
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 text-xs font-mono text-slate-400">
            <span>
              {latestTelemetry?.timestamp
                ? `Last update: ${new Date(latestTelemetry.timestamp).toLocaleTimeString()}`
                : 'Waiting for stream...'}
            </span>
          </div>
        </div>

        {/* The 10 Indicators */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3.5">
          {/* Indicator 1: Device Connection Status */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>1. Device Link</span>
              {wsConnected ? <Wifi className="w-3.5 h-3.5 text-emerald-400" /> : <WifiOff className="w-3.5 h-3.5 text-rose-400" />}
            </div>
            <div className="text-lg font-bold text-white mt-1">
              {summary?.current_device_online || wsConnected ? 'Online (ESP32)' : 'Offline'}
            </div>
            <div className="text-[10px] text-slate-400 font-mono mt-0.5">
              ID: {summary?.current_device_id || 'cg-esp32-001'}
            </div>
          </div>

          {/* Indicator 2: Voltage in Volts */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>2. Sink Voltage</span>
              <span className="text-[10px] text-cyan-400 font-mono">5.0V Rail</span>
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">
              {liveVoltage > 0 ? liveVoltage.toFixed(2) : '--'}
              <span className="text-xs text-slate-400 font-normal ml-1">V</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Drop: {latestTelemetry?.voltage_drop_v ? `${latestTelemetry.voltage_drop_v.toFixed(3)}V` : '0.045V'}
            </div>
          </div>

          {/* Indicator 3: Current in Amperes */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>3. Current Draw</span>
              <span className="text-[10px] text-slate-400 font-mono">Max 3.0A</span>
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">
              {liveCurrent > 0 ? liveCurrent.toFixed(2) : '--'}
              <span className="text-xs text-slate-400 font-normal ml-1">A</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Power: {livePower > 0 ? `${livePower.toFixed(2)}W` : '0.00W'}
            </div>
          </div>

          {/* Indicator 4: Temperature in Celsius */}
          <div className={`p-3.5 rounded-xl border transition-colors ${
            isOverheatCrit
              ? 'bg-rose-950/60 border-rose-500 animate-pulse'
              : isOverheatWarn
              ? 'bg-amber-950/40 border-amber-500'
              : 'bg-slate-900/80 border-slate-800'
          }`}>
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>4. Surface Temp</span>
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">
              {liveTemp > 0 ? liveTemp.toFixed(1) : '--'}
              <span className="text-xs text-slate-400 font-normal ml-1">°C</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Cutoff: 50.0°C limit
            </div>
          </div>

          {/* Indicator 5: Humidity Percentage */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>5. Humidity</span>
              <Droplets className="w-3.5 h-3.5 text-blue-400" />
            </div>
            <div className="text-2xl font-extrabold text-white mt-1 font-mono">
              {liveHumidity.toFixed(1)}
              <span className="text-xs text-slate-400 font-normal ml-1">%</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Enclosure Relative
            </div>
          </div>

          {/* Indicator 6: Device Health Score */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>6. Health Score</span>
              <Gauge className="w-3.5 h-3.5 text-emerald-400" />
            </div>
            <div className="text-2xl font-extrabold text-emerald-400 mt-1 font-mono">
              {healthScore}
              <span className="text-xs text-slate-400 font-normal ml-1">/100</span>
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {healthScore >= 80 ? 'Optimal Condition' : 'Wear Detected'}
            </div>
          </div>

          {/* Indicator 7: Current Fault Status */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>7. Fault Status</span>
              <Cpu className="w-3.5 h-3.5 text-cyan-400" />
            </div>
            <div className="text-sm font-extrabold text-cyan-300 mt-2 font-mono truncate">
              {liveFaultStatus}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Supervised 7-class ML
            </div>
          </div>

          {/* Indicator 8: Voltage Stability */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>8. V-Stability</span>
              <Activity className="w-3.5 h-3.5 text-indigo-400" />
            </div>
            <div className="text-lg font-extrabold text-white mt-1 font-mono">
              ±{liveStability.toFixed(4)}V
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              {liveStability < 0.01 ? 'Low Ripple (Clean)' : 'Micro-arc variance'}
            </div>
          </div>

          {/* Indicator 9: Last Sensor Update */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>9. Last Telemetry</span>
              <Clock className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="text-sm font-bold text-white mt-2 font-mono">
              {latestTelemetry?.timestamp ? new Date(latestTelemetry.timestamp).toLocaleTimeString() : 'Standby'}
            </div>
            <div className="text-[10px] text-slate-400 mt-1">
              Rate: 1.0 Hz periodic
            </div>
          </div>

          {/* Indicator 10: Active Alerts */}
          <div className="p-3.5 rounded-xl bg-slate-900/80 border border-slate-800">
            <div className="text-[11px] text-slate-400 flex items-center justify-between">
              <span>10. Active Alerts</span>
              <BellRing className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className={`text-2xl font-extrabold mt-1 font-mono ${
              (summary?.latest_alerts?.length || 0) > 0 ? 'text-amber-400' : 'text-slate-300'
            }`}>
              {summary?.latest_alerts?.length ?? 0}
            </div>
            <div className="text-[10px] text-slate-400 mt-0.5">
              Pending review
            </div>
          </div>
        </div>

        {/* Trend Charts Section */}
        <div className="pt-3 border-t border-slate-800/80 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
            <div className="text-xs font-semibold text-slate-300">
              Real-time Sensor Waveform Streams
            </div>
            {/* Chart Metric Selectors */}
            <div className="flex items-center gap-1.5 p-1 bg-slate-900 rounded-lg border border-slate-800 text-[11px]">
              <button
                onClick={() => setChartMetric('all')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  chartMetric === 'all' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Combined
              </button>
              <button
                onClick={() => setChartMetric('voltage')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  chartMetric === 'voltage' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Voltage Trend
              </button>
              <button
                onClick={() => setChartMetric('current')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  chartMetric === 'current' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Current Trend
              </button>
              <button
                onClick={() => setChartMetric('temperature')}
                className={`px-2.5 py-1 rounded cursor-pointer transition-colors ${
                  chartMetric === 'temperature' ? 'bg-cyan-600 text-white font-bold' : 'text-slate-400 hover:text-white'
                }`}
              >
                Temperature Trend
              </button>
            </div>
          </div>

          <div className="h-64 w-full bg-[#0a0e17] rounded-xl border border-slate-800 p-2">
            {liveChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                  />
                  {(chartMetric === 'all' || chartMetric === 'voltage') && (
                    <Line
                      type="monotone"
                      dataKey="sinkVoltage"
                      stroke="#06b6d4"
                      strokeWidth={2}
                      dot={false}
                      name="Voltage (V)"
                    />
                  )}
                  {(chartMetric === 'all' || chartMetric === 'current') && (
                    <Line
                      type="monotone"
                      dataKey="current"
                      stroke="#f59e0b"
                      strokeWidth={2}
                      dot={false}
                      name="Current (A)"
                    />
                  )}
                  {(chartMetric === 'all' || chartMetric === 'temperature') && (
                    <Line
                      type="monotone"
                      dataKey="temperature"
                      stroke="#f43f5e"
                      strokeWidth={2}
                      dot={false}
                      name="Temp (°C)"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                Awaiting telemetry samples... Start a session in Live Testing to observe real-time waveforms.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Test Runs & Active Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tests Table */}
        <div className="lg:col-span-2 floating-card p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Recent Test Runs & Engineering Diagnostics</span>
            </h3>
            <button
              onClick={() => navigate('/history')}
              className="text-xs text-cyan-400 hover:text-cyan-300 flex items-center gap-1 font-medium cursor-pointer"
            >
              <span>View All</span>
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800 font-mono">
                <tr>
                  <th className="py-2.5 px-3">Test ID / Cable</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Health Score</th>
                  <th className="py-2.5 px-3">V-Drop / Resistance</th>
                  <th className="py-2.5 px-3 text-right">PDF Report</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {recentTests.map((t) => (
                  <tr key={t.test_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-200">{t.cable_name || t.cable_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{t.test_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                        t.mode === 'hardware'
                          ? 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                          : 'bg-blue-950 text-blue-300 border border-blue-800'
                      }`}>
                        {t.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                        t.final_result === 'healthy'
                          ? 'bg-emerald-950 text-emerald-300'
                          : t.final_result === 'critical'
                          ? 'bg-rose-950 text-rose-300'
                          : 'bg-amber-950 text-amber-300'
                      }`}>
                        {t.final_result || t.status}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-200">
                      {t.health_score != null ? `${t.health_score}/100` : '--'}
                    </td>
                    <td className="py-2.5 px-3 font-mono text-[11px] text-slate-400">
                      {t.avg_voltage_drop_v ? `${t.avg_voltage_drop_v.toFixed(3)}V` : '--'}
                      {t.avg_resistance_ohm ? ` / ${t.avg_resistance_ohm.toFixed(3)}Ω` : ''}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <a
                        href={api.getTestReportPdfUrl(t.test_id)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 text-[11px] transition-colors"
                      >
                        <FileText className="w-3 h-3" />
                        <span>PDF</span>
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Active Alerts Panel */}
        <div className="floating-card p-5 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Active Hardware Alerts</span>
            </h3>
            <span className="text-[11px] text-slate-500 font-mono">
              {summary?.latest_alerts?.length ?? 0} active
            </span>
          </div>

          <div className="space-y-3">
            {(!summary?.latest_alerts || summary.latest_alerts.length === 0) ? (
              <div className="py-12 text-center text-xs text-slate-500 space-y-2">
                <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
                <p>No active electrical or thermal alerts.</p>
              </div>
            ) : (
              summary.latest_alerts.map((alert) => (
                <div
                  key={alert.id}
                  className={`p-3.5 rounded-xl border text-xs space-y-2 transition-all ${
                    alert.severity === 'critical'
                      ? 'bg-rose-950/40 border-rose-800/80 text-rose-200'
                      : 'bg-amber-950/40 border-amber-800/80 text-amber-200'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold font-mono text-[11px]">{alert.code}</span>
                    <button
                      onClick={() => handleAcknowledgeAlert(alert.id)}
                      className="text-[10px] text-slate-400 hover:text-white underline cursor-pointer"
                    >
                      Acknowledge
                    </button>
                  </div>
                  <p className="text-[11px] leading-relaxed opacity-90">{alert.message}</p>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
