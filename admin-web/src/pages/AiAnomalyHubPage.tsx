import { useEffect, useState } from 'react';
import {
  Activity, ArrowUpRight, BrainCircuit, CheckCircle2, CircleCheck,
  CloudRain, Eye, Info, LoaderCircle, MapPin, OctagonAlert, RefreshCw,
  ShieldCheck, Thermometer, TriangleAlert, Waves, XCircle, Zap,
} from 'lucide-react';
import { getAiAlerts, promoteAiAlert, dismissAiAlert, getDistrictSummaries } from '../api/services';
import type { AiAlert, DistrictSummary, Severity } from '../types';
import './AiAnomalyHubPage.css';

type RiskLevel = 'normal' | 'watch' | 'warning' | 'critical';

const riskRank: Record<RiskLevel, number> = { normal: 0, watch: 1, warning: 2, critical: 3 };

function riskFromSeverity(severity?: Severity): RiskLevel {
  switch (severity) {
    case 'Critical': return 'critical';
    case 'High': return 'warning';
    case 'Medium': return 'watch';
    default: return 'normal';
  }
}

function riskFromScore(score: number): RiskLevel {
  if (score >= 0.8) return 'critical';
  if (score >= 0.6) return 'warning';
  if (score >= 0.4) return 'watch';
  return 'normal';
}

function formatTimestamp(timestamp?: string) {
  if (!timestamp) return 'Timestamp unavailable';
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? 'Timestamp unavailable' : date.toLocaleString();
}

function hazardClass(hazardType: string) {
  const type = hazardType.toLowerCase();
  if (type.includes('flood') || type.includes('waterlog')) return 'flood';
  if (type.includes('heat') || type.includes('cyclone') || type.includes('rain')) return 'heat';
  if (type.includes('storm') || type.includes('landslide')) return 'storm';
  if (type.includes('earthquake') || type.includes('fire')) return 'earth';
  return 'other';
}

