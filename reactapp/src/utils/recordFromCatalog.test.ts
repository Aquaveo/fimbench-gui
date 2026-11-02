import { describe, it, expect } from 'vitest';
import { recordFromCatalog, PLATFORM_BY_TIER } from './recordFromCatalog';
import type { CatalogRecord } from '../types/catalog';
import { S3_BASE } from './minio';

// Real catalog records (references trimmed to one entry). The expected
// records below are what the table showed for them when the display record
// was still parsed from the per-record metadata JSON, so the catalog path
// is pinned cell for cell (FIMBENCH-FE17 retired that metadata reader).

const REFS = ['1. Cohen, S., Baruah, A., Nikrou, P., Tian, D., & Liu, H. (2025). Toward robust evaluations of flood inundation predictions using remote sensing derived benchmark maps. Water Resources Research, 61(8), e2024WR039574.'];
const SOURCE_UA = 'Dr. Dinuke Munasinghe,The University of Alabama, Email id: dsmunasinghe@ua.edu';

const tier1: CatalogRecord = {
  site_id: 'AI_20110412_965145W472341N', tier: 'Tier_1',
  date_ymd: '2011-04-12', start_date_ymd: null, end_date_ymd: null, return_period: null,
  s3_prefix: 'FIM_Database/Tier_1/AI_20110412_965145W472341N', file_name: 'AI_0_5m_20110412_965145W472341N_BM.tif',
  centroid: [-96.86, 47.39], bbox: [-96.98614228869596, 47.22351055010301, -96.73940112012055, 47.56595055642782],
  resolution_m: 0.5, state: 'MN, ND, USA', basin: ['Eastern Wild Rice', 'Elm-Marsh', 'Goose', 'Sandhill-Wilson'],
  huc8: ['09020107', '09020108', '09020109', '09020301'], quality: 'Tier 1',
  source: SOURCE_UA, access_rights: 'Public', description: 'The FIM was generated using NOAA Emergency Response Imagery.', references: REFS,
  recurrence_usgs: '50 yr', recurrence_nwm: '< 2 yr', discharge_usgs_cms: 1718.83, discharge_nwm_cms: 362.74, usgs_gauge_id: '05064500',
};

const hwm: CatalogRecord = {
  site_id: 'HWM_20100329_20100401_710139W415659N', tier: 'HWM',
  date_ymd: null, start_date_ymd: '2010-03-29', end_date_ymd: '2010-04-01', return_period: null,
  s3_prefix: 'FIM_Database/HWM/HWM_20100329_20100401_710139W415659N', file_name: 'HWM_9_4m_20100329_20100401_710139W415659N_BM.tif',
  centroid: [-71.01, 41.95], bbox: [-71.19768235519915, 41.84121665022284, -70.85780711753632, 42.05867962896174],
  resolution_m: 9.4, state: 'MA, RI, USA', basin: ['Narragansett'], huc8: ['01090004'], quality: 'High Water FIM',
  source: SOURCE_UA, access_rights: 'Public', description: 'The FIM was generated using USGS High Water Marks.', references: REFS,
  recurrence_usgs: '> 100 yr', recurrence_nwm: '> 100 yr', discharge_usgs_cms: 155.18, discharge_nwm_cms: 342.75, usgs_gauge_id: '01108000',
};

const ble: CatalogRecord = {
  site_id: 'BLE_100_1000404W323634N', tier: 'FEMA_BLE',
  date_ymd: null, start_date_ymd: null, end_date_ymd: null, return_period: 100,
  s3_prefix: 'FIM_Database/FEMA_BLE/BLE_100_1000404W323634N', file_name: 'BLE_10_1m_100_1000404W323634N_BM.tif',
  centroid: [-100.04, 32.61], bbox: [-100.9203408106258, 32.08067848146152, -99.21525782899892, 33.13824478216495],
  resolution_m: 10.1, state: 'TX, USA', basin: ['Upper Clear Fork Brazos'], huc8: ['12060102'], quality: 'FEMA Base Level Engineering',
  source: 'NOAA/NWS Office of Water Prediction (OWP)', access_rights: 'Public', description: 'The FIM corresponds to FEMA Base Level Engineering for the 100 flood.', references: REFS,
};

