export const MINIO_BASE = 'http://127.0.0.1:9000/fimbench';

export function toMinioPath(s3Prefix: string): string {
  return s3Prefix.replace(/^FIM_Database\//, '');
}

export function buildTifUrl(s3Prefix: string, fileName: string): string {
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${fileName}`;
}

export function buildMetaUrl(s3Prefix: string, fileName: string): string {
  return `${MINIO_BASE}/${toMinioPath(s3Prefix)}/${fileName.replace('_BM.tif', '_metadata.json')}`;
}
