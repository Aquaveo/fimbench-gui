import { Link, useMatch } from 'react-router-dom';

export default function HeaderBar() {
  const onDocs = !!useMatch('/docs');
  return (
    <header style={headerStyle}>
      <div>
        <h1 style={titleStyle}>FIMBench</h1>
        <p style={taglineStyle}>
          Explore and download benchmark Flood Inundation Maps across the U.S.
        </p>
      </div>
      <nav>
        <Link
          to="/docs"
          style={{
            ...docLinkStyle,
            backgroundColor: onDocs ? 'rgba(37,194,223,0.18)' : 'transparent',
          }}
        >
          Documentation
        </Link>
      </nav>
    </header>
  );
}

const docLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  border: '2px solid #25C2DF',
  borderRadius: '999px',
  padding: '3px 12px',
  fontSize: 13,
  fontWeight: 600,
  color: '#25C2DF',
  textDecoration: 'none',
  lineHeight: 1.5,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '8px 20px',
  background: '#152428',
  color: '#fff',
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 22,
  fontWeight: 700,
  letterSpacing: 0.5,
  color: '#25C2DF',
};

const taglineStyle: React.CSSProperties = {
  margin: '2px 0 0 0',
  fontSize: 13,
  color: '#D1EFF6',
};
