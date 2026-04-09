import { useState } from 'react';
import FilterSidebar, { type Filters } from '../components/FilterSidebar';
import Map from '../components/Map';
import FIMTable from '../components/FIMTable';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>({
    tiers: ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'],
    returnPeriod: '100',
    startDate: '2016-01-03',
    endDate: '2025-07-04',
  });

  const [visibleFeatures, setVisibleFeatures] = useState<any[]>([]);

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden' }}>

      {/* Left sidebar */}
      <FilterSidebar filters={filters} setFilters={setFilters} />

      {/* Right: map on top, table on bottom */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ flex: '0 0 60%', minHeight: 0 }}>
          <Map
            filters={filters}
            onFeaturesChange={setVisibleFeatures}
          />
        </div>

        <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
          <FIMTable features={visibleFeatures} />
        </div>

      </div>
    </div>
  );
}

export default App;