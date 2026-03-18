import { type Filters } from './FilterSidebar';

type MapProps = {
  filters: Filters;
};

export default function Map({ filters }: MapProps) {
  return (
    <div style={{ flex: 1, backgroundColor: '#e5e5e5', padding: 16 }}>
      <h2>Flood Map Viewer</h2>
      <p>Current Filters:</p>
      <ul>
        <li>FIM Tier: {filters.tier}</li>
        <li>Return Period: {filters.returnPeriod} years</li>
      </ul>

      {/* MapLibre / Deck.gl map to be rendered here later */}
      <div
        style={{
          marginTop: 16,
          width: '100%',
          height: '80%',
          backgroundColor: '#c0c0c0',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontStyle: 'italic',
          color: '#444',
        }}
      >
        Map Placeholder
      </div>
    </div>
  );
}