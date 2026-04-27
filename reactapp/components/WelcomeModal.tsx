import { useEffect, useState } from 'react';

type Props = { onClose: (dontShowAgain: boolean) => void };

export default function WelcomeModal({ onClose }: Props) {
  const [dontShow, setDontShow] = useState(false);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(dontShow); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose, dontShow]);

  return (
    <div style={backdropStyle} onClick={() => onClose(dontShow)} role="dialog" aria-modal="true" aria-label="Welcome to FIMBench">

      {/* Large swirly arrow floating outside the card, tip aimed at the Documentation link */}
      <svg
        viewBox="0 0 421.943 421.944"
        preserveAspectRatio="none"
        fill="#25C2DF"
        aria-hidden="true"
        style={floatingArrowStyle}
      >
        <g>
          <path d="M418.054,273.641c-17.748-11.016-33.66-23.868-48.348-38.556c-4.896-4.896-13.464-1.225-13.464,5.508
            c0,5.508-0.612,11.016-0.612,16.523c-53.244,9.792-106.488,14.076-160.957,14.688c-45.9,1.224-107.712,6.12-149.328-15.912
            c-31.824-17.136-36.72-56.917-23.256-87.517c5.508-12.852,15.3-23.256,27.54-30.6c14.076-8.568,28.152-3.672,42.84-7.344
            c1.836-0.612,2.448-3.06,1.224-4.896c-22.644-23.868-62.424,3.672-77.112,23.256c-20.808,27.54-22.032,67.933-3.672,96.696
            c26.928,42.841,91.188,39.78,134.64,41.004c68.544,2.448,140.76,0.612,208.081-14.688c0,6.12,0.612,11.628,2.448,17.748
            c0,1.224,0.611,1.836,1.224,2.448c-4.896,4.283-0.612,15.3,7.956,13.464c17.748-3.672,35.496-9.181,52.02-17.136
            C423.562,284.657,422.338,276.701,418.054,273.641z M370.93,257.729c8.568,7.344,17.136,14.688,26.928,21.42
            c-8.567,3.672-17.748,6.12-26.928,8.568c0-0.612,0-1.225,0-2.448C369.094,276.089,369.706,266.909,370.93,257.729z"/>
        </g>
      </svg>

      {/* Modal card */}
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={cardHeaderStyle}>
          <div>
            <h2 style={titleStyle}>Welcome to FIMBench</h2>
            <p style={taglineStyle}>Explore and download benchmark Flood Inundation Maps across the U.S.</p>
          </div>
          <button style={closeBtnStyle} onClick={() => onClose(dontShow)} aria-label="Close">✕</button>
        </div>

        {/* Body */}
        <div style={bodyStyle}>
          <p style={introStyle}>
            FIMBench is a catalog of validated flood inundation maps collected from multiple
            sources and tiers. Use the map and table to explore, filter, and download FIM
            data for your region of interest.
          </p>

          <ul style={listStyle}>
            <li><strong>Filter</strong> by FIM tier, state, HUC8 watershed, date range, or return period using the sidebar.</li>
            <li><strong>Explore</strong> visible extents on the map — click a feature to highlight it and see details.</li>
            <li><strong>Select records</strong> in the table with plain click, Ctrl+click (toggle), or Shift+click (range).</li>
            <li><strong>Download</strong> individual GeoTIFFs and metadata JSON, or use <em>Download Selected</em> to bulk-export a zip.</li>
          </ul>

          <div style={tierLegendStyle}>
            {TIERS.map(t => (
              <span key={t.label} style={tierBadgeStyle(t.color)}>{t.label}</span>
            ))}
          </div>

          {/* Docs callout */}
          <div style={docsCalloutStyle}>
            <p style={{ margin: 0, fontSize: 13, color: '#333', lineHeight: 1.55 }}>
              For a full guide to all features, click the{' '}
              <span style={docCircleStyle}>Documentation</span>
              {' '}link in the header bar above.
            </p>
          </div>

          <label style={checkboxLabelStyle}>
            <input
              type="checkbox"
              checked={dontShow}
              onChange={e => setDontShow(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Don&apos;t show on startup
          </label>
        </div>

      </div>
    </div>
  );
}

const TIERS = [
  { label: 'Tier 1',       color: '#E74C3C' },
  { label: 'Tier 2',       color: '#F39C12' },
  { label: 'Tier 3',       color: '#2ECC71' },
  { label: 'Tier 4 (BLE)', color: '#9B59B6' },
  { label: 'HWM',          color: '#EC6FA3' },
];

const floatingArrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: '20vh',
  right: '7vw',
  width: '42vw',
  height: '62vh',
  transform: 'rotate(310deg)',
  pointerEvents: 'none',
};

const backdropStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, zIndex: 9000,
  backgroundColor: 'rgba(0,0,0,0.55)',
  display: 'flex', alignItems: 'center', justifyContent: 'center',
  padding: 16,
};

const cardStyle: React.CSSProperties = {
  background: '#fff',
  borderRadius: 8,
  boxShadow: '0 8px 32px rgba(0,0,0,0.28)',
  width: '100%',
  maxWidth: 500,
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
};

const cardHeaderStyle: React.CSSProperties = {
  background: '#152428',
  padding: '18px 20px 14px 24px',
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: 12,
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 0.5, color: '#25C2DF',
};

const taglineStyle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: 13, color: '#D1EFF6',
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none',
  border: 'none',
  color: '#D1EFF6',
  fontSize: 18,
  lineHeight: 1,
  cursor: 'pointer',
  padding: '2px 4px',
  flexShrink: 0,
  marginTop: 2,
};

const bodyStyle: React.CSSProperties = {
  padding: '20px 24px 22px',
};

const introStyle: React.CSSProperties = {
  margin: '0 0 14px', fontSize: 14, color: '#333', lineHeight: 1.55,
};

const listStyle: React.CSSProperties = {
  margin: '0 0 16px', paddingLeft: 20, fontSize: 13.5, color: '#333', lineHeight: 1.7,
};

const tierLegendStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 16,
};

const tierBadgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 12,
  backgroundColor: color, color: '#fff', fontSize: 12, fontWeight: 600,
});

const docsCalloutStyle: React.CSSProperties = {
  background: '#f0fbfd',
  border: '1px solid #b8ecf5',
  borderRadius: 6,
  padding: '10px 14px',
  marginBottom: 16,
};

const docCircleStyle: React.CSSProperties = {
  display: 'inline-block',
  border: '2px solid #25C2DF',
  borderRadius: '999px',
  padding: '0 7px',
  fontSize: 12,
  fontWeight: 600,
  color: '#25C2DF',
  lineHeight: 1.6,
};

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', fontSize: 13, color: '#555', cursor: 'pointer',
};
