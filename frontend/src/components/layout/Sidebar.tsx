import React from 'react';
import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  Zap,
  Cable as CableIcon,
  History,
  Cpu,
  Server,
  Settings,
  ShieldCheck,
  AlertTriangle,
  BrainCircuit,
  Bot,
  Wrench
} from 'lucide-react';

interface SidebarProps {
  connectionMode: 'demo' | 'hardware';
  wsConnected: boolean;
  activeTestId?: string | null;
}

export const Sidebar: React.FC<SidebarProps> = ({ connectionMode, wsConnected, activeTestId }) => {
  const navItems = [
    { to: '/', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/testing', label: 'Live Testing', icon: Zap, badge: activeTestId ? 'ACTIVE' : null },
    { to: '/cables', label: 'Cable Inventory', icon: CableIcon },
    { to: '/history', label: 'Test History', icon: History },
    { to: '/ml', label: 'ML & Predictive', icon: BrainCircuit },
    { to: '/assistant', label: 'AI Assistant', icon: Bot, badge: 'AI' },
    { to: '/maintenance', label: 'Maintenance', icon: Wrench },
    { to: '/diagnostics', label: 'Rules & Alerts', icon: Cpu },
    { to: '/devices', label: 'Device Management', icon: Server },
    { to: '/settings', label: 'Settings', icon: Settings },
  ];

  return (
    <aside className="w-64 bg-[#0d1322] border-r border-slate-800 flex flex-col h-screen select-none shrink-0">
      {/* Brand Header */}
      <div className="p-5 border-b border-slate-800/80 flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <div className="w-9 h-9 rounded-lg bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 shadow-sm shadow-cyan-950/50">
            <ShieldCheck className="w-5 h-5 text-cyan-400" />
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-wide text-slate-100 flex items-center space-x-1">
              <span>ChargeGuard</span>
              <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800/60">
                PRO
              </span>
            </h1>
            <p className="text-[11px] text-slate-400 font-mono">USB Health Monitor</p>
          </div>
        </div>
      </div>

      {/* Mode & Live Stream Badge */}
      <div className="px-4 py-3 border-b border-slate-800/60 bg-slate-900/40">
        <div className="flex items-center justify-between text-xs">
          <span className="text-slate-400 font-medium">Environment:</span>
          {connectionMode === 'demo' ? (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-950/80 text-blue-300 border border-blue-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-400 mr-1.5 animate-pulse"></span>
              DEMO (Simulator)
            </span>
          ) : (
            <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-950/80 text-emerald-300 border border-emerald-800/60">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
              HARDWARE RIG
            </span>
          )}
        </div>
        <div className="flex items-center justify-between text-xs mt-2 pt-2 border-t border-slate-800/40">
          <span className="text-slate-400 font-medium">Telemetry:</span>
          <span className="inline-flex items-center text-[11px] text-slate-300">
            <span
              className={`w-2 h-2 rounded-full mr-1.5 ${
                wsConnected ? 'bg-emerald-400 shadow-sm shadow-emerald-400/50' : 'bg-rose-500'
              }`}
            ></span>
            {wsConnected ? 'Streaming Live' : 'Disconnected'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              className={({ isActive }) =>
                `flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800/50'
                }`
              }
            >
              <div className="flex items-center space-x-3">
                <Icon className="w-4 h-4 shrink-0" />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 animate-pulse">
                  {item.badge}
                </span>
              )}
            </NavLink>
          );
        })}
      </nav>

      {/* Safety Notice Footer */}
      <div className="p-3.5 border-t border-slate-800 bg-[#090d18] text-[11px] text-slate-400 leading-relaxed">
        <div className="flex items-start space-x-2">
          <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <span className="text-slate-300 font-medium">Screening Prototype</span>
            <p className="text-[10px] text-slate-400 mt-0.5">
              Fixed 5V DC profile only. Does not replace physical hardware fuses or certified bench analyzers.
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
};
