import React from 'react';

export type Filters = {
  tier: string;
  returnPeriod: string;
  startDate: string; // ISO format YYYY-MM-DD
  endDate: string;
};

type FilterSidebarProps = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
};

export default function FilterSidebar({ filters, setFilters }: FilterSidebarProps) {
  const handleTierChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setFilters({ ...filters, tier: e.target.value });
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
    <div style={{ width: 250, padding: 16, backgroundColor: '#f2f2f2' }}>
      <h2>Filters</h2>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="tier">FIM Tier:</label>
        <select id="tier" value={filters.tier} onChange={handleTierChange}>
          <option value="tier1">Tier 1</option>
          <option value="tier2">Tier 2</option>
          <option value="tier3">Tier 3</option>
          <option value="tier4">Tier 4</option>
          <option value="hwm">High Water Mark</option>
        </select>
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="startDate">Start Date:</label>
        <input
          id="startDate"
          type="date"
          value={filters.startDate}
          onChange={handleStartDateChange}
        />
      </div>

      <div>
        <label htmlFor="endDate">End Date:</label>
        <input
          id="endDate"
          type="date"
          value={filters.endDate}
          onChange={handleEndDateChange}
        />
      </div>

      <div style={{ marginBottom: 12 }}>
        <label htmlFor="returnPeriod">Return Period:</label>
        <select id="returnPeriod" value={filters.returnPeriod} onChange={handleReturnPeriodChange}>
          <option value="100">100-year</option>
          <option value="500">500-year</option>
        </select>
      </div>
    </div>
  );
}