import { useState } from 'react';
import FilterSidebar, { type Filters } from '../components/FilterSidebar';
import Map from '../components/Map';
import './App.css';

function App() {

  const [filters, setFilters] = useState<Filters>({
    tier: 'tier2',           // matches FIM_RASTER_BY_TIER keys
    returnPeriod: '100',     
    startDate: '2016-01-03', // default
    endDate: '2025-07-04',   // default
  });

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <FilterSidebar filters={filters} setFilters={setFilters} />
      <Map filters={filters} />
    </div>
  );
}

export default App;

// import { useState } from 'react';
// import Map from '../components/Map';
// import FilterSidebar, { type Filters } from '../components/FilterSidebar';

// export default function App() {
//   const [filters, setFilters] = useState<Filters>({
//     tier: 'tier1',
//     returnPeriod: '10',
//   });

//   return (
//     <div style={{ display: 'flex', height: '100vh' }}>
//       <FilterSidebar filters={filters} setFilters={setFilters} />
//       <div style={{ flex: 1 }}>
//         <Map tier={filters.tier} returnPeriod={filters.returnPeriod} />
//       </div>
//     </div>
//   );
// }