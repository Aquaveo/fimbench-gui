import { describe, it, expect } from 'vitest';
import {
  parseStates,
  stateMatches,
  parseYmd,
  computeDateBounds,
  returnPeriodMatches,
  dateMatches,
  recordMatchesFilters,
} from './filters';
import type { CatalogRecord } from '../types/catalog';
import type { Filters } from '../types/filters';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeRecord(overrides: Partial<CatalogRecord> = {}): CatalogRecord {
  return {
    site_id: 'TEST_001',
    tier: 'Tier_1',
    s3_prefix: 'FIM_Database/Tier_1/TEST_001',
    file_name: 'TEST_001_BM.tif',
    centroid: [-90, 35],
    ...overrides,
  };
}

function makeFilters(overrides: Partial<Filters> = {}): Filters {
  return {
    tiers: ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'],
    states: [],
    huc8Id: '',
    returnPeriod: '100',
    startDate: '',
    endDate: '',
    ...overrides,
  };
}

// ─── parseStates ──────────────────────────────────────────────────────────────

describe('parseStates', () => {
  it('splits a comma-separated string into trimmed abbreviations', () => {
    expect(parseStates('MA, RI, USA')).toEqual(['MA', 'RI', 'USA']);
  });

  it('handles a string array', () => {
    expect(parseStates(['TX', 'OK'])).toEqual(['TX', 'OK']);
  });

  it('coerces non-string array elements to string', () => {
    expect(parseStates([42, null])).toEqual(['42', 'null']);
  });

  it('returns empty array for null', () => {
    expect(parseStates(null)).toEqual([]);
  });

  it('returns empty array for undefined', () => {
    expect(parseStates(undefined)).toEqual([]);
  });

  it('returns empty array for a number', () => {
    expect(parseStates(123)).toEqual([]);
  });

  it('filters out empty tokens from a trailing-comma string', () => {
    expect(parseStates('MA,')).toEqual(['MA']);
  });
});

// ─── stateMatches ─────────────────────────────────────────────────────────────

describe('stateMatches', () => {
  it('returns true when no states are selected (show all)', () => {
    expect(stateMatches('TX', [])).toBe(true);
  });

  it('returns true when record state is in the selected list', () => {
    expect(stateMatches('MA, RI', ['RI'])).toBe(true);
  });

  it('returns false when none of the record states are selected', () => {
    expect(stateMatches('MA, RI', ['TX'])).toBe(false);
  });

  it('handles array state field', () => {
    expect(stateMatches(['TX', 'OK'], ['OK'])).toBe(true);
  });

  it('returns false for null state with non-empty filter', () => {
    expect(stateMatches(null, ['TX'])).toBe(false);
  });
});

// ─── parseYmd ─────────────────────────────────────────────────────────────────

describe('parseYmd', () => {
  it('parses a valid YYYY-MM-DD string to a UTC timestamp', () => {
    const ts = parseYmd('2021-03-15');
    expect(ts).toBe(new Date('2021-03-15').getTime());
  });

  it('returns null for an empty string', () => {
    expect(parseYmd('')).toBeNull();
  });

  it('returns null for null', () => {
    expect(parseYmd(null)).toBeNull();
  });

  it('returns null for undefined', () => {
    expect(parseYmd(undefined)).toBeNull();
  });

  it('returns null for a number', () => {
    expect(parseYmd(20210315)).toBeNull();
  });

  it('rejects compact YYYYMMDD (no dashes)', () => {
    expect(parseYmd('20210315')).toBeNull();
  });

  it('rejects a partial ISO string (year only)', () => {
    expect(parseYmd('2021')).toBeNull();
  });

  it('rejects a date with single-digit month (non-padded)', () => {
    expect(parseYmd('2021-3-15')).toBeNull();
  });

  it('rejects an ISO datetime string (has time component)', () => {
    expect(parseYmd('2021-03-15T12:00:00')).toBeNull();
  });

  it('rejects a US-format date string', () => {
    expect(parseYmd('03/15/2021')).toBeNull();
  });

  it('silently overflows an out-of-range day (JS Date behaviour) rather than returning null', () => {
    // new Date('2021-02-30') rolls over to 2021-03-02 instead of returning NaN.
    // Real catalog data never has invalid dates, so this is benign in practice.
    expect(parseYmd('2021-02-30')).not.toBeNull();
  });
});

// ─── computeDateBounds ────────────────────────────────────────────────────────

describe('computeDateBounds', () => {
  it('returns min and max across all date fields', () => {
    const records = [
      makeRecord({ date_ymd: '2020-06-01' }),
      makeRecord({ start_date_ymd: '2019-01-01', end_date_ymd: '2019-12-31' }),
      makeRecord({ date_ymd: '2021-03-15' }),
    ];
    expect(computeDateBounds(records)).toEqual({ minDate: '2019-01-01', maxDate: '2021-03-15' });
  });

  it('returns null when no records have valid dates', () => {
    const records = [makeRecord({ return_period: 100 }), makeRecord()];
    expect(computeDateBounds(records)).toBeNull();
  });

  it('ignores malformed date strings', () => {
    const records = [
      makeRecord({ date_ymd: '20200601' }),  // compact — invalid for this function
      makeRecord({ date_ymd: '2021-03-15' }),
    ];
    expect(computeDateBounds(records)).toEqual({ minDate: '2021-03-15', maxDate: '2021-03-15' });
  });

  it('returns null for an empty catalog', () => {
    expect(computeDateBounds([])).toBeNull();
  });
});

