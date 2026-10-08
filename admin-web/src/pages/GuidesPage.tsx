import { useEffect, useMemo, useState, type FormEvent } from 'react';
import {
  PlusCircle, RefreshCw, BookOpen, Trash2, BookText, ShieldCheck,
  Languages, CheckCircle2, CircleDashed, Eye, ZapOff, ArrowUp,
  AlertTriangle, Droplets, PhoneCall, Shield, Home, Radio,
  AlertCircle, Zap, ArrowDown, Compass, Flame, Sun, User,
  Thermometer, Volume2, ArrowRight, AlertOctagon, Truck
} from 'lucide-react';
import { getGuides, createGuide, deleteGuide } from '../api/services';
import type { SafetyGuide, DisasterType } from '../types';

const DISASTER_TYPES: DisasterType[] = [
  'Flood','Earthquake','Cyclone','Landslide','Fire',
  'Tsunami','Drought','Heatwave','ChemicalSpill','Other',
];

const LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'hi', label: 'Hindi' },
  { code: 'te', label: 'Telugu' },
  { code: 'ta', label: 'Tamil' },
  { code: 'bn', label: 'Bengali' },
  { code: 'mr', label: 'Marathi' },
  { code: 'gu', label: 'Gujarati' },
  { code: 'kn', label: 'Kannada' },
  { code: 'ml', label: 'Malayalam' },
  { code: 'or', label: 'Odia' },
];

const getLanguageLabel = (code: string) => {
  const found = LANGUAGES.find(l => l.code === code);
  return found ? found.label : String(code).toUpperCase();
};

const getDisasterBadgeTone = (type: string) => {
  const map: Record<string, string> = {
    Cyclone: 'cyclone',
    Earthquake: 'earthquake',
    Flood: 'flood',
    Heatwave: 'heatwave',
    Landslide: 'landslide',
    Fire: 'fire',
    Tsunami: 'tsunami',
    Drought: 'drought',
    ChemicalSpill: 'chemical',
    Other: 'other',
  };

  return map[type] || 'other';
};

const getStepIcon = (slug?: string) => {
  switch (slug) {
    case 'zap-off': return <ZapOff size={16} />;
    case 'arrow-up': return <ArrowUp size={16} />;
    case 'alert-triangle': return <AlertTriangle size={16} />;
    case 'droplets': return <Droplets size={16} />;
    case 'phone-call': return <PhoneCall size={16} />;
    case 'shield': return <Shield size={16} />;
    case 'home': return <Home size={16} />;
    case 'radio': return <Radio size={16} />;
    case 'alert-circle': return <AlertCircle size={16} />;
    case 'zap': return <Zap size={16} />;
    case 'arrow-down': return <ArrowDown size={16} />;
    case 'compass': return <Compass size={16} />;
    case 'flame': return <Flame size={16} />;
    case 'sun': return <Sun size={16} />;
    case 'user': return <User size={16} />;
    case 'thermometer': return <Thermometer size={16} />;
    case 'volume-2': return <Volume2 size={16} />;
    case 'arrow-right': return <ArrowRight size={16} />;
    case 'alert-octagon': return <AlertOctagon size={16} />;
    case 'truck': return <Truck size={16} />;
    default: return null;
  }
};

const emptyForm = () => ({
  disasterType: 'Flood' as DisasterType,
  language: 'en',
  title: '',
  summary: '',
  steps: [{ order: 1, instruction: '' }],
});

