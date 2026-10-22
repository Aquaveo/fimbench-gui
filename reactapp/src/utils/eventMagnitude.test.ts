import { describe, it, expect } from 'vitest';
import { isUsableRecurrence, formatRecurrence, eventMagnitude, eventMagnitudeFromCatalog } from './eventMagnitude';

describe('isUsableRecurrence', () => {
  it('accepts plain, bounded-above and bounded-below year values', () => {
    expect(isUsableRecurrence('50 yr')).toBe(true);
    expect(isUsableRecurrence('> 100 yr')).toBe(true);
    expect(isUsableRecurrence('< 2 yr')).toBe(true);
  });

  it('rejects the "no gauge" and "unavailable" sentences, null and non-strings', () => {
    expect(isUsableRecurrence('No usable USGS Gauge')).toBe(false);
    expect(isUsableRecurrence('NWM discharge unavailable: retrospective discharge empty/NaN between 2011-04-10 and 2011-04-14')).toBe(false);
    expect(isUsableRecurrence(null)).toBe(false);
    expect(isUsableRecurrence(undefined)).toBe(false);
    expect(isUsableRecurrence(NaN)).toBe(false);
  });

  it('accepts the 2026-10-22 catalog forms: plain numbers and bare "< 2" / "> 100"', () => {
    expect(isUsableRecurrence(50)).toBe(true);
    expect(isUsableRecurrence(2)).toBe(true);
    expect(isUsableRecurrence('< 2')).toBe(true);
    expect(isUsableRecurrence('> 100')).toBe(true);
  });
});

describe('formatRecurrence', () => {
  it('turns "N yr" into "N-year" and keeps the bound sign', () => {
    expect(formatRecurrence('50 yr')).toBe('50-year');
    expect(formatRecurrence('> 100 yr')).toBe('> 100-year');
    expect(formatRecurrence('< 2 yr')).toBe('< 2-year');
  });

  it('formats numbers and bare bounds the same way', () => {
    expect(formatRecurrence(50)).toBe('50-year');
    expect(formatRecurrence('< 2')).toBe('< 2-year');
    expect(formatRecurrence('> 100')).toBe('> 100-year');
  });
});

describe('eventMagnitude', () => {
  it('prefers USGS and names the gauge', () => {
    expect(eventMagnitude({ recurrenceUsgs: '50 yr', recurrenceNwm: '< 2 yr', gaugeId: '05064500' }))
      .toBe('50-year (USGS gauge 05064500)');
  });

  it('omits the gauge id when USGS has none', () => {
    expect(eventMagnitude({ recurrenceUsgs: '25 yr', recurrenceNwm: null, gaugeId: null }))
      .toBe('25-year (USGS)');
  });

  it('falls back to NWM when USGS is unusable', () => {
    expect(eventMagnitude({ recurrenceUsgs: 'No usable USGS Gauge', recurrenceNwm: '< 2 yr', gaugeId: null }))
      .toBe('< 2-year (NWM)');
  });

  it('returns null when neither source is usable', () => {
    expect(eventMagnitude({ recurrenceUsgs: 'No usable USGS Gauge', recurrenceNwm: 'NWM discharge unavailable: x', gaugeId: null }))
      .toBeNull();
    expect(eventMagnitude({ recurrenceUsgs: null, recurrenceNwm: null, gaugeId: null })).toBeNull();
  });
});

describe('eventMagnitudeFromCatalog', () => {
  it('reads the catalog recurrence and gauge fields', () => {
    expect(eventMagnitudeFromCatalog({
      recurrence_usgs: '50 yr', recurrence_nwm: '25 yr', usgs_gauge_id: '05416900',
    })).toBe('50-year (USGS gauge 05416900)');
  });

  it('falls back to NWM when the USGS value is a sentence or the gauge is null', () => {
    expect(eventMagnitudeFromCatalog({
      recurrence_usgs: 'No usable USGS Gauge', recurrence_nwm: '2 yr', usgs_gauge_id: null,
    })).toBe('2-year (NWM)');
  });

  it('handles numeric USGS and bare-bound NWM values from the current catalog', () => {
    expect(eventMagnitudeFromCatalog({
      recurrence_usgs: 5, recurrence_nwm: '< 2', usgs_gauge_id: '02089000',
    })).toBe('5-year (USGS gauge 02089000)');
    expect(eventMagnitudeFromCatalog({
      recurrence_usgs: 'No usable USGS Gauge', recurrence_nwm: '> 100', usgs_gauge_id: null,
    })).toBe('> 100-year (NWM)');
  });

  it('returns null for a record without the fields (FEMA BLE)', () => {
    expect(eventMagnitudeFromCatalog({})).toBeNull();
  });
});
