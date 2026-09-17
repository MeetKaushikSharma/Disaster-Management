import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, PlusCircle } from 'lucide-react';
import { getEvents, getLogs, getLogStats } from '../api/services';
import type { DisasterEvent, AlertStats } from '../types';
import { format } from 'date-fns';

export default function DashboardPage() {
  const [events, setEvents] = useState<DisasterEvent[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [logTotal, setLogTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      getEvents({ status: 'active', limit: 5 }),
      getLogStats(),
      getLogs({ limit: 1 }),
    ]).then(([evRes, statsRes, logRes]) => {
      setEvents(evRes.data.events);
      setStats(statsRes.data.stats);
      setLogTotal(logRes.data.total);
    }).finally(() => setLoading(false));
  }, []);

  const sentCount  = stats?.delivery.sent  ?? 0;
  const failCount  = stats?.delivery.failed ?? 0;
  const last24h    = stats?.last24hAlerts   ?? 0;
  const critCount  = stats?.bySeverity.find(s => s._id === 'Critical')?.count ?? 0;

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Dashboard</span>
        <Link to="/events/new" className="btn btn-primary btn-sm">
          <PlusCircle size={14} /> New Event
        </Link>
      </div>

      <div className="page-content">
        {/* ── Stat cards ────────────────────────────────────────────────── */}
        <div className="stats-grid">
          <div className="stat-card">
            <div className="stat-label">Active Events</div>
            <div className="stat-value">{loading ? '—' : events.length}</div>
            <div className="stat-sub">currently live</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Alerts Sent</div>
            <div className="stat-value">{loading ? '—' : sentCount.toLocaleString()}</div>
            <div className="stat-sub">{failCount} failed deliveries</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Last 24 h Pushes</div>
            <div className="stat-value">{loading ? '—' : last24h.toLocaleString()}</div>
            <div className="stat-sub">push notifications</div>
          </div>
          <div className="stat-card">
            <div className="stat-label">Total Alert Logs</div>
            <div className="stat-value">{loading ? '—' : logTotal.toLocaleString()}</div>
            <div className="stat-sub">{critCount} critical severity</div>
          </div>
        </div>

        {/* ── Active Events table ────────────────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <h2>Active Disaster Events</h2>
            <Link to="/events" className="btn btn-secondary btn-sm">View all</Link>
          </div>

          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading…</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle />
              <p>No active events</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Type</th>
                    <th>Severity</th>
                    <th>Zone</th>
                    <th>Alerts Sent</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev._id}>
                      <td style={{ fontWeight: 500 }}>{ev.title}</td>
                      <td style={{ color: 'var(--grey-600)' }}>{ev.type}</td>
                      <td><span className={`severity-badge ${ev.severity}`}>{ev.severity}</span></td>
                      <td style={{ color: 'var(--grey-500)' }}>{ev.zoneType}</td>
                      <td>{ev.alertsSentCount.toLocaleString()}</td>
                      <td style={{ color: 'var(--grey-500)' }}>
                        {format(new Date(ev.createdAt), 'd MMM yyyy, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* ── Severity breakdown ─────────────────────────────────────────── */}
        {stats && stats.bySeverity.length > 0 && (
          <div className="card" style={{ marginTop: 16 }}>
            <div className="card-header">
              <h2>Alerts by Severity</h2>
            </div>
            <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap', padding: '4px 0' }}>
              {(['Low', 'Medium', 'High', 'Critical'] as const).map((sev) => {
                const row = stats.bySeverity.find(s => s._id === sev);
                const ackPct = row && row.count > 0 ? Math.round((row.acknowledged / row.count) * 100) : 0;
                return (
                  <div key={sev} style={{ minWidth: 140 }}>
                    <span className={`severity-badge ${sev}`} style={{ marginBottom: 8, display: 'inline-block' }}>{sev}</span>
                    <div style={{ fontSize: 22, fontWeight: 700 }}>{row?.count ?? 0}</div>
                    <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>
                      {ackPct}% acknowledged
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </>
  );
}
