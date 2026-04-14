import React from 'react';

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
};

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

export default function FilterSidebar({ filters, setFilters, onResetFilters }: FilterSidebarProps) {

  const handleTierToggle = (value: string) => {
    const already = filters.tiers.includes(value);
    const updated = already
      ? filters.tiers.filter(t => t !== value)
      : [...filters.tiers, value];
    setFilters({ ...filters, tiers: updated });
  };

  const handleReturnPeriodChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, returnPeriod: e.target.value });
  };

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, startDate: e.target.value });
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFilters({ ...filters, endDate: e.target.value });
  };

  return (
    <div style={{ width: 250, padding: 16, backgroundColor: '#f2f2f2', overflowY: 'auto' }}>
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