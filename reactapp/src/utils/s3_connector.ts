import { BUCKET_URL, CATALOG_KEY } from "../config";
import type { CatalogResponse, CatalogRecord } from "../types/catalog";

export async function fetchCatalog(): Promise<CatalogRecord[]> {
  try {
    const target = `${BUCKET_URL}/${CATALOG_KEY}`;

    const url = `/apps/fimbench-gui/s3-proxy?url=${encodeURIComponent(target)}`;

    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch catalog: ${response.status}`);
    }

    const data: CatalogResponse = await response.json();

    return data.records ?? [];
  } catch (error) {
    console.error("S3 Fetch Error:", error);
    return [];
  }
}