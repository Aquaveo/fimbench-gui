import { useState } from 'react';
import { Link, useMatch } from 'react-router-dom';
import { COLORS } from '../src/theme';

export default function HeaderBar() {
  const onDocs = !!useMatch('/docs');
  const [hovered, setHovered] = useState(false);
  return (
    <header className="site-header" style={headerStyle}>
      <a href="https://tethys.ciroh.org/apps/fimbench-gui/" style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', textDecoration: 'none', color: 'inherit' }}>
        <img
          src="/static/fimbench_gui/images/android-chrome-512x512.png"
          alt="FIMbench logo"
          style={{ height: '2.5rem', objectFit: 'contain' }}
        />
        <div>
          <h1 style={titleStyle}>FIMbench</h1>
          <p className="header-tagline" style={taglineStyle}>
            Explore and download benchmark Flood Inundation Maps across the U.S.
          </p>
        </div>
      </a>
      <nav>
        <Link
          to="/docs"
          style={{
            ...docLinkStyle,
            backgroundColor: hovered || onDocs ? COLORS.brandHover : COLORS.brand,
            color: COLORS.ink,
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
  border: `0.125rem solid ${COLORS.brand}`,
  borderRadius: '62.4375rem',
  padding: '0.1875rem 0.75rem',
  fontSize: '0.8125rem',
  fontWeight: 600,
  color: COLORS.brand,
  textDecoration: 'none',
  lineHeight: 1.5,
};

const headerStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0.5rem 1.25rem',
  color: COLORS.inkLight,
  flexShrink: 0,
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: '1.375rem',
  fontWeight: 700,
  letterSpacing: '0.03125rem',
  color: COLORS.ink,
};

const taglineStyle: React.CSSProperties = {
  margin: '0.125rem 0 0 0',
  fontSize: '0.8125rem',
  color: COLORS.taglineGreen,
};
