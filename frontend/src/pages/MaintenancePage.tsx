import React, { useState, useEffect } from 'react';
import {
  Wrench,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Plus,
  ShieldAlert,
  ClipboardList,
  Sparkles,
  ChevronRight,
  Filter,
  Check
} from 'lucide-react';
import { api } from '../api/client';
import { MaintenanceRecommendation, MaintenanceRecord, Cable } from '../types';

export const MaintenancePage: React.FC = () => {
  const [recommendations, setRecommendations] = useState<MaintenanceRecommendation[]>([]);
  const [records, setRecords] = useState<MaintenanceRecord[]>([]);
  const [cables, setCables] = useState<Cable[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showLogModal, setShowLogModal] = useState<boolean>(false);

  // Form State
  const [selectedCableId, setSelectedCableId] = useState<string>('');
  const [actionType, setActionType] = useState<string>('cleaning');
  const [notes, setNotes] = useState<string>('');
  const [performedBy, setPerformedBy] = useState<string>('Hardware Technician');
  const [submitting, setSubmitting] = useState<boolean>(false);

  const loadData = async () => {
    setLoading(true);
    try {
      const [recs, recList, cableList] = await Promise.all([
        api.getMaintenanceRecommendations().catch(() => []),
        api.getMaintenanceRecords().catch(() => []),
        api.getCables().catch(() => []),
      ]);
      setRecommendations(recs);
      setRecords(recList);
      setCables(cableList);
      if (cableList.length > 0 && !selectedCableId) {
        setSelectedCableId(cableList[0].cable_id);
      }
    } catch (err) {
      console.error('Error loading maintenance data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleResolveRecord = async (recordId: number) => {
    try {
      await api.resolveMaintenanceRecord(recordId);
      loadData();
    } catch (err) {
      console.error('Failed to resolve maintenance record:', err);
    }
  };

  const handleCreateRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCableId || !notes) return;
    setSubmitting(true);
    try {
      await api.createMaintenanceRecord({
        cable_id: selectedCableId,
        action_type: actionType,
        notes,
        performed_by: performedBy,
      });
      setShowLogModal(false);
      setNotes('');
      loadData();
    } catch (err) {
      console.error('Failed to create maintenance record:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const getPriorityBadge = (priority: string) => {
    switch (priority) {
      case 'immediate':
        return 'bg-rose-950 text-rose-300 border-rose-800';
      case 'high':
        return 'bg-amber-950 text-amber-300 border-amber-800';
      case 'medium':
        return 'bg-blue-950 text-blue-300 border-blue-800';
      default:
        return 'bg-slate-800 text-slate-300 border-slate-700';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <Wrench className="w-6 h-6 text-cyan-400" />
            <span>Hardware Maintenance & Quality Assurance Center</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Condition-based physical maintenance recommendations, contact cleaning protocols, and service logs.
          </p>
        </div>

        <button
          onClick={() => setShowLogModal(true)}
          className="px-3.5 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer shadow-lg shadow-cyan-950 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>Log Maintenance Action</span>
        </button>
      </div>

      {/* Dynamic Telemetry-Driven Recommendations */}
      <div className="space-y-3">
        <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-cyan-400" />
            <span>Active Maintenance Recommendations ({recommendations.length})</span>
          </span>
          <span className="text-[11px] text-slate-500 font-mono">Dynamic Rule & ML Evaluated</span>
        </div>

        {recommendations.length === 0 ? (
          <div className="p-8 rounded-2xl bg-[#0f172a] border border-slate-800 text-center space-y-2">
            <CheckCircle2 className="w-8 h-8 text-emerald-400 mx-auto" />
            <h3 className="text-sm font-semibold text-white">All Monitored Cables Within Physical Nominal Limits</h3>
            <p className="text-xs text-slate-400 max-w-md mx-auto">
              No immediate contact cleaning, thermal quarantine, or strain relief replacement required.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {recommendations.map((rec) => (
              <div
                key={rec.id}
                className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl flex flex-col justify-between space-y-3"
              >
                <div>
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-bold text-white tracking-wide">{rec.cable_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase border ${getPriorityBadge(rec.priority)}`}>
                      {rec.priority}
                    </span>
                  </div>

                  <h4 className="text-sm font-bold text-cyan-300 mt-1">{rec.title}</h4>
                  <p className="text-xs text-slate-300 mt-2 leading-relaxed bg-slate-900/60 p-3 rounded-xl border border-slate-800/80">
                    <strong className="text-cyan-400 block mb-1">Required Protocol:</strong>
                    {rec.action_needed}
                  </p>
                </div>

                <div className="pt-3 border-t border-slate-800/80 text-[11px] text-slate-400 space-y-1">
                  <div className="flex justify-between">
                    <span>Observed Metric:</span>
                    <span className="font-mono text-slate-200">{rec.observed_metric}</span>
                  </div>
                  <div className="text-[10px] text-slate-500 italic">
                    Rationale: {rec.rationale}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Maintenance History & Service Log Table */}
      <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
        <div className="flex items-center justify-between border-b border-slate-800 pb-3">
          <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
            <ClipboardList className="w-4 h-4 text-cyan-400" />
            <span>Maintenance History & Action Log</span>
          </div>
          <span className="text-[11px] text-slate-500 font-mono">{records.length} records</span>
        </div>

        {records.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500">
            No maintenance records logged yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead>
                <tr className="border-b border-slate-800 text-slate-400 font-mono text-[11px]">
                  <th className="pb-2.5 font-medium">Cable ID</th>
                  <th className="pb-2.5 font-medium">Action Type</th>
                  <th className="pb-2.5 font-medium">Technician</th>
                  <th className="pb-2.5 font-medium">Observations & Notes</th>
                  <th className="pb-2.5 font-medium">Date</th>
                  <th className="pb-2.5 font-medium">Status</th>
                  <th className="pb-2.5 font-medium text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {records.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-900/40 transition-colors">
                    <td className="py-3 font-mono text-cyan-400 font-semibold">{r.cable_id}</td>
                    <td className="py-3">
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold uppercase bg-slate-800 text-slate-200">
                        {r.action_type.replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="py-3 text-slate-300">{r.performed_by}</td>
                    <td className="py-3 text-slate-300 max-w-xs truncate">{r.notes}</td>
                    <td className="py-3 text-slate-400 font-mono text-[11px]">
                      {new Date(r.created_at).toLocaleDateString()}
                    </td>
                    <td className="py-3">
                      {r.resolved ? (
                        <span className="inline-flex items-center gap-1 text-[11px] text-emerald-400 font-medium">
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Resolved</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] text-amber-400 font-medium">
                          <Clock className="w-3.5 h-3.5" />
                          <span>Open</span>
                        </span>
                      )}
                    </td>
                    <td className="py-3 text-right">
                      {!r.resolved && (
                        <button
                          onClick={() => handleResolveRecord(r.id)}
                          className="px-2.5 py-1 rounded bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-300 border border-emerald-500/40 text-[11px] font-semibold transition-colors cursor-pointer"
                        >
                          Resolve
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Maintenance Action Modal */}
      {showLogModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-lg bg-[#0f172a] border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Wrench className="w-4 h-4 text-cyan-400" />
                <span>Log Maintenance / Inspection Action</span>
              </h3>
              <button
                onClick={() => setShowLogModal(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            <form onSubmit={handleCreateRecord} className="space-y-3.5">
              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Cable Under Service</label>
                <select
                  value={selectedCableId}
                  onChange={(e) => setSelectedCableId(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  {cables.map((c) => (
                    <option key={c.cable_id} value={c.cable_id}>
                      {c.display_name} ({c.cable_id})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Maintenance Protocol Type</label>
                <select
                  value={actionType}
                  onChange={(e) => setActionType(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                >
                  <option value="cleaning">DeoxIT Contact Cleaning & Gold Wipe</option>
                  <option value="connector_repair">Connector Pin Straightening / Repair</option>
                  <option value="strain_relief_replacement">Strain Relief Boot Reinforcement</option>
                  <option value="inspection_pass">Routine Physical Inspection - Passed</option>
                  <option value="quarantine">Quarantine - High Resistance Deviation</option>
                  <option value="decommission">Decommission & Scrap - Thermal Runaway</option>
                </select>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Technician / Operator</label>
                <input
                  type="text"
                  required
                  value={performedBy}
                  onChange={(e) => setPerformedBy(e.target.value)}
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-300 block mb-1">Observations & Work Log</label>
                <textarea
                  required
                  rows={3}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Applied 99% isopropyl alcohol and contact protectant. Verified pin resistance dropped from 0.082Ω to 0.045Ω."
                  className="w-full px-3 py-2 bg-slate-900 border border-slate-800 rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="pt-2 flex gap-3">
                <button
                  type="button"
                  onClick={() => setShowLogModal(false)}
                  className="flex-1 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="flex-1 py-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-bold transition-all shadow-lg shadow-cyan-950 cursor-pointer disabled:opacity-50"
                >
                  {submitting ? 'Recording...' : 'Commit Maintenance Record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
