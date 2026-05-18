// Coerce a raw date string into YYYY-MM-DD display form.
// Handles every shape we've actually seen come back from the catalog
// metadata JSON:
//   • Compact YYYYMMDD               → 'YYYY-MM-DD'
//   • Compact YYYYMMDDTHHMMSS[.fff]  → 'YYYY-MM-DD'  (time portion dropped)
//   • ISO 8601 YYYY-MM-DD[T...]      → 'YYYY-MM-DD'  (time portion dropped)
//   • Any other string               → returned unchanged (fallback)
//
// Empty / non-string inputs are returned as-is so callers don't have to guard.
export function formatYmd(d: string): string {
  if (!d) return d;
  // Compact form: 8 digits, optionally followed by 'T' + time. Slice the date.
  if (/^\d{8}(T|$)/.test(d)) {
    return `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6, 8)}`;
  }
  // Already-dashed ISO form: keep the leading YYYY-MM-DD, drop any time tail.
  if (/^\d{4}-\d{2}-\d{2}/.test(d)) return d.slice(0, 10);
  return d;
}
