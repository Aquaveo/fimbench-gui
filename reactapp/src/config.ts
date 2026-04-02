// Temporary image URLs for testing MapLibre
// Correct order for MapLibre image source
// top-left (NW), top-right (NE), bottom-right (SE), bottom-left (SW)
export const FIM_IMAGE_CONFIG: Record<
  string,
  { url: string; bounds: [[number, number], [number, number], [number, number], [number, number]] }
> = {
  tier1: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/4/47/PNG_transparency_demonstration_1.png?_=20240708155759',
    bounds: [
      [-95.5751, 29.7751], // NW → top-left
      [-95.5249, 29.7751], // NE → top-right
      [-95.5249, 29.7249], // SE → bottom-right
      [-95.5751, 29.7249], // SW → bottom-left
    ],
  },
  tier2: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/69/June_odd-eyed-cat_cropped.jpg/1280px-June_odd-eyed-cat_cropped.jpg?_=20120228074717',
    bounds: [
      [-96.5081, 29.7254], // NW
      [-96.3170, 29.7254], // NE
      [-96.3170, 29.4878], // SE
      [-96.5081, 29.4878], // SW
    ],
  },
  tier4: {
    url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/3f/Placeholder_view_vector.svg/1280px-Placeholder_view_vector.svg.png?_=20220519031949',
    bounds: [
      [-98.7647, 30.2208], // NW
      [-97.3873, 30.2208], // NE
      [-97.3873, 29.4284], // SE
      [-98.7647, 29.4284], // SW
    ],
  },
};


// -----------------------------
// Benchmark FIM image overlays
// -----------------------------
// export const FIM_IMAGE_CONFIG: Record<
//   string,
//   { url: string; bounds: [[number, number], [number, number], [number, number], [number, number]] }
// > = {
//   tier1: {
//     url: `${BASE_URL}/apps/fimbench-gui/fim-image?tier=tier1`,
//     bounds: [
//       [-95.5751, 29.724899422521663], // SW
//       [-95.52489942252167, 29.724899422521663], // SE
//       [-95.52489942252167, 29.7751], // NE
//       [-95.5751, 29.7751], // NW
//     ],
//   },
//   tier2: {
//     url: `${BASE_URL}/apps/fimbench-gui/fim-image?tier=tier2`,
//     bounds: [
//       [-96.50812878825764, 29.487850166370883], // SW
//       [-96.31703589235862, 29.487850166370883], // SE
//       [-96.31703589235862, 29.72548552803151], // NE
//       [-96.50812878825764, 29.72548552803151], // NW
//     ],
//   },
//   tier4: {
//     url: `${BASE_URL}/apps/fimbench-gui/fim-image?tier=tier4`,
//     bounds: [
//       [-98.7647725036926, 29.428441983136413], // SW
//       [-97.387325271463, 29.428441983136413], // SE
//       [-97.387325271463, 30.220884215270825], // NE
//       [-98.7647725036926, 30.220884215270825], // NW
//     ],
//   },
// };