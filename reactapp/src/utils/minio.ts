export const S3_BASE = 'https://sdmlab.s3.amazonaws.com';

export function buildTifUrl(s3Prefix: string, fileName: string): string {
  return `${S3_BASE}/${s3Prefix}/${fileName}`;
}

export function buildMetaUrl(s3Prefix: string, fileName: string): string {
  return `${S3_BASE}/${s3Prefix}/${fileName.replace('_BM.tif', '_metadata.json')}`;
}