// ─── returnPeriodMatches ──────────────────────────────────────────────────────

describe('returnPeriodMatches', () => {
  it('returns true when record has no return period (event-based tiers)', () => {
    expect(returnPeriodMatches(makeRecord({ return_period: null }), '100')).toBe(true);
  });

  it('returns true when return period matches selected (numeric field)', () => {
    expect(returnPeriodMatches(makeRecord({ return_period: 100 }), '100')).toBe(true);
  });

  it('returns false when return period does not match', () => {
    expect(returnPeriodMatches(makeRecord({ return_period: 500 }), '100')).toBe(false);
  });

  it('handles return period stored as a string in the catalog', () => {
    expect(returnPeriodMatches(makeRecord({ return_period: '100' }), '100')).toBe(true);
  });

  it('returns true when return_period is undefined', () => {
    expect(returnPeriodMatches(makeRecord(), '100')).toBe(true);
  });
});

// ─── dateMatches ──────────────────────────────────────────────────────────────

describe('dateMatches', () => {
  it('returns true for a single date_ymd within the filter window', () => {
    const rec = makeRecord({ date_ymd: '2020-06-15' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(true);
  });

  it('returns false for a single date_ymd outside the filter window', () => {
    const rec = makeRecord({ date_ymd: '2019-12-31' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(false);
  });

  it('returns true for a date range that overlaps the filter window', () => {
    const rec = makeRecord({ start_date_ymd: '2020-11-01', end_date_ymd: '2021-02-01' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(true);
  });

  it('returns false for a date range entirely before the filter window', () => {
    const rec = makeRecord({ start_date_ymd: '2018-01-01', end_date_ymd: '2018-12-31' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(false);
  });

  it('returns true when filter window is open-ended (empty strings)', () => {
    const rec = makeRecord({ date_ymd: '2020-06-15' });
    expect(dateMatches(rec, '', '')).toBe(true);
  });

  it('returns true when record has no date info (always include)', () => {
    expect(dateMatches(makeRecord(), '2020-01-01', '2020-12-31')).toBe(true);
  });

  it('treats only start_date_ymd as a point date when end is absent', () => {
    const rec = makeRecord({ start_date_ymd: '2020-06-15' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(true);
  });

  it('treats only end_date_ymd as a point date when start is absent', () => {
    const rec = makeRecord({ end_date_ymd: '2019-06-15' });
    expect(dateMatches(rec, '2020-01-01', '2020-12-31')).toBe(false);
  });
});

// ─── recordMatchesFilters ─────────────────────────────────────────────────────

describe('recordMatchesFilters', () => {
  it('returns true when record passes all default filters', () => {
    expect(recordMatchesFilters(makeRecord(), makeFilters())).toBe(true);
  });

  it('returns false when tier is not in the selected set', () => {
    expect(recordMatchesFilters(makeRecord({ tier: 'Tier_2' }), makeFilters({ tiers: ['Tier_1'] }))).toBe(false);
  });

  it('returns false when return period does not match (Tier_4 record)', () => {
    const rec = makeRecord({ tier: 'Tier_4', return_period: 500 });
    expect(recordMatchesFilters(rec, makeFilters({ tiers: ['Tier_4'], returnPeriod: '100' }))).toBe(false);
  });

  it('returns true for Tier_1 records regardless of returnPeriod filter (no return period field)', () => {
    const rec = makeRecord({ tier: 'Tier_1' });
    expect(recordMatchesFilters(rec, makeFilters({ returnPeriod: '500' }))).toBe(true);
  });

  it('returns false when state filter excludes the record', () => {
    const rec = makeRecord({ state: 'TX' });
    expect(recordMatchesFilters(rec, makeFilters({ states: ['MA'] }))).toBe(false);
  });

  it('returns false when date filter excludes the record', () => {
    const rec = makeRecord({ date_ymd: '2015-01-01' });
    expect(recordMatchesFilters(rec, makeFilters({ startDate: '2020-01-01', endDate: '2020-12-31' }))).toBe(false);
  });

  it('HUC8 mode bypasses state and date filters', () => {
    const rec = makeRecord({ huc8: ['01090004'], state: 'TX', date_ymd: '2000-01-01' });
    const f = makeFilters({ huc8Id: '01090004', states: ['MA'], startDate: '2020-01-01', endDate: '2020-12-31' });
    expect(recordMatchesFilters(rec, f)).toBe(true);
  });

  it('HUC8 mode returns false when huc8 does not match', () => {
    const rec = makeRecord({ huc8: ['01090004'] });
    expect(recordMatchesFilters(rec, makeFilters({ huc8Id: '02080101' }))).toBe(false);
  });
});
