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
        viewBox="0 0 367.339 367.34"
        fill="#25C2DF"
        aria-hidden="true"
        style={floatingArrowStyle}
      >
        <g>
          <path d="M337.591,0.932c-13.464,6.12-26.315,12.852-39.168,20.196c-11.628,6.12-25.704,12.24-35.496,21.42
            c-5.508,4.896,0,15.3,7.344,12.852c0,0,0.612,0,0.612-0.612c1.836,1.224,3.061,2.448,4.896,4.284c0,0.612,0.611,1.836,0.611,2.448
            c0.612,1.224,1.836,2.448,3.061,3.672c-17.748,33.048-34.272,66.096-55.08,96.696c-6.12,9.18-12.853,17.748-20.808,25.704
            c-19.584-31.212-51.409-67.32-89.965-60.588c-50.796,9.18-23.256,63.647,3.06,82.008c31.212,22.644,58.14,21.42,85.068,0
            c12.24,20.808,20.809,44.063,19.584,66.708c-1.836,54.468-50.796,63.647-91.8,49.571c6.12-15.912,7.956-34.271,4.284-50.184
            c-6.12-28.764-50.184-54.468-75.888-34.272c-25.092,20.196,22.032,71.604,37.332,82.009c4.284,3.06,9.18,6.119,14.076,8.567
            c-0.612,0.612-0.612,1.225-1.224,1.836c-28.152,44.064-65.484,6.12-82.62-25.092c-2.448-4.896-9.18-0.612-7.344,4.284
            c14.076,32.436,42.84,70.38,81.396,48.348c9.18-5.508,17.136-13.464,22.644-23.256c33.66,13.464,72.829,13.464,97.308-17.136
            c29.376-36.72,11.017-84.456-8.567-119.952c0.611-0.612,0.611-0.612,1.224-1.224c34.884-33.66,56.304-81.396,78.336-124.236
            c4.284,3.06,9.181,6.12,13.464,9.18c3.061,1.836,7.345,1.224,9.792-1.224c17.748-20.808,31.212-45.9,35.496-73.44
            C351.055,2.768,344.324-2.128,337.591,0.932z M178.471,207.787c-23.256,13.464-46.512-3.06-63.648-18.972
            c-22.644-20.808-16.524-54.468,18.36-47.735c17.748,3.672,31.824,19.584,43.452,32.436c6.12,6.732,12.241,14.687,17.749,23.255
            C189.488,201.056,183.979,204.728,178.471,207.787z M116.047,319.171C116.047,319.171,115.435,319.171,116.047,319.171
            c-16.524-8.567-28.764-20.808-38.556-36.107c-4.284-6.732-7.956-14.076-9.792-22.032c-6.12-20.808,26.928-10.404,35.496-6.12
            C126.451,267.764,124.615,297.14,116.047,319.171z M306.379,67.028c-0.612,0-0.612-0.612-1.224-0.612
            c0-1.836-1.225-3.672-3.672-4.896c-4.284-1.836-8.568-4.284-12.853-6.732c-1.836-1.224-5.508-4.896-5.508-3.672
            c0-0.612-0.612-1.224-1.224-1.224c6.731-3.672,13.464-8.568,20.195-12.24c8.568-4.896,17.748-9.792,26.929-14.688
            C324.74,38.264,316.784,53.564,306.379,67.028z"/>
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

// The SVG's arrowhead sits at the top-right of its viewBox (~91% across, ~0% down).
// At 220×220px, that's ~18px from the right edge and ~1px from the top.
// Positioning at right:0/top:18 places the tip at approximately right:18px, top:19px —
// landing on the Documentation link in the header (header padding-right: 20px, link ~25px from top).
const floatingArrowStyle: React.CSSProperties = {
  position: 'absolute',
  top: 18,
  right: 0,
  width: 220,
  height: 220,
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
