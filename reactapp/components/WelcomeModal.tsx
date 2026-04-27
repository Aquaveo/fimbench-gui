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
        viewBox="0 0 375.01 375.01"
        preserveAspectRatio="none"
        fill="#25C2DF"
        aria-hidden="true"
        style={floatingArrowStyle}
      >
        <g>
          <g>
            <path d="M330.254,210.966c-56.916,1.224-110.16,25.704-167.076,28.764c-16.524,0.612-33.048-1.224-45.9-8.568
              c23.256-4.283,45.288-12.239,61.812-27.54c17.749-15.911,19.584-45.287,8.568-66.095c-10.404-19.584-36.72-20.196-55.08-15.3
              C89.125,132.63,59.75,184.65,84.229,221.369c-26.928,1.836-53.856,0-80.172,1.225c-5.508,0.611-5.508,8.567,0.612,8.567
              c26.928,1.836,59.364,4.284,91.188,2.448c1.836,1.225,3.672,3.061,5.508,4.284c64.872,45.288,159.732-11.628,229.5-13.464
              C338.821,223.817,338.821,210.354,330.254,210.966z M89.737,196.277c-6.732-25.091,15.3-46.511,35.496-56.916
              c20.196-10.404,48.96-10.404,55.692,15.912c7.956,30.6-18.36,48.959-43.452,56.916c-11.628,3.672-22.644,6.12-34.272,7.344
              C96.47,213.413,92.186,206.069,89.737,196.277z"/>
            <path d="M371.869,211.577c-8.567-5.508-16.523-11.016-24.479-16.523c-6.732-4.896-13.464-10.404-21.42-12.24
              c-6.12-1.836-12.24,7.344-6.732,11.627c6.732,4.896,14.076,9.18,20.809,13.464c4.896,3.061,9.792,6.732,14.075,9.792
              c-4.896,2.448-9.792,4.284-14.688,6.732c-3.672,1.836-7.956,3.672-11.628,5.508c-1.224,0.612-2.448,1.836-3.061,3.06
              c-1.836,2.448-0.611,1.225,0,0.612c-2.447,1.836-2.447,7.956,1.837,7.344l0,0c1.224,0.612,2.447,0.612,4.283,0.612
              c4.284-1.224,9.181-3.06,13.464-4.896c9.181-3.673,18.36-7.345,26.929-12.24C376.153,220.758,376.153,214.025,371.869,211.577z"/>
          </g>
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
  top: '6vh',
  right: '4vw',
  width: '42vw',
  height: '62vh',
  transform: 'rotate(320deg)',
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
