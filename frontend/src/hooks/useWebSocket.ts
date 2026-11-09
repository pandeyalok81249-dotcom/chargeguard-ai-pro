import { useEffect, useRef, useState, useCallback } from 'react';
import { Alert, DeviceStatusPayload } from '../types';

export interface LiveTelemetryPayload {
  test_id: string;
  device_id: string;
  cable_id: string;
  mode: string;
  timestamp: string;
  source_voltage_v?: number | null;
  sink_voltage_v?: number | null;
  current_a?: number | null;
  power_w?: number | null;
  temperature_c?: number | null;
  voltage_drop_v?: number | null;
  effective_resistance_ohm?: number | null;
  fault_status?: string | null;
  health_score?: number | null;
  primary_reason?: string | null;
  measurement_valid: boolean;
  validity_reason?: string | null;
  session_status: string;
  alerts?: Alert[];
}

export interface TestStateChangePayload {
  test_id: string;
  status: string;
  final_result?: string | null;
  diagnostic_summary?: string | null;
  health_score?: number | null;
  health_category?: string | null;
}

export function useWebSocket() {
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [latestTelemetry, setLatestTelemetry] = useState<LiveTelemetryPayload | null>(null);
  const [latestDeviceStatus, setLatestDeviceStatus] = useState<DeviceStatusPayload | null>(null);
  const [latestTestStateChange, setLatestTestStateChange] = useState<TestStateChangePayload | null>(null);
  const [telemetryHistory, setTelemetryHistory] = useState<LiveTelemetryPayload[]>([]);
  const socketRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<number | null>(null);

  const connect = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    // Use host from window.location in browser, Vite proxy forwards /ws to backend 8000
    const wsUrl = `${protocol}//${window.location.host}/ws`;

    try {
      const ws = new WebSocket(wsUrl);
      socketRef.current = ws;

      ws.onopen = () => {
        setIsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const message = JSON.parse(event.data);
          if (message.type === 'telemetry') {
            const data: LiveTelemetryPayload = message.data;
            setLatestTelemetry(data);
            setTelemetryHistory((prev) => {
              // Keep bounded buffer of last 30 readings for memory efficiency
              const updated = [...prev, data];
              return updated.slice(-30);
            });
          } else if (message.type === 'device_status') {
            setLatestDeviceStatus(message.data);
          } else if (message.type === 'test_state_change') {
            setLatestTestStateChange(message.data);
          }
        } catch {
          // ignore pong or unparsable frames
        }
      };

      ws.onclose = () => {
        setIsConnected(false);
        // Attempt reconnect after 3 seconds
        reconnectTimeoutRef.current = window.setTimeout(() => {
          connect();
        }, 3000);
      };

      ws.onerror = () => {
        setIsConnected(false);
        ws.close();
      };
    } catch {
      setIsConnected(false);
    }
  }, []);

  useEffect(() => {
    connect();

    // Heartbeat ping every 15 seconds
    const pingInterval = window.setInterval(() => {
      if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
        socketRef.current.send('ping');
      }
    }, 15000);

    return () => {
      window.clearInterval(pingInterval);
      if (reconnectTimeoutRef.current) {
        window.clearTimeout(reconnectTimeoutRef.current);
      }
      if (socketRef.current) {
        socketRef.current.close();
      }
    };
  }, [connect]);

  const clearHistory = useCallback(() => {
    setTelemetryHistory([]);
    setLatestTelemetry(null);
  }, []);

  return {
    isConnected,
    latestTelemetry,
    latestDeviceStatus,
    latestTestStateChange,
    telemetryHistory,
    clearHistory,
  };
}
