import { useState, useEffect } from 'react';
import {
  BrainCircuit, CheckCircle2, XCircle, ArrowUpRight,
  Activity, Waves, CloudRain, Thermometer, RefreshCw, Zap
} from 'lucide-react';
import { getAiAlerts, promoteAiAlert, dismissAiAlert, getDistrictSummaries } from '../api/services';
import type { AiAlert, DistrictSummary } from '../types';

export default function AiAnomalyHubPage() {
  const [alerts, setAlerts] = useState<AiAlert[]>([]);
  const [summaries, setSummaries] = useState<DistrictSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [selectedAlert, setSelectedAlert] = useState<AiAlert | null>(null);
  const [promoteModalOpen, setPromoteModalOpen] = useState(false);
  const [targetStatus, setTargetStatus] = useState<'pending_approval' | 'published'>('pending_approval');
  const [hindiTitle, setHindiTitle] = useState('');
  const [customTitle, setCustomTitle] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const [alertsRes, summariesRes] = await Promise.all([
        getAiAlerts({ status: 'pending_review' }),
        getDistrictSummaries(),
      ]);
      setAlerts(alertsRes.data.alerts);
      setSummaries(summariesRes.data.data);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to fetch AI telemetry and alerts');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleOpenPromote = (alert: AiAlert) => {
    setSelectedAlert(alert);
    setCustomTitle(`[AI Early Warning] ${alert.hazardType} in ${alert.district}`);
    setHindiTitle(`[चेतावनी] ${alert.district} में ${alert.hazardType} का खतरा`);
    setPromoteModalOpen(true);
  };

  const handleConfirmPromote = async () => {
    if (!selectedAlert) return;
    setActionLoading(selectedAlert._id);
    try {
      await promoteAiAlert(selectedAlert._id, {
        targetStatus,
        customTitle,
        hindiTitle,
      });
      setSuccessMsg(`AI Alert successfully promoted to ${targetStatus === 'published' ? 'Published Event' : 'SDMA Approval Queue'}`);
      setPromoteModalOpen(false);
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to promote AI alert');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await dismissAiAlert(alertId, 'Dismissed as non-threatening anomaly by operator');
      setSuccessMsg('AI alert proposal marked as dismissed.');
      fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to dismiss alert');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <BrainCircuit size={20} color="var(--blue-600)" />
          <span className="topbar-title">AI Anomaly & Risk Detection Hub</span>
          <span style={{
            fontSize: 11,
            background: 'var(--blue-50)',
            color: 'var(--blue-700)',
            padding: '2px 8px',
            borderRadius: 12,
            fontWeight: 700,
            border: '1px solid var(--blue-200)',
          }}>
            AUTOMATED PIPELINE
          </span>
        </div>
        <button
          className="btn btn-secondary btn-sm"
          onClick={fetchData}
          disabled={loading}
          style={{ display: 'flex', alignItems: 'center', gap: 6 }}
        >
          <RefreshCw size={14} className={loading ? 'spin' : ''} />
          Refresh Pipeline
        </button>
      </div>

      <div className="page-content">
        {successMsg && (
          <div style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            fontSize: 13,
            fontWeight: 600,
          }}>
            <CheckCircle2 size={16} />
            {successMsg}
          </div>
        )}

        {errorMsg && (
          <div style={{
            background: '#fef2f2',
            color: '#991b1b',
            border: '1px solid #fecaca',
            padding: '12px 16px',
            borderRadius: 6,
            marginBottom: 20,
            fontSize: 13,
          }}>
            {errorMsg}
          </div>
        )}

        {/* ── District Telemetry Bar ────────────────────────────────────────── */}
        <div className="card" style={{ marginBottom: 24 }}>
          <div className="card-header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Activity size={18} color="var(--grey-700)" />
                Regional Telemetry Overview (Uttar Pradesh Basin)
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--grey-500)' }}>
                Live observations from IMD automatic weather stations & Central Water Commission (CWC) river gauges
              </p>
            </div>
          </div>

          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: 16,
            padding: 16,
          }}>
            {summaries.map((s) => {
              const isRainHigh = s.rainfall?.isAnomaly;
              const isRiverHigh = s.riverLevel?.isAnomaly;
              const isCritical = isRainHigh || isRiverHigh;

              return (
                <div
                  key={s.district}
                  style={{
                    border: `1.5px solid ${isCritical ? 'var(--red-400)' : 'var(--grey-200)'}`,
                    borderRadius: 6,
                    padding: 14,
                    background: isCritical ? '#fff8f8' : 'var(--white)',
                    boxShadow: isCritical ? '0 2px 8px rgba(239, 68, 68, 0.1)' : 'none',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{s.district}</span>
                    {isCritical ? (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 800,
                        color: 'var(--red-700)',
                        background: 'var(--red-100)',
                        padding: '2px 6px',
                        borderRadius: 4,
                      }}>
                        SPIKE DETECTED
                      </span>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--grey-500)' }}>Normal</span>
                    )}
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, fontSize: 11 }}>
                    <div style={{ background: 'var(--grey-50)', padding: 6, borderRadius: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--grey-600)', marginBottom: 2 }}>
                        <CloudRain size={12} /> Rain
                      </div>
                      <div style={{ fontWeight: 700, color: isRainHigh ? 'var(--red-600)' : 'inherit' }}>
                        {s.rainfall ? `${s.rainfall.value} mm` : '—'}
                      </div>
                    </div>

                    <div style={{ background: 'var(--grey-50)', padding: 6, borderRadius: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--grey-600)', marginBottom: 2 }}>
                        <Waves size={12} /> River
                      </div>
                      <div style={{ fontWeight: 700, color: isRiverHigh ? 'var(--red-600)' : 'inherit' }}>
                        {s.riverLevel ? `${s.riverLevel.value} m` : '—'}
                      </div>
                      {s.riverLevel?.dangerLevel && (
                        <div style={{ fontSize: 9, color: 'var(--grey-500)' }}>DL: {s.riverLevel.dangerLevel}m</div>
                      )}
                    </div>

                    <div style={{ background: 'var(--grey-50)', padding: 6, borderRadius: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 4, color: 'var(--grey-600)', marginBottom: 2 }}>
                        <Thermometer size={12} /> Temp
                      </div>
                      <div style={{ fontWeight: 700 }}>
                        {s.temperature ? `${s.temperature.value} °C` : '—'}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── AI Anomaly Detection Pipeline ─────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <Zap size={18} color="var(--amber-500)" />
                AI-Suggested Alert Proposals ({alerts.length})
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--grey-500)' }}>
                Emerging anomalies flagged by statistical time-series models requiring researcher verification or SDMA publication
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><span className="spinner" /> Evaluating telemetry...</div>
          ) : alerts.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <CheckCircle2 size={36} color="var(--emerald-600)" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>All environmental indicators are within normal thresholds.</p>
              <span style={{ fontSize: 12, color: 'var(--grey-500)' }}>
                No active anomalies detected across Indian monitoring stations.
              </span>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16, padding: 20 }}>
              {alerts.map((al) => {
                const scorePct = Math.round(al.score * 100);
                return (
                  <div
                    key={al._id}
                    style={{
                      border: '1.5px solid var(--grey-300)',
                      borderRadius: 8,
                      padding: 20,
                      background: 'var(--white)',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 12 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                          <span style={{
                            background: 'var(--black)',
                            color: 'var(--white)',
                            fontSize: 11,
                            fontWeight: 800,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}>
                            {al.district.toUpperCase()}, {al.state}
                          </span>
                          <span style={{
                            background: 'var(--red-100)',
                            color: 'var(--red-800)',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}>
                            {al.hazardType}
                          </span>
                          <span style={{
                            background: 'var(--amber-100)',
                            color: 'var(--amber-800)',
                            fontSize: 11,
                            fontWeight: 700,
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}>
                            Rec. Severity: {al.recommendedSeverity}
                          </span>
                        </div>
                        <div style={{ fontSize: 12, color: 'var(--grey-500)' }}>
                          Detected: {new Date(al.createdAt).toLocaleString()} • Algorithm: Rolling Z-Score & Basin Influx
                        </div>
                      </div>

                      {/* Anomaly Score Meter */}
                      <div style={{ minWidth: 160, textAlign: 'right' }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--grey-600)', marginBottom: 4 }}>
                          Anomaly Score: <span style={{ fontSize: 14, color: 'var(--red-600)' }}>{al.score.toFixed(2)}</span> / 1.00
                        </div>
                        <div style={{ width: '100%', background: 'var(--grey-200)', height: 8, borderRadius: 4, overflow: 'hidden' }}>
                          <div style={{
                            width: `${scorePct}%`,
                            background: scorePct > 80 ? 'var(--red-600)' : 'var(--amber-500)',
                            height: '100%',
                            transition: 'width 0.3s ease',
                          }} />
                        </div>
                      </div>
                    </div>

                    {/* AI Explainability Statement */}
                    <div style={{
                      background: 'var(--grey-50)',
                      borderLeft: '4px solid var(--blue-600)',
                      padding: 12,
                      borderRadius: '0 4px 4px 0',
                      margin: '14px 0',
                      fontSize: 13,
                      lineHeight: 1.5,
                      color: 'var(--grey-800)',
                    }}>
                      <div style={{ fontWeight: 700, fontSize: 11, color: 'var(--blue-700)', marginBottom: 4, textTransform: 'uppercase' }}>
                        AI Model Explanation & Evidence
                      </div>
                      {al.explanation}
                    </div>

                    {/* Contributing Features */}
                    {al.anomalyFeatures && al.anomalyFeatures.length > 0 && (
                      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', marginBottom: 16 }}>
                        {al.anomalyFeatures.map((f, i) => (
                          <div
                            key={i}
                            style={{
                              background: 'var(--white)',
                              border: '1px solid var(--grey-300)',
                              borderRadius: 4,
                              padding: '8px 12px',
                              fontSize: 11,
                            }}
                          >
                            <span style={{ color: 'var(--grey-600)', textTransform: 'capitalize' }}>
                              {f.indicator.replace('_', ' ')}:
                            </span>{' '}
                            <strong>{f.currentValue} {f.unit}</strong>{' '}
                            <span style={{ color: 'var(--red-600)', fontWeight: 600 }}>
                              (+{f.deviationScore.toFixed(1)}σ vs normal {f.baselineMean} {f.unit})
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Action Bar */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                      <button
                        className="btn btn-secondary btn-sm"
                        onClick={() => handleDismiss(al._id)}
                        disabled={actionLoading === al._id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <XCircle size={14} /> Dismiss False Positive
                      </button>
                      <button
                        className="btn btn-primary btn-sm"
                        onClick={() => handleOpenPromote(al)}
                        disabled={actionLoading === al._id}
                        style={{ display: 'flex', alignItems: 'center', gap: 6 }}
                      >
                        <ArrowUpRight size={14} /> Promote to Disaster Alert
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Promote Modal ─────────────────────────────────────────────────── */}
      {promoteModalOpen && selectedAlert && (
        <div className="modal-backdrop">
          <div className="modal" style={{ maxWidth: 540 }}>
            <div className="modal-header">
              <h3>Promote AI Alert to Disaster Event</h3>
              <button onClick={() => setPromoteModalOpen(false)}>✕</button>
            </div>
            <div className="modal-body">
              <p style={{ fontSize: 13, color: 'var(--grey-600)', marginBottom: 14 }}>
                Convert this AI proposal for <strong>{selectedAlert.district}</strong> into an actionable disaster event.
              </p>

              <div className="form-group">
                <label className="form-label">Alert Title (English)</label>
                <input
                  type="text"
                  className="form-input"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Alert Title (Hindi / हिंदी)</label>
                <input
                  type="text"
                  className="form-input"
                  value={hindiTitle}
                  onChange={(e) => setHindiTitle(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Target Workflow Stage</label>
                <select
                  className="form-select"
                  value={targetStatus}
                  onChange={(e: any) => setTargetStatus(e.target.value)}
                >
                  <option value="pending_approval">Submit for SDMA Operator Review (Pending Approval)</option>
                  <option value="published">Direct Publish & Dispatch to Citizens (High Urgency)</option>
                </select>
                <span className="form-hint">
                  {targetStatus === 'published'
                    ? '⚠️ Direct publish immediately pushes FCM siren notifications to citizens in the zone.'
                    : 'Event will appear in the SDMA approval queue for verification.'}
                </span>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setPromoteModalOpen(false)}>
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={handleConfirmPromote}
                disabled={actionLoading !== null}
              >
                {actionLoading ? 'Processing…' : 'Confirm & Create Event'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