describe('recordFromCatalog', () => {
  it('builds the full display record for a Tier 1 record (single event date, USGS recurrence)', () => {
    expect(recordFromCatalog(tier1)).toEqual({
      siteId: 'AI_20110412_965145W472341N',
      riverBasin: 'Eastern Wild Rice, Elm-Marsh, Goose, Sandhill-Wilson',
      state: 'MN, ND, USA',
      year: '2011', date: '2011-04-12', dateSortKey: '2011-04-12',
      resolution: 0.5,
      huc8: '09020107, 09020108, 09020109, 09020301',
      productCategory: 'Tier 1',
      platform: 'Aerial Imagery',
      returnPeriod: null,
      recurrenceUsgs: '50 yr', recurrenceNwm: '< 2 yr',
      dischargeUsgs: 1718.83, dischargeNwm: 362.74,
      gaugeId: '05064500',
      acquisitionTime: null,
      source: SOURCE_UA, accessRights: 'Public',
      description: 'The FIM was generated using NOAA Emergency Response Imagery.',
      references: REFS,
      bbox: tier1.bbox,
      s3Prefix: 'FIM_Database/Tier_1/AI_20110412_965145W472341N',
      tifUrl:  `${S3_BASE}/FIM_Database/Tier_1/AI_20110412_965145W472341N/AI_0_5m_20110412_965145W472341N_BM.tif`,
      metaUrl: `${S3_BASE}/FIM_Database/Tier_1/AI_20110412_965145W472341N/AI_0_5m_20110412_965145W472341N_metadata.json`,
      gpkgUrl: `${S3_BASE}/FIM_Database/Tier_1/AI_20110412_965145W472341N/AI_0_5m_20110412_965145W472341N_AOI.gpkg`,
    });
  });

  it('renders a start–end date range and sorts on the start date for an HWM record', () => {
    const r = recordFromCatalog(hwm);
    expect(r).toMatchObject({
      siteId: 'HWM_20100329_20100401_710139W415659N',
      riverBasin: 'Narragansett', state: 'MA, RI, USA',
      year: '2010', date: '2010-03-29 – 2010-04-01', dateSortKey: '2010-03-29',
      resolution: 9.4, huc8: '01090004',
      productCategory: 'High Water FIM', platform: 'High Water Mark',
      returnPeriod: null,
      recurrenceUsgs: '> 100 yr', recurrenceNwm: '> 100 yr',
      dischargeUsgs: 155.18, dischargeNwm: 342.75,
      gaugeId: '01108000', acquisitionTime: null,
      source: SOURCE_UA, accessRights: 'Public',
      description: 'The FIM was generated using USGS High Water Marks.',
      references: REFS,
    });
    expect(r.tifUrl).toBe(`${S3_BASE}/FIM_Database/HWM/HWM_20100329_20100401_710139W415659N/HWM_9_4m_20100329_20100401_710139W415659N_BM.tif`);
  });

  it('leaves dates dashed and magnitude fields null for a FEMA BLE record with a return period', () => {
    expect(recordFromCatalog(ble)).toMatchObject({
      siteId: 'BLE_100_1000404W323634N',
      riverBasin: 'Upper Clear Fork Brazos', state: 'TX, USA',
      year: '—', date: '—', dateSortKey: '',
      resolution: 10.1, huc8: '12060102',
      productCategory: 'FEMA Base Level Engineering', platform: 'Base Level Engineering',
      returnPeriod: 100,
      recurrenceUsgs: null, recurrenceNwm: null, dischargeUsgs: null, dischargeNwm: null,
      gaugeId: null, acquisitionTime: null,
      source: 'NOAA/NWS Office of Water Prediction (OWP)', accessRights: 'Public',
      description: 'The FIM corresponds to FEMA Base Level Engineering for the 100 flood.',
      references: REFS,
    });
  });

  it('dashes missing basin, huc8 and state, and zeroes a missing resolution', () => {
    const { basin: _b, huc8: _h, state: _s, resolution_m: _r, ...bare } = tier1; void [_b, _h, _s, _r];
    expect(recordFromCatalog(bare)).toMatchObject({ riverBasin: '—', huc8: '—', state: '—', resolution: 0 });
  });

  it('derives Platform from the tier for every tier', () => {
    expect(PLATFORM_BY_TIER).toEqual({
      Tier_1: 'Aerial Imagery', Tier_2: 'Planet Scope Scene', Tier_3: 'Sentinel-1A',
      HWM: 'High Water Mark', FEMA_BLE: 'Base Level Engineering',
    });
    expect(recordFromCatalog({ ...tier1, tier: 'Tier_3' }).platform).toBe('Sentinel-1A');
  });

  it('prefers the catalog platform field (added 2026-10-22) over the tier map', () => {
    expect(recordFromCatalog({ ...tier1, tier: 'Tier_2', platform: 'RapidEye Ortho Tile' }).platform)
      .toBe('RapidEye Ortho Tile');
  });

  it('passes numeric and bare-bound recurrence values through unchanged', () => {
    const r = recordFromCatalog({ ...tier1, recurrence_usgs: 5, recurrence_nwm: '< 2' });
    expect(r.recurrenceUsgs).toBe(5);
    expect(r.recurrenceNwm).toBe('< 2');
  });

  it('reads the catalog "quality" key as the product category (FIMBENCH-FE13)', () => {
    expect(recordFromCatalog(hwm).productCategory).toBe('High Water FIM');
    expect(recordFromCatalog(ble).productCategory).toBe('FEMA Base Level Engineering');
  });

  it('prefers a renamed "product_category" catalog key over the legacy "quality" key', () => {
    expect(recordFromCatalog({ ...tier1, product_category: 'Tier 1 (renamed)' }).productCategory).toBe('Tier 1 (renamed)');
    const { quality: _q, ...noQuality } = tier1; void _q;
    expect(recordFromCatalog({ ...noQuality, product_category: 'Tier 1' }).productCategory).toBe('Tier 1');
  });

  it('falls back to a dash for an unknown tier', () => {
    expect(recordFromCatalog({ ...tier1, tier: 'Tier_9' }).platform).toBe('—');
  });
});
