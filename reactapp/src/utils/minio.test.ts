import { describe, it, expect } from 'vitest';
import { buildTifUrl, buildMetaUrl, S3_BASE } from './minio';

describe('buildTifUrl', () => {
  it('joins base, prefix, and filename with slashes', () => {
    expect(buildTifUrl('FIM_Database/Tier_1/SITE_001', 'SITE_001_BM.tif'))
      .toBe(`${S3_BASE}/FIM_Database/Tier_1/SITE_001/SITE_001_BM.tif`);
  });

  it('works for HWM tier prefix', () => {
    expect(buildTifUrl('FIM_Database/HWM/HWM_20100329', 'HWM_10_0m_20100329_BM.tif'))
      .toBe(`${S3_BASE}/FIM_Database/HWM/HWM_20100329/HWM_10_0m_20100329_BM.tif`);
  });
});

describe('buildMetaUrl', () => {
  it('replaces _BM.tif with _metadata.json', () => {
    expect(buildMetaUrl('FIM_Database/Tier_1/SITE_001', 'SITE_001_BM.tif'))
      .toBe(`${S3_BASE}/FIM_Database/Tier_1/SITE_001/SITE_001_metadata.json`);
  });

  it('leaves the prefix unchanged', () => {
    const url = buildMetaUrl('FIM_Database/Tier_2/SITE_002', 'SITE_002_BM.tif');
    expect(url).toContain('FIM_Database/Tier_2/SITE_002');
  });

  it('produces a different URL from buildTifUrl for the same inputs', () => {
    const prefix = 'FIM_Database/Tier_1/SITE_001';
    const name = 'SITE_001_BM.tif';
    expect(buildMetaUrl(prefix, name)).not.toBe(buildTifUrl(prefix, name));
  });
});
