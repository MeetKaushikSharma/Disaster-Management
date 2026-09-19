import { useState, useEffect } from 'react';
import {
  ShieldCheck, AlertCircle, PhoneCall,
  CheckCircle2, MapPin, RefreshCw, Radio
} from 'lucide-react';
import { getSituationalAwareness, acknowledgeCheckIn } from '../api/services';
import type { CitizenCheckIn, SituationalAwarenessSummary } from '../types';

export default function SituationalAwarenessPage() {
  const [summary, setSummary] = useState<SituationalAwarenessSummary>({
    safe: 0,
    need_help: 0,
    family_safe: 0,
    totalReports: 0,
  });
  const [distressedList, setDistressedList] = useState<CitizenCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState<string>('');
  const [successMsg, setSuccessMsg] = useState('');

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await getSituationalAwareness(selectedDistrict ? { district: selectedDistrict } : undefined);
      setSummary(res.data.summary);
      setDistressedList(res.data.distressedList);
    } catch (err) {
      console.error('Failed to fetch situational awareness:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [selectedDistrict]);

  const handleAcknowledge = async (id: string) => {
    setAckLoading(id);
    try {
      await acknowledgeCheckIn(id);
      setSuccessMsg('Responder team dispatch logged for citizen.');
      fetchData();
    } catch (err) {
      console.error('Failed to acknowledge check-in:', err);
    } finally {
      setAckLoading(null);
    }
  };

  return (
    <>
      <div className="topbar">
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Radio size={20} color="var(--red-600)" />
          <span className="topbar-title">Citizen Situational Awareness & Response</span>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <select
            className="form-select"
            style={{ width: 180, fontSize: 12, padding: '4px 8px' }}
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          >
            <option value="">All Districts</option>
            <option value="Varanasi">Varanasi</option>
            <option value="Gorakhpur">Gorakhpur</option>
            <option value="Prayagraj">Prayagraj</option>
            <option value="Lucknow">Lucknow</option>
            <option value="Ayodhya">Ayodhya</option>
          </select>
          <button
            className="btn btn-secondary btn-sm"
            onClick={fetchData}
            disabled={loading}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            Refresh
          </button>
        </div>
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

        {/* ── Status Metric Cards ───────────────────────────────────────────── */}
        <div className="stats-grid" style={{ marginBottom: 24 }}>
          <div className="stat-card" style={{ borderLeft: '4px solid var(--emerald-500)' }}>
            <div className="stat-label">Confirmed Safe</div>
            <div className="stat-value" style={{ color: 'var(--emerald-600)' }}>
              {loading ? '—' : summary.safe.toLocaleString()}
            </div>
            <div className="stat-sub">citizens marked "I am Safe"</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--red-500)' }}>
            <div className="stat-label">Urgent SOS / Help Needed</div>
            <div className="stat-value" style={{ color: 'var(--red-600)' }}>
              {loading ? '—' : summary.need_help.toLocaleString()}
            </div>
            <div className="stat-sub">distressed citizens awaiting aid</div>
          </div>

          <div className="stat-card" style={{ borderLeft: '4px solid var(--blue-500)' }}>
            <div className="stat-label">Family Confirmed Safe</div>
            <div className="stat-value" style={{ color: 'var(--blue-600)' }}>
              {loading ? '—' : summary.family_safe.toLocaleString()}
            </div>
            <div className="stat-sub">multi-person family units</div>
          </div>

          <div className="stat-card">
            <div className="stat-label">Total Citizen Reports</div>
            <div className="stat-value">
              {loading ? '—' : summary.totalReports.toLocaleString()}
            </div>
            <div className="stat-sub">real-time feedback rate</div>
          </div>
        </div>

        {/* ── Distressed Citizen Response Queue ─────────────────────────────── */}
        <div className="card">
          <div className="card-header">
            <div>
              <h2 style={{ display: 'flex', alignItems: 'center', gap: 8, margin: 0 }}>
                <AlertCircle size={18} color="var(--red-600)" />
                Urgent Distress Queue — "Need Help" Reports ({distressedList.length})
              </h2>
              <p style={{ margin: '4px 0 0 0', fontSize: 12, color: 'var(--grey-500)' }}>
                Citizens requesting evacuation, medical supplies, or boat assistance during active alerts
              </p>
            </div>
          </div>

          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading response queue...</div>
          ) : distressedList.length === 0 ? (
            <div className="empty-state" style={{ padding: 40 }}>
              <ShieldCheck size={36} color="var(--emerald-600)" />
              <p style={{ marginTop: 12, fontWeight: 600 }}>No active distress calls in this district.</p>
              <span style={{ fontSize: 12, color: 'var(--grey-500)' }}>
                All reporting citizens are accounted for or confirmed safe.
              </span>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Citizen Details</th>
                    <th>District / Coordinates</th>
                    <th>Reported Message</th>
                    <th>People</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {distressedList.map((c) => (
                    <tr key={c._id} style={{ background: c.isAcknowledgedByResponders ? 'transparent' : '#fff5f5' }}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.citizenName}</div>
                        {c.phone && (
                          <div style={{ fontSize: 11, color: 'var(--grey-600)', display: 'flex', alignItems: 'center', gap: 4 }}>
                            <PhoneCall size={11} /> {c.phone}
                          </div>
                        )}
                        <div style={{ fontSize: 10, color: 'var(--grey-400)' }}>
                          {new Date(c.createdAt).toLocaleTimeString()}
                        </div>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600 }}>{c.district}, {c.state}</div>
                        <div style={{ fontSize: 11, color: 'var(--grey-500)', display: 'flex', alignItems: 'center', gap: 2 }}>
                          <MapPin size={11} /> {c.location.coordinates[1].toFixed(4)}°N, {c.location.coordinates[0].toFixed(4)}°E
                        </div>
                      </td>
                      <td style={{ maxWidth: 320, fontSize: 12 }}>
                        {c.message || 'No additional comment provided.'}
                      </td>
                      <td>
                        <span style={{ fontWeight: 700 }}>{c.peopleCount}</span>
                      </td>
                      <td>
                        {c.isAcknowledgedByResponders ? (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--emerald-700)',
                            background: '#ecfdf5',
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}>
                            Responders Dispatched
                          </span>
                        ) : (
                          <span style={{
                            fontSize: 11,
                            fontWeight: 700,
                            color: 'var(--red-700)',
                            background: '#fef2f2',
                            padding: '3px 8px',
                            borderRadius: 4,
                          }}>
                            Pending Response
                          </span>
                        )}
                      </td>
                      <td>
                        {!c.isAcknowledgedByResponders && (
                          <button
                            className="btn btn-primary btn-sm"
                            onClick={() => handleAcknowledge(c._id)}
                            disabled={ackLoading === c._id}
                            style={{ fontSize: 11, padding: '4px 10px' }}
                          >
                            {ackLoading === c._id ? 'Dispatching…' : 'Mark Dispatched'}
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
