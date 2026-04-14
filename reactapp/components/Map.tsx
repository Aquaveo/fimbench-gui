import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type LngLatLike,
  type RasterSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';

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
  selectedSiteId?: string | null;
};

type ViewState = {
  center: LngLatLike;
  zoom: number;
  bearing: number;
  pitch: number;
};

const DEFAULT_VIEW: ViewState = {
  center: [-98, 29.9],
  zoom: 6,
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

export default function Map({ filters, onFeaturesChange, onFeatureClick, selectedSiteId }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] =
    useState<keyof typeof BASEMAPS>('Topographic');
  
  const catalogRef = useRef<any[]>([]);              // all catalog records, loaded once
  const selectedSiteIdRef = useRef(selectedSiteId);  // readable inside map.on('load') closure

  const buildCentroidGeoJSON = (tiers: string[]) => ({
    type: 'FeatureCollection' as const,
    features: catalogRef.current
      .filter(r => tiers.includes(r.tier))
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
  });

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
      const extents   = map.queryRenderedFeatures({ layers: ['fim-layer'] });
      const centroids = map.queryRenderedFeatures({ layers: ['centroids-layer'] });
      const raw = [...extents, ...centroids];
      const seen = new Set<string>();
      const unique = raw.filter(f => {
        const key = f.properties?.site_id ?? f.properties?.id ?? JSON.stringify(f.properties);
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
      onFeaturesChange(unique.map(f => f.properties));
    };

    map.on('load', () => {
      // ── Centroid source (GeoJSON, updated client-side) ──
      map.addSource('centroids', {
        type: 'geojson',
        data: buildCentroidGeoJSON(filters.tiers),
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
        // If map is already loaded, populate the centroid source immediately
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
          const src = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
          src?.setData(buildCentroidGeoJSON(filters.tiers));
        }
      })
      .catch(err => console.error('Failed to load catalog:', err));
  }, []); // runs once

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    // Update extent filter
    if (map.getLayer('fim-layer')) {
      map.setFilter('fim-layer', [
        'in', ['get', 'tier'], ['literal', filters.tiers]
      ]);
    }

    // Update centroid GeoJSON data
    if (map.getSource('centroids')) {
      (map.getSource('centroids') as maplibregl.GeoJSONSource)
        .setData(buildCentroidGeoJSON(filters.tiers));
    }

    // Clear selection if the selected feature's tier is no longer active
    if (selectedSiteIdRef.current) {
      const selectedRecord = catalogRef.current.find(
        r => r.site_id === selectedSiteIdRef.current
      );
      if (selectedRecord && !filters.tiers.includes(selectedRecord.tier)) {
        onFeatureClick?.(null);
      }
    }
  }, [filters.tiers]);

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