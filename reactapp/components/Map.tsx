import { useEffect, useRef, useState } from 'react';
import maplibregl, {
  type LngLatLike,
  type RasterSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';

// MinIO raster URLs (pre-generated PNG tiles)
const FIM_RASTER_BY_TIER: Record<string, string> = {
  tier1: 'http://127.0.0.1:9000/fimbench/FIM_Viz/tiles/Tier_1/{z}/{x}/{y}.png',
  tier2: 'http://127.0.0.1:9000/fimbench/FIM_Viz/tiles/Tier_2/{z}/{x}/{y}.png',
  tier4: 'http://127.0.0.1:9000/fimbench/FIM_Viz/tiles/Tier_4/{z}/{x}/{y}.png',
};

// ArcGIS public basemaps
const BASEMAPS = {
  Street:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  Topographic:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  Satellite:
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

type MapProps = {
  filters: Filters;
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

function syncFimRaster(map: maplibregl.Map, tier: string) {
  const sourceId = 'fim-raster';
  const layerId = 'fim-raster-layer';
  const rasterUrl = FIM_RASTER_BY_TIER[tier];
  console.log('Adding raster layer:', tier, rasterUrl);

  if (map.getLayer(layerId)) map.removeLayer(layerId);
  if (map.getSource(sourceId)) map.removeSource(sourceId);

  if (!rasterUrl) return;

  map.addSource(sourceId, {
    type: 'raster',
    tiles: [rasterUrl],
    tileSize: 256,
    maxzoom: 14,
  });

  map.addLayer({
    id: layerId,
    type: 'raster',
    source: sourceId,
    paint: { 'raster-opacity': 0.7 },
  });
}

export default function Map({ filters }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('Topographic');

  // Create/recreate the map when basemap changes
  useEffect(() => {
    if (!mapContainer.current) return;

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
      minZoom: 4,
      maxZoom: 20,
    });

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');
    map.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Tiles © Esri',
      }),
      'bottom-right'
    );

    const updateViewState = () => {
      viewStateRef.current = {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
    };

    map.on('moveend', updateViewState);
    map.on('zoomend', updateViewState);
    map.on('rotateend', updateViewState);
    map.on('pitchend', updateViewState);
    map.once('load', () => syncFimRaster(map, filters.tier));

    return () => {
      map.off('moveend', updateViewState);
      map.off('zoomend', updateViewState);
      map.off('rotateend', updateViewState);
      map.off('pitchend', updateViewState);
      map.remove();
      if (mapRef.current === map) mapRef.current = null;
    };
  }, [basemap]);

  // Update raster when tier changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return; // no map, no effect

    const applyRaster = () => syncFimRaster(map, filters.tier);

    if (map.isStyleLoaded()) {
      applyRaster();
    } else {
      map.once('load', applyRaster);
    }

    // Cleanup function
    return () => {
      if (map) map.off('load', applyRaster);
    };
  }, [filters.tier]);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
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
          zIndex: 1,
        }}
      >
        <label>
          Basemap:{' '}
          <select
            value={basemap}
            onChange={(e) => setBasemap(e.target.value as keyof typeof BASEMAPS)}
          >
            {Object.keys(BASEMAPS).map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {/* Filters display */}
      <div
        style={{
          position: 'absolute',
          top: 50,
          left: 10,
          padding: 8,
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: 4,
        }}
      >
        <strong>Filters:</strong>
        <div>Tier: {filters.tier}</div>
        <div>
          Date Range: {filters.startDate} → {filters.endDate}
        </div>
        <div>Return Period: {filters.returnPeriod}</div>
      </div>
    </div>
  );
}