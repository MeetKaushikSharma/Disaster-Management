import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MapPin, CheckCircle } from 'lucide-react';
import { createEvent, triggerAlert, getGuides } from '../api/services';
import ZoneMap, { type ZoneData } from '../components/ZoneMap';
import type { DisasterType, Severity, ZoneType, SafetyGuide, EventStatus } from '../types';

const DISASTER_TYPES: DisasterType[] = [
  'Flood', 'FlashFlood', 'HeavyRainfall', 'UrbanWaterlogging',
  'Cyclone', 'Landslide', 'Heatwave', 'Coldwave',
  'Earthquake', 'Fire', 'Tsunami', 'Drought', 'ChemicalSpill', 'Other',
];

const SEVERITY_LEVELS: Severity[] = ['Advisory', 'Watch', 'Warning', 'Emergency', 'Low', 'Medium', 'High', 'Critical'];

const UP_DISTRICTS = [
  'Varanasi', 'Gorakhpur', 'Prayagraj', 'Lucknow',
  'Ayodhya', 'Kanpur', 'Mirzapur', 'Ballia',
];

export default function NewEventPage() {
  const navigate = useNavigate();

  // Form state
  const [title,          setTitle]          = useState('');
  const [hindiTitle,     setHindiTitle]     = useState('');
  const [type,           setType]           = useState<DisasterType>('Flood');
  const [severity,       setSeverity]       = useState<Severity>('Warning');
  const [district,       setDistrict]       = useState('Varanasi');
  const [description,    setDescription]    = useState('');
  const [hindiDesc,      setHindiDesc]      = useState('');
  const [safetyGuideId,  setSafetyGuideId]  = useState('');
  const [zoneType,       setZoneType]       = useState<ZoneType>('radius');
  const [bufferRadiusKm, setBufferRadiusKm] = useState(5);
  const [expiresAt,      setExpiresAt]      = useState('');
  const [zoneData,       setZoneData]       = useState<ZoneData | null>(null);

  const [guides,   setGuides]   = useState<SafetyGuide[]>([]);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [dispatchInfo, setDispatchInfo] = useState<{ eventId: string; usersTargeted: number; alertsSent: number; status: string } | null>(null);

  useEffect(() => {
    getGuides().then(r => setGuides(r.data.guides)).catch(() => {});
  }, []);

  const filteredGuides = guides.filter(g => g.disasterType === type && g.isPublished);

  const handleSubmit = async (actionStatus: EventStatus) => {
    setError('');
    setDispatchInfo(null);

    if (!zoneData) {
      setError('Please draw a disaster zone on the map before submitting.');
      return;
    }

    if (zoneType === 'polygon' && (!zoneData.polygon || zoneData.polygon.coordinates[0].length < 4)) {
      setError('Polygon must have at least 3 vertices. Double-click the last point to close it.');
      return;
    }

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
        district,
        state: 'Uttar Pradesh',
        description,
        translations: {
          hi: {
            title: hindiTitle || undefined,
            description: hindiDesc || undefined,
          },
        },
        safetyGuideId: safetyGuideId || undefined,
        zoneType,
        bufferRadiusKm,
        status: actionStatus,
        expiresAt: expiresAt || undefined,
        ...(zoneType === 'polygon' && { polygon: zoneData.polygon }),
        ...(zoneType === 'radius'  && { centre: zoneData.centre, radiusKm: zoneData.radiusKm }),
      };

      const { data: eventData } = await createEvent(payload as any);
      const eventId = eventData.event._id;

      if (actionStatus === 'published' || actionStatus === 'active') {
        try {
          const { data: triggerData } = await triggerAlert(eventId);
          setDispatchInfo({
            eventId,
            status: actionStatus,
            usersTargeted: triggerData.usersTargeted,
            alertsSent: triggerData.alertsSent,
          });
        } catch {
          // Even if trigger fails, event is created
        }
      } else {
        setDispatchInfo({
          eventId,
          status: actionStatus,
          usersTargeted: 0,
          alertsSent: 0,
        });
      }

      setTimeout(() => navigate('/events'), 2500);
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
        <span className="topbar-title">Create Disaster Event (India SDMA)</span>
      </div>

      {dispatchInfo && (
        <div className="alert alert-success" style={{ margin: '12px 24px 0', display: 'flex', alignItems: 'center', gap: 10, fontSize: 13 }}>
          <CheckCircle size={16} />
          <strong>
            {dispatchInfo.status === 'published' ? 'Alert Published & Dispatched!' : 'Event Saved successfully!'}
          </strong>&nbsp;
          Status: <code>{dispatchInfo.status}</code> · Redirecting to events list…
        </div>
      )}

      <div className="page-content">
        <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleSubmit('published'); }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, alignItems: 'start' }}>

            {/* ── Left: Form fields ─────────────────────────────────────── */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

              <div className="card">
                <h3 style={{ marginBottom: 16 }}>1. Hazard & Regional Target</h3>

                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-state">State</label>
                    <input id="ev-state" className="form-control" value="Uttar Pradesh (UP)" disabled />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-district">Target District *</label>
                    <select id="ev-district" className="form-control" value={district}
                      onChange={e => setDistrict(e.target.value)}>
                      {UP_DISTRICTS.map(d => <option key={d} value={d}>{d}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-type">Hazard Taxonomy *</label>
                    <select id="ev-type" className="form-control" value={type}
                      onChange={e => setType(e.target.value as DisasterType)}>
                      {DISASTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-severity">NDMA Severity Tier *</label>
                    <select id="ev-severity" className="form-control" value={severity}
                      onChange={e => setSeverity(e.target.value as Severity)}>
                      {SEVERITY_LEVELS.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                    <div className="form-hint">Advisory (Yellow) · Watch (Orange) · Warning (Red) · Emergency</div>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-title">Title (English) *</label>
                  <input id="ev-title" className="form-control" required value={title}
                    onChange={e => setTitle(e.target.value)}
                    placeholder="e.g. Flash Flood & Waterlogging Warning — Varanasi Riverbanks"
                    maxLength={120} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-title-hi">Title (Hindi / हिंदी)</label>
                  <input id="ev-title-hi" className="form-control" value={hindiTitle}
                    onChange={e => setHindiTitle(e.target.value)}
                    placeholder="उदा. [चेतावनी] वाराणसी में गंगा का जलस्तर चेतावनी बिंदु के पार"
                    maxLength={120} />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-desc">Advisory Details (English)</label>
                  <textarea id="ev-desc" className="form-control" rows={2} value={description}
                    onChange={e => setDescription(e.target.value)} maxLength={2000}
                    placeholder="River level is 0.4m above warning mark. Citizens in low-lying ghats must relocate…" />
                </div>

                <div className="form-group">
                  <label className="form-label" htmlFor="ev-desc-hi">Advisory Details (Hindi / हिंदी)</label>
                  <textarea id="ev-desc-hi" className="form-control" rows={2} value={hindiDesc}
                    onChange={e => setHindiDesc(e.target.value)} maxLength={2000}
                    placeholder="निचले इलाकों के निवासी तुरंत सुरक्षित स्थानों पर जाएं और स्थानीय प्रशासन के निर्देशों का पालन करें…" />
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
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-buffer">Buffer Radius (km)</label>
                    <input id="ev-buffer" type="number" className="form-control" min={0} max={100} step={0.5}
                      value={bufferRadiusKm} onChange={e => setBufferRadiusKm(Number(e.target.value))} />
                  </div>
                  <div className="form-group">
                    <label className="form-label" htmlFor="ev-expires">Expires At</label>
                    <input id="ev-expires" type="datetime-local" className="form-control"
                      value={expiresAt} onChange={e => setExpiresAt(e.target.value)} />
                  </div>
                </div>
              </div>
            </div>

            {/* ── Right: Map ────────────────────────────────────────────── */}
            <div className="card">
              <h3 style={{ marginBottom: 12 }}>2. Draw Disaster Geofence</h3>

              <div style={{ marginBottom: 12 }}>
                <div className="zone-toggle">
                  <button type="button" className={`zone-toggle-btn${zoneType === 'radius' ? ' active' : ''}`}
                    onClick={() => setZoneType('radius')}>Radius Circle</button>
                  <button type="button" className={`zone-toggle-btn${zoneType === 'polygon' ? ' active' : ''}`}
                    onClick={() => setZoneType('polygon')}>Arbitrary Polygon</button>
                </div>
              </div>

              <div className="map-hint">
                <MapPin size={13} />
                {zoneType === 'radius'
                  ? `Focusing on ${district}. Click centre on the map and drag outward to define the impact circle.`
                  : 'Click multiple points on the map to define the perimeter. Double-click the last point to close.'}
              </div>

              <ZoneMap
                zoneType={zoneType}
                onZoneChange={setZoneData}
              />

              {zoneData && (
                <div className="alert alert-success" style={{ marginTop: 12, fontSize: 12 }}>
                  <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                  {zoneType === 'radius'
                    ? `Radius Geofence: ${zoneData.radiusKm} km radius centered at [${zoneData.centre?.coordinates.map(c => c.toFixed(4)).join(', ')}]`
                    : `Polygon Geofence: ${zoneData.polygon?.coordinates[0].length} boundary vertices`}
                </div>
              )}
            </div>
          </div>

          {/* ── Submit row ────────────────────────────────────────────────── */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 24 }}>
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/events')}>
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              onClick={() => handleSubmit('draft')}
            >
              Save as Draft
            </button>
            <button
              type="button"
              className="btn btn-secondary"
              disabled={loading}
              style={{ border: '1.5px solid var(--amber-500)', color: 'var(--amber-800)', background: 'var(--amber-50)' }}
              onClick={() => handleSubmit('pending_approval')}
            >
              Submit for SDMA Approval
            </button>
            <button
              type="button"
              className="btn btn-primary"
              disabled={loading}
              onClick={() => handleSubmit('published')}
            >
              {loading ? 'Processing…' : 'Approve & Publish (SDMA)'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}

