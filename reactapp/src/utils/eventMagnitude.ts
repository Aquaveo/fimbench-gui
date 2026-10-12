// Recurrence-interval helpers shared by the map popup and the table Info modal.
//
// Upstream metadata stores "Event Recurrence Interval (USGS|NWM)" as a short
// string such as "50 yr", "> 100 yr" or "< 2 yr". When no value could be
// derived the same key holds a sentence instead ("No usable USGS Gauge",
// "NWM discharge unavailable: ..."). Only the short form is usable for display.

const RECURRENCE_RE = /^\s*([<>]\s*)?\d+\s*yr\s*$/i;

export function isUsableRecurrence(v: unknown): v is string {
  return typeof v === 'string' && RECURRENCE_RE.test(v);
}

// "50 yr" → "50-year"; "> 100 yr" → "> 100-year".
export function formatRecurrence(v: string): string {
  return v.trim().replace(/\s*yr$/i, '-year');
}

export type MagnitudeSource = {
  recurrenceUsgs: string | null;
  recurrenceNwm: string | null;
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
