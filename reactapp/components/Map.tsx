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
import { buildTifUrl, buildMetaUrl } from '../src/utils/minio';
import { pickContrastColor } from '../src/utils/contrast';
import { DOWNLOAD_ICON_SVG } from './DownloadIcon';
import { COLORS } from '../src/theme';

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

// Scan every record's date_ymd / start_date_ymd / end_date_ymd for valid
// YYYY-MM-DD strings and return the min/max. Returns null if no valid dates
// exist (e.g. a catalog full of Tier 4 synthetic events with only return periods).
function computeDateBounds(records: CatalogRecord[]): { minDate: string; maxDate: string } | null {
  let min: string | null = null;
  let max: string | null = null;
  const consider = (v: unknown) => {
    if (typeof v !== 'string' || !YMD_REGEX.test(v)) return;
    if (min === null || v < min) min = v;
    if (max === null || v > max) max = v;
  };
  for (const r of records) {
    consider(r.date_ymd);
    consider(r.start_date_ymd);
    consider(r.end_date_ymd);
  }
  return min && max ? { minDate: min, maxDate: max } : null;
}

// Returns true if the record's return period matches the selected filter.
// Records with no return_period (null/undefined) always pass — only Tier 4 (FEMA BLE)
// records carry this field; everything else is event-based and has no return period.
function returnPeriodMatches(record: CatalogRecord, selectedPeriod: string): boolean {
  const rp = record.return_period;
  if (rp == null) return true;
  return String(rp) === selectedPeriod;
}

// Returns true if the record's date (single or range) overlaps the filter window.
// Records with no valid date info are included (we don't hide data we can't place in time).
// All inputs are parsed via parseYmd; malformed or empty values become unconstrained
// bounds (filter side) or are treated as missing (record side).
function dateMatches(record: CatalogRecord, startDate: string, endDate: string): boolean {
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

// Single source of truth for whether a catalog record passes the active filters.
// HUC mode (valid 8-digit huc8Id) bypasses state and date checks — HUC-based
// filtering is logically separate per the original filter spec.
function recordMatchesFilters(rec: CatalogRecord, f: Filters): boolean {
  const { tiers, states, huc8Id, startDate, endDate, returnPeriod } = f;
  if (!tiers.includes(rec.tier)) return false;
  if (!returnPeriodMatches(rec, returnPeriod)) return false;
  if (isValidHuc8(huc8Id)) {
    return toHuc8Array(rec).some(h => h === huc8Id);
  }
  if (!stateMatches(rec.state, states)) return false;
  if (!dateMatches(rec, startDate, endDate)) return false;
  return true;
}

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
  const single = typeof rec?.date_ymd === 'string' ? rec.date_ymd : '';
  if (single) return { label: 'Date', value: single };
  const s = typeof rec?.start_date_ymd === 'string' ? rec.start_date_ymd : '';
  const e = typeof rec?.end_date_ymd   === 'string' ? rec.end_date_ymd   : '';
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

function buildTooltipHtml(rec: Partial<CatalogRecord>): string {
  const tierLabel = (rec?.tier && TIER_LABELS[rec.tier]) ?? rec?.tier ?? '';
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
      ${line('Tier',   tierLabel)}
      ${line('Basin',  basinStr)}
      ${line('State',  stateStr)}
      ${line('HUC8',   huc8Str)}
      ${hasDate ? line(label, value) : ''}
    </div>
  `;
}

function buildClickPopupHtml(rec: Partial<CatalogRecord>): string {
  const tierLabel = (rec?.tier && TIER_LABELS[rec.tier]) ?? rec?.tier ?? '';
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
        ${row('Tier',       tierLabel)}
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
// Takes tierColorExpr so colorMode changes re-apply the right palette.
function applySelectionEmphasis(
  map: maplibregl.Map,
  siteIds: Set<string>,
  tierColorExpr: ExpressionSpecification,
) {
  if (!map.getLayer('centroids-layer') || !map.getLayer('fim-layer')) return;

  if (siteIds.size === 0) {
    map.setPaintProperty('centroids-layer', 'circle-color', tierColorExpr);
    map.setPaintProperty('centroids-layer', 'circle-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-stroke-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-radius', 7);
    map.setPaintProperty('fim-layer', 'fill-color', '#0067E1');
    map.setPaintProperty('fim-layer', 'fill-outline-color', '#003B8E');
    map.setPaintProperty('fim-layer', 'fill-opacity', EXTENT_OPACITY_EXPR);
    map.setLayoutProperty('centroids-layer', 'circle-sort-key', TIER_SORT_EXPR);
    map.setLayoutProperty('fim-layer', 'fill-sort-key', TIER_SORT_EXPR);
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
    map.setLayoutProperty('centroids-layer', 'circle-sort-key', [
      'case', isSelected, 10, TIER_SORT_EXPR,
    ]);
    map.setLayoutProperty('fim-layer', 'fill-sort-key', [
      'case', isSelected, 10, TIER_SORT_EXPR,
    ]);
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
  selectedSiteIds?: Set<string>;
};

export type MapHandle = {
  zoomToBbox: (bbox: Bbox) => void;
  clearPopup: () => void;
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
  { filters, onFeaturesChange, onFeatureClick, onCatalogStates, onCatalogHuc8s, onCatalogDateBounds, onPruneSelections, selectedSiteIds },
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

  const filtersRef = useRef(filters);

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
      const initTierColorExpr = buildTierColorExpr(tierColors(colorModeRef.current));
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
          hoverPopup.addTo(map).trackPointer();
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
      applySelectionEmphasis(map, selectedSiteIdsRef.current, buildTierColorExpr(tierColors(colorModeRef.current)));

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
        // If the map style is already loaded, update immediately.
        // If the map is still initializing, wait for its 'load' event —
        // otherwise the setData call is a no-op (source doesn't exist yet).
        const map = mapRef.current;
        if (map?.isStyleLoaded()) {
          const src = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
          src?.setData(buildCentroidGeoJSON(filtersRef.current));
          map.once('idle', () => emitFeaturesRef.current?.());
        } else if (map) {
          map.once('load', () => {
            const src = map.getSource('centroids') as maplibregl.GeoJSONSource | undefined;
            src?.setData(buildCentroidGeoJSON(filtersRef.current));
            map.once('idle', () => emitFeaturesRef.current?.());
          });
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
    applySelectionEmphasis(map, ids, buildTierColorExpr(tierColors(colorModeRef.current)));
  }, [selectedSiteIds]);

  // Re-apply tier colors whenever the color mode changes
  useEffect(() => {
    const map = mapRef.current;
    if (!map?.isStyleLoaded()) return;
    applySelectionEmphasis(map, selectedSiteIdsRef.current, buildTierColorExpr(tierColors(colorMode)));
  }, [colorMode]);

  useImperativeHandle(ref, () => ({
    zoomToBbox: (bbox) => {
      const map = mapRef.current;
      if (!map || !map.isStyleLoaded()) return;
      if (!Array.isArray(bbox) || bbox.length !== 4) return;
      const [w, s, e, n] = bbox;
      if (!Number.isFinite(w) || !Number.isFinite(s) || !Number.isFinite(e) || !Number.isFinite(n)) return;
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 16, duration: 800 });
    },
    clearPopup: () => {
      currentClickPopupRef.current?.remove();
      currentClickPopupRef.current = null;
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
