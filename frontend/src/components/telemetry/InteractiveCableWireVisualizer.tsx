import React from 'react';
import {
  Zap,
  Thermometer,
  ShieldAlert,
  AlertTriangle,
  Flame,
  ArrowRight,
  Cpu,
  BatteryCharging,
  Gauge
} from 'lucide-react';

interface InteractiveCableWireVisualizerProps {
  sinkVoltage: number;
  sourceVoltage: number | null;
  current: number;
  power: number;
  temperature: number;
  voltageDrop: number | null;
  resistance: number | null;
  cableName?: string;
  connectorType?: string;
  isRunning: boolean;
  isHardware: boolean;
}

export const InteractiveCableWireVisualizer: React.FC<InteractiveCableWireVisualizerProps> = ({
  sinkVoltage,
  sourceVoltage,
  current,
  power,
  temperature,
  voltageDrop,
  resistance,
  cableName = 'Standard USB Cable',
  connectorType = 'USB-C to USB-C',
  isRunning,
  isHardware,
}) => {
  const isOverheatWarning = isRunning && temperature >= 42.0;
  const isOverheatCritical = isRunning && temperature >= 50.0;
  const isCurrentFlowing = isRunning && current > 0.05;

  // Calculate dynamic animation speed based on live current
  // Higher current (e.g. 2.4A) = faster current animation (0.5s), low current = slower (2.5s)
  const animDurationSeconds = isCurrentFlowing
    ? Math.max(0.45, Math.min(2.5, 1.8 / Math.max(0.2, current))).toFixed(2)
    : '0';

  // Wire glow color based on temperature & load state
  const wireColor = isOverheatCritical
    ? '#ef4444' // Red hot
    : isOverheatWarning
    ? '#f59e0b' // Warning Amber
    : isCurrentFlowing
    ? '#06b6d4' // Electric Cyan
    : '#475569'; // Idle Slate

  // Power loss dissipated in cable jacket as heat: P = I^2 * R
  const powerLossWatts = resistance && current ? Math.max(0, current * current * resistance) : null;

  // Temperature percent of critical safety limit (50°C)
  const tempPercent = Math.min(100, Math.max(0, ((temperature - 20) / (55 - 20)) * 100));

  return (
    <div
      className={`floating-card p-5 transition-all duration-300 relative overflow-hidden ${
        isOverheatCritical
          ? 'overheat-hazard-pulse border-rose-600 bg-rose-950/20'
          : isOverheatWarning
          ? 'border-amber-500/80 bg-amber-950/15'
          : 'border-slate-800'
      }`}
    >
      {/* Background cyber ambient glow */}
      <div
        className="absolute inset-0 pointer-events-none opacity-20 blur-3xl transition-colors duration-500"
        style={{
          background: isOverheatCritical
            ? 'radial-gradient(circle at 50% 50%, #f43f5e 0%, transparent 70%)'
            : isOverheatWarning
            ? 'radial-gradient(circle at 50% 50%, #f59e0b 0%, transparent 70%)'
            : isCurrentFlowing
            ? 'radial-gradient(circle at 50% 50%, #06b6d4 0%, transparent 70%)'
            : 'none',
        }}
      />

      {/* Header bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-800/80 pb-3 mb-4 relative z-10">
        <div className="flex items-center space-x-2.5">
          <div
            className={`w-7 h-7 rounded-lg flex items-center justify-center border transition-all ${
              isOverheatCritical
                ? 'bg-rose-500/20 border-rose-500 text-rose-400 animate-pulse'
                : isOverheatWarning
                ? 'bg-amber-500/20 border-amber-500 text-amber-400'
                : isCurrentFlowing
                ? 'bg-cyan-500/20 border-cyan-500 text-cyan-400 electric-current-glow'
                : 'bg-slate-800 border-slate-700 text-slate-500'
            }`}
          >
            {isOverheatCritical ? (
              <Flame className="w-4 h-4 fill-rose-500/40" />
            ) : (
              <Zap className="w-4 h-4 fill-current" />
            )}
          </div>
          <div>
            <h3 className="text-sm font-bold text-white tracking-wide flex items-center gap-2">
              <span>Interactive Circuit & Current Flow Simulator</span>
              {isHardware ? (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-emerald-950 text-emerald-300 border border-emerald-800">
                  ESP32 HARDWARE
                </span>
              ) : (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-blue-950 text-blue-300 border border-blue-800">
                  PHYSICS SIMULATION
                </span>
              )}
            </h3>
            <p className="text-[11px] text-slate-400 font-mono">
              {cableName} • {connectorType}
            </p>
          </div>
        </div>

        {/* Dynamic Status Badge */}
        <div className="flex items-center space-x-2">
          {isOverheatCritical ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-rose-600 text-white animate-pulse shadow-lg shadow-rose-900/50">
              <ShieldAlert className="w-3.5 h-3.5" />
              <span>CRITICAL OVERHEAT TRIP (≥50°C)</span>
            </span>
          ) : isOverheatWarning ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/20 border border-amber-500/80 text-amber-300 animate-pulse">
              <AlertTriangle className="w-3.5 h-3.5" />
              <span>THERMAL ELEVATION DETECTED</span>
            </span>
          ) : isCurrentFlowing ? (
            <span className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-cyan-950/70 border border-cyan-500/60 text-cyan-300">
              <span className="w-2 h-2 rounded-full bg-cyan-400 animate-ping mr-1"></span>
              <span>LIVE CURRENT FLOW: {current.toFixed(2)} A</span>
            </span>
          ) : (
            <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md text-xs font-mono text-slate-400 bg-slate-900 border border-slate-800">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-600 mr-1"></span>
              <span>CIRCUIT IDLE</span>
            </span>
          )}
        </div>
      </div>

      {/* Interactive Circuit Schematic SVG */}
      <div className="relative z-10 w-full bg-[#070b14] rounded-xl border border-slate-800/90 p-4 shadow-inner">
        <svg
          viewBox="0 0 920 220"
          className="w-full h-auto select-none overflow-visible"
        >
          <defs>
            {/* Glowing filter for neon cyan current */}
            <filter id="glow-cyan" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Glowing filter for thermal warning */}
            <filter id="glow-heat" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Linear gradient for cable jacket */}
            <linearGradient id="cableJacket" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#1e293b" />
              <stop offset="50%" stopColor={isOverheatCritical ? '#7f1d1d' : isOverheatWarning ? '#78350f' : '#334155'} />
              <stop offset="100%" stopColor="#1e293b" />
            </linearGradient>
          </defs>

          {/* ================= 1. POWER SOURCE NODE (Left) ================= */}
          <g transform="translate(20, 25)">
            {/* Background container */}
            <rect
              x="0"
              y="0"
              width="150"
              height="160"
              rx="12"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1.5"
            />
            {/* Power LED */}
            <circle
              cx="25"
              cy="25"
              r="4.5"
              fill={isRunning ? '#10b981' : '#64748b'}
              filter={isRunning ? 'url(#glow-cyan)' : undefined}
            />
            <text x="38" y="29" fill="#94a3b8" fontSize="11" fontWeight="bold">
              5.0V DC SOURCE
            </text>

            {/* Source Voltage Display */}
            <text x="20" y="65" fill="#64748b" fontSize="10">
              SUPPLY VOLTAGE
            </text>
            <text x="20" y="95" fill="#f8fafc" fontSize="24" fontWeight="bold" fontFamily="monospace">
              {sourceVoltage != null ? sourceVoltage.toFixed(2) : '5.08'}
              <tspan fontSize="12" fill="#94a3b8"> V</tspan>
            </text>

            <rect
              x="18"
              y="110"
              width="114"
              height="34"
              rx="6"
              fill="#020617"
              stroke="#1e293b"
            />
            <text x="26" y="125" fill="#38bdf8" fontSize="9" fontWeight="bold">
              USB REGULATOR
            </text>
            <text x="26" y="137" fill="#64748b" fontSize="8" fontFamily="monospace">
              Dual-Shuttle INA219
            </text>

            {/* USB Port Connector Outline */}
            <rect
              x="146"
              y="60"
              width="14"
              height="40"
              rx="3"
              fill="#334155"
              stroke="#64748b"
            />
          </g>

          {/* ================= 2. CABLE JACKET & CONDUCTOR WIRES (Center) ================= */}
          <g>
            {/* Outer Protective Cable Sleeve */}
            <rect
              x="180"
              y="70"
              width="550"
              height="70"
              rx="14"
              fill="url(#cableJacket)"
              stroke={isOverheatCritical ? '#f43f5e' : isOverheatWarning ? '#f59e0b' : '#334155'}
              strokeWidth={isOverheatCritical || isOverheatWarning ? '2' : '1'}
              opacity="0.85"
            />

            {/* Inner Conduit 1: VBUS (+) Positive Power Wire */}
            {/* Base inactive trace */}
            <path
              d="M 180,88 L 730,88"
              stroke="#1e293b"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Animated flowing positive current */}
            {isCurrentFlowing && (
              <path
                d="M 180,88 L 730,88"
                stroke={wireColor}
                strokeWidth="4"
                strokeDasharray="10 14"
                strokeLinecap="round"
                filter={isOverheatCritical ? 'url(#glow-heat)' : 'url(#glow-cyan)'}
                style={{
                  animation: `currentFlow ${animDurationSeconds}s linear infinite`,
                }}
              />
            )}

            {/* Inner Conduit 2: GND (-) Ground Return Wire */}
            <path
              d="M 180,122 L 730,122"
              stroke="#1e293b"
              strokeWidth="5"
              strokeLinecap="round"
            />
            {/* Animated flowing ground return current (reverse direction) */}
            {isCurrentFlowing && (
              <path
                d="M 730,122 L 180,122"
                stroke={isOverheatCritical ? '#f43f5e' : isOverheatWarning ? '#f59e0b' : '#38bdf8'}
                strokeWidth="4"
                strokeDasharray="10 14"
                strokeLinecap="round"
                filter={isOverheatCritical ? 'url(#glow-heat)' : 'url(#glow-cyan)'}
                style={{
                  animation: `currentFlow ${animDurationSeconds}s linear infinite`,
                }}
              />
            )}

            {/* Cable Mid-Section Thermal & Resistance Diagnostic HUD */}
            <g transform="translate(360, 40)">
              <rect
                x="0"
                y="0"
                width="190"
                height="130"
                rx="10"
                fill="#090d16"
                stroke={isOverheatCritical ? '#f43f5e' : isOverheatWarning ? '#f59e0b' : '#38bdf8'}
                strokeWidth="1.2"
                strokeDasharray={isCurrentFlowing ? undefined : '4 3'}
                filter="drop-shadow(0 4px 12px rgba(0,0,0,0.8))"
              />
              <text x="15" y="22" fill="#94a3b8" fontSize="10" fontWeight="bold">
                DIFFERENTIAL TELEMETRY
              </text>

              {/* Loop Resistance */}
              <text x="15" y="44" fill="#64748b" fontSize="9">
                LOOP RESISTANCE (R)
              </text>
              <text x="15" y="62" fill="#38bdf8" fontSize="15" fontWeight="bold" fontFamily="monospace">
                {resistance != null ? `${resistance.toFixed(3)} Ω` : '--'}
              </text>

              {/* Voltage Drop */}
              <text x="15" y="80" fill="#64748b" fontSize="9">
                MEASURED VOLTAGE DROP (ΔV)
              </text>
              <text x="15" y="98" fill="#facc15" fontSize="15" fontWeight="bold" fontFamily="monospace">
                {voltageDrop != null ? `${voltageDrop.toFixed(3)} V` : '--'}
              </text>

              {/* Surface Temperature */}
              <text x="15" y="115" fill={isOverheatCritical ? '#f43f5e' : isOverheatWarning ? '#f59e0b' : '#10b981'} fontSize="10" fontWeight="bold">
                TEMP: {temperature > 0 ? `${temperature.toFixed(1)}°C` : '--'}
              </text>
            </g>

            {/* Differential Voltage Tap Probes */}
            {/* Source tap pin */}
            <circle cx="210" cy="88" r="4" fill="#38bdf8" />
            <line x1="210" y1="88" x2="210" y2="50" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
            <text x="215" y="48" fill="#38bdf8" fontSize="8" fontFamily="monospace">V_src Probe</text>

            {/* Sink tap pin */}
            <circle cx="700" cy="88" r="4" fill="#38bdf8" />
            <line x1="700" y1="88" x2="700" y2="50" stroke="#38bdf8" strokeWidth="1" strokeDasharray="2 2" />
            <text x="660" y="48" fill="#38bdf8" fontSize="8" fontFamily="monospace">V_sink Probe</text>

            {/* DS18B20 Surface Temperature Sensor Pin */}
            <g transform="translate(290, 140)">
              <rect x="0" y="0" width="60" height="20" rx="4" fill="#0f172a" stroke="#f43f5e" strokeWidth="1" />
              <text x="6" y="14" fill="#f43f5e" fontSize="9" fontWeight="bold">DS18B20</text>
              <line x1="30" y1="0" x2="30" y2="-18" stroke="#f43f5e" strokeWidth="1.5" />
            </g>
          </g>

          {/* ================= 3. SINK / LOAD FIXTURE (Right) ================= */}
          <g transform="translate(745, 25)">
            <rect
              x="0"
              y="0"
              width="155"
              height="160"
              rx="12"
              fill="#0f172a"
              stroke="#334155"
              strokeWidth="1.5"
            />
            {/* Sink Connector */}
            <rect
              x="-10"
              y="60"
              width="12"
              height="40"
              rx="3"
              fill="#334155"
              stroke="#64748b"
            />

            <text x="18" y="28" fill="#94a3b8" fontSize="11" fontWeight="bold">
              ACTIVE LOAD SINK
            </text>

            {/* Sink Voltage */}
            <text x="18" y="55" fill="#64748b" fontSize="9">
              SINK VOLTAGE
            </text>
            <text x="18" y="75" fill="#38bdf8" fontSize="18" fontWeight="bold" fontFamily="monospace">
              {sinkVoltage > 0 ? sinkVoltage.toFixed(2) : '--'}
              <tspan fontSize="11" fill="#94a3b8"> V</tspan>
            </text>

            {/* Load Current */}
            <text x="18" y="95" fill="#64748b" fontSize="9">
              CURRENT DRAW
            </text>
            <text x="18" y="115" fill="#f59e0b" fontSize="18" fontWeight="bold" fontFamily="monospace">
              {current > 0 ? current.toFixed(2) : '--'}
              <tspan fontSize="11" fill="#94a3b8"> A</tspan>
            </text>

            {/* Active Power */}
            <text x="18" y="132" fill="#64748b" fontSize="8">
              ACTIVE POWER (W)
            </text>
            <text x="18" y="148" fill="#e2e8f0" fontSize="12" fontWeight="bold" fontFamily="monospace">
              {power > 0 ? `${power.toFixed(2)} W` : '--'}
            </text>
          </g>
        </svg>
      </div>

      {/* Thermodynamic Energy & Heat Metrics Bottom Strip */}
      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-3 text-xs relative z-10">
        {/* Real-time Joule dissipation calculation */}
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Gauge className="w-4 h-4 text-cyan-400" />
            <div>
              <div className="text-[10px] text-slate-400">Joule Heat Dissipation</div>
              <div className="font-mono font-bold text-white text-sm">
                {powerLossWatts != null ? `${powerLossWatts.toFixed(2)} W` : '--'}
              </div>
            </div>
          </div>
          <span className="text-[10px] font-mono text-cyan-300">P = I² • R</span>
        </div>

        {/* Electron drift & dynamic current */}
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Zap className={`w-4 h-4 ${isCurrentFlowing ? 'text-amber-400' : 'text-slate-500'}`} />
            <div>
              <div className="text-[10px] text-slate-400">Electron Flow Velocity</div>
              <div className="font-mono font-bold text-white text-sm">
                {isCurrentFlowing ? `${(current * 0.85).toFixed(2)} mm/s` : 'Static (0.00)'}
              </div>
            </div>
          </div>
          <span className="text-[10px] text-slate-400 font-mono">22 AWG Core</span>
        </div>

        {/* Thermal Safety Progress Bar */}
        <div className="p-3 rounded-lg bg-slate-900/80 border border-slate-800 space-y-1.5">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-slate-400 flex items-center gap-1">
              <Thermometer className="w-3.5 h-3.5 text-rose-400" />
              <span>Thermal Envelope</span>
            </span>
            <span
              className={`font-mono font-bold ${
                isOverheatCritical
                  ? 'text-rose-400'
                  : isOverheatWarning
                  ? 'text-amber-400'
                  : 'text-emerald-400'
              }`}
            >
              {temperature > 0 ? `${temperature.toFixed(1)}°C` : '--'} / 50.0°C Limit
            </span>
          </div>

          <div className="w-full h-2 rounded-full bg-slate-950 overflow-hidden relative">
            <div
              className={`h-full rounded-full transition-all duration-500 ${
                isOverheatCritical
                  ? 'bg-rose-600 shadow-sm shadow-rose-500 animate-pulse'
                  : isOverheatWarning
                  ? 'bg-amber-500 shadow-sm shadow-amber-500'
                  : 'bg-gradient-to-r from-emerald-500 to-cyan-500'
              }`}
              style={{ width: `${tempPercent}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};
