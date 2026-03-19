import { useState } from 'react';
import FilterSidebar, { type Filters } from '../components/FilterSidebar';
import Map from '../components/Map';
import './App.css';

function App() {
  const [filters, setFilters] = useState<Filters>({
    tier: '',
    returnPeriod: ''
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <FilterSidebar filters={filters} setFilters={setFilters} />
      <Map filters={filters} />
    </div>
  );
}

export default App;