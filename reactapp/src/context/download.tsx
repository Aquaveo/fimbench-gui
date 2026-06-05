import { createContext, useContext, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';
import { listFolderUrls } from '../utils/minio';

export type DownloadFolder = { siteId: string; s3Prefix: string };

type Progress = { done: number; total: number };

type DownloadCtx = {
  progress: Progress | null;
  isActive: boolean;
  startDownload: (folders: DownloadFolder[]) => void;
  cancel: () => void;
};

const DownloadContext = createContext<DownloadCtx>({
  progress: null,
  isActive: false,
  startDownload: () => {},
  cancel: () => {},
});

export function DownloadProvider({ children }: { children: ReactNode }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const isActive = progress !== null;

  const cancel = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setProgress(null);
  };

  const startDownload = async (folders: DownloadFolder[]) => {
    if (folders.length === 0 || isActive) return;

    const controller = new AbortController();
    abortRef.current = controller;
    const { signal } = controller;

    let done = 0;
    setProgress({ done, total: folders.length });

    try {
      const zip = new JSZip();

      await Promise.all(folders.map(async (f) => {
        const folder = zip.folder(f.siteId)!;
        // Enumerate the folder's full contents, then fetch every object.
        const objects = await listFolderUrls(f.s3Prefix, signal).catch(() => []);
        await Promise.all(objects.map(o =>
          fetch(o.url, { signal }).then(res => {
            if (res.ok) return res.blob().then(b => {
              // Skip recompressing the (already large) raster; DEFLATE the rest.
              folder.file(o.name, b, o.name.toLowerCase().endsWith('.tif') ? { compression: 'STORE' } : undefined);
            });
          }).catch(() => {})
        ));

        if (signal.aborted) return;
        done++;
        setProgress({ done, total: folders.length });
      }));

      if (!signal.aborted) {
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        saveAs(zipBlob, folders.length === 1 ? `${folders[0].siteId}.zip` : `fim_${folders.length}_records.zip`);
      }
    } finally {
      setProgress(null);
      abortRef.current = null;
    }
  };

  return (
    <DownloadContext.Provider value={{ progress, isActive, startDownload, cancel }}>
      {children}
      {isActive && progress && (
        <div style={{
          position: 'fixed',
          bottom: '1.5rem',
          right: '1.5rem',
          zIndex: 9999,
          backgroundColor: '#1a1a2e',
          color: '#fff',
          borderRadius: '0.625rem',
          padding: '0.625rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.75rem',
          boxShadow: '0 0.25rem 1rem rgba(0,0,0,0.35)',
          fontSize: '0.875rem',
          fontFamily: 'inherit',
          minWidth: '14rem',
        }}>
          <span style={{ flex: 1 }}>
            Downloading {progress.done} / {progress.total}…
          </span>
          <button
            onClick={cancel}
            style={{
              background: 'rgba(255,255,255,0.15)',
              border: '1px solid rgba(255,255,255,0.3)',
              borderRadius: '0.375rem',
              color: '#fff',
              fontSize: '0.8125rem',
              fontFamily: 'inherit',
              cursor: 'pointer',
              padding: '0.2rem 0.5rem',
            }}
          >
            Cancel
          </button>
        </div>
      )}
    </DownloadContext.Provider>
  );
}

// eslint-disable-next-line react-refresh/only-export-components
export const useDownloadManager = () => useContext(DownloadContext);
