import { describe, it, expect } from 'vitest';
import { formatYmd } from './dateFormat';

describe('formatYmd', () => {
  it('converts compact YYYYMMDD to YYYY-MM-DD', () => {
    expect(formatYmd('20210315')).toBe('2021-03-15');
  });

  it('strips the time component from a compact YYYYMMDDTHHMMSS string', () => {
    expect(formatYmd('20210315T120000')).toBe('2021-03-15');
  });

  it('strips fractional seconds from compact datetime', () => {
    expect(formatYmd('20210315T120000.000')).toBe('2021-03-15');
  });

  it('returns YYYY-MM-DD unchanged for an already-dashed ISO date', () => {
    expect(formatYmd('2021-03-15')).toBe('2021-03-15');
  });

  it('strips the time component from an ISO 8601 datetime', () => {
    expect(formatYmd('2021-03-15T12:00:00')).toBe('2021-03-15');
  });

  it('strips timezone from an ISO 8601 datetime with offset', () => {
    expect(formatYmd('2021-03-15T12:00:00Z')).toBe('2021-03-15');
  });

  it('returns an empty string unchanged', () => {
    expect(formatYmd('')).toBe('');
  });

  it('returns an unrecognised string unchanged (fallback)', () => {
    expect(formatYmd('March 15, 2021')).toBe('March 15, 2021');
  });
});
