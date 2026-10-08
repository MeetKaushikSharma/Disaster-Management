import { useEffect, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent } from 'react';
import {
  AlertCircle, Check, CheckCircle2, ChevronDown, CircleCheck, ClipboardList,
  Clock3, LoaderCircle, MapPin, PhoneCall, Radio, RefreshCw, Search, Send,
  ShieldCheck, Siren, TriangleAlert, UserCheck, Users, X,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { getSituationalAwareness, acknowledgeCheckIn } from '../api/services';
import { INDIA_STATES } from '../data/indiaStates';
import type { CitizenCheckIn, SituationalAwarenessSummary } from '../types';
import './SituationalAwarenessPage.css';

const districts = INDIA_STATES.flatMap((state) => state.districts).sort((a, b) => a.localeCompare(b));

function formatTime(value: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}

function coordinate(value: number, positive: string, negative: string) {
  if (!Number.isFinite(value)) return 'Not available';
  return `${Math.abs(value).toFixed(4)}°${value < 0 ? negative : positive}`;
}

function Skeleton({ className = '' }: { className?: string }) {
  return <div aria-hidden="true" className={`awareness-skeleton ${className}`} />;
}

export default function SituationalAwarenessPage() {
  const [summary, setSummary] = useState<SituationalAwarenessSummary>({ safe: 0, need_help: 0, family_safe: 0, totalReports: 0 });
  const [distressedList, setDistressedList] = useState<CitizenCheckIn[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [ackLoading, setAckLoading] = useState<string | null>(null);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CitizenCheckIn | null>(null);

  const fetchData = async () => {
    setLoading(true);
    setErrorMsg('');
    try {
      const res = await getSituationalAwareness(selectedDistrict ? { district: selectedDistrict } : undefined);
      setSummary(res.data.summary);
      setDistressedList(res.data.distressedList);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Unable to retrieve the latest citizen reports.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getSituationalAwareness(selectedDistrict ? { district: selectedDistrict } : undefined);
        if (!active) return;
        setSummary(res.data.summary);
        setDistressedList(res.data.distressedList);
      } catch (err: any) {
        if (active) setErrorMsg(err.response?.data?.message || 'Unable to retrieve the latest citizen reports.');
      } finally {
        if (active) setLoading(false);
      }
    };
    void load();
    return () => { active = false; };
  }, [selectedDistrict]);

  const handleConfirmDispatch = async () => {
    if (!selectedRequest) return;
    setAckLoading(selectedRequest._id);
    try {
      const response = await acknowledgeCheckIn(selectedRequest._id);
      const updatedCheckIn = response.data.checkIn as CitizenCheckIn;
      setDistressedList((current) => current.map((item) => item._id === updatedCheckIn._id ? updatedCheckIn : item));
      setSuccessMsg(`Responder team dispatch logged for ${updatedCheckIn.citizenName || 'citizen'}.`);
      setSelectedRequest(null);
    } catch (err: any) {
      setErrorMsg(err.response?.data?.message || 'Unable to mark this request as dispatched.');
    } finally {
      setAckLoading(null);
    }
  };

  return (
    <div className="citizen-awareness">
      <header className="topbar awareness-topbar">
        <div className="awareness-page-heading">
          <Radio size={21} aria-hidden="true" />
          <div>
            <h1>Citizen Situational Awareness &amp; Response</h1>
            <p>Real-time citizen feedback and emergency response coordination.</p>
          </div>
        </div>
        <div className="awareness-header-tools">
          <span className={`awareness-live-state ${loading ? 'is-loading' : errorMsg ? 'is-error' : 'is-live'}`}>
            <span className="awareness-live-dot" />{loading ? 'CONNECTING' : errorMsg ? 'FEEDBACK UNAVAILABLE' : 'LIVE CITIZEN FEEDBACK'}
          </span>
          <DistrictCombobox
            value={selectedDistrict}
            districts={districts}
            onChange={(district) => {
              setLoading(true);
              setErrorMsg('');
              setSelectedDistrict(district);
            }}
          />
          <button className="btn btn-secondary btn-sm awareness-refresh" onClick={fetchData} disabled={loading}>
            {loading ? <LoaderCircle className="awareness-spin" size={15} /> : <RefreshCw size={15} />}
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </header>

      <main className="page-content awareness-content">
        {successMsg && <div className="awareness-success" role="status"><CheckCircle2 size={17} /><span>{successMsg}</span><button aria-label="Dismiss confirmation" onClick={() => setSuccessMsg('')}><X size={16} /></button></div>}

        {errorMsg && <section className="awareness-error" role="alert"><div><span><TriangleAlert size={15} />CITIZEN FEEDBACK UNAVAILABLE</span><p>Unable to retrieve the latest citizen reports.</p>{errorMsg !== 'Unable to retrieve the latest citizen reports.' && <small>{errorMsg}</small>}</div><button className="btn btn-secondary btn-sm" onClick={fetchData} disabled={loading}><RefreshCw size={14} />Retry</button></section>}

        <section className="awareness-summary-grid" aria-label="Citizen awareness summary" aria-busy={loading}>
          {loading ? Array.from({ length: 4 }, (_, index) => <Skeleton className="awareness-summary-skeleton" key={index} />) : <>
            <SummaryCard icon={CircleCheck} label="Confirmed safe" value={summary.safe} description={'citizens marked "I am Safe"'} tone="safe" />
            <SummaryCard icon={Siren} label="Urgent SOS / Help Needed" value={summary.need_help} description="distressed citizens awaiting aid" tone="urgent" active={summary.need_help > 0} />
            <SummaryCard icon={UserCheck} label="Family confirmed safe" value={summary.family_safe} description="multi-person family units" tone="family" />
            <SummaryCard icon={ClipboardList} label="Total citizen reports" value={summary.totalReports} description="real-time citizen feedback" tone="reports" />
          </>}
        </section>

        <section className="card awareness-queue" aria-busy={loading}>
          <div className="awareness-queue-heading">
            <div>
              <div className="awareness-queue-title"><AlertCircle size={19} /><h2>Urgent Distress Queue</h2></div>
              <p>Citizens requesting immediate assistance during active disaster conditions.</p>
            </div>
            <span className="awareness-active-count"><span />{loading ? '—' : summary.need_help.toLocaleString()} ACTIVE REQUESTS</span>
          </div>

          {loading ? <div className="awareness-loading-rows" aria-label="Loading citizen reports">{Array.from({ length: 4 }, (_, index) => <Skeleton className="awareness-row-skeleton" key={index} />)}</div> : distressedList.length === 0 ? (
            <div className="awareness-empty"><span className="awareness-empty-icon"><ShieldCheck size={22} /></span><div><h3>NO ACTIVE DISTRESS REQUESTS</h3><p>No citizens are currently awaiting emergency assistance.</p><ul><li><CheckCircle2 size={15} />Monitoring active</li><li><CheckCircle2 size={15} />Citizen feedback connected</li></ul></div></div>
          ) : (
            <div className="awareness-table-wrap">
              <table className="awareness-table">
                <thead><tr><th>Citizen</th><th>Location</th><th>Reported message</th><th>People</th><th>Status</th><th>Action</th></tr></thead>
                <tbody>{distressedList.map((citizen) => {
                  const [longitude, latitude] = citizen.location?.coordinates ?? [Number.NaN, Number.NaN];
                  return <tr className={citizen.isAcknowledgedByResponders ? 'is-dispatched' : 'is-pending'} key={citizen._id}>
                    <td data-label="Citizen"><div className="awareness-citizen-cell"><strong>{citizen.citizenName || 'Not available'}</strong><span className="awareness-cell-meta"><PhoneCall size={12} />{citizen.phone || 'Not available'}</span><span className="awareness-cell-time"><Clock3 size={12} />Reported {formatTime(citizen.createdAt)}</span></div></td>
                    <td data-label="Location"><div className="awareness-location-cell"><strong>{citizen.district || 'Not available'}, {citizen.state || 'Not available'}</strong><span className="awareness-cell-meta"><MapPin size={13} />{coordinate(latitude, 'N', 'S')}, {coordinate(longitude, 'E', 'W')}</span></div></td>
                    <td data-label="Reported message"><p className="awareness-message">{citizen.message || 'Not available'}</p></td>
                    <td data-label="People"><div className="awareness-people"><Users size={17} /><strong>{citizen.peopleCount}</strong><span>people</span></div></td>
                    <td data-label="Status"><StatusBadge dispatched={citizen.isAcknowledgedByResponders} /></td>
                    <td data-label="Action">{citizen.isAcknowledgedByResponders ? <span className="awareness-dispatched-action"><CheckCircle2 size={15} />Dispatched</span> : <button className="btn btn-primary btn-sm awareness-dispatch-button" onClick={() => setSelectedRequest(citizen)} disabled={ackLoading === citizen._id}>{ackLoading === citizen._id ? <LoaderCircle size={14} className="awareness-spin" /> : <Send size={14} />}{ackLoading === citizen._id ? 'Dispatching...' : 'Mark Dispatched'}<span aria-hidden="true">→</span></button>}</td>
                  </tr>;
                })}</tbody>
              </table>
            </div>
          )}
        </section>
      </main>

      {selectedRequest && <div className="awareness-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setSelectedRequest(null); }}>
        <section className="awareness-confirm-modal" role="dialog" aria-modal="true" aria-labelledby="dispatch-confirm-title">
          <header><div><span>RESPONSE COORDINATION</span><h2 id="dispatch-confirm-title">Mark request as dispatched?</h2></div><button className="awareness-close" aria-label="Close dialog" onClick={() => setSelectedRequest(null)}><X size={17} /></button></header>
          <div className="awareness-confirm-body">
            <dl><div><dt>Citizen</dt><dd>{selectedRequest.citizenName || 'Not available'}</dd></div><div><dt>Location</dt><dd>{selectedRequest.district || 'Not available'}, {selectedRequest.state || 'Not available'}</dd></div><div><dt>People affected</dt><dd>{selectedRequest.peopleCount}</dd></div></dl>
            <div className="awareness-confirm-message"><strong>REQUEST</strong><p>{selectedRequest.message || 'Not available'}</p></div>
          </div>
          <footer><button className="btn btn-secondary" onClick={() => setSelectedRequest(null)}>Cancel</button><button className="btn btn-primary" onClick={handleConfirmDispatch} disabled={ackLoading !== null}><Send size={15} />{ackLoading ? 'Dispatching...' : 'Mark Dispatched'}</button></footer>
        </section>
      </div>}
    </div>
  );
}

