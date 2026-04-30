import React, { useEffect, useRef, useState, useMemo } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import type { FeatureProperties, Bbox } from '../src/types/catalog';
import { buildTifUrl, buildMetaUrl } from '../src/utils/minio';

const asString = (v: unknown): string => (typeof v === 'string' ? v : '');
const asNumber = (v: unknown): number => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// ── Normalize one metadata JSON into a display record ─────────
function parseRecord(j: Record<string, unknown>, s3Prefix: string, fileName: string, siteId: string, bbox: Bbox | undefined) {
  const basinRaw = j['River Basin Name'];
  const basin = Array.isArray(basinRaw)
    ? basinRaw.join(', ')
    : (typeof basinRaw === 'string' ? basinRaw : '—');

  const huc8Raw = j['HUC8'];
  const huc8 = Array.isArray(huc8Raw)
    ? huc8Raw.join(', ')
    : (typeof huc8Raw === 'string' ? huc8Raw : '—');

  const fmt = (d: string) =>
    d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;

  const rawEvent  = asString(j['Flooding Event']);
  const startDate = asString(j['Start Date of the Flood']);
  const endDate   = asString(j['End Date of the Flood']);

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

  let platform =
    asString(j['Full form of the sensor code']) ||
    asString(j['Sensor']) ||
    asString(j['Platform']) ||
    '';
  if (!platform && j['BLE']) platform = 'Base Level Engineering (FEMA BLE)';
  if (!platform) platform = '—';

  const qualityRaw = j['Quality'];
  const quality = typeof qualityRaw === 'string' ? qualityRaw : (startDate ? 'HWM' : '—');

  // Return period comes only on Tier 4 (FEMA BLE) metadata; absent on everything else.
  const rpRaw = j['Synthetic Flooding Event (return period (years))'];
  const returnPeriod: number | null =
    rpRaw != null && rpRaw !== '' && Number.isFinite(Number(rpRaw))
      ? Number(rpRaw)
      : null;

  const stateRaw = j['State'];

  return {
    siteId,
    riverBasin:   basin,
    state:        typeof stateRaw === 'string' ? stateRaw : '—',
    year,
    date,
    dateSortKey,
    resolution:   asNumber(j['Resolution in meter']),
    huc8,
    quality,
    platform,
    returnPeriod,
    bbox,
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

// ── Types ─────────────────────────────────────────────────────
type Props = {
  features: FeatureProperties[];
  selectedSiteIds?: Set<string>;
  onSelectionChange?: (newIds: Set<string>) => void;
  onClearSelection?: () => void;
  onZoomToFeature?: (bbox: Bbox) => void;
};
const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features, selectedSiteIds, onSelectionChange, onClearSelection, onZoomToFeature }: Props) {
  const selectedIds = selectedSiteIds ?? new Set<string>();
  const hasSelection = selectedIds.size > 0;
  const [records, setRecords] = useState<FIMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const anchorSiteId = React.useRef<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const [downloadProgress, setDownloadProgress] = useState<{ done: number; total: number } | null>(null);
  const [infoRecord, setInfoRecord] = useState<FIMRecord | null>(null);

  useEffect(() => {
    // When features is empty, the render short-circuits to the empty-state
    // before reading `records`, so no need to clear state here (would trigger
    // an extra render cycle). Stale records get replaced on the next non-empty
    // fetch.
    // Reset shift-anchor whenever the visible feature set changes so stale
    // anchor IDs from a previous viewport don't produce unexpected ranges.
    anchorSiteId.current = null;

    if (features.length === 0) return;

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
            return parseRecord(j, f.s3_prefix, f.file_name, f.site_id, f.bbox);
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

  // When a single item is selected (e.g. from a map centroid click), jump to its page.
  useEffect(() => {
    if (!selectedSiteIds || selectedSiteIds.size !== 1) return;
    const siteId = [...selectedSiteIds][0];
    const idx = sortedRecords.findIndex(r => r.siteId === siteId);
    if (idx === -1) return;
    setPage(Math.ceil((idx + 1) / PAGE_SIZE));
  }, [selectedSiteIds, sortedRecords]);

  // After the correct page renders, scroll that row into view.
  useEffect(() => {
    if (!selectedSiteIds || selectedSiteIds.size !== 1) return;
    const siteId = [...selectedSiteIds][0];
    rowRefs.current.get(siteId)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }, [page, selectedSiteIds]);

  const handleRowClick = (siteId: string, e: React.MouseEvent) => {
    if (e.shiftKey && anchorSiteId.current) {
      // Range select: find anchor and target in the full sorted list
      const allIds = sortedRecords.map(r => r.siteId);
      const anchorIdx = allIds.indexOf(anchorSiteId.current);
      const targetIdx = allIds.indexOf(siteId);
      if (anchorIdx !== -1 && targetIdx !== -1) {
        const [from, to] = anchorIdx <= targetIdx
          ? [anchorIdx, targetIdx]
          : [targetIdx, anchorIdx];
        onSelectionChange?.(new Set(allIds.slice(from, to + 1)));
      }
      // Anchor stays unchanged on Shift+click (standard OS behaviour)
    } else if (e.ctrlKey || e.metaKey) {
      // Toggle this row while keeping others
      const next = new Set(selectedIds);
      if (next.has(siteId)) next.delete(siteId); else next.add(siteId);
      onSelectionChange?.(next);
      anchorSiteId.current = siteId;
    } else {
      // Plain click → single select
      onSelectionChange?.(new Set([siteId]));
      anchorSiteId.current = siteId;
    }
  };

  const handleBulkDownload = async () => {
    const selected = records.filter(r => selectedIds.has(r.siteId));
    if (selected.length === 0) return;

    let done = 0;
    setDownloadProgress({ done, total: selected.length });

    const zip = new JSZip();

    await Promise.all(selected.map(async (r) => {
      const folder = zip.folder(r.siteId)!;

      await Promise.all([
        fetch(r.tifUrl).then(res => {
          if (res.ok) return res.blob().then(b => {
            folder.file(r.tifUrl.split('/').pop()!, b, { compression: 'STORE' });
          });
        }).catch(() => {}),
        fetch(r.metaUrl).then(res => {
          if (res.ok) return res.blob().then(b => {
            folder.file(r.metaUrl.split('/').pop()!, b);
          });
        }).catch(() => {}),
      ]);

      done++;
      setDownloadProgress({ done, total: selected.length });
    }));

    const zipBlob = await zip.generateAsync({ type: 'blob' });
    saveAs(zipBlob, `fim_${selected.length}_records.zip`);
    setDownloadProgress(null);
  };

  const allColumns = useMemo<ColDef[]>(() => [
    { label: 'River / Basin', sortKey: 'riverBasin',   width: 180, render: r => r.riverBasin },
    { label: 'State',         sortKey: 'state',        width: 110, render: r => r.state },
    { label: 'Year',          sortKey: 'year',         width: 55,  align: 'right', render: r => r.year },
    { label: 'Date',          sortKey: 'date',         width: 95,  render: r => r.date },
    { label: 'Return Period', sortKey: 'returnPeriod', width: 95,  align: 'right',
      render: r => r.returnPeriod != null ? `${r.returnPeriod}-year` : '—' },
    { label: 'Resolution (m)',sortKey: 'resolution',   width: 90,  align: 'right',
      render: r => Number(r.resolution).toFixed(2) },
    { label: 'HUC8',          sortKey: 'huc8',         width: 130, render: r => r.huc8 },
    { label: 'Quality',       sortKey: 'quality',      width: 80,  render: r => r.quality === 'HWM' ? 'High Water FIM' : r.quality },
    { label: 'Platform',      sortKey: 'platform',     width: 180, render: r => r.platform },
    { label: 'Download FIM',  width: 90,
      render: r => <a href={r.tifUrl}  target="_blank" rel="noreferrer">Download</a> },
    { label: 'Info',           width: 60,
      render: r => (
        <button
          onClick={(e) => { e.stopPropagation(); setInfoRecord(r); }}
          style={infoBtnStyle}
          title="View metadata"
        >
          ⓘ
        </button>
      ) },
    { label: 'Zoom',          width: 70,
      render: r => (
        <button
          onClick={(e) => { e.stopPropagation(); if (r.bbox) onZoomToFeature?.(r.bbox); }}
          disabled={!r.bbox}
          style={{
            ...tableHeaderBtnStyle,
            opacity: r.bbox ? 1 : 0.4,
            cursor: r.bbox ? 'pointer' : 'default',
            padding: '2px 8px',
          }}
          title={r.bbox ? 'Zoom map to this feature' : 'No bounding box available'}
        >
          Zoom
        </button>
      ),
    },
  ], [onZoomToFeature]);

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
          {downloadProgress ? (
            <span style={{ fontSize: 13, color: '#555' }}>
              Downloading {downloadProgress.done} / {downloadProgress.total}…
            </span>
          ) : (
            <button
              onClick={handleBulkDownload}
              disabled={!hasSelection}
              style={{ ...tableHeaderBtnStyle, opacity: hasSelection ? 1 : 0.4, cursor: hasSelection ? 'pointer' : 'default' }}
              title={hasSelection ? `Download ${selectedIds.size} selected record(s) as a zip` : 'Select rows to enable bulk download'}
            >
              Download Selected ({selectedIds.size})
            </button>
          )}
          <button
            onClick={onClearSelection}
            disabled={!hasSelection || !!downloadProgress}
            style={{ ...tableHeaderBtnStyle, opacity: (hasSelection && !downloadProgress) ? 1 : 0.4, cursor: (hasSelection && !downloadProgress) ? 'pointer' : 'default' }}
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

      {infoRecord && <MetaModal record={infoRecord} onClose={() => setInfoRecord(null)} />}

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, tableLayout: 'fixed' }}>
          <colgroup>
            {allColumns.map((col, i) => (
              <col key={i} style={{ width: col.width }} />
            ))}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e8e8e8' }}>
              {allColumns.map((col) => {
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
              const isSelected = selectedIds.has(r.siteId);
              return (
                <tr
                  key={r.siteId}
                  ref={el => { if (el) rowRefs.current.set(r.siteId, el); else rowRefs.current.delete(r.siteId); }}
                  onClick={(e) => handleRowClick(r.siteId, e)}
                  style={{
                    backgroundColor: isSelected ? '#cce3ff' : (i % 2 === 0 ? '#fff' : '#f9f9f9'),
                    verticalAlign: 'top',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 'normal',
                  }}
                >
                  {allColumns.map((col) => (
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

// ── Download icon (same SVG as map centroid popup buttons) ────
function DownloadIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" style={{ flexShrink: 0, display: 'block' }}>
      <path d="M17 17H17.01M17.4 14H18C18.9319 14 19.3978 14 19.7654 14.1522C20.2554 14.3552 20.6448 14.7446 20.8478 15.2346C21 15.6022 21 16.0681 21 17C21 17.9319 21 18.3978 20.8478 18.7654C20.6448 19.2554 20.2554 19.6448 19.7654 19.8478C19.3978 20 18.9319 20 18 20H6C5.06812 20 4.60218 20 4.23463 19.8478C3.74458 19.6448 3.35523 19.2554 3.15224 18.7654C3 18.3978 3 17.9319 3 17C3 16.0681 3 15.6022 3.15224 15.2346C3.35523 14.7446 3.74458 14.3552 4.23463 14.1522C4.60218 14 5.06812 14 6 14H6.6M12 15V4M12 15L9 12M12 15L15 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

// ── Metadata info modal ───────────────────────────────────────
function MetaModal({ record, onClose }: { record: FIMRecord; onClose: () => void }) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleDownloadText = () => {
    const quality = record.quality === 'HWM' ? 'High Water FIM' : record.quality;
    const parts: string[] = [
      `Site ID:        ${record.siteId}`,
      `River / Basin:  ${record.riverBasin}`,
      `State:          ${record.state}`,
      `Date:           ${record.date}`,
      `Year:           ${record.year}`,
      `Resolution:     ${record.resolution} m`,
      `HUC8:           ${record.huc8}`,
      `Quality:        ${quality}`,
      `Platform:       ${record.platform}`,
    ];
    if (record.returnPeriod != null) parts.push(`Return Period:  ${record.returnPeriod}-year`);
    saveAs(new Blob([parts.join('\n')], { type: 'text/plain' }), `${record.siteId}_metadata.txt`);
  };

  const handleDownloadJson = async () => {
    try {
      const res = await fetch(record.metaUrl);
      if (!res.ok) return;
      saveAs(await res.blob(), `${record.siteId}_metadata.json`);
    } catch { /* silent */ }
  };

  const rows: [string, string][] = [
    ['Site ID',       record.siteId],
    ['River / Basin', record.riverBasin],
    ['State',         record.state],
    ['Date',          record.date],
    ['Year',          record.year],
    ['Resolution',    `${record.resolution} m`],
    ['HUC8',          record.huc8],
    ['Quality',       record.quality === 'HWM' ? 'High Water FIM' : record.quality],
    ['Platform',      record.platform],
    ...(record.returnPeriod != null ? [['Return Period', `${record.returnPeriod}-year`] as [string, string]] : []),
  ];

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>FIM Record — {record.siteId}</span>
          <button style={modalCloseBtnStyle} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={modalBodyStyle}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <tbody>
              {rows.map(([label, value]) => (
                <tr key={label} style={{ borderBottom: '1px solid #f0f0f0' }}>
                  <td style={modalLabelCellStyle}>{label}</td>
                  <td style={modalValueCellStyle}>{value}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={modalFooterStyle}>
          <button onClick={handleDownloadText} style={modalDlBtnStyle('#e8e8e8', '#333')}>
            <DownloadIcon /> Download .txt
          </button>
          <button onClick={handleDownloadJson} style={modalDlBtnStyle('#25C2DF', '#152428')}>
            <DownloadIcon /> Download .json
          </button>
        </div>
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

const infoBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: 15, color: '#666', padding: '0 2px', lineHeight: 1,
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9500,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};

const modalCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.25)',
  width: '100%', maxWidth: 420,
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  background: '#152428', color: '#D1EFF6',
  padding: '12px 16px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const modalCloseBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#D1EFF6',
  fontSize: 16, cursor: 'pointer', padding: '0 2px', lineHeight: 1,
};

const modalBodyStyle: React.CSSProperties = {
  padding: '12px 16px', overflowY: 'auto', maxHeight: '60vh',
};

const modalLabelCellStyle: React.CSSProperties = {
  fontWeight: 600, color: '#555', paddingRight: 12,
  paddingTop: 6, paddingBottom: 6,
  whiteSpace: 'nowrap', fontSize: 12, width: '40%',
};

const modalValueCellStyle: React.CSSProperties = {
  color: '#222', paddingTop: 6, paddingBottom: 6, fontSize: 13,
};

const modalFooterStyle: React.CSSProperties = {
  padding: '12px 16px', borderTop: '1px solid #eee',
  display: 'flex', gap: 10, justifyContent: 'flex-end',
};

const modalDlBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: 6,
  padding: '5px 12px', fontSize: 13, fontFamily: 'inherit',
  border: '1px solid rgba(0,0,0,0.12)', borderRadius: 4,
  background: bg, color, cursor: 'pointer', fontWeight: 500,
});