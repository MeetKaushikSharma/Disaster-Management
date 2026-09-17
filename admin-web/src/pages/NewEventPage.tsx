import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MapPin, CheckCircle } from 'lucide-react';
import { createEvent, triggerAlert, getGuides } from '../api/services';
import ZoneMap, { type ZoneData } from '../components/ZoneMap';
import type { DisasterType, Severity, ZoneType, SafetyGuide } from '../types';

const DISASTER_TYPES: DisasterType[] = [
  'Flood','Earthquake','Cyclone','Landslide','Fire',
  'Tsunami','Drought','Heatwave','ChemicalSpill','Other',
];

const SEVERITY_LEVELS: Severity[] = ['Low','Medium','High','Critical'];

export default function NewEventPage() {
  const navigate = useNavigate();

  // Form state
  const [title,          setTitle]          = useState('');
  const [type,           setType]           = useState<DisasterType>('Flood');
  const [severity,       setSeverity]       = useState<Severity>('Medium');
  const [description,    setDescription]    = useState('');
  const [safetyGuideId,  setSafetyGuideId]  = useState('');
  const [zoneType,       setZoneType]       = useState<ZoneType>('polygon');
  const [bufferRadiusKm, setBufferRadiusKm] = useState(5);
  const [expiresAt,      setExpiresAt]      = useState('');
  const [zoneData,       setZoneData]       = useState<ZoneData | null>(null);

  const [guides,   setGuides]   = useState<SafetyGuide[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [dispatchInfo, setDispatchInfo] = useState<{ eventId: string; usersTargeted: number; alertsSent: number } | null>(null);

  useEffect(() => {
    getGuides().then(r => setGuides(r.data.guides)).catch(() => {});
  }, []);

  // Auto-filter guides by selected disaster type
  const filteredGuides = guides.filter(g => g.disasterType === type && g.isPublished);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setDispatchInfo(null);

    if (!zoneData) {
      setError('Please draw a disaster zone on the map before submitting.');
      return;
    }

    // Validate polygon has enough vertices
    if (zoneType === 'polygon' && (!zoneData.polygon || zoneData.polygon.coordinates[0].length < 4)) {
      setError('Polygon must have at least 3 vertices. Double-click the last point to close it.');
      return;
    }

    // Validate radius has coordinates
    if (zoneType === 'radius' && (!zoneData.centre || !zoneData.radiusKm)) {
      setError('Please draw a circle on the map by clicking a centre point and dragging outward.');
      return;
    }

    setLoading(true);
    try {
      const payload = {
        title,
        type,
        severity,
        description,
        safetyGuideId: safetyGuideId || undefined,
        zoneType,
        bufferRadiusKm,
        expiresAt: expiresAt || undefined,
        ...(zoneType === 'polygon' && { polygon: zoneData.polygon }),
        ...(zoneType === 'radius'  && { centre: zoneData.centre, radiusKm: zoneData.radiusKm }),
      };

      // Step 1: Create the event
      const { data: eventData } = await createEvent(payload as any);
      const eventId = eventData.event._id;

      // Step 2: Immediately trigger alert dispatch (FCM push to all users in zone)
      try {
        const { data: triggerData } = await triggerAlert(eventId);
        setDispatchInfo({
          eventId,
          usersTargeted: triggerData.usersTargeted,
          alertsSent: triggerData.alertsSent,
        });
        // Redirect after showing success for 3 seconds
        setTimeout(() => navigate('/events'), 3000);
      } catch {
        // Even if trigger fails (e.g. no FCM setup yet), event is created — redirect
        navigate('/events');
      }
    } catch (err: any) {
      const msgs = err.response?.data?.errors?.map((e: any) => e.message).join(', ');
      setError(msgs || err.response?.data?.message || 'Failed to create event');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">New Disaster Event</span>
      </div>

      {dispatchInfo && (
        <div className="alert alert-success" style={{ margin: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <CheckCircle size={16} />
          <strong>Event created &amp; alerts dispatched!</strong>&nbsp;
          Targeted {dispatchInfo.usersTargeted} users · Sent {dispatchInfo.alertsSent} FCM pushes.
          Redirecting to events…
        </div>
      )}

      <div className="page-content">
        <form onSubmit={handleSubmit}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Left: Form fields ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="card">
                <h3 style={{ marginBottom: 16 }}>Event Details</h3>

                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-title">Event Title *</label>
                  <input id="ev-title" className="form-control" required value={title}
                    onChange={e => setTitle(e.target.value)} placeholder="e.g., Yamuna Flood Zone — Sector 14" maxLength={120} />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-type">Disaster Type *</label>
                    <select id="ev-type" className="form-control" value={type}
                      onChange={e => setType(e.target.value as DisasterType)}>
                      {DISASTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-severity">Severity *</label>
                    <select id="ev-severity" className="form-control" value={severity}
                      onChange={e => setSeverity(e.target.value as Severity)}>
                      {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="form-hint">Determines buzzer intensity on user devices</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-desc">Description</label>
                  <textarea id="ev-desc" className="form-control" rows={3} value={description}
                    onChange={e => setDescription(e.target.value)} maxLength={2000}
                    placeholder="Describe the situation and immediate risks…" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-guide">Safety Guide</label>
                  <select id="ev-guide" className="form-control" value={safetyGuideId}
                    onChange={e => setSafetyGuideId(e.target.value)}>
                    <option value="">— None —</option>
                    {filteredGuides.map(g => (
                      <option key={g._id} value={g._id}>{g.title} ({g.language.toUpperCase()})</option>
                    ))}
                  </select>
                  <div className="form-hint">Auto-opens on user's device when alert is received</div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-buffer">Buffer Radius (km)</label>
                    <input id="ev-buffer" type="number" className="form-control" min={0} max={100} step={0.5}
                      value={bufferRadiusKm} onChange={e => setBufferRadiusKm(Number(e.target.value))} />
                    <div className="form-hint">Extra fan-out beyond drawn zone</div>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-expires">Expires At</label>
                    <input id="ev-expires" type="datetime-local" className="form-control"
                      value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                    <div className="form-hint">Leave blank for manual retraction</div>
                  </div>
                </div>
              </div>

              {/* Severity legend */}
              <div className="card" style={{ padding: '14px 16px' }}>
                <h4 style={{ marginBottom: 10 }}>Severity Reference</h4>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {SEVERITY_LEVELS.map(s => (
                    <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                      <span className={`severity-badge ${s}`} style={{ minWidth: 70 }}>{s}</span>
                      <span style={{ fontSize: 12, color: 'var(--grey-500)' }}>
                        {s === 'Low' && 'Silent notification, default sound'}
                        {s === 'Medium' && 'High-priority, medium buzzer'}
                        {s === 'High' && 'Max priority, loud buzzer'}
                        {s === 'Critical' && 'Full-screen intent, overrides silent mode'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ── Right: Map ────────────────────────────────────────────── */}
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>Draw Disaster Zone</h3>

              {/* Zone type toggle */}
              <div style={{ marginBottom: 12 }}>
                <label className="form-label">Zone Type</label>
                <div className="zone-toggle">
                  <button type="button" className={`zone-toggle-btn${zoneType === 'polygon' ? ' active' : ''}`}
                    onClick={() => setZoneType('polygon')}>Polygon</button>
                  <button type="button" className={`zone-toggle-btn${zoneType === 'radius' ? ' active' : ''}`}
                    onClick={() => setZoneType('radius')}>Radius Circle</button>
                </div>
              </div>

              <div className="map-hint">
                <MapPin size={13} />
                {zoneType === 'polygon'
                  ? 'Use the polygon tool (▷) to draw the disaster boundary. Click to add vertices, double-click to close.'
                  : 'Use the circle tool (○) to draw a radius zone. Click centre, drag to set radius.'}
              </div>

              <ZoneMap
                zoneType={zoneType}
                onZoneChange={setZoneData}
              />

              {zoneData && (
                <div className="alert alert-success" style={{ marginTop: 12, fontSize: 12 }}>
                  <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                  {zoneType === 'radius'
                    ? `Circle drawn: ${zoneData.radiusKm} km radius at [${zoneData.centre?.coordinates.map(c => c.toFixed(4)).join(', ')}]`
                    : `Polygon drawn: ${zoneData.polygon?.coordinates[0].length} vertices`}
                </div>
              )}
            </div>
          </div>

          {/* ── Submit row ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/events')}>
              Cancel
            </button>
            <button type="submit" id="btn-create-event" className="btn btn-primary" disabled={loading}>
              {loading ? <span className="spinner" style={{ width: 14, height: 14, borderWidth: 2 }} /> : null}
              {loading ? 'Creating…' : 'Create Event & Trigger Alert'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
