import { useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import Footer from '../components/Footer';
import FilterSidebar, { DEFAULT_FILTERS, type Filters } from '../components/FilterSidebar';
import Map from '../components/Map';
import FIMTable from '../components/FIMTable';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [visibleFeatures, setVisibleFeatures] = useState<any[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableHuc8s, setAvailableHuc8s] = useState<Set<string>>(new Set());
  const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

  const handleFeatureClick = (feature: any | null) => {
    setSelectedSiteId(feature?.site_id ?? null);
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <HeaderBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* Left sidebar */}
      <FilterSidebar
        filters={filters}
        setFilters={setFilters}
        onResetFilters={() => setFilters(DEFAULT_FILTERS)}
        availableStates={availableStates}
        availableHuc8s={availableHuc8s}
      />

      {/* Right: map on top, table on bottom */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ flex: '0 0 60%', minHeight: 0 }}>
          <Map
            filters={filters}
            onFeaturesChange={setVisibleFeatures}
            onFeatureClick={handleFeatureClick}
            onCatalogStates={setAvailableStates}
            onCatalogHuc8s={setAvailableHuc8s}
            selectedSiteId={selectedSiteId}
          />
        </div>

        <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
          <FIMTable
            features={visibleFeatures}
            selectedSiteId={selectedSiteId}
            onRowClick={setSelectedSiteId}
            onClearSelection={() => setSelectedSiteId(null)}
          />
        </div>

      </div>

      </div>

      <Footer />
    </div>
  );
}

export default App;