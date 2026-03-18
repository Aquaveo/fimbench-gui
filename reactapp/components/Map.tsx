import { useEffect, useRef, useState } from 'react';
import maplibregl, { type RasterSourceSpecification, type StyleSpecification } from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';

type MapProps = {
  filters: Filters;
};

// ArcGIS public basemaps
const BASEMAPS = {
  Street: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
  Topographic: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
  Satellite: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
};

export default function Map({ filters }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const [basemap, setBasemap] = useState<keyof typeof BASEMAPS>("Topographic");

  // Function to create a MapLibre style object with proper TypeScript typing
  const createStyle = (tileUrl: string): StyleSpecification => {
    const rasterSource: RasterSourceSpecification = {
      type: "raster",
      tiles: [tileUrl],
      tileSize: 256,
    };

    return {
      version: 8,
      sources: {
        basemap: rasterSource,
      },
      layers: [
        {
          id: "basemap-layer",
          type: "raster",
          source: "basemap",
        },
      ],
    };
  };

  // Initialize MapLibre
  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: createStyle(BASEMAPS[basemap]),
      center: [-96, 39], // Home view: middle of U.S.
      zoom: 4,           // Initial zoom
      minZoom: 2,        // Zoom out limit
      maxZoom: 20,       // Zoom in limit
    });

    // Navigation controls
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    // Attribution
    mapRef.current.addControl(
      new maplibregl.AttributionControl({
        compact: true,
        customAttribution: 'Tiles © Esri',
      }),
      'bottom-right'
    );

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  // Update basemap when dropdown changes
  useEffect(() => {
    if (!mapRef.current) return;

    const currentCenter = mapRef.current.getCenter();
    const currentZoom = mapRef.current.getZoom();

    // Replace style with new basemap while keeping center & zoom
    mapRef.current.setStyle(createStyle(BASEMAPS[basemap]));
    mapRef.current.setCenter(currentCenter);
    mapRef.current.setZoom(currentZoom);
  }, [basemap]);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{ width: '100%', height: '100%' }}
      />

      {/* Basemap dropdown */}
      <div style={{
        position: 'absolute',
        top: 10,
        right: 10,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 4,
        zIndex: 1,
      }}>
        <label>
          Basemap:&nbsp;
          <select value={basemap} onChange={e => setBasemap(e.target.value as keyof typeof BASEMAPS)}>
            {Object.keys(BASEMAPS).map(name => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>
        </label>
      </div>

      {/* Overlay filters summary */}
      <div style={{
        position: 'absolute',
        top: 50,
        left: 10,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.85)',
        borderRadius: 4,
      }}>
        <strong>Filters (not live yet):</strong>
        <div>Tier: {filters.tier}</div>
        <div>Return Period: {filters.returnPeriod}</div>
      </div>
    </div>
  );
}