import { describe, it, expect } from 'vitest';
import { pageCount, clampPage } from './pagination';

describe('pageCount', () => {
  it('rounds up to whole pages', () => {
    expect(pageCount(41, 20)).toBe(3);
    expect(pageCount(40, 20)).toBe(2);
  });

  it('never reports fewer than one page', () => {
    expect(pageCount(0, 20)).toBe(1);
  });
});

describe('clampPage', () => {
  it('keeps a page that is still in range', () => {
    expect(clampPage(2, 5)).toBe(2);
    expect(clampPage(5, 5)).toBe(5);
  });

  it('pulls the page back to the last page when the row set shrinks (FIMBENCH-FE12)', () => {
    // User was on page 3 of 8, then a HUC8 filter leaves 4 rows (1 page).
    expect(clampPage(3, 1)).toBe(1);
    // User was on page 3 of 3, then unchecking a tier leaves 2 pages.
    expect(clampPage(3, 2)).toBe(2);
  });

  it('never returns a page below one', () => {
    expect(clampPage(0, 3)).toBe(1);
    expect(clampPage(2, 0)).toBe(1);
  });
});
