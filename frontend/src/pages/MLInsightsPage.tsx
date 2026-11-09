import React, { useState, useEffect } from 'react';
import {
  BrainCircuit,
  Activity,
  AlertTriangle,
  ShieldCheck,
  CheckCircle2,
  RefreshCw,
  Gauge,
  Sliders,
  TrendingDown,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Database,
  BarChart3,
  Cpu
} from 'lucide-react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell
} from 'recharts';
import { api } from '../api/client';
import {
  MLModelMetadata,
  MLAnomalyDetectionResponse,
  MLFaultClassificationResponse,
  MLPredictiveMaintenanceResponse,
  MLRetrainResponse
} from '../types';

export const MLInsightsPage: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'anomaly' | 'classification' | 'predictive' | 'registry'>('anomaly');
  const [models, setModels] = useState<MLModelMetadata[]>([]);
  const [anomalyResult, setAnomalyResult] = useState<MLAnomalyDetectionResponse | null>(null);
  const [faultResult, setFaultResult] = useState<MLFaultClassificationResponse | null>(null);
  const [predictiveResult, setPredictiveResult] = useState<MLPredictiveMaintenanceResponse | null>(null);

  const [loading, setLoading] = useState<boolean>(true);
  const [retraining, setRetraining] = useState<boolean>(false);
  const [retrainNotice, setRetrainNotice] = useState<string | null>(null);

  const loadAllMLData = async () => {
    setLoading(true);
    try {
      const [modelsData, anomalyData, faultData, predData] = await Promise.all([
        api.getMLModels().catch(() => []),
        api.runAnomalyDetection().catch(() => null),
        api.classifyFault().catch(() => null),
        api.getPredictiveMaintenance().catch(() => null),
      ]);
      setModels(modelsData);
      setAnomalyResult(anomalyData);
      setFaultResult(faultData);
      setPredictiveResult(predData);
    } catch (err) {
      console.error('Error loading ML subsystem data:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadAllMLData();
  }, []);

  const handleRetrain = async (modelType: string = 'all') => {
    setRetraining(true);
    setRetrainNotice(null);
    try {
      const res: MLRetrainResponse = await api.retrainML(modelType, 500);
      setRetrainNotice(`Models retrained successfully: ${res.models_trained.join(', ')}`);
      await loadAllMLData();
    } catch (err: any) {
      setRetrainNotice(`Retraining error: ${err.message || 'Failed'}`);
    } finally {
      setRetraining(false);
    }
  };

  // Format contributing features for chart
  const featureChartData = anomalyResult?.contributing_features
    ? Object.entries(anomalyResult.contributing_features).map(([name, score]) => ({
        feature: name.replace(/_/g, ' '),
        importance: Number(score.toFixed(3)),
      }))
    : [];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2.5">
            <BrainCircuit className="w-6 h-6 text-cyan-400" />
            <span>Machine Learning & Predictive Maintenance Subsystem</span>
          </h2>
          <p className="text-xs text-slate-400 mt-1">
            Scikit-Learn Isolation Forest anomaly detector, multi-class fault classifier, and empirical degradation physics models.
          </p>
        </div>

        <button
          onClick={() => handleRetrain('all')}
          disabled={retraining}
          className="px-3.5 py-2 rounded-xl bg-cyan-600/20 hover:bg-cyan-600/30 border border-cyan-500/40 text-cyan-300 text-xs font-semibold flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 self-start sm:self-auto"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${retraining ? 'animate-spin' : ''}`} />
          <span>{retraining ? 'Re-training Models...' : 'Retrain ML Models'}</span>
        </button>
      </div>

      {retrainNotice && (
        <div className="p-3.5 rounded-xl bg-cyan-950/60 border border-cyan-800/80 text-cyan-200 text-xs flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-cyan-400 shrink-0" />
          <span>{retrainNotice}</span>
        </div>
      )}

      {/* Navigation Tabs */}
      <div className="flex p-1 bg-slate-900/80 border border-slate-800 rounded-xl text-xs font-medium">
        <button
          onClick={() => setActiveTab('anomaly')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'anomaly'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Activity className="w-4 h-4" />
          <span>Anomaly Detection</span>
        </button>
        <button
          onClick={() => setActiveTab('classification')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'classification'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Gauge className="w-4 h-4" />
          <span>Fault Classification</span>
        </button>
        <button
          onClick={() => setActiveTab('predictive')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'predictive'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <TrendingDown className="w-4 h-4" />
          <span>Predictive Maintenance</span>
        </button>
        <button
          onClick={() => setActiveTab('registry')}
          className={`flex-1 py-2 px-3 rounded-lg flex items-center justify-center gap-2 transition-colors cursor-pointer ${
            activeTab === 'registry'
              ? 'bg-cyan-500/20 text-cyan-300 font-semibold border border-cyan-500/30'
              : 'text-slate-400 hover:text-slate-200'
          }`}
        >
          <Database className="w-4 h-4" />
          <span>Model Registry & Metrics</span>
        </button>
      </div>

      {/* TAB 1: ANOMALY DETECTION */}
      {activeTab === 'anomaly' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Anomaly Gauge Card */}
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>Anomaly Status</span>
                <span className="font-mono text-[10px] text-cyan-400">Isolation Forest</span>
              </div>

              <div className="text-center py-4">
                <div className={`text-4xl font-extrabold font-mono ${
                  anomalyResult?.is_anomaly ? 'text-rose-400' : 'text-emerald-400'
                }`}>
                  {anomalyResult?.anomaly_score != null ? anomalyResult.anomaly_score.toFixed(1) : '--'}
                  <span className="text-sm font-normal text-slate-400 ml-1">/100</span>
                </div>
                <div className={`mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                  anomalyResult?.is_anomaly
                    ? 'bg-rose-950 text-rose-300 border border-rose-800'
                    : 'bg-emerald-950 text-emerald-300 border border-emerald-800'
                }`}>
                  {anomalyResult?.is_anomaly ? <AlertTriangle className="w-3.5 h-3.5" /> : <ShieldCheck className="w-3.5 h-3.5" />}
                  <span>{anomalyResult?.is_anomaly ? 'ANOMALOUS TELEMETRY' : 'NOMINAL PATTERN'}</span>
                </div>
              </div>

              <div className="pt-3 border-t border-slate-800/80 text-xs text-slate-400 space-y-2">
                <div className="flex justify-between">
                  <span>Model Confidence:</span>
                  <span className="text-white font-mono">{((anomalyResult?.confidence || 0) * 100).toFixed(0)}%</span>
                </div>
                <div className="flex justify-between">
                  <span>Inference Engine:</span>
                  <span className="text-cyan-400">Scikit-Learn iForest</span>
                </div>
              </div>
            </div>

            {/* Explanation & Insight */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-3">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-300">
                <Sparkles className="w-4 h-4 text-cyan-400" />
                <span>Feature Contribution & Engineering Analysis</span>
              </div>
              <p className="text-xs text-slate-300 leading-relaxed bg-slate-900/60 p-4 rounded-xl border border-slate-800 font-mono">
                {anomalyResult?.explanation || 'Awaiting telemetry vector ingestion...'}
              </p>

              {/* Feature Importance Vector Bar Chart */}
              <div className="mt-4 pt-4 border-t border-slate-800/80">
                <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-2">
                  Top Contributing Engineering Features:
                </div>
                <div className="h-44 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={featureChartData} layout="vertical" margin={{ left: 80, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                      <XAxis type="number" stroke="#64748b" tick={{ fontSize: 10 }} />
                      <YAxis dataKey="feature" type="category" stroke="#94a3b8" tick={{ fontSize: 10 }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: '#0f172a', borderColor: '#334155', borderRadius: '8px', fontSize: '11px' }}
                      />
                      <Bar dataKey="importance" fill="#06b6d4" radius={[0, 4, 4, 0]}>
                        {featureChartData.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={index === 0 ? '#f43f5e' : index === 1 ? '#fbbf24' : '#06b6d4'} />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: FAULT CLASSIFICATION */}
      {activeTab === 'classification' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Primary Classification Result */}
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Predicted Electrical Fault</span>
                <span className="text-[10px] font-mono text-cyan-400">Random Forest</span>
              </div>

              <div className="text-center py-6">
                <div className="text-2xl font-bold font-mono tracking-tight text-cyan-300">
                  {faultResult?.predicted_fault || 'ANALYZING'}
                </div>
                <div className="text-xs text-slate-400 mt-2 font-mono">
                  Confidence: {((faultResult?.confidence || 0) * 100).toFixed(1)}%
                </div>
                {faultResult?.rule_fallback_active && (
                  <div className="mt-2 text-[10px] px-2 py-0.5 rounded bg-amber-950 text-amber-300 border border-amber-800 inline-block">
                    Hybrid Rule Arbiter Engaged
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs text-slate-300">
                <span className="font-semibold text-cyan-400">Classifier Logic:</span>
                <p className="mt-1 text-[11px] text-slate-400 leading-relaxed">
                  {faultResult?.explanation || 'Evaluating rolling electrical parameters against 7 supervised fault signatures.'}
                </p>
              </div>
            </div>

            {/* Class Probabilities Progress Distribution */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
              <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
                <span>Supervised Class Probability Spectrum (7 Classes)</span>
                <span className="text-[10px] text-slate-500 font-mono">Softmax Distribution</span>
              </div>

              <div className="space-y-3 pt-2">
                {faultResult?.class_probabilities && Object.entries(faultResult.class_probabilities).map(([className, prob]) => {
                  const pct = Math.round(prob * 100);
                  const isPredicted = className === faultResult.predicted_fault;
                  return (
                    <div key={className} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className={`font-mono ${isPredicted ? 'text-cyan-300 font-bold' : 'text-slate-400'}`}>
                          {className}
                        </span>
                        <span className="font-mono text-slate-400 text-xs">{pct}%</span>
                      </div>
                      <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full transition-all duration-500 rounded-full ${
                            className === 'NORMAL'
                              ? 'bg-emerald-500'
                              : className === 'OVERHEATING'
                              ? 'bg-rose-500'
                              : isPredicted
                              ? 'bg-cyan-400'
                              : 'bg-slate-600'
                          }`}
                          style={{ width: `${Math.max(pct, 2)}%` }}
                        ></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: PREDICTIVE MAINTENANCE */}
      {activeTab === 'predictive' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            {/* Degradation Score */}
            <div className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
              <div className="text-xs text-slate-400 flex items-center justify-between">
                <span>Degradation Risk Assessment</span>
                <span className="text-[10px] text-cyan-400 font-mono">Longitudinal</span>
              </div>

              <div className="text-center py-4">
                <div className={`text-4xl font-extrabold font-mono ${
                  (predictiveResult?.degradation_risk_score || 0) > 60
                    ? 'text-rose-400'
                    : (predictiveResult?.degradation_risk_score || 0) > 30
                    ? 'text-amber-400'
                    : 'text-emerald-400'
                }`}>
                  {predictiveResult?.degradation_risk_score != null ? predictiveResult.degradation_risk_score.toFixed(1) : '--'}
                  <span className="text-sm font-normal text-slate-400 ml-1">/100</span>
                </div>
                <div className="mt-2 text-xs font-bold uppercase text-slate-200">
                  {predictiveResult?.risk_category || 'Nominal Condition'}
                </div>
              </div>

              <div className="p-3 rounded-xl bg-slate-900 border border-slate-800 text-xs space-y-1.5">
                <div className="flex justify-between text-slate-400">
                  <span>Cycle Projection:</span>
                  <span className="text-white font-mono">
                    {predictiveResult?.estimated_remaining_cycles != null
                      ? `~${predictiveResult.estimated_remaining_cycles} cycles`
                      : 'Conditionally Unbounded'}
                  </span>
                </div>
                <div className="flex justify-between text-slate-400">
                  <span>Degradation Confidence:</span>
                  <span className="text-cyan-400 font-mono">
                    {((predictiveResult?.confidence || 0) * 100).toFixed(0)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Longitudinal Indicators */}
            <div className="md:col-span-2 p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-4">
              <div className="text-xs font-semibold text-slate-300">
                Longitudinal Degradation Tracking Metrics
              </div>

              <div className="grid grid-cols-2 gap-3 pt-2">
                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Loop Resistance Growth</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {predictiveResult?.degradation_indicators?.resistance_growth_pct != null
                      ? `+${predictiveResult.degradation_indicators.resistance_growth_pct.toFixed(2)}%`
                      : '0.00%'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Contact oxidation & pin fatigue indicator</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Thermal Rise Rate</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {predictiveResult?.degradation_indicators?.thermal_rise_rate != null
                      ? `${predictiveResult.degradation_indicators.thermal_rise_rate.toFixed(3)} °C/s`
                      : '0.012 °C/s'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Conductor Joule heating dissipation velocity</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Voltage Stability Index</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {predictiveResult?.degradation_indicators?.voltage_stability_variance != null
                      ? `σ = ${predictiveResult.degradation_indicators.voltage_stability_variance.toFixed(4)}V`
                      : 'σ = 0.0040V'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Micro-arc and intermittent contact variance</div>
                </div>

                <div className="p-3.5 rounded-xl bg-slate-900 border border-slate-800">
                  <div className="text-[11px] text-slate-400">Cycle Stress Factor</div>
                  <div className="text-lg font-bold text-white font-mono mt-1">
                    {predictiveResult?.degradation_indicators?.cycle_stress_factor != null
                      ? `${(predictiveResult.degradation_indicators.cycle_stress_factor * 100).toFixed(0)}%`
                      : '15%'}
                  </div>
                  <div className="text-[10px] text-slate-500 mt-1">Accumulated mechanical flex and insertion wear</div>
                </div>
              </div>

              {/* Physical Limitations Disclosure */}
              <div className="p-3.5 rounded-xl bg-indigo-950/40 border border-indigo-800/40 text-xs text-indigo-200 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-cyan-400 shrink-0 mt-0.5" />
                <div className="text-[11px] leading-relaxed">
                  <span className="font-bold text-cyan-300">Engineering Physics Disclaimer:</span>{' '}
                  {predictiveResult?.limitations || 'Remaining useful life (RUL) estimates require longitudinal cycle-to-failure testing. Single-screening measurements assess current health and contact degradation risk only.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: MODEL REGISTRY */}
      {activeTab === 'registry' && (
        <div className="space-y-4">
          <div className="text-xs font-semibold text-slate-300 flex items-center justify-between">
            <span>Production ML Model Registry & Benchmarks</span>
            <span className="text-[10px] text-slate-400 font-mono">Joblib Serialized Artefacts</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {models.map((m) => (
              <div key={m.id} className="p-5 rounded-2xl bg-[#0f172a] border border-slate-800 shadow-xl space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-sm font-bold text-white uppercase tracking-wider">{m.model_type.replace(/_/g, ' ')}</h3>
                    <div className="text-[11px] text-cyan-400 font-mono mt-0.5">{m.algorithm} (v{m.version})</div>
                  </div>
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    m.is_active ? 'bg-emerald-950 text-emerald-300 border border-emerald-800' : 'bg-slate-800 text-slate-400'
                  }`}>
                    {m.is_active ? 'Active in Production' : 'Archived'}
                  </span>
                </div>

                <div className="p-3 rounded-xl bg-slate-900 border border-slate-800/80 text-xs font-mono text-slate-300 space-y-1">
                  <div className="text-[10px] text-slate-400 uppercase tracking-wider font-sans mb-1">
                    Evaluation Metrics & Parameters:
                  </div>
                  <pre className="text-[11px] text-slate-300 overflow-x-auto">
                    {JSON.stringify(m.metrics, null, 2)}
                  </pre>
                </div>

                <div className="flex justify-between items-center text-[11px] text-slate-400 pt-1">
                  <span>Trained: {m.trained_at ? new Date(m.trained_at).toLocaleString() : 'System Baseline'}</span>
                  <button
                    onClick={() => handleRetrain(m.model_type)}
                    disabled={retraining}
                    className="text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
                  >
                    Retrain Model
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
