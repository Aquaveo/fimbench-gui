import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type LngLatLike,
  type RasterSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';

// Parse a record's state field (string, comma-separated, or array) into an array of abbreviations.
function parseStates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// Returns true if the record's states overlap with any of the selected states.
function stateMatches(recordState: unknown, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const recStates = parseStates(recordState);
  return recStates.some(s => selected.includes(s));
}

// Safely parse a strict YYYY-MM-DD string into a UTC timestamp.
// Returns null for anything that isn't exactly YYYY-MM-DD or isn't a real calendar date.
// The regex gate is important because new Date() is lenient — it would otherwise accept
// "2010", "2010-3-29", "03/29/2010", etc.
const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
function parseYmd(str: unknown): number | null {
  if (typeof str !== 'string' || !YMD_REGEX.test(str)) return null;
  const ts = new Date(str).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// Returns true if the record's date (single or range) overlaps the filter window.
// Records with no valid date info are included (we don't hide data we can't place in time).
// All inputs are parsed via parseYmd; malformed or empty values become unconstrained
// bounds (filter side) or are treated as missing (record side).
function dateMatches(record: any, startDate: string, endDate: string): boolean {
  const filterStart = parseYmd(startDate) ?? -Infinity;
  const filterEnd   = parseYmd(endDate)   ?? Infinity;

  const single   = parseYmd(record.date_ymd);
  const recStart = parseYmd(record.start_date_ymd);
  const recEnd   = parseYmd(record.end_date_ymd);

  if (single !== null) return single >= filterStart && single <= filterEnd;
  if (recStart !== null && recEnd !== null) {
    return recStart <= filterEnd && recEnd >= filterStart;
  }
  if (recStart !== null) return recStart >= filterStart && recStart <= filterEnd;
  if (recEnd   !== null) return recEnd   >= filterStart && recEnd   <= filterEnd;
  return true;  // no valid date info — include
}

// -----------------------------
// Basemaps
// -----------------------------
const BASEMAPS = {
  Street:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  Topographic:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  Satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

const CATALOG_URL = 'http://127.0.0.1:9000/fimbench/FIM_Viz/catalog_core.json';
const ZOOM_CROSSFADE_START = 7;
const ZOOM_CROSSFADE_END   = 8;

// Color per tier — distinct from the dark blue used for extents
const TIER_CENTROID_COLORS: Record<string, string> = {
  Tier_1: '#E74C3C',  // red
  Tier_2: '#F39C12',  // orange
  Tier_3: '#2ECC71',  // green
  Tier_4: '#9B59B6',  // purple
  HWM:    '#EC6FA3',  // pink
};

const TIER_LABELS: Record<string, string> = {
  Tier_1: 'Tier 1',
  Tier_2: 'Tier 2',
  Tier_3: 'Tier 3',
  Tier_4: 'Tier 4',
  HWM:    'High Water Mark',
};

// -----------------------------
// Shared paint expressions
// Extracted so they can be reused in both addLayer and setPaintProperty calls.
// -----------------------------
const TIER_COLOR_EXPR: ExpressionSpecification = [
  'match', ['get', 'tier'],
  'Tier_1', TIER_CENTROID_COLORS.Tier_1,
  'Tier_2', TIER_CENTROID_COLORS.Tier_2,
  'Tier_3', TIER_CENTROID_COLORS.Tier_3,
  'Tier_4', TIER_CENTROID_COLORS.Tier_4,
  'HWM',    TIER_CENTROID_COLORS.HWM,
  '#aaaaaa',
];

const CENTROID_OPACITY_EXPR: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  ZOOM_CROSSFADE_START, 1,
  ZOOM_CROSSFADE_END,   0,
];

const EXTENT_OPACITY_EXPR: ExpressionSpecification = [
  'interpolate', ['linear'], ['zoom'],
  ZOOM_CROSSFADE_START, 0,
  ZOOM_CROSSFADE_END,   0.6,
];

// Applies (or resets) selection-emphasis paint properties on both layers.
// Called both from the selectedSiteId useEffect and inside map.on('load')
// so that basemap switches re-apply the current selection state.
function applySelectionEmphasis(map: maplibregl.Map, siteId: string | null | undefined) {
  if (!map.getLayer('centroids-layer') || !map.getLayer('fim-layer')) return;

  if (!siteId) {
    // Reset to default — no active selection
    map.setPaintProperty('centroids-layer', 'circle-color', TIER_COLOR_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-stroke-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-radius', 7);
    map.setPaintProperty('fim-layer', 'fill-color', '#0067E1');
    map.setPaintProperty('fim-layer', 'fill-outline-color', '#003B8E');
    map.setPaintProperty('fim-layer', 'fill-opacity', EXTENT_OPACITY_EXPR);
  } else {
    const isSelected: ExpressionSpecification = ['==', ['get', 'site_id'], siteId];

    // Centroids: selected stays in tier color and grows slightly; others fade to gray
    map.setPaintProperty('centroids-layer', 'circle-color', [
      'case', isSelected, TIER_COLOR_EXPR, '#cccccc',
    ]);
    map.setPaintProperty('centroids-layer', 'circle-opacity', [
      'case', isSelected, 1, 0.2,
    ]);
    map.setPaintProperty('centroids-layer', 'circle-stroke-opacity', [
      'case', isSelected, 1, 0.2,
    ]);
    map.setPaintProperty('centroids-layer', 'circle-radius', [
      'case', isSelected, 9, 6,
    ]);

    // Extents: selected stays in full blue; others become very faint gray
    map.setPaintProperty('fim-layer', 'fill-color', [
      'case', isSelected, '#0067E1', '#aaaaaa',
    ]);
    map.setPaintProperty('fim-layer', 'fill-outline-color', [
      'case', isSelected, '#003B8E', '#aaaaaa',
    ]);
    map.setPaintProperty('fim-layer', 'fill-opacity', [
      'case', isSelected,
      EXTENT_OPACITY_EXPR,
      ['interpolate', ['linear'], ['zoom'], ZOOM_CROSSFADE_START, 0, ZOOM_CROSSFADE_END, 0.12],
    ]);
  }
}

type MapProps = {
  filters: Filters;
  onFeaturesChange?: (features: any[]) => void;
  onFeatureClick?: (feature: any | null) => void;
  onCatalogStates?: (states: string[]) => void;
  selectedSiteId?: string | null;
};

type ViewState = {
  center: LngLatLike;
  zoom: number;
  bearing: number;
  pitch: number;
};

const DEFAULT_VIEW: ViewState = {
  center: [-96, 38],
  zoom: 4,
  bearing: 0,
  pitch: 0,
};

// -----------------------------
// Style
// -----------------------------
function createStyle(basemapUrl: string): StyleSpecification {
  const basemapSource: RasterSourceSpecification = {
    type: 'raster',
    tiles: [basemapUrl],
    tileSize: 256,
  };

  return {
    version: 8,
    sources: {
      basemap: basemapSource,
    },
    layers: [{ id: 'basemap-layer', type: 'raster', source: 'basemap' }],
  };
}

// -----------------------------
// Main Component
// -----------------------------

export default function Map({ filters, onFeaturesChange, onFeatureClick, onCatalogStates, selectedSiteId }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] =
    useState<keyof typeof BASEMAPS>('Topographic');
  
  const catalogRef = useRef<any[]>([]);              // all catalog records, loaded once
  const selectedSiteIdRef = useRef(selectedSiteId);  // readable inside map.on('load') closure
  const emitFeaturesRef = useRef<(() => void) | null>(null); // stable handle so async effects can call emitFeatures

  const filtersRef = useRef(filters);

  const buildCentroidGeoJSON = (f: Filters) => {
    const { tiers, states, huc8Id, startDate, endDate } = f;
    const isHucMode = !!huc8Id;

    return {
      type: 'FeatureCollection' as const,
      features: catalogRef.current
        .filter(r => {
          if (!tiers.includes(r.tier)) return false;
          if (isHucMode) {
            const huc8s: string[] = Array.isArray(r.huc8)
              ? r.huc8.map(String)
              : r.huc8 ? [String(r.huc8)] : [];
            return huc8s.some(h => h === huc8Id);
          } else {
            if (!stateMatches(r.state, states)) return false;
            if (!dateMatches(r, startDate, endDate)) return false;
          }
          return true;
        })
        .map(r => ({
        type: 'Feature' as const,
        geometry: { type: 'Point' as const, coordinates: r.centroid },
        properties: {
          site_id:      r.site_id,
          tier:         r.tier,
          s3_prefix:    r.s3_prefix,
          file_name:    r.file_name,
          state:        r.state,
          basin:        Array.isArray(r.basin) ? r.basin.join(', ') : (r.basin ?? '—'),
          resolution_m: r.resolution_m,
          huc8:         Array.isArray(r.huc8)  ? r.huc8.join(', ')  : (r.huc8  ?? '—'),
          quality:      r.quality,
        },
      })),
    };
  };

  // -----------------------------
  // Create map
  // -----------------------------
  useEffect(() => {
    if (!mapContainer.current) return;

    // Preserve view state
    if (mapRef.current) {
      viewStateRef.current = {
        center: mapRef.current.getCenter().toArray(),
        zoom: mapRef.current.getZoom(),
        bearing: mapRef.current.getBearing(),
        pitch: mapRef.current.getPitch(),
      };
      mapRef.current.remove();
      mapRef.current = null;
    }

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: createStyle(BASEMAPS[basemap]),
      center: viewStateRef.current.center,
      zoom: viewStateRef.current.zoom,
      bearing: viewStateRef.current.bearing,
      pitch: viewStateRef.current.pitch,
      minZoom: 3,
      maxZoom: 20,
    });

    // Debug access
    // @ts-ignore
    window.map = map;

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (e) => {
      console.error('MapLibre error:', e.error);
    });

    const emitFeatures = () => {
      if (!onFeaturesChange) return;

      // Build allowed site_ids from catalog using current filters
      const { tiers, states, huc8Id, startDate, endDate } = filtersRef.current;
      const isHucMode = !!huc8Id;
      const allowedIds = new Set<string>(
        catalogRef.current
          .filter(r => {
            if (!tiers.includes(r.tier)) return false;
            if (isHucMode) {
              const huc8s: string[] = Array.isArray(r.huc8)
                ? r.huc8.map(String)
                : r.huc8 ? [String(r.huc8)] : [];
              return huc8s.some(h => h === huc8Id);
            } else {
              if (!stateMatches(r.state, states)) return false;
              if (!dateMatches(r, startDate, endDate)) return false;
            }
            return true;
          })
          .map(r => r.site_id as string)
      );

      const extents   = map.queryRenderedFeatures({ layers: ['fim-layer'] });
      const centroids = map.queryRenderedFeatures({ layers: ['centroids-layer'] });
      const raw = [...extents, ...centroids];
      const seen = new Set<string>();
      const unique = raw.filter(f => {
        const sid = f.properties?.site_id;
        if (!sid || !allowedIds.has(sid)) return false;
        if (seen.has(sid)) return false;
        seen.add(sid);
        return true;
      });
      onFeaturesChange(unique.map(f => f.properties));
    };
    emitFeaturesRef.current = emitFeatures;

    map.on('load', () => {
      // ── Centroid source (GeoJSON, updated client-side) ──
      map.addSource('centroids', {
        type: 'geojson',
        data: buildCentroidGeoJSON(filters),
      });

      // ── Centroid circle layer (visible below crossfade zone) ──
      map.addLayer({
        id: 'centroids-layer',
        type: 'circle',
        source: 'centroids',
        paint: {
          'circle-radius': 7,
          'circle-color': TIER_COLOR_EXPR,
          'circle-stroke-color': '#ffffff',
          'circle-stroke-width': 1.5,
          'circle-opacity': CENTROID_OPACITY_EXPR,
          'circle-stroke-opacity': CENTROID_OPACITY_EXPR,
        },
      });

      // ── FIM extent vector tile source ──
      if (!map.getSource('fim-tiles')) {
        map.addSource('fim-tiles', {
          type: 'vector',
          tiles: ['http://127.0.0.1:8000/apps/fimbench-gui/tile-proxy/{z}/{x}/{y}.pbf'],
          minzoom: 3,
          maxzoom: 14,
        });
      }

      // ── FIM extent fill layer (fades IN as zoom increases) ──
      if (!map.getLayer('fim-layer')) {
        map.addLayer({
          id: 'fim-layer',
          type: 'fill',
          source: 'fim-tiles',
          'source-layer': 'fim_extents',
          filter: ['in', ['get', 'tier'], ['literal', filters.tiers]],
          paint: {
            'fill-color': '#0067E1',
            'fill-opacity': EXTENT_OPACITY_EXPR,
            'fill-outline-color': '#003B8E',
          },
        });
      }

      // ── Click: unified handler with explicit layer priority ───────
      // Layers are checked in order; first match wins, so centroids
      // always beat extent polygons when they overlap. To add cluster
      // or other interactive layers, prepend/append to this array.
      const INTERACTIVE_LAYERS = ['centroids-layer', 'fim-layer'];

      map.on('click', (e) => {
        for (const layerId of INTERACTIVE_LAYERS) {
          if (!map.getLayer(layerId)) continue;
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (features.length > 0) {
            onFeatureClick?.(features[0].properties);
            return;
          }
        }
        onFeatureClick?.(null);
      });

      // ── Cursor: pointer over interactive layers ──────────────────
      INTERACTIVE_LAYERS.forEach(layerId => {
        map.on('mouseenter', layerId, () => {
          map.getCanvas().style.cursor = 'pointer';
        });
        map.on('mouseleave', layerId, () => {
          map.getCanvas().style.cursor = '';
        });
      });

      // Re-apply selection emphasis after every map reload (e.g. basemap switch)
      applySelectionEmphasis(map, selectedSiteIdRef.current);

      map.on('moveend', emitFeatures);
      map.on('zoomend', emitFeatures);
      emitFeatures(); // emit once immediately after load
    });

    return () => {
      map.remove();
    };
  }, [basemap]);

  useEffect(() => {
    fetch(CATALOG_URL)
      .then(r => r.json())
      .then(data => {
        catalogRef.current = data.records ?? [];

        // Emit unique sorted states to parent
        if (onCatalogStates) {
          const all = catalogRef.current.flatMap(r => parseStates(r.state));
          const unique = [...new Set(all)].sort();
          onCatalogStates(unique);
        }

        // If map is already loaded, populate the centroid source immediately
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
          const src = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
          src?.setData(buildCentroidGeoJSON(filters));
          // Emit features once the new centroid data has been rendered
          map.once('idle', () => emitFeaturesRef.current?.());
        }
      })
      .catch(err => console.error('Failed to load catalog:', err));
  }, []); // runs once

  useEffect(() => {
    filtersRef.current = filters;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const { tiers, states, huc8Id, startDate, endDate } = filters;
    const isHucMode = !!huc8Id;
    const hasDateConstraint = !isHucMode && !!(startDate || endDate);

    // Update extent filter — tier + huc8 or state/date (via allowed site_ids)
    if (map.getLayer('fim-layer')) {
      if (isHucMode || states.length > 0 || hasDateConstraint) {
        // Use catalog to compute allowed site_ids
        const allowedSiteIds = catalogRef.current
          .filter(r => {
            if (!tiers.includes(r.tier)) return false;
            if (isHucMode) {
              const huc8s: string[] = Array.isArray(r.huc8)
                ? r.huc8.map(String)
                : r.huc8 ? [String(r.huc8)] : [];
              return huc8s.some(h => h === huc8Id);
            } else {
              if (!stateMatches(r.state, states)) return false;
              if (!dateMatches(r, startDate, endDate)) return false;
            }
            return true;
          })
          .map(r => r.site_id as string);
        map.setFilter('fim-layer', [
          'in', ['get', 'site_id'], ['literal', allowedSiteIds]
        ]);
      } else {
        map.setFilter('fim-layer', [
          'in', ['get', 'tier'], ['literal', tiers]
        ]);
      }
    }

    // Update centroid GeoJSON data
    if (map.getSource('centroids')) {
      (map.getSource('centroids') as maplibregl.GeoJSONSource)
        .setData(buildCentroidGeoJSON(filters));
    }

    // Clear selection if the selected feature no longer passes filters
    if (selectedSiteIdRef.current) {
      const rec = catalogRef.current.find(
        r => r.site_id === selectedSiteIdRef.current
      );
      if (rec) {
        const tierOk = tiers.includes(rec.tier);
        const stateOk = isHucMode || stateMatches(rec.state, states);
        const dateOk  = isHucMode || dateMatches(rec, startDate, endDate);
        let huc8Ok = true;
        if (isHucMode) {
          const huc8s: string[] = Array.isArray(rec.huc8)
            ? rec.huc8.map(String)
            : rec.huc8 ? [String(rec.huc8)] : [];
          huc8Ok = huc8s.some(h => h === huc8Id);
        }
        if (!tierOk || !huc8Ok || !stateOk || !dateOk) onFeatureClick?.(null);
      }
    }
  }, [filters.tiers, filters.states, filters.huc8Id, filters.startDate, filters.endDate]);

  useEffect(() => {
    selectedSiteIdRef.current = selectedSiteId ?? null;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applySelectionEmphasis(map, selectedSiteId);
  }, [selectedSiteId]);

  // -----------------------------
  // UI
  // -----------------------------
  return (
    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Basemap selector */}
      <div
        style={{
          position: 'absolute',
          top: 10,
          right: 10,
          padding: 8,
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: 4,
        }}
      >
        <label>
          Basemap:{' '}
          <select
            value={basemap}
            onChange={(e) =>
              setBasemap(e.target.value as keyof typeof BASEMAPS)
            }
          >
            {Object.keys(BASEMAPS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>
      {/* Map legend — bottom right */}
      {filters.tiers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 28,
          right: 10,
          padding: '8px 12px',
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderRadius: 4,
          boxShadow: '0 1px 4px rgba(0,0,0,0.2)',
          fontSize: 12,
          lineHeight: 1.6,
          pointerEvents: 'none', // don't block map interaction
        }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>FIM Tiers</div>
          {filters.tiers.map(tier => (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{
                display: 'inline-block',
                width: 12,
                height: 12,
                borderRadius: '50%',
                backgroundColor: TIER_CENTROID_COLORS[tier] ?? '#aaa',
                flexShrink: 0,
              }} />
              <span>{TIER_LABELS[tier] ?? tier}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}


// import maplibregl, {
//   type LngLatLike,
//   type RasterSourceSpecification,
//   type StyleSpecification,
// } from 'maplibre-gl';
// import 'maplibre-gl/dist/maplibre-gl.css';


// import { useState, useRef } from 'react';
// import DeckGL from '@deck.gl/react';
// import { MVTLayer } from '@deck.gl/geo-layers';
// import 'maplibre-gl/dist/maplibre-gl.css';
// import { Map as MapLibre } from 'react-map-gl/maplibre';
// import { type Filters } from './FilterSidebar';

// // -----------------------------
// // Basemaps
// // -----------------------------
// const BASEMAPS = {
//   Street:
//     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
//   Topographic:
//     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
//   Satellite:
//     'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
// };

// type MapProps = {
//   filters: Filters;
// };

// const DEFAULT_VIEW = {
//   longitude: -98,
//   latitude: 29.9,
//   zoom: 6,
//   bearing: 0,
//   pitch: 0,
// };

// function getMapStyle(basemapUrl: string) {
//   return {
//     version: 8 as const,
//     sources: { basemap: { type: 'raster' as const, tiles: [basemapUrl], tileSize: 256 } },
//     layers: [{ id: 'basemap-layer', type: 'raster' as const, source: 'basemap' }],
//   };
// }

// // -----------------------------
// // Main Component
// // -----------------------------
// export default function Map(_: MapProps) {
//   const [viewState, setViewState] = useState(DEFAULT_VIEW);
//   const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('Topographic');

//   const layers = [
//     new MVTLayer({
//       id: 'fim-layer',
//       data: 'https://sdmlab.s3.amazonaws.com/FIM_Database/FIM_Viz/tiles/{z}/{x}/{y}.pbf',
//       binary: true,
//       minZoom: 3,
//       maxZoom: 14,
//       filled: true,
//       getFillColor: [255, 0, 0, 128],
//       stroked: false,
//     }),
//   ];

//   // -----------------------------
//   // UI
//   // -----------------------------
//   return (
//     <div style={{ flex: 1, position: 'relative' }}>
//       <DeckGL
//         viewState={viewState}
//         onViewStateChange={({ viewState }) => setViewState(viewState as typeof DEFAULT_VIEW)}
//         controller={true}
//         layers={layers}
//       >
//         <MapLibre mapStyle={getMapStyle(BASEMAPS[basemap])} />
//       </DeckGL>

//       {/* Basemap selector */}
//       <div
//         style={{
//           position: 'absolute',
//           top: 10,
//           right: 10,
//           padding: 8,
//           backgroundColor: 'rgba(255,255,255,0.85)',
//           borderRadius: 4,
//           zIndex: 1,
//         }}
//       >
//         <label>
//           Basemap:{' '}
//           <select
//             value={basemap}
//             onChange={(e) => setBasemap(e.target.value as keyof typeof BASEMAPS)}
//           >
//             {Object.keys(BASEMAPS).map((name) => (
//               <option key={name} value={name}>
//                 {name}
//               </option>
//             ))}
//           </select>
//         </label>
//       </div>
//     </div>
//   );
// }