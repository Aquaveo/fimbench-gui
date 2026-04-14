import React, { useEffect, useState, useMemo } from 'react';

// ── Constants ─────────────────────────────────────────────────
const MINIO_BASE = 'http://127.0.0.1:9000/fimbench';

function toMinioPath(s3Prefix: string): string {
  return s3Prefix.replace(/^FIM_Database\//, '');
}
function buildTifUrl(s3Prefix: string, fileName: string): string {
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${fileName}`;
}
function buildMetaUrl(s3Prefix: string, fileName: string): string {
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${fileName.replace('_BM.tif', '_metadata.json')}`;
}

// ── Normalize one metadata JSON into a display record ─────────
function parseRecord(j: any, s3Prefix: string, fileName: string, siteId: string) {
  const basin = Array.isArray(j['River Basin Name'])
    ? j['River Basin Name'].join(', ')
    : (j['River Basin Name'] ?? '—');

  const huc8 = Array.isArray(j['HUC8'])
    ? j['HUC8'].join(', ')
    : (j['HUC8'] ?? '—');

  const fmt = (d: string) =>
    d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;

  const rawEvent: string = j['Flooding Event'] ?? '';
  const startDate: string = j['Start Date of the Flood'] ?? '';
  const endDate: string   = j['End Date of the Flood'] ?? '';

  // Keep a sortable ISO date string alongside the display string
  let year = '—';
  let date = '—';
  let dateSortKey = '';   // ISO string for reliable date sorting

  if (rawEvent) {
    year = rawEvent.slice(0, 4);
    date = fmt(rawEvent);
    dateSortKey = fmt(rawEvent);           // already YYYY-MM-DD
  } else if (startDate) {
    year = startDate.slice(0, 4);
    date = endDate && endDate !== startDate
      ? `${fmt(startDate)} – ${fmt(endDate)}`
      : fmt(startDate);
    dateSortKey = fmt(startDate);
  }

  let platform: string =
    j['Full form of the sensor code'] ??
    j['Sensor'] ??
    j['Platform'] ??
    '';
  if (!platform && j['BLE']) platform = 'Base Level Engineering (FEMA BLE)';
  if (!platform) platform = '—';

  const quality = j['Quality'] ?? (startDate ? 'HWM' : '—');

  return {
    siteId,
    riverBasin:   basin,
    state:        j['State'] ?? '—',
    year,
    date,
    dateSortKey,
    resolution:   j['Resolution in meter'] ?? 0,
    huc8,
    quality,
    platform,
    tifUrl:  buildTifUrl(s3Prefix, fileName),
    metaUrl: buildMetaUrl(s3Prefix, fileName),
  };
}

// ── Sorting ───────────────────────────────────────────────────
type FIMRecord = ReturnType<typeof parseRecord>;

type SortKey = 'riverBasin' | 'state' | 'year' | 'date' | 'resolution' | 'huc8' | 'quality' | 'platform';
type SortDir = 'asc' | 'desc';

const SORT_TYPE: Record<SortKey, 'text' | 'number' | 'date'> = {
  riverBasin: 'text',
  state:      'text',
  year:       'number',
  date:       'date',
  resolution: 'number',
  huc8:       'text',
  quality:    'text',
  platform:   'text',
};

function compareRecords(a: FIMRecord, b: FIMRecord, key: SortKey, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1;
  const kind = SORT_TYPE[key];

  if (kind === 'number') {
    const na = key === 'year'
      ? (a.year === '—' ? -Infinity : Number(a.year))
      : Number(a[key]);
    const nb = key === 'year'
      ? (b.year === '—' ? -Infinity : Number(b.year))
      : Number(b[key]);
    return mul * (na - nb);
  }

  if (kind === 'date') {
    const da = a.dateSortKey || '';
    const db = b.dateSortKey || '';
    if (!da && !db) return 0;
    if (!da) return 1;   // unknowns always last regardless of direction
    if (!db) return -1;
    return mul * da.localeCompare(db);
  }

  // text
  const va = (a[key as keyof FIMRecord] as string) ?? '';
  const vb = (b[key as keyof FIMRecord] as string) ?? '';
  if (va === '—' && vb === '—') return 0;
  if (va === '—') return 1;    // '—' always last
  if (vb === '—') return -1;
  return mul * va.localeCompare(vb, undefined, { sensitivity: 'base' });
}

// ── Column definitions ────────────────────────────────────────
type ColDef = {
  label: string;
  sortKey?: SortKey;
  width: number;
  align?: 'left' | 'right';
  render: (r: FIMRecord) => React.ReactNode;
};

const COLUMNS: ColDef[] = [
  { label: 'River / Basin', sortKey: 'riverBasin', width: 180, render: r => r.riverBasin },
  { label: 'State',         sortKey: 'state',       width: 110, render: r => r.state },
  { label: 'Year',          sortKey: 'year',         width: 55,  align: 'right', render: r => r.year },
  { label: 'Date',          sortKey: 'date',         width: 95,  render: r => r.date },
  { label: 'Resolution (m)',sortKey: 'resolution',   width: 90,  align: 'right',
    render: r => Number(r.resolution).toFixed(2) },
  { label: 'HUC8',          sortKey: 'huc8',         width: 130, render: r => r.huc8 },
  { label: 'Quality',       sortKey: 'quality',      width: 80,  render: r => r.quality },
  { label: 'Platform',      sortKey: 'platform',     width: 180, render: r => r.platform },
  { label: 'Download FIM',  width: 90,
    render: r => <a href={r.tifUrl}  target="_blank" rel="noreferrer">Download</a> },
  { label: 'Metadata',      width: 80,
    render: r => <a href={r.metaUrl} target="_blank" rel="noreferrer">Download</a> },
];

// ── Types ─────────────────────────────────────────────────────
type Props = {
  features: any[];
  selectedSiteId?: string | null;
  onRowClick?: (siteId: string) => void;
};
const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features, selectedSiteId: _selectedSiteId, onRowClick: _onRowClick }: Props) {
  const [records, setRecords] = useState<FIMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  useEffect(() => {
    if (features.length === 0) { setRecords([]); return; }

    let cancelled = false;
    setLoading(true);
    setPage(1);

    (async () => {
      const settled = await Promise.all(
        features.map(async (f) => {
          try {
            const metaUrl = buildMetaUrl(f.s3_prefix, f.file_name);
            const res = await fetch(metaUrl);
            if (!res.ok) return null;
            const j = await res.json();
            return parseRecord(j, f.s3_prefix, f.file_name, f.site_id);
          } catch { return null; }
        })
      );
      if (!cancelled) {
        setRecords(settled.filter(Boolean) as FIMRecord[]);
        setLoading(false);
      }
    })();

    return () => { cancelled = true; };
  }, [features]);

  // Sort records — memoized so it only reruns when records/sort state changes
  const sortedRecords = useMemo(
    () => [...records].sort((a, b) => compareRecords(a, b, sortKey, sortDir)),
    [records, sortKey, sortDir]
  );

  const handleHeaderClick = (key: SortKey | undefined) => {
    if (!key) return;
    if (key === sortKey) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
    setPage(1);   // jump back to page 1 on any sort change
  };

  if (features.length === 0) return (
    <div style={containerStyle}>
      <p style={{ color: '#888', padding: 12 }}>No FIM extents visible in current map view.</p>
    </div>
  );

  if (loading) return (
    <div style={containerStyle}>
      <p style={{ padding: 12 }}>⏳ Loading records…</p>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  const pageRows   = sortedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={containerStyle}>

      {/* Header */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <strong>FIM Records ({records.length})</strong>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {COLUMNS.map((col, i) => (
              <col key={i} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e8e8e8' }}>
              {COLUMNS.map((col) => {
                const isSorted = col.sortKey === sortKey;
                const sortable = !!col.sortKey;
                return (
                  <th
                    key={col.label}
                    style={{
                      ...thStyle,
                      cursor:          sortable ? 'pointer' : 'default',
                      userSelect:      'none',
                      backgroundColor: isSorted ? '#d0dff5' : '#e8e8e8',
                    }}
                    onClick={() => handleHeaderClick(col.sortKey)}
                    title={sortable ? `Sort by ${col.label}` : undefined}
                  >
                    {col.label}
                    {sortable && <SortIndicator active={isSorted} dir={sortDir} />}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9', verticalAlign: 'top' }}>
                {COLUMNS.map((col) => (
                  <td
                    key={col.label}
                    style={{ ...tdStyle, textAlign: col.align ?? 'left' }}
                  >
                    {col.render(r)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Sort indicator icon ───────────────────────────────────────
function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: 4, opacity: active ? 1 : 0.3, fontSize: 10 }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  height: '100%', overflow: 'hidden', display: 'flex',
  flexDirection: 'column', backgroundColor: '#fff', borderTop: '2px solid #ccc',
};
const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #ccc',
  whiteSpace: 'normal', wordBreak: 'break-word', position: 'sticky',
  top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #eee',
  whiteSpace: 'normal', wordBreak: 'break-word',
};