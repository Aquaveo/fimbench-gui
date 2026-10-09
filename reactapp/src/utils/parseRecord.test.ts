import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseRecord';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parse = (meta: Record<string, unknown>, catalogQuality?: string) =>
  parseRecord(meta, 'FIM_Viz/Site_1', 'site_1.tif', 'site_1', undefined, catalogQuality);

// ─── quality ──────────────────────────────────────────────────────────────────

describe('parseRecord quality', () => {
  it('uses the catalog quality when the metadata has no Quality key (FEMA BLE case)', () => {
    const r = parse({ BLE: true, 'Synthetic Flooding Event (return period (years))': 100 }, 'Good');
    expect(r.quality).toBe('Good');
  });

  it('prefers the catalog quality over the metadata Quality key', () => {
    const r = parse({ Quality: 'Fair' }, 'Good');
    expect(r.quality).toBe('Good');
  });

  it('falls back to the metadata Quality key when the catalog has none', () => {
    const r = parse({ Quality: 'Fair' });
    expect(r.quality).toBe('Fair');
  });

  it('falls back to HWM when neither source has quality but a start date exists', () => {
    const r = parse({ 'Start Date of the Flood': '2017-08-28' });
    expect(r.quality).toBe('HWM');
  });

  it('falls back to a dash when no quality or start date is available', () => {
    const r = parse({});
    expect(r.quality).toBe('—');
  });
});
