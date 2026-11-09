import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Printer,
  ArrowLeft,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  Download,
  Info,
  CheckCircle2,
  XCircle,
  Clock,
  Layers,
  Thermometer,
  Zap
} from 'lucide-react';
import { api } from '../api/client';

export const CableHealthReportPage: React.FC = () => {
  const { testId } = useParams<{ testId: string }>();
  const navigate = useNavigate();
  const [report, setReport] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!testId) return;
    setLoading(true);
    api.getTestReport(testId)
      .then((data) => {
        setReport(data);
        setError(null);
      })
      .catch((err) => {
        setError(err.message || 'Failed to load test report');
      })
      .finally(() => setLoading(false));
  }, [testId]);

  if (loading) {
    return (
      <div className="py-24 text-center text-slate-400 text-sm">
        Generating engineering health report...
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="max-w-xl mx-auto py-16 space-y-4 text-center">
        <div className="p-4 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-300 text-xs">
          {error || 'Report not found.'}
        </div>
        <button
          onClick={() => navigate('/history')}
          className="text-xs text-cyan-400 hover:underline flex items-center gap-1 mx-auto cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" /> Back to Test History
        </button>
      </div>
    );
  }

  const {
    report_id,
    generated_at,
    test_metadata,
    cable_specifications,
    health_assessment,
    metrics_summary,
    alerts_recorded,
    disclaimer
  } = report;

  const healthCategory = health_assessment.health_category;
  const healthScore = health_assessment.health_score;
  const explanation = health_assessment.explanation || {};
  const rules = explanation.rules_evaluated || [];
  const recommendations = explanation.recommended_actions || [];

  return (
    <div className="max-w-4xl mx-auto space-y-6 pb-16 font-sans">
      {/* Top action bar (hidden during print) */}
      <div className="no-print flex items-center justify-between border-b border-slate-800 pb-4">
        <button
          onClick={() => navigate('/history')}
          className="text-xs text-slate-400 hover:text-slate-200 flex items-center gap-1.5 cursor-pointer font-medium"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Test History</span>
        </button>

        <div className="flex items-center space-x-2">
          <a
            href={api.getTestReportPdfUrl(test_metadata.test_id)}
            target="_blank"
            rel="noreferrer"
            className="px-3 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/40 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Download PDF</span>
          </a>
          <a
            href={api.getSingleTestExportCsvUrl(test_metadata.test_id)}
            download
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Export CSV</span>
          </a>
          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-cyan-950 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Printable Report Document Card */}
      <div className="p-8 rounded-2xl bg-[#111827] border border-slate-800 shadow-xl print-card space-y-6">
        {/* Document Header */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-6 gap-4">
          <div>
            <div className="flex items-center space-x-2">
              <span className="text-xs uppercase font-extrabold tracking-widest text-cyan-400">
                ChargeGuard AI Pro
              </span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-300">
                Verification Report
              </span>
              {test_metadata.mode === 'demo' ? (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  DEMO SIMULATION
                </span>
              ) : (
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  HARDWARE RIG
                </span>
              )}
            </div>
            <h1 className="text-xl font-extrabold text-white mt-1">
              Cable Health & Diagnostic Assessment
            </h1>
            <p className="text-xs text-slate-400 font-mono mt-0.5">
              Report ID: {report_id} | Test ID: {test_metadata.test_id} | Device: {test_metadata.device_id}
            </p>
          </div>

          <div className="text-left sm:text-right text-xs text-slate-400 font-mono">
            <div>Generated: {new Date(generated_at).toLocaleString()}</div>
            <div>Profile: {test_metadata.profile_voltage_v} V DC Fixed</div>
          </div>
        </div>

        {/* Demo Mode Notice */}
        {test_metadata.mode === 'demo' && (
          <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-800 text-blue-200 text-xs flex items-center gap-2">
            <Info className="w-4 h-4 text-cyan-400 shrink-0" />
            <span>
              <strong>SIMULATED DEMO REPORT:</strong> This session was evaluated in simulator mode. Telemetry readings reflect controlled synthetic test vectors and are clearly distinguished from physical hardware bench measurements.
            </span>
          </div>
        )}

        {/* Health Score & Classification Hero */}
        <div className="p-6 rounded-xl bg-slate-900/90 border border-slate-800 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-2 text-center md:text-left">
            <span className="text-xs uppercase tracking-wider text-slate-400 font-semibold">
              Diagnostic Health Category
            </span>
            <div className="flex items-center gap-3 justify-center md:justify-start">
              {healthCategory === 'Healthy' ? (
                <span className="inline-flex items-center gap-1.5 text-base font-extrabold px-3.5 py-1 rounded-lg bg-emerald-950 text-emerald-300 border border-emerald-800">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" /> HEALTHY
                </span>
              ) : healthCategory === 'Warning' ? (
                <span className="inline-flex items-center gap-1.5 text-base font-extrabold px-3.5 py-1 rounded-lg bg-amber-950 text-amber-300 border border-amber-800">
                  <AlertTriangle className="w-5 h-5 text-amber-400" /> WARNING
                </span>
              ) : healthCategory === 'Critical' ? (
                <span className="inline-flex items-center gap-1.5 text-base font-extrabold px-3.5 py-1 rounded-lg bg-rose-950 text-rose-300 border border-rose-800">
                  <AlertOctagon className="w-5 h-5 text-rose-400" /> CRITICAL FAULT
                </span>
              ) : (
                <span className="inline-flex items-center gap-1.5 text-base font-extrabold px-3.5 py-1 rounded-lg bg-slate-800 text-slate-300 border border-slate-700">
                  <HelpCircle className="w-5 h-5 text-slate-400" /> INSUFFICIENT DATA
                </span>
              )}

              <span className="text-xs text-slate-400 font-mono">
                Model: {health_assessment.model_version}
              </span>
            </div>

            <p className="text-xs text-slate-300 max-w-lg mt-1">
              {test_metadata.diagnostic_summary || 'Evaluation completed successfully.'}
            </p>
          </div>

          {/* Health Score Gauge */}
          <div className="text-center bg-[#0b0f19] p-4 rounded-xl border border-slate-800/80 min-w-[140px]">
            <div className="text-xs text-slate-400 uppercase font-semibold">Health Score</div>
            <div className="text-3xl font-extrabold font-mono mt-1">
              {healthScore != null ? (
                <span className={healthScore >= 80 ? 'text-emerald-400' : healthScore >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                  {healthScore.toFixed(1)}
                  <span className="text-sm font-normal text-slate-500">/100</span>
                </span>
              ) : (
                <span className="text-slate-500 text-base font-normal">N/A</span>
              )}
            </div>
            <div className="text-[10px] text-slate-400 mt-1 font-mono">
              Confidence: {health_assessment.confidence != null ? `${(health_assessment.confidence * 100).toFixed(0)}%` : '--'}
            </div>
          </div>
        </div>

        {/* Cable & Test Metadata Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
          {/* Cable Specifications */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <h4 className="font-bold text-slate-200 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-cyan-400" />
              <span>Cable Under Test</span>
            </h4>
            <div className="space-y-1.5 text-slate-300">
              <div className="flex justify-between">
                <span className="text-slate-400">Display Name:</span>
                <span className="font-semibold text-white">{cable_specifications.display_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Cable ID:</span>
                <span className="font-mono">{cable_specifications.cable_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Connector Type:</span>
                <span>{cable_specifications.connector_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Jacket Material:</span>
                <span>{cable_specifications.cable_type}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Manufacturer (Claimed):</span>
                <span className="italic">{cable_specifications.manufacturer_metadata}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Rated Power / Current:</span>
                <span>
                  {cable_specifications.rated_power_w ? `${cable_specifications.rated_power_w}W` : 'Unrated'} /{' '}
                  {cable_specifications.rated_current_a ? `${cable_specifications.rated_current_a}A` : 'Unrated'}
                  {cable_specifications.rated_voltage_v ? ` (${cable_specifications.rated_voltage_v}V)` : ''}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Length & Serial:</span>
                <span>
                  {cable_specifications.length_m ? `${cable_specifications.length_m}m` : '1.0m'} | {cable_specifications.serial_number || 'N/A'}
                </span>
              </div>
            </div>
          </div>

          {/* Electrical & Thermal Test Metrics */}
          <div className="p-4 rounded-xl bg-slate-900/60 border border-slate-800 space-y-2.5">
            <h4 className="font-bold text-slate-200 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <Zap className="w-3.5 h-3.5 text-amber-400" />
              <span>Verified Test Telemetry</span>
            </h4>
            <div className="space-y-1.5 text-slate-300 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Avg Sink Voltage:</span>
                <span>{metrics_summary.avg_sink_voltage_v ? `${metrics_summary.avg_sink_voltage_v} V` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Avg Current Draw:</span>
                <span>{metrics_summary.avg_current_a ? `${metrics_summary.avg_current_a} A` : '--'}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Calculated Voltage Drop:</span>
                <span>
                  {metrics_summary.avg_voltage_drop_v ? `${metrics_summary.avg_voltage_drop_v} V` : 'Single-Ended (N/A)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Effective Test Resistance:</span>
                <span className="font-bold text-cyan-300">
                  {metrics_summary.avg_effective_resistance_ohm
                    ? `${metrics_summary.avg_effective_resistance_ohm} Ω`
                    : 'Insufficient Data (No source ref)'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Max Surface Temperature:</span>
                <span className={metrics_summary.max_temperature_c >= 50 ? 'text-rose-400 font-bold' : ''}>
                  {metrics_summary.max_temperature_c ? `${metrics_summary.max_temperature_c} °C` : '--'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400 font-sans">Samples Evaluated:</span>
                <span>{metrics_summary.valid_samples} of {metrics_summary.total_samples} valid</span>
              </div>
            </div>
          </div>
        </div>

        {/* Explainable Diagnostic Rules Evaluated */}
        <div className="space-y-3">
          <h4 className="text-xs font-bold uppercase tracking-wider text-slate-300">
            Explainable Diagnostic Rules Breakdown
          </h4>
          <div className="border border-slate-800 rounded-xl overflow-hidden">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900 text-slate-400 uppercase text-[10px]">
                <tr>
                  <th className="py-2.5 px-3">Rule</th>
                  <th className="py-2.5 px-3">Status</th>
                  <th className="py-2.5 px-3">Observed</th>
                  <th className="py-2.5 px-3">Threshold Limit</th>
                  <th className="py-2.5 px-3">Explanation & Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 bg-slate-900/30">
                {rules.map((r: any, idx: number) => (
                  <tr key={idx}>
                    <td className="py-2 px-3 font-mono font-medium text-slate-300">{r.rule}</td>
                    <td className="py-2 px-3">
                      {r.status === 'PASS' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                          PASS
                        </span>
                      ) : r.status === 'WARN' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                          WARN
                        </span>
                      ) : r.status === 'FAIL' ? (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                          FAIL
                        </span>
                      ) : (
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-800 text-slate-400">
                          {r.status}
                        </span>
                      )}
                    </td>
                    <td className="py-2 px-3 font-mono text-slate-200">{r.observed || '--'}</td>
                    <td className="py-2 px-3 font-mono text-slate-400">{r.limit || '--'}</td>
                    <td className="py-2 px-3 text-slate-300 text-[11px]">{r.action || r.description}</td>
                  </tr>
                ))}
                {rules.length === 0 && (
                  <tr>
                    <td colSpan={5} className="py-4 text-center text-slate-500">
                      Standard baseline rules satisfied.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Recommended Actions */}
        {recommendations.length > 0 && (
          <div className="p-4 rounded-xl bg-cyan-950/20 border border-cyan-800/40 text-xs space-y-2">
            <h4 className="font-bold text-cyan-300 uppercase tracking-wide text-[11px] flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-cyan-400" />
              <span>Recommended Next Steps</span>
            </h4>
            <ul className="list-disc list-inside space-y-1 text-slate-300 text-[11px]">
              {recommendations.map((rec: string, idx: number) => (
                <li key={idx}>{rec}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Prominent Engineering Disclaimer */}
        <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-[11px] text-slate-400 leading-relaxed space-y-1">
          <div className="flex items-center gap-1.5 font-bold text-slate-300">
            <Info className="w-3.5 h-3.5 text-cyan-400" />
            <span>Operational & Scientific Disclaimer</span>
          </div>
          <p>{disclaimer}</p>
        </div>
      </div>
    </div>
  );
};