function DistrictCombobox({ value, districts: options, onChange }: { value: string; districts: string[]; onChange: (district: string) => void }) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [popoverTop, setPopoverTop] = useState(0);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const listboxId = 'awareness-district-options';
  const normalizedSearch = search.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
  const matches = options.filter((district) => district.toLocaleLowerCase().replace(/\s+/g, ' ').includes(normalizedSearch));
  const selectableDistricts = ['', ...matches];

  useEffect(() => {
    if (!isOpen) return;
    const frame = requestAnimationFrame(() => searchRef.current?.focus());
    const handleOutsidePointer = (event: PointerEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener('pointerdown', handleOutsidePointer);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', handleOutsidePointer);
    };
  }, [isOpen]);

  useEffect(() => {
    if (isOpen) document.getElementById(`${listboxId}-${highlightedIndex}`)?.scrollIntoView({ block: 'nearest' });
  }, [highlightedIndex, isOpen]);

  const open = () => {
    setSearch('');
    const triggerBounds = triggerRef.current?.getBoundingClientRect();
    setPopoverTop(triggerBounds ? triggerBounds.bottom + 6 : 12);
    const selectedIndex = value ? options.indexOf(value) : -1;
    setHighlightedIndex(selectedIndex >= 0 ? selectedIndex + 1 : 0);
    setIsOpen(true);
  };

  const close = (returnFocus = true) => {
    setIsOpen(false);
    setSearch('');
    if (returnFocus) requestAnimationFrame(() => triggerRef.current?.focus());
  };

  const select = (district: string) => {
    onChange(district);
    close();
  };

  const moveHighlight = (direction: -1 | 1) => {
    setHighlightedIndex((current) => Math.min(Math.max(current + direction, 0), selectableDistricts.length - 1));
  };

  const handleTriggerKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (!isOpen) open();
    }
  };

  const handleSearchKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      moveHighlight(1);
    } else if (event.key === 'ArrowUp') {
      event.preventDefault();
      moveHighlight(-1);
    } else if (event.key === 'Enter') {
      event.preventDefault();
      if (normalizedSearch && matches.length === 0) return;
      const district = selectableDistricts[highlightedIndex];
      if (district !== undefined) select(district);
    } else if (event.key === 'Escape') {
      event.preventDefault();
      close();
    } else if (event.key === 'Tab') {
      close(false);
    }
  };

  const handleSearchChange = (nextSearch: string) => {
    setSearch(nextSearch);
    const query = nextSearch.trim().toLocaleLowerCase().replace(/\s+/g, ' ');
    const matchingCount = options.filter((district) => district.toLocaleLowerCase().replace(/\s+/g, ' ').includes(query)).length;
    setHighlightedIndex(matchingCount > 0 ? 1 : 0);
  };

  return (
    <div className="awareness-combobox" ref={rootRef}>
      <button
        ref={triggerRef}
        type="button"
        className={`awareness-combobox-trigger${isOpen ? ' is-open' : ''}`}
        role={isOpen ? 'button' : 'combobox'}
        aria-label="Filter citizen reports by district"
        aria-expanded={isOpen}
        aria-controls={listboxId}
        aria-haspopup="listbox"
        onClick={() => isOpen ? close(false) : open()}
        onKeyDown={handleTriggerKeyDown}
      >
        <span>{value || 'All Districts'}</span>
        <ChevronDown size={16} aria-hidden="true" />
      </button>
      {isOpen && <div className="awareness-combobox-popover" style={{ '--awareness-popover-top': `${popoverTop}px` } as CSSProperties}>
        <div className="awareness-combobox-search">
          <Search size={15} aria-hidden="true" />
          <input
            ref={searchRef}
            type="search"
            value={search}
            placeholder="Search district..."
            aria-label="Search district"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded="true"
            aria-haspopup="listbox"
            aria-controls={listboxId}
            aria-activedescendant={`${listboxId}-${highlightedIndex}`}
            onChange={(event) => handleSearchChange(event.target.value)}
            onKeyDown={handleSearchKeyDown}
          />
        </div>
        <div className="awareness-combobox-list" id={listboxId} role="listbox" aria-label="Districts">
          <button
            type="button"
            id={`${listboxId}-0`}
            className={`awareness-combobox-option${highlightedIndex === 0 ? ' is-highlighted' : ''}${value === '' ? ' is-selected' : ''}`}
            role="option"
            aria-selected={value === ''}
            tabIndex={-1}
            onMouseEnter={() => setHighlightedIndex(0)}
            onClick={() => select('')}
          >
            <span>All Districts</span>{value === '' && <Check size={15} aria-hidden="true" />}
          </button>
          {matches.length > 0 ? matches.map((district, index) => {
            const optionIndex = index + 1;
            const selected = value === district;
            return <button
              type="button"
              id={`${listboxId}-${optionIndex}`}
              className={`awareness-combobox-option${highlightedIndex === optionIndex ? ' is-highlighted' : ''}${selected ? ' is-selected' : ''}`}
              role="option"
              aria-selected={selected}
              tabIndex={-1}
              key={`${district}-${index}`}
              onMouseEnter={() => setHighlightedIndex(optionIndex)}
              onClick={() => select(district)}
            >
              <span>{district}</span>{selected && <Check size={15} aria-hidden="true" />}
            </button>;
          }) : <div className="awareness-combobox-empty"><strong>No districts found</strong><span>Try a different district</span></div>}
        </div>
      </div>}
    </div>
  );
}

function SummaryCard({ icon: Icon, label, value, description, tone, active = false }: { icon: LucideIcon; label: string; value: number; description: string; tone: 'safe' | 'urgent' | 'family' | 'reports'; active?: boolean }) {
  return <article className={`awareness-summary-card tone-${tone}${active ? ' has-active' : ''}`}><span className="awareness-summary-icon"><Icon size={18} /></span><div className="awareness-summary-copy"><span className="awareness-summary-label">{label}</span><strong>{value.toLocaleString()}</strong><small>{description}</small></div>{active && <span className="awareness-urgent-mark" aria-label="Urgent requests are waiting" />}</article>;
}

function StatusBadge({ dispatched }: { dispatched: boolean }) {
  return dispatched ? <span className="awareness-status is-dispatched"><CheckCircle2 size={14} />Dispatched</span> : <span className="awareness-status is-pending"><Clock3 size={14} />Pending response</span>;
}