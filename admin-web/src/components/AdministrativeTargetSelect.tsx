import { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, X, Search, Check, ChevronDown, CheckSquare, Square, MinusSquare } from 'lucide-react';
import { INDIA_STATES, getDistrictsForStates, getAllDistrictsForState } from '../data/indiaStates';

interface Props {
  selectedStates: string[];
  selectedDistricts: string[];
  onStatesChange: (states: string[]) => void;
  onDistrictsChange: (districts: string[]) => void;
}

export default function AdministrativeTargetSelect({
  selectedStates,
  selectedDistricts,
  onStatesChange,
  onDistrictsChange,
}: Props) {
  // ── State Multi-Select dropdown state ─────────────────────────────────────────
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);
  const [stateSearch, setStateSearch] = useState('');
  const stateDropdownRef = useRef<HTMLDivElement>(null);
  const stateSearchInputRef = useRef<HTMLInputElement>(null);

  // ── District Multi-Select dropdown state ──────────────────────────────────────
  const [districtDropdownOpen, setDistrictDropdownOpen] = useState(false);
  const [districtSearch, setDistrictSearch] = useState('');
  const districtDropdownRef = useRef<HTMLDivElement>(null);
  const districtSearchInputRef = useRef<HTMLInputElement>(null);

  // Close dropdowns on outside click
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (stateDropdownRef.current && !stateDropdownRef.current.contains(event.target as Node)) {
        setStateDropdownOpen(false);
      }
      if (districtDropdownRef.current && !districtDropdownRef.current.contains(event.target as Node)) {
        setDistrictDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Focus search inputs on dropdown open
  useEffect(() => {
    if (stateDropdownOpen) {
      setTimeout(() => stateSearchInputRef.current?.focus(), 50);
    } else {
      setStateSearch('');
    }
  }, [stateDropdownOpen]);

  useEffect(() => {
    if (districtDropdownOpen) {
      setTimeout(() => districtSearchInputRef.current?.focus(), 50);
    } else {
      setDistrictSearch('');
    }
  }, [districtDropdownOpen]);

  // Filter available states
  const filteredStates = useMemo(() => {
    const q = stateSearch.trim().toLowerCase();
    if (!q) return INDIA_STATES;
    return INDIA_STATES.filter((s) => s.name.toLowerCase().includes(q));
  }, [stateSearch]);

  // Grouped districts for selected states
  const groupedDistricts = useMemo(() => {
    return getDistrictsForStates(selectedStates);
  }, [selectedStates]);

  // Filtered grouped districts by search
  const filteredGroupedDistricts = useMemo(() => {
    const q = districtSearch.trim().toLowerCase();
    if (!q) return groupedDistricts;
    return groupedDistricts
      .map((g) => ({
        state: g.state,
        districts: g.districts.filter((d) => d.toLowerCase().includes(q)),
      }))
      .filter((g) => g.districts.length > 0);
  }, [groupedDistricts, districtSearch]);

  // ── Handlers: States ────────────────────────────────────────────────────────
  const toggleState = (stateName: string) => {
    if (selectedStates.includes(stateName)) {
      removeState(stateName);
    } else {
      const nextStates = [...selectedStates, stateName];
      onStatesChange(nextStates);
    }
  };

  const removeState = (stateName: string) => {
    const nextStates = selectedStates.filter((s) => s !== stateName);
    onStatesChange(nextStates);

    // Remove districts belonging to this removed state
    const stateDistricts = getAllDistrictsForState(stateName);
    const nextDistricts = selectedDistricts.filter((d) => !stateDistricts.includes(d));
    onDistrictsChange(nextDistricts);
  };

  // ── Handlers: Districts ─────────────────────────────────────────────────────
  const toggleDistrict = (districtName: string) => {
    if (selectedDistricts.includes(districtName)) {
      onDistrictsChange(selectedDistricts.filter((d) => d !== districtName));
    } else {
      onDistrictsChange([...selectedDistricts, districtName]);
    }
  };

  const removeDistrict = (districtName: string) => {
    onDistrictsChange(selectedDistricts.filter((d) => d !== districtName));
  };

  const handleSelectAllDistrictsInState = (stateName: string) => {
    const stateDistricts = getAllDistrictsForState(stateName);
    const allSelected = stateDistricts.every((d) => selectedDistricts.includes(d));

    if (allSelected) {
      // Deselect all districts in this state
      onDistrictsChange(selectedDistricts.filter((d) => !stateDistricts.includes(d)));
    } else {
      // Add missing districts from this state
      const toAdd = stateDistricts.filter((d) => !selectedDistricts.includes(d));
      onDistrictsChange([...selectedDistricts, ...toAdd]);
    }
  };

  // ── Summary computation ─────────────────────────────────────────────────────
  const summaryText = useMemo(() => {
    const sCount = selectedStates.length;
    const dCount = selectedDistricts.length;

    if (sCount === 0) return 'No administrative regions targeted yet';

    // Check states where all districts are selected
    const allDistrictsStates: string[] = [];
    selectedStates.forEach((s) => {
      const allD = getAllDistrictsForState(s);
      if (allD.length > 0 && allD.every((d) => selectedDistricts.includes(d))) {
        allDistrictsStates.push(s);
      }
    });

    const stateStr = `${sCount} ${sCount === 1 ? 'state' : 'states'} selected`;

    if (allDistrictsStates.length === sCount && sCount > 0) {
      return `${stateStr} · All districts selected in ${sCount === 1 ? allDistrictsStates[0] : `all ${sCount} states`} (${dCount} total)`;
    }

    if (allDistrictsStates.length > 0) {
      return `${stateStr} · All districts in ${allDistrictsStates.length === 1 ? allDistrictsStates[0] : `${allDistrictsStates.length} states`} (${dCount} districts selected)`;
    }

    return `${stateStr} · ${dCount} ${dCount === 1 ? 'district' : 'districts'} selected`;
  }, [selectedStates, selectedDistricts]);

  return (
    <div className="admin-target-container">
      {/* ── 1. TARGET STATES MULTI-SELECT ─────────────────────────────────── */}
      <div className="new-event-field-card admin-target-field-card">
        <div className="admin-target-header-row">
          <label className="form-label" id="label-target-states">
            TARGET STATES <span className="text-danger">*</span>
          </label>
          <span className="admin-target-counter">
            {selectedStates.length} {selectedStates.length === 1 ? 'State' : 'States'} Selected
          </span>
        </div>

        <div className="admin-chips-input-box" aria-labelledby="label-target-states">
          <div className="admin-chips-wrap">
            {selectedStates.map((st) => (
              <span key={st} className="admin-chip admin-chip--state">
                <span className="admin-chip-label">{st}</span>
                <button
                  type="button"
                  className="admin-chip-remove"
                  onClick={() => removeState(st)}
                  aria-label={`Remove state ${st}`}
                  title={`Remove ${st}`}
                >
                  <X size={13} />
                </button>
              </span>
            ))}

            {/* Dropdown Toggle Button */}
            <div className="admin-dropdown-anchor" ref={stateDropdownRef}>
              <button
                type="button"
                className={`admin-add-btn ${stateDropdownOpen ? 'active' : ''}`}
                onClick={() => setStateDropdownOpen((prev) => !prev)}
                aria-expanded={stateDropdownOpen}
                aria-haspopup="listbox"
              >
                <Plus size={13} />
                <span>Select State</span>
                <ChevronDown size={12} className={`admin-chevron ${stateDropdownOpen ? 'rotated' : ''}`} />
              </button>

              {/* State Searchable Dropdown Popup */}
              {stateDropdownOpen && (
                <div className="admin-dropdown-menu" role="listbox">
                  <div className="admin-dropdown-search-wrap">
                    <Search size={14} className="admin-search-icon" />
                    <input
                      ref={stateSearchInputRef}
                      type="text"
                      className="admin-dropdown-search-input"
                      placeholder="Search state / UT…"
                      value={stateSearch}
                      onChange={(e) => setStateSearch(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setStateDropdownOpen(false);
                      }}
                    />
                    {stateSearch && (
                      <button
                        type="button"
                        className="admin-search-clear"
                        onClick={() => setStateSearch('')}
                        aria-label="Clear search"
                      >
                        <X size={12} />
                      </button>
                    )}
                  </div>

                  <div className="admin-dropdown-list">
                    {filteredStates.length === 0 ? (
                      <div className="admin-dropdown-empty">No states matching "{stateSearch}"</div>
                    ) : (
                      filteredStates.map((item) => {
                        const isSelected = selectedStates.includes(item.name);
                        return (
                          <div
                            key={item.name}
                            className={`admin-dropdown-item ${isSelected ? 'selected' : ''}`}
                            onClick={() => toggleState(item.name)}
                            role="option"
                            aria-selected={isSelected}
                          >
                            <div className="admin-checkbox-custom">
                              {isSelected && <Check size={12} strokeWidth={3} />}
                            </div>
                            <span className="admin-item-title">{item.name}</span>
                            <span className="admin-item-sub">{item.districts.length} districts</span>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── 2. TARGET DISTRICTS MULTI-SELECT ──────────────────────────────── */}
      <div className="new-event-field-card admin-target-field-card">
        <div className="admin-target-header-row">
          <label className="form-label" id="label-target-districts">
            TARGET DISTRICTS <span className="text-danger">*</span>
          </label>
          <span className="admin-target-counter">
            {selectedDistricts.length} {selectedDistricts.length === 1 ? 'District' : 'Districts'} Selected
          </span>
        </div>

        {selectedStates.length === 0 ? (
          <div className="admin-empty-district-banner">
            <span>Select a state first to choose districts.</span>
          </div>
        ) : (
          <div className="admin-chips-input-box" aria-labelledby="label-target-districts">
            <div className="admin-chips-wrap">
              {selectedDistricts.map((d) => (
                <span key={d} className="admin-chip admin-chip--district">
                  <span className="admin-chip-label">{d}</span>
                  <button
                    type="button"
                    className="admin-chip-remove"
                    onClick={() => removeDistrict(d)}
                    aria-label={`Remove district ${d}`}
                    title={`Remove ${d}`}
                  >
                    <X size={13} />
                  </button>
                </span>
              ))}

              {/* District Dropdown Toggle Button */}
              <div className="admin-dropdown-anchor" ref={districtDropdownRef}>
                <button
                  type="button"
                  className={`admin-add-btn ${districtDropdownOpen ? 'active' : ''}`}
                  onClick={() => setDistrictDropdownOpen((prev) => !prev)}
                  aria-expanded={districtDropdownOpen}
                  aria-haspopup="listbox"
                >
                  <Plus size={13} />
                  <span>Select District</span>
                  <ChevronDown size={12} className={`admin-chevron ${districtDropdownOpen ? 'rotated' : ''}`} />
                </button>

                {/* District Grouped Searchable Dropdown */}
                {districtDropdownOpen && (
                  <div className="admin-dropdown-menu admin-dropdown-menu--districts" role="listbox">
                    <div className="admin-dropdown-search-wrap">
                      <Search size={14} className="admin-search-icon" />
                      <input
                        ref={districtSearchInputRef}
                        type="text"
                        className="admin-dropdown-search-input"
                        placeholder="Search district across selected states…"
                        value={districtSearch}
                        onChange={(e) => setDistrictSearch(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Escape') setDistrictDropdownOpen(false);
                        }}
                      />
                      {districtSearch && (
                        <button
                          type="button"
                          className="admin-search-clear"
                          onClick={() => setDistrictSearch('')}
                          aria-label="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="admin-dropdown-list admin-district-groups-list">
                      {filteredGroupedDistricts.length === 0 ? (
                        <div className="admin-dropdown-empty">
                          {districtSearch ? `No districts matching "${districtSearch}"` : 'No districts available'}
                        </div>
                      ) : (
                        filteredGroupedDistricts.map((group) => {
                          const stateDistricts = getAllDistrictsForState(group.state);
                          const stateSelectedCount = stateDistricts.filter((d) => selectedDistricts.includes(d)).length;
                          const isAllInStateSelected = stateDistricts.length > 0 && stateSelectedCount === stateDistricts.length;
                          const isPartiallySelected = stateSelectedCount > 0 && !isAllInStateSelected;

                          return (
                            <div key={group.state} className="admin-district-group">
                              {/* Group Header */}
                              <div className="admin-district-group-header">
                                <div className="admin-group-state-title">
                                  <strong>{group.state}</strong>
                                  <span className="admin-group-count">
                                    ({stateSelectedCount}/{stateDistricts.length})
                                  </span>
                                </div>
                                <button
                                  type="button"
                                  className={`admin-select-all-btn ${isAllInStateSelected ? 'all-selected' : ''}`}
                                  onClick={() => handleSelectAllDistrictsInState(group.state)}
                                >
                                  {isAllInStateSelected ? (
                                    <>
                                      <CheckSquare size={13} />
                                      <span>✓ All districts</span>
                                    </>
                                  ) : isPartiallySelected ? (
                                    <>
                                      <MinusSquare size={13} />
                                      <span>Select All</span>
                                    </>
                                  ) : (
                                    <>
                                      <Square size={13} />
                                      <span>Select All</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Districts Grid */}
                              <div className="admin-district-items-grid">
                                {group.districts.map((districtName) => {
                                  const isSelected = selectedDistricts.includes(districtName);
                                  return (
                                    <div
                                      key={districtName}
                                      className={`admin-district-item ${isSelected ? 'selected' : ''}`}
                                      onClick={() => toggleDistrict(districtName)}
                                      role="option"
                                      aria-selected={isSelected}
                                    >
                                      <div className="admin-checkbox-custom">
                                        {isSelected && <Check size={11} strokeWidth={3} />}
                                      </div>
                                      <span className="admin-district-name">{districtName}</span>
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── 3. SUMMARY BADGE / BAR ───────────────────────────────────────── */}
      <div className="admin-target-summary-bar" aria-live="polite">
        <span className="admin-summary-dot" />
        <span className="admin-summary-text">{summaryText}</span>
      </div>
    </div>
  );
}
