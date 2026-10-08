import { useState, useEffect, useMemo, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Info, MapPin, CheckCircle } from 'lucide-react';
import { createEvent, triggerAlert, getGuides } from '../api/services';
import ZoneMap, { type ZoneData } from '../components/ZoneMap';
import AdministrativeTargetSelect from '../components/AdministrativeTargetSelect';
import type { DisasterType, Severity, ZoneType, SafetyGuide, EventStatus } from '../types';

const DISASTER_TYPES: DisasterType[] = [
  'Flood', 'FlashFlood', 'HeavyRainfall', 'UrbanWaterlogging',
  'Cyclone', 'Landslide', 'Heatwave', 'Coldwave',
  'Earthquake', 'Fire', 'Tsunami', 'Drought', 'ChemicalSpill', 'Other',
];

const SEVERITY_LEVELS: Severity[] = ['Low', 'Medium', 'High', 'Critical'];

export default function NewEventPage() {
  const navigate = useNavigate();

  const [title, setTitle] = useState('');
  const [hindiTitle, setHindiTitle] = useState('');
  const [type, setType] = useState<DisasterType>('Flood');
  const [severity, setSeverity] = useState<Severity>('Medium');
  const [targetStates, setTargetStates] = useState<string[]>(['Uttar Pradesh']);
  const [targetDistricts, setTargetDistricts] = useState<string[]>(['Varanasi']);
  const [description, setDescription] = useState('');
  const [hindiDesc, setHindiDesc] = useState('');
  const [safetyGuideId, setSafetyGuideId] = useState('');
  const [zoneType, setZoneType] = useState<ZoneType>('radius');
  const [bufferRadiusKm, setBufferRadiusKm] = useState(5);
  const [expiresAt, setExpiresAt] = useState('');
  const [zoneData, setZoneData] = useState<ZoneData | null>(null);

  const [guides, setGuides] = useState<SafetyGuide[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [dispatchInfo, setDispatchInfo] = useState<{ eventId: string; usersTargeted: number; alertsSent: number; status: string } | null>(null);

  useEffect(() => {
    getGuides().then((r) => setGuides(r.data.guides)).catch(() => {});
  }, []);

  const filteredGuides = guides.filter((g) => g.disasterType === type && g.isPublished);

  const regionalFocusLabel = useMemo(() => {
    if (targetDistricts.length > 0) {
      if (targetDistricts.length <= 3) {
        return targetDistricts.join(', ');
      }
      return `${targetDistricts.slice(0, 3).join(', ')} +${targetDistricts.length - 3} more`;
    }
    if (targetStates.length > 0) {
      return targetStates.join(', ');
    }
    return 'target area';
  }, [targetDistricts, targetStates]);

  const handleSubmit = async (actionStatus: EventStatus) => {
    setError('');
    setDispatchInfo(null);

    if (targetStates.length === 0) {
      setError('Please select at least one Target State.');
      return;
    }

    if (targetDistricts.length === 0) {
      setError('Please select at least one Target District.');
      return;
    }

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
        targetStates,
        targetDistricts,
        state: targetStates[0] || 'Uttar Pradesh',
        district: targetDistricts[0] || 'Varanasi',
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
        ...(zoneType === 'radius' && { centre: zoneData.centre, radiusKm: zoneData.radiusKm }),
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
        <div className="alert alert-success new-event-success-banner" aria-live="polite">
          <CheckCircle size={16} />
          <strong>
            {dispatchInfo.status === 'published' ? 'Alert Published & Dispatched!' : 'Event Saved successfully!'}
          </strong>
          &nbsp; Status: <code>{dispatchInfo.status}</code> · Redirecting to events list…
        </div>
      )}

      <div className="page-content new-event-page-shell">
        <form
          onSubmit={(e: FormEvent) => {
            e.preventDefault();
            handleSubmit('published');
          }}
          className="new-event-form"
        >
          <div className="new-event-form-grid">
            <div className="new-event-column">
              {/* ── Hazard & Regional Target Card ── */}
              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Hazard & Regional Target</h3>
                    <p className="new-event-card-subtitle">Define the incident and administrative alert targeting.</p>
                  </div>
                </div>

                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

                <AdministrativeTargetSelect
                  selectedStates={targetStates}
                  selectedDistricts={targetDistricts}
                  onStatesChange={setTargetStates}
                  onDistrictsChange={setTargetDistricts}
                />
              </div>

              {/* ── Hazard Classification Card ── */}
              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Hazard Classification</h3>
                    <p className="new-event-card-subtitle">Choose the hazard type and alert level.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-type">Hazard Taxonomy *</label>
                    <select id="ev-type" className="form-control" value={type} onChange={(e) => setType(e.target.value as DisasterType)}>
                      {DISASTER_TYPES.map((t) => (
                        <option key={t} value={t}>{t}</option>
                      ))}
                    </select>
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-severity">Severity *</label>
                    <select id="ev-severity" className="form-control new-event-severity-select" value={severity} onChange={(e) => setSeverity(e.target.value as Severity)}>
                      {SEVERITY_LEVELS.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                    <div className="form-hint">Sets the local alert intensity for citizen notifications.</div>
                  </div>
                </div>
              </div>

              {/* ── Alert Messaging Card ── */}
              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Alert Messaging</h3>
                    <p className="new-event-card-subtitle">Write advisory content for English and Hindi audiences.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-title">Title (English) *</label>
                    <input
                      id="ev-title"
                      className="form-control"
                      required
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="e.g. Flash Flood & Waterlogging Warning — Varanasi Riverbanks"
                      maxLength={120}
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-title-hi">Title (Hindi / हिंदी)</label>
                    <input
                      id="ev-title-hi"
                      className="form-control"
                      value={hindiTitle}
                      onChange={(e) => setHindiTitle(e.target.value)}
                      placeholder="उदा. [चेतावनी] वाराणसी में गंगा का जलस्तर चेतावनी बिंदु के पार"
                      maxLength={120}
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-desc">Advisory Details (English)</label>
                    <textarea
                      id="ev-desc"
                      className="form-control new-event-textarea"
                      rows={2}
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      maxLength={2000}
                      placeholder="River level is 0.4m above warning mark. Citizens in low-lying ghats must relocate…"
                    />
                  </div>

                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-desc-hi">Advisory Details (Hindi / हिंदी)</label>
                    <textarea
                      id="ev-desc-hi"
                      className="form-control new-event-textarea"
                      rows={2}
                      value={hindiDesc}
                      onChange={(e) => setHindiDesc(e.target.value)}
                      maxLength={2000}
                      placeholder="निचले इलाकों के निवासी तुरंत सुरक्षित स्थानों पर जाएं और स्थानीय प्रशासन के निर्देशों का पालन करें…"
                    />
                  </div>
                </div>
              </div>

              {/* ── Reference & Dispatch Card ── */}
              <div className="card new-event-card">
                <div className="new-event-card-header">
                  <div>
                    <h3>Reference & Dispatch</h3>
                    <p className="new-event-card-subtitle">Guardrail settings and recommended response guide.</p>
                  </div>
                </div>

                <div className="new-event-card-stack">
                  <div className="new-event-field-card">
                    <label className="form-label" htmlFor="ev-guide">Safety Guide</label>
                    <select id="ev-guide" className="form-control" value={safetyGuideId} onChange={(e) => setSafetyGuideId(e.target.value)}>
                      <option value="">— None —</option>
                      {filteredGuides.map((g) => (
                        <option key={g._id} value={g._id}>{g.title} ({g.language.toUpperCase()})</option>
                      ))}
                    </select>
                  </div>

                  <div className="new-event-field-card">
                    <div className="form-row">
                      <div className="form-group">
                        <label className="form-label" htmlFor="ev-buffer">Buffer Radius (km)</label>
                        <input
                          id="ev-buffer"
                          type="number"
                          className="form-control"
                          min={0}
                          max={100}
                          step={0.5}
                          value={bufferRadiusKm}
                          onChange={(e) => setBufferRadiusKm(Number(e.target.value))}
                        />
                      </div>
                      <div className="form-group">
                        <label className="form-label" htmlFor="ev-expires">Expires At</label>
                        <input
                          id="ev-expires"
                          type="datetime-local"
                          className="form-control"
                          value={expiresAt}
                          onChange={(e) => setExpiresAt(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ── Severity Reference Card ── */}
              <div className="card new-event-reference-card">
                <div className="new-event-card-header compact">
                  <div>
                    <h4>Severity Reference</h4>
                    <p className="new-event-card-subtitle compact">Alert behavior by severity level.</p>
                  </div>
                </div>
                <div className="new-event-severity-list">
                  {SEVERITY_LEVELS.map((s) => (
                    <div key={s} className="new-event-severity-row">
                      <span className={`severity-badge ${s}`} style={{ minWidth: 74 }}>{s}</span>
                      <span className="new-event-severity-text">
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

            {/* ── Map Card (Right Column) ── */}
            <div className="card new-event-map-card">
              <div className="new-event-map-header">
                <div>
                  <h3>Draw Disaster Geofence</h3>
                  <p className="new-event-card-subtitle">Define the geographical area for the impact zone.</p>
                </div>
              </div>

              <div className="new-event-zone-wrap">
                <label className="form-label">Zone Type</label>
                <div className="zone-toggle">
                  <button type="button" className={`zone-toggle-btn${zoneType === 'radius' ? ' active' : ''}`} onClick={() => setZoneType('radius')}>
                    Radius Circle
                  </button>
                  <button type="button" className={`zone-toggle-btn${zoneType === 'polygon' ? ' active' : ''}`} onClick={() => setZoneType('polygon')}>
                    Arbitrary Polygon
                  </button>
                </div>
              </div>

              <div className="new-event-info-box">
                <MapPin size={13} />
                {zoneType === 'radius'
                  ? `Focusing on ${regionalFocusLabel}. Click centre on the map and drag outward to define the impact circle.`
                  : 'Click multiple points on the map to define the perimeter. Double-click the last point to close.'}
              </div>

              <div className="new-event-map-meta">Alert Coverage Area</div>
              <ZoneMap zoneType={zoneType} onZoneChange={setZoneData} />

              {zoneData && (
                <div className="alert alert-success new-event-zone-summary" aria-live="polite">
                  <Info size={13} style={{ display: 'inline', marginRight: 6 }} />
                  {zoneType === 'radius'
                    ? `Radius Geofence: ${zoneData.radiusKm} km radius centered at [${zoneData.centre?.coordinates.map((c) => c.toFixed(4)).join(', ')}]`
                    : `Polygon Geofence: ${zoneData.polygon?.coordinates[0].length} boundary vertices`}
                </div>
              )}
            </div>
          </div>

          <div className="new-event-actions">
            <button type="button" className="btn btn-secondary" onClick={() => navigate('/events')}>
              Cancel
            </button>
            <button type="button" className="btn btn-secondary" disabled={loading} onClick={() => handleSubmit('draft')}>
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
            <button type="submit" className="btn btn-primary" disabled={loading}>
              {loading ? 'Processing…' : 'Approve & Publish (SDMA)'}
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
