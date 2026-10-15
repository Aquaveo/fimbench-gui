import { describe, it, expect } from 'vitest';
import { parseRecord } from './parseRecord';
import { recordFromCatalog, PLATFORM_BY_TIER } from './recordFromCatalog';
import type { CatalogRecord } from '../types/catalog';

// Real catalog records paired with their metadata JSON (references trimmed to
// one entry on both sides). recordFromCatalog must reproduce exactly what the
// table used to get from parseRecord(metadata), so the table can drop its
// per-row metadata fetch without changing a single cell.

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
const tier1Meta = {
  'Full form of the sensor code': 'Aerial Imagery', HUC8: ['09020107', '09020108', '09020109', '09020301'],
  'Resolution in meter': 0.5, State: 'MN, ND, USA', Description: 'The FIM was generated using NOAA Emergency Response Imagery.',
  'River Basin Name': ['Eastern Wild Rice', 'Elm-Marsh', 'Goose', 'Sandhill-Wilson'], Source: SOURCE_UA, 'Flooding Event': '20110412',
  'Event Recurrence Interval (USGS)': '50 yr', 'Event Discharge (USGS) [cms]': 1718.83, 'USGS Gauge ID': '05064500',
  'Event Recurrence Interval (NWM)': '< 2 yr', 'Event Discharge (NWM) [cms]': 362.74, Access_Rights: 'Public', Quality: 'Tier 1', References: REFS,
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
const hwmMeta = {
  'Full form of the sensor code': 'High Water Mark', HUC8: ['01090004'], 'Resolution in meter': 9.4, State: 'MA, RI, USA',
  Description: 'The FIM was generated using USGS High Water Marks.', 'River Basin Name': ['Narragansett'], Source: SOURCE_UA,
  'Start Date of the Flood': '20100329', 'End Date of the Flood': '20100401',
  'Event Recurrence Interval (USGS)': '> 100 yr', 'Event Discharge (USGS) [cms]': 155.18, 'USGS Gauge ID': '01108000',
  'Event Recurrence Interval (NWM)': '> 100 yr', 'Event Discharge (NWM) [cms]': 342.75, Access_Rights: 'Public', References: REFS,
};

const ble: CatalogRecord = {
  site_id: 'BLE_100_1000404W323634N', tier: 'FEMA_BLE',
  date_ymd: null, start_date_ymd: null, end_date_ymd: null, return_period: 100,
  s3_prefix: 'FIM_Database/FEMA_BLE/BLE_100_1000404W323634N', file_name: 'BLE_10_1m_100_1000404W323634N_BM.tif',
  centroid: [-100.04, 32.61], bbox: [-100.9203408106258, 32.08067848146152, -99.21525782899892, 33.13824478216495],
  resolution_m: 10.1, state: 'TX, USA', basin: ['Upper Clear Fork Brazos'], huc8: ['12060102'], quality: 'FEMA Base Level Engineering',
  source: 'NOAA/NWS Office of Water Prediction (OWP)', access_rights: 'Public', description: 'The FIM corresponds to FEMA Base Level Engineering for the 100 flood.', references: REFS,
};
const bleMeta = {
  'Full form of the sensor code': 'Base Level Engineering', HUC8: ['12060102'], 'Resolution in meter': 10.1, State: 'TX, USA',
  Description: 'The FIM corresponds to FEMA Base Level Engineering for the 100 flood.', 'River Basin Name': ['Upper Clear Fork Brazos'],
  Source: 'NOAA/NWS Office of Water Prediction (OWP)', 'Synthetic Flooding Event (return period (years))': '100', Access_Rights: 'Public', References: REFS,
};

const viaMetadata = (rec: CatalogRecord, meta: Record<string, unknown>) =>
  parseRecord(meta, rec.s3_prefix, rec.file_name, rec.site_id, rec.bbox, rec.quality);

describe('recordFromCatalog', () => {
  it('matches parseRecord for a Tier 1 record (single event date, USGS recurrence)', () => {
    expect(recordFromCatalog(tier1)).toEqual(viaMetadata(tier1, tier1Meta));
  });

  it('matches parseRecord for an HWM record (start–end date range, no Quality key in metadata)', () => {
    expect(recordFromCatalog(hwm)).toEqual(viaMetadata(hwm, hwmMeta));
  });

  it('matches parseRecord for a FEMA BLE record (return period, no dates, no recurrence)', () => {
    expect(recordFromCatalog(ble)).toEqual(viaMetadata(ble, bleMeta));
  });

  it('derives Platform from the tier for every tier', () => {
    expect(PLATFORM_BY_TIER).toEqual({
      Tier_1: 'Aerial Imagery', Tier_2: 'Planet Scope Scene', Tier_3: 'Sentinel-1A',
      HWM: 'High Water Mark', FEMA_BLE: 'Base Level Engineering',
    });
    expect(recordFromCatalog({ ...tier1, tier: 'Tier_3' }).platform).toBe('Sentinel-1A');
  });

  it('falls back to a dash for an unknown tier', () => {
    expect(recordFromCatalog({ ...tier1, tier: 'Tier_9' }).platform).toBe('—');
  });
});