export default function GuidesPage() {
  const [guides, setGuides] = useState<SafetyGuide[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [viewingGuide, setViewingGuide] = useState<SafetyGuide | null>(null);
  const [form, setForm] = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [loadError, setLoadError] = useState('');
  const [toast, setToast] = useState('');
  const [filterType, setFilterType] = useState('');
  const [languageFilter, setLanguageFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  const load = () => {
    setLoading(true);
    setLoadError('');

    const params: { disasterType?: string; language?: string; published?: boolean } = {};
    if (filterType) params.disasterType = filterType;
    if (languageFilter !== 'all') params.language = languageFilter;
    if (statusFilter === 'published') params.published = true;
    if (statusFilter === 'draft') params.published = false;

    getGuides(params as any)
      .then(r => setGuides(r.data.guides))
      .catch(() => setLoadError('Unable to load safety guides. Please refresh the guide directory and try again.'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType, languageFilter, statusFilter]);

  const stats = useMemo(() => {
    const totalGuides = guides.length;
    const publishedCount = guides.filter(g => g.isPublished).length;
    const languages = new Set(guides.map(g => String(g.language || 'en').toUpperCase())).size;
    const disasterTypes = new Set(guides.map(g => g.disasterType)).size;

    return { totalGuides, publishedCount, languages, disasterTypes };
  }, [guides]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const addStep = () =>
    setForm(f => ({ ...f, steps: [...f.steps, { order: f.steps.length + 1, instruction: '' }] }));

  const updateStep = (idx: number, val: string) =>
    setForm(f => { const s = [...f.steps]; s[idx] = { ...s[idx], instruction: val }; return { ...f, steps: s }; });

  const removeStep = (idx: number) =>
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      await createGuide(form);
      showToast('✓ Safety guide created');
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err: any) {
      const msgs = err.response?.data?.errors?.map((e: any) => e.message).join(', ');
      setFormError(msgs || err.response?.data?.message || 'Failed to create guide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guide? This cannot be undone.')) return;
    try {
      await deleteGuide(id);
      showToast('Guide deleted');
      if (viewingGuide?._id === id) setViewingGuide(null);
      load();
    } catch { showToast('Delete failed'); }
  };

  return (
    <>
      <div className="topbar">
        <div className="topbar-title-wrap">
          <span className="topbar-title">Safety Guides</span>
          <span className="topbar-subtitle">Preparedness guidance for citizens during disaster situations.</span>
        </div>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusCircle size={14} /> New Guide
        </button>
      </div>

      <div className="page-content">
        <div className="toolbar-card guide-directory-card">
          <div className="toolbar-header guide-toolbar-header">
            <div className="guide-directory-meta">
              <div className="guide-directory-kicker">Guide directory</div>
              <div className="guide-directory-accent" />
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
              <PlusCircle size={14} /> New Guide
            </button>
          </div>

          <div className="guide-directory-body">
            <div className="guide-directory-icon-wrap">
              <BookText size={18} />
            </div>
            <div className="guide-directory-copy">
              <h2 className="section-title">Safety knowledge & preparedness</h2>
              <p>Manage multilingual safety guidance linked to disaster alerts.</p>
            </div>
          </div>

          <div className="toolbar-actions guide-filter-row">
            <label className="filter-control">
              <span>Disaster Type</span>
              <select value={filterType} onChange={e => setFilterType(e.target.value)}>
                <option value="">All Disaster Types</option>
                {DISASTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
              </select>
            </label>

            <label className="filter-control">
              <span>Language</span>
              <select value={languageFilter} onChange={e => setLanguageFilter(e.target.value)}>
                <option value="all">All Languages</option>
                {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
              </select>
            </label>

            <label className="filter-control">
              <span>Publication Status</span>
              <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}>
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
              </select>
            </label>

            <button className="btn btn-secondary btn-sm guide-refresh-btn" onClick={load}>
              <RefreshCw size={14} /> Refresh
            </button>
          </div>
        </div>

        <div className="stats-grid guide-stats-grid">
          <div className="stat-card stat-card-navy">
            <div className="stat-card-icon"><BookOpen size={14} /></div>
            <div className="stat-label">Total Guides</div>
            <div className="stat-value">{stats.totalGuides}</div>
            <div className="stat-sub">knowledge base</div>
          </div>

          <div className="stat-card stat-card-green">
            <div className="stat-card-icon"><CheckCircle2 size={14} /></div>
            <div className="stat-label">Published</div>
            <div className="stat-value">{stats.publishedCount}</div>
            <div className="stat-sub">available now</div>
          </div>

          <div className="stat-card stat-card-blue">
            <div className="stat-card-icon"><Languages size={14} /></div>
            <div className="stat-label">Languages</div>
            <div className="stat-value">{stats.languages}</div>
            <div className="stat-sub">active locales</div>
          </div>

          <div className="stat-card stat-card-orange">
            <div className="stat-card-icon"><ShieldCheck size={14} /></div>
            <div className="stat-label">Disaster Types</div>
            <div className="stat-value">{stats.disasterTypes}</div>
            <div className="stat-sub">risk categories</div>
          </div>
        </div>

        <div className="card guides-list-card">
          <div className="table-card-header">
            <span className="table-card-title">Guide Directory</span>
            <span className="table-card-subtitle">All Guides</span>
          </div>

          {loading ? (
            <div className="table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Disaster Type</th>
                    <th>Language</th>
                    <th>Steps</th>
                    <th>Version</th>
                    <th>Published</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {[1,2,3,4,5].map(index => (
                    <tr key={index}>
                      <td><div className="skeleton skeleton-title" /></td>
                      <td><div className="skeleton skeleton-pill" /></td>
                      <td><div className="skeleton skeleton-badge" /></td>
                      <td><div className="skeleton skeleton-steps" /></td>
                      <td><div className="skeleton skeleton-badge" /></td>
                      <td><div className="skeleton skeleton-status" /></td>
                      <td><div className="skeleton skeleton-icon" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : loadError ? (
            <div className="error-state">
              <div className="error-state-icon"><CircleDashed size={22} /></div>
              <h3>Unable to load safety guides</h3>
              <p>Please refresh the guide directory and try again.</p>
              <button className="btn btn-secondary btn-sm" onClick={load}>
                <RefreshCw size={14} /> Refresh Guides
              </button>
            </div>
          ) : guides.length === 0 ? (
            <div className="empty-state guide-empty-state">
              <div className="empty-state-icon-wrap">
                <BookOpen size={20} />
              </div>
              <h3>No safety guides available</h3>
              <p>Preparedness guidance will appear here once guides are added.</p>
              <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
                <PlusCircle size={14} /> Create Safety Guide
              </button>
            </div>
          ) : (
            <div className="table-wrap">
              <table className="guide-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Disaster Type</th>
                    <th>Language</th>
                    <th>Steps</th>
                    <th>Version</th>
                    <th>Published</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {guides.map(g => (
                    <tr
                      key={g._id}
                      onClick={() => setViewingGuide(g)}
                      style={{ cursor: 'pointer' }}
                      title="Click to view full guide"
                    >
                      <td className="guide-title-cell">
                        <div className="guide-title-main">{g.title}</div>
                        {g.summary && (
                          <div style={{ fontSize: 12, color: 'var(--grey-500, #64748b)', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 360 }}>
                            {g.summary}
                          </div>
                        )}
                      </td>
                      <td><span className={`disaster-badge disaster-badge--${getDisasterBadgeTone(g.disasterType)}`}>{g.disasterType}</span></td>
                      <td><span className="language-badge">{getLanguageLabel(g.language)} ({String(g.language || 'en').toUpperCase()})</span></td>
                      <td className="steps-cell">
                        <span className="steps-meta"><BookOpen size={12} /> {g.steps.length} steps</span>
                      </td>
                      <td><span className="version-badge">v{g.version}</span></td>
                      <td>
                        <span className={`published-badge ${g.isPublished ? 'published' : 'draft'}`}>
                          <span className="published-dot" />
                          {g.isPublished ? 'Published' : 'Draft'}
                        </span>
                      </td>
                      <td className="table-actions-cell" onClick={e => e.stopPropagation()}>
                        <div className="guide-actions-wrapper">
                          <button
                            className="guide-action-btn guide-action-btn--view"
                            onClick={(e) => { e.stopPropagation(); setViewingGuide(g); }}
                            title={`View ${g.title}`}
                            aria-label={`View ${g.title}`}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="guide-action-btn guide-action-btn--delete"
                            onClick={(e) => { e.stopPropagation(); handleDelete(g._id); }}
                            title={`Delete ${g.title}`}
                            aria-label={`Delete ${g.title}`}
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── View Guide Modal Dialog ────────────────────────────────────────────── */}
      {viewingGuide && (
        <div className="modal-overlay" onClick={() => setViewingGuide(null)}>
          <div className="modal" style={{ maxWidth: 640, width: '92%' }} onClick={e => e.stopPropagation()}>
            <div className="modal-header" style={{ padding: '16px 20px', background: '#f8fafc', borderBottom: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                <div style={{
                  width: 40, height: 40, borderRadius: 8,
                  background: '#ebf3fa', color: '#0b2a4a',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                }}>
                  <BookText size={22} />
                </div>
                <div>
                  <h2 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0f172a' }}>{viewingGuide.title}</h2>
                  <span style={{ fontSize: 12, color: '#64748b' }}>
                    Safety Guide Details & Emergency Steps
                  </span>
                </div>
              </div>
              <button
                className="btn btn-ghost btn-icon btn-sm"
                onClick={() => setViewingGuide(null)}
                aria-label="Close dialog"
                style={{ fontSize: 18, color: '#64748b' }}
              >
                ✕
              </button>
            </div>

            <div className="modal-body" style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 18, maxHeight: '75vh', overflowY: 'auto' }}>
              {/* Metadata Badges */}
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                <span className={`disaster-badge disaster-badge--${getDisasterBadgeTone(viewingGuide.disasterType)}`}>
                  {viewingGuide.disasterType}
                </span>
                <span className="language-badge" style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  <Languages size={13} />
                  {getLanguageLabel(viewingGuide.language)} ({String(viewingGuide.language).toUpperCase()})
                </span>
                <span className="version-badge">Version {viewingGuide.version}</span>
                <span className={`published-badge ${viewingGuide.isPublished ? 'published' : 'draft'}`}>
                  <span className="published-dot" />
                  {viewingGuide.isPublished ? 'Published' : 'Draft'}
                </span>
              </div>

              {/* Summary Section */}
              {viewingGuide.summary && (
                <div style={{
                  background: '#f1f5f9',
                  borderLeft: '4px solid #0052cc',
                  padding: '14px 16px',
                  borderRadius: '0 8px 8px 0',
                  fontSize: 13.5,
                  lineHeight: 1.55,
                  color: '#1e293b'
                }}>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#64748b', marginBottom: 4 }}>
                    Summary & Overview
                  </div>
                  {viewingGuide.summary}
                </div>
              )}

              {/* Safety Steps List */}
              <div>
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  marginBottom: 12, paddingBottom: 8, borderBottom: '1px solid #e2e8f0'
                }}>
                  <h3 style={{ fontSize: 14, fontWeight: 700, margin: 0, color: '#0f172a', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <ShieldCheck size={16} color="#0052cc" /> Safety Instructions ({viewingGuide.steps?.length || 0} Steps)
                  </h3>
                  <span style={{ fontSize: 12, color: '#64748b' }}>Sequential protocol</span>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {viewingGuide.steps && viewingGuide.steps.length > 0 ? (
                    [...viewingGuide.steps]
                      .sort((a, b) => a.order - b.order)
                      .map((step, idx) => {
                        const iconEl = getStepIcon(step.iconSlug);
                        return (
                          <div key={idx} style={{
                            display: 'flex', gap: 12, alignItems: 'flex-start',
                            padding: '12px 14px', borderRadius: 8, background: '#ffffff',
                            border: '1px solid #e2e8f0',
                            boxShadow: '0 1px 2px rgba(0,0,0,0.03)'
                          }}>
                            <div style={{
                              width: 32, height: 32, borderRadius: '50%',
                              background: '#ebf3fa', color: '#0b2a4a',
                              fontWeight: 700, fontSize: 13, display: 'flex', alignItems: 'center', justifyContent: 'center',
                              flexShrink: 0
                            }}>
                              {iconEl || (step.order || idx + 1)}
                            </div>
                            <div style={{ flex: 1, marginTop: 2 }}>
                              <div style={{ fontSize: 11, fontWeight: 600, color: '#64748b', marginBottom: 2 }}>
                                Step {step.order || idx + 1}
                              </div>
                              <div style={{ fontSize: 13.5, lineHeight: 1.5, color: '#1e293b' }}>
                                {step.instruction}
                              </div>
                            </div>
                          </div>
                        );
                      })
                  ) : (
                    <div style={{ padding: 16, textAlign: 'center', color: '#64748b', fontSize: 13 }}>
                      No steps recorded for this safety guide.
                    </div>
                  )}
                </div>
              </div>
            </div>

            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0' }}>
              <button
                type="button"
                className="btn btn-ghost"
                style={{ color: '#dc2626', display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
                onClick={() => {
                  const id = viewingGuide._id;
                  handleDelete(id);
                }}
              >
                <Trash2 size={14} /> Delete Guide
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={() => setViewingGuide(null)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Create Guide Modal ────────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>New Safety Guide</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowForm(false); setFormError(''); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {formError && <div className="alert alert-error" style={{ marginBottom: 12 }}>{formError}</div>}

                <div className="form-row">
                  <div className="form-group">
                    <label className="form-label">Disaster Type *</label>
                    <select className="form-control" value={form.disasterType}
                      onChange={e => setForm(f => ({ ...f, disasterType: e.target.value as DisasterType }))}>
                      {DISASTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                  <div className="form-group">
                    <label className="form-label">Language *</label>
                    <select className="form-control" value={form.language}
                      onChange={e => setForm(f => ({ ...f, language: e.target.value }))}>
                      {LANGUAGES.map(l => <option key={l.code} value={l.code}>{l.label}</option>)}
                    </select>
                  </div>
                </div>

                <div className="form-group">
                  <label className="form-label">Title *</label>
                  <input className="form-control" required value={form.title}
                    onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                    placeholder="e.g., Flood Safety Guide" maxLength={120} />
                </div>

                <div className="form-group">
                  <label className="form-label">Summary</label>
                  <input className="form-control" value={form.summary}
                    onChange={e => setForm(f => ({ ...f, summary: e.target.value }))}
                    placeholder="Brief one-line summary" maxLength={300} />
                </div>

                <div className="form-group">
                  <label className="form-label">Safety Steps *</label>
                  {form.steps.map((step, idx) => (
                    <div key={idx} style={{ display: 'flex', gap: 8, alignItems: 'flex-start', marginBottom: 8 }}>
                      <span style={{ width: 22, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: 11, color: 'var(--grey-400)', flexShrink: 0, marginTop: 2 }}>
                        {idx + 1}
                      </span>
                      <input
                        className="form-control"
                        value={step.instruction}
                        onChange={e => updateStep(idx, e.target.value)}
                        placeholder={`Step ${idx + 1} instruction`}
                        required
                        maxLength={1000}
                      />
                      {form.steps.length > 1 && (
                        <button type="button" className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => removeStep(idx)} style={{ flexShrink: 0, marginTop: 2 }}>
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  ))}
                  <button type="button" className="btn btn-secondary btn-sm" onClick={addStep}>
                    <PlusCircle size={13} /> Add Step
                  </button>
                </div>
              </div>
              <div className="modal-footer">
                <button type="button" className="btn btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
                <button type="submit" id="btn-save-guide" className="btn btn-primary" disabled={submitting}>
                  {submitting ? <><span className="spinner" style={{ width: 13, height: 13 }} /> Saving…</> : 'Save Guide'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {toast && (
        <div style={{ position: 'fixed', bottom: 24, right: 24, background: 'var(--black)', color: 'var(--white)',
          padding: '12px 18px', borderRadius: 4, fontSize: 13, zIndex: 2000 }}>
          {toast}
        </div>
      )}
    </>
  );
}

