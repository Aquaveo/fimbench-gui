import { describe, it, expect } from 'vitest';
import { isUsableRecurrence, formatRecurrence, eventMagnitude } from './eventMagnitude';

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
    expect(isUsableRecurrence(50)).toBe(false);
  });
});

describe('formatRecurrence', () => {
  it('turns "N yr" into "N-year" and keeps the bound sign', () => {
    expect(formatRecurrence('50 yr')).toBe('50-year');
    expect(formatRecurrence('> 100 yr')).toBe('> 100-year');
    expect(formatRecurrence('< 2 yr')).toBe('< 2-year');
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
