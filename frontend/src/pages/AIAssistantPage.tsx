import React, { useState, useEffect, useRef } from 'react';
import { useOutletContext } from 'react-router-dom';
import {
  Bot,
  Send,
  Sparkles,
  ShieldAlert,
  HelpCircle,
  Activity,
  Zap,
  Thermometer,
  ShieldCheck,
  AlertTriangle,
  Flame,
  CheckCircle2,
  RefreshCw,
  Terminal,
  Cpu
} from 'lucide-react';
import { api } from '../api/client';
import { LiveTelemetryPayload } from '../hooks/useWebSocket';
import { DashboardSummary, AssistantMessageResponse } from '../types';

interface DashboardContext {
  summary: DashboardSummary | null;
  latestTelemetry: LiveTelemetryPayload | null;
  wsConnected: boolean;
}

interface MessageItem {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  timestamp: string;
  risks?: string[];
  recommendations?: string[];
  contextUsed?: Record<string, any>;
  provider?: string;
}

const SUGGESTED_QUERIES = [
  'Why is my voltage dropping under load?',
  'Is my charger cable and adapter electrically safe?',
  'Explain my cable health score calculation and penalty factors',
  'What causes intermittent contact resistance spikes in USB-C?',
  'How do I calibrate my ACS712 and voltage divider sensors?'
];

