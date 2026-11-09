import React, { useState, useEffect, useRef } from 'react';
import {
  Square,
  Zap,
  Bell,
  Volume2,
  VolumeX,
  Wifi,
  WifiOff,
  User as UserIcon,
  AlertTriangle,
  AlertOctagon,
  Check,
  X,
  FileText
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User, Alert } from '../../types';
import { audioAlerts } from '../../utils/soundAlert';

interface HeaderProps {
  activeTest?: {
    test_id: string;
    cable_id: string;
    cable_name?: string | null;
    mode: string;
  } | null;
  wsConnected: boolean;
  currentUser?: User | null;
  latestAlerts?: Alert[];
  onAcknowledgeAlert?: (alertId: number) => void;
  onOpenAuth?: () => void;
  onStopTest?: (testId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeTest,
  wsConnected,
  currentUser,
  latestAlerts = [],
  onAcknowledgeAlert,
  onOpenAuth,
  onStopTest,
}) => {
  const navigate = useNavigate();
  const [isAlertsOpen, setIsAlertsOpen] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Filter unacknowledged alerts
  const unackAlerts = latestAlerts.filter((a) => !a.acknowledged_at);
  const hasCritical = unackAlerts.some((a) => a.severity === 'critical');

  // Trigger audio alert when critical alerts appear
  useEffect(() => {
    if (hasCritical && !isMuted) {
      audioAlerts.playCriticalOverheatAlarm();
    }
  }, [hasCritical, isMuted, unackAlerts.length]);

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    audioAlerts.setMuted(next);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsAlertsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <header className="h-14 bg-[#0d1322] border-b border-slate-800 px-6 flex items-center justify-between shrink-0 relative z-30">
      {/* Left: Active Test Status or System Ready */}
      <div className="flex items-center space-x-4">
        {activeTest ? (
          <div className="flex items-center space-x-3 bg-cyan-950/40 border border-cyan-800/60 px-3 py-1.5 rounded-lg">
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping"></span>
            <span className="text-xs font-semibold text-cyan-300">
              ACTIVE TEST: <span className="text-slate-100">{activeTest.cable_name || activeTest.cable_id}</span> ({activeTest.mode.toUpperCase()})
            </span>
            {onStopTest && (
              <button
                onClick={() => onStopTest(activeTest.test_id)}
                className="ml-2 px-2.5 py-1 rounded bg-rose-600 hover:bg-rose-500 text-white text-[11px] font-bold flex items-center space-x-1 cursor-pointer transition-colors shadow-sm"
              >
                <Square className="w-3 h-3 fill-current" />
                <span>STOP</span>
              </button>
            )}
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-slate-400 text-xs font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
            <span>Test Fixture Ready (Fixed 5.0 V DC Profile)</span>
          </div>
        )}
      </div>

      {/* Right: Quick actions, Smart Notifications, Audio, and Auth */}
      <div className="flex items-center space-x-2.5">
        {!activeTest && (
          <button
            onClick={() => navigate('/testing')}
            className="px-3 py-1.5 rounded-lg bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm shadow-cyan-950"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch Test</span>
          </button>
        )}

        {/* Audio Mute / Unmute Button */}
        <button
          onClick={handleToggleMute}
          title={isMuted ? 'Unmute Audio Alarms' : 'Mute Audio Alarms'}
          className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer ${
            isMuted
              ? 'bg-slate-900 border-slate-800 text-slate-500 hover:text-slate-300'
              : 'bg-cyan-950/40 border-cyan-800/60 text-cyan-300 hover:bg-cyan-900/50'
          }`}
        >
          {isMuted ? <VolumeX className="w-3.5 h-3.5" /> : <Volume2 className="w-3.5 h-3.5" />}
        </button>

        {/* Smart Fault Notification Bell with Badge */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setIsAlertsOpen(!isAlertsOpen)}
            className={`p-2 rounded-lg border text-xs transition-colors cursor-pointer relative ${
              unackAlerts.length > 0
                ? hasCritical
                  ? 'bg-rose-950/60 border-rose-600 text-rose-300 animate-pulse'
                  : 'bg-amber-950/60 border-amber-600 text-amber-300'
                : 'bg-slate-900 border-slate-800 text-slate-400 hover:text-slate-200'
            }`}
            title="Smart Fault Notifications"
          >
            <Bell className="w-3.5 h-3.5" />
            {unackAlerts.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[9px] font-bold flex items-center justify-center border border-[#0d1322]">
                {unackAlerts.length > 9 ? '9+' : unackAlerts.length}
              </span>
            )}
          </button>

          {/* Smart Notification Dropdown Panel */}
          {isAlertsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-2xl p-4 space-y-3 z-50 animate-fadeIn">
              <div className="flex items-center justify-between border-b border-slate-800/80 pb-2.5">
                <div className="flex items-center space-x-2">
                  <Bell className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-bold text-white">Smart Fault Notifications</span>
                  {unackAlerts.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold bg-rose-950 text-rose-300 border border-rose-800">
                      {unackAlerts.length} Active
                    </span>
                  )}
                </div>
                <button
                  onClick={() => setIsAlertsOpen(false)}
                  className="text-slate-500 hover:text-slate-300 cursor-pointer"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Alert Items List */}
              <div className="max-h-72 overflow-y-auto space-y-2 pr-1">
                {unackAlerts.length > 0 ? (
                  unackAlerts.map((alert) => (
                    <div
                      key={alert.id}
                      className={`p-3 rounded-xl border text-xs space-y-1.5 transition-all ${
                        alert.severity === 'critical'
                          ? 'bg-rose-950/40 border-rose-600/70 text-rose-200'
                          : 'bg-amber-950/40 border-amber-600/70 text-amber-200'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center space-x-1.5">
                          {alert.severity === 'critical' ? (
                            <AlertOctagon className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                          ) : (
                            <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0" />
                          )}
                          <span className="font-bold font-mono text-[11px] uppercase tracking-wide">
                            {alert.code.replace(/_/g, ' ')}
                          </span>
                        </div>
                        {onAcknowledgeAlert && (
                          <button
                            onClick={() => onAcknowledgeAlert(alert.id)}
                            className="px-2 py-0.5 rounded bg-slate-800 hover:bg-slate-700 text-[10px] font-semibold text-slate-300 hover:text-white border border-slate-700 cursor-pointer flex items-center gap-1 shrink-0"
                            title="Acknowledge Alert"
                          >
                            <Check className="w-2.5 h-2.5" />
                            <span>Dismiss</span>
                          </button>
                        )}
                      </div>
                      <p className="text-[11px] opacity-90 leading-relaxed">{alert.message}</p>
                      <div className="flex items-center justify-between text-[10px] opacity-75 font-mono pt-0.5">
                        <span>{new Date(alert.created_at).toLocaleTimeString()}</span>
                        {alert.observed_value != null && (
                          <span>Observed: {alert.observed_value}</span>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center text-slate-500 text-xs">
                    No active threshold violations. Telemetry nominal.
                  </div>
                )}
              </div>

              {/* View all diagnostics link */}
              <div className="pt-2 border-t border-slate-800/80 flex items-center justify-between text-[11px]">
                <button
                  onClick={() => {
                    setIsAlertsOpen(false);
                    navigate('/diagnostics');
                  }}
                  className="text-cyan-400 hover:text-cyan-300 font-semibold cursor-pointer"
                >
                  Open Diagnostics Console →
                </button>
                <button
                  onClick={() => {
                    setIsAlertsOpen(false);
                    navigate('/history');
                  }}
                  className="text-slate-400 hover:text-slate-300 cursor-pointer"
                >
                  Test History
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live stream badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
          {wsConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span className="hidden sm:inline">WS Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span className="hidden sm:inline">Offline</span>
            </>
          )}
        </div>

        {/* User Auth Profile Trigger */}
        <button
          onClick={onOpenAuth}
          className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-xs font-medium text-slate-300 transition-colors cursor-pointer"
        >
          {currentUser ? (
            <>
              <div className="w-5 h-5 rounded-full bg-cyan-500/20 border border-cyan-500/40 flex items-center justify-center text-cyan-300 text-[10px] font-bold">
                {currentUser.full_name.charAt(0)}
              </div>
              <span className="font-semibold text-slate-200 hidden sm:inline">{currentUser.full_name.split(' ')[0]}</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800 hidden md:inline">
                {currentUser.role}
              </span>
            </>
          ) : (
            <>
              <UserIcon className="w-3.5 h-3.5 text-cyan-400" />
              <span>Sign In</span>
            </>
          )}
        </button>
      </div>
    </header>
  );
};
