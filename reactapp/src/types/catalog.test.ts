import { describe, it, expect } from 'vitest';
import { isValidHuc8, toHuc8Array } from './catalog';

describe('isValidHuc8', () => {
  it('accepts a standard 8-digit HUC8 code', () => {
    expect(isValidHuc8('01090004')).toBe(true);
  });

  it('accepts a code with leading zeros', () => {
    expect(isValidHuc8('00000001')).toBe(true);
  });

  it('rejects a 7-digit code', () => {
    expect(isValidHuc8('1090004')).toBe(false);
  });

  it('rejects a 9-digit code', () => {
    expect(isValidHuc8('010900040')).toBe(false);
  });

  it('rejects a code with non-digit characters', () => {
    expect(isValidHuc8('abcd1234')).toBe(false);
  });

  it('rejects an empty string', () => {
    expect(isValidHuc8('')).toBe(false);
  });

  it('rejects a code with spaces', () => {
    expect(isValidHuc8('0109 004')).toBe(false);
  });
});

describe('toHuc8Array', () => {
  it('returns an array of strings when huc8 is already an array', () => {
    expect(toHuc8Array({ huc8: ['01090004', '02080101'] })).toEqual(['01090004', '02080101']);
  });

  it('wraps a single string in an array', () => {
    expect(toHuc8Array({ huc8: '01090004' })).toEqual(['01090004']);
  });

  it('returns an empty array when huc8 is undefined', () => {
    expect(toHuc8Array({})).toEqual([]);
  });

  it('preserves leading zeros', () => {
    expect(toHuc8Array({ huc8: '01090004' })[0]).toBe('01090004');
  });

  it('stringifies numeric values in an array (leading-zero safety)', () => {
    // Catalog data might theoretically come in as numbers; coerce to string.
    expect(toHuc8Array({ huc8: [1090004 as unknown as string] })).toEqual(['1090004']);
  });
});
