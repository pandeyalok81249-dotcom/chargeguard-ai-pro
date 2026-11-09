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
  Clock,
  HardDrive,
  Flame,
  Sliders,
  Volume2,
  VolumeX,
  Sparkles,
  RefreshCw
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
import { Cable, Device, DashboardSummary, DeviceStatusPayload, BridgeStatus } from '../types';
import { LiveTelemetryPayload } from '../hooks/useWebSocket';
import { InteractiveCableWireVisualizer } from '../components/telemetry/InteractiveCableWireVisualizer';
import { audioAlerts } from '../utils/soundAlert';

interface TestingContext {
  summary: DashboardSummary | null;
  onRefreshSummary: () => void;
  latestTelemetry: LiveTelemetryPayload | null;
  latestDeviceStatus?: DeviceStatusPayload | null;
  wsConnected: boolean;
}

export const LiveTestingPage: React.FC = () => {
  const { summary, onRefreshSummary, latestTelemetry, latestDeviceStatus, wsConnected } = useOutletContext<TestingContext>();
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
  const [ports, setPorts] = useState<Array<{ device: string; description: string; is_esp: boolean }>>([]);
  const [selectedPort, setSelectedPort] = useState<string>('COM3');
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);

  // Dynamic Real-Time Physics & Stress Controls
  const [targetLoadCurrent, setTargetLoadCurrent] = useState<number>(1.5);
  const [isThermalStress, setIsThermalStress] = useState<boolean>(false);
  const [isFlexStress, setIsFlexStress] = useState<boolean>(false);
  const [isAudioMuted, setIsAudioMuted] = useState<boolean>(false);

  // Hardware Bridge Direct Connection State
  const [bridgeStatus, setBridgeStatus] = useState<BridgeStatus | null>(null);
  const [isConnectingBridge, setIsConnectingBridge] = useState<boolean>(false);

  const fetchBridgeStatus = () => {
    api.getBridgeStatus()
      .then(setBridgeStatus)
      .catch((err) => console.debug('Failed to get bridge status:', err));
  };

  const handleConnectBridge = async (forceUnlock: boolean = true) => {
    setIsConnectingBridge(true);
    setErrorMessage(null);
    try {
      const status = await api.connectBridge(selectedPort, 115200, forceUnlock);
      setBridgeStatus(status);
      const devs = await api.getDevices();
      setDevices(devs);
      onRefreshSummary();
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
      const devs = await api.getDevices();
      setDevices(devs);
      onRefreshSummary();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to disconnect bridge');
    } finally {
      setIsConnectingBridge(false);
    }
  };

  // Active test ID if a test is ongoing
  const activeTest = summary?.active_test;
  const isRunning = activeTest != null;

  // Track elapsed test time
  useEffect(() => {
    let interval: any = null;
    if (isRunning) {
      setElapsedSeconds(0);
      interval = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setElapsedSeconds(0);
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [isRunning]);

  // Read URL search params for pre-selected cable & poll bridge/ports
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const cParam = params.get('cable');
    if (cParam) {
      setSelectedCableId(cParam);
    }
    fetchBridgeStatus();

    const fetchPorts = () => {
      api.getSerialPorts()
        .then((data) => {
          setPorts(data);
          if (data.length > 0) {
            const esp = data.find((p) => p.is_esp);
            if (esp && !bridgeStatus?.connected) {
              setSelectedPort(esp.device);
            }
          }
        })
        .catch((err) => console.debug('Error fetching COM ports:', err));
    };

    fetchPorts();
    const interval = setInterval(() => {
      fetchBridgeStatus();
      fetchPorts();
    }, 2500);

    return () => clearInterval(interval);
  }, [bridgeStatus?.connected]);

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
        const defaultDev = data.find((d) => d.connection_mode === testMode) || data[0];
        if (defaultDev) {
          setSelectedDeviceId(defaultDev.device_id);
        }
      })
      .catch((err) => console.error('Error fetching devices:', err));
  }, [testMode, latestDeviceStatus]);

  // Append incoming telemetry to chart & trigger audible alert on overheat
  useEffect(() => {
    if (latestTelemetry && isRunning) {
      const liveT = latestTelemetry.temperature_c ?? 0;
      if (liveT >= 50.0) {
        audioAlerts.playCriticalOverheatAlarm();
      } else if (liveT >= 42.0) {
        audioAlerts.playOverheatWarning();
      }

      setChartData((prev) => {
        const timeLabel = new Date(latestTelemetry.timestamp).toLocaleTimeString();
        const pt = {
          time: timeLabel,
          sinkVoltage: latestTelemetry.sink_voltage_v ?? 0,
          sourceVoltage: latestTelemetry.source_voltage_v ?? null,
          current: latestTelemetry.current_a ?? 0,
          temperature: liveT,
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
    setIsThermalStress(simScenario === 'overheating');
    setIsFlexStress(false);

    try {
      if (testMode === 'hardware' && !bridgeStatus?.connected) {
        try {
          const autoBridge = await api.connectBridge(selectedPort || 'auto', 115200, true);
          setBridgeStatus(autoBridge);
        } catch (connErr: any) {
          console.debug('Auto-connect bridge:', connErr);
        }
      }

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

  // Real-time Physics Adjustment Handlers
  const handleAdjustLoad = async (newLoadA: number) => {
    setTargetLoadCurrent(newLoadA);
    if (isRunning && activeTest && testMode === 'demo') {
      try {
        await api.controlTest(activeTest.test_id, { load_current_a: newLoadA });
      } catch (err) {
        console.error('Failed to update load current:', err);
      }
    }
  };

  const handleTriggerThermalStress = async () => {
    const nextStress = !isThermalStress;
    setIsThermalStress(nextStress);
    if (isRunning && activeTest && testMode === 'demo') {
      try {
        await api.controlTest(activeTest.test_id, {
          thermal_stress: nextStress,
          load_current_a: nextStress ? 2.6 : targetLoadCurrent,
        });
      } catch (err) {
        console.error('Failed to trigger thermal stress:', err);
      }
    }
  };

  const handleToggleFlexStress = async () => {
    const nextFlex = !isFlexStress;
    setIsFlexStress(nextFlex);
    if (isRunning && activeTest && testMode === 'demo') {
      try {
        await api.controlTest(activeTest.test_id, { flex_stress: nextFlex });
      } catch (err) {
        console.error('Failed to toggle flex stress:', err);
      }
    }
  };

  // Find selected hardware device to verify online status
  const currentDev = devices.find((d) => d.device_id === selectedDeviceId);
  const isHardwareOffline = testMode === 'hardware' && !bridgeStatus?.connected && (!currentDev || !currentDev.online_status);
  const selectedCable = cables.find((c) => c.cable_id === selectedCableId);

  // Freshness & connection state calculation
  const now = Date.now();
  const lastTelemetryTime = latestTelemetry?.timestamp ? new Date(latestTelemetry.timestamp).getTime() : 0;
  const isDataStale = isRunning && lastTelemetryTime > 0 && (now - lastTelemetryTime > 6000);
  const isWaitingForData = isRunning && testMode === 'hardware' && (!latestTelemetry || latestTelemetry.mode !== 'hardware' || chartData.length === 0);

  // Derived telemetry metrics
  const liveSinkV = latestTelemetry?.sink_voltage_v ?? 0;
  const liveSourceV = latestTelemetry?.source_voltage_v ?? null;
  const liveCurrent = latestTelemetry?.current_a ?? 0;
  const livePower = latestTelemetry?.power_w ?? 0;
  const liveTemp = latestTelemetry?.temperature_c ?? 0;
  const liveDrop = latestTelemetry?.voltage_drop_v ?? null;
  const liveResist = latestTelemetry?.effective_resistance_ohm ?? null;
  const isPaired = liveSourceV != null && liveSinkV > 0;

  // Overheat Alert Logic - only active when test is actively running and temperature is genuinely elevated
  const isOverheatCrit = isRunning && liveTemp >= 50.0;
  const isOverheatWarn = isRunning && liveTemp >= 42.0;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Top Banner */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
            <span>Test Cockpit & Sensor Stream</span>
            {testMode === 'demo' ? (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                DYNAMIC PHYSICS SIMULATION
              </span>
            ) : (
              <span className="text-xs font-bold px-2.5 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                ESP32 HARDWARE RIG
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Real-time differential voltage drop, Joule heating physics, and dynamic contact resistance analysis.
          </p>
        </div>

        {/* View Report if recent test ended */}
        {latestTelemetry && !isRunning && (
          <div className="flex items-center gap-2">
            <a
              href={api.getTestReportPdfUrl(latestTelemetry.test_id)}
              target="_blank"
              rel="noreferrer"
              className="px-3.5 py-1.5 rounded-lg bg-cyan-600/20 hover:bg-cyan-600/30 text-cyan-300 text-xs font-semibold flex items-center gap-1.5 border border-cyan-500/40 cursor-pointer transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Download PDF Report</span>
            </a>
            <button
              onClick={() => navigate(`/report/${latestTelemetry.test_id}`)}
              className="px-3.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold flex items-center gap-1.5 border border-slate-700 cursor-pointer transition-colors shadow-sm"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Interactive Cockpit Report</span>
            </button>
          </div>
        )}
      </div>

      {/* OVERHEAT WARNING ALERT BANNER */}
      {isOverheatWarn && (
        <div
          className={`p-4 rounded-xl border transition-all duration-300 ${
            isOverheatCrit
              ? 'overheat-hazard-pulse border-rose-500 bg-rose-950/80 text-rose-100 shadow-xl shadow-rose-950/60'
              : 'border-amber-500 bg-amber-950/80 text-amber-100 shadow-xl shadow-amber-950/60'
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
                <Flame className="w-6 h-6 fill-current" />
              </div>
              <div>
                <div className="font-bold text-sm tracking-wide flex items-center gap-2">
                  <span>
                    {isOverheatCrit
                      ? 'CRITICAL THERMAL RUNAWAY — SAFETY CUTOFF TRIGGERED'
                      : 'WARNING: THERMAL ELEVATION DETECTED'}
                  </span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-md bg-black/50 border border-white/20 font-bold">
                    {liveTemp.toFixed(1)}°C (Limit: 50.0°C)
                  </span>
                </div>
                <p className="text-xs opacity-90 mt-0.5 leading-snug">
                  {isOverheatCrit
                    ? 'Excessive Joule heating (I²R) exceeded safety threshold (50.0°C). Load immediately disconnected to prevent connector melting or fire hazard.'
                    : 'Cable connector temperature is rising abnormally due to contact degradation or high load current. Approaching safety trip boundary.'}
                </p>
              </div>
            </div>

            {/* Audio alert mute toggle */}
            <div className="flex items-center space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  const nextMute = !isAudioMuted;
                  setIsAudioMuted(nextMute);
                  audioAlerts.setMuted(nextMute);
                }}
                className="px-3 py-1.5 rounded-lg bg-black/40 hover:bg-black/60 border border-white/20 text-xs font-semibold flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                {isAudioMuted ? (
                  <>
                    <VolumeX className="w-3.5 h-3.5 text-rose-400" />
                    <span>Unmute Siren</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                    <span>Audio Alert Active</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Error Notice */}
      {errorMessage && (
        <div className="p-3.5 rounded-lg bg-rose-950/50 border border-rose-800 text-rose-200 text-xs flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 text-rose-400 shrink-0" />
            <span>{errorMessage}</span>
          </div>
          <button onClick={() => setErrorMessage(null)} className="text-rose-400 hover:text-white font-bold text-xs cursor-pointer">
            Dismiss
          </button>
        </div>
      )}

      {/* Safety Cutoff Notice if test was auto-stopped */}
      {latestTelemetry?.session_status === 'stopped' && !isOverheatCrit && (
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

      {/* INTERACTIVE CABLE & ELECTRIC WIRE CURRENT FLOW VISUALIZER */}
      <InteractiveCableWireVisualizer
        sinkVoltage={liveSinkV}
        sourceVoltage={liveSourceV}
        current={liveCurrent}
        power={livePower}
        temperature={liveTemp}
        voltageDrop={liveDrop}
        resistance={liveResist}
        cableName={selectedCable?.display_name}
        connectorType={selectedCable?.connector_type}
        isRunning={isRunning}
        isHardware={testMode === 'hardware'}
      />

      {/* Configuration & Controls Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left: Test Setup & Dynamic Tuning Form */}
        <div className="space-y-4">
          <div className="floating-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Layers className="w-4 h-4 text-cyan-400" />
                <span>Test Configuration</span>
              </h3>
              <span className="text-[11px] font-mono text-cyan-400 bg-cyan-950/60 px-2 py-0.5 rounded border border-cyan-800/50">
                5.0 V DC Profile
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
                  <Radio className="w-3.5 h-3.5" />
                  <span>Physics Simulator</span>
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
                  <HardDrive className="w-3.5 h-3.5" />
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
                    {c.display_name} ({c.connector_type} • {c.length_m || 1.0}m)
                  </option>
                ))}
              </select>
            </div>

            {/* Device Picker */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-slate-300">Device Interface</label>
                <span className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${
                  currentDev?.online_status
                    ? 'bg-emerald-950 text-emerald-300 border-emerald-800'
                    : 'bg-rose-950 text-rose-300 border-rose-800'
                }`}>
                  {currentDev?.online_status ? 'ONLINE' : 'OFFLINE'}
                </span>
              </div>
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

            {/* Demo Scenario Picker */}
            {testMode === 'demo' && (
              <div className="space-y-1.5 pt-2 border-t border-slate-800/60">
                <label className="text-xs font-medium text-cyan-300 flex items-center justify-between">
                  <span>Physical Baseline Scenario</span>
                  <span className="text-[10px] text-slate-400">Physics Engine</span>
                </label>
                <select
                  disabled={isRunning}
                  value={simScenario}
                  onChange={(e) => setSimScenario(e.target.value)}
                  className="w-full bg-slate-900 border border-cyan-800/40 rounded-lg px-3 py-2 text-xs text-cyan-200 focus:outline-none focus:border-cyan-400 disabled:opacity-50"
                >
                  <option value="normal">Nominal Standard (Copper Physics, 28°C-33°C)</option>
                  <option value="high_resistance">High Contact Resistance Sag (0.65Ω, 4.35V)</option>
                  <option value="overheating">Overheating Thermal Runaway (Triggers &gt;50°C Cutoff)</option>
                  <option value="unstable">Connector Pin Contact Jitter (&gt;0.15V Ripple)</option>
                  <option value="single_ended">Single-ended Sink-Only (No source reference)</option>
                </select>
              </div>
            )}

            {/* Hardware Port & Direct Connection Controls */}
            {testMode === 'hardware' && (
              <div className="space-y-3 pt-2 border-t border-slate-800/60 text-xs">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-300">Serial COM Port</label>
                    <button
                      type="button"
                      onClick={() => {
                        api.getSerialPorts().then((data) => {
                          setPorts(data);
                          if (data.length > 0 && !data.some(p => p.device === selectedPort)) {
                            const esp = data.find((p) => p.is_esp);
                            setSelectedPort(esp ? esp.device : data[0].device);
                          }
                        });
                        fetchBridgeStatus();
                      }}
                      className="text-[10px] text-cyan-400 hover:underline flex items-center gap-1"
                    >
                      <RefreshCw className="w-2.5 h-2.5" />
                      <span>Refresh</span>
                    </button>
                  </div>
                  <select
                    disabled={isRunning || Boolean(bridgeStatus?.connected)}
                    value={selectedPort}
                    onChange={(e) => setSelectedPort(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-800 rounded-lg px-3 py-2 text-slate-200 focus:outline-none focus:border-cyan-500 font-mono disabled:opacity-60"
                  >
                    {ports.map((p) => (
                      <option key={p.device} value={p.device}>
                        {p.device} - {p.description} {p.is_esp ? '(ESP32)' : ''}
                      </option>
                    ))}
                    {ports.length === 0 && (
                      <option value="COM19">COM19 - (ESP32 Rig)</option>
                    )}
                  </select>
                </div>

                {/* Direct Hardware Connect / Disconnect Action */}
                <div className="pt-0.5">
                  {bridgeStatus?.connected ? (
                    <div className="flex items-center justify-between bg-emerald-950/40 border border-emerald-800/80 rounded-lg p-2.5">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                        <div>
                          <div className="font-semibold text-emerald-300 text-xs">
                            Hardware Connected: {bridgeStatus.port || selectedPort}
                          </div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            Firmware: {bridgeStatus.firmware_version || 'cg-fw-1.2.0'} @ 115200 baud
                          </div>
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={isRunning || isConnectingBridge}
                        onClick={handleDisconnectBridge}
                        className="px-2.5 py-1 text-[11px] font-medium bg-slate-800 hover:bg-slate-700 text-rose-300 border border-slate-700 rounded transition-colors disabled:opacity-50 cursor-pointer"
                      >
                        {isConnectingBridge ? 'Disconnecting...' : 'Disconnect'}
                      </button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      disabled={isRunning || isConnectingBridge}
                      onClick={() => handleConnectBridge(true)}
                      className="w-full py-2 px-3 rounded-lg text-xs font-semibold bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white flex items-center justify-center gap-1.5 transition-all shadow-sm cursor-pointer disabled:opacity-50"
                    >
                      <Zap className={`w-3.5 h-3.5 ${isConnectingBridge ? 'animate-spin' : ''}`} />
                      <span>{isConnectingBridge ? `Connecting to ${selectedPort}...` : `Connect ESP32 Hardware Rig (${selectedPort || 'COM'})`}</span>
                    </button>
                  )}
                </div>

                {/* Sensor Readiness */}
                <div className="p-2.5 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] uppercase font-bold text-slate-400 tracking-wider">
                      Sensor Readiness
                    </span>
                    <span className="text-[10px] text-slate-400 font-mono">
                      {bridgeStatus?.connected ? 'Real Hardware' : 'Pending Connect'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-slate-400">INA219 (V/I):</span>
                      <span className={
                        bridgeStatus?.sensor_status?.ina219 === 'ok'
                          ? 'text-emerald-400 font-semibold'
                          : bridgeStatus?.connected
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-500'
                      }>
                        {bridgeStatus?.sensor_status?.ina219 === 'ok'
                          ? 'ARMED (OK)'
                          : bridgeStatus?.connected
                          ? 'FAULT (Check I2C)'
                          : 'OFFLINE'}
                      </span>
                    </div>
                    <div className="flex items-center justify-between p-1 rounded bg-slate-950/60 border border-slate-800/60">
                      <span className="text-slate-400">DS18B20 (T):</span>
                      <span className={
                        bridgeStatus?.sensor_status?.ds18b20 === 'ok'
                          ? 'text-emerald-400 font-semibold'
                          : bridgeStatus?.connected
                          ? 'text-amber-400 font-semibold'
                          : 'text-slate-500'
                      }>
                        {bridgeStatus?.sensor_status?.ds18b20 === 'ok'
                          ? 'ARMED (OK)'
                          : bridgeStatus?.connected
                          ? 'FAULT (Check Pin 4)'
                          : 'OFFLINE'}
                      </span>
                    </div>
                  </div>

                  {bridgeStatus?.connected && (bridgeStatus?.sensor_status?.ina219 !== 'ok' || bridgeStatus?.sensor_status?.ds18b20 !== 'ok') && (
                    <div className="text-[10px] text-amber-300/90 leading-tight pt-1 flex items-start gap-1">
                      <AlertTriangle className="w-3 h-3 text-amber-400 shrink-0 mt-0.5" />
                      <span>
                        ESP32 is online! INA219 (SDA:21, SCL:22) or DS18B20 (DQ:4) unattached. Wire sensors for live telemetry.
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Start / Stop Controls */}
            <div className="pt-3 border-t border-slate-800">
              {!isRunning ? (
                <button
                  type="button"
                  disabled={isSubmitting || isHardwareOffline}
                  onClick={handleStartTest}
                  className={`w-full py-2.5 px-4 rounded-lg font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md ${
                    isHardwareOffline
                      ? 'bg-slate-800 text-slate-500 border border-slate-700 cursor-not-allowed'
                      : 'bg-gradient-to-r from-cyan-600 to-cyan-500 hover:from-cyan-500 hover:to-cyan-400 text-white cursor-pointer shadow-cyan-950/60'
                  }`}
                >
                  <Play className="w-4 h-4 fill-current" />
                  <span>START REAL-TIME TEST</span>
                </button>
              ) : (
                <button
                  type="button"
                  disabled={isSubmitting}
                  onClick={handleStopTest}
                  className="w-full py-2.5 px-4 rounded-lg font-bold text-xs bg-rose-600 hover:bg-rose-500 text-white flex items-center justify-center gap-2 transition-colors cursor-pointer shadow-lg shadow-rose-950 animate-pulse"
                >
                  <Square className="w-4 h-4 fill-current" />
                  <span>STOP / TERMINATE TEST</span>
                </button>
              )}

              {isHardwareOffline && (
                <p className="text-[11px] text-amber-400 mt-2 text-center leading-snug">
                  Hardware rig is disconnected. Connect to your COM port above, or switch to Physics Simulator mode.
                </p>
              )}
            </div>
          </div>

          {/* INTERACTIVE DYNAMIC PHYSICS TUNING CONTROLLER */}
          {testMode === 'demo' && (
            <div className="floating-card p-5 space-y-4 border-cyan-900/60">
              <div className="flex items-center justify-between border-b border-slate-800 pb-2">
                <h4 className="text-xs font-bold text-cyan-300 flex items-center gap-1.5 uppercase tracking-wider">
                  <Sliders className="w-3.5 h-3.5 text-cyan-400" />
                  <span>Live Physics & Stress Tuning</span>
                </h4>
                <span className="text-[10px] text-emerald-400 font-mono">Real-time Reactive</span>
              </div>

              {/* Dynamic Load Current Slider */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-slate-300">Dynamic Load Current:</span>
                  <span className="font-mono font-bold text-amber-400">{targetLoadCurrent.toFixed(2)} A</span>
                </div>
                <input
                  type="range"
                  min="0.2"
                  max="3.2"
                  step="0.1"
                  value={targetLoadCurrent}
                  onChange={(e) => handleAdjustLoad(parseFloat(e.target.value))}
                  className="w-full accent-cyan-400 cursor-pointer"
                />
                <div className="flex justify-between text-[10px] text-slate-500 font-mono">
                  <span>0.2 A (Trickle)</span>
                  <span>1.5 A (Nominal)</span>
                  <span>3.2 A (Max Load)</span>
                </div>
              </div>

              {/* Stress Action Buttons */}
              <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/60">
                <button
                  type="button"
                  onClick={handleTriggerThermalStress}
                  className={`py-2 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                    isThermalStress
                      ? 'bg-rose-600 text-white border-rose-400 shadow-md shadow-rose-950 animate-pulse'
                      : 'bg-slate-900 hover:bg-slate-800 text-rose-300 border-rose-900/60'
                  }`}
                >
                  <Flame className="w-3.5 h-3.5" />
                  <span>{isThermalStress ? 'Thermal Stress ACTIVE' : 'Trigger Overheat'}</span>
                </button>

                <button
                  type="button"
                  onClick={handleToggleFlexStress}
                  className={`py-2 px-2.5 rounded-lg text-[11px] font-bold flex items-center justify-center gap-1.5 transition-all border cursor-pointer ${
                    isFlexStress
                      ? 'bg-amber-600 text-white border-amber-400 shadow-md shadow-amber-950'
                      : 'bg-slate-900 hover:bg-slate-800 text-amber-300 border-amber-900/60'
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{isFlexStress ? 'Flexing Cable' : 'Simulate Flexing'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right: Live Telemetry Gauges & Sensor Status */}
        <div className="lg:col-span-2 space-y-4">
          <div className="floating-card p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
              <div className="flex items-center space-x-2">
                <Activity className="w-4 h-4 text-cyan-400" />
                <h3 className="text-sm font-semibold text-white">Live Telemetry Cockpit</h3>
                {isRunning && (
                  <span className="font-mono text-cyan-400 bg-cyan-950 px-2 py-0.5 rounded border border-cyan-800 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3 text-cyan-400" />
                    <span>{Math.floor(elapsedSeconds / 60).toString().padStart(2, '0')}:{(elapsedSeconds % 60).toString().padStart(2, '0')}</span>
                  </span>
                )}
              </div>
              <div className="flex items-center space-x-3 text-xs">
                <span className="text-slate-400">
                  Status:{' '}
                  {isRunning ? (
                    isWaitingForData ? (
                      <span className="font-semibold text-amber-400 animate-pulse">
                        WAITING FOR HARDWARE DATA
                      </span>
                    ) : isDataStale ? (
                      <span className="font-semibold text-rose-400">
                        STALE DATA
                      </span>
                    ) : (
                      <span className="font-semibold text-emerald-400 animate-pulse">
                        STREAMING LIVE SENSORS
                      </span>
                    )
                  ) : (
                    <span className="font-semibold text-slate-300">
                      {isHardwareOffline ? 'DISCONNECTED (OFFLINE)' : 'IDLE / READY'}
                    </span>
                  )}
                </span>
              </div>
            </div>

            {/* Gauges Grid with Floating Cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3.5">
              <div className="floating-card p-3.5 bg-slate-900/70 border-slate-800">
                <div className="text-[11px] text-slate-400">Sink Voltage</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveSinkV > 0 ? liveSinkV.toFixed(2) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">V</span>
                </div>
                <div className="text-[10px] text-cyan-400 mt-1">
                  {liveSinkV >= 4.5 ? 'Nominal 5V' : liveSinkV > 0 ? 'Voltage Sag' : 'No Signal'}
                </div>
              </div>

              <div className="floating-card p-3.5 bg-slate-900/70 border-slate-800">
                <div className="text-[11px] text-slate-400">Current Draw</div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveCurrent > 0 ? liveCurrent.toFixed(2) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">A</span>
                </div>
                <div className="text-[10px] text-amber-400 mt-1">
                  {liveCurrent > 0 ? 'Active Load' : 'Zero Current'}
                </div>
              </div>

              <div className="floating-card p-3.5 bg-slate-900/70 border-slate-800">
                <div className="text-[11px] text-slate-400">V-Drop / Resistance</div>
                <div className="text-lg font-bold font-mono text-white mt-1">
                  {liveResist != null ? (
                    `${liveResist.toFixed(3)}Ω`
                  ) : (
                    <span className="text-xs font-normal text-slate-500">
                      {liveDrop != null ? 'Evaluating' : 'Single-Ended Blocked'}
                    </span>
                  )}
                </div>
                <div className="text-[10px] text-slate-400 mt-1">
                  Drop: {liveDrop != null ? `${liveDrop.toFixed(3)}V` : 'Need source ref'}
                </div>
              </div>

              <div
                className={`floating-card p-3.5 transition-colors ${
                  isOverheatCrit
                    ? 'bg-rose-950/60 border-rose-500 animate-pulse'
                    : isOverheatWarn
                    ? 'bg-amber-950/40 border-amber-500'
                    : 'bg-slate-900/70 border-slate-800'
                }`}
              >
                <div className="text-[11px] text-slate-400 flex items-center justify-between">
                  <span>Surface Temp</span>
                  {isOverheatWarn && <Flame className="w-3.5 h-3.5 text-rose-400 animate-bounce" />}
                </div>
                <div className="text-2xl font-bold font-mono text-white mt-1">
                  {liveTemp > 0 ? liveTemp.toFixed(1) : '--'}
                  <span className="text-xs text-slate-400 font-normal ml-0.5">°C</span>
                </div>
                <div
                  className={`text-[10px] font-bold mt-1 ${
                    isOverheatCrit ? 'text-rose-400' : isOverheatWarn ? 'text-amber-400' : 'text-emerald-400'
                  }`}
                >
                  {isOverheatCrit ? 'CRITICAL (Trip ≥50°C)' : isOverheatWarn ? 'WARNING (Elevated)' : 'Safe Thermal Envelope'}
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
                  <span>Thermal Envelope: {liveTemp < 50 ? 'Safe (<50°C)' : 'OVERHEAT TRIP'}</span>
                </div>
              </div>
            </div>

            {/* Live Chart Visualizer */}
            <div className="h-60 w-full bg-[#070b14] rounded-lg border border-slate-800 p-2">
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
                  {isRunning && testMode === 'hardware'
                    ? 'Waiting for first live hardware telemetry frame from ESP32...'
                    : 'Click "START REAL-TIME TEST" to stream real-time waveforms.'}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
