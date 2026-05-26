import { describe, it, expect } from 'vitest';
import { pickContrastColor } from './contrast';

describe('pickContrastColor', () => {
  it('returns white for a pure black background', () => {
    expect(pickContrastColor('#000000')).toBe('#ffffff');
  });

  it('returns black for a pure white background', () => {
    expect(pickContrastColor('#ffffff')).toBe('#000000');
  });

  it('returns white for a dark red background', () => {
    expect(pickContrastColor('#8B0000')).toBe('#ffffff');
  });

  it('returns black for a light yellow background', () => {
    expect(pickContrastColor('#FFFF99')).toBe('#000000');
  });

  it('respects a custom onLight override', () => {
    expect(pickContrastColor('#ffffff', { onLight: '#333333' })).toBe('#333333');
  });

  it('respects a custom onDark override', () => {
    expect(pickContrastColor('#000000', { onDark: '#eeeeee' })).toBe('#eeeeee');
  });

  it('respects a custom luminance threshold', () => {
    // #808080 has luminance ~128 — at threshold 200 it should be treated as dark
    expect(pickContrastColor('#808080', { threshold: 200 })).toBe('#ffffff');
  });

  it('treats luminance exactly at threshold as light', () => {
    // Pure white has luminance 1000/1000*299+587+114 = 1000 → well above any threshold
    // Craft a colour whose luminance equals the threshold (128).
    // R=0,G=0,B=128: luminance = (0*299 + 0*587 + 128*114)/1000 ≈ 14.6 → dark
    expect(pickContrastColor('#000080')).toBe('#ffffff');
  });
});
