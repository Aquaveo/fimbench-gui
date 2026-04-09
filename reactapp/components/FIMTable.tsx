import React, { useEffect, useState } from 'react';

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
function parseRecord(j: any, s3Prefix: string, fileName: string) {
  // River Basin — string or array
  const basin = Array.isArray(j['River Basin Name'])
    ? j['River Basin Name'].join(', ')
    : (j['River Basin Name'] ?? '—');

  // HUC8 — string or array
  const huc8 = Array.isArray(j['HUC8'])
    ? j['HUC8'].join(', ')
    : (j['HUC8'] ?? '—');

  // Date — Tier 1/2/3: "Flooding Event" (YYYYMMDD)
  //        Tier 4: synthetic, no date
  //        HWM: "Start Date of the Flood" / "End Date of the Flood" (YYYYMMDD)
  const fmt = (d: string) =>
    d.length === 8 ? `${d.slice(0,4)}-${d.slice(4,6)}-${d.slice(6,8)}` : d;

  const rawEvent: string = j['Flooding Event'] ?? '';
  const startDate: string = j['Start Date of the Flood'] ?? '';
  const endDate: string   = j['End Date of the Flood'] ?? '';

  let year = '—';
  let date = '—';

  if (rawEvent) {
    year = rawEvent.slice(0, 4);
    date = fmt(rawEvent);
  } else if (startDate) {
    year = startDate.slice(0, 4);
    date = endDate && endDate !== startDate
      ? `${fmt(startDate)} – ${fmt(endDate)}`
      : fmt(startDate);
  }

  // Platform — Tier 1/2/3: "Full form of the sensor code"
  //            Tier 4: "BLE" key exists → label it
  //            HWM: may use sensor code or another key
  let platform: string =
    j['Full form of the sensor code'] ??
    j['Sensor'] ??
    j['Platform'] ??
    '';
  if (!platform && j['BLE']) platform = 'Base Level Engineering (FEMA BLE)';
  if (!platform) platform = '—';

  // Quality — HWM JSONs have no "Quality" field, default to "HWM"
  const quality = j['Quality'] ?? (startDate ? 'HWM' : '—');

  return {
    riverBasin: basin,
    state:      j['State'] ?? '—',
    year,
    date,
    resolution: j['Resolution in meter'] ?? 0,
    huc8,
    quality,
    platform,
    tifUrl:  buildTifUrl(s3Prefix, fileName),
    metaUrl: buildMetaUrl(s3Prefix, fileName),
  };
}

// ── Types ─────────────────────────────────────────────────────
type FIMRecord = ReturnType<typeof parseRecord>;
type Props = { features: any[] };
const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features }: Props) {
  const [records, setRecords] = useState<FIMRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [page, setPage]       = useState(1);

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
            return parseRecord(j, f.s3_prefix, f.file_name);
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

  const totalPages  = Math.max(1, Math.ceil(records.length / PAGE_SIZE));
  const pageRows    = records.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

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
            <col style={{ width: 180 }} /> {/* River/Basin */}
            <col style={{ width: 110 }} /> {/* State */}
            <col style={{ width: 55  }} /> {/* Year */}
            <col style={{ width: 95  }} /> {/* Date */}
            <col style={{ width: 90  }} /> {/* Resolution */}
            <col style={{ width: 130 }} /> {/* HUC8 */}
            <col style={{ width: 80  }} /> {/* Quality */}
            <col style={{ width: 180 }} /> {/* Platform */}
            <col style={{ width: 90  }} /> {/* Download */}
            <col style={{ width: 80  }} /> {/* Metadata */}
          </colgroup>
          <thead>
            <tr style={{ backgroundColor: '#e8e8e8' }}>
              {['River / Basin','State','Year','Date','Resolution (m)','HUC8','Quality','Platform','Download FIM','Metadata'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((r, i) => (
              <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9', verticalAlign: 'top' }}>
                <td style={tdStyle}>{r.riverBasin}</td>
                <td style={tdStyle}>{r.state}</td>
                <td style={tdStyle}>{r.year}</td>
                <td style={tdStyle}>{r.date}</td>
                <td style={{ ...tdStyle, textAlign: 'right' }}>{Number(r.resolution).toFixed(2)}</td>
                <td style={tdStyle}>{r.huc8}</td>
                <td style={tdStyle}>{r.quality}</td>
                <td style={tdStyle}>{r.platform}</td>
                <td style={tdStyle}><a href={r.tifUrl}  target="_blank" rel="noreferrer">Download</a></td>
                <td style={tdStyle}><a href={r.metaUrl} target="_blank" rel="noreferrer">Download</a></td>
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
  height: '100%', overflow: 'hidden', display: 'flex',
  flexDirection: 'column', backgroundColor: '#fff', borderTop: '2px solid #ccc',
};
const thStyle: React.CSSProperties = {
  padding: '6px 10px', textAlign: 'left', borderBottom: '2px solid #ccc',
  whiteSpace: 'normal', wordBreak: 'break-word', position: 'sticky',
  top: 0, backgroundColor: '#e8e8e8',
};
const tdStyle: React.CSSProperties = {
  padding: '5px 10px', borderBottom: '1px solid #eee',
  whiteSpace: 'normal', wordBreak: 'break-word',
};