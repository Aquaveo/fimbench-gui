import type { Bbox } from './catalog';

// Display record behind the results table, the Info modal and the exports.
// Built from a catalog record by recordFromCatalog(); the per-record metadata
// JSON is no longer read by the app (its keys were renamed upstream in Oct 2026
// and the catalog carries everything the UI shows — FIMBENCH-FE17).
export type FIMRecord = {
  siteId: string;
  riverBasin: string;
  state: string;
  year: string;
  date: string;
  dateSortKey: string;          // ISO YYYY-MM-DD for sorting; '' when undated
  resolution: number;
  huc8: string;
  productCategory: string;
  platform: string;
  returnPeriod: number | null;
  // Event magnitude. Recurrence is a number of years, a bare bound ("< 2",
  // "> 100"), or an "unavailable" sentence; see isUsableRecurrence().
  recurrenceUsgs: number | string | null;
  recurrenceNwm: number | string | null;
  dischargeUsgs: number | null;
  dischargeNwm: number | null;
  gaugeId: string | null;
  acquisitionTime: string | null;
  source: string | null;
  accessRights: string | null;
  description: string | null;
  references: string[];
  bbox: Bbox | undefined;
  s3Prefix: string;
  tifUrl: string;
  metaUrl: string;
  gpkgUrl: string;
};
