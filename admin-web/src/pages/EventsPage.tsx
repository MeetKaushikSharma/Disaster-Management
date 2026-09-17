import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, PlusCircle, RefreshCw, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEvents, retractEvent, triggerAlert } from '../api/services';
import type { DisasterEvent } from '../types';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Active',     value: 'active' },
  { label: 'Retracted',  value: 'retracted' },
  { label: 'Cancelled',  value: 'cancelled' },
  { label: 'All',        value: 'all' },
];

export default function EventsPage() {
  const [events,      setEvents]      = useState<DisasterEvent[]>([]);
  const [status,      setStatus]      = useState('active');
  const [page,        setPage]        = useState(1);
  const [pages,       setPages]       = useState(1);
  const [total,       setTotal]       = useState(0);
  const [loading,     setLoading]     = useState(true);
  const [actionId,    setActionId]    = useState<string | null>(null);
  const [toastMsg,    setToastMsg]    = useState('');

  // Retract modal
  const [retractModal, setRetractModal] = useState<DisasterEvent | null>(null);
  const [correction,   setCorrection]   = useState('');
  const [retractMode,  setRetractMode]  = useState<'retract' | 'cancel'>('retract');

  const loadEvents = () => {
    setLoading(true);
    getEvents({ status, page, limit: 15 })
      .then(r => {
        setEvents(r.data.events);
        setPages(r.data.pages);
        setTotal(r.data.total);
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => { loadEvents(); }, [status, page]);

  const toast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(''), 3000);
  };

  const handleTrigger = async (id: string) => {
    setActionId(id);
    try {
      const { data } = await triggerAlert(id);
      toast(`✓ Alert sent to ${data.alertsSent} users (${data.duplicatesSkipped} deduped)`);
      loadEvents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Trigger failed');
    } finally {
      setActionId(null);
    }
  };

  const handleRetract = async () => {
    if (!retractModal) return;
    setActionId(retractModal._id);
    try {
      await retractEvent(retractModal._id, correction || 'This alert has been retracted.', retractMode);
      toast(`✓ Event ${retractMode}ed`);
      setRetractModal(null);
      setCorrection('');
      loadEvents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Action failed');
    } finally {
      setActionId(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Disaster Events ({total})</span>
        <Link to="/events/new" className="btn btn-primary btn-sm">
          <PlusCircle size={14} /> New Event
        </Link>
      </div>

      <div className="page-content">
        {/* Status filter tabs */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 16 }}>
          {STATUS_TABS.map(t => (
            <button key={t.value} className={`btn btn-sm ${status === t.value ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => { setStatus(t.value); setPage(1); }}>
              {t.label}
            </button>
          ))}
          <button className="btn btn-ghost btn-sm btn-icon" onClick={loadEvents} title="Refresh">
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading events…</div>
          ) : events.length === 0 ? (
            <div className="empty-state">
              <AlertTriangle />
              <p>No {status === 'all' ? '' : status} events found</p>
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
                    <th>Status</th>
                    <th>Alerts</th>
                    <th>Created</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {events.map((ev) => (
                    <tr key={ev._id}>
                      <td style={{ fontWeight: 500, maxWidth: 200 }}>
                        <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {ev.title}
                        </div>
                        {ev.correctionMessage && (
                          <div style={{ fontSize: 11, color: 'var(--grey-400)', marginTop: 2 }}>
                            ↩ {ev.correctionMessage}
                          </div>
                        )}
                      </td>
                      <td style={{ color: 'var(--grey-600)' }}>{ev.type}</td>
                      <td><span className={`severity-badge ${ev.severity}`}>{ev.severity}</span></td>
                      <td style={{ color: 'var(--grey-500)', fontSize: 12 }}>
                        {ev.zoneType === 'radius' ? `${ev.radiusKm} km ⊙` : 'polygon'}
                      </td>
                      <td><span className={`status-badge ${ev.status}`}>{ev.status}</span></td>
                      <td style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {ev.alertsSentCount.toLocaleString()}
                      </td>
                      <td style={{ color: 'var(--grey-500)', fontSize: 12, whiteSpace: 'nowrap' }}>
                        {format(new Date(ev.createdAt), 'd MMM yy, HH:mm')}
                      </td>
                      <td>
                        <div className="action-row">
                          {ev.status === 'active' && (
                            <>
                              <button
                                id={`btn-trigger-${ev._id}`}
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleTrigger(ev._id)}
                                disabled={actionId === ev._id}
                                title="Re-trigger alert"
                              >
                                {actionId === ev._id ? <span className="spinner" style={{ width: 12, height: 12 }} /> : <Zap size={12} />}
                              </button>
                              <button
                                id={`btn-retract-${ev._id}`}
                                className="btn btn-sm btn-danger"
                                onClick={() => { setRetractModal(ev); setRetractMode('retract'); }}
                                disabled={actionId === ev._id}
                              >
                                Retract
                              </button>
                              <button
                                id={`btn-cancel-${ev._id}`}
                                className="btn btn-sm btn-ghost"
                                onClick={() => { setRetractModal(ev); setRetractMode('cancel'); }}
                                disabled={actionId === ev._id}
                              >
                                Cancel
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Pagination */}
          {pages > 1 && (
            <div className="pagination">
              <button className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>
                <ChevronLeft size={14} />
              </button>
              <span style={{ fontSize: 13, color: 'var(--grey-500)', padding: '0 8px' }}>
                {page} / {pages}
              </span>
              <button className="btn btn-secondary btn-sm btn-icon"
                onClick={() => setPage(p => Math.min(pages, p + 1))} disabled={page === pages}>
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Retract modal ─────────────────────────────────────────────────── */}
      {retractModal && (
        <div className="modal-overlay">
          <div className="modal">
            <div className="modal-header">
              <h2>{retractMode === 'retract' ? 'Retract' : 'Cancel'} Event</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => setRetractModal(null)}>✕</button>
            </div>
            <div className="modal-body">
              <div className="alert alert-info" style={{ marginBottom: 16 }}>
                <strong>{retractModal.title}</strong>
                <div style={{ fontSize: 12, marginTop: 4 }}>
                  A correction push notification will be sent to all previously alerted users.
                </div>
              </div>
              <div className="form-group">
                <label className="form-label" htmlFor="correction-msg">Correction Message</label>
                <textarea
                  id="correction-msg"
                  className="form-control"
                  rows={3}
                  value={correction}
                  onChange={e => setCorrection(e.target.value)}
                  placeholder="e.g., Waters are receding — the flood alert has been lifted."
                  maxLength={500}
                />
                <div className="form-hint">This message will be sent in the retraction push notification</div>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={() => setRetractModal(null)}>Cancel</button>
              <button
                id="btn-confirm-retract"
                className="btn btn-danger"
                onClick={handleRetract}
                disabled={actionId === retractModal._id}
              >
                {actionId === retractModal._id
                  ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Sending…</>
                  : `Confirm ${retractMode}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Toast ─────────────────────────────────────────────────────────── */}
      {toastMsg && (
        <div style={{
          position: 'fixed', bottom: 24, right: 24,
          background: 'var(--black)', color: 'var(--white)',
          padding: '12px 18px', borderRadius: 4,
          fontSize: 13, zIndex: 2000, maxWidth: 320,
        }}>
          {toastMsg}
        </div>
      )}
    </>
  );
}
