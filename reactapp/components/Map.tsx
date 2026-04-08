import { useEffect, useRef, useState } from 'react';
import maplibregl, {
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
export default function Map(_ : MapProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] =
    useState<keyof typeof BASEMAPS>('Topographic');

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
      minZoom: 4,
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

    const BASE = window.location.origin;

    console.log("BASE=", BASE)

    map.on('load', () => {
      // -----------------------------
      // ADD VECTOR SOURCE (ONLY ONCE)
      // -----------------------------
      if (!map.getSource('fim-tiles')) {
        map.addSource('fim-tiles', {
          type: 'vector',
          tiles: [
            'http://127.0.0.1:8000/apps/fimbench-gui/tile-proxy/{z}/{x}/{y}.pbf'
          ],
          minzoom: 2,
          maxzoom: 14,
        });
      }

      // -----------------------------
      // ADD LAYER (ONLY ONCE)
      // -----------------------------
      if (!map.getLayer('fim-layer')) {
        map.addLayer({
          id: 'fim-layer',
          type: 'fill',
          source: 'fim-tiles',
          'source-layer': 'fim_extents',
          paint: {
            'fill-color': '#ff0000',
            'fill-opacity': 0.5,
          },
        });
      }
    });

    return () => {
      map.remove();
    };
  }, [basemap]);

  // -----------------------------
  // UI
  // -----------------------------
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
//       minZoom: 2,
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