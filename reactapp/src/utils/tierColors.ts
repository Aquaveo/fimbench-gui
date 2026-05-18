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
    // Deuteranopia / Protanopia: avoids red & green confusion
    Tier_1: '#0072B2',  // blue
    Tier_2: '#E69F00',  // orange
    Tier_3: '#FDE725',  // pale yellow
    Tier_4: '#7B2CBF',  // purple
    HWM:    '#2D2D2D',  // charcoal
  },
  blueYellow: {
    // Tritanopia: avoids blue/green confusion and yellow/red confusion
    Tier_1: '#D7263D',  // deep red
    Tier_2: '#F49D37',  // orange
    Tier_3: '#A23B72',  // magenta
    Tier_4: '#1B998B',  // teal
    HWM:    '#2D3047',  // dark gray
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

// Canonical user-facing labels for each tier key. Components that need a
// different label in a specific context (e.g. WelcomeModal annotates Tier_4
// as "Tier 4 (BLE)") may override per-key locally.
export const TIER_LABELS: Record<string, string> = {
  Tier_1: 'Tier 1',
  Tier_2: 'Tier 2',
  Tier_3: 'Tier 3',
  Tier_4: 'Tier 4',
  HWM:    'High Water FIM',
};

export function tierColors(mode: ColorMode): Record<string, string> {
  return TIER_PALETTES[mode];
}
