import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Layout } from './components/layout/Layout';
import { DashboardPage } from './pages/DashboardPage';
import { LiveTestingPage } from './pages/LiveTestingPage';
import { CableInventoryPage } from './pages/CableInventoryPage';
import { TestHistoryPage } from './pages/TestHistoryPage';
import { CableHealthReportPage } from './pages/CableHealthReportPage';
import { DiagnosticsPage } from './pages/DiagnosticsPage';
import { DeviceManagementPage } from './pages/DeviceManagementPage';
import { SettingsPage } from './pages/SettingsPage';
import { MLInsightsPage } from './pages/MLInsightsPage';
import { AIAssistantPage } from './pages/AIAssistantPage';
import { MaintenancePage } from './pages/MaintenancePage';
import { api } from './api/client';
import { DashboardSummary } from './types';

export function App() {
  const [summary, setSummary] = useState<DashboardSummary | null>(null);

  const fetchSummary = useCallback(() => {
    api.getDashboardSummary()
      .then(setSummary)
      .catch((err) => console.error('Failed to fetch dashboard summary:', err));
  }, []);

  useEffect(() => {
    fetchSummary();
    // Refresh summary every 5 seconds as a fallback to WebSocket events
    const timer = setInterval(fetchSummary, 5000);
    return () => clearInterval(timer);
  }, [fetchSummary]);

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout summary={summary} onRefreshSummary={fetchSummary} />}>
          <Route index element={<DashboardPage />} />
          <Route path="testing" element={<LiveTestingPage />} />
          <Route path="cables" element={<CableInventoryPage />} />
          <Route path="history" element={<TestHistoryPage />} />
          <Route path="report/:testId" element={<CableHealthReportPage />} />
          <Route path="ml" element={<MLInsightsPage />} />
          <Route path="assistant" element={<AIAssistantPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="diagnostics" element={<DiagnosticsPage />} />
          <Route path="devices" element={<DeviceManagementPage />} />
          <Route path="settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
