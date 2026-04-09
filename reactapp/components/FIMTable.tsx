import React, { useState } from 'react';

// ── Constants ─────────────────────────────────────────────────
const MINIO_BASE = 'http://127.0.0.1:9000/fimbench';

// s3_prefix in features is "FIM_Database/Tier_4/SITE_ID"
// MinIO path is              "Tier_4/SITE_ID"
// So we strip the "FIM_Database/" prefix
function toMinioPath(s3Prefix: string): string {
  return s3Prefix.replace(/^FIM_Database\//, '');
}

function buildTifUrl(s3Prefix: string, fileName: string): string {
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${fileName}`;
}

function buildMetaUrl(s3Prefix: string, fileName: string): string {
  const metaFile = fileName.replace('_BM.tif', '_metadata.json');
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${metaFile}`;
}

// ── Types ─────────────────────────────────────────────────────
type Props = {
  features: any[];
};

const PAGE_SIZE = 20;

// ── Component ─────────────────────────────────────────────────
export default function FIMTable({ features }: Props) {
  const [page, setPage] = useState(1);

  // Reset to page 1 whenever features change (map moved)
  React.useEffect(() => { setPage(1); }, [features]);

  const totalPages = Math.max(1, Math.ceil(features.length / PAGE_SIZE));
  const pageRows   = features.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  if (features.length === 0) {
    return (
      <div style={containerStyle}>
        <p style={{ color: '#888', padding: 12 }}>
          No FIM extents visible in current map view.
        </p>
      </div>
    );
  }

  return (
    <div style={containerStyle}>

      {/* Header */}
      <div style={{ padding: '6px 12px', borderBottom: '1px solid #ddd', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <strong>FIM Records ({features.length})</strong>
        {totalPages > 1 && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>‹</button>
            <span>Page {page} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>›</button>
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{ overflowX: 'auto', overflowY: 'auto', maxHeight: 'calc(100% - 40px)' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
          <thead>
            <tr style={{ backgroundColor: '#e8e8e8' }}>
              {['River / Basin','State','Year','Date','Resolution (m)','HUC8','Quality','Platform','Download FIM','Metadata'].map(h => (
                <th key={h} style={thStyle}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((p, i) => {
              const event: string = p.flooding_event ?? p.date ?? '';
              const year = event.slice(0, 4);
              const date = event.length === 8
                ? `${event.slice(0,4)}-${event.slice(4,6)}-${event.slice(6,8)}`
                : event;

              const tifUrl  = buildTifUrl(p.s3_prefix, p.file_name);
              const metaUrl = buildMetaUrl(p.s3_prefix, p.file_name);

              return (
                <tr key={i} style={{ backgroundColor: i % 2 === 0 ? '#fff' : '#f9f9f9' }}>
                  <td style={tdStyle}>{p.basin ?? '—'}</td>
                  <td style={tdStyle}>{p.state ?? '—'}</td>
                  <td style={tdStyle}>{year || '—'}</td>
                  <td style={tdStyle}>{date || '—'}</td>
                  <td style={{ ...tdStyle, textAlign: 'right' }}>
                    {p.resolution_m != null ? Number(p.resolution_m).toFixed(2) : '—'}
                  </td>
                  <td style={tdStyle}>{p.huc8 ?? '—'}</td>
                  <td style={tdStyle}>{p.quality ?? p.tier ?? '—'}</td>
                  <td style={tdStyle}>{p.platform ?? p.source ?? '—'}</td>
                  <td style={tdStyle}>
                    <a href={tifUrl} target="_blank" rel="noreferrer">Download</a>
                  </td>
                  <td style={tdStyle}>
                    <a href={metaUrl} target="_blank" rel="noreferrer">Download</a>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ── Styles ────────────────────────────────────────────────────
const containerStyle: React.CSSProperties = {
  height: '100%',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  backgroundColor: '#fff',
  borderTop: '2px solid #ccc',
};

const thStyle: React.CSSProperties = {
  padding: '6px 10px',
  textAlign: 'left',
  borderBottom: '2px solid #ccc',
  whiteSpace: 'nowrap',
  position: 'sticky',
  top: 0,
  backgroundColor: '#e8e8e8',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 10px',
  borderBottom: '1px solid #eee',
  whiteSpace: 'nowrap',
};