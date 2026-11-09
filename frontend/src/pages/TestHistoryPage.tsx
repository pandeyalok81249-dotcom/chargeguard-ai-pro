import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  History,
  Download,
  Filter,
  Search,
  FileText,
  Clock,
  ShieldCheck,
  AlertTriangle,
  AlertOctagon,
  HelpCircle,
  ArrowUpDown,
  Activity,
  X
} from 'lucide-react';
import { api } from '../api/client';
import { TestSessionSummary, Measurement } from '../types';

export const TestHistoryPage: React.FC = () => {
  const navigate = useNavigate();
  const [tests, setTests] = useState<TestSessionSummary[]>([]);
  const [cableIdQuery, setCableIdQuery] = useState('');
  const [modeFilter, setModeFilter] = useState('');
  const [resultFilter, setResultFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [sortOrder, setSortOrder] = useState<'desc' | 'asc'>('desc');
  const [limit, setLimit] = useState(25);
  const [offset, setOffset] = useState(0);

  // Inspector modal state
  const [inspectTestId, setInspectTestId] = useState<string | null>(null);
  const [inspectMeasurements, setInspectMeasurements] = useState<Measurement[]>([]);
  const [isLoadingMeasurements, setIsLoadingMeasurements] = useState(false);

  const loadTests = () => {
    api.getTests({
      cable_id: cableIdQuery || undefined,
      mode: modeFilter || undefined,
      result: resultFilter || undefined,
      date: dateFilter || undefined,
      sort_order: sortOrder,
      limit,
      offset,
    })
      .then(setTests)
      .catch((err) => console.error('Error loading tests:', err));
  };

  useEffect(() => {
    loadTests();
  }, [cableIdQuery, modeFilter, resultFilter, dateFilter, sortOrder, limit, offset]);

  const handleInspect = (testId: string) => {
    setInspectTestId(testId);
    setIsLoadingMeasurements(true);
    api.getTestMeasurements(testId)
      .then(setInspectMeasurements)
      .catch((err) => console.error('Error loading test measurements:', err))
      .finally(() => setIsLoadingMeasurements(false));
  };

  const csvDownloadUrl = api.getExportCsvUrl(
    cableIdQuery || undefined,
    modeFilter || undefined,
    resultFilter || undefined,
    dateFilter || undefined
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <History className="w-5 h-5 text-cyan-400" />
            <span>Test History & Bench Archive</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Query persisted test records from SQLite database, export full telemetry CSV, or print certified screening reports.
          </p>
        </div>

        <a
          href={csvDownloadUrl}
          download
          className="px-3.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-emerald-950 cursor-pointer self-start sm:self-auto"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Tests (CSV)</span>
        </a>
      </div>

      {/* Filter and Search Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3 items-center">
        <div className="sm:col-span-2 relative">
          <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search by cable ID or name..."
            value={cableIdQuery}
            onChange={(e) => setCableIdQuery(e.target.value)}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg pl-9 pr-3 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
          />
        </div>

        <div>
          <select
            value={modeFilter}
            onChange={(e) => setModeFilter(e.target.value)}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Test Modes</option>
            <option value="demo">Demo (Simulated)</option>
            <option value="hardware">Hardware (ESP32)</option>
          </select>
        </div>

        <div>
          <select
            value={resultFilter}
            onChange={(e) => setResultFilter(e.target.value)}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg px-3 py-2 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
          >
            <option value="">All Health Categories</option>
            <option value="healthy">Healthy</option>
            <option value="warning">Warning</option>
            <option value="critical">Critical</option>
            <option value="insufficient_data">Insufficient Data</option>
          </select>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="w-full bg-[#111827] border border-slate-800 rounded-lg px-2.5 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-cyan-500"
            title="Filter by test date"
          />
          <button
            onClick={() => setSortOrder(sortOrder === 'desc' ? 'asc' : 'desc')}
            className="px-2.5 py-2 bg-[#111827] border border-slate-800 rounded-lg text-xs text-slate-300 hover:text-white shrink-0"
            title={`Sort Date ${sortOrder === 'desc' ? 'Newest First' : 'Oldest First'}`}
          >
            {sortOrder === 'desc' ? 'NEW' : 'OLD'}
          </button>
        </div>
      </div>

      {/* Test Records Table */}
      <div className="floating-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="text-[11px] text-slate-400 uppercase bg-slate-900/80 border-b border-slate-800">
              <tr>
                <th className="py-3 px-4">Test Identifier</th>
                <th className="py-3 px-4">Cable Under Test</th>
                <th className="py-3 px-4">Mode</th>
                <th className="py-3 px-4">Result</th>
                <th className="py-3 px-4">Health Score</th>
                <th className="py-3 px-4">Avg Drop / R</th>
                <th className="py-3 px-4">Max Temp</th>
                <th className="py-3 px-4">Alerts</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {tests.map((t) => (
                <tr key={t.test_id} className="hover:bg-slate-800/30 transition-colors">
                  <td className="py-3 px-4">
                    <div className="font-mono font-medium text-slate-200">{t.test_id}</div>
                    <div className="text-[10px] text-slate-500 flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" />
                      <span>{new Date(t.started_at).toLocaleString()}</span>
                    </div>
                  </td>

                  <td className="py-3 px-4">
                    <div className="font-medium text-slate-200">{t.cable_name || t.cable_id}</div>
                    <div className="text-[10px] text-slate-500 font-mono">{t.cable_id}</div>
                  </td>

                  <td className="py-3 px-4">
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900 border border-slate-800 text-slate-300 uppercase">
                      {t.mode}
                    </span>
                  </td>

                  <td className="py-3 px-4">
                    {t.final_result === 'healthy' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                        <ShieldCheck className="w-3 h-3 text-emerald-400" /> HEALTHY
                      </span>
                    ) : t.final_result === 'warning' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800">
                        <AlertTriangle className="w-3 h-3 text-amber-400" /> WARNING
                      </span>
                    ) : t.final_result === 'critical' ? (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                        <AlertOctagon className="w-3 h-3 text-rose-400" /> CRITICAL
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-slate-800 text-slate-400">
                        <HelpCircle className="w-3 h-3 text-slate-400" /> INSUFFICIENT DATA
                      </span>
                    )}
                  </td>

                  <td className="py-3 px-4 font-mono font-bold">
                    {t.health_score != null ? (
                      <span className={t.health_score >= 80 ? 'text-emerald-400' : t.health_score >= 50 ? 'text-amber-400' : 'text-rose-400'}>
                        {t.health_score.toFixed(1)}/100
                      </span>
                    ) : (
                      <span className="text-slate-500 font-normal">--</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-slate-400 font-mono text-[11px]">
                    {t.avg_voltage_drop_v != null ? `${t.avg_voltage_drop_v.toFixed(3)}V` : '--'} /{' '}
                    {t.avg_resistance_ohm != null ? `${t.avg_resistance_ohm.toFixed(3)}Ω` : '--'}
                  </td>

                  <td className="py-3 px-4 font-mono text-[11px]">
                    {t.max_temperature_c != null ? (
                      <span className={t.max_temperature_c >= 50 ? 'text-rose-400 font-bold' : t.max_temperature_c >= 42 ? 'text-amber-400' : 'text-slate-300'}>
                        {t.max_temperature_c.toFixed(1)}°C
                      </span>
                    ) : (
                      <span className="text-slate-500">--</span>
                    )}
                  </td>

                  <td className="py-3 px-4">
                    {t.alert_count > 0 ? (
                      <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-950/80 text-rose-300 border border-rose-800">
                        {t.alert_count} alert{t.alert_count > 1 ? 's' : ''}
                      </span>
                    ) : (
                      <span className="text-[10px] text-slate-500">0 alerts</span>
                    )}
                  </td>

                  <td className="py-3 px-4 text-right space-x-2">
                    <button
                      onClick={() => handleInspect(t.test_id)}
                      className="text-slate-400 hover:text-cyan-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      title="Inspect recorded measurements"
                    >
                      <Activity className="w-3.5 h-3.5" />
                      <span>Inspect</span>
                    </button>

                    <button
                      onClick={() => navigate(`/report/${t.test_id}`)}
                      className="text-cyan-400 hover:text-cyan-300 text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                    >
                      <FileText className="w-3.5 h-3.5" />
                      <span>Report</span>
                    </button>

                    <a
                      href={api.getSingleTestExportCsvUrl(t.test_id)}
                      download
                      className="text-slate-400 hover:text-emerald-400 text-xs font-medium inline-flex items-center gap-0.5 cursor-pointer"
                      title="Download Time-series CSV"
                    >
                      <Download className="w-3 h-3" />
                    </a>
                  </td>
                </tr>
              ))}

              {tests.length === 0 && (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-slate-500 text-xs">
                    No test sessions match query filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination bar */}
        <div className="p-3.5 border-t border-slate-800 bg-slate-900/40 flex items-center justify-between text-xs text-slate-400">
          <span>Showing up to {limit} records per page</span>
          <div className="flex items-center space-x-2">
            <button
              disabled={offset === 0}
              onClick={() => setOffset(Math.max(0, offset - limit))}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              Previous
            </button>
            <span className="font-mono text-slate-200">Page {Math.floor(offset / limit) + 1}</span>
            <button
              disabled={tests.length < limit}
              onClick={() => setOffset(offset + limit)}
              className="px-2.5 py-1 rounded bg-slate-800 text-slate-300 disabled:opacity-40 cursor-pointer"
            >
              Next
            </button>
          </div>
        </div>
      </div>

      {/* Telemetry Inspection Modal */}
      {inspectTestId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-3xl w-full p-6 shadow-2xl space-y-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <Activity className="w-4 h-4 text-cyan-400" />
                  <span>Telemetry Measurements Stream</span>
                </h3>
                <div className="text-xs font-mono text-slate-400">{inspectTestId}</div>
              </div>
              <button
                onClick={() => setInspectTestId(null)}
                className="p-1 rounded text-slate-400 hover:text-white hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {isLoadingMeasurements ? (
              <div className="py-12 text-center text-xs text-slate-500">Loading measurements...</div>
            ) : inspectMeasurements.length > 0 ? (
              <div className="border border-slate-800 rounded-lg overflow-hidden max-h-96 overflow-y-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-900 text-[10px] text-slate-400 uppercase sticky top-0">
                    <tr>
                      <th className="py-2 px-3">Time</th>
                      <th className="py-2 px-3">Sink V</th>
                      <th className="py-2 px-3">Source V</th>
                      <th className="py-2 px-3">Drop V</th>
                      <th className="py-2 px-3">Current A</th>
                      <th className="py-2 px-3">Power W</th>
                      <th className="py-2 px-3">Temp °C</th>
                      <th className="py-2 px-3">Valid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/60 bg-slate-900/40 font-mono text-[11px]">
                    {inspectMeasurements.map((m, idx) => (
                      <tr key={idx} className="hover:bg-slate-800/40">
                        <td className="py-1.5 px-3 text-slate-400">
                          {new Date(m.timestamp).toLocaleTimeString()}
                        </td>
                        <td className="py-1.5 px-3 text-cyan-300">
                          {m.sink_voltage_v != null ? `${m.sink_voltage_v.toFixed(3)}V` : '--'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-400">
                          {m.source_voltage_v != null ? `${m.source_voltage_v.toFixed(3)}V` : 'N/A'}
                        </td>
                        <td className="py-1.5 px-3 text-amber-300">
                          {m.voltage_drop_v != null ? `${m.voltage_drop_v.toFixed(3)}V` : '--'}
                        </td>
                        <td className="py-1.5 px-3 text-white">
                          {m.current_a != null ? `${m.current_a.toFixed(3)}A` : '--'}
                        </td>
                        <td className="py-1.5 px-3 text-slate-300">
                          {m.power_w != null ? `${m.power_w.toFixed(2)}W` : '--'}
                        </td>
                        <td className="py-1.5 px-3 text-rose-300">
                          {m.temperature_c != null ? `${m.temperature_c.toFixed(1)}°C` : '--'}
                        </td>
                        <td className="py-1.5 px-3">
                          <span className={`text-[10px] px-1.5 py-0.2 rounded ${
                            m.measurement_valid ? 'bg-emerald-950 text-emerald-400' : 'bg-rose-950 text-rose-400'
                          }`}>
                            {m.measurement_valid ? 'OK' : 'INVALID'}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="py-8 text-center text-xs text-slate-500">
                No telemetry measurement samples found for this session.
              </div>
            )}

            <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
              <span className="text-slate-500 font-mono text-[11px]">
                Total samples: {inspectMeasurements.length}
              </span>
              <div className="flex items-center gap-2">
                <a
                  href={api.getSingleTestExportCsvUrl(inspectTestId)}
                  download
                  className="px-3 py-1.5 rounded bg-emerald-600 hover:bg-emerald-500 text-white font-semibold flex items-center gap-1"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download CSV</span>
                </a>
                <button
                  onClick={() => setInspectTestId(null)}
                  className="px-3 py-1.5 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
