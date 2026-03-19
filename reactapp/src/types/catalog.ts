export type CatalogRecord = {
  id?: string;
  name?: string;
  [key: string]: any;
};

export type CatalogResponse = {
  records: CatalogRecord[];
};