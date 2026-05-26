import { useCallback, useEffect, useRef, useState } from 'react';
import ColorblindToggle from '../components/ColorblindToggle';
import HeaderBar from '../components/HeaderBar';
import Footer from '../components/Footer';
import FilterSidebar from '../components/FilterSidebar';
import { DEFAULT_FILTERS, type Filters } from './types/filters';
import Map, { type MapHandle, type CatalogDateBounds } from '../components/Map';
import FIMTable from '../components/FIMTable';
import WelcomeModal from '../components/WelcomeModal';
import type { FeatureProperties } from './types/catalog';
import './App.css';
import { toggleInSet } from './utils/toggle';

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

  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [tableVisible, setTableVisible] = useState(() => window.innerWidth > 768);

  const mapRef = useRef<MapHandle | null>(null);

  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
        setTableVisible(true);
      } else {
        setSidebarOpen(false);
        setTableVisible(false);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const [mapPercent, setMapPercent] = useState(60);
  const splitContainerRef = useRef<HTMLDivElement | null>(null);
  const [handleHover, setHandleHover] = useState(false);
  const [resizing, setResizing] = useState(false);

  const handleSeparatorMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const container = splitContainerRef.current;
    if (!container) return;
    setResizing(true);
    const startY = e.clientY;
    const startPercent = mapPercent;
    const containerHeight = container.getBoundingClientRect().height;

    const onMove = (ev: MouseEvent) => {
      const deltaPercent = ((ev.clientY - startY) / containerHeight) * 100;
      setMapPercent(Math.min(80, Math.max(20, startPercent + deltaPercent)));
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      setResizing(false);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, [mapPercent]);

  const handleCloseWelcome = useCallback((dontShowAgain: boolean) => {
    try {
      if (dontShowAgain) localStorage.setItem('fimbench.welcomeSeen', '1');
      else localStorage.removeItem('fimbench.welcomeSeen');
    } catch { /* ignore — modal re-appears next visit if storage is unavailable */ }
    setShowWelcome(false);
  }, []);

  const toggleSelection = (siteId: string) => {
    setSelectedSiteIds(prev => toggleInSet(prev, siteId));
  };

  const handleFiltersChange = (next: Filters) => {
    setFilters(next);
    // Don't blanket-clear selection here. The filter useEffect in Map.tsx
    // prunes only the site IDs that no longer match the new filters via
    // onPruneSelections, so a selection of Tier_1 centroids survives a
    // Tier_2 filter toggle. resetSelectionVisuals is still called by the
    // explicit Reset Filters button (handleResetFilters).
    mapRef.current?.clearPopup?.();
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

  // Shift+drag spatial selection on the map — additive to existing selection
  // so users can build a multi-region selection across separate drags.
  const handleMultiFeatureSelect = (siteIds: string[]) => {
    if (siteIds.length === 0) return;
    setSelectedSiteIds(prev => {
      const next = new Set(prev);
      for (const id of siteIds) next.add(id);
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
    setSelectedSiteIds(new Set());
    mapRef.current?.resetSelectionVisuals?.();
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>

      <HeaderBar />

      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(37, 194, 223, 0.25)',
            zIndex: 199,
          }}
        />
      )}

      {/* Left sidebar */}
      <FilterSidebar
        filters={filters}
        setFilters={handleFiltersChange}
        onResetFilters={handleResetFilters}
        availableStates={availableStates}
        availableHuc8s={availableHuc8s}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />

      {/* Right: map on top, table on bottom */}
      <div ref={splitContainerRef} style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        <div style={
          isMobile
            ? { flex: 'none', height: tableVisible ? '35%' : '100%', minHeight: 0, position: 'relative', transition: 'height 0.25s ease' }
            : { flex: `${mapPercent} 1 0`, minHeight: 0, position: 'relative' }
        }>
          <ColorblindToggle />
          {isMobile && !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open filters"
              style={{
                position: 'absolute',
                top: '0.75rem',
                left: '0.75rem',
                zIndex: 10,
                background: '#25C2DF',
                color: '#fff',
                border: 'none',
                borderRadius: '1.5rem',
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.2)',
              }}
            >
              ☰ Filters
            </button>
          )}
          <Map
            ref={mapRef}
            filters={filters}
            onFeaturesChange={setVisibleFeatures}
            onFeatureClick={handleFeatureClick}
            onCatalogStates={setAvailableStates}
            onCatalogHuc8s={setAvailableHuc8s}
            onCatalogDateBounds={handleCatalogDateBounds}
            onPruneSelections={handlePruneSelections}
            onMultiFeatureSelect={handleMultiFeatureSelect}
            selectedSiteIds={selectedSiteIds}
          />
          {isMobile && (
            <div
              onClick={() => setTableVisible(v => !v)}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(255,255,255,0.95)',
                borderTop: '0.0625rem solid #ddd',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#25C2DF',
                zIndex: 5,
                userSelect: 'none',
              }}
            >
              {tableVisible ? '▼ Hide Table' : `▲ Show Table (${visibleFeatures.length} results)`}
            </div>
          )}
        </div>

        {!isMobile && (
          <div
            onMouseDown={handleSeparatorMouseDown}
            onMouseEnter={() => setHandleHover(true)}
            onMouseLeave={() => setHandleHover(false)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize map and table panels"
            style={{
              height: '0.4rem',
              flexShrink: 0,
              cursor: 'row-resize',
              background: (handleHover || resizing) ? '#888' : '#ddd',
              transition: 'background 0.15s ease',
            }}
          />
        )}

        <div style={
          isMobile
            ? { flex: 'none', height: '65%', minHeight: 0, overflow: 'hidden', display: tableVisible ? 'flex' : 'none', flexDirection: 'column' }
            : { flex: `${100 - mapPercent} 1 0`, minHeight: 0, overflow: 'hidden' }
        }>
          <FIMTable
            features={visibleFeatures}
            selectedSiteIds={selectedSiteIds}
            onSelectionChange={(newIds) => {
              setSelectedSiteIds(newIds);
              mapRef.current?.clearPopup?.();
            }}
            onClearSelection={() => setSelectedSiteIds(new Set())}
            onZoomToFeature={(bbox, siteId) => mapRef.current?.zoomToBbox(bbox, siteId)}
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