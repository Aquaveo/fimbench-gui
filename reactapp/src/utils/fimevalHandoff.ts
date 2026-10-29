// "Run in FIMeval" handoff (ticket 22868). FIMeval runs on the same Tethys
// portal as FIMbench and exposes a handoff route that pre-loads a benchmark
// FIM from its public S3 URL. FIMeval requires a portal login; anonymous
// users are prompted to sign in on arrival.

export const FIMEVAL_HANDOFF_PATH = '/handoff/fimeval-gui/run-evaluation/';

// Build the handoff URL against an explicit portal origin (pure, testable).
// Query order and names are part of the FIMeval contract:
//   ?benchmark_url=<encoded .tif URL>&benchmark_name=<name>
export function buildFimevalHandoffUrl(portalOrigin: string, benchmarkUrl: string, benchmarkName: string): string {
  const url = new URL(FIMEVAL_HANDOFF_PATH, portalOrigin);
  url.searchParams.set('benchmark_url', benchmarkUrl);
  url.searchParams.set('benchmark_name', benchmarkName);
  return url.toString();
}

// Where FIMeval lives. On a multi-app portal (and in local dev) it is the same
// origin as this page. On the CIROH deployment each app is its own standalone
// Tethys site (https://fimbench.tethys.ciroh.org, https://fimeval.tethys.ciroh.org),
// so the deployer builds with VITE_FIMEVAL_ORIGIN=https://fimeval.tethys.ciroh.org.
export function fimevalOrigin(): string {
  const configured = import.meta.env.VITE_FIMEVAL_ORIGIN;
  return typeof configured === 'string' && configured.trim()
    ? configured.trim().replace(/\/+$/, '')
    : window.location.origin;
}

// Same, against the FIMeval origin for this deployment. Returns '' when there
// is no benchmark URL to hand off, so callers can simply omit the control.
export function fimevalHandoffUrl(benchmarkUrl: string, benchmarkName: string): string {
  if (!benchmarkUrl) return '';
  return buildFimevalHandoffUrl(fimevalOrigin(), benchmarkUrl, benchmarkName);
}
