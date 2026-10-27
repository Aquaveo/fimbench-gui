import React, { useEffect, useRef, useState, useMemo } from 'react';
import { saveAs } from 'file-saver';
import type { CatalogRecord, Bbox } from '../src/types/catalog';
import { useDownloadManager } from '../src/context/download';
import type { FIMRecord } from '../src/utils/parseRecord';
import { recordFromCatalog } from '../src/utils/recordFromCatalog';
import { isUsableRecurrence, formatRecurrence } from '../src/utils/eventMagnitude';
import { DownloadIcon } from './DownloadIcon';
import { COLORS } from '../src/theme';
import { toggleInSet } from '../src/utils/toggle';
import { useEscapeKey } from '../src/hooks/useEscapeKey';

// ── Sorting ───────────────────────────────────────────────────

type SortKey = 'riverBasin' | 'state' | 'year' | 'date' | 'resolution' | 'huc8' | 'productCategory' | 'platform' | 'returnPeriod';
type SortDir = 'asc' | 'desc';

const SORT_TYPE: Record<SortKey, 'text' | 'number' | 'date'> = {
  riverBasin:   'text',
  state:        'text',
  year:         'number',
  date:         'date',
  resolution:   'number',
  huc8:         'text',
  productCategory: 'text',
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
  width: string;
  align?: 'left' | 'right';
  render: (r: FIMRecord) => React.ReactNode;
};

