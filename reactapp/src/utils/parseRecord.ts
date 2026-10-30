import type { Bbox } from '../types/catalog';
import { buildTifUrl, buildMetaUrl, buildGpkgUrl } from './minio';
import { formatYmd } from './dateFormat';

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asNumber = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ── Normalize one metadata JSON into a display record ─────────
export function parseRecord(j: Record<string, unknown>, s3Prefix: string, fileName: string, siteId: string, bbox: Bbox | undefined, catalogProductCategory?: string) {
  const basinRaw = j['River Basin Name'];
  const basin = Array.isArray(basinRaw)
    ? basinRaw.join(', ')
    : (typeof basinRaw === 'string' ? basinRaw : '—');

  const huc8Raw = j['HUC8'];
  const huc8 = Array.isArray(huc8Raw)
    ? huc8Raw.join(', ')
    : (typeof huc8Raw === 'string' ? huc8Raw : '—');

  const rawEvent  = asString(j['Flooding Event']);
  const startDate = asString(j['Start Date of the Flood']);
  const endDate   = asString(j['End Date of the Flood']);

  // Keep a sortable ISO date string alongside the display string
  let year = '—';
  let date = '—';
  let dateSortKey = '';   // ISO string for reliable date sorting

  if (rawEvent) {
    year = rawEvent.slice(0, 4);
    date = formatYmd(rawEvent);
    dateSortKey = formatYmd(rawEvent);
  } else if (startDate) {
    year = startDate.slice(0, 4);
    date = endDate && endDate !== startDate
      ? `${formatYmd(startDate)} – ${formatYmd(endDate)}`
      : formatYmd(startDate);
    dateSortKey = formatYmd(startDate);
  }

  let platform =
    asString(j['Full form of the sensor code']) ||
    asString(j['Sensor']) ||
    asString(j['Platform']) ||
    '';
  if (!platform && j['BLE']) platform = 'Base Level Engineering (FEMA BLE)';
  if (!platform) platform = '—';

  // Product category: catalog value first, then the metadata key ("Product
  // Category" since the Oct 2026 rewrite, "Quality" before it), then the
  // legacy fallback. Was displayed as "Quality" until FIMBENCH-FE13.
  const categoryRaw = j['Product Category'] ?? j['Quality'];
  const productCategory =
    catalogProductCategory ||
    (typeof categoryRaw === 'string' ? categoryRaw : (startDate ? 'HWM' : '—'));

  // Return period comes only on Tier 4 (FEMA BLE) metadata; absent on everything else.
  const rpRaw = j['Synthetic Flooding Event (return period (years))'];
  const returnPeriod: number | null =
    rpRaw != null && rpRaw !== '' && Number.isFinite(Number(rpRaw))
      ? Number(rpRaw)
      : null;

  const stateRaw = j['State'];

  // Event magnitude, provenance and access fields (metadata rewritten Oct 2026).
  // Recurrence strings are kept raw — they may be an "unavailable" sentence rather
  // than a value; see isUsableRecurrence() in eventMagnitude.ts.
  const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
  const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
  const recurrenceOrNull = (v: unknown): number | string | null => numOrNull(v) ?? strOrNull(v);
  const gaugeRaw = j['USGS Gauge ID'];
  const gaugeId: string | null =
    typeof gaugeRaw === 'number' ? String(gaugeRaw) : strOrNull(gaugeRaw);
  const refsRaw = j['References'];
  const references: string[] = Array.isArray(refsRaw) ? refsRaw.map(String) : [];

  return {
    siteId,
    riverBasin:   basin,
    state:        typeof stateRaw === 'string' ? stateRaw : '—',
    year,
    date,
    dateSortKey,
    resolution:   asNumber(j['Resolution in meter']),
    huc8,
    productCategory,
    platform,
    returnPeriod,
    recurrenceUsgs:  recurrenceOrNull(j['Event Recurrence Interval (USGS)']),
    recurrenceNwm:   recurrenceOrNull(j['Event Recurrence Interval (NWM)']),
    dischargeUsgs:   numOrNull(j['Event Discharge (USGS) [cms]']),
    dischargeNwm:    numOrNull(j['Event Discharge (NWM) [cms]']),
    gaugeId,
    acquisitionTime: strOrNull(j['Acquisition Time in UTC']),
    source:          strOrNull(j['Source']),
    accessRights:    strOrNull(j['Access_Rights']),
    description:     strOrNull(j['Description']),
    references,
    bbox,
    s3Prefix,
    tifUrl:  buildTifUrl(s3Prefix, fileName),
    metaUrl: buildMetaUrl(s3Prefix, fileName),
    gpkgUrl: buildGpkgUrl(s3Prefix, fileName),
  };
}

export type FIMRecord = ReturnType<typeof parseRecord>;
