import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import maplibregl, {
  type ExpressionSpecification,
  type LngLatLike,
  type RasterSourceSpecification,
  type StyleSpecification,
} from 'maplibre-gl';
import 'maplibre-gl/dist/maplibre-gl.css';
import type { Filters } from '../src/types/filters';
import type { CatalogRecord, FeatureProperties, Bbox } from '../src/types/catalog';

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

// HUC8 codes are strings (may have leading zeros — do NOT parse as numbers).
// Exactly 8 digit characters.
const HUC8_REGEX = /^\d{8}$/;
const isValidHuc8 = (s: string): boolean => HUC8_REGEX.test(s);

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

// Inlined download icon (from public/download-icon_svg-vector_svgrepo-com.svg).
// stroke="currentColor" means the icon automatically inherits the button's CSS
// text color, so it stays correct whether the button uses dark or white text.
const DOWNLOAD_ICON_SVG = `<svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style="flex-shrink:0;display:block"><path d="M17 17H17.01M17.4 14H18C18.9319 14 19.3978 14 19.7654 14.1522C20.2554 14.3552 20.6448 14.7446 20.8478 15.2346C21 15.6022 21 16.0681 21 17C21 17.9319 21 18.3978 20.8478 18.7654C20.6448 19.2554 20.2554 19.6448 19.7654 19.8478C19.3978 20 18.9319 20 18 20H6C5.06812 20 4.60218 20 4.23463 19.8478C3.74458 19.6448 3.35523 19.2554 3.15224 18.7654C3 18.3978 3 17.9319 3 17C3 16.0681 3 15.6022 3.15224 15.2346C3.35523 14.7446 3.74458 14.3552 4.23463 14.1522C4.60218 14 5.06812 14 6 14H6.6M12 15V4M12 15L9 12M12 15L15 12" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>`;

// Returns '#ffffff' or '#152428' depending on whether the hex background color
// is dark or light, using the YIQ perceived-brightness formula.
function buttonTextColor(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 >= 128 ? '#152428' : '#ffffff';
}