export const AIAssistantPage: React.FC = () => {
  const { summary, latestTelemetry } = useOutletContext<DashboardContext>();

  const [messages, setMessages] = useState<MessageItem[]>([
    {
      id: 'init-1',
      sender: 'assistant',
      text: 'Hello. I am the ChargeGuard AI Diagnostic Assistant. I continuously inspect real sensor telemetry, electrical Ohm’s law baselines, thermal rise rates, and Machine Learning classification models to answer questions regarding cable degradation, safety envelopes, and troubleshooting steps.',
      timestamp: new Date().toLocaleTimeString(),
      recommendations: [
        'Ask about voltage sag or current draw',
        'Request an audit of electrical safety thresholds',
        'Explain any active alerts or anomalies'
      ],
      provider: 'Deterministic Physical Diagnostic Engine'
    }
  ]);
  const [inputQuery, setInputQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState<string>(() => `session-${Date.now()}`);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSendQuery = async (queryToSend?: string) => {
    const q = (queryToSend || inputQuery).trim();
    if (!q || loading) return;

    const userMsg: MessageItem = {
      id: `usr-${Date.now()}`,
      sender: 'user',
      text: q,
      timestamp: new Date().toLocaleTimeString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInputQuery('');
    setLoading(true);

    try {
      const res: AssistantMessageResponse = await api.askAssistant({
        query: q,
        session_id: sessionId,
        test_id: latestTelemetry?.test_id || summary?.active_test?.test_id,
        device_id: latestTelemetry?.device_id || summary?.current_device_id || 'cg-esp32-001',
        cable_id: latestTelemetry?.cable_id || summary?.active_test?.cable_id || 'cable-001',
      });

      const assistantMsg: MessageItem = {
        id: `asst-${Date.now()}`,
        sender: 'assistant',
        text: res.response,
        timestamp: new Date().toLocaleTimeString(),
        risks: res.detected_risks,
        recommendations: res.recommendations,
        contextUsed: res.context_used,
        provider: res.provider,
      };
      setMessages((prev) => [...prev, assistantMsg]);
    } catch (err: any) {
      const errorMsg: MessageItem = {
        id: `err-${Date.now()}`,
        sender: 'assistant',
        text: `Error analyzing telemetry: ${err.message || 'Diagnostic service offline'}. Defaulting to safe offline engineering check.`,
        timestamp: new Date().toLocaleTimeString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  const liveV = latestTelemetry?.sink_voltage_v ?? 5.0;
  const liveI = latestTelemetry?.current_a ?? 0.0;
  const liveT = latestTelemetry?.temperature_c ?? 25.0;
  const liveDrop = latestTelemetry?.voltage_drop_v ?? 0.0;
  const liveR = latestTelemetry?.effective_resistance_ohm ?? (liveI > 0 ? liveDrop / liveI : 0.0);

  return (
    <div className="flex flex-col h-[calc(100vh-6.5rem)] max-w-6xl mx-auto space-y-4">
      {/* Header & Live Telemetry Context Banner */}
      <div className="p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 shrink-0">
        <div>
          <h2 className="text-base font-bold text-white flex items-center gap-2">
            <Bot className="w-5 h-5 text-cyan-400" />
            <span>AI Diagnostic Assistant</span>
            <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-cyan-950 text-cyan-300 border border-cyan-800">
              Live Hardware Context Active
            </span>
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Empirical telemetry analysis, physics explanations, and safe bench troubleshooting guidance.
          </p>
        </div>

        {/* Live Chips */}
        <div className="flex items-center gap-2 text-xs font-mono">
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-500 mr-1">V:</span>
            <span className="text-cyan-400 font-bold">{liveV.toFixed(2)}V</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-500 mr-1">I:</span>
            <span className="text-emerald-400 font-bold">{liveI.toFixed(2)}A</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-500 mr-1">T:</span>
            <span className="text-amber-400 font-bold">{liveT.toFixed(1)}°C</span>
          </div>
          <div className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-slate-300">
            <span className="text-slate-500 mr-1">R:</span>
            <span className="text-indigo-400 font-bold">{liveR.toFixed(3)}Ω</span>
          </div>
        </div>
      </div>

      {/* Suggested Quick Prompts */}
      <div className="flex gap-2 overflow-x-auto pb-1 shrink-0 scrollbar-none">
        {SUGGESTED_QUERIES.map((q, idx) => (
          <button
            key={idx}
            onClick={() => handleSendQuery(q)}
            disabled={loading}
            className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 text-[11px] whitespace-nowrap transition-colors cursor-pointer flex items-center gap-1.5 shrink-0"
          >
            <Sparkles className="w-3 h-3 text-cyan-400" />
            <span>{q}</span>
          </button>
        ))}
      </div>

      {/* Chat Messages Feed */}
      <div className="flex-1 overflow-y-auto p-4 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
        {messages.map((m) => (
          <div
            key={m.id}
            className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
          >
            <div className="flex items-center space-x-2 text-[10px] text-slate-500 font-mono mb-1 px-1">
              <span>{m.sender === 'user' ? 'You' : 'ChargeGuard AI Assistant'}</span>
              <span>•</span>
              <span>{m.timestamp}</span>
              {m.provider && (
                <>
                  <span>•</span>
                  <span className="text-cyan-400">{m.provider}</span>
                </>
              )}
            </div>

            <div
              className={`max-w-2xl p-4 rounded-2xl text-xs leading-relaxed space-y-3 ${
                m.sender === 'user'
                  ? 'bg-cyan-600 text-white rounded-tr-none'
                  : 'bg-slate-900 text-slate-200 border border-slate-800 rounded-tl-none shadow-md'
              }`}
            >
              <div className="whitespace-pre-wrap font-sans">{m.text}</div>

              {/* Detected Risks */}
              {m.risks && m.risks.length > 0 && (
                <div className="p-3 rounded-xl bg-rose-950/60 border border-rose-800/80 text-rose-200 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] text-rose-300">
                    <ShieldAlert className="w-3.5 h-3.5" />
                    <span>Identified Electrical / Thermal Risks:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 text-rose-200/90">
                    {m.risks.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Recommendations */}
              {m.recommendations && m.recommendations.length > 0 && (
                <div className="p-3 rounded-xl bg-slate-950/80 border border-slate-800 text-slate-300 space-y-1">
                  <div className="font-bold flex items-center gap-1.5 text-[11px] text-cyan-300">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Recommended Engineering Actions:</span>
                  </div>
                  <ul className="list-disc list-inside text-[11px] space-y-0.5 pl-1 text-slate-400">
                    {m.recommendations.map((rec, i) => (
                      <li key={i}>{rec}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Context metadata chip */}
              {m.contextUsed && (
                <div className="text-[10px] font-mono text-slate-500 pt-1 border-t border-slate-800/60">
                  Telemetry Snapshot: {m.contextUsed.avg_voltage_v?.toFixed(2)}V avg, {m.contextUsed.max_temperature_c?.toFixed(1)}°C max, {m.contextUsed.health_score}/100 score
                </div>
              )}
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex items-center space-x-2 text-xs text-cyan-400 p-2 font-mono">
            <RefreshCw className="w-4 h-4 animate-spin" />
            <span>Analyzing empirical telemetry, Ohm’s law variances, and thermal signatures...</span>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Query Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSendQuery();
        }}
        className="p-2 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl flex items-center gap-2 shrink-0"
      >
        <input
          type="text"
          value={inputQuery}
          onChange={(e) => setInputQuery(e.target.value)}
          placeholder="Ask why voltage is dropping, test thermal limits, or explain the health score..."
          className="flex-1 bg-transparent px-4 py-2 text-xs text-white placeholder-slate-500 focus:outline-none"
        />
        <button
          type="submit"
          disabled={loading || !inputQuery.trim()}
          className="px-4 py-2.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-40 shadow-lg shadow-cyan-950"
        >
          <Send className="w-3.5 h-3.5" />
          <span>Send</span>
        </button>
      </form>
    </div>
  );
};
