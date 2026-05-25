import React, { useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Filters } from '../src/types/filters';
import { isValidHuc8 } from '../src/types/catalog';
import { TIER_KEYS, TIER_LABELS } from '../src/utils/tierColors';
import { toggleInArray } from '../src/utils/toggle';

type FilterSidebarProps = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  onResetFilters: () => void;
  availableStates: string[];
  availableHuc8s: Set<string>;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
};

const TIER_OPTIONS = TIER_KEYS.map(k => ({ value: k, label: TIER_LABELS[k] }));

const TIER_DESCRIPTIONS: Record<string, string> = {
  Tier_1: 'Very high-resolution NOAA imagery (20–50 cm)',
  Tier_2: 'PlanetScope + hydrologically guided algorithm (3–5 m)',
  Tier_3: 'Sentinel-1A + gap-filled algorithm (10 m)',
  Tier_4: 'FEMA Base Level Engineering synthetic events (10 m)',
  HWM:    'FIMs derived using USGS high watermarks',
};

const TIER_COLORS: Record<string, string> = {
  Tier_1: '#E74C3C',
  Tier_2: '#F39C12',
  Tier_3: '#2ECC71',
  Tier_4: '#9B59B6',
  HWM:    '#EC6FA3',
};

// Small "i" badge + custom hover/tap tooltip. Portal'd to document.body so it
// escapes the sidebar's scroll container.
function InfoBadge({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const updatePos = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }
  };

  return (
    <>
      <span
        ref={ref}
        aria-label={description}
        onMouseEnter={() => { updatePos(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); updatePos(); setOpen(prev => !prev); }}
        style={infoBadgeStyle}
      >
        <svg width="0.75rem" height="0.75rem" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: 'block' }}>
          <path d="M9 10C9 9.44772 9.44772 9 10 9C10.5523 9 11 9.44772 11 10V14C11 14.5523 10.5523 15 10 15C9.44772 15 9 14.5523 9 14V10Z" fill="currentColor" />
          <circle cx="10" cy="7" r="1" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10ZM16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10Z" fill="currentColor" />
        </svg>
      </span>
      {open && createPortal(
        <div
          className="tier-info-tooltip"
          style={{ ...tooltipStyle, top: pos.top, left: pos.left }}
          role="tooltip"
        >
          {description}
        </div>,
        document.body
      )}
    </>
  );
}

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

