// Return a new Set with `value` added if absent, or removed if present.
// Doesn't mutate the input.
export function toggleInSet<T>(set: ReadonlySet<T>, value: T): Set<T> {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  return next;
}

// Return a new array with `value` appended if absent, or filtered out if present.
// Doesn't mutate the input. Order is preserved on removal; appended at the end on add.
export function toggleInArray<T>(arr: readonly T[], value: T): T[] {
  return arr.includes(value)
    ? arr.filter(v => v !== value)
    : [...arr, value];
}
