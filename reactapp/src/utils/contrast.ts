// Pick a foreground color (e.g. text, icon stroke) that contrasts with a given
// hex background, using the YIQ perceived-brightness formula.
//
// - `onLight` is returned when the background is light (luminance >= threshold)
// - `onDark`  is returned when the background is dark  (luminance <  threshold)
//
// Defaults give a black-on-light / white-on-dark behavior at the conventional
// 128 midpoint, but callers can override any field. The same threshold applies
// in both directions (luminance == threshold counts as light).
export function pickContrastColor(
  hex: string,
  opts: { onLight?: string; onDark?: string; threshold?: number } = {}
): string {
  const { onLight = '#000000', onDark = '#ffffff', threshold = 128 } = opts;
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  const luminance = (r * 299 + g * 587 + b * 114) / 1000;
  return luminance >= threshold ? onLight : onDark;
}