const FIM_DOWNLOAD_COLOR = '#25C2DF'; // matches "FIMBench" header text

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
    <div style="font-size:12px;line-height:1.45;min-width:180px">
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

  // Build download URLs — same logic as FIMTable.tsx
  const s3Prefix = typeof rec?.s3_prefix === 'string' ? rec.s3_prefix : '';
  const fileName = typeof rec?.file_name  === 'string' ? rec.file_name  : '';
  const minioPath = s3Prefix.replace(/^FIM_Database\//, '');
  const tifUrl  = s3Prefix && fileName
    ? `http://127.0.0.1:9000/fimbench/${minioPath}/${fileName}`
    : '';
  const metaUrl = s3Prefix && fileName
    ? `http://127.0.0.1:9000/fimbench/${minioPath}/${fileName.replace('_BM.tif', '_metadata.json')}`
    : '';

  // Only renders a table row when val is non-empty — no '—' placeholders.
  const row = (k: string, v: string) =>
    v ? `<tr>
           <td style="color:#000;font-weight:600;padding:2px 10px 2px 0;white-space:nowrap">${escapeHtml(k)}</td>
           <td>${escapeHtml(v)}</td>
         </tr>` : '';

  const mkBtnStyle = (bg: string, color: string) => [
    'display:inline-flex', 'align-items:center', 'gap:5px',
    'padding:4px 10px', 'font-size:12px', 'font-family:inherit',
    'border:1px solid #ccc', 'border-radius:4px',
    `background:${bg}`, `color:${color}`,
    'cursor:pointer', 'text-decoration:none', 'font-weight:500',
  ].join(';');

  const fimColor  = buttonTextColor(FIM_DOWNLOAD_COLOR);
  const fimStyle  = mkBtnStyle(FIM_DOWNLOAD_COLOR, fimColor);
  const metaStyle = mkBtnStyle('#f0f0f0', '#222222');

  const btn = (href: string, label: string, style: string) =>
    `<a href="${escapeHtml(href)}" target="_blank" rel="noreferrer" style="${style}">${DOWNLOAD_ICON_SVG}${escapeHtml(label)}</a>`;

  return `
    <div style="font-size:13px;line-height:1.5;min-width:220px">
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
      <div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap">
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
// Called both from the selectedSiteIds useEffect and inside map.on('load')
// so that basemap switches re-apply the current selection state.
function applySelectionEmphasis(map: maplibregl.Map, siteIds: Set<string>) {
  if (!map.getLayer('centroids-layer') || !map.getLayer('fim-layer')) return;

  if (siteIds.size === 0) {
    // Reset to default — no active selection
    map.setPaintProperty('centroids-layer', 'circle-color', TIER_COLOR_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-stroke-opacity', CENTROID_OPACITY_EXPR);
    map.setPaintProperty('centroids-layer', 'circle-radius', 7);
    map.setPaintProperty('fim-layer', 'fill-color', '#0067E1');
    map.setPaintProperty('fim-layer', 'fill-outline-color', '#003B8E');
    map.setPaintProperty('fim-layer', 'fill-opacity', EXTENT_OPACITY_EXPR);
  } else {
    const isSelected: ExpressionSpecification = ['in', ['get', 'site_id'], ['literal', [...siteIds]]];

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
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const viewStateRef = useRef<ViewState>(DEFAULT_VIEW);
  const [basemap, setBasemap] =
    useState<keyof typeof BASEMAPS>('Topographic');
  
  const catalogRef = useRef<CatalogRecord[]>([]);    // all catalog records, loaded once
  const selectedSiteIdsRef = useRef<Set<string>>(selectedSiteIds ?? new Set());  // readable inside map.on('load') closure
  const emitFeaturesRef = useRef<(() => void) | null>(null); // stable handle so async effects can call emitFeatures

  const filtersRef = useRef(filters);

  const buildCentroidGeoJSON = (f: Filters) => {
    const { tiers, states, huc8Id, startDate, endDate, returnPeriod } = f;
    const isHucMode = isValidHuc8(huc8Id);

    return {
      type: 'FeatureCollection' as const,
      features: catalogRef.current
        .filter(r => {
          if (!tiers.includes(r.tier)) return false;
          if (!returnPeriodMatches(r, returnPeriod)) return false;
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

    // Debug access
    // @ts-expect-error — expose map on window for manual console debugging
    window.map = map;

    mapRef.current = map;

    map.addControl(new maplibregl.NavigationControl(), 'top-right');

    map.on('error', (e) => {
      console.error('MapLibre error:', e.error);
    });

    const emitFeatures = () => {
      if (!onFeaturesChange) return;

      // Build allowed site_ids from catalog using current filters
      const { tiers, states, huc8Id, startDate, endDate, returnPeriod } = filtersRef.current;
      const isHucMode = isValidHuc8(huc8Id);
      const allowedIds = new Set<string>(
        catalogRef.current
          .filter(r => {
            if (!tiers.includes(r.tier)) return false;
            if (!returnPeriodMatches(r, returnPeriod)) return false;
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

      // Click popup — recreated on each click so the anchor direction can be
      // recalculated. closeOnClick:false means we manage dismissal manually.
      let currentClickPopup: maplibregl.Popup | null = null;

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

            currentClickPopup?.remove();
            currentClickPopup = new maplibregl.Popup({
              closeButton: true,
              closeOnClick: false,
              offset: 15,
              maxWidth: '300px',
              className: 'fim-click-popup',
              anchor,
            });
            currentClickPopup.setLngLat(coords).setHTML(buildClickPopupHtml(rec)).addTo(map);
            return;
          }
        }
        currentClickPopup?.remove();
        currentClickPopup = null;
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
      applySelectionEmphasis(map, selectedSiteIdsRef.current);

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
          const all = catalogRef.current.flatMap(r =>
            Array.isArray(r.huc8)
              ? r.huc8.map(String)
              : r.huc8 ? [String(r.huc8)] : []
          );
          onCatalogHuc8s(new Set(all));
        }

        // Emit observed date bounds so the parent can seed the date filter with
        // real catalog coverage instead of hardcoded values.
        if (onCatalogDateBounds) {
          const bounds = computeDateBounds(catalogRef.current);
          if (bounds) onCatalogDateBounds(bounds);
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
          .filter(r => {
            if (!tiers.includes(r.tier)) return false;
            if (!returnPeriodMatches(r, returnPeriod)) return false;
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

    // Prune any selected features that no longer pass the updated filters.
    const currentIds = selectedSiteIdsRef.current;
    if (currentIds.size > 0) {
      const toPrune: string[] = [];
      for (const id of currentIds) {
        const rec = catalogRef.current.find(r => r.site_id === id);
        if (!rec) continue;
        const tierOk = tiers.includes(rec.tier);
        const rpOk   = returnPeriodMatches(rec, returnPeriod);
        const stateOk = isHucMode || stateMatches(rec.state, states);
        const dateOk  = isHucMode || dateMatches(rec, startDate, endDate);
        let huc8Ok = true;
        if (isHucMode) {
          const huc8s: string[] = Array.isArray(rec.huc8)
            ? rec.huc8.map(String)
            : rec.huc8 ? [String(rec.huc8)] : [];
          huc8Ok = huc8s.some(h => h === huc8Id);
        }
        if (!tierOk || !rpOk || !huc8Ok || !stateOk || !dateOk) toPrune.push(id);
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
    applySelectionEmphasis(map, ids);
  }, [selectedSiteIds]);

  useImperativeHandle(ref, () => ({
    zoomToBbox: (bbox) => {
      const map = mapRef.current;
      if (!map || !Array.isArray(bbox) || bbox.length !== 4) return;
      const [w, s, e, n] = bbox;
      map.fitBounds([[w, s], [e, n]], { padding: 60, maxZoom: 16, duration: 800 });
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
          top: 10,
          left: 10,
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
      {/* Map legend — bottom left */}
      {filters.tiers.length > 0 && (
        <div style={{
          position: 'absolute',
          bottom: 28,
          left: 10,
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
});

export default Map;


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