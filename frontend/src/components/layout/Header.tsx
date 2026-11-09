import React from 'react';
import { Square, Zap, ShieldAlert, Wifi, WifiOff, User as UserIcon, Shield } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { User } from '../../types';

interface HeaderProps {
  activeTest?: {
    test_id: string;
    cable_id: string;
    cable_name?: string | null;
    mode: string;
  } | null;
  wsConnected: boolean;
  currentUser?: User | null;
  onOpenAuth?: () => void;
  onStopTest?: (testId: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ activeTest, wsConnected, currentUser, onOpenAuth, onStopTest }) => {
  const navigate = useNavigate();

  return (
    <header className="h-14 bg-[#0d1322] border-b border-slate-800 px-6 flex items-center justify-between shrink-0">
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
            <span>Test Fixture Ready (Fixed 5V DC Profile)</span>
          </div>
        )}
      </div>

      {/* Right: Quick actions & Auth & WebSocket Status */}
      <div className="flex items-center space-x-3">
        {!activeTest && (
          <button
            onClick={() => navigate('/testing')}
            className="px-3 py-1.5 rounded-md bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-medium flex items-center space-x-1.5 cursor-pointer transition-colors shadow-sm shadow-cyan-950"
          >
            <Zap className="w-3.5 h-3.5" />
            <span>Launch Test</span>
          </button>
        )}

        {/* Live stream badge */}
        <div className="flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-slate-900 border border-slate-800 text-[11px] font-mono text-slate-300">
          {wsConnected ? (
            <>
              <Wifi className="w-3.5 h-3.5 text-emerald-400" />
              <span>WS Live</span>
            </>
          ) : (
            <>
              <WifiOff className="w-3.5 h-3.5 text-rose-400" />
              <span>WS Reconnecting...</span>
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
              <span className="font-semibold text-slate-200">{currentUser.full_name.split(' ')[0]}</span>
              <span className="text-[10px] uppercase font-mono px-1 py-0.2 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
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
