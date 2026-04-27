import { useCallback, useRef, useState } from 'react';
import HeaderBar from '../components/HeaderBar';
import Footer from '../components/Footer';
import FilterSidebar from '../components/FilterSidebar';
import { DEFAULT_FILTERS, type Filters } from './types/filters';
import Map, { type MapHandle, type CatalogDateBounds } from '../components/Map';
import FIMTable from '../components/FIMTable';
import WelcomeModal from '../components/WelcomeModal';
import type { FeatureProperties } from './types/catalog';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);

  const [visibleFeatures, setVisibleFeatures] = useState<FeatureProperties[]>([]);
  const [availableStates, setAvailableStates] = useState<string[]>([]);
  const [availableHuc8s, setAvailableHuc8s] = useState<Set<string>>(new Set());
  const [catalogDateBounds, setCatalogDateBounds] = useState<CatalogDateBounds | null>(null);
  const [selectedSiteIds, setSelectedSiteIds] = useState<Set<string>>(() => new Set());
  const [showWelcome, setShowWelcome] = useState(() => {
    try { return !localStorage.getItem('fimbench.welcomeSeen'); }
    catch { return true; } // localStorage unavailable (e.g. private browsing restrictions)
  });

  const mapRef = useRef<MapHandle | null>(null);

  const handleCloseWelcome = useCallback(() => {
    try { localStorage.setItem('fimbench.welcomeSeen', '1'); }
    catch { /* ignore — modal simply re-appears next visit */ }
    setShowWelcome(false);
  }, []);

  const toggleSelection = (siteId: string) => {
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      if (next.has(siteId)) next.delete(siteId);
      else next.add(siteId);
      return next;
    });
  };

  const handleFeatureClick = (feature: FeatureProperties | null, additive = false) => {
    if (!feature) { setSelectedSiteIds(new Set()); return; }
    if (additive) toggleSelection(feature.site_id);
    else setSelectedSiteIds(new Set([feature.site_id]));
  };

  const handlePruneSelections = (ids: string[]) => {
    if (ids.length === 0) return;
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      for (const id of ids) next.delete(id);
      return next;
    });
  };

  const handleCatalogDateBounds = (bounds: CatalogDateBounds) => {
    setCatalogDateBounds(bounds);
    // Seed empty date fields on first catalog load; preserve any user edits.
    setFilters(prev => ({
      ...prev,
      startDate: prev.startDate || bounds.minDate,
      endDate:   prev.endDate   || bounds.maxDate,
    }));
  };

  const handleResetFilters = () => {
    setFilters({
      ...DEFAULT_FILTERS,
      startDate: catalogDateBounds?.minDate ?? '',
      endDate:   catalogDateBounds?.maxDate ?? '',
    });
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <HeaderBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {/* Left sidebar */}
      <FilterSidebar
        filters={filters}
        setFilters={setFilters}
        onResetFilters={handleResetFilters}
        availableStates={availableStates}
        availableHuc8s={availableHuc8s}
      />

      {/* Right: map on top, table on bottom */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={{ flex: '0 0 60%', minHeight: 0 }}>
          <Map
            ref={mapRef}
            filters={filters}
            onFeaturesChange={setVisibleFeatures}
            onFeatureClick={handleFeatureClick}
            onCatalogStates={setAvailableStates}
            onCatalogHuc8s={setAvailableHuc8s}
            onCatalogDateBounds={handleCatalogDateBounds}
            onPruneSelections={handlePruneSelections}
            selectedSiteIds={selectedSiteIds}
          />
        </div>

        <div style={{ flex: '0 0 40%', minHeight: 0, overflow: 'hidden' }}>
          <FIMTable
            features={visibleFeatures}
            selectedSiteIds={selectedSiteIds}
            onSelectionChange={(newIds) => {
              setSelectedSiteIds(newIds);
              mapRef.current?.clearPopup?.();
            }}
            onClearSelection={() => setSelectedSiteIds(new Set())}
            onZoomToFeature={(bbox) => mapRef.current?.zoomToBbox(bbox)}
          />
        </div>

      </div>

      </div>

      <Footer />

      {showWelcome && <WelcomeModal onClose={handleCloseWelcome} />}
    </div>
  );
}

export default App;