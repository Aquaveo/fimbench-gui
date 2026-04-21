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
