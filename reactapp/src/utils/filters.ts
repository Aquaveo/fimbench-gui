import type { CatalogRecord } from '../types/catalog';
import { isValidHuc8, toHuc8Array } from '../types/catalog';
import type { Filters } from '../types/filters';

// Parse a record's state field (string, comma-separated, or array) into an array of abbreviations.
export function parseStates(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') return raw.split(',').map(s => s.trim()).filter(Boolean);
  return [];
}

// Returns true if the record's states overlap with any of the selected states.
export function stateMatches(recordState: unknown, selected: string[]): boolean {
  if (selected.length === 0) return true;
  const recStates = parseStates(recordState);
  return recStates.some(s => selected.includes(s));
}

// Safely parse a strict YYYY-MM-DD string into a UTC timestamp.
// Returns null for anything that doesn't match YYYY-MM-DD exactly.
// The regex gate is important because new Date() is lenient — it would otherwise accept
// "2010", "2010-3-29", "03/29/2010", etc.
// Note: JS Date silently overflows out-of-range days (e.g. Feb 30 → Mar 2) rather
// than returning NaN, so impossible calendar dates are not rejected.
export const YMD_REGEX = /^\d{4}-\d{2}-\d{2}$/;
export function parseYmd(str: unknown): number | null {
  if (typeof str !== 'string' || !YMD_REGEX.test(str)) return null;
  const ts = new Date(str).getTime();
  return Number.isNaN(ts) ? null : ts;
}

// Scan every record's date_ymd / start_date_ymd / end_date_ymd for valid
// YYYY-MM-DD strings and return the min/max. Returns null if no valid dates
// exist (e.g. a catalog full of Tier 4 synthetic events with only return periods).
export function computeDateBounds(records: CatalogRecord[]): { minDate: string; maxDate: string } | null {
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
export function returnPeriodMatches(record: CatalogRecord, selectedPeriod: string): boolean {
  const rp = record.return_period;
  if (rp == null) return true;
  return String(rp) === selectedPeriod;
}

// Returns true if the record's date (single or range) overlaps the filter window.
// Records with no valid date info are included (we don't hide data we can't place in time).
// All inputs are parsed via parseYmd; malformed or empty values become unconstrained
// bounds (filter side) or are treated as missing (record side).
export function dateMatches(record: CatalogRecord, startDate: string, endDate: string): boolean {
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
export function recordMatchesFilters(rec: CatalogRecord, f: Filters): boolean {
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
