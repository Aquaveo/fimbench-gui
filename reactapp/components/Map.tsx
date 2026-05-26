import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { useColorMode } from '../src/context/colorMode';
import { tierColors, TIER_LABELS } from '../src/utils/tierColors';
import maplibregl, {
  type ExpressionSpecification,
  type LngLatLike,
  type RasterSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Filters } from '../src/types/filters';
import type { CatalogRecord, FeatureProperties, Bbox } from '../src/types/catalog';
import { isValidHuc8, toHuc8Array } from '../src/types/catalog';
import { parseStates, computeDateBounds, recordMatchesFilters } from '../src/utils/filters';
import { buildTifUrl, buildMetaUrl } from '../src/utils/minio';
import { pickContrastColor } from '../src/utils/contrast';
import { DOWNLOAD_ICON_SVG } from './DownloadIcon';
import { COLORS } from '../src/theme';
import { formatYmd } from '../src/utils/dateFormat';

// Escape HTML so catalog-sourced strings can't inject markup into the tooltip.
function escapeHtml(s: unknown): string {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Produce the Date/Return-Period line for a catalog record. Tier 4 (FEMA BLE) uses
// return period; others use date(_ymd) or a start/end range. Missing values → em-dash.
function dateOrReturnPeriod(rec: Partial<CatalogRecord>): { label: string; value: string } {
  const rp = rec?.return_period;
  if (rp != null && rp !== '') {
    return { label: 'Return Period', value: `${rp}-year` };
  }
  const single = typeof rec?.date_ymd === 'string' ? formatYmd(rec.date_ymd) : '';
  if (single) return { label: 'Date', value: single };
  const s = typeof rec?.start_date_ymd === 'string' ? formatYmd(rec.start_date_ymd) : '';
  const e = typeof rec?.end_date_ymd   === 'string' ? formatYmd(rec.end_date_ymd)   : '';
  if (s && e) return { label: 'Date', value: `${s} – ${e}` };
  if (s)      return { label: 'Date', value: s };
  if (e)      return { label: 'Date', value: e };
  return { label: 'Date', value: '—' };
}

// Coerce basin/state/huc8 (string | string[] | undefined) to a display string,
// returning '' (not '—') so callers can treat falsy as "omit this row".
function toDisplayStr(v: string | string[] | undefined): string {
  if (Array.isArray(v)) return v.join(', ');
  return typeof v === 'string' ? v : '';
}

// Returns '#ffffff' or the brand ink depending on whether the hex background
// color is dark or light. Uses the standard 128 luminance midpoint.
const buttonTextColor = (hex: string) =>
  pickContrastColor(hex, { onLight: COLORS.ink });

const FIM_DOWNLOAD_COLOR = COLORS.brand; // matches "FIMbench" header text

const tierLabel = (rec: Partial<CatalogRecord>) =>
  (rec?.tier && TIER_LABELS[rec.tier]) ?? rec?.tier ?? '';

function buildTooltipHtml(rec: Partial<CatalogRecord>): string {
  const basinStr  = toDisplayStr(rec?.basin as string | string[] | undefined);
  const stateStr  = toDisplayStr(rec?.state);
  const huc8Str   = toDisplayStr(rec?.huc8);
  const { label, value } = dateOrReturnPeriod(rec);
  const hasDate = value !== '—';

  // Only renders a line when val is non-empty — no '—' placeholders.
  const line = (lbl: string, val: string) =>
    val ? `<div><strong>${escapeHtml(lbl)}:</strong> ${escapeHtml(val)}</div>` : '';

  return `
    <div style="font-size:0.75rem;line-height:1.45;min-width:11.25rem">
      ${line('Tier',   tierLabel(rec))}
      ${line('Basin',  basinStr)}
      ${line('State',  stateStr)}
      ${line('HUC8',   huc8Str)}
      ${hasDate ? line(label, value) : ''}
    </div>
  `;
}

function buildClickPopupHtml(rec: Partial<CatalogRecord>): string {
  const basinStr  = toDisplayStr(rec?.basin as string | string[] | undefined);
  const stateStr  = toDisplayStr(rec?.state);
  const huc8Str   = toDisplayStr(rec?.huc8);
  const qualStr   = typeof rec?.quality === 'string' ? rec.quality : '';
  const resStr    = rec?.resolution_m != null ? `${rec.resolution_m} m` : '';
  const { label, value } = dateOrReturnPeriod(rec);
  const hasDate = value !== '—';

  // Build download URLs via shared utility (same source of truth as FIMTable)
  const s3Prefix = typeof rec?.s3_prefix === 'string' ? rec.s3_prefix : '';
  const fileName = typeof rec?.file_name  === 'string' ? rec.file_name  : '';
  const tifUrl  = s3Prefix && fileName ? buildTifUrl(s3Prefix, fileName)  : '';
  const metaUrl = s3Prefix && fileName ? buildMetaUrl(s3Prefix, fileName) : '';

  // Only renders a table row when val is non-empty — no '—' placeholders.
  const row = (k: string, v: string) =>
    v ? `<tr>
           <td style="color:#000;font-weight:600;padding:0.125rem 0.625rem 0.125rem 0;white-space:nowrap">${escapeHtml(k)}</td>
           <td>${escapeHtml(v)}</td>
         </tr>` : '';

  const mkBtnStyle = (bg: string, color: string) => [
    'display:inline-flex', 'align-items:center', 'gap:0.3125rem',
    'padding:0.25rem 0.625rem', 'font-size:0.75rem', 'font-family:inherit',
    'border:0.0625rem solid #ccc', 'border-radius:0.25rem',
    `background:${bg}`, `color:${color}`,
    'cursor:pointer', 'text-decoration:none', 'font-weight:500',
  ].join(';');

  const fimColor  = buttonTextColor(FIM_DOWNLOAD_COLOR);
  const fimStyle  = mkBtnStyle(FIM_DOWNLOAD_COLOR, fimColor);
  const metaStyle = mkBtnStyle('#f0f0f0', '#222222');

  const btn = (href: string, label: string, style: string) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" style="${style}">${DOWNLOAD_ICON_SVG}${escapeHtml(label)}</a>`;

  return `
    <div style="font-size:0.8125rem;line-height:1.5;min-width:13.75rem">
      <table style="border-collapse:collapse;width:100%">
        ${row('Tier',       tierLabel(rec))}
        ${row('Basin',      basinStr)}
        ${row('State',      stateStr)}
        ${row('Quality',    qualStr)}
        ${row('HUC8',       huc8Str)}
        ${row('Resolution', resStr)}
        ${hasDate ? row(label, value) : ''}
      </table>
      ${tifUrl || metaUrl ? `
      <div style="margin-top:0.625rem;display:flex;gap:0.5rem;flex-wrap:wrap">
        ${tifUrl  ? btn(tifUrl,  'Download FIM',      fimStyle)  : ''}
        ${metaUrl ? btn(metaUrl, 'Download Metadata', metaStyle) : ''}
      </div>` : ''}
    </div>
  `;
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

const CATALOG_URL = 'https://sdmlab.s3.amazonaws.com/FIM_Database/FIM_Viz/catalog_core.json';
const ZOOM_CROSSFADE_START = 7;
const ZOOM_CROSSFADE_END   = 8;


function buildTierColorExpr(colors: Record<string, string>): ExpressionSpecification {
  return [
    'match', ['get', 'tier'],
    'Tier_1', colors.Tier_1,
    'Tier_2', colors.Tier_2,
    'Tier_3', colors.Tier_3,
    'Tier_4', colors.Tier_4,
    'HWM',    colors.HWM,
    '#aaaaaa',
  ];
}

// Keep a name-only lookup for labels (no colors here)


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

// Tier 4 (FEMA BLE) renders at the bottom of the extent stack; HWM at the top.
// Selected features are given a higher key so they always float above everything.
const TIER_SORT_EXPR: ExpressionSpecification = [
  'match', ['get', 'tier'],
  'Tier_4', 1,
  'Tier_3', 2,
  'Tier_2', 3,
  'Tier_1', 4,
  'HWM',    5,
  0,
];

// Applies (or resets) selection-emphasis paint properties on both layers.
// Takes tierColorExpr so colorMode changes re-apply the right palette. When
// focusSiteId is provided, that feature is rendered above other selected
// features via a bumped sort-key (useful right after clicking "Zoom" on a
// row inside a multi-feature selection).
function applySelectionEmphasis(
  map: maplibregl.Map,
  siteIds: Set<string>,
  tierColorExpr: ExpressionSpecification,
  focusSiteId: string | null = null,
) {
  if (!map.getLayer('centroids-layer') || !map.getLayer('fim-layer')) return;

  // Sort-key layered z-order:
  //   focus target → 20 (top), other selected → 10, unselected → TIER_SORT_EXPR.
  const sortKeyExpr: ExpressionSpecification = focusSiteId
    ? ['case',
        ['==', ['get', 'site_id'], focusSiteId], 20,
        ['in', ['get', 'site_id'], ['literal', [...siteIds]]], 10,
        TIER_SORT_EXPR]
    : ['case',
        ['in', ['get', 'site_id'], ['literal', [...siteIds]]], 10,
        TIER_SORT_EXPR];

  if (siteIds.size === 0) {
    map.setPaintProperty('centroids-layer', 'circle-color', tierColorExpr);
    map.setPaintProperty('centroids-layer', 'circle-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-stroke-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-radius', 7);
    map.setPaintProperty('fim-layer', 'fill-color', '#0067E1');
    map.setPaintProperty('fim-layer', 'fill-outline-color', '#003B8E');
    map.setPaintProperty('fim-layer', 'fill-opacity', EXTENT_OPACITY_EXPR);
    map.setLayoutProperty('centroids-layer', 'circle-sort-key', sortKeyExpr);
    map.setLayoutProperty('fim-layer', 'fill-sort-key', sortKeyExpr);
  } else {
    const isSelected: ExpressionSpecification = ['in', ['get', 'site_id'], ['literal', [...siteIds]]];

    map.setPaintProperty('centroids-layer', 'circle-color', [
      'case', isSelected, tierColorExpr, '#cccccc',
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
    map.setLayoutProperty('centroids-layer', 'circle-sort-key', sortKeyExpr);
    map.setLayoutProperty('fim-layer', 'fill-sort-key', sortKeyExpr);
  }
}

export type CatalogDateBounds = { minDate: string; maxDate: string };

type MapProps = {
  filters: Filters;
  onFeaturesChange?: (features: FeatureProperties[]) => void;
  onFeatureClick?: (feature: FeatureProperties | null, additive?: boolean) => void;
  onCatalogStates?: (states: string[]) => void;
  onCatalogHuc8s?: (huc8s: Set<string>) => void;
  onCatalogDateBounds?: (bounds: CatalogDateBounds) => void;
  // Fires when filter changes cause one or more currently-selected features
  // to drop out of view. Parent should remove those ids from its selection set.
  onPruneSelections?: (idsToRemove: string[]) => void;
  // Fires after a Shift+drag spatial selection — parent should add these ids
  // to the existing selection (additive, matching Shift-click semantics).
  onMultiFeatureSelect?: (siteIds: string[]) => void;
  selectedSiteIds?: Set<string>;
};

export type MapHandle = {
  // focusSiteId, when provided, is rendered above other selected features so
  // the user can pick it out at a glance after clicking "Zoom" on a row.
  zoomToBbox: (bbox: Bbox, focusSiteId?: string) => void;
  clearPopup: () => void;
  resetSelectionVisuals: () => void;
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

const Map = forwardRef<MapHandle, MapProps>(function Map(
  { filters, onFeaturesChange, onFeatureClick, onCatalogStates, onCatalogHuc8s, onCatalogDateBounds, onPruneSelections, onMultiFeatureSelect, selectedSiteIds },
  ref
) {
  const { colorMode } = useColorMode();
  const colorModeRef = useRef(colorMode);
  useEffect(() => { colorModeRef.current = colorMode; }, [colorMode]);

  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] =
    useState<keyof typeof BASEMAPS>('Topographic');

  const catalogRef = useRef<CatalogRecord[]>([]);    // all catalog records, loaded once
  const selectedSiteIdsRef = useRef<Set<string>>(selectedSiteIds ?? new Set());  // readable inside map.on('load') closure
  const emitFeaturesRef = useRef<(() => void) | null>(null); // stable handle so async effects can call emitFeatures
  const currentClickPopupRef = useRef<maplibregl.Popup | null>(null); // persists across basemap switches
  const onMultiFeatureSelectRef = useRef(onMultiFeatureSelect);
  useEffect(() => { onMultiFeatureSelectRef.current = onMultiFeatureSelect; }, [onMultiFeatureSelect]);

  // The site_id of the feature the user most recently clicked "Zoom" on,
  // used by the centroid/extent sort-key so the zoom target renders above
  // neighbouring selected features. Persists until another Zoom click.
  const zoomFocusSiteIdRef = useRef<string | null>(null);

  const filtersRef = useRef(filters);

  const currentTierColorExpr = (): ExpressionSpecification => buildTierColorExpr(tierColors(colorModeRef.current));

  const buildCentroidGeoJSON = (f: Filters) => {
    return {
      type: 'FeatureCollection' as const,
      features: catalogRef.current
        .filter(r => recordMatchesFilters(r, f))
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

    const map = new maplibregl.Map({
      container: mapContainer.current,
      style: createStyle(BASEMAPS[basemap]),
      center: viewStateRef.current.center,
      zoom: viewStateRef.current.zoom,
      bearing: viewStateRef.current.bearing,
      pitch: viewStateRef.current.pitch,
      minZoom: 3,
      maxZoom: 20,
      attributionControl: false,
    });

    // Disable the default Shift+drag → zoom-to-box behaviour; we repurpose
    // Shift+drag for spatial multi-feature selection below.
    map.boxZoom.disable();

    // Debug access — dev only, stripped from production builds
    if (import.meta.env.DEV) {
      // @ts-expect-error — expose map on window for manual console debugging
      window.map = map;
    }

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (e) => {
      console.error('MapLibre error:', e.error);
    });

    const emitFeatures = () => {
      if (!onFeaturesChange) return;

      // Build allowed site_ids from catalog using current filters
      const allowedIds = new Set<string>(
        catalogRef.current
          .filter(r => recordMatchesFilters(r, filtersRef.current))
          .map(r => r.site_id as string)
      );

      const extents   = map.queryRenderedFeatures({ layers: ['fim-layer'] });
      const centroids = map.queryRenderedFeatures({ layers: ['centroids-layer'] });
      const raw = [...centroids, ...extents];
      const seen = new Set<string>();
      const unique = raw.filter(f => {
        const sid = f.properties?.site_id;
        if (!sid || !allowedIds.has(sid)) return false;
        if (seen.has(sid)) return false;
        seen.add(sid);
        return true;
      });
      // MapLibre serializes array properties (e.g. bbox) to JSON strings when
      // they pass through queryRenderedFeatures. Look bbox up from the catalog
      // by site_id — authoritative, and covers features that come from the
      // extent MVT source too.
      onFeaturesChange(unique.map(f => {
        const props = f.properties as unknown as FeatureProperties;
        const rec = catalogRef.current.find(r => r.site_id === props.site_id);
        return { ...props, bbox: rec?.bbox };
      }));
    };
    emitFeaturesRef.current = emitFeatures;

    map.on('load', () => {
      // ── Centroid source (GeoJSON, updated client-side) ──
      map.addSource('centroids', {
        type: 'geojson',
        data: buildCentroidGeoJSON(filters),
      });

      // ── Centroid circle layer (visible below crossfade zone) ──
      const initTierColorExpr = currentTierColorExpr();
      map.addLayer({
        id: 'centroids-layer',
        type: 'circle',
        source: 'centroids',
        layout: {
          'circle-sort-key': TIER_SORT_EXPR,
        },
        paint: {
          'circle-radius': 7,
          'circle-color': initTierColorExpr,
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
          tiles: ['https://sdmlab.s3.amazonaws.com/FIM_Database/FIM_Viz/tiles/{z}/{x}/{y}.pbf'],
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
          layout: {
            'fill-sort-key': TIER_SORT_EXPR,
          },
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

      // Click popup — recreated on each click so the anchor direction can be
      // recalculated. closeOnClick:false means we manage dismissal manually.
      // currentClickPopupRef is component-level so the cleanup can reach it.
      map.on('click', (e) => {
        for (const layerId of INTERACTIVE_LAYERS) {
          if (!map.getLayer(layerId)) continue;
          const features = map.queryRenderedFeatures(e.point, { layers: [layerId] });
          if (features.length > 0) {
            const feat = features[0];
            const additive = e.originalEvent.ctrlKey || e.originalEvent.metaKey || e.originalEvent.shiftKey;
            onFeatureClick?.(feat.properties as unknown as FeatureProperties, additive);

            // Anchor to centroid coordinates for Point features; fall back to
            // click position for polygon extents (MVT geometry may be clipped).
            const coords: [number, number] =
              feat.geometry.type === 'Point'
                ? (feat.geometry.coordinates as [number, number])
                : [e.lngLat.lng, e.lngLat.lat];

            // map.project() is a cheap matrix multiply — no layout work.
            // Compare pixel Y against the canvas midpoint to pick the side
            // with more space: top half → anchor:'top' (body below the point),
            // bottom half → anchor:'bottom' (body above the point).
            const py = map.project(coords).y;
            const anchor = py < map.getCanvas().offsetHeight / 2 ? 'top' : 'bottom';

            const siteId = String(feat.properties?.site_id ?? '');
            const rec = catalogRef.current.find(r => String(r.site_id) === siteId) ?? feat.properties;

            currentClickPopupRef.current?.remove();
            currentClickPopupRef.current = new maplibregl.Popup({
              closeButton: true,
              closeOnClick: false,
              offset: 15,
              maxWidth: '18.75rem',
              className: 'fim-click-popup',
              anchor,
            });
            currentClickPopupRef.current.setLngLat(coords).setHTML(buildClickPopupHtml(rec)).addTo(map);
            return;
          }
        }
        currentClickPopupRef.current?.remove();
        currentClickPopupRef.current = null;
        onFeatureClick?.(null);
      });

      // ── Shift+drag → spatial multi-feature selection ─────────────
      // Holds canvas-pixel coords of the drag origin and a handle to the
      // overlay <div> we paint as the user drags. Both are nulled out when
      // the drag completes (or is abandoned).
      let boxStart: { x: number; y: number } | null = null;
      let boxEl: HTMLDivElement | null = null;
      const DRAG_THRESHOLD_PX = 6;  // anything under this is a click, not a box-select

      map.on('mousedown', (e) => {
        if (!e.originalEvent.shiftKey) return;
        e.preventDefault();
        boxStart = { x: e.point.x, y: e.point.y };

        // Paint the rectangle imperatively to avoid React re-renders on every
        // mousemove. Mounted inside the map's CanvasContainer so the pixel
        // coords from `e.point` map 1:1 to the overlay's positioning.
        const container = map.getCanvasContainer();
        boxEl = document.createElement('div');
        boxEl.style.position = 'absolute';
        boxEl.style.background = 'rgba(37,194,223,0.15)';
        boxEl.style.border = '0.125rem dashed #25C2DF';
        boxEl.style.pointerEvents = 'none';
        boxEl.style.zIndex = '5';
        boxEl.style.left = `${boxStart.x}px`;
        boxEl.style.top = `${boxStart.y}px`;
        boxEl.style.width = '0';
        boxEl.style.height = '0';
        container.appendChild(boxEl);

        // Suppress map pan while the box is being drawn.
        map.dragPan.disable();
      });

      map.on('mousemove', (e) => {
        if (!boxStart || !boxEl) return;
        const x1 = Math.min(boxStart.x, e.point.x);
        const y1 = Math.min(boxStart.y, e.point.y);
        boxEl.style.left = `${x1}px`;
        boxEl.style.top = `${y1}px`;
        boxEl.style.width = `${Math.abs(e.point.x - boxStart.x)}px`;
        boxEl.style.height = `${Math.abs(e.point.y - boxStart.y)}px`;
      });

      map.on('mouseup', (e) => {
        if (!boxStart || !boxEl) return;
        const startPoint = boxStart;
        const endPoint = { x: e.point.x, y: e.point.y };

        // Teardown first so we re-enable pan even if the query throws.
        boxEl.remove();
        boxEl = null;
        boxStart = null;
        map.dragPan.enable();

        // Tiny drag = treat as click; the regular click handler already ran.
        const dx = endPoint.x - startPoint.x;
        const dy = endPoint.y - startPoint.y;
        if (dx * dx + dy * dy < DRAG_THRESHOLD_PX * DRAG_THRESHOLD_PX) return;

        // Query both centroid and extent layers — works at any zoom level
        // (low-zoom shows centroids, high-zoom shows extents).
        const minX = Math.min(startPoint.x, endPoint.x);
        const minY = Math.min(startPoint.y, endPoint.y);
        const maxX = Math.max(startPoint.x, endPoint.x);
        const maxY = Math.max(startPoint.y, endPoint.y);
        const features = map.queryRenderedFeatures(
          [[minX, minY], [maxX, maxY]] as [maplibregl.PointLike, maplibregl.PointLike],
          { layers: INTERACTIVE_LAYERS.filter(l => map.getLayer(l)) }
        );

        const siteIds = Array.from(new Set(
          features
            .map(f => String(f.properties?.site_id ?? ''))
            .filter(Boolean)
        ));
        if (siteIds.length > 0) onMultiFeatureSelectRef.current?.(siteIds);
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

      // ── Hover tooltip ────────────────────────────────────────────
      // One popup instance, reused. `pointer-events: none` via className
      // keeps the popup from swallowing mousemove events on the map below,
      // which would otherwise cause flicker. Single map-level mousemove
      // (vs. per-layer) avoids the gap when the cursor crosses from a
      // centroid circle onto the surrounding extent polygon.
      const hoverPopup = new maplibregl.Popup({
        closeButton: false,
        closeOnClick: false,
        offset: 12,
        className: 'fim-hover-popup',
      });
      let hoveredSiteId: string | null = null;

      map.on('mousemove', (e) => {
        const feats = map.queryRenderedFeatures(e.point, { layers: INTERACTIVE_LAYERS });
        if (feats.length === 0) {
          if (hoveredSiteId !== null) {
            hoveredSiteId = null;
            hoverPopup.remove();
          }
          return;
        }
        const siteId = String(feats[0].properties?.site_id ?? '');
        if (!siteId) {
          if (hoveredSiteId !== null) {
            hoveredSiteId = null;
            hoverPopup.remove();
          }
          return;
        }
        if (siteId === hoveredSiteId) return; // same feature — popup already correct

        hoveredSiteId = siteId;
        const rec = catalogRef.current.find(r => String(r.site_id) === siteId) ?? feats[0].properties;
        hoverPopup.setHTML(buildTooltipHtml(rec));
        if (!hoverPopup.isOpen()) {
          hoverPopup.setLngLat(e.lngLat).addTo(map).trackPointer();
        }
      });

      // Clear the tooltip when the cursor leaves the map canvas entirely.
      map.getCanvas().addEventListener('mouseleave', () => {
        if (hoveredSiteId !== null) {
          hoveredSiteId = null;
          hoverPopup.remove();
        }
      });

      // Re-apply selection emphasis after every map reload (e.g. basemap switch)
      applySelectionEmphasis(map, selectedSiteIdsRef.current, currentTierColorExpr(), zoomFocusSiteIdRef.current);

      map.on('moveend', emitFeatures);
      map.on('zoomend', emitFeatures);
      emitFeatures(); // emit once immediately after load
    });

    return () => {
      // Save view state before destroying so the replacement map restores it.
      viewStateRef.current = {
        center: map.getCenter().toArray(),
        zoom: map.getZoom(),
        bearing: map.getBearing(),
        pitch: map.getPitch(),
      };
      // Explicitly dismiss the click popup before removing the map so it
      // doesn't linger as a detached DOM node between basemap switches.
      currentClickPopupRef.current?.remove();
      currentClickPopupRef.current = null;
      map.remove();
    };
    // filters / onFeatureClick / onFeaturesChange are intentionally not deps:
    // we want the map re-initialized only on basemap switch. Subsequent filter
    // changes are handled by the dedicated filter-sync effect below; callbacks
    // are read through refs (emitFeaturesRef, filtersRef) inside event handlers.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

        // Emit unique HUC8 codes as a Set for O(1) membership checks.
        // HUC8 values stay as strings (leading zeros are significant).
        if (onCatalogHuc8s) {
          const all = catalogRef.current.flatMap(toHuc8Array);
          onCatalogHuc8s(new Set(all));
        }

        // Emit observed date bounds so the parent can seed the date filter with
        // real catalog coverage instead of hardcoded values.
        if (onCatalogDateBounds) {
          const bounds = computeDateBounds(catalogRef.current);
          if (bounds) onCatalogDateBounds(bounds);
        }

        // Populate the centroid source once catalog is loaded.
        // Check for the centroid source directly rather than isStyleLoaded() —
        // MapLibre v5 briefly marks the style as not loaded while reprocessing
        // layers added in the load handler, so isStyleLoaded() can return false
        // even after the load event has already fired.
        const map = mapRef.current;
        if (map) {
          const src = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
          if (src) {
            src.setData(buildCentroidGeoJSON(filtersRef.current));
            map.once('idle', () => emitFeaturesRef.current?.());
          } else {
            map.once('load', () => {
              const src2 = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
              src2?.setData(buildCentroidGeoJSON(filtersRef.current));
              map.once('idle', () => emitFeaturesRef.current?.());
            });
          }
        }
      })
      .catch(err => console.error('Failed to load catalog:', err));
    // Intentionally empty deps: catalog is fetched once on mount. `filters` and
    // the on-catalog callbacks are read via closure at that time only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    filtersRef.current = filters;
    const map = mapRef.current;
    if (!map || !map.isStyleLoaded()) return;

    const { tiers, states, huc8Id, startDate, endDate, returnPeriod } = filters;
    const isHucMode = isValidHuc8(huc8Id);
    const hasDateConstraint = !isHucMode && !!(startDate || endDate);

    // Update extent filter — always use catalog-based site_id filtering when any
    // filter beyond tier is active (return period applies in all modes).
    if (map.getLayer('fim-layer')) {
      if (isHucMode || states.length > 0 || hasDateConstraint || returnPeriod) {
        // Use catalog to compute allowed site_ids
        const allowedSiteIds = catalogRef.current
          .filter(r => recordMatchesFilters(r, filters))
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

    // Prune any selected features that no longer pass the updated filters.
    const currentIds = selectedSiteIdsRef.current;
    if (currentIds.size > 0) {
      const toPrune: string[] = [];
      for (const id of currentIds) {
        const rec = catalogRef.current.find(r => r.site_id === id);
        if (!rec) continue;
        if (!recordMatchesFilters(rec, filters)) toPrune.push(id);
      }
      if (toPrune.length > 0) onPruneSelections?.(toPrune);
    }
    // Deps enumerate each filter field explicitly so unrelated filter-object
    // identity changes don't re-fire; onFeatureClick is stable in practice
    // (App passes setSelectedSiteId / a closure, and re-firing on identity
    // would cause redundant work on every render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.tiers, filters.states, filters.huc8Id, filters.startDate, filters.endDate, filters.returnPeriod]);

  useEffect(() => {
    const ids = selectedSiteIds ?? new Set<string>();
    selectedSiteIdsRef.current = ids;
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applySelectionEmphasis(map, ids, currentTierColorExpr(), zoomFocusSiteIdRef.current);
  }, [selectedSiteIds]);

  // Re-apply tier colors whenever the color mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applySelectionEmphasis(map, selectedSiteIdsRef.current, buildTierColorExpr(tierColors(colorMode)), zoomFocusSiteIdRef.current);
  }, [colorMode]);

  useImperativeHandle(ref, () => ({
    zoomToBbox: (bbox, focusSiteId) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      if (!Array.isArray(bbox) || bbox.length !== 4) return;
      const [w, s, e, n] = bbox;
      if (!Number.isFinite(w) || !Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(n)) return;
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 16, duration: 800 });
      // Bump the focus target's z-order so it renders above its neighbours.
      zoomFocusSiteIdRef.current = focusSiteId ?? null;
      applySelectionEmphasis(map, selectedSiteIdsRef.current, currentTierColorExpr(), zoomFocusSiteIdRef.current);
    },
    clearPopup: () => {
      currentClickPopupRef.current?.remove();
      currentClickPopupRef.current = null;
    },
    resetSelectionVisuals: () => {
      const map = mapRef.current;
      if (!map?.isStyleLoaded()) return;
      zoomFocusSiteIdRef.current = null;
      currentClickPopupRef.current?.remove();
      currentClickPopupRef.current = null;
      selectedSiteIdsRef.current = new Set();
      applySelectionEmphasis(
        map,
        new Set(),
        currentTierColorExpr(),
        null,
      );
    },
  }), []);

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
          top: '0.625rem',
          left: '0.625rem',
          padding: '0.5rem',
          backgroundColor: 'rgba(255,255,255,0.85)',
          borderRadius: '0.25rem',
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
      {/* Map legend — bottom left */}
      {filters.tiers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: '1.75rem',
          left: '0.625rem',
          padding: '0.5rem 0.75rem',
          backgroundColor: 'rgba(255,255,255,0.88)',
          borderRadius: '0.25rem',
          boxShadow: '0 0.0625rem 0.25rem rgba(0,0,0,0.2)',
          fontSize: '0.75rem',
          lineHeight: 1.6,
          pointerEvents: 'none',
        }}>
          <div style={{ fontWeight: 600, marginBottom: '0.25rem' }}>FIM Tiers</div>
          {filters.tiers.map(tier => (
            <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <span style={{
                display: 'inline-block',
                width: '0.75rem',
                height: '0.75rem',
                borderRadius: '50%',
                backgroundColor: tierColors(colorMode)[tier] ?? '#aaa',
                flexShrink: 0,
              }} />
              <span>{TIER_LABELS[tier] ?? tier}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
});

export default Map;
