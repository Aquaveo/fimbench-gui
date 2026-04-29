import type React from 'react';

const LOGO_BASE = '/static/fimbench_gui/images';

export default function Footer() {
  return (
    <footer style={footerStyle}>
      <div style={logosContainerStyle}>
        <img src={`${LOGO_BASE}/1_CIROH_Logo.png`}                    alt="CIROH"                   style={logoStyle} />
        <img src={`${LOGO_BASE}/2_UA-University-of-Alabama_Logo.png`} alt="University of Alabama"   style={logoStyle} />
        <img src={`${LOGO_BASE}/3_BYU-Brigham-Young-University_Logo.png`} alt="Brigham Young University" style={logoStyle} />
        <img src={`${LOGO_BASE}/4_Aquaveo_Logo.png`}                  alt="Aquaveo"                 style={logoStyle} />
      </div>
      <p style={attributionStyle}>
        Map powered by{' '}
        <a href="https://maplibre.org" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>MapLibre</a>
        {' '}| Basemap tiles © <a href="https://www.esri.com" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>Esri</a>
      </p>
    </footer>
  );
}

const footerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: '10px 20px',
  background: '#b8c2c9',
  borderTop: '1px solid #d9e1e5',
  flexShrink: 0,
  position: 'relative',
};

const logosContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 32,
  flexWrap: 'wrap',
};

const logoStyle: React.CSSProperties = {
  height: 36,
  maxWidth: 140,
  objectFit: 'contain',
};

const attributionStyle: React.CSSProperties = {
  position: 'absolute',
  right: 16,
  bottom: 6,
  margin: 0,
  fontSize: 10,
  color: '#4a5a60',
};
