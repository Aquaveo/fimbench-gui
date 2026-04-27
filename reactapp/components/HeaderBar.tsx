import { useState } from 'react';
import { Link, useMatch } from 'react-router-dom';

export default function HeaderBar() {
  const onDocs = !!useMatch('/docs');
  const [hovered, setHovered] = useState(false);
  const filled = onDocs || hovered;
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
            backgroundColor: filled ? '#25C2DF' : 'transparent',
            color: filled ? '#152428' : '#25C2DF',
          }}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
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
