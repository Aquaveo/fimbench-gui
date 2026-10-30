import type { CatalogRecord } from '../types/catalog';
import type { FIMRecord } from './parseRecord';
import { buildTifUrl, buildMetaUrl, buildGpkgUrl } from './minio';
import { formatYmd } from './dateFormat';

// Fallback sensor/platform name per tier, used only when a catalog record has
// no `platform` field (added upstream 2026-10-22).
export const PLATFORM_BY_TIER: Record<string, string> = {
  Tier_1:   'Aerial Imagery',
  Tier_2:   'Planet Scope Scene',
  Tier_3:   'Sentinel-1A',
  HWM:      'High Water Mark',
  FEMA_BLE: 'Base Level Engineering',
};

const joinOrDash = (v: unknown): string =>
  Array.isArray(v) ? v.join(', ') : (typeof v === 'string' ? v : '—');
const strOrNull = (v: unknown): string | null => (typeof v === 'string' && v !== '' ? v : null);
const numOrNull = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);
const recurrenceOrNull = (v: unknown): number | string | null => numOrNull(v) ?? strOrNull(v);

// Build the table/Info-modal display record straight from a catalog record.
// Produces the same shape and values as parseRecord(metadata JSON), so the
// table no longer needs one metadata request per visible row.
export function recordFromCatalog(rec: CatalogRecord): FIMRecord {
  const event = rec.date_ymd ?? '';
  const start = rec.start_date_ymd ?? '';
  const end   = rec.end_date_ymd ?? '';

  let year = '—';
  let date = '—';
  let dateSortKey = '';
  if (event) {
    year = event.slice(0, 4);
    date = formatYmd(event);
    dateSortKey = formatYmd(event);
  } else if (start) {
    year = start.slice(0, 4);
    date = end && end !== start ? `${formatYmd(start)} – ${formatYmd(end)}` : formatYmd(start);
    dateSortKey = formatYmd(start);
  }

  const rp = rec.return_period;
  const returnPeriod: number | null =
    rp != null && rp !== '' && Number.isFinite(Number(rp)) ? Number(rp) : null;

  return {
    siteId:       rec.site_id,
    riverBasin:   joinOrDash(rec.basin),
    state:        typeof rec.state === 'string' ? rec.state : '—',
    year,
    date,
    dateSortKey,
    resolution:   numOrNull(rec.resolution_m) ?? 0,
    huc8:         joinOrDash(rec.huc8),
    productCategory: rec.product_category || rec.quality || (start ? 'HWM' : '—'),
    platform:     strOrNull(rec.platform) ?? PLATFORM_BY_TIER[rec.tier] ?? '—',
    returnPeriod,
    recurrenceUsgs:  recurrenceOrNull(rec.recurrence_usgs),
    recurrenceNwm:   recurrenceOrNull(rec.recurrence_nwm),
    dischargeUsgs:   numOrNull(rec.discharge_usgs_cms),
    dischargeNwm:    numOrNull(rec.discharge_nwm_cms),
    gaugeId:         strOrNull(rec.usgs_gauge_id),
    acquisitionTime: strOrNull(rec.acquisition_time_utc),
    source:          strOrNull(rec.source),
    accessRights:    strOrNull(rec.access_rights),
    description:     strOrNull(rec.description),
    references:      Array.isArray(rec.references) ? rec.references.map(String) : [],
    bbox:     rec.bbox,
    s3Prefix: rec.s3_prefix,
    tifUrl:   buildTifUrl(rec.s3_prefix, rec.file_name),
    metaUrl:  buildMetaUrl(rec.s3_prefix, rec.file_name),
    gpkgUrl:  buildGpkgUrl(rec.s3_prefix, rec.file_name),
  };
}
