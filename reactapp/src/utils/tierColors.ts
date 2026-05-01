import type { ColorMode } from '../context/colorMode';

// Wong (2011) colorblind-safe palette — Nature Methods doi:10.1038/nmeth.1618
export const TIER_PALETTES: Record<ColorMode, Record<string, string>> = {
  default: {
    Tier_1: '#E74C3C',  // red
    Tier_2: '#F39C12',  // orange
    Tier_3: '#2ECC71',  // green
    Tier_4: '#9B59B6',  // purple
    HWM:    '#EC6FA3',  // pink
  },
  redGreen: {
    // Deuteranopia / Protanopia: replaces red & green with colors that differ
    // along axes these users can perceive (blue vs. orange vs. pink)
    Tier_1: '#D55E00',  // vermillion
    Tier_2: '#E69F00',  // orange/gold
    Tier_3: '#56B4E9',  // sky blue
    Tier_4: '#0072B2',  // blue
    HWM:    '#CC79A7',  // rose
  },
  blueYellow: {
    // Tritanopia: replaces purple (appears blue) and avoids yellow confusion;
    // reds and greens are perceived normally by tritanopes
    Tier_1: '#E74C3C',  // red
    Tier_2: '#F39C12',  // orange
    Tier_3: '#009E73',  // teal green
    Tier_4: '#D55E00',  // vermillion (replaces purple)
    HWM:    '#CC79A7',  // rose
  },
  monochrome: {
    // Five distinct lightness steps, readable on both light and dark basemaps
    Tier_1: '#111111',
    Tier_2: '#444444',
    Tier_3: '#777777',
    Tier_4: '#aaaaaa',
    HWM:    '#cccccc',
  },
};

export const TIER_KEYS = ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'] as const;

export function tierColors(mode: ColorMode): Record<string, string> {
  return TIER_PALETTES[mode];
}
