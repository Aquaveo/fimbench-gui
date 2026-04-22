export default function HeaderBar() {
  return (
    <header style={headerStyle}>
      <div>
        <h1 style={titleStyle}>FIMBench</h1>
        <p style={taglineStyle}>
          Explore and download benchmark Flood Inundation Maps across the U.S.
        </p>
      </div>
    </header>
  );
}

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
