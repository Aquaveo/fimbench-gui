import FilterSidebar from '../components/FilterSidebar';
import Map from '../components/Map';
import './App.css';

function App() {
  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <FilterSidebar filters={{
        tier: '',
        returnPeriod: ''
      }} setFilters={function (): void {
        throw new Error('Function not implemented.');
      } } />
      <Map filters={{
        tier: '',
        returnPeriod: ''
      }} />
    </div>
  )
}

export default App;