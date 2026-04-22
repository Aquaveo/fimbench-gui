import React, { useEffect, useRef, useState, useMemo } from 'react';

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

  // Return period comes only on Tier 4 (FEMA BLE) metadata; absent on everything else.
  const rpRaw = j['Synthetic Flooding Event (return period (years))'];
  const returnPeriod: number | null =
    rpRaw != null && rpRaw !== '' && Number.isFinite(Number(rpRaw))
      ? Number(rpRaw)
      : null;

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
    returnPeriod,
    tifUrl:  buildTifUrl(s3Prefix, fileName),
    metaUrl: buildMetaUrl(s3Prefix, fileName),
  };
}

// ── Sorting ───────────────────────────────────────────────────
type FIMRecord = ReturnType<typeof parseRecord>;

type SortKey = 'riverBasin' | 'state' | 'year' | 'date' | 'resolution' | 'huc8' | 'quality' | 'platform' | 'returnPeriod';
type SortDir = 'asc' | 'desc';

const SORT_TYPE: Record<SortKey, 'text' | 'number' | 'date'> = {
  riverBasin:   'text',
  state:        'text',
  year:         'number',
  date:         'date',
  resolution:   'number',
  huc8:         'text',
  quality:      'text',
  platform:     'text',
  returnPeriod: 'number',
};

function compareRecords(a: FIMRecord, b: FIMRecord, key: SortKey, dir: SortDir): number {
  const mul = dir === 'asc' ? 1 : -1;
  const kind = SORT_TYPE[key];

  if (kind === 'number') {
    // Return period is nullable; unknowns sort last regardless of direction
    // (same convention used for dates below).
    if (key === 'returnPeriod') {
      const na = a.returnPeriod;
      const nb = b.returnPeriod;
      if (na == null && nb == null) return 0;
      if (na == null) return 1;
      if (nb == null) return -1;
      return mul * (na - nb);
    }
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
  { label: 'Return Period', sortKey: 'returnPeriod', width: 95,  align: 'right',
    render: r => r.returnPeriod != null ? `${r.returnPeriod}-year` : '—' },
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
  onClearSelection?: () => void;
};
const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features, selectedSiteId, onRowClick, onClearSelection }: Props) {
  const [records, setRecords] = useState<FIMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  // Refs for scroll-to-selected behaviour
  const selectedRowRef      = useRef<HTMLTableRowElement | null>(null);
  const lastInternalClickRef = useRef<string | null>(null);  // tracks table-initiated clicks
  const sortedRecordsRef    = useRef<FIMRecord[]>([]);       // stable ref so page-nav effect avoids re-running on every sort

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

  // Keep ref in sync so page-nav effect can read current records without them as a dep
  useEffect(() => { sortedRecordsRef.current = sortedRecords; }, [sortedRecords]);

  // When selection originates from the map: navigate to the correct page
  useEffect(() => {
    if (!selectedSiteId) return;
    // Table-initiated clicks don't need a page jump — user is already looking at the row
    if (lastInternalClickRef.current === selectedSiteId) {
      lastInternalClickRef.current = null;
      return;
    }
    const idx = sortedRecordsRef.current.findIndex(r => r.siteId === selectedSiteId);
    if (idx === -1) return;
    setPage(Math.ceil((idx + 1) / PAGE_SIZE));
  }, [selectedSiteId]);

  // After the page renders, scroll the selected row into view
  useEffect(() => {
    selectedRowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [selectedSiteId, page]);

  // Wraps the external callback so we can mark the click as table-initiated
  const handleRowClick = (siteId: string) => {
    lastInternalClickRef.current = siteId;
    onRowClick?.(siteId);
  };

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
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            onClick={onClearSelection}
            disabled={!selectedSiteId}
            style={{ ...tableHeaderBtnStyle, opacity: selectedSiteId ? 1 : 0.4, cursor: selectedSiteId ? 'pointer' : 'default' }}
          >
            Clear Selection
          </button>
          {totalPages > 1 && (
            <>
              <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1} style={tableHeaderBtnStyle}>‹</button>
              <span>Page {page} / {totalPages}</span>
              <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages} style={tableHeaderBtnStyle}>›</button>
            </>
          )}
        </div>
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
            {pageRows.map((r, i) => {
              const isSelected = r.siteId === selectedSiteId;
              return (
                <tr
                  key={i}
                  ref={isSelected ? selectedRowRef : null}
                  onClick={() => handleRowClick(r.siteId)}
                  style={{
                    backgroundColor: isSelected ? '#cce3ff' : (i % 2 === 0 ? '#fff' : '#f9f9f9'),
                    verticalAlign: 'top',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 'normal',
                  }}
                >
                  {COLUMNS.map((col) => (
                    <td
                      key={col.label}
                      style={{ ...tdStyle, textAlign: col.align ?? 'left' }}
                    >
                      {col.render(r)}
                    </td>
                  ))}
                </tr>
              );
            })}
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
const tableHeaderBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: 13,
  cursor: 'pointer',
  padding: '2px 8px',
  border: '1px solid #bbb',
  borderRadius: 4,
  backgroundColor: '#fff',
};

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