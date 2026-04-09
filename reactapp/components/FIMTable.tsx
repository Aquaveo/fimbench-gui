import { useEffect, useState } from 'react';
import { type Filters } from './FilterSidebar';

// ── Constants ─────────────────────────────────────────────────
const MINIO_BASE = 'http://127.0.0.1:9000/fimbench';

const TIER_PATH: Record<string, string> = {
  tier1: 'Tier_1',
  tier2: 'Tier_2',
  tier3: 'Tier_3',
  tier4: 'Tier_4',
  hwm:   'HWM',
};

// ── Types ─────────────────────────────────────────────────────
type FIMRecord = {
  riverBasin: string;
  state: string;
  year: string;
  date: string;
  resolution: number;
  huc8: string;
  quality: string;
  platform: string;
  tifUrl: string;
  metaUrl: string;
};

// ── S3 listing (handles pagination) ───────────────────────────
async function listMetadataKeys(tierPath: string): Promise<string[]> {
  const keys: string[] = [];
  let token = '';

  do {
    let url = `${MINIO_BASE}?list-type=2&prefix=${tierPath}/&max-keys=1000`;
    if (token) url += `&continuation-token=${encodeURIComponent(token)}`;

    const res = await fetch(url);
    if (!res.ok) break;
    const text = await res.text();
    const doc = new DOMParser().parseFromString(text, 'text/xml');

    doc.querySelectorAll('Key').forEach(el => {
      const k = el.textContent ?? '';
      if (k.endsWith('_metadata.json')) keys.push(k);
    });

    const truncated = doc.querySelector('IsTruncated')?.textContent;
    token = truncated === 'true'
      ? (doc.querySelector('NextContinuationToken')?.textContent ?? '')
      : '';
  } while (token);

  return keys;
}

// ── Fetch + parse a single metadata JSON ──────────────────────
async function fetchRecord(key: string): Promise<FIMRecord | null> {
  try {
    const res = await fetch(`${MINIO_BASE}/${key}`);
    if (!res.ok) return null;
    const j = await res.json();

    const event: string = j['Flooding Event'] ?? '';
    const year  = event.slice(0, 4);
    const date  = event.length === 8
      ? `${event.slice(0,4)}-${event.slice(4,6)}-${event.slice(6,8)}`
      : event;

    const tifKey = key.replace('_metadata.json', '_BM.tif');

    return {
      riverBasin: Array.isArray(j['River Basin Name'])
        ? j['River Basin Name'].join(', ')
        : (j['River Basin Name'] ?? '—'),
      state:      j['State'] ?? '—',
      year,
      date,
      resolution: j['Resolution in meter'] ?? 0,
      huc8:       Array.isArray(j['HUC8']) ? j['HUC8'].join(', ') : (j['HUC8'] ?? '—'),
      quality:    j['Quality'] ?? '—',
      platform:   j['Full form of the sensor code'] ?? '—',
      tifUrl:     `${MINIO_BASE}/${tifKey}`,
      metaUrl:    `${MINIO_BASE}/${key}`,
    };
  } catch {
    return null;
  }
}

// ── Batched parallel fetching (avoids hammering MinIO) ────────
async function batchFetch(keys: string[], batchSize = 10): Promise<FIMRecord[]> {
  const results: FIMRecord[] = [];
  for (let i = 0; i < keys.length; i += batchSize) {
    const batch = keys.slice(i, i + batchSize);
    const settled = await Promise.all(batch.map(fetchRecord));
    settled.forEach(r => { if (r) results.push(r); });
  }
  return results;
}

// ── Component ─────────────────────────────────────────────────
type Props = { filters: Filters };

const PAGE_SIZE = 20;

export default function FIMTable({ filters }: Props) {
  const [records, setRecords]   = useState<FIMRecord[]>([]);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);
  const [page, setPage]         = useState(1);

  // Re-fetch whenever selected tiers change
  useEffect(() => {
    if (filters.tiers.length === 0) {
      setRecords([]);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setPage(1);

    (async () => {
      try {
        // 1. List all metadata keys for all selected tiers in parallel
        const keyArrays = await Promise.all(
          filters.tiers.map(t => listMetadataKeys(TIER_PATH[t] ?? t))
        );
        const allKeys = keyArrays.flat();

        // 2. Fetch metadata JSONs in batches
        const allRecords = await batchFetch(allKeys);

        if (!cancelled) setRecords(allRecords);
      } catch (e: any) {
        if (!cancelled) setError(e.message ?? 'Failed to load records');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [filters.tiers]);

  // ── Date filtering ──────────────────────────────────────────
  const filtered = records.filter(r => {
    if (!r.date) return true;
    if (filters.startDate && r.date < filters.startDate) return false;
    if (filters.endDate   && r.date > filters.endDate)   return false;
    return true;
  });

  // ── Pagination ──────────────────────────────────────────────
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const pageRecords = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  // ── Render ──────────────────────────────────────────────────
  if (filters.tiers.length === 0) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#888', padding: 12 }}>Select at least one tier to see records.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div style={containerStyle}>
        <p style={{ padding: 12 }}>⏳ Loading records…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div style={containerStyle}>
        <p style={{ color: 'red', padding: 12 }}>Error: {error}</p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>

      {/* Header row */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>FIM Records ({filtered.length})</strong>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#e8e8e8', position: 'sticky', top: 0 }}>
              {['River / Basin','State','Year','Date','Resolution (m)','HUC8','Quality','Platform','Download FIM','Metadata'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRecords.length === 0 ? (
              <tr>
                <td colSpan={10} style={{ padding: 12, textAlign: 'center', color: '#888' }}>
                  No records match the current date range.
                </td>
              </tr>
            ) : pageRecords.map((r, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                <td style={tdStyle}>{r.riverBasin}</td>
                <td style={tdStyle}>{r.state}</td>
                <td style={tdStyle}>{r.year}</td>
                <td style={tdStyle}>{r.date}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{r.resolution.toFixed(2)}</td>
                <td style={tdStyle}>{r.huc8}</td>
                <td style={tdStyle}>{r.quality}</td>
                <td style={tdStyle}>{r.platform}</td>
                <td style={tdStyle}>
                  <a href={r.tifUrl} target="_blank" rel="noreferrer">Download</a>
                </td>
                <td style={tdStyle}>
                  <a href={r.metaUrl} target="_blank" rel="noreferrer">Download</a>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  height: '100%',
  overflowY: 'auto',
  backgroundColor: '#fff',
  borderTop: '2px solid #ccc',
};

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  borderBottom: '2px solid #ccc',
  whiteSpace: 'nowrap',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid #eee',
  whiteSpace: 'nowrap',
};