// ── Types ─────────────────────────────────────────────────────
type Props = {
  features: CatalogRecord[];
  selectedSiteIds?: Set<string>;
  onSelectionChange?: (newIds: Set<string>) => void;
  onClearSelection?: () => void;
  onZoomToFeature?: (bbox: Bbox, siteId: string) => void;
};
const PAGE_SIZE = 20;
const DOWNLOAD_CAP = 10;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features, selectedSiteIds, onSelectionChange, onClearSelection, onZoomToFeature }: Props) {
  const selectedIds = selectedSiteIds ?? new Set<string>();
  const hasSelection = selectedIds.size > 0;
  // Rows come straight from the catalog records the map reports as visible;
  // no per-row metadata request is needed any more.
  const records = useMemo<FIMRecord[]>(() => features.map(recordFromCatalog), [features]);
  const [page, setPage]       = useState(1);
  const [sortKey, setSortKey] = useState<SortKey>('date');
  const [sortDir, setSortDir] = useState<SortDir>('desc');
  const anchorSiteId = React.useRef<string | null>(null);
  const rowRefs = useRef<Map<string, HTMLTableRowElement>>(new Map());
  const { progress: downloadProgress, isActive: downloadActive, startDownload } = useDownloadManager();
  const [infoRecord, setInfoRecord] = useState<FIMRecord | null>(null);
  const [showCapModal, setShowCapModal] = useState(false);
  const [capTriggered, setCapTriggered] = useState(false);

  const overCap = selectedIds.size > DOWNLOAD_CAP;

  useEffect(() => {
    if (selectedIds.size <= DOWNLOAD_CAP) {
      // Reset cap UI when the user deselects back below the cap threshold.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setCapTriggered(false);
      setShowCapModal(false);
    }
  }, [selectedIds.size]);

  // Reset shift-anchor whenever the visible feature set changes so stale
  // anchor IDs from a previous viewport don't produce unexpected ranges.
  useEffect(() => {
    anchorSiteId.current = null;
  }, [features]);

  // When 2+ items are selected (e.g. via Shift+drag spatial select on the map),
  // narrow the table to just those records — the user's intent is to focus on
  // the selected set. For 0 or 1 selections, show everything.
  const filteredRecords = useMemo(
    () => (selectedIds.size >= 2 ? records.filter(r => selectedIds.has(r.siteId)) : records),
    [records, selectedSiteIds] // eslint-disable-line react-hooks/exhaustive-deps -- selectedIds derives from selectedSiteIds; using the prop avoids a new-Set-on-every-render false dep
  );

  // Sort records — memoized so it only reruns when records/sort state changes
  const sortedRecords = useMemo(
    () => [...filteredRecords].sort((a, b) => compareRecords(a, b, sortKey, sortDir)),
    [filteredRecords, sortKey, sortDir]
  );

  // When entering "focused" mode (size ≥ 2), reset to page 1 so the selected
  // rows are visible from the top.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (selectedIds.size >= 2) setPage(1);
  }, [selectedIds.size]);

  // When a single item is selected (e.g. from a map centroid click), jump to its page.
  useEffect(() => {
    if (!selectedSiteIds || selectedSiteIds.size !== 1) return;
    const siteId = [...selectedSiteIds][0];
    const idx = sortedRecords.findIndex(r => r.siteId === siteId);
    if (idx === -1) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      onSelectionChange?.(toggleInSet(selectedIds, siteId));
      anchorSiteId.current = siteId;
    } else {
      // Plain click → single select
      onSelectionChange?.(new Set([siteId]));
      anchorSiteId.current = siteId;
    }
  };

  const handleBulkDownload = () => {
    const selected = features
      .filter(f => selectedIds.has(f.site_id))
      .map(f => ({
        siteId: f.site_id,
        s3Prefix: f.s3_prefix,
      }));
    startDownload(selected);
  };

  const allColumns = useMemo<ColDef[]>(() => [
    { label: 'River / Basin', sortKey: 'riverBasin',   width: '11.25rem', render: r => r.riverBasin },
    { label: 'State',         sortKey: 'state',        width: '6.875rem', render: r => r.state },
    { label: 'Year',          sortKey: 'year',         width: '3.4375rem',  align: 'right', render: r => r.year },
    { label: 'Date',          sortKey: 'date',         width: '5.9375rem',  render: r => r.date },
    { label: 'Return Period', sortKey: 'returnPeriod', width: '5.9375rem',  align: 'right',
      render: r => r.returnPeriod != null ? `${r.returnPeriod}-year` : '—' },
    { label: 'Resolution (m)',sortKey: 'resolution',   width: '5.625rem',  align: 'right',
      render: r => Number(r.resolution).toFixed(2) },
    { label: 'HUC8',          sortKey: 'huc8',         width: '8.125rem', render: r => r.huc8 },
    { label: 'Product Category', sortKey: 'productCategory', width: '7.5rem', render: r => r.productCategory === 'HWM' ? 'High Water FIM' : r.productCategory },
    { label: 'Platform',      sortKey: 'platform',     width: '11.25rem', render: r => r.platform },
    { label: 'Zoom',          width: '4.375rem',
      render: r => (
        <button
          onClick={(e) => { e.stopPropagation(); if (r.bbox) onZoomToFeature?.(r.bbox, r.siteId); }}
          disabled={!r.bbox}
          style={{
            ...tableHeaderBtnStyle,
            opacity: r.bbox ? 1 : 0.4,
            cursor: r.bbox ? 'pointer' : 'default',
            padding: '0.125rem 0.5rem',
          }}
          title={r.bbox ? 'Zoom map to this feature' : 'No bounding box available'}
        >
          Zoom
        </button>
      ),
    },
    { label: 'Download All',  width: '5.625rem',
      render: r => (
        <button
          className="fim-dl-all"
          onClick={(e) => { e.stopPropagation(); startDownload([{ siteId: r.siteId, s3Prefix: r.s3Prefix }]); }}
          disabled={downloadActive}
          title="Download all files in this folder as a zip"
        >
          Download
        </button>
      ) },
    { label: 'Download FIM',  width: '5.625rem',
      render: r => <a className="fim-dl-fim" href={r.tifUrl}  target="_blank" rel="noreferrer">Download</a> },
    { label: 'Download AOI',  width: '5.625rem',
      render: r => <a className="fim-dl-fim" href={r.gpkgUrl} target="_blank" rel="noreferrer" title="Area of interest polygon (.gpkg)">Download</a> },
    { label: 'Info',           width: '3.75rem',
      render: r => (
        <button
          onClick={(e) => { e.stopPropagation(); setInfoRecord(r); }}
          style={infoBtnStyle}
          title="View metadata"
        >
          ⓘ
        </button>
      ) },
  ], [onZoomToFeature, startDownload, downloadActive]);

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
      <p style={{ color: '#888', padding: '0.75rem' }}>No FIM extents visible in current map view.</p>
    </div>
  );

  const totalPages = Math.max(1, Math.ceil(sortedRecords.length / PAGE_SIZE));
  const pageRows   = sortedRecords.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  return (
    <div style={containerStyle}>

      {/* Header */}
      <div style={{ padding: '0.375rem 0.75rem', borderBottom: '0.0625rem solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
        <strong>FIM Records ({records.length})</strong>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          {downloadProgress ? (
            <span style={{ fontSize: '0.8125rem', color: '#555' }}>
              Downloading {downloadProgress.done} / {downloadProgress.total}…
            </span>
          ) : (
            <>
              {capTriggered && (
                <span style={{ fontSize: '0.75rem', color: '#c0392b' }}>
                  Limit is {DOWNLOAD_CAP} items —{' '}
                  <a href="https://pypi.org/project/fimeval/" target="_blank" rel="noreferrer" className="api-link">use the FIMeval Python API</a>
                  {' '}for larger downloads
                </span>
              )}
              <button
                onClick={() => overCap ? (setShowCapModal(true), setCapTriggered(true)) : handleBulkDownload()}
                disabled={!hasSelection || capTriggered || downloadActive}
                style={{ ...tableHeaderBtnStyle, opacity: (hasSelection && !capTriggered && !downloadActive) ? 1 : 0.4, cursor: (hasSelection && !capTriggered && !downloadActive) ? 'pointer' : 'default' }}
                title={
                  capTriggered
                    ? `Deselect items to re-enable (limit: ${DOWNLOAD_CAP})`
                    : hasSelection
                      ? `Download ${selectedIds.size} selected record(s) as a zip`
                      : 'Select rows to enable bulk download'
                }
              >
                Download Selected ({selectedIds.size})
              </button>
            </>
          )}
          <button
            onClick={onClearSelection}
            disabled={!hasSelection || downloadActive}
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
      {showCapModal && <CapModal cap={DOWNLOAD_CAP} onClose={() => setShowCapModal(false)} />}

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem', tableLayout: 'fixed' }}>
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

// ── Metadata info modal ───────────────────────────────────────
type ModalRow = [string, string];
type ModalGroup = { title: string; rows: ModalRow[] };

const fmtCms = (n: number) => `${n.toLocaleString('en-US', { maximumFractionDigits: 2 })} cms`;

// Rows whose value is null are dropped — unusable recurrence sentences and
// absent fields hide rather than print a placeholder. The .txt export is the
// exception: it writes every raw value so nothing is lost.
function buildModalGroups(record: FIMRecord): ModalGroup[] {
  const productCategory = record.productCategory === 'HWM' ? 'High Water FIM' : record.productCategory;
  const candidates: { title: string; rows: [string, string | null][] }[] = [
    { title: 'Location', rows: [
      ['River / Basin', record.riverBasin],
      ['State',         record.state],
      ['HUC8',          record.huc8],
    ]},
    { title: 'Event', rows: [
      ['Date',                   record.date],
      ['Year',                   record.year],
      ['Acquisition time (UTC)', record.acquisitionTime],
      ['Return Period',          record.returnPeriod != null ? `${record.returnPeriod}-year` : null],
      ['Recurrence (USGS)',      isUsableRecurrence(record.recurrenceUsgs) ? formatRecurrence(record.recurrenceUsgs) : null],
      ['Recurrence (NWM)',       isUsableRecurrence(record.recurrenceNwm)  ? formatRecurrence(record.recurrenceNwm)  : null],
      ['Discharge (USGS)',       record.dischargeUsgs != null ? fmtCms(record.dischargeUsgs) : null],
      ['Discharge (NWM)',        record.dischargeNwm  != null ? fmtCms(record.dischargeNwm)  : null],
      ['USGS Gauge ID',          record.gaugeId],
    ]},
    { title: 'Data', rows: [
      ['Resolution', `${record.resolution} m`],
      ['Platform',   record.platform],
      ['Product Category', productCategory],
      ['Access',     record.accessRights],
    ]},
    { title: 'Provenance', rows: [
      ['Source', record.source],
    ]},
  ];
  return candidates
    .map(g => ({ title: g.title, rows: g.rows.filter((r): r is ModalRow => r[1] != null) }))
    .filter(g => g.rows.length > 0);
}

// Plain-text export: every field, raw values, grouped like the modal.
function buildMetadataText(record: FIMRecord): string {
  const productCategory = record.productCategory === 'HWM' ? 'High Water FIM' : record.productCategory;
  const line = (label: string, value: string | number | null) =>
    `${(label + ':').padEnd(26)}${value == null ? '—' : value}`;
  const parts: string[] = [
    line('Site ID', record.siteId),
    '',
    '[Location]',
    line('River / Basin', record.riverBasin),
    line('State', record.state),
    line('HUC8', record.huc8),
    '',
    '[Event]',
    line('Date', record.date),
    line('Year', record.year),
  ];
  if (record.acquisitionTime) parts.push(line('Acquisition time (UTC)', record.acquisitionTime));
  if (record.returnPeriod != null) parts.push(line('Return Period', `${record.returnPeriod}-year`));
  if (record.returnPeriod == null) {
    parts.push(
      line('Recurrence (USGS)', record.recurrenceUsgs),
      line('Recurrence (NWM)', record.recurrenceNwm),
      line('Discharge (USGS) [cms]', record.dischargeUsgs),
      line('Discharge (NWM) [cms]', record.dischargeNwm),
      line('USGS Gauge ID', record.gaugeId),
    );
  }
  parts.push(
    '',
    '[Data]',
    line('Resolution', `${record.resolution} m`),
    line('Platform', record.platform),
    line('Product Category', productCategory),
    line('Access', record.accessRights),
    '',
    '[Provenance]',
    line('Source', record.source),
    line('Description', record.description),
  );
  if (record.references.length) {
    parts.push('References:');
    record.references.forEach(r => parts.push(`  ${r}`));
  }
  return parts.join('\n');
}

function MetaModal({ record, onClose }: { record: FIMRecord; onClose: () => void }) {
  useEscapeKey(onClose);
  const [showMore, setShowMore] = useState(false);

  const handleDownloadText = () => {
    saveAs(new Blob([buildMetadataText(record)], { type: 'text/plain' }), `${record.siteId}_metadata.txt`);
  };

  const handleDownloadJson = async () => {
    try {
      const res = await fetch(record.metaUrl);
      if (!res.ok) return;
      saveAs(await res.blob(), `${record.siteId}_metadata.json`);
    } catch { /* silent */ }
  };

  const groups = buildModalGroups(record);
  const hasMore = !!record.description || record.references.length > 0;
  const moreLabel = [
    record.description ? 'description' : '',
    record.references.length ? `references (${record.references.length})` : '',
  ].filter(Boolean).join(', ');

  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={modalCardStyle} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>FIM Record — {record.siteId}</span>
          <button style={modalCloseBtnStyle} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ ...modalBodyStyle, display: 'flex', flexDirection: 'column', gap: '0.625rem' }}>
          {groups.map(group => (
            <div key={group.title}>
              <div style={modalSectionTitleStyle}>{group.title}</div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <tbody>
                  {group.rows.map(([label, value]) => (
                    <tr key={label} style={{ borderBottom: '0.0625rem solid #f0f0f0' }}>
                      <td style={modalLabelCellStyle}>{label}</td>
                      <td style={modalValueCellStyle}>{value}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {group.title === 'Provenance' && hasMore && (
                <>
                  <button
                    type="button"
                    onClick={() => setShowMore(s => !s)}
                    aria-expanded={showMore}
                    style={modalMoreBtnStyle}
                  >
                    <span>More details — {moreLabel}</span>
                    <span aria-hidden="true" style={{ display: 'inline-block', transform: showMore ? 'rotate(180deg)' : 'none' }}>▾</span>
                  </button>
                  {showMore && (
                    <div style={modalMoreBodyStyle}>
                      {record.description && <p style={{ margin: '0 0 0.5rem' }}>{record.description}</p>}
                      {record.references.map((ref, i) => (
                        <p key={i} style={{ margin: '0 0 0.375rem' }}>{ref}</p>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div style={modalFooterStyle}>
          <button onClick={handleDownloadText} style={modalDlBtnStyle('#e8e8e8', '#333')}>
            <DownloadIcon /> Download .txt
          </button>
          <button onClick={handleDownloadJson} style={modalDlBtnStyle(COLORS.brand, COLORS.ink)}>
            <DownloadIcon /> Download .json
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Cap modal ─────────────────────────────────────────────────
function CapModal({ cap, onClose }: { cap: number; onClose: () => void }) {
  useEscapeKey(onClose);
  return (
    <div style={modalBackdropStyle} onClick={onClose}>
      <div style={{ ...modalCardStyle, maxWidth: '26rem' }} onClick={e => e.stopPropagation()}>
        <div style={modalHeaderStyle}>
          <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Bulk Download Limit Reached</span>
          <button style={modalCloseBtnStyle} onClick={onClose} aria-label="Close">✕</button>
        </div>
        <div style={{ ...modalBodyStyle, fontSize: '0.8125rem', lineHeight: 1.6 }}>
          <p style={{ margin: '0 0 0.75rem' }}>
            Bulk download is capped at <strong>{cap} records</strong> to keep things running smoothly for everyone.
          </p>
          <p style={{ margin: 0 }}>
            Need more?{' '}
            <a href="https://pypi.org/project/fimeval/" target="_blank" rel="noreferrer">
              Use the FIMeval Python API
            </a>
            {' '}— it's designed for large-scale batch access and has no item limit.
          </p>
        </div>
        <div style={modalFooterStyle}>
          <button onClick={onClose} style={modalDlBtnStyle('#e8e8e8', '#333')}>Got it</button>
        </div>
      </div>
    </div>
  );
}

// ── Sort indicator icon ───────────────────────────────────────
function SortIndicator({ active, dir }: { active: boolean; dir: SortDir }) {
  return (
    <span style={{ marginLeft: '0.25rem', opacity: active ? 1 : 0.3, fontSize: '0.625rem' }}>
      {active ? (dir === 'asc' ? '▲' : '▼') : '⇅'}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────
const tableHeaderBtnStyle: React.CSSProperties = {
  fontFamily: 'inherit',
  fontSize: '0.8125rem',
  cursor: 'pointer',
  padding: '0.125rem 0.5rem',
  border: '0.0625rem solid #bbb',
  borderRadius: '0.25rem',
  backgroundColor: '#fff',
};

const containerStyle: React.CSSProperties = {
  height: '100%', overflow: 'hidden', display: 'flex',
  flexDirection: 'column', backgroundColor: '#fff', borderTop: '0.125rem solid #ccc',
};
const thStyle: React.CSSProperties = {
  padding: '0.375rem 0.625rem', textAlign: 'left', borderBottom: '0.125rem solid #ccc',
  whiteSpace: 'normal', wordBreak: 'break-word', position: 'sticky',
  top: 0,
};
const tdStyle: React.CSSProperties = {
  padding: '0.3125rem 0.625rem', borderBottom: '0.0625rem solid #eee',
  whiteSpace: 'normal', wordBreak: 'break-word',
};

const infoBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', cursor: 'pointer',
  fontSize: '0.9375rem', color: '#666', padding: '0 0.125rem', lineHeight: 1,
};

const modalBackdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9500,
  backgroundColor: 'rgba(0,0,0,0.45)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: '1rem',
};

const modalCardStyle: React.CSSProperties = {
  background: '#fff', borderRadius: '0.5rem',
  boxShadow: '0 0.5rem 2rem rgba(0,0,0,0.25)',
  width: '100%', maxWidth: '26.25rem',
  display: 'flex', flexDirection: 'column', overflow: 'hidden',
};

const modalHeaderStyle: React.CSSProperties = {
  background: COLORS.ink, color: COLORS.inkLight,
  padding: '0.75rem 1rem',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
};

const modalCloseBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: COLORS.inkLight,
  fontSize: '1rem', cursor: 'pointer', padding: '0 0.125rem', lineHeight: 1,
};

const modalBodyStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', overflowY: 'auto', maxHeight: '60vh',
};

const modalSectionTitleStyle: React.CSSProperties = {
  fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase',
  color: '#3f6b76', padding: '0.25rem 0 0.125rem', borderBottom: '0.0625rem solid #e3eef1',
};

const modalMoreBtnStyle: React.CSSProperties = {
  marginTop: '0.375rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  width: '100%', boxSizing: 'border-box', padding: '0.5rem 0.625rem',
  background: '#f4f8f9', border: '0.0625rem solid #dce7ea', borderRadius: '0.25rem',
  color: COLORS.ink, fontSize: '0.78rem', fontWeight: 600, cursor: 'pointer',
  textAlign: 'left', fontFamily: 'inherit',
};

const modalMoreBodyStyle: React.CSSProperties = {
  padding: '0.5rem 0.625rem 0.125rem', fontSize: '0.78rem', lineHeight: 1.5, color: '#333',
  overflowWrap: 'anywhere',
};

const modalLabelCellStyle: React.CSSProperties = {
  fontWeight: 600, color: '#555', paddingRight: '0.75rem',
  paddingTop: '0.375rem', paddingBottom: '0.375rem',
  whiteSpace: 'nowrap', fontSize: '0.75rem', width: '40%',
};

const modalValueCellStyle: React.CSSProperties = {
  color: '#222', paddingTop: '0.375rem', paddingBottom: '0.375rem', fontSize: '0.8125rem',
};

const modalFooterStyle: React.CSSProperties = {
  padding: '0.75rem 1rem', borderTop: '0.0625rem solid #eee',
  display: 'flex', gap: '0.625rem', justifyContent: 'flex-end',
};

const modalDlBtnStyle = (bg: string, color: string): React.CSSProperties => ({
  display: 'inline-flex', alignItems: 'center', gap: '0.375rem',
  padding: '0.3125rem 0.75rem', fontSize: '0.8125rem', fontFamily: 'inherit',
  border: '0.0625rem solid rgba(0,0,0,0.12)', borderRadius: '0.25rem',
  background: bg, color, cursor: 'pointer', fontWeight: 500,
});