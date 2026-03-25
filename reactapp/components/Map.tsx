import { useEffect, useRef, useState } from 'react';
import maplibregl, { type RasterSourceSpecification, type VectorSourceSpecification, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';
import { VIZ_TILES_LOCATION, FIM_IMAGE_CONFIG } from '../src/config';

type MapProps = {
  filters: Filters;
};

// ArcGIS public basemaps
const BASEMAPS = {
  Street: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
  Topographic: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
  Satellite: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
};

export default function Map({ filters }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>('Topographic');

  // -----------------------------
  // Create Map style dynamically
  // -----------------------------
  const createStyle = (basemapUrl: string): StyleSpecification => {
    const basemapSource: RasterSourceSpecification = { type: 'raster', tiles: [basemapUrl], tileSize: 256 };
    const vectorSource: VectorSourceSpecification = { type: 'vector', tiles: [VIZ_TILES_LOCATION], minzoom: 0, maxzoom: 14 };

    return {
      version: 8 as 8,
      sources: {
        basemap: basemapSource,
        fimTiles: vectorSource,
      },
      layers: [
        { id: 'basemap-layer', type: 'raster', source: 'basemap' },
        // Flood polygons
        {
          id: 'fim-fill',
          type: 'fill',
          source: 'fimTiles',
          'source-layer': 'default',
          paint: { 'fill-color': '#2687C8', 'fill-opacity': 0.5 },
        },
        {
          id: 'fim-outline',
          type: 'line',
          source: 'fimTiles',
          'source-layer': 'default',
          paint: { 'line-color': '#000', 'line-width': 1 },
        },
      ],
    };
  };

  // -----------------------------
  // Initialize MapLibre
  // -----------------------------
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: createStyle(BASEMAPS[basemap]),
      center: [-98, 29.9],
      zoom: 6,
      minZoom: 4,
      maxZoom: 20,
    });

    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');
    mapRef.current.addControl(
      new maplibregl.AttributionControl({ compact: true, customAttribution: 'Tiles © Esri' }),
      'bottom-right'
    );

    return () => mapRef.current?.remove();
  }, []);

  // -----------------------------
  // Switch basemap
  // -----------------------------
  useEffect(() => {
    if (!mapRef.current) return;
    const center = mapRef.current.getCenter();
    const zoom = mapRef.current.getZoom();
    mapRef.current.setStyle(createStyle(BASEMAPS[basemap]));
    mapRef.current.setCenter(center);
    mapRef.current.setZoom(zoom);
  }, [basemap]);

  useEffect(() => {
    if (!mapRef.current) return;
    const map = mapRef.current;
    const config = FIM_IMAGE_CONFIG[filters.tier];
    if (!config) return;

    const updateImage = () => {
      if (map.getSource('fim-image')) {
        if (map.getLayer('fim-image-layer')) map.removeLayer('fim-image-layer');
        map.removeSource('fim-image');
      }

      map.addSource('fim-image', {
        type: 'image',
        url: config.url,
        coordinates: config.bounds,
      });

      map.addLayer({
        id: 'fim-image-layer',
        type: 'raster',
        source: 'fim-image',
        paint: { 'raster-opacity': 0.7 },
      });
    };

    if (map.isStyleLoaded()) {
      updateImage();
    } else {
      map.on('style.load', updateImage);
    }
  }, [filters]);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div ref={mapContainer} style={{ width: '100%', height: '100%' }} />

      {/* Basemap dropdown */}
      <div style={{ position: 'absolute', top: 10, right: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 4, zIndex: 1 }}>
        <label>
          Basemap:&nbsp;
          <select value={basemap} onChange={(e) => setBasemap(e.target.value as keyof typeof BASEMAPS)}>
            {Object.keys(BASEMAPS).map((name) => <option key={name} value={name}>{name}</option>)}
          </select>
        </label>
      </div>

      {/* Filters overlay */}
      <div style={{ position: 'absolute', top: 50, left: 10, padding: 8, backgroundColor: 'rgba(255,255,255,0.85)', borderRadius: 4 }}>
        <strong>Filters:</strong>
        <div>Tier: {filters.tier}</div>
        <div>Return Period: {filters.returnPeriod}</div>
      </div>
    </div>
  );
}