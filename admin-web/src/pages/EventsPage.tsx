import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { AlertTriangle, PlusCircle, RefreshCw, Zap, ChevronLeft, ChevronRight } from 'lucide-react';
import { getEvents, retractEvent, triggerAlert, approveEvent, rejectEvent } from '../api/services';
import type { DisasterEvent } from '../types';

const STATUS_TABS: { label: string; value: string }[] = [
  { label: 'Published / Live',  value: 'active' },
  { label: 'Pending SDMA Approval', value: 'pending_approval' },
  { label: 'Drafts',            value: 'draft' },
  { label: 'Retracted',         value: 'retracted' },
  { label: 'All',               value: 'all' },
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
    setTimeout(() => setToastMsg(''), 3500);
  };

  const handleApprove = async (id: string) => {
    setActionId(id);
    try {
      await approveEvent(id, 'Approved by SDMA Operator');
      toast('✓ Event approved & published! Push alerts dispatched to citizens.');
      loadEvents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Approval failed');
    } finally {
      setActionId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = window.prompt('Enter rejection feedback for researcher:');
    if (!reason) return;
    setActionId(id);
    try {
      await rejectEvent(id, reason);
      toast('Event returned to draft status.');
      loadEvents();
    } catch (err: any) {
      toast(err.response?.data?.message || 'Rejection failed');
    } finally {
      setActionId(null);
    }
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

  const activeCount = events.filter((ev) => ev.status === 'active').length;
  const retractedCount = events.filter((ev) => ev.status === 'retracted').length;
  const totalAlertsSent = events.reduce((sum, ev) => sum + (ev.alertsSentCount || 0), 0);

  const summaryCards = [
    { label: 'Active Events', value: (status === 'active' ? total : activeCount).toLocaleString(), helper: 'live incidents', variant: 'active' },
    { label: 'Alerts Sent', value: totalAlertsSent.toLocaleString(), helper: 'dispatches', variant: 'sent' },
    { label: 'Retracted', value: (status === 'retracted' ? total : retractedCount).toLocaleString(), helper: 'corrected alerts', variant: 'retracted' },
  ];

  return (
    <>
      <div className="topbar">
        <div className="events-header-meta">
          <div className="events-title-row">
            <span className="topbar-title">Disaster Events</span>
            <span className="events-count-pill">{total} active</span>
          </div>
          <span className="events-subtitle">Monitor and manage active disaster alerts</span>
        </div>
        <Link to="/events/new" className="btn btn-primary btn-sm">
          <PlusCircle size={14} /> New Event
        </Link>
      </div>

      <div className="page-content events-page-shell">
        <div className="events-toolbar">
          {STATUS_TABS.map(t => (
            <button
              key={t.value}
              className={`events-filter-btn ${status === t.value ? 'active' : ''}`}
              data-status={t.value}
              onClick={() => { setStatus(t.value); setPage(1); }}
              type="button"
            >
              {t.label}
            </button>
          ))}
          <button
            className="btn btn-ghost btn-sm btn-icon events-refresh-btn"
            onClick={loadEvents}
            type="button"
            aria-label="Refresh events"
            title="Refresh events"
          >
            <RefreshCw size={14} />
          </button>
        </div>

        <div className="events-summary-strip" aria-label="Event summary">
          {summaryCards.map((card) => (
            <div key={card.label} className={`events-summary-card events-summary-card--${card.variant}`}>
              <span className="events-summary-label">{card.label}</span>
              <strong className="events-summary-value">{card.value}</strong>
              <span className="events-summary-helper">{card.helper}</span>
            </div>
          ))}
        </div>

        <div className="card events-card">
          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading events…</div>
          ) : events.length === 0 ? (
            <div className="events-empty-state">
              <div className="events-empty-icon">
                <AlertTriangle size={18} />
              </div>
              <h3>No active disaster events</h3>
              <p>The response command center is currently clear.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Event</th>
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
                      <td className="events-title-cell">
                        <div className="events-primary-title">{ev.title}</div>
                        {ev.type && <div className="events-secondary-type">{ev.type}</div>}
                        {ev.correctionMessage && (
                          <div className="events-correction-note">
                            ↩ {ev.correctionMessage}
                          </div>
                        )}
                      </td>
                      <td className="events-type-cell">{ev.type}</td>
                      <td><span className={`severity-badge ${ev.severity}`}>{ev.severity}</span></td>
                      <td className="events-zone-cell">
                        {ev.zoneType === 'radius' ? `${ev.radiusKm} km radius` : ev.zoneType === 'polygon' ? 'Polygon zone' : 'Zone'}
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
                          {ev.status === 'pending_approval' && (
                            <>
                              <button
                                className="btn btn-sm btn-primary"
                                onClick={() => handleApprove(ev._id)}
                                disabled={actionId === ev._id}
                                style={{ fontSize: 11, padding: '4px 8px' }}
                              >
                                {actionId === ev._id ? 'Approving…' : 'Approve & Dispatch'}
                              </button>
                              <button
                                className="btn btn-sm btn-secondary"
                                onClick={() => handleReject(ev._id)}
                                disabled={actionId === ev._id}
                                style={{ fontSize: 11, padding: '4px 8px' }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                          {(ev.status === 'active' || ev.status === 'published') && (
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
