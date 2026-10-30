import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseRecord';

// ─── Helpers ──────────────────────────────────────────────────────────────────

const parse = (meta: Record<string, unknown>, catalogProductCategory?: string) =>
  parseRecord(meta, 'FIM_Viz/Site_1', 'site_1.tif', 'site_1', undefined, catalogProductCategory);

// ─── productCategory (was "quality" until FIMBENCH-FE13) ─────────────────────

describe('parseRecord productCategory', () => {
  it('uses the catalog value when the metadata has no category key (FEMA BLE case)', () => {
    const r = parse({ BLE: true, 'Synthetic Flooding Event (return period (years))': 100 }, 'FEMA Base Level Engineering');
    expect(r.productCategory).toBe('FEMA Base Level Engineering');
  });

  it('prefers the catalog value over the metadata key', () => {
    const r = parse({ 'Product Category': 'Tier 2' }, 'Tier 1');
    expect(r.productCategory).toBe('Tier 1');
  });

  it('reads the v3 metadata key "Product Category" when the catalog has none', () => {
    const r = parse({ 'Product Category': 'Tier 2' });
    expect(r.productCategory).toBe('Tier 2');
  });

  it('still reads the legacy metadata key "Quality"', () => {
    const r = parse({ Quality: 'Fair' });
    expect(r.productCategory).toBe('Fair');
  });

  it('prefers "Product Category" over a legacy "Quality" key when both are present', () => {
    const r = parse({ 'Product Category': 'Tier 3', Quality: 'Fair' });
    expect(r.productCategory).toBe('Tier 3');
  });

  it('falls back to HWM when neither source has a category but a start date exists', () => {
    const r = parse({ 'Start Date of the Flood': '2017-08-28' });
    expect(r.productCategory).toBe('HWM');
  });

  it('falls back to a dash when no category or start date is available', () => {
    const r = parse({});
    expect(r.productCategory).toBe('—');
  });
});

// ─── event, provenance and access fields ──────────────────────────────────────

describe('parseRecord event and provenance fields', () => {
  const full = {
    'Event Recurrence Interval (USGS)': '50 yr',
    'Event Recurrence Interval (NWM)': '< 2 yr',
    'Event Discharge (USGS) [cms]': 1718.83,
    'Event Discharge (NWM) [cms]': 362.74,
    'USGS Gauge ID': '05064500',
    'Acquisition Time in UTC': '15:07:12',
    Source: 'Dr. Dinuke Munasinghe, The University of Alabama',
    Access_Rights: 'Public',
    Description: 'The Flood Inundation Map (FIM) was generated using NOAA imagery.',
    References: ['1. Cohen et al. (2025).', '2. NOAA (2011).'],
  };

  it('reads every new field when present', () => {
    const r = parse(full);
    expect(r.recurrenceUsgs).toBe('50 yr');
    expect(r.recurrenceNwm).toBe('< 2 yr');
    expect(r.dischargeUsgs).toBe(1718.83);
    expect(r.dischargeNwm).toBe(362.74);
    expect(r.gaugeId).toBe('05064500');
    expect(r.acquisitionTime).toBe('15:07:12');
    expect(r.source).toBe('Dr. Dinuke Munasinghe, The University of Alabama');
    expect(r.accessRights).toBe('Public');
    expect(r.description).toBe('The Flood Inundation Map (FIM) was generated using NOAA imagery.');
    expect(r.references).toEqual(['1. Cohen et al. (2025).', '2. NOAA (2011).']);
  });

  it('keeps the raw "no gauge" sentence and nulls for a record without a usable gauge', () => {
    const r = parse({
      'Event Recurrence Interval (USGS)': 'No usable USGS Gauge',
      'Event Discharge (USGS) [cms]': null,
      'USGS Gauge ID': null,
    });
    expect(r.recurrenceUsgs).toBe('No usable USGS Gauge');
    expect(r.dischargeUsgs).toBeNull();
    expect(r.gaugeId).toBeNull();
  });

  it('returns nulls and an empty references list when the keys are absent (FEMA BLE case)', () => {
    const r = parse({ BLE: true });
    expect(r.recurrenceUsgs).toBeNull();
    expect(r.recurrenceNwm).toBeNull();
    expect(r.dischargeUsgs).toBeNull();
    expect(r.dischargeNwm).toBeNull();
    expect(r.gaugeId).toBeNull();
    expect(r.acquisitionTime).toBeNull();
    expect(r.source).toBeNull();
    expect(r.accessRights).toBeNull();
    expect(r.description).toBeNull();
    expect(r.references).toEqual([]);
  });

  it('stringifies a numeric gauge id so leading zeros are not lost elsewhere', () => {
    const r = parse({ 'USGS Gauge ID': 5064500 });
    expect(r.gaugeId).toBe('5064500');
  });
});

// ─── download URLs ────────────────────────────────────────────────────────────

describe('parseRecord download URLs', () => {
  it('exposes the AOI geopackage URL next to the GeoTIFF and metadata URLs', () => {
    const r = parseRecord({}, 'FIM_Database/Tier_1/SITE_001', 'SITE_001_BM.tif', 'SITE_001', undefined);
    expect(r.gpkgUrl).toBe('https://sdmlab.s3.amazonaws.com/FIM_Database/Tier_1/SITE_001/SITE_001_AOI.gpkg');
  });
});
