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
            ...navLinkStyle,
            color: onDocs ? '#25C2DF' : '#D1EFF6',
            fontWeight: onDocs ? 600 : 400,
          }}
        >
          Documentation
        </Link>
      </nav>
    </header>
  );
}

const navLinkStyle: React.CSSProperties = {
  fontSize: 13,
  textDecoration: 'none',
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
