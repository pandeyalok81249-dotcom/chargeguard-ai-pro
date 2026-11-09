import React, { useEffect, useState } from 'react';
import {
  Sliders,
  RotateCcw,
  Save,
  CheckCircle2,
  AlertTriangle,
  Info,
  ShieldCheck,
  Radio,
  HardDrive
} from 'lucide-react';
import { api } from '../api/client';
import { SystemSettings } from '../types';

export const SettingsPage: React.FC = () => {
  const [settings, setSettings] = useState<SystemSettings | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [resetModalOpen, setResetModalOpen] = useState(false);
  const [resetSuccess, setResetSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadSettings = () => {
    api.getSettings()
      .then(setSettings)
      .catch((err) => console.error('Error loading settings:', err));
  };

  useEffect(() => {
    loadSettings();
  }, []);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!settings) return;
    setIsSaving(true);
    setSaveSuccess(false);
    setErrorMessage(null);

    try {
      const updated = await api.updateSettings(settings);
      setSettings(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update settings');
    } finally {
      setIsSaving(false);
    }
  };

  const handleResetDemoData = async () => {
    try {
      await api.resetDemoData();
      setResetModalOpen(false);
      setResetSuccess(true);
      setTimeout(() => setResetSuccess(false), 3500);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reset demo data');
    }
  };

  if (!settings) {
    return <div className="py-24 text-center text-slate-400 text-sm">Loading system settings...</div>;
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto pb-16 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Sliders className="w-5 h-5 text-cyan-400" />
            <span>System Settings & Operational Limits</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Configure safety envelopes, thermal trip points, sampling intervals, and manage baseline datasets.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setResetModalOpen(true)}
          className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-amber-300 text-xs font-semibold flex items-center gap-1.5 border border-amber-900/50 cursor-pointer self-start sm:self-auto"
        >
          <RotateCcw className="w-3.5 h-3.5" />
          <span>Reset Demo Data</span>
        </button>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-lg bg-emerald-950/60 border border-emerald-800 text-emerald-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>Settings saved and applied to diagnostic engine.</span>
        </div>
      )}

      {resetSuccess && (
        <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400" />
          <span>Demo test history and baseline reference cables reset cleanly.</span>
        </div>
      )}

      {errorMessage && (
        <div className="p-3 rounded-lg bg-rose-950/60 border border-rose-800 text-rose-200 text-xs flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-rose-400" />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Safety Interlock Guarantee Banner */}
      <div className="p-4 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300 flex items-start gap-3">
        <ShieldCheck className="w-5 h-5 text-cyan-400 shrink-0 mt-0.5" />
        <div className="leading-relaxed">
          <span className="font-bold text-white">Hardware Protection Interlock:</span>{' '}
          All safety thresholds are enforced deterministically on the backend and within ESP32 micro-controller firmware.
          Web forms cannot disable independent hardware fuses, over-current trips, or thermal runaways.
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        {/* Voltage Thresholds Section */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-2">
            Voltage Envelopes (Fixed 5.0 V Profile)
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Profile Voltage Nominal (V)
              </label>
              <input
                type="number"
                step="0.05"
                disabled
                value={settings.profile_voltage_nominal_v}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-400 font-mono cursor-not-allowed"
              />
              <span className="text-[10px] text-slate-500">Fixed 5V DC student safety envelope.</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Minimum Warning Voltage (V)
              </label>
              <input
                type="number"
                step="0.05"
                value={settings.voltage_min_warning_v}
                onChange={(e) =>
                  setSettings({ ...settings, voltage_min_warning_v: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Triggers Moderate Sag alert (default 4.50V).</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Critical Minimum Voltage (V)
              </label>
              <input
                type="number"
                step="0.05"
                value={settings.voltage_min_critical_v}
                onChange={(e) =>
                  setSettings({ ...settings, voltage_min_critical_v: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Severe voltage sag threshold (default 4.20V).</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Critical Over-Voltage Trip (V)
              </label>
              <input
                type="number"
                step="0.05"
                value={settings.voltage_max_critical_v}
                onChange={(e) =>
                  setSettings({ ...settings, voltage_max_critical_v: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Instant trip disconnect threshold (default 5.60V).</span>
            </div>
          </div>
        </div>

        {/* Current & Thermal Thresholds */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-2">
            Current & Surface Thermal Cutoffs
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Max Current Warning (A)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.current_max_warning_a}
                onChange={(e) =>
                  setSettings({ ...settings, current_max_warning_a: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">High current alert threshold (default 2.40A).</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Max Current Critical (A)
              </label>
              <input
                type="number"
                step="0.1"
                value={settings.current_max_critical_a}
                onChange={(e) =>
                  setSettings({ ...settings, current_max_critical_a: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Overload trip cutoff threshold (default 3.00A).</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Cable Surface Warning Temp (°C)
              </label>
              <input
                type="number"
                step="1"
                value={settings.temperature_warning_c}
                onChange={(e) =>
                  setSettings({ ...settings, temperature_warning_c: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Elevated thermal alert (default 42.0°C).</span>
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Thermal Runaway Emergency Cutoff (°C)
              </label>
              <input
                type="number"
                step="1"
                value={settings.temperature_critical_c}
                onChange={(e) =>
                  setSettings({ ...settings, temperature_critical_c: parseFloat(e.target.value) || 0 })
                }
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              />
              <span className="text-[10px] text-slate-500">Automated safety stop limit (default 50.0°C).</span>
            </div>
          </div>
        </div>

        {/* Serial & Hardware Configuration */}
        <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
          <h3 className="text-sm font-bold text-white uppercase tracking-wider text-[11px] border-b border-slate-800 pb-2">
            Serial Bridge & Acquisition Parameters
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Default Serial Port
              </label>
              <input
                type="text"
                value={settings.serial_port}
                onChange={(e) => setSettings({ ...settings, serial_port: e.target.value })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                placeholder="COM3 or /dev/ttyUSB0"
              />
            </div>

            <div>
              <label className="block text-slate-300 font-medium mb-1">
                Serial Baud Rate
              </label>
              <select
                value={settings.baud_rate}
                onChange={(e) => setSettings({ ...settings, baud_rate: parseInt(e.target.value) })}
                className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
              >
                <option value={9600}>9600</option>
                <option value={115200}>115200</option>
                <option value={230400}>230400</option>
                <option value={460800}>460800</option>
              </select>
            </div>
          </div>
        </div>

        {/* Submit Button */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={isSaving}
            className="px-5 py-2.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs flex items-center gap-2 cursor-pointer shadow-sm shadow-cyan-950 transition-colors disabled:opacity-50"
          >
            <Save className="w-4 h-4" />
            <span>{isSaving ? 'Saving...' : 'Save System Settings'}</span>
          </button>
        </div>
      </form>

      {/* Reset Confirmation Modal */}
      {resetModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-amber-800/80 rounded-xl max-w-sm w-full p-5 shadow-2xl space-y-3">
            <h4 className="text-sm font-bold text-amber-300 flex items-center gap-2">
              <RotateCcw className="w-4 h-4 text-amber-400" />
              <span>Reset Demo Test History?</span>
            </h4>
            <p className="text-xs text-slate-300 leading-relaxed">
              This action purges all simulated test records and re-initializes clean demonstration sessions and baseline cables. Genuine physical hardware measurements are preserved.
            </p>
            <div className="flex items-center justify-end space-x-2 pt-2">
              <button
                type="button"
                onClick={() => setResetModalOpen(false)}
                className="px-3 py-1.5 rounded bg-slate-800 text-slate-300 text-xs font-medium hover:bg-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleResetDemoData}
                className="px-3.5 py-1.5 rounded bg-amber-600 text-white text-xs font-bold hover:bg-amber-500 cursor-pointer shadow-sm shadow-amber-950"
              >
                Confirm Reset
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
