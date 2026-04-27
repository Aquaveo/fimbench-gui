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
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none" aria-hidden="true" style={{ flexShrink: 0 }}>
              <path d="M 5 31 C 5 14 21 5 31 5" stroke="#25C2DF" strokeWidth="2.5" strokeLinecap="round"/>
              <path d="M 25 3 L 31 5 L 27 11" stroke="#25C2DF" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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

const checkboxLabelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', fontSize: 13, color: '#555', cursor: 'pointer',
};

const docsCalloutStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: 12,
  background: '#f0fbfd', border: '1px solid #b8ecf5',
  borderRadius: 6, padding: '10px 14px',
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
