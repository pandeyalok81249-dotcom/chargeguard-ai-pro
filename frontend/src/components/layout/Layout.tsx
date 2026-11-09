import React, { useEffect, useState } from 'react';
import { Outlet } from 'react-router-dom';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { AuthModal } from '../auth/AuthModal';
import { useWebSocket } from '../../hooks/useWebSocket';
import { api } from '../../api/client';
import { DashboardSummary, User } from '../../types';

interface LayoutProps {
  summary: DashboardSummary | null;
  onRefreshSummary: () => void;
}

export const Layout: React.FC<LayoutProps> = ({ summary, onRefreshSummary }) => {
  const { isConnected, latestTelemetry, latestDeviceStatus, latestTestStateChange } = useWebSocket();
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Load user profile on mount if token exists
  useEffect(() => {
    const token = localStorage.getItem('chargeguard_token');
    if (token) {
      api.getMe()
        .then(setCurrentUser)
        .catch(() => {
          localStorage.removeItem('chargeguard_token');
        });
    }
  }, []);

  // Active test from summary or real-time telemetry
  const activeTest = summary?.active_test || null;
  const connectionMode = summary?.connection_mode || 'demo';

  // Auto-refresh summary when device online status or test state changes over WebSocket
  useEffect(() => {
    if (latestDeviceStatus || latestTestStateChange) {
      onRefreshSummary();
    }
  }, [latestDeviceStatus, latestTestStateChange, onRefreshSummary]);

  const handleStopTest = async (testId: string) => {
    try {
      await api.stopTest(testId, 'Stopped from application header');
      onRefreshSummary();
    } catch (e) {
      console.error('Failed to stop test', e);
    }
  };

  return (
    <div className="flex h-screen bg-[#0b0f19] text-slate-100 overflow-hidden font-sans">
      {/* Sidebar */}
      <Sidebar
        connectionMode={connectionMode}
        wsConnected={isConnected}
        activeTestId={activeTest?.test_id}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <Header
          activeTest={activeTest}
          wsConnected={isConnected}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthModalOpen(true)}
          onStopTest={handleStopTest}
        />

        <main className="flex-1 overflow-y-auto p-6 bg-[#0b0f19]">
          <Outlet context={{
            summary,
            onRefreshSummary,
            latestTelemetry,
            latestDeviceStatus,
            wsConnected: isConnected,
            currentUser
          }} />
        </main>
      </div>

      {/* Authentication Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentUser={currentUser}
        onUserChange={setCurrentUser}
      />
    </div>
  );
};
