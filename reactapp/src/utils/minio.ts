export const S3_BASE = 'https://sdmlab.s3.amazonaws.com';

export function buildTifUrl(s3Prefix: string, fileName: string): string {
  return `${S3_BASE}/${s3Prefix}/${fileName}`;
}

export function buildMetaUrl(s3Prefix: string, fileName: string): string {
  return `${S3_BASE}/${s3Prefix}/${fileName.replace('_BM.tif', '_metadata.json')}`;
}

// List every object under a folder prefix via S3 ListObjectsV2, returning the
// file name and absolute URL for each. This is the source of truth for "download
// the full folder" — folder contents vary (e.g. Tier 4 includes an extra FLOWS
// .csv), so we enumerate rather than assume a fixed file set.
export async function listFolderUrls(
  s3Prefix: string,
  signal?: AbortSignal,
): Promise<{ name: string; url: string }[]> {
  const res = await fetch(`${S3_BASE}/?list-type=2&prefix=${encodeURIComponent(`${s3Prefix}/`)}`, { signal });
  if (!res.ok) return [];
  const xml = await res.text();
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  const out: { name: string; url: string }[] = [];
  for (const node of Array.from(doc.getElementsByTagName('Key'))) {
    const key = node.textContent ?? '';
    if (!key || key.endsWith('/')) continue;   // skip folder placeholders
    out.push({ name: key.split('/').pop()!, url: `${S3_BASE}/${key}` });
  }
  return out;
}
