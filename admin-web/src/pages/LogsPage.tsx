import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, FileText, ChevronLeft, ChevronRight, Clock3, CheckCircle2, XCircle, Activity, Check } from 'lucide-react';
import { getLogs, getLogStats } from '../api/services';
import type { AlertLog, AlertStats } from '../types';

const STATUS_FILTERS = [
  { label: 'All', value: '' },
  { label: 'Sent', value: 'sent' },
  { label: 'Failed', value: 'failed' },
  { label: 'Pending', value: 'pending' },
];

export default function LogsPage() {
  const [logs, setLogs] = useState<AlertLog[]>([]);
  const [stats, setStats] = useState<AlertStats | null>(null);
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [pages, setPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      getLogs({ page, limit: 25, ...(status && { status }) }),
      getLogStats(),
    ])
      .then(([logRes, statsRes]) => {
        setLogs(logRes.data.logs);
        setPages(logRes.data.pages);
        setTotal(logRes.data.total);
        setStats(statsRes.data.stats);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, page]);

  const summaryCards = stats ? [
    {
      key: 'pending',
      label: 'Pending',
      value: stats.delivery.pending,
      helper: 'waiting for delivery',
      accent: 'pending',
      icon: Clock3,
    },
    {
      key: 'sent',
      label: 'Sent',
      value: stats.delivery.sent,
      helper: 'successfully delivered',
      accent: 'sent',
      icon: CheckCircle2,
    },
    {
      key: 'failed',
      label: 'Failed',
      value: stats.delivery.failed,
      helper: 'delivery failures',
      accent: 'failed',
      icon: XCircle,
    },
    {
      key: 'recent',
      label: 'Last 24 h',
      value: stats.last24hAlerts,
      helper: 'notification activity',
      accent: 'recent',
      icon: Activity,
    },
  ] : [];

  return (
    <>
      <div className="topbar">
        <div className="topbar-title-wrap">
          <span className="topbar-title">
            Alert Logs <span className="topbar-count">({total.toLocaleString()})</span>
          </span>
          <span className="topbar-subtitle">Delivery and notification audit trail</span>
        </div>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={load} aria-label="Refresh alert logs">
          <RefreshCw size={14} />
        </button>
      </div>

      <div className="page-content">
        {stats && (
          <div className="stats-grid logs-kpis">
            {summaryCards.map(({ key, label, value, helper, accent, icon: Icon }) => (
              <div key={key} className={`stat-card log-kpi log-kpi--${accent}`}>
                <div className="stat-card-header">
                  <span className={`stat-indicator log-kpi__icon log-kpi__icon--${accent}`}>
                    <Icon size={14} />
                  </span>
                  <span className="stat-label">{label}</span>
                </div>
                <div className="stat-value">{value.toLocaleString()}</div>
                <div className="stat-sub">{helper}</div>
              </div>
            ))}
          </div>
        )}

        <div className="card logs-filter-card">
          <div className="toolbar-header compact">
            <div>
              <div className="section-kicker">Delivery Status</div>
              <h2 className="section-title">Alert Logs</h2>
            </div>
            <button className="btn btn-secondary btn-sm" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>

          <div className="toolbar-actions wrap">
            {STATUS_FILTERS.map((filter) => {
              const isActive = status === filter.value;
              return (
                <button
                  key={filter.value || 'all'}
                  className={`filter-pill filter-pill--${filter.value || 'all'} ${isActive ? 'is-active' : ''}`}
                  onClick={() => { setStatus(filter.value); setPage(1); }}
                >
                  {filter.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="card logs-table-card">
          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading logs…</div>
          ) : logs.length === 0 ? (
            <div className="empty-state">
              <FileText />
              <p>No alert logs found</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
                    <th>User</th>
                    <th>Severity</th>
                    <th>Delivery</th>
                    <th>Acknowledged</th>
                    <th>Type</th>
                    <th>Sent At</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log._id}>
                      <td className="event-cell">
                        <div className="event-cell__title">{log.eventId?.title ?? '—'}</div>
                        <div className="event-cell__meta">{log.eventId?.type ?? '—'}</div>
                      </td>
                      <td>
                        <div className="user-cell__name">{log.userId?.name ?? '—'}</div>
                        <div className="user-cell__meta">{log.userId?.phone ?? '—'}</div>
                      </td>
                      <td>
                        <span className={`severity-badge severity-badge--${String(log.severityAtSend).toLowerCase()}`}>
                          {log.severityAtSend}
                        </span>
                      </td>
                      <td>
                        <span className={`status-badge status-badge--${log.deliveryStatus}`}>
                          {log.deliveryStatus}
                        </span>
                      </td>
                      <td>
                        {log.acknowledgedAt ? (
                          <span className="ack-badge ack-badge--acknowledged">
                            <Check size={12} /> Acknowledged
                          </span>
                        ) : (
                          <span className="ack-badge ack-badge--muted">Not acknowledged</span>
                        )}
                      </td>
                      <td>
                        {log.isRetraction ? (
                          <span className="type-badge type-badge--retraction">retraction</span>
                        ) : (
                          <span className="type-badge type-badge--alert">alert</span>
                        )}
                      </td>
                      <td className="sent-at-cell">
                        {format(new Date(log.sentAt), 'd MMM yy, HH:mm')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <span className="pagination-meta">{page} / {pages}</span>
              <button className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setPage((p) => Math.min(pages, p + 1))} disabled={page === pages}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
