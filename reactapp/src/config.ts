function requireEnv(name: string): string {
  const value = import.meta.env[name];
  if (!value) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return value;
}

export const BUCKET_URL = requireEnv("VITE_BUCKET_URL");
export const CATALOG_KEY = requireEnv("VITE_CATALOG_KEY");
export const VIZ_TILES = requireEnv("VITE_VIZ_TILES");
export const VIZ_TILES_LOCATION = requireEnv("VITE_VIZ_TILES_LOCATION");