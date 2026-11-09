import React, { useEffect, useState } from 'react';
import {
  Cpu,
  BrainCircuit,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  Info,
  CheckCircle2,
  Database,
  Sliders,
  Layers
} from 'lucide-react';
import { api } from '../api/client';
import { Alert, SystemSettings } from '../types';

export const DiagnosticsPage: React.FC = () => {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [settings, setSettings] = useState<SystemSettings | null>(null);

  useEffect(() => {
    api.getAlerts({ limit: 20 })
      .then(setAlerts)
      .catch((err) => console.error('Error fetching alerts:', err));

    api.getSettings()
      .then(setSettings)
      .catch((err) => console.error('Error fetching settings:', err));
  }, []);

  const handleAcknowledge = async (id: number) => {
    try {
      await api.acknowledgeAlert(id);
      api.getAlerts({ limit: 20 }).then(setAlerts);
    } catch (e) {
      console.error('Failed to acknowledge alert', e);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
          <Cpu className="w-5 h-5 text-cyan-400" />
          <span>Diagnostic Engine & Rule Inspector</span>
        </h2>
        <p className="text-xs text-slate-400 mt-0.5">
          Deterministic threshold evaluation, safety stop logic, and supervised degradation classifier readiness.
        </p>
      </div>

      {/* Machine Learning Rigor & Readiness Card */}
      <div className="p-6 rounded-2xl bg-gradient-to-br from-[#111827] via-[#0f172a] to-[#1e1b4b]/30 border border-indigo-900/40 shadow-xl space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-indigo-950 pb-4">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center text-indigo-400">
              <BrainCircuit className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <span>AI Degradation Classifier Architecture</span>
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-950 text-indigo-300 border border-indigo-800">
                  v0.2 Experimental
                </span>
              </h3>
              <p className="text-xs text-indigo-200/80 mt-0.5">
                Supervised wear pattern classification & automated telemetry feature extraction.
              </p>
            </div>
          </div>

          <div className="text-left sm:text-right">
            <span className="text-[11px] font-semibold px-2.5 py-1 rounded bg-amber-950/80 text-amber-300 border border-amber-800">
              Data-Collection Mode Active
            </span>
          </div>
        </div>

        {/* Scientific Transparency Notice */}
        <div className="p-3.5 rounded-lg bg-indigo-950/30 border border-indigo-800/40 text-xs text-indigo-100 flex items-start gap-2.5">
          <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
          <div className="text-[11px] leading-relaxed">
            <span className="font-bold text-cyan-300">Remaining Useful Life (RUL) Honesty Policy:</span>{' '}
            Remaining useful life estimates are NOT displayed or invented without sufficient continuous, labeled cycle-to-failure degradation data.
            Predicting cable failure cycles from a single screening test is scientifically invalid. The system currently classifies wear using explainable engineering rules while logging feature sets for future model training.
          </div>
        </div>

        {/* Feature Pipeline */}
        <div className="space-y-2">
          <h4 className="text-xs font-semibold text-slate-300 uppercase tracking-wide text-[11px]">
            Feature Extraction Vector for Supervised Classifier
          </h4>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2.5 text-xs font-mono">
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-500">Feature 1</div>
              <div className="text-slate-200 font-semibold mt-0.5">Mean Path Resistance</div>
              <div className="text-[10px] text-cyan-400">R_loop (Ω)</div>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-500">Feature 2</div>
              <div className="text-slate-200 font-semibold mt-0.5">Thermal Rise Rate</div>
              <div className="text-[10px] text-rose-400">dT/dt (°C/min)</div>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-500">Feature 3</div>
              <div className="text-slate-200 font-semibold mt-0.5">Voltage Jitter StdDev</div>
              <div className="text-[10px] text-amber-400">σ_V (V ripple)</div>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-500">Feature 4</div>
              <div className="text-slate-200 font-semibold mt-0.5">Current Stability</div>
              <div className="text-[10px] text-emerald-400">I_load consistency</div>
            </div>
            <div className="p-2.5 rounded bg-slate-900 border border-slate-800">
              <div className="text-[10px] text-slate-500">Feature 5</div>
              <div className="text-slate-200 font-semibold mt-0.5">Connector Flex Noise</div>
              <div className="text-[10px] text-purple-400">Contact bounce</div>
            </div>
          </div>
        </div>
      </div>

      {/* Deterministic Diagnostic Rules Matrix */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Sliders className="w-4 h-4 text-cyan-400" />
            <span>Active Threshold Rules Matrix</span>
          </h3>
          <span className="text-xs text-slate-400">5V DC USB Profile</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5 text-xs">
          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Under-Voltage Sag</span>
              <span className="text-[10px] text-amber-400 font-mono">Warn &lt; 4.50V</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Detects excessive copper loop drop or oxidized connector pins under 1A load. Triggers Critical alert if sink V &lt; 4.20V.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Over-Voltage Trip</span>
              <span className="text-[10px] text-rose-400 font-mono">Crit &gt; 5.60V</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Protects sink trigger and attached devices against rogue power adapter spikes. Triggers immediate load disconnect.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Current Overload</span>
              <span className="text-[10px] text-rose-400 font-mono">Crit &gt; 3.00A</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Protects test fixture and wiring against short-circuits or out-of-spec power draws during screening.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Thermal Runaway Cutoff</span>
              <span className="text-[10px] text-rose-400 font-mono">Trip &gt; 50.0°C</span>
            </div>
            <p className="text-[11px] text-slate-400">
              DS18B20 clamped to connector neck trips automatic safety shutoff if surface temperature exceeds 50°C.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Effective Path Resistance</span>
              <span className="text-[10px] text-amber-400 font-mono">Warn &gt; 0.60Ω</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Calculates loop resistance (R = ΔV / I) ONLY when simultaneous source and sink readings exist. Rejects single-ended estimates.
            </p>
          </div>

          <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 space-y-1">
            <div className="font-semibold text-slate-200 flex items-center justify-between">
              <span>Contact Intermittent Jitter</span>
              <span className="text-[10px] text-amber-400 font-mono">σ &gt; 0.15V</span>
            </div>
            <p className="text-[11px] text-slate-400">
              Standard deviation of voltage readings over a 4-sample window flags damaged internal strands or loose pin contacts.
            </p>
          </div>
        </div>
      </div>

      {/* Historical Anomaly & Alert Log */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-semibold text-white flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-amber-400" />
          <span>Recorded Anomaly Events</span>
        </h3>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
              <tr>
                <th className="py-2.5 px-3">Severity</th>
                <th className="py-2.5 px-3">Code</th>
                <th className="py-2.5 px-3">Diagnostic Message</th>
                <th className="py-2.5 px-3 font-mono">Obs / Limit</th>
                <th className="py-2.5 px-3">Timestamp</th>
                <th className="py-2.5 px-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
              {alerts.map((a) => (
                <tr key={a.id}>
                  <td className="py-2.5 px-3">
                    {a.severity === 'critical' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        CRITICAL
                      </span>
                    ) : a.severity === 'warning' ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        WARNING
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-300">
                        INFO
                      </span>
                    )}
                  </td>
                  <td className="py-2.5 px-3 font-mono font-medium text-slate-300">{a.code}</td>
                  <td className="py-2.5 px-3 text-slate-200">{a.message}</td>
                  <td className="py-2.5 px-3 font-mono text-slate-400 text-[11px]">
                    {a.observed_value != null ? a.observed_value : '--'} / {a.threshold_value != null ? a.threshold_value : '--'}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 font-mono text-[11px]">
                    {new Date(a.created_at).toLocaleTimeString()}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {!a.acknowledged_at ? (
                      <button
                        onClick={() => handleAcknowledge(a.id)}
                        className="text-[11px] px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-cyan-300 cursor-pointer"
                      >
                        Acknowledge
                      </button>
                    ) : (
                      <span className="text-[11px] text-emerald-400 flex items-center justify-end gap-1">
                        <CheckCircle2 className="w-3 h-3" /> Ack
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {alerts.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No anomaly alerts recorded.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
