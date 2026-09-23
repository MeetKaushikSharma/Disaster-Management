import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, CircleDashed, FileText, PlusCircle, ShieldCheck } from 'lucide-react';
import { getEvents, getLogs, getLogStats } from '../api/services';
import type { DisasterEvent, AlertStats } from '../types';
import { format } from 'date-fns';

const severityOrder = ['Low', 'Medium', 'High', 'Critical'] as const;

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
    ])
      .then(([evRes, statsRes, logRes]) => {
        setEvents(evRes.data.events);
        setStats(statsRes.data.stats);
        setLogTotal(logRes.data.total);
      })
      .finally(() => setLoading(false));
  }, []);

  const sentCount = stats?.delivery.sent ?? 0;
  const failCount = stats?.delivery.failed ?? 0;
  const pendingCount = stats?.delivery.pending ?? 0;
  const last24h = stats?.last24hAlerts ?? 0;
  const critCount = stats?.bySeverity.find((s) => s._id === 'Critical')?.count ?? 0;

  const severityRows = useMemo(() => {
    const rows = severityOrder.map((severity) => {
      const match = stats?.bySeverity.find((item) => item._id === severity);
      return {
        severity,
        value: match?.count ?? 0,
      };
    });

    const max = Math.max(...rows.map((row) => row.value), 1);
    return rows.map((row) => ({
      ...row,
      width: row.value === 0 ? 0 : (row.value / max) * 100,
    }));
  }, [stats]);

  const summaryCards = [
    {
      label: 'Active Events',
      value: loading ? '—' : String(events.length),
      context: 'currently live',
      accent: 'active',
      icon: <AlertTriangle size={14} />,
    },
    {
      label: 'Alerts Sent',
      value: loading ? '—' : sentCount.toLocaleString(),
      context: `${failCount} failed deliveries`,
      accent: 'alerts',
      icon: <ShieldCheck size={14} />,
    },
    {
      label: 'Last 24 h Pushes',
      value: loading ? '—' : last24h.toLocaleString(),
      context: 'push notifications',
      accent: 'pushes',
      icon: <CircleDashed size={14} />,
    },
    {
      label: 'Total Alert Logs',
      value: loading ? '—' : logTotal.toLocaleString(),
      context: `${critCount} critical severity`,
      accent: 'logs',
      icon: <FileText size={14} />,
    },
  ];

  return (
    <div className="dashboard-page">
      <div className="topbar">
        <div className="topbar-title-wrap">
          <span className="topbar-title">Dashboard</span>
          <span className="topbar-subtitle">Disaster response command overview</span>
        </div>
        <Link to="/events/new" className="btn btn-primary btn-sm dashboard-new-event">
          <PlusCircle size={14} /> New Event
        </Link>
      </div>

      <div className="page-content dashboard-content">
        <div className="stats-grid">
          {summaryCards.map((card) => (
            <div
              key={card.label}
              className={`stat-card kpi-card kpi-card--${card.accent}`}
            >
              <div className="stat-card-header">
                <span className={`stat-indicator kpi-icon kpi-icon--${card.accent}`}>{card.icon}</span>
                <span className="stat-label">{card.label}</span>
              </div>
              <div className="stat-value">{card.value}</div>
              <div className="stat-sub">{card.context}</div>
            </div>
          ))}
        </div>

        <div className="dashboard-grid">
          <section className="card dashboard-main-card">
            <div className="card-header">
              <div>
                <h2>Current Disaster Situation</h2>
                <p>Active Disaster Events</p>
              </div>
              <Link to="/events" className="btn btn-secondary btn-sm">View all</Link>
            </div>

            {loading ? (
              <div className="loading-center">
                <span className="spinner" />
                <span>Loading…</span>
              </div>
            ) : events.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ShieldCheck size={18} />
                </div>
                <h3>No active disaster events</h3>
                <p>The command center is currently clear.</p>
                <Link to="/events" className="btn btn-secondary btn-sm">View Disaster Events</Link>
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
                      <th>Updated</th>
                    </tr>
                  </thead>
                  <tbody>
                    {events.map((event) => (
                      <tr key={event._id}>
                        <td className="event-title-cell">{event.title}</td>
                        <td className="muted-cell">{event.type}</td>
                        <td>
                          <span className={`severity-badge ${event.severity}`}>{event.severity}</span>
                        </td>
                        <td className="muted-cell">{event.zoneType}</td>
                        <td>{event.alertsSentCount.toLocaleString()}</td>
                        <td className="muted-cell">
                          {format(new Date(event.updatedAt || event.createdAt), 'd MMM yyyy, HH:mm')}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          <aside className="dashboard-side-stack">
            {stats && (
              <section className="card dashboard-side-card">
                <div className="card-header compact-header">
                  <h2>Alert Activity</h2>
                </div>

                <div className="activity-list">
                  <div className="activity-row">
                    <span>Sent</span>
                    <strong>{sentCount.toLocaleString()}</strong>
                  </div>
                  <div className="activity-row">
                    <span>Failed</span>
                    <strong>{failCount.toLocaleString()}</strong>
                  </div>
                  <div className="activity-row">
                    <span>Pending</span>
                    <strong>{pendingCount.toLocaleString()}</strong>
                  </div>
                </div>
              </section>
            )}

            {stats && stats.bySeverity.length > 0 && (
              <section className="card dashboard-side-card">
                <div className="card-header compact-header">
                  <h2>Severity Overview</h2>
                </div>

                <div className="severity-list">
                  {severityRows.map(({ severity, value, width }) => (
                    <div key={severity} className="severity-row">
                      <div className="severity-row-header">
                        <span className={`severity-badge ${severity}`}>{severity}</span>
                        <strong>{value}</strong>
                      </div>
                      <div className="severity-bar">
                        <span
                          className={`severity-bar-fill severity-bar-fill--${severity}`}
                          style={{ width: `${width}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </aside>
        </div>
      </div>
    </div>
  );
}
