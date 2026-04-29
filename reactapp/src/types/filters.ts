export type Filters = {
  tiers: string[];
  states: string[];     // multi-select; empty = all states
  huc8Id: string;       // direct input; empty = no HUC8 filter
  returnPeriod: string;
  startDate: string;
  endDate: string;
};

// startDate / endDate are filled in from the catalog's observed date range on
// first load (see App.tsx handleCatalogDateBounds). Empty strings are treated
// as unconstrained by dateMatches() in Map.tsx.
export const DEFAULT_FILTERS: Filters = {
  tiers: ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'],
  states: [],
  huc8Id: '',
  returnPeriod: '100',
  startDate: '',
  endDate: '',
};
