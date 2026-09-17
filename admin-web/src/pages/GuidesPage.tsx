import { useEffect, useState, type FormEvent } from 'react';
import { PlusCircle, RefreshCw, BookOpen, Trash2 } from 'lucide-react';
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

const emptyForm = () => ({
  disasterType: 'Flood' as DisasterType,
  language: 'en',
  title: '',
  summary: '',
  steps: [{ order: 1, instruction: '' }],
});

export default function GuidesPage() {
  const [guides,    setGuides]   = useState<SafetyGuide[]>([]);
  const [loading,   setLoading]  = useState(true);
  const [showForm,  setShowForm] = useState(false);
  const [form,      setForm]     = useState(emptyForm());
  const [submitting, setSubmitting] = useState(false);
  const [error,     setError]    = useState('');
  const [toast,     setToast]    = useState('');
  const [filterType, setFilterType] = useState('');

  const load = () => {
    setLoading(true);
    getGuides(filterType ? { disasterType: filterType } : {})
      .then(r => setGuides(r.data.guides))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(); }, [filterType]);

  const showToast = (msg: string) => { setToast(msg); setTimeout(() => setToast(''), 3000); };

  const addStep = () =>
    setForm(f => ({ ...f, steps: [...f.steps, { order: f.steps.length + 1, instruction: '' }] }));

  const updateStep = (idx: number, val: string) =>
    setForm(f => { const s = [...f.steps]; s[idx] = { ...s[idx], instruction: val }; return { ...f, steps: s }; });

  const removeStep = (idx: number) =>
    setForm(f => ({ ...f, steps: f.steps.filter((_, i) => i !== idx).map((s, i) => ({ ...s, order: i + 1 })) }));

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await createGuide(form);
      showToast('✓ Safety guide created');
      setShowForm(false);
      setForm(emptyForm());
      load();
    } catch (err: any) {
      const msgs = err.response?.data?.errors?.map((e: any) => e.message).join(', ');
      setError(msgs || err.response?.data?.message || 'Failed to create guide');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this guide? This cannot be undone.')) return;
    try {
      await deleteGuide(id);
      showToast('Guide deleted');
      load();
    } catch { showToast('Delete failed'); }
  };

  return (
    <>
      <div className="topbar">
        <span className="topbar-title">Safety Guides ({guides.length})</span>
        <button className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>
          <PlusCircle size={14} /> New Guide
        </button>
      </div>

      <div className="page-content">
        {/* Filters */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
          <select className="form-control" style={{ width: 'auto' }}
            value={filterType} onChange={e => setFilterType(e.target.value)}>
            <option value="">All Disaster Types</option>
            {DISASTER_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
          </select>
          <button className="btn btn-ghost btn-icon btn-sm" onClick={load}><RefreshCw size={14} /></button>
        </div>

        <div className="card">
          {loading ? (
            <div className="loading-center"><span className="spinner" /> Loading guides…</div>
          ) : guides.length === 0 ? (
            <div className="empty-state">
              <BookOpen />
              <p>No safety guides yet. Create one to link to disaster events.</p>
            </div>
          ) : (
            <div className="table-wrap">
              <table>
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
                  {guides.map(g => (
                    <tr key={g._id}>
                      <td style={{ fontWeight: 500 }}>{g.title}</td>
                      <td>{g.disasterType}</td>
                      <td style={{ textTransform: 'uppercase', fontSize: 12, color: 'var(--grey-600)' }}>
                        {g.language}
                      </td>
                      <td style={{ color: 'var(--grey-500)' }}>{g.steps.length} steps</td>
                      <td style={{ color: 'var(--grey-400)', fontSize: 12 }}>v{g.version}</td>
                      <td>
                        <span className={`status-badge ${g.isPublished ? 'active' : 'retracted'}`}>
                          {g.isPublished ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td>
                        <button className="btn btn-ghost btn-icon btn-sm"
                          onClick={() => handleDelete(g._id)} title="Delete">
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* ── Create Guide Modal ─────────────────────────────────────────────── */}
      {showForm && (
        <div className="modal-overlay">
          <div className="modal" style={{ maxWidth: 560 }}>
            <div className="modal-header">
              <h2>New Safety Guide</h2>
              <button className="btn btn-ghost btn-icon btn-sm" onClick={() => { setShowForm(false); setError(''); }}>✕</button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="modal-body">
                {error && <div className="alert alert-error" style={{ marginBottom: 12 }}>{error}</div>}

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
