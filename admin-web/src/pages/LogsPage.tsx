import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { RefreshCw, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { getLogs, getLogStats } from '../api/services';
import type { AlertLog, AlertStats } from '../types';

const STATUS_FILTERS = [
  { label: 'All',    value: '' },
  { label: 'Sent',   value: 'sent' },
  { label: 'Failed', value: 'failed' },
  { label: 'Pending',value: 'pending' },
];

export default function LogsPage() {
  const [logs,    setLogs]    = useState<AlertLog[]>([]);
  const [stats,   setStats]   = useState<AlertStats | null>(null);
  const [status,  setStatus]  = useState('');
  const [page,    setPage]    = useState(1);
  const [pages,   setPages]   = useState(1);
  const [total,   setTotal]   = useState(0);
  const [loading, setLoading] = useState(true);

  const load = () => {
    setLoading(true);
    Promise.all([
      getLogs({ page, limit: 25, ...(status && { status }) }),
      getLogStats(),
    ]).then(([logRes, statsRes]) => {
      setLogs(logRes.data.logs);
      setPages(logRes.data.pages);
      setTotal(logRes.data.total);
      setStats(statsRes.data.stats);
    }).finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [status, page]);

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Alert Logs ({total.toLocaleString()})</span>
        <button className="btn btn-ghost btn-icon btn-sm" onClick={load}><RefreshCw size={14} /></button>
      </div>

      <div className="page-content">
        {stats && (
          <div className="stats-grid" style={{ gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', marginBottom: 20 }}>
            {Object.entries(stats.delivery).map(([k, v]) => (
              <div className="stat-card" key={k}>
                <div className="stat-label">{k}</div>
                <div className="stat-value">{(v as number).toLocaleString()}</div>
              </div>
            ))}
            <div className="stat-card">
              <div className="stat-label">Last 24 h</div>
              <div className="stat-value">{stats.last24hAlerts.toLocaleString()}</div>
            </div>
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
            {STATUS_FILTERS.map(f => (
              <button key={f.value} className={`btn btn-sm ${status === f.value ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => { setStatus(f.value); setPage(1); }}>
                {f.label}
              </button>
            ))}
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
                  {logs.map(log => (
                    <tr key={log._id}>
                      <td style={{ maxWidth: 180 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontWeight: 500, fontSize: 12 }}>
                          {log.eventId?.title ?? '—'}
                        </div>
                        <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>{log.eventId?.type}</div>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, fontWeight: 500 }}>{log.userId?.name ?? '—'}</div>
                        <div style={{ fontSize: 11, color: 'var(--grey-400)' }}>{log.userId?.phone}</div>
                      </td>
                      <td><span className={`severity-badge ${log.severityAtSend}`}>{log.severityAtSend}</span></td>
                      <td>
                        <span className={`status-badge ${log.deliveryStatus === 'sent' ? 'active' : log.deliveryStatus === 'failed' ? 'retracted' : 'expired'}`}>
                          {log.deliveryStatus}
                        </span>
                      </td>
                      <td style={{ color: 'var(--grey-500)', fontSize: 12 }}>
                        {log.acknowledgedAt ? format(new Date(log.acknowledgedAt), 'd MMM, HH:mm') : '—'}
                      </td>
                      <td>
                        {log.isRetraction
                          ? <span className="status-badge retracted">retraction</span>
                          : <span className="status-badge active">alert</span>}
                      </td>
                      <td style={{ color: 'var(--grey-500)', fontSize: 12, whiteSpace: 'nowrap' }}>
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
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--grey-500)', padding: '0 8px' }}>{page} / {pages}</span>
              <button className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
