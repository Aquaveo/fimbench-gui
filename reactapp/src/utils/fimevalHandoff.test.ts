import { describe, it, expect, vi, afterEach } from 'vitest';
import { buildFimevalHandoffUrl, fimevalHandoffUrl, FIMEVAL_HANDOFF_PATH } from './fimevalHandoff';

const TIF = 'https://sdmlab.s3.amazonaws.com/FIM_Database/Tier_1/AI_20110412_965145W472341N/AI_0_5m_20110412_965145W472341N_BM.tif';

describe('buildFimevalHandoffUrl', () => {
  it('targets the FIMeval handoff route on the given portal with benchmark_url first', () => {
    const u = buildFimevalHandoffUrl('https://portal.example.org', TIF, 'AI_20110412_965145W472341N');
    expect(u).toBe(
      'https://portal.example.org/handoff/fimeval-gui/run-evaluation/' +
      '?benchmark_url=https%3A%2F%2Fsdmlab.s3.amazonaws.com%2FFIM_Database%2FTier_1%2FAI_20110412_965145W472341N%2FAI_0_5m_20110412_965145W472341N_BM.tif' +
      '&benchmark_name=AI_20110412_965145W472341N',
    );
  });

  it('round-trips the benchmark URL and name through URL parsing', () => {
    const u = new URL(buildFimevalHandoffUrl('http://localhost:8000', TIF, 'site 1 & 2'));
    expect(u.pathname).toBe(FIMEVAL_HANDOFF_PATH);
    expect(u.searchParams.get('benchmark_url')).toBe(TIF);
    expect(u.searchParams.get('benchmark_name')).toBe('site 1 & 2');
  });

  it('ignores any path on the portal origin and keeps a non-default port', () => {
    const u = new URL(buildFimevalHandoffUrl('http://127.0.0.1:5173/apps/fimbench-gui/', TIF, 'x'));
    expect(u.origin).toBe('http://127.0.0.1:5173');
    expect(u.pathname).toBe(FIMEVAL_HANDOFF_PATH);
  });
});

describe('fimevalHandoffUrl', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('uses the current page origin', () => {
    vi.stubGlobal('window', { location: { origin: 'https://portal.example.org' } });
    const u = new URL(fimevalHandoffUrl(TIF, 'x'));
    expect(u.origin).toBe('https://portal.example.org');
    expect(u.searchParams.get('benchmark_url')).toBe(TIF);
  });

  it('returns an empty string when there is no benchmark to hand off', () => {
    expect(fimevalHandoffUrl('', 'x')).toBe('');
  });
});
