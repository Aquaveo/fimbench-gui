import type React from 'react';

const LOGO_BASE = '/static/fimbench_gui/images';

export default function Footer() {
  return (
    <footer style={footerStyle}>

      {/* Logos section */}
      <div style={logosSectionStyle}>
        <div style={logosContainerStyle}>
          <img
            src={`${LOGO_BASE}/1_CIROH-Horizontal-Logo_AI-Canva-470x125px.png`}
            alt="CIROH"
            style={cirohLogoStyle}
          />

          <img
            src={`${LOGO_BASE}/2_UA-University-of-Alabama_Logo.png`}
            alt="University of Alabama"
            style={logoStyle}
          />

          <img
            src={`${LOGO_BASE}/3_BYU-Brigham-Young-University_Logo.png`}
            alt="Brigham Young University"
            style={logoStyle}
          />

          <img
            src={`${LOGO_BASE}/4_Aquaveo_Logo.png`}
            alt="Aquaveo"
            style={logoStyle}
          />
        </div>
      </div>

      {/* Attribution section */}
      <div style={attributionSectionStyle}>
        <p style={attributionStyle}>
          Map powered by{' '}
          <a href="https://maplibre.org" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            MapLibre
          </a>{' '}
          | Basemap tiles ©{' '}
          <a href="https://www.esri.com" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
            Esri
          </a>
        </p>
      </div>

    </footer>
  );
}

/* =======================
   Footer container
======================= */

const footerStyle: React.CSSProperties = {
  background: '#b8c2c9',
  padding: '1rem 0',
};

/* =======================
   Logos section (top)
======================= */

const logosSectionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingBottom: '0.5rem', // 👈 space between logos and attribution
};

const logosContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2rem',
  flexWrap: 'wrap',
};

/* =======================
   Attribution section (bottom)
======================= */

const attributionSectionStyle: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  paddingTop: '0.25rem', // 👈 extra separation control if needed
};

const attributionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.625rem',
  color: '#4a5a60',
  textAlign: 'center',
};

/* =======================
   Logos
======================= */

const cirohLogoStyle: React.CSSProperties = {
  height: '2.25rem',
  objectFit: 'contain',
  display: 'block',
};

const logoStyle: React.CSSProperties = {
  height: '2.25rem',
  objectFit: 'contain',
  display: 'block',
};