function indicatorIcon(indicator: string) {
  const name = indicator.toLowerCase();
  if (name.includes('rain')) return CloudRain;
  if (name.includes('river') || name.includes('water') || name.includes('level')) return Waves;
  if (name.includes('temp') || name.includes('heat')) return Thermometer;
  return Activity;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`ai-skeleton ${className}`} />;
}

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
      setErrorMsg(err.response?.data?.message || 'Unable to retrieve current anomaly intelligence.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const loadInitialData = async () => {
      try {
        const [alertsRes, summariesRes] = await Promise.all([
          getAiAlerts({ status: 'pending_review' }),
          getDistrictSummaries(),
        ]);
        if (!active) return;
        setAlerts(alertsRes.data.alerts);
        setSummaries(summariesRes.data.data);
      } catch (err: any) {
        if (active) setErrorMsg(err.response?.data?.message || 'Unable to retrieve current anomaly intelligence.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void loadInitialData();
    return () => { active = false; };
  }, []);

  const observationTimes = [
    ...summaries.flatMap((summary) => [summary.rainfall?.timestamp, summary.riverLevel?.timestamp, summary.temperature?.timestamp]),
  ].filter((timestamp): timestamp is string => Boolean(timestamp));
  const latestObservation = observationTimes
    .map((timestamp) => new Date(timestamp))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((left, right) => right.getTime() - left.getTime())[0];

  const anomalyDistricts = new Set([
    ...summaries
      .filter((summary) => summary.rainfall?.isAnomaly || summary.riverLevel?.isAnomaly || summary.temperature?.isAnomaly)
      .map((summary) => summary.district),
    ...alerts.map((alert) => alert.district),
  ]);
  const highestAlertRisk = alerts.reduce<RiskLevel>((highest, alert) => {
    const risk = riskFromSeverity(alert.recommendedSeverity);
    return riskRank[risk] > riskRank[highest] ? risk : highest;
  }, 'normal');
  const highestRisk: RiskLevel = anomalyDistricts.size > 0 && riskRank[highestAlertRisk] === 0 ? 'watch' : highestAlertRisk;
  const pipelineOnline = !loading && !errorMsg;

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
      await promoteAiAlert(selectedAlert._id, { targetStatus, customTitle, hindiTitle });
      setSuccessMsg(`AI proposal promoted to ${targetStatus === 'published' ? 'Published Event' : 'SDMA Approval Queue'}.`);
      setPromoteModalOpen(false);
      void fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to promote AI alert.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleDismiss = async (alertId: string) => {
    setActionLoading(alertId);
    try {
      await dismissAiAlert(alertId, 'Dismissed as non-threatening anomaly by operator');
      setSuccessMsg('AI alert proposal marked as dismissed.');
      void fetchData();
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Failed to dismiss alert.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="ai-hub">
      <header className="topbar ai-hub-topbar">
        <div className="ai-hub-heading">
          <BrainCircuit size={21} aria-hidden="true" />
          <div className="ai-hub-heading-copy">
            <h1>AI Anomaly &amp; Risk Detection Hub</h1>
            <span>AI-ASSISTED EARLY WARNING</span>
          </div>
        </div>
        <div className="ai-hub-header-tools">
          <div className={`ai-pipeline-state ${pipelineOnline ? 'is-online' : loading ? 'is-loading' : 'is-error'}`}>
            <span className="ai-status-dot" />
            {pipelineOnline ? 'PIPELINE ONLINE' : loading ? 'CONNECTING' : 'PIPELINE UNAVAILABLE'}
          </div>
          <span className="ai-last-scan">Latest observation: {latestObservation ? latestObservation.toLocaleString() : 'Unavailable'}</span>
          <button className="btn btn-secondary btn-sm ai-refresh-button" onClick={fetchData} disabled={loading}>
            {loading ? <LoaderCircle size={15} className="ai-spin" /> : <RefreshCw size={15} />}
            {loading ? 'Refreshing...' : 'Refresh Pipeline'}
          </button>
        </div>
      </header>

      <main className="page-content ai-hub-content">
        {successMsg && (
          <div className="ai-message ai-message-success" role="status">
            <CheckCircle2 size={17} /><span>{successMsg}</span>
            <button aria-label="Dismiss message" onClick={() => setSuccessMsg('')}><XCircle size={16} /></button>
          </div>
        )}

        {errorMsg && (
          <section className="ai-error-panel" role="alert">
            <div className="ai-error-copy">
              <span className="ai-error-label"><TriangleAlert size={15} />AI PIPELINE UNAVAILABLE</span>
              <p>Unable to retrieve current anomaly intelligence.</p>
              {errorMsg !== 'Unable to retrieve current anomaly intelligence.' && <small>{errorMsg}</small>}
            </div>
            <div className="ai-error-actions">
              <button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}>Retry</button>
              {(summaries.length > 0 || alerts.length > 0) && <button className="btn btn-secondary btn-sm" onClick={() => document.getElementById('regional-telemetry')?.scrollIntoView({ behavior: 'smooth' })}>View Last Available Telemetry</button>}
            </div>
          </section>
        )}

        <section className="ai-summary-grid" aria-label="AI pipeline summary" aria-busy={loading}>
          {loading ? Array.from({ length: 4 }, (_, index) => <Skeleton className="ai-summary-skeleton" key={index} />) : <>
            <SummaryCard icon={MapPin} label="Regions monitored" value={summaries.length} detail="Delhi-NCR districts" tone="navy" />
            <SummaryCard icon={Activity} label="Active anomalies" value={anomalyDistricts.size} detail="Districts with elevated signals" tone={anomalyDistricts.size ? 'warning' : 'normal'} />
            <SummaryCard icon={Zap} label="Alert proposals" value={alerts.length} detail="Awaiting operator review" tone={alerts.length ? 'watch' : 'normal'} />
            <SummaryCard icon={riskIcon(highestRisk)} label="Highest risk" value={riskLabel(highestRisk)} detail="Across available signals" tone={highestRisk} />
          </>}
        </section>

        <section className="card ai-section" id="regional-telemetry" aria-busy={loading}>
          <div className="ai-section-heading">
            <div>
              <div className="ai-section-title"><Activity size={18} /><h2>Regional Telemetry Overview (Delhi NCR Region)</h2></div>
              <p>Live environmental observations used by the RakṣāSetu early-warning pipeline.</p>
            </div>
            <span className="ai-source-label">Source: OpenWeatherMap telemetry</span>
          </div>
          {loading ? <div className="ai-telemetry-grid" aria-label="Loading regional telemetry">{Array.from({ length: 6 }, (_, index) => <Skeleton className="ai-telemetry-skeleton" key={index} />)}</div> : summaries.length === 0 ? <div className="ai-telemetry-empty">No regional telemetry is currently available.</div> : (
            <div className="ai-telemetry-grid">
              {summaries.map((summary) => {
                const relatedAlerts = alerts.filter((alert) => alert.district.toLowerCase() === summary.district.toLowerCase());
                const alertRisk = relatedAlerts.reduce<RiskLevel>((highest, alert) => {
                  const risk = riskFromSeverity(alert.recommendedSeverity);
                  return riskRank[risk] > riskRank[highest] ? risk : highest;
                }, 'normal');
                const hasAnomaly = Boolean(summary.rainfall?.isAnomaly || summary.riverLevel?.isAnomaly || summary.temperature?.isAnomaly);
                const risk = riskRank[alertRisk] > 0 ? alertRisk : hasAnomaly ? 'watch' : 'normal';
                const StateIcon = riskIcon(risk);
                return (
                  <article className={`ai-telemetry-card risk-${risk}`} key={`${summary.state}-${summary.district}`}>
                    <div className="ai-telemetry-card-heading">
                      <div><h3>{summary.district}</h3><span>{summary.state}</span></div>
                      <span className={`ai-risk-badge risk-${risk}`}><StateIcon size={13} />{riskLabel(risk)}</span>
                    </div>
                    <div className="ai-metric-grid">
                      <TelemetryMetric icon={CloudRain} label="Rainfall" value={summary.rainfall ? `${summary.rainfall.value} ${summary.rainfall.unit}` : '—'} tone={summary.rainfall?.isAnomaly ? 'watch' : ''} />
                      <TelemetryMetric icon={Waves} label="River level" value={summary.riverLevel ? `${summary.riverLevel.value} ${summary.riverLevel.unit}` : '—'} detail={summary.riverLevel?.dangerLevel ? `Danger level ${summary.riverLevel.dangerLevel} ${summary.riverLevel.unit}` : undefined} tone={summary.riverLevel?.isAnomaly ? 'warning' : ''} />
                      <TelemetryMetric icon={Thermometer} label="Temperature" value={summary.temperature ? `${summary.temperature.value} ${summary.temperature.unit}` : '—'} tone={summary.temperature?.isAnomaly ? 'watch' : ''} />
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        <section className="card ai-section ai-proposals-section" aria-busy={loading}>
          <div className="ai-section-heading ai-proposals-heading">
            <div>
              <div className="ai-section-title"><Zap size={18} /><h2>AI-Suggested Alert Proposals ({loading ? '—' : alerts.length})</h2></div>
              <p>AI-detected anomalies requiring verification before public alert issuance.</p>
            </div>
            <div className="ai-assisted-badge"><BrainCircuit size={15} /><span><strong>AI ASSISTED</strong><small>Human verification required</small></span></div>
          </div>
          {loading ? <div className="ai-proposal-list" aria-label="Loading proposals">{Array.from({ length: 2 }, (_, index) => <Skeleton className="ai-proposal-skeleton" key={index} />)}</div> : alerts.length === 0 ? (
            <div className="ai-empty-state">
              <div className="ai-empty-icon"><CircleCheck size={23} /></div>
              <div><h3>NO ACTIVE ANOMALIES</h3><p>The early-warning pipeline is monitoring regional conditions.</p><ul><li><CheckCircle2 size={15} />No elevated risk detected</li><li><CheckCircle2 size={15} />Regional telemetry available</li><li><CheckCircle2 size={15} />Automated monitoring active</li></ul></div>
            </div>
          ) : (
            <div className="ai-proposal-list">
              {alerts.map((alert) => {
                const scorePct = Math.max(0, Math.min(100, Math.round(alert.score * 100)));
                const scoreRisk = riskFromScore(alert.score);
                const recommendedRisk = riskFromSeverity(alert.recommendedSeverity);
                const SeverityIcon = riskIcon(recommendedRisk);
                return (
                  <article className={`ai-proposal-card risk-${recommendedRisk}`} key={alert._id}>
                    <div className="ai-proposal-topline">
                      <div className="ai-proposal-identifiers">
                        <span className="ai-location-badge"><MapPin size={13} />{alert.district}, {alert.state}</span>
                        <span className={`ai-hazard-badge hazard-${hazardClass(alert.hazardType)}`}>{alert.hazardType.replace(/([a-z])([A-Z])/g, '$1 $2')}</span>
                        <span className={`ai-risk-badge risk-${recommendedRisk}`}><SeverityIcon size={13} />{alert.recommendedSeverity}</span>
                      </div>
                      <div className="ai-score" aria-label={`Anomaly score ${alert.score.toFixed(2)} out of 1.00`}>
                        <div className="ai-score-label"><span>Anomaly Score</span><strong>{alert.score.toFixed(2)} <small>/ 1.00</small></strong></div>
                        <div className="ai-progress-track" role="progressbar" aria-valuenow={scorePct} aria-valuemin={0} aria-valuemax={100} aria-label="Anomaly score"><span className={`risk-${scoreRisk}`} style={{ width: `${scorePct}%` }} /></div>
                      </div>
                    </div>
                    <div className="ai-detected-line">Detected: {formatTimestamp(alert.createdAt)}</div>
                    {alert.explanation && <section className="ai-explanation"><h3><BrainCircuit size={16} />AI MODEL EXPLANATION &amp; EVIDENCE</h3><p>{alert.explanation}</p></section>}
                    {alert.anomalyFeatures?.length > 0 && <div className="ai-evidence-grid" aria-label="Anomaly evidence">{alert.anomalyFeatures.map((feature, index) => {
                      const FeatureIcon = indicatorIcon(feature.indicator);
                      const deviation = `${feature.deviationScore > 0 ? '+' : ''}${feature.deviationScore.toFixed(1)}σ`;
                      return <div className="ai-evidence-chip" key={`${feature.indicator}-${index}`}><FeatureIcon size={16} /><span className="ai-evidence-copy"><strong>{feature.indicator.replace(/_/g, ' ')}</strong><b>{feature.currentValue} {feature.unit}</b><small>{deviation} vs baseline {feature.baselineMean} {feature.unit}</small></span></div>;
                    })}</div>}
                    {alert.suggestedActions && alert.suggestedActions.length > 0 && <section className="ai-response-section"><h3>RECOMMENDED RESPONSE</h3><ul>{alert.suggestedActions.map((action, index) => <li key={`${alert._id}-action-${index}`}>{action}</li>)}</ul></section>}
                    <div className="ai-proposal-footer">
                      <span className="ai-human-notice"><ShieldCheck size={16} /><span><strong>AI-assisted assessment</strong><small>Verify evidence and affected area before issuing a public alert.</small></span></span>
                      <div className="ai-proposal-actions"><button className="btn btn-secondary btn-sm" onClick={() => handleDismiss(alert._id)} disabled={actionLoading === alert._id}><XCircle size={15} />Dismiss False Positive</button><button className="btn btn-primary btn-sm" onClick={() => handleOpenPromote(alert)} disabled={actionLoading === alert._id}><ArrowUpRight size={15} />Promote to Disaster Alert</button></div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>
      </main>

      {promoteModalOpen && selectedAlert && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setPromoteModalOpen(false); }}>
        <section className="modal ai-promote-modal" role="dialog" aria-modal="true" aria-labelledby="ai-promote-title">
          <div className="modal-header"><div><span className="ai-modal-eyebrow">OPERATOR REVIEW REQUIRED</span><h2 id="ai-promote-title">Promote to Disaster Alert?</h2></div><button className="ai-modal-close" aria-label="Close dialog" onClick={() => setPromoteModalOpen(false)}>×</button></div>
          <div className="modal-body">
            <div className="ai-confirm-notice"><Info size={17} /><p>AI has identified an elevated risk. Review the evidence and proposed event details before continuing.</p></div>
            <dl className="ai-review-details"><div><dt>Location</dt><dd>{selectedAlert.district}, {selectedAlert.state}</dd></div><div><dt>Disaster type</dt><dd>{selectedAlert.hazardType}</dd></div><div><dt>Recommended severity</dt><dd>{selectedAlert.recommendedSeverity}</dd></div><div><dt>Anomaly score</dt><dd>{selectedAlert.score.toFixed(2)} / 1.00</dd></div></dl>
            {selectedAlert.anomalyFeatures && selectedAlert.anomalyFeatures.length > 0 && <p className="ai-review-evidence">Evidence: {selectedAlert.anomalyFeatures.map((feature) => `${feature.indicator.replace(/_/g, ' ')} ${feature.currentValue} ${feature.unit}`).join(' · ')}</p>}
            <div className="form-group"><label className="form-label" htmlFor="ai-alert-title">Alert Title (English)</label><input id="ai-alert-title" type="text" className="form-input" value={customTitle} onChange={(event) => setCustomTitle(event.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="ai-alert-title-hi">Alert Title (Hindi / हिंदी)</label><input id="ai-alert-title-hi" type="text" className="form-input" value={hindiTitle} onChange={(event) => setHindiTitle(event.target.value)} /></div>
            <div className="form-group"><label className="form-label" htmlFor="ai-target-status">Target Workflow Stage</label><select id="ai-target-status" className="form-select" value={targetStatus} onChange={(event) => setTargetStatus(event.target.value as 'pending_approval' | 'published')}><option value="pending_approval">Submit for SDMA Operator Review (Pending Approval)</option><option value="published">Direct Publish &amp; Dispatch to Citizens (High Urgency)</option></select><span className="form-hint">{targetStatus === 'published' ? 'Direct publish dispatches alerts to citizens in the zone.' : 'The event will enter the SDMA approval queue for verification.'}</span></div>
          </div>
          <div className="modal-footer"><button className="btn btn-secondary" onClick={() => setPromoteModalOpen(false)}>Cancel</button><button className="btn btn-primary" onClick={handleConfirmPromote} disabled={actionLoading !== null}>{actionLoading ? 'Processing...' : 'Promote Alert'}</button></div>
        </section>
      </div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, detail, tone }: { icon: typeof Activity; label: string; value: number | string; detail: string; tone: RiskLevel | 'navy' }) {
  return <article className={`ai-summary-card tone-${tone}`}><div className="ai-summary-label"><Icon size={15} /><span>{label}</span></div><strong className="ai-summary-value">{value}</strong><span className="ai-summary-detail">{detail}</span></article>;
}

function TelemetryMetric({ icon: Icon, label, value, detail, tone = '' }: { icon: typeof CloudRain; label: string; value: string; detail?: string; tone?: string }) {
  return <div className={`ai-telemetry-metric ${tone ? `tone-${tone}` : ''}`}><span className="ai-metric-icon"><Icon size={15} /></span><span className="ai-metric-copy"><small>{label}</small><strong>{value}</strong>{detail && <em>{detail}</em>}</span></div>;
}

function riskIcon(risk: RiskLevel) {
  if (risk === 'critical') return OctagonAlert;
  if (risk === 'warning') return TriangleAlert;
  if (risk === 'watch') return Eye;
  return CircleCheck;
}

function riskLabel(risk: RiskLevel) {
  return risk.charAt(0).toUpperCase() + risk.slice(1);
}