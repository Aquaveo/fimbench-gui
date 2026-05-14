import { useEffect } from 'react';

// Listen for Escape key presses at the document level and invoke `callback`.
// The listener is re-bound whenever `callback` identity changes — callers that
// close over state (e.g. a "don't show again" flag) get the latest value
// without extra deps because their inline arrow re-creates each render.
export function useEscapeKey(callback: () => void): void {
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') callback(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [callback]);
}
