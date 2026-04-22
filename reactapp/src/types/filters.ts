export type Filters = {
  tiers: string[];
  states: string[];     // multi-select; empty = all states
  huc8Id: string;       // direct input; empty = no HUC8 filter
  returnPeriod: string;
  startDate: string;
  endDate: string;
};

export const DEFAULT_FILTERS: Filters = {
  tiers: ['Tier_1', 'Tier_2', 'Tier_3', 'Tier_4', 'HWM'],
  states: [],
  huc8Id: '',
  returnPeriod: '100',
  startDate: '2016-01-03',
  endDate: '2025-07-04',
};
