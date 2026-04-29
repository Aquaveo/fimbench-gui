export type Bbox = [number, number, number, number];

// HUC8 codes are exactly 8 digits; leading zeros are significant — never parse as numbers.
export const isValidHuc8 = (s: string): boolean => /^\d{8}$/.test(s);

export type CatalogRecord = {
  id?: string;
  site_id: string;
  tier: string;
  date_ymd?: string | null;
  start_date_ymd?: string | null;
  end_date_ymd?: string | null;
  return_period?: number | string | null;
  s3_prefix: string;
  file_name: string;
  centroid: [number, number];
  bbox?: Bbox;
  resolution_m?: number;
  state?: string | string[];
  basin?: string | string[];
  huc8?: string | string[];
  quality?: string;
};

export type CatalogResponse = {
  records: CatalogRecord[];
  updated_at?: string;
};

// Properties attached to MapLibre features emitted from the centroid GeoJSON
// source. A strict subset of CatalogRecord — basin/huc8 are pre-joined to strings
// for display, and date/return-period fields are not propagated (the catalog is
// the source of truth for those; see Map.tsx buildTooltipHtml).
export type FeatureProperties = {
  site_id: string;
  tier: string;
  s3_prefix: string;
  file_name: string;
  state?: string | string[];
  basin?: string;
  resolution_m?: number;
  huc8?: string;
  quality?: string;
  bbox?: Bbox;
};
