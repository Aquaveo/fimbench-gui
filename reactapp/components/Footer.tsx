import type React from 'react';

const LOGO_BASE = '/static/fimbench_gui/images';

export default function Footer() {
  return (
    <footer style={footerStyle}>

      {/* Left: MapLibre + Esri attribution */}
      <p style={{ ...attributionStyle, flex: 1 }}>
        Map powered by{' '}
        <a href="https://maplibre.org" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          MapLibre
        </a>{' '}
        | Basemap tiles ©{' '}
        <a href="https://www.esri.com" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          Esri
        </a>
      </p>

      {/* Center: logos */}
      <div style={logosContainerStyle}>
        <a href="https://ciroh.ua.edu/" target="_blank" rel="noreferrer">
          <img
            src={`${LOGO_BASE}/1_CIROH-Horizontal-Logo_AI-Canva-470x125px.png`}
            alt="CIROH"
            style={logoStyle}
          />
        </a>

        <a href="https://www.ua.edu/" target="_blank" rel="noreferrer">
          <img
            src={`${LOGO_BASE}/3_UA-University-of-Alabama_Logo.png`}
            alt="University of Alabama"
            style={logoStyle}
          />
        </a>

        <a href="https://sdml.ua.edu/" target="_blank" rel="noreferrer">
          <img
            src={`${LOGO_BASE}/4_SDML-lab_logo.png`}
            alt="Surface Dynamics Modeling Lab"
            style={logoStyle}
          />
        </a>

        <a href="https://www.byu.edu/" target="_blank" rel="noreferrer">
          <img
            src={`${LOGO_BASE}/5_BYU-Brigham-Young-University_Logo.png`}
            alt="Brigham Young University"
            style={logoStyle}
          />
        </a>

        <a href="https://aquaveo.com/" target="_blank" rel="noreferrer">
          <img
            src={`${LOGO_BASE}/6_Aquaveo-blue-black_Logo.png`}
            alt="Aquaveo"
            style={logoStyle}
          />
        </a>
      </div>

      {/* Right: copyright notice */}
      <p style={{ ...attributionStyle, flex: 1, textAlign: 'right' }}>
        © 2026 FIMbench Contributors |{' '}
        <a href="https://creativecommons.org/licenses/by/4.0/" target="_blank" rel="noreferrer" style={{ color: 'inherit' }}>
          CC BY 4.0
        </a>
      </p>

    </footer>
  );
}

/* =======================
   Footer container
======================= */

const footerStyle: React.CSSProperties = {
  backgroundImage: 'url(/static/fimbench_gui/images/Footer-HQ.png)',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  padding: '1rem 2rem',
  display: 'flex',
  flexDirection: 'row',
  alignItems: 'center',
};


const logosContainerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: '2rem',
  flexWrap: 'wrap',
  flexShrink: 0,
};

const attributionStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '0.6875rem',
  color: '#ffffff',
};

const logoStyle: React.CSSProperties = {
  height: '1.5rem',
  objectFit: 'contain',
  display: 'block',
};