import React, { useEffect, useState } from 'react';
import {
  Server,
  Plus,
  RefreshCw,
  HardDrive,
  Radio,
  Clock,
  Terminal,
  CheckCircle2,
  XCircle,
  HelpCircle,
  AlertTriangle
} from 'lucide-react';
import { api } from '../api/client';
import { Device } from '../types';

export const DeviceManagementPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newMode, setNewMode] = useState<'demo' | 'hardware'>('hardware');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const loadDevices = () => {
    api.getDevices()
      .then(setDevices)
      .catch((err) => console.error('Error fetching devices:', err));
  };

  useEffect(() => {
    loadDevices();
  }, []);

  const handleRegisterDevice = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    try {
      await api.createDevice({
        device_id: newDeviceId,
        display_name: newDisplayName,
        connection_mode: newMode,
      });
      setIsModalOpen(false);
      setNewDeviceId('');
      setNewDisplayName('');
      loadDevices();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to register device');
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <Server className="w-5 h-5 text-cyan-400" />
            <span>Device Interfaces & Test Rigs</span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Monitor attached ESP32 hardware rigs, check online heartbeats, and configure serial bridges.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={loadDevices}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>Refresh Status</span>
          </button>
          <button
            onClick={() => setIsModalOpen(true)}
            className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-sm shadow-cyan-950 cursor-pointer"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Register Device</span>
          </button>
        </div>
      </div>

      {/* Device Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {devices.map((d) => (
          <div
            key={d.device_id}
            className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4 hover:border-slate-700 transition-colors"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center space-x-3">
                <div
                  className={`w-10 h-10 rounded-lg flex items-center justify-center ${
                    d.connection_mode === 'demo'
                      ? 'bg-blue-500/10 border border-blue-500/30 text-blue-400'
                      : 'bg-emerald-500/10 border border-emerald-500/30 text-emerald-400'
                  }`}
                >
                  {d.connection_mode === 'demo' ? (
                    <Radio className="w-5 h-5" />
                  ) : (
                    <HardDrive className="w-5 h-5" />
                  )}
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-white">{d.display_name}</h3>
                  <div className="text-[11px] font-mono text-cyan-400">{d.device_id}</div>
                </div>
              </div>

              <div className="flex flex-col items-end space-y-1">
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded border ${
                    d.online_status
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800'
                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                  }`}
                >
                  <span
                    className={`w-1.5 h-1.5 rounded-full ${
                      d.online_status ? 'bg-emerald-400 animate-pulse' : 'bg-rose-500'
                    }`}
                  ></span>
                  {d.online_status ? 'ONLINE' : 'OFFLINE'}
                </span>
                <span className="text-[10px] uppercase font-bold text-slate-500 font-mono">
                  {d.connection_mode} mode
                </span>
              </div>
            </div>

            {/* Specs & State */}
            <div className="grid grid-cols-2 gap-3 text-xs bg-slate-900/60 p-3 rounded-lg border border-slate-800/80">
              <div>
                <span className="text-slate-400 text-[11px]">Firmware Version:</span>
                <div className="font-mono text-slate-200 mt-0.5">
                  {d.firmware_version || 'N/A'}
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Last Telemetry Frame:</span>
                <div className="font-mono text-slate-200 mt-0.5">
                  {d.last_seen_at ? new Date(d.last_seen_at).toLocaleTimeString() : 'Never seen'}
                </div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Attached Sensors:</span>
                <div className="text-slate-300 mt-0.5">INA219 (V/I), DS18B20 (T)</div>
              </div>
              <div>
                <span className="text-slate-400 text-[11px]">Safety Cutoff:</span>
                <div className="text-emerald-400 mt-0.5">Hardware Interlock Armed</div>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Serial Bridge Setup Guide */}
      <div className="p-6 rounded-2xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
        <h3 className="text-sm font-bold text-white flex items-center gap-2">
          <Terminal className="w-4 h-4 text-cyan-400" />
          <span>Connecting Physical ESP32 Hardware via Serial Bridge</span>
        </h3>
        <p className="text-xs text-slate-300 leading-relaxed">
          To transition from Demo mode to real physical measurements without rewriting any code, flash the provided Arduino firmware to your ESP32 and run the serial-to-backend bridge:
        </p>

        <div className="bg-[#090d18] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-slate-500 text-[11px]"># 1. Install bridge requirements</div>
          <div className="text-cyan-300">cd device_bridge && pip install -r requirements.txt</div>
          <div className="text-slate-500 text-[11px] pt-1"># 2. Start bridge on your ESP32 COM port (e.g. COM3 or /dev/ttyUSB0)</div>
          <div className="text-cyan-300">python serial_bridge.py --port COM3 --baud 115200</div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Robust USB Disconnect Handling</span>
          </div>
          <p className="text-[11px]">
            The serial bridge automatically reconnects upon USB plug/unplug events and handles malformed serial noise without crashing.
          </p>
        </div>
      </div>

      {/* Modal for Device Registration */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-800 rounded-xl max-w-sm w-full p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-bold text-white">Register Test Rig</h3>

            {errorMessage && (
              <div className="p-2.5 rounded bg-rose-950/60 border border-rose-800 text-rose-200 text-xs">
                {errorMessage}
              </div>
            )}

            <form onSubmit={handleRegisterDevice} className="space-y-3 text-xs">
              <div>
                <label className="block text-slate-300 font-medium mb-1">Device ID</label>
                <input
                  type="text"
                  required
                  value={newDeviceId}
                  onChange={(e) => setNewDeviceId(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. cg-esp32-002"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Display Name</label>
                <input
                  type="text"
                  required
                  value={newDisplayName}
                  onChange={(e) => setNewDisplayName(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                  placeholder="e.g. Lab Bench #2 Test Rig"
                />
              </div>

              <div>
                <label className="block text-slate-300 font-medium mb-1">Connection Mode</label>
                <select
                  value={newMode}
                  onChange={(e) => setNewMode(e.target.value as any)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-slate-200 focus:outline-none focus:border-cyan-500"
                >
                  <option value="hardware">Hardware Rig (ESP32 Serial)</option>
                  <option value="demo">Demo (Simulator)</option>
                </select>
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3.5 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-cyan-950"
                >
                  Register
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
