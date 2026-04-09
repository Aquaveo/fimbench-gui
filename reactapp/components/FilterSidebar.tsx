import React from 'react';

export type Filters = {
  tiers: string[];
  returnPeriod: string;
  startDate: string;
  endDate: string;
};

type FilterSidebarProps = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
};

const TIER_OPTIONS = [
  { value: 'Tier_1', label: 'Tier 1' },
  { value: 'Tier_2', label: 'Tier 2' },
  { value: 'Tier_3', label: 'Tier 3' },
  { value: 'Tier_4', label: 'Tier 4' },
  { value: 'HWM',    label: 'High Water Mark' },
];

export default function FilterSidebar({ filters, setFilters }: FilterSidebarProps) {

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
          style={{ display: 'block', marginTop: 4 }}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="endDate">End Date:</label>
        <input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={handleEndDateChange}
          style={{ display: 'block', marginTop: 4 }}
        />
      </div>

      {/* ── Return Period ── */}
      <div style={{ marginBottom: 12 }}>
        <label htmlFor="returnPeriod">Return Period:</label>
        <select
          id="returnPeriod"
          value={filters.returnPeriod}
          onChange={handleReturnPeriodChange}
          style={{ display: 'block', marginTop: 4 }}
        >
          <option value="100">100-year</option>
          <option value="500">500-year</option>
        </select>
      </div>
    </div>
  );
}