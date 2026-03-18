import { useEffect, useRef } from 'react';
import maplibregl from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import { type Filters } from './FilterSidebar';

type MapProps = {
  filters: Filters;
};

export default function Map({ filters }: MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);

  useEffect(() => {
    if (mapRef.current || !mapContainer.current) return;

    mapRef.current = new maplibregl.Map({
      container: mapContainer.current,
      style: 'https://demotiles.maplibre.org/style.json', // Simple raster basemap
      center: [-90, 38], // USA center
      zoom: 4,
    });

    // Navigation controls
    mapRef.current.addControl(new maplibregl.NavigationControl(), 'top-right');

    return () => {
      mapRef.current?.remove();
    };
  }, []);

  return (
    <div style={{ flex: 1, position: 'relative' }}>
      <div
        ref={mapContainer}
        style={{ width: '100%', height: '100%' }}
      />
      {/* Overlay filters summary */}
      <div style={{
        position: 'absolute',
        top: 10,
        left: 10,
        padding: 8,
        backgroundColor: 'rgba(255,255,255,0.8)',
        borderRadius: 4,
      }}>
        <strong>Filters (not live yet):</strong>
        <div>Tier: {filters.tier}</div>
        <div>Return Period: {filters.returnPeriod}</div>
      </div>
    </div>
  );
}