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
  AlertTriangle,
  Usb,
  Copy,
  Check,
  Zap
} from 'lucide-react';
import { api } from '../api/client';
import { Device, SerialPortInfo, BridgeStatus } from '../types';

export const DeviceManagementPage: React.FC = () => {
  const [devices, setDevices] = useState<Device[]>([]);
  const [ports, setPorts] = useState<SerialPortInfo[]>([]);
  const [isScanningPorts, setIsScanningPorts] = useState(false);
  const [selectedPort, setSelectedPort] = useState<string>('COM3');
  const [copiedCmd, setCopiedCmd] = useState(false);

  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isConnectingBridge, setIsConnectingBridge] = useState(false);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newDeviceId, setNewDeviceId] = useState('');
  const [newDisplayName, setNewDisplayName] = useState('');
  const [newMode, setNewMode] = useState<'demo' | 'hardware'>('hardware');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Calibration Modal State
  const [calibratingDeviceId, setCalibratingDeviceId] = useState<string | null>(null);
  const [calibrationForm, setCalibrationForm] = useState<{
    voltage_divider_ratio: number;
    acs712_sensitivity_mv_per_a: number;
    acs712_zero_v_offset: number;
    temp_offset_c: number;
    humidity_offset_pct: number;
    dht_installed: boolean;
    notes: string;
  }>({
    voltage_divider_ratio: 5.0,
    acs712_sensitivity_mv_per_a: 100.0,
    acs712_zero_v_offset: 2.50,
    temp_offset_c: 0.0,
    humidity_offset_pct: 0.0,
    dht_installed: false,
    notes: '',
  });
  const [isSavingCalibration, setIsSavingCalibration] = useState(false);
  const [calibrationNotice, setCalibrationNotice] = useState<string | null>(null);

  const openCalibration = async (deviceId: string) => {
    setCalibratingDeviceId(deviceId);
    setCalibrationNotice(null);
    try {
      const conf = await api.getDeviceConfig(deviceId);
      setCalibrationForm({
        voltage_divider_ratio: conf.voltage_divider_ratio,
        acs712_sensitivity_mv_per_a: conf.acs712_sensitivity_mv_per_a,
        acs712_zero_v_offset: conf.acs712_zero_v_offset,
        temp_offset_c: conf.temp_offset_c,
        humidity_offset_pct: conf.humidity_offset_pct,
        dht_installed: conf.dht_installed,
        notes: conf.notes || '',
      });
    } catch {
      // Use defaults
    }
  };

  const handleSaveCalibration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!calibratingDeviceId) return;
    setIsSavingCalibration(true);
    setCalibrationNotice(null);
    try {
      await api.updateDeviceConfig(calibratingDeviceId, calibrationForm);
      setCalibrationNotice('Hardware sensor calibration parameters saved successfully!');
      setTimeout(() => {
        setCalibratingDeviceId(null);
      }, 900);
    } catch (err: any) {
      setCalibrationNotice(`Failed to save: ${err.message || 'Error'}`);
    } finally {
      setIsSavingCalibration(false);
    }
  };

  const loadDevices = () => {
    api.getDevices()
      .then(setDevices)
      .catch((err) => console.error('Error fetching devices:', err));
  };

  const scanSerialPorts = () => {
    setIsScanningPorts(true);
    api.getSerialPorts()
      .then((data) => {
        setPorts(data);
        if (data.length > 0) {
          // Auto-select likely ESP32 or first port
          const esp = data.find((p) => p.is_esp);
          setSelectedPort(esp ? esp.device : data[0].device);
        }
      })
      .catch((err) => console.error('Error scanning COM ports:', err))
      .finally(() => setIsScanningPorts(false));
  };

  const fetchBridgeStatus = () => {
    api.getBridgeStatus()
      .then(setBridgeStatus)
      .catch((err) => console.debug('Failed to get bridge status:', err));
  };

  const handleConnectBridge = async () => {
    setIsConnectingBridge(true);
    setErrorMessage(null);
    try {
      const status = await api.connectBridge(selectedPort, 115200, true);
      setBridgeStatus(status);
      loadDevices();
    } catch (err: any) {
      setErrorMessage(err.message || `Failed to connect to ${selectedPort}`);
    } finally {
      setIsConnectingBridge(false);
    }
  };

  const handleDisconnectBridge = async () => {
    setIsConnectingBridge(true);
    setErrorMessage(null);
    try {
      const status = await api.disconnectBridge();
      setBridgeStatus(status);
      loadDevices();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect bridge');
    } finally {
      setIsConnectingBridge(false);
    }
  };

  useEffect(() => {
    loadDevices();
    scanSerialPorts();
    fetchBridgeStatus();
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

  const bridgeCommand = `python device_bridge/serial_bridge.py --port ${selectedPort || 'COM3'} --baud 115200`;

  const copyToClipboard = () => {
    navigator.clipboard.writeText(bridgeCommand);
    setCopiedCmd(true);
    setTimeout(() => setCopiedCmd(false), 2000);
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
            Monitor attached ESP32 hardware rigs, scan real Windows COM ports, and manage serial bridges.
          </p>
        </div>

        <div className="flex items-center space-x-2">
          <button
            onClick={() => {
              loadDevices();
              scanSerialPorts();
            }}
            className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1.5 border border-slate-700 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningPorts ? 'animate-spin' : ''}`} />
            <span>Refresh All</span>
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

      {/* Windows Serial Ports Scanner */}
      <div className="p-5 rounded-xl bg-[#111827] border border-slate-800 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400">
              <Usb className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-semibold text-white">Windows COM Port Discovery</h3>
              <p className="text-[11px] text-slate-400">Live enumeration via PySerial hardware detection</p>
            </div>
          </div>

          <button
            onClick={scanSerialPorts}
            disabled={isScanningPorts}
            className="px-3 py-1.5 rounded-lg bg-cyan-950/80 hover:bg-cyan-900 text-cyan-300 text-xs font-medium flex items-center gap-1.5 border border-cyan-800 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isScanningPorts ? 'animate-spin' : ''}`} />
            <span>Scan Ports</span>
          </button>
        </div>

        {ports.length === 0 ? (
          <div className="p-4 rounded-lg bg-slate-900/80 border border-slate-800 text-xs text-slate-400 space-y-2">
            <div className="flex items-center space-x-2 text-amber-300 font-semibold">
              <AlertTriangle className="w-4 h-4" />
              <span>No COM ports currently detected on Windows</span>
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Ensure your ESP32 board is plugged into a USB port on this computer.
              Note that some micro-USB cables are <strong>charge-only</strong> and lack data wires (D+/D-).
              If plugged in and not visible, install the appropriate USB-to-UART driver:
              Silicon Labs CP210x or WCH CH340/CH341.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {ports.map((p) => (
                <div
                  key={p.device}
                  onClick={() => setSelectedPort(p.device)}
                  className={`p-3 rounded-lg border text-xs cursor-pointer transition-all ${
                    selectedPort === p.device
                      ? 'bg-cyan-950/30 border-cyan-500 text-cyan-200 shadow-sm shadow-cyan-950'
                      : 'bg-slate-900/60 border-slate-800 text-slate-300 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-sm text-white">{p.device}</span>
                    {p.is_esp && (
                      <span className="px-2 py-0.5 rounded text-[10px] font-semibold bg-emerald-950 text-emerald-300 border border-emerald-800">
                        ESP32 / UART
                      </span>
                    )}
                  </div>
                  <div className="text-[11px] text-slate-400 mt-1 truncate">{p.description}</div>
                  {p.hwid && <div className="text-[10px] text-slate-500 font-mono mt-0.5 truncate">{p.hwid}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Direct Hardware Connect / Disconnect Action */}
        <div className="pt-2 border-t border-slate-800/80 space-y-2">
          {bridgeStatus?.connected ? (
            <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-3">
              <div className="flex items-center gap-2.5">
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-pulse"></span>
                <div>
                  <div className="font-semibold text-emerald-300 text-xs">
                    Rig Active: {bridgeStatus.port || selectedPort}
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono">
                    Firmware: {bridgeStatus.firmware_version || 'cg-fw-1.2.0'} @ 115200 baud | Sensors: INA219={bridgeStatus.sensor_status?.ina219 || 'fault'}, DS18B20={bridgeStatus.sensor_status?.ds18b20 || 'fault'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                disabled={isConnectingBridge}
                onClick={handleDisconnectBridge}
                className="px-3 py-1.5 text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded-lg transition-colors cursor-pointer"
              >
                {isConnectingBridge ? 'Disconnecting...' : 'Disconnect Port'}
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <button
                type="button"
                disabled={isConnectingBridge}
                onClick={handleConnectBridge}
                className="flex-1 py-2 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${isConnectingBridge ? 'animate-spin' : ''}`} />
                <span>{isConnectingBridge ? `Connecting to ${selectedPort}...` : `Connect to ${selectedPort || 'COM Port'} (Direct Bridge)`}</span>
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="p-2 rounded bg-rose-950/60 border border-rose-800 text-rose-300 text-[11px]">
              {errorMessage}
            </div>
          )}
        </div>

        {/* Selected Port Bridge Launch Command (CLI Alternative) */}
        <div className="pt-2 border-t border-slate-800/80">
          <div className="text-[11px] text-slate-400 mb-1.5 flex items-center justify-between">
            <span>Or run external Python CLI bridge:</span>
            <span className="font-mono text-cyan-400 font-semibold">{selectedPort || 'COM3'}</span>
          </div>
          <div className="flex items-center space-x-2 bg-[#090d18] border border-slate-800 rounded-lg p-2.5">
            <code className="text-xs font-mono text-cyan-300 flex-1 truncate">{bridgeCommand}</code>
            <button
              onClick={copyToClipboard}
              className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium flex items-center gap-1 border border-slate-700 cursor-pointer shrink-0"
              title="Copy Command"
            >
              {copiedCmd ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
              <span>{copiedCmd ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
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
                  {d.online_status ? 'ONLINE (READY)' : 'OFFLINE (DISCONNECTED)'}
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

            {/* Actions */}
            <div className="flex items-center justify-between pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={() => openCalibration(d.device_id)}
                className="px-3 py-1.5 rounded-lg bg-cyan-950/40 hover:bg-cyan-900/40 text-cyan-300 border border-cyan-800/60 text-xs font-semibold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                <span>Calibrate Sensors</span>
              </button>
            </div>

            {d.connection_mode === 'hardware' && !d.online_status && (
              <div className="text-[11px] text-amber-400/90 bg-amber-950/20 border border-amber-900/40 p-2.5 rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                <span>Device is waiting for the Python serial bridge on {selectedPort || 'your COM port'}.</span>
              </div>
            )}
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
          The Python serial bridge establishes genuine bidirectional communication: it validates ESP32 telemetry,
          dispatches START/STOP load trigger commands, and auto-reconnects when USB cables are unplugged:
        </p>

        <div className="bg-[#090d18] border border-slate-800 rounded-lg p-3.5 font-mono text-xs text-slate-300 space-y-2">
          <div className="text-slate-500 text-[11px]"># 1. Discover COM ports</div>
          <div className="text-cyan-300">python device_bridge/serial_bridge.py --list-ports</div>
          <div className="text-slate-500 text-[11px] pt-1"># 2. Launch bridge on your detected ESP32 port</div>
          <div className="text-cyan-300">python device_bridge/serial_bridge.py --port {selectedPort || 'COM3'} --baud 115200</div>
        </div>

        <div className="p-3.5 rounded-lg bg-slate-900 border border-slate-800 text-xs text-slate-400 space-y-1">
          <div className="font-semibold text-slate-300 flex items-center gap-1.5">
            <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
            <span>Robust Hardware Safety & Handshake</span>
          </div>
          <p className="text-[11px]">
            The bridge performs a handshake with the ESP32 firmware before marking the device ONLINE.
            When a test ends or the bridge shuts down, a STOP command is immediately sent to disconnect the dummy load MOSFET.
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

      {/* Sensor Calibration Modal */}
      {calibratingDeviceId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-[#111827] border border-slate-700/80 rounded-2xl max-w-lg w-full p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div>
                <h3 className="text-base font-bold text-white flex items-center gap-2">
                  <span>Sensor Calibration & Hardware Offsets</span>
                </h3>
                <p className="text-[11px] font-mono text-cyan-400 mt-0.5">Device ID: {calibratingDeviceId}</p>
              </div>
              <button
                onClick={() => setCalibratingDeviceId(null)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                ✕
              </button>
            </div>

            {calibrationNotice && (
              <div className="p-3 rounded-lg bg-cyan-950/60 border border-cyan-800 text-cyan-200 text-xs">
                {calibrationNotice}
              </div>
            )}

            <form onSubmit={handleSaveCalibration} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Voltage Divider Ratio
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={calibrationForm.voltage_divider_ratio}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, voltage_divider_ratio: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500">e.g. 5.0 (R1=30k, R2=7.5k)</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ACS712 Sensitivity (mV/A)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={calibrationForm.acs712_sensitivity_mv_per_a}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, acs712_sensitivity_mv_per_a: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500">100 for 20A, 185 for 5A</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    ACS712 Zero Offset (V)
                  </label>
                  <input
                    type="number"
                    step="0.001"
                    required
                    value={calibrationForm.acs712_zero_v_offset}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, acs712_zero_v_offset: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500">Quiescent voltage (Vcc/2)</span>
                </div>

                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Temp Offset (°C)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={calibrationForm.temp_offset_c}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, temp_offset_c: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                  <span className="text-[10px] text-slate-500">DS18B20 calibration offset</span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 font-semibold mb-1">
                    Humidity Offset (%)
                  </label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={calibrationForm.humidity_offset_pct}
                    onChange={(e) => setCalibrationForm({ ...calibrationForm, humidity_offset_pct: parseFloat(e.target.value) })}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 font-mono focus:outline-none focus:border-cyan-500"
                  />
                </div>

                <div className="flex flex-col justify-center">
                  <label className="flex items-center space-x-2 text-slate-300 cursor-pointer pt-2">
                    <input
                      type="checkbox"
                      checked={calibrationForm.dht_installed}
                      onChange={(e) => setCalibrationForm({ ...calibrationForm, dht_installed: e.target.checked })}
                      className="rounded border-slate-700 text-cyan-500 focus:ring-0"
                    />
                    <span className="text-xs font-semibold">DHT11/22 Humidity Sensor Installed</span>
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-slate-300 font-semibold mb-1">Calibration Notes</label>
                <input
                  type="text"
                  value={calibrationForm.notes}
                  onChange={(e) => setCalibrationForm({ ...calibrationForm, notes: e.target.value })}
                  placeholder="Calibrated against Rigol DM3068 bench DMM"
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                />
              </div>

              <div className="flex items-center justify-end space-x-2 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setCalibratingDeviceId(null)}
                  className="px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-medium cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingCalibration}
                  className="px-4 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold cursor-pointer shadow-sm shadow-cyan-950 disabled:opacity-50"
                >
                  {isSavingCalibration ? 'Saving...' : 'Save Calibration Parameters'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
