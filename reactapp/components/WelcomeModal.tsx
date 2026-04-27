import { useEffect } from 'react';

type Props = { onClose: () => void };

export default function WelcomeModal({ onClose }: Props) {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div style={backdropStyle} onClick={onClose} role="dialog" aria-modal="true" aria-label="Welcome to FIMBench">
      <div style={cardStyle} onClick={e => e.stopPropagation()}>

        {/* Header */}
        <div style={cardHeaderStyle}>
          <h2 style={titleStyle}>Welcome to FIMBench</h2>
          <p style={taglineStyle}>Explore and download benchmark Flood Inundation Maps across the U.S.</p>
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
        </div>

        {/* Footer */}
        <div style={footerStyle}>
          <p style={dismissNoteStyle}>This message won&apos;t appear again after you close it.</p>
          <button style={btnStyle} onClick={onClose} autoFocus>
            Get Started
          </button>
        </div>

      </div>
    </div>
  );
}

const TIERS = [
  { label: 'Tier 1',           color: '#E74C3C' },
  { label: 'Tier 2',           color: '#F39C12' },
  { label: 'Tier 3',           color: '#2ECC71' },
  { label: 'Tier 4 (BLE)',     color: '#9B59B6' },
  { label: 'HWM',              color: '#EC6FA3' },
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
  padding: '20px 24px 16px',
};

const titleStyle: React.CSSProperties = {
  margin: 0, fontSize: 22, fontWeight: 700, letterSpacing: 0.5, color: '#25C2DF',
};

const taglineStyle: React.CSSProperties = {
  margin: '4px 0 0', fontSize: 13, color: '#D1EFF6',
};

const bodyStyle: React.CSSProperties = {
  padding: '20px 24px 8px',
};

const introStyle: React.CSSProperties = {
  margin: '0 0 14px', fontSize: 14, color: '#333', lineHeight: 1.55,
};

const listStyle: React.CSSProperties = {
  margin: '0 0 16px', paddingLeft: 20, fontSize: 13.5, color: '#333', lineHeight: 1.7,
};

const tierLegendStyle: React.CSSProperties = {
  display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8,
};

const tierBadgeStyle = (color: string): React.CSSProperties => ({
  display: 'inline-block', padding: '2px 10px', borderRadius: 12,
  backgroundColor: color, color: '#fff', fontSize: 12, fontWeight: 600,
});

const footerStyle: React.CSSProperties = {
  padding: '12px 24px 20px',
  display: 'flex', alignItems: 'center', justifyContent: 'space-between',
  borderTop: '1px solid #eee',
};

const dismissNoteStyle: React.CSSProperties = {
  margin: 0, fontSize: 11, color: '#888',
};

const btnStyle: React.CSSProperties = {
  padding: '8px 22px', fontSize: 14, fontWeight: 600,
  fontFamily: 'inherit', cursor: 'pointer',
  backgroundColor: '#25C2DF', color: '#fff',
  border: 'none', borderRadius: 5,
};