export default function FilterSidebar({ filters, setFilters, onResetFilters, availableStates, availableHuc8s, isOpen, onClose, isMobile }: FilterSidebarProps) {
  const [stateDropdownOpen, setStateDropdownOpen] = useState(false);

  const handleTierToggle = (value: string) => {
    setFilters({ ...filters, tiers: toggleInArray(filters.tiers, value) });
  };

  const handleHuc8Change = (e: React.ChangeEvent<HTMLInputElement>) => {
    // Strip whitespace but keep as a string (HUC8 leading zeros are significant).
    setFilters({ ...filters, huc8Id: e.target.value.trim() });
  };

  const handleStateToggle = (value: string) => {
    setFilters({ ...filters, states: toggleInArray(filters.states, value) });
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

  const huc8 = filters.huc8Id;
  const huc8Empty = huc8 === '';
  const huc8FormatOk = isValidHuc8(huc8);
  const huc8InCatalog = huc8FormatOk && availableHuc8s.has(huc8);
  const tier4Selected = filters.tiers.includes('Tier_4');
  const onlyTier4 = filters.tiers.length === 1 && filters.tiers[0] === 'Tier_4';

  return (
    <div className={`filter-sidebar${isOpen ? ' filter-sidebar--open' : ''}`} style={{ width: '15.625rem', padding: '1.25rem 1rem 1.5rem', backgroundImage: 'url(/static/fimbench_gui/images/FilterSidebar.png)', backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff' }}>

      {/* ── Header ── */}
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', paddingBottom: '0.875rem', marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <img src="/static/fimbench_gui/images/funnel-svgrepo-com.svg" alt="" style={{ width: '1.125rem', height: '1.125rem', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
        Filters
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close filters"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1.125rem', padding: '0.125rem 0.25rem', lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </h2>

      {/* ── Tier (custom rows) ── */}
      <div style={sectionStyle}>
        <div style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/steps-svgrepo-com.svg" alt="" style={iconStyle} />
          FIM Tier
        </div>
        <div>
          {TIER_OPTIONS.map(({ value, label }) => {
            const selected = filters.tiers.includes(value);
            return (
              <div
                key={value}
                className={`filter-tier-row${selected ? ' filter-tier-row--selected' : ''}`}
                onClick={() => handleTierToggle(value)}
                style={selected ? { borderLeftColor: TIER_COLORS[value] } : {}}
                role="checkbox"
                aria-checked={selected}
                tabIndex={0}
                onKeyDown={(e) => { if (e.key === ' ') { e.preventDefault(); handleTierToggle(value); } }}
              >
                <div className="filter-tier-check">
                  {selected && <span className="filter-tier-checkmark" />}
                </div>
                <span style={{ flex: 1 }}>{label}</span>
                <InfoBadge description={TIER_DESCRIPTIONS[value]} />
              </div>
            );
          })}
        </div>
      </div>

      {/* ── HUC8 ID ── */}
      <div style={sectionStyle}>
        <label htmlFor="huc8Id" style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/id-svgrepo-com.svg" alt="" style={iconStyle} />
          HUC8 ID
        </label>
        <input
          id="huc8Id"
          type="text"
          value={filters.huc8Id}
          onChange={handleHuc8Change}
          placeholder="e.g. 12100201"
          className="filter-glass-input"
        />
        {!huc8Empty && !huc8FormatOk && (
          <span style={errorHintStyle}>HUC8 must be 8 digits</span>
        )}
        {huc8FormatOk && !huc8InCatalog && (
          <span style={errorHintStyle}>No records match this HUC8</span>
        )}
        {huc8FormatOk && huc8InCatalog && (
          <span style={infoHintStyle}>State &amp; date filters are inactive while HUC8 is set</span>
        )}
      </div>

      {/* ── State (dropdown multi-select) ── */}
      <div style={{ ...sectionStyle, opacity: huc8FormatOk ? 0.4 : 1, position: 'relative' }}>
        <div style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/map-location-pin-svgrepo-com.svg" alt="" style={iconStyle} />
          State
        </div>
        <button
          type="button"
          disabled={huc8FormatOk}
          onClick={() => setStateDropdownOpen(prev => !prev)}
          className="filter-glass-btn"
        >
          <span>
            {filters.states.length === 0
              ? 'All states'
              : filters.states.length <= 3
                ? filters.states.join(', ')
                : `${filters.states.length} states selected`}
          </span>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.6)" strokeWidth="2.5">
            <polyline points={stateDropdownOpen ? '18 15 12 9 6 15' : '6 9 12 15 18 9'} />
          </svg>
        </button>
        {stateDropdownOpen && !huc8FormatOk && (
          <div style={{
            position: 'absolute', zIndex: 10, left: 0, right: 0, marginTop: '0.125rem',
            maxHeight: '12.5rem', overflowY: 'auto',
            border: '0.0625rem solid #bbb', borderRadius: '0.5rem', backgroundColor: '#fff',
            boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.25)',
          }}>
            {availableStates.map(st => (
              <label
                key={st}
                style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.25rem 0.5rem', cursor: 'pointer', fontSize: '0.8125rem', color: '#222' }}
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

      {/* ── Start Date ── */}
      <div style={{ ...sectionStyle, opacity: onlyTier4 ? 0.4 : 1 }}>
        <label htmlFor="startDate" style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/play-button-o-svgrepo-com.svg" alt="" style={iconStyle} />
          Start Date
        </label>
        <input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={handleStartDateChange}
          disabled={onlyTier4}
          className="filter-glass-input"
        />
      </div>

      {/* ── End Date ── */}
      <div style={{ ...sectionStyle, opacity: onlyTier4 ? 0.4 : 1 }}>
        <label htmlFor="endDate" style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/stop-button-svgrepo-com.svg" alt="" style={iconStyle} />
          End Date
        </label>
        <input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={handleEndDateChange}
          disabled={onlyTier4}
          className="filter-glass-input"
        />
        {onlyTier4 && (
          <span style={infoHintStyle}>Tier 4 is synthetic — no observation date</span>
        )}
      </div>

      {/* ── Return Period ── */}
      <div style={{ padding: '0.75rem 0', opacity: tier4Selected ? 1 : 0.4 }}>
        <label htmlFor="returnPeriod" style={sectionLabelStyle}>
          <img src="/static/fimbench_gui/images/hourglass-svgrepo-com.svg" alt="" style={iconStyle} />
          Return Period
        </label>
        <select
          id="returnPeriod"
          value={filters.returnPeriod}
          onChange={handleReturnPeriodChange}
          disabled={!tier4Selected}
          className="filter-glass-select"
        >
          <option value="100">100-year</option>
          <option value="500">500-year</option>
        </select>
        <span style={infoHintStyle}>Only applies to Tier 4 (BLE)</span>
      </div>

      {/* ── Actions ── */}
      <div style={{ marginTop: '0.75rem' }}>
        <button onClick={onResetFilters} className="filter-reset-btn" style={{ color: '#222', backgroundColor: '#f0f0f0' }}>
          ↺&nbsp;&nbsp;Reset Filters
        </button>
      </div>

    </div>
  );
}

const iconStyle: React.CSSProperties = {
  width: '0.875rem',
  height: '0.875rem',
  filter: 'brightness(0) invert(1)',
  flexShrink: 0,
};

const sectionStyle: React.CSSProperties = {
  padding: '0.75rem 0',
  borderBottom: '1px solid rgba(255,255,255,0.1)',
};

const sectionLabelStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.4rem',
  fontSize: '0.75rem',
  fontWeight: 600,
  letterSpacing: '0.04em',
  textTransform: 'uppercase',
  color: 'rgba(255,255,255,0.9)',
  marginBottom: '0.5rem',
};

const infoHintStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: 'rgba(255,255,255,0.55)',
  marginTop: '0.25rem',
  display: 'block',
};

const errorHintStyle: React.CSSProperties = {
  fontSize: '0.6875rem',
  color: '#ff8080',
  marginTop: '0.25rem',
  display: 'block',
};

const infoBadgeStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  opacity: 0.5,
  cursor: 'pointer',
  flexShrink: 0,
};

const tooltipStyle: React.CSSProperties = {
  position: 'fixed',
  zIndex: 10000,
  background: '#ffffff',
  color: '#222',
  padding: '0.5rem 0.625rem',
  borderRadius: '0.375rem',
  boxShadow: '0 0.25rem 0.75rem rgba(0,0,0,0.2)',
  fontSize: '0.75rem',
  lineHeight: 1.45,
  maxWidth: '16.25rem',
  pointerEvents: 'none',
  transform: 'translateY(-50%)',
};
