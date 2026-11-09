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
  BellRing
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

  // Load recent tests
  useEffect(() => {
    api.getTests({ limit: 5 })
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
        };
        const updated = [...prev, point];
        return updated.slice(-20); // keep last 20 ticks
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
  const liveVoltage = latestTelemetry?.sink_voltage_v ?? 0;
  const liveCurrent = latestTelemetry?.current_a ?? 0;
  const livePower = latestTelemetry?.power_w ?? 0;
  const liveTemp = latestTelemetry?.temperature_c ?? 0;
  const isTesting = summary?.active_test != null || latestTelemetry?.session_status === 'running';

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Health Monitoring Dashboard</span>
            {activeMode === 'demo' ? (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800/80">
                SIMULATOR DEMO
              </span>
            ) : (
              <span className="text-xs font-semibold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800/80">
                HARDWARE RIG
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time telemetry and explainable health diagnostics for 5V USB-C test profiles.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => navigate('/testing')}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-cyan-950 cursor-pointer"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch New Test</span>
          </button>
        </div>
      </div>

      {/* KPI Metric Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
        <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Registered Cables</span>
            <Layers className="w-4 h-4 text-slate-500" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {summary?.total_cables ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Available in test bench</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-slate-800 shadow-sm">
          <div className="flex items-center justify-between text-slate-400 text-xs">
            <span>Tests Run</span>
            <Activity className="w-4 h-4 text-cyan-400" />
          </div>
          <div className="text-2xl font-bold text-white mt-2">
            {summary?.total_tests ?? 0}
          </div>
          <div className="text-[11px] text-cyan-400/80 mt-1">Total recorded sessions</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-emerald-900/40 shadow-sm">
          <div className="flex items-center justify-between text-emerald-400 text-xs">
            <span>Healthy Tests</span>
            <ShieldCheck className="w-4 h-4 text-emerald-400" />
          </div>
          <div className="text-2xl font-bold text-emerald-300 mt-2">
            {summary?.healthy_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Passed all safety rules</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-amber-900/40 shadow-sm">
          <div className="flex items-center justify-between text-amber-400 text-xs">
            <span>Warning Tests</span>
            <AlertTriangle className="w-4 h-4 text-amber-400" />
          </div>
          <div className="text-2xl font-bold text-amber-300 mt-2">
            {summary?.warning_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Sag or high resistance</div>
        </div>

        <div className="p-4 rounded-xl bg-[#111827] border border-rose-900/40 shadow-sm col-span-2 md:col-span-1">
          <div className="flex items-center justify-between text-rose-400 text-xs">
            <span>Critical Faults</span>
            <AlertOctagon className="w-4 h-4 text-rose-400" />
          </div>
          <div className="text-2xl font-bold text-rose-300 mt-2">
            {summary?.critical_count ?? 0}
          </div>
          <div className="text-[11px] text-slate-400 mt-1">Overheat or overload</div>
        </div>
      </div>

      {/* Live Sensor Telemetry Gauges */}
      <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                isTesting ? 'bg-cyan-400 animate-ping' : 'bg-slate-600'
              }`}
            ></span>
            <h3 className="text-sm font-semibold text-white">
              Live Sensor Telemetry
            </h3>
            {activeMode === 'demo' && (
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                SIMULATED DATA
              </span>
            )}
          </div>
          <span className="text-xs text-slate-400 font-mono">
            {latestTelemetry?.timestamp
              ? `Last frame: ${new Date(latestTelemetry.timestamp).toLocaleTimeString()}`
              : 'Waiting for stream...'}
          </span>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Voltage */}
          <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Sink Voltage</span>
              <span className="text-[10px] text-cyan-400 font-mono">Profile: 5.0V</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {liveVoltage > 0 ? liveVoltage.toFixed(2) : '--'}
              <span className="text-sm text-slate-400 font-normal ml-1">V</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Drop: {latestTelemetry?.voltage_drop_v ? `${latestTelemetry.voltage_drop_v.toFixed(3)}V` : 'N/A'}</span>
              <span className={liveVoltage >= 4.5 ? 'text-emerald-400' : 'text-amber-400'}>
                {liveVoltage >= 4.5 ? 'Normal' : liveVoltage > 0 ? 'Sag' : 'Idle'}
              </span>
            </div>
          </div>

          {/* Current */}
          <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Current Draw</span>
              <span className="text-[10px] text-slate-400 font-mono">Max: 3.0A</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {liveCurrent > 0 ? liveCurrent.toFixed(2) : '--'}
              <span className="text-sm text-slate-400 font-normal ml-1">A</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Load: ~1A Target</span>
              <span className={liveCurrent < 2.4 ? 'text-emerald-400' : 'text-rose-400'}>
                {liveCurrent < 2.4 ? 'Safe' : 'High Load'}
              </span>
            </div>
          </div>

          {/* Power */}
          <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Active Power (V x I)</span>
              <span className="text-[10px] text-slate-400 font-mono">DC</span>
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {livePower > 0 ? livePower.toFixed(2) : '--'}
              <span className="text-sm text-slate-400 font-normal ml-1">W</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Resistance: {latestTelemetry?.effective_resistance_ohm ? `${latestTelemetry.effective_resistance_ohm.toFixed(3)}Ω` : 'N/A'}</span>
              <span className="text-cyan-400">Verified</span>
            </div>
          </div>

          {/* Temperature */}
          <div className="p-4 rounded-lg bg-slate-900/70 border border-slate-800">
            <div className="text-xs text-slate-400 flex items-center justify-between">
              <span>Surface Temp</span>
              <Thermometer className="w-3.5 h-3.5 text-amber-400" />
            </div>
            <div className="text-3xl font-extrabold text-white mt-1 font-mono tracking-tight">
              {liveTemp > 0 ? liveTemp.toFixed(1) : '--'}
              <span className="text-sm text-slate-400 font-normal ml-1">°C</span>
            </div>
            <div className="text-[11px] text-slate-400 mt-1 flex items-center justify-between">
              <span>Trip at: 50.0°C</span>
              <span className={liveTemp < 42 ? 'text-emerald-400' : liveTemp < 50 ? 'text-amber-400' : 'text-rose-400'}>
                {liveTemp < 42 ? 'Cool' : liveTemp < 50 ? 'Elevated' : 'Critical'}
              </span>
            </div>
          </div>
        </div>

        {/* Live Recharts Line Chart */}
        <div className="pt-2">
          <div className="text-xs text-slate-400 font-medium mb-3 flex items-center justify-between">
            <span>Real-time Waveform Stream (Last 20 Samples)</span>
            <div className="flex items-center space-x-3 text-[11px]">
              <span className="flex items-center gap-1 text-cyan-400">
                <span className="w-2.5 h-0.5 bg-cyan-400 inline-block"></span> Voltage (V)
              </span>
              <span className="flex items-center gap-1 text-amber-400">
                <span className="w-2.5 h-0.5 bg-amber-400 inline-block"></span> Current (A)
              </span>
              <span className="flex items-center gap-1 text-rose-400">
                <span className="w-2.5 h-0.5 bg-rose-400 inline-block"></span> Temp (°C)
              </span>
            </div>
          </div>

          <div className="h-56 w-full bg-[#0a0e17] rounded-lg border border-slate-800/80 p-2">
            {liveChartData.length > 0 ? (
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={liveChartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis dataKey="time" stroke="#64748b" tick={{ fontSize: 10 }} />
                  <YAxis stroke="#64748b" tick={{ fontSize: 10 }} domain={['auto', 'auto']} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', fontSize: '11px' }}
                  />
                  <Line
                    type="monotone"
                    dataKey="sinkVoltage"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    dot={false}
                    name="Sink Voltage (V)"
                  />
                  <Line
                    type="monotone"
                    dataKey="current"
                    stroke="#f59e0b"
                    strokeWidth={2}
                    dot={false}
                    name="Current (A)"
                  />
                  <Line
                    type="monotone"
                    dataKey="temperature"
                    stroke="#f43f5e"
                    strokeWidth={1.5}
                    dot={false}
                    name="Temp (°C)"
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="h-full flex items-center justify-center text-xs text-slate-500">
                No active stream data. Start a test in Live Testing to view live waveforms.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Two Columns: Recent Tests & Latest Alerts */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Tests Table */}
        <div className="lg:col-span-2 p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-400" />
              <span>Recent Test Runs</span>
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
              <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/60 border-b border-slate-800">
                <tr>
                  <th className="py-2.5 px-3">Test ID / Cable</th>
                  <th className="py-2.5 px-3">Mode</th>
                  <th className="py-2.5 px-3">Result</th>
                  <th className="py-2.5 px-3">Health Score</th>
                  <th className="py-2.5 px-3">Drop / Res</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60">
                {recentTests.map((t) => (
                  <tr key={t.test_id} className="hover:bg-slate-800/30 transition-colors">
                    <td className="py-2.5 px-3">
                      <div className="font-medium text-slate-200">{t.cable_name || t.cable_id}</div>
                      <div className="text-[10px] text-slate-500 font-mono">{t.test_id}</div>
                    </td>
                    <td className="py-2.5 px-3">
                      <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-800 text-slate-300 uppercase">
                        {t.mode}
                      </span>
                    </td>
                    <td className="py-2.5 px-3">
                      {t.final_result === 'healthy' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          HEALTHY
                        </span>
                      ) : t.final_result === 'warning' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          WARNING
                        </span>
                      ) : t.final_result === 'critical' ? (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          CRITICAL
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                          INSUFFICIENT DATA
                        </span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 font-mono font-semibold">
                      {t.health_score != null ? (
                        <span className={t.health_score >= 80 ? 'text-emerald-400' : t.health_score >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                          {t.health_score.toFixed(1)}/100
                        </span>
                      ) : (
                        <span className="text-slate-500 font-normal">--</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                      {t.avg_voltage_drop_v != null ? `${t.avg_voltage_drop_v.toFixed(3)}V` : '--'} /{' '}
                      {t.avg_resistance_ohm != null ? `${t.avg_resistance_ohm.toFixed(3)}Ω` : '--'}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <button
                        onClick={() => navigate(`/report/${t.test_id}`)}
                        className="text-cyan-400 hover:text-cyan-300 text-[11px] font-medium underline cursor-pointer"
                      >
                        Report
                      </button>
                    </td>
                  </tr>
                ))}
                {recentTests.length === 0 && (
                  <tr>
                    <td colSpan={6} className="py-6 text-center text-slate-500 text-xs">
                      No test history recorded yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Latest Alerts Feed */}
        <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-white flex items-center gap-2">
              <BellRing className="w-4 h-4 text-amber-400" />
              <span>Safety & Anomaly Feed</span>
            </h3>
            <span className="text-[11px] text-slate-400 font-mono">
              {summary?.latest_alerts.length ?? 0} active
            </span>
          </div>

          <div className="space-y-2.5 overflow-y-auto max-h-80 pr-1">
            {summary?.latest_alerts && summary.latest_alerts.length > 0 ? (
              summary.latest_alerts.map((a) => (
                <div
                  key={a.id}
                  className={`p-3 rounded-lg border text-xs ${
                    a.severity === 'critical'
                      ? 'bg-rose-950/30 border-rose-900/60 text-rose-200'
                      : a.severity === 'warning'
                      ? 'bg-amber-950/30 border-amber-900/60 text-amber-200'
                      : 'bg-slate-900 border-slate-800 text-slate-300'
                  }`}
                >
                  <div className="flex items-center justify-between font-semibold">
                    <span className="uppercase text-[10px] tracking-wide font-mono">
                      {a.code}
                    </span>
                    <span className="text-[10px] text-slate-400 font-normal">
                      {new Date(a.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <p className="text-[11px] mt-1 text-slate-300 leading-snug">
                    {a.message}
                  </p>
                  <div className="mt-2 flex items-center justify-between pt-1 border-t border-slate-800/60">
                    <span className="text-[10px] text-slate-400 font-mono">
                      Obs: {a.observed_value != null ? a.observed_value : '--'} | Lim: {a.threshold_value != null ? a.threshold_value : '--'}
                    </span>
                    {!a.acknowledged_at ? (
                      <button
                        onClick={() => handleAcknowledgeAlert(a.id)}
                        className="text-[10px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-200 cursor-pointer font-medium"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                        <CheckCircle2 className="w-3 h-3" /> Ack
                      </span>
                    )}
                  </div>
                </div>
              ))
            ) : (
              <div className="py-12 text-center text-xs text-slate-500">
                No active threshold alerts.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
