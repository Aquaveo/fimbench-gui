// Page arithmetic for the results table. Kept pure so the clamp that stops
// a stale page index from rendering an empty table can be unit tested.

// Number of pages needed for `total` items; always at least one.
export function pageCount(total: number, pageSize: number): number {
  return Math.max(1, Math.ceil(total / pageSize));
}

// Keep a remembered page index valid after the row set changes size. If the
// user was on page 3 and a new filter leaves only one page, show page 1
// instead of an empty slice (FIMBENCH-FE12).
export function clampPage(page: number, totalPages: number): number {
  return Math.min(Math.max(1, page), Math.max(1, totalPages));
}
