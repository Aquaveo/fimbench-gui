import React, { useState } from 'react';

export type Filters = {
  tiers: string[];
  states: string[];     // multi-select; empty = all states
  huc8Id: string;       // direct input; empty = no HUC8 filter
  returnPeriod: string;
  startDate: string;
  endDate: string;
};

type FilterSidebarProps = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  onResetFilters: () => void;
  availableStates: string[];
  availableHuc8s: Set<string>;
};

// HUC8 codes are strings — leading zeros are significant, never parse as numbers.
const isValidHuc8 = (s: string): boolean => /^\d{8}$/.test(s);

export const DEFAULT_FILTERS: Filters = {
  tiers: ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'],
  states: [],
  huc8Id: '',
  returnPeriod: '100',
  startDate: '2016-01-03',
  endDate: '2025-07-04',
};

const TIER_OPTIONS = [
  { value: 'Tier_1', label: 'Tier 1' },
  { value: 'Tier_2', label: 'Tier 2' },
  { value: 'Tier_3', label: 'Tier 3' },
  { value: 'Tier_4', label: 'Tier 4' },
  { value: 'HWM',    label: 'High Water Mark' },
];

const STATE_NAMES: Record<string, string> = {
  AL: 'Alabama', AK: 'Alaska', AZ: 'Arizona', AR: 'Arkansas', CA: 'California',
  CO: 'Colorado', CT: 'Connecticut', DE: 'Delaware', FL: 'Florida', GA: 'Georgia',
  HI: 'Hawaii', ID: 'Idaho', IL: 'Illinois', IN: 'Indiana', IA: 'Iowa',
  KS: 'Kansas', KY: 'Kentucky', LA: 'Louisiana', ME: 'Maine', MD: 'Maryland',
  MA: 'Massachusetts', MI: 'Michigan', MN: 'Minnesota', MS: 'Mississippi', MO: 'Missouri',
  MT: 'Montana', NE: 'Nebraska', NV: 'Nevada', NH: 'New Hampshire', NJ: 'New Jersey',
  NM: 'New Mexico', NY: 'New York', NC: 'North Carolina', ND: 'North Dakota', OH: 'Ohio',
  OK: 'Oklahoma', OR: 'Oregon', PA: 'Pennsylvania', RI: 'Rhode Island', SC: 'South Carolina',
  SD: 'South Dakota', TN: 'Tennessee', TX: 'Texas', UT: 'Utah', VT: 'Vermont',
  VA: 'Virginia', WA: 'Washington', WV: 'West Virginia', WI: 'Wisconsin', WY: 'Wyoming',
  DC: 'District of Columbia', PR: 'Puerto Rico', VI: 'Virgin Islands', GU: 'Guam',
  AS: 'American Samoa', MP: 'Northern Mariana Islands',
};

const stateLabel = (abbr: string) => {
  const name = STATE_NAMES[abbr];
  return name ? `${name} (${abbr})` : abbr;
};

