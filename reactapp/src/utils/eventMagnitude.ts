import type { CatalogRecord } from '../types/catalog';

// Recurrence-interval helpers shared by the map popup and the table Info modal.
//
// Since 2026-10-22 the catalog stores recurrence_usgs / recurrence_nwm as a
// number of years (50) or a bare bound ("< 2", "> 100"). Older data used
// "50 yr" / "> 100 yr" strings; both forms are accepted. When no value could
// be derived the same key holds a sentence instead ("No usable USGS Gauge",
// "NWM discharge unavailable: ..."), which is not usable for display.

export type RecurrenceValue = number | string;

const RECURRENCE_RE = /^\s*([<>]\s*)?\d+(\s*yr)?\s*$/i;

export function isUsableRecurrence(v: unknown): v is RecurrenceValue {
  if (typeof v === 'number') return Number.isFinite(v);
  return typeof v === 'string' && RECURRENCE_RE.test(v);
}

// 50 → "50-year"; "> 100" or "> 100 yr" → "> 100-year".
export function formatRecurrence(v: RecurrenceValue): string {
  return `${String(v).trim().replace(/\s*yr$/i, '')}-year`;
}

export type MagnitudeSource = {
  recurrenceUsgs: RecurrenceValue | null;
  recurrenceNwm: RecurrenceValue | null;
  gaugeId: string | null;
};

// One-line "Event magnitude" value for the map popup. USGS wins when usable,
// NWM is the fallback, and null means "omit the row".
export function eventMagnitude({ recurrenceUsgs, recurrenceNwm, gaugeId }: MagnitudeSource): string | null {
  if (isUsableRecurrence(recurrenceUsgs)) {
    const gauge = gaugeId ? ` gauge ${gaugeId}` : '';
    return `${formatRecurrence(recurrenceUsgs)} (USGS${gauge})`;
  }
  if (isUsableRecurrence(recurrenceNwm)) {
    return `${formatRecurrence(recurrenceNwm)} (NWM)`;
  }
  return null;
}

// Same value, read straight from a catalog record. The catalog carries the
// recurrence, discharge and gauge fields for every tier except FEMA BLE, so
// the popup can show the row without fetching metadata.
export function eventMagnitudeFromCatalog(rec: Partial<CatalogRecord>): string | null {
  return eventMagnitude({
    recurrenceUsgs: rec.recurrence_usgs ?? null,
    recurrenceNwm:  rec.recurrence_nwm ?? null,
    gaugeId:        rec.usgs_gauge_id ?? null,
  });
}