// Add (or subtract, with negative n) whole days to a YYYY-MM-DD string.
// Operates in UTC to avoid any timezone-induced off-by-one.
const addDays = (ymd: string, n: number): string => {
  const d = new Date(`${ymd}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export default function FilterSidebar({ filters, setFilters, onResetFilters, availableStates, availableHuc8s }: FilterSidebarProps) {
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  const handleTierToggle = (value: string) => {
    const already = filters.tiers.includes(value);
    const updated = already
      ? filters.tiers.filter(t => t !== value)
      : [...filters.tiers, value];
    setFilters({ ...filters, tiers: updated });
  };

  const handleHuc8Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip whitespace but keep as a string (HUC8 leading zeros are significant).
    setFilters({ ...filters, huc8Id: e.target.value.trim() });
  };

  const handleStateToggle = (value: string) => {
    const already = filters.states.includes(value);
    const updated = already
      ? filters.states.filter(s => s !== value)
      : [...filters.states, value];
    setFilters({ ...filters, states: updated });
  };

  const handleReturnPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, returnPeriod: e.target.value });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newStart = e.target.value;
    const next = { ...filters, startDate: newStart };
    // Keep end at least one day after start
    if (newStart && filters.endDate && newStart >= filters.endDate) {
      next.endDate = addDays(newStart, 1);
    }
    setFilters(next);
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newEnd = e.target.value;
    const next = { ...filters, endDate: newEnd };
    // Keep start at least one day before end
    if (newEnd && filters.startDate && newEnd <= filters.startDate) {
      next.startDate = addDays(newEnd, -1);
    }
    setFilters(next);
  };

  // HUC8 feedback state for inline messages below the input
  const huc8 = filters.huc8Id;
  const huc8Empty = huc8 === '';
  const huc8FormatOk = isValidHuc8(huc8);
  const huc8InCatalog = huc8FormatOk && availableHuc8s.has(huc8);

  return (
    <div style={{ width: 250, padding: 16, backgroundColor: '#f2f2f2', overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
      <h2>Filters</h2>

      {/* ── Tier (multi-select checkboxes) ── */}
      <div style={{ marginBottom: 12 }}>
        <label style={{ fontWeight: 600 }}>FIM Tier:</label>
        <div style={{ marginTop: 6, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {TIER_OPTIONS.map(({ value, label }) => (
            <label key={value} style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={filters.tiers.includes(value)}
                onChange={() => handleTierToggle(value)}
              />
              {label}
            </label>
          ))}
        </div>
      </div>

      {/* ── HUC8 ID ── */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="huc8Id" style={{ fontWeight: 600 }}>HUC8 ID:</label>
        <input
          id="huc8Id"
          type="text"
          value={filters.huc8Id}
          onChange={handleHuc8Change}
          placeholder="e.g. 12100201"
          style={{ display: 'block', marginTop: 4, fontFamily: 'inherit', width: '100%', boxSizing: 'border-box' }}
        />
        {!huc8Empty && !huc8FormatOk && (
          <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
            HUC8 must be 8 digits
          </span>
        )}
        {huc8FormatOk && !huc8InCatalog && (
          <span style={{ fontSize: 11, color: '#c0392b', marginTop: 3, display: 'block' }}>
            No records match this HUC8
          </span>
        )}
        {huc8FormatOk && huc8InCatalog && (
          <span style={{ fontSize: 11, color: '#666', marginTop: 3, display: 'block' }}>
            State &amp; date filters are inactive while HUC8 is set
          </span>
        )}
      </div>

      {/* ── State (dropdown multi-select) ── */}
      <div style={{ marginBottom: 12, opacity: huc8FormatOk ? 0.4 : 1, position: 'relative' }}>
        <label style={{ fontWeight: 600 }}>State:</label>
        <button
          type="button"
          disabled={huc8FormatOk}
          onClick={() => setStateDropdownOpen(prev => !prev)}
          style={{
            display: 'block', width: '100%', marginTop: 4, padding: '5px 8px',
            fontFamily: 'inherit', fontSize: 13, textAlign: 'left',
            border: '1px solid #bbb', borderRadius: 4, backgroundColor: '#fff',
            cursor: huc8FormatOk ? 'default' : 'pointer', boxSizing: 'border-box',
          }}
        >
          {filters.states.length === 0
            ? 'All states'
            : filters.states.length <= 3
              ? filters.states.map(s => s).join(', ')
              : `${filters.states.length} states selected`}
          <span style={{ float: 'right' }}>{stateDropdownOpen ? '\u25B2' : '\u25BC'}</span>
        </button>
        {stateDropdownOpen && !huc8FormatOk && (
          <div style={{
            position: 'absolute', zIndex: 10, left: 0, right: 0, marginTop: 2,
            maxHeight: 200, overflowY: 'auto',
            border: '1px solid #bbb', borderRadius: 4, backgroundColor: '#fff',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}>
            {availableStates.map(st => (
              <label
                key={st}
                style={{
                  display: 'flex', alignItems: 'center', gap: 8,
                  padding: '4px 8px', cursor: 'pointer', fontSize: 13,
                }}
              >
                <input
                  type="checkbox"
                  checked={filters.states.includes(st)}
                  onChange={() => handleStateToggle(st)}
                />
                {stateLabel(st)}
              </label>
            ))}
          </div>
        )}
      </div>

      {/* ── Date range ── */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="startDate">Start Date:</label>
        <input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={handleStartDateChange}
          style={{ display: 'block', marginTop: 4, fontFamily: 'inherit' }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="endDate">End Date:</label>
        <input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={handleEndDateChange}
          style={{ display: 'block', marginTop: 4, fontFamily: 'inherit' }}
        />
      </div>

      {/* ── Return Period ── */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="returnPeriod">Return Period:</label>
        <select
          id="returnPeriod"
          value={filters.returnPeriod}
          onChange={handleReturnPeriodChange}
          style={{ display: 'block', marginTop: 4, fontFamily: 'inherit' }}
        >
          <option value="100">100-year</option>
          <option value="500">500-year</option>
        </select>
      </div>

      {/* ── Actions ── */}
      <div style={{ marginTop: 16 }}>
        <button onClick={onResetFilters} style={btnStyle}>
          Reset Filters
        </button>
      </div>

    </div>
  );
}

const btnStyle: React.CSSProperties = {
  padding: '6px 10px',
  fontSize: 13,
  fontFamily: 'inherit',
  cursor: 'pointer',
  border: '1px solid #bbb',
  borderRadius: 4,
  backgroundColor: '#fff',
};

