# FIMbench Paper — Visualization Platform Section (Draft)

*Draft write-up for the FIMbench Scientific Data paper, describing the visualization platform.*

---

**FIMbench Visualization Platform**

The FIMbench visualization platform is an open, browser-based tool developed to facilitate exploration, filtering, and download of the FIMbench catalog. It is designed to make the full FIM inventory accessible to a broad audience — including practitioners, researchers, and decision-makers — without requiring proprietary software installations or prior programming experience. The platform is built on Tethys Platform 4, a Django-based geospatial web application framework designed specifically for deploying data-driven geoscientific applications to the web.

**Backend and Data Delivery**

Tethys manages the application lifecycle, URL routing, and server-side configuration, and exposes a structured custom settings interface through which deployment-specific parameters — including the S3 endpoint, bucket URL, catalog index path, and vector tile URL template — are administered independently of the application code. The frontend is a React/TypeScript single-page application (SPA) built with Vite, served by Tethys as a static bundle and rendered entirely in the browser.

A key backend contribution of the Tethys layer is its tile proxy controller, which mediates all vector tile requests between the browser and the upstream S3-compatible object store. Rather than exposing the S3 endpoint directly to the client — which would introduce CORS constraints and potential access control complications — all tile requests are routed through Tethys, which fetches and forwards gzip-compressed Mapbox Vector Tiles end-to-end without re-encoding. This architecture preserves transfer efficiency while keeping data access centrally governed. The FIM catalog metadata is served as a structured JSON index from S3, fetched once at application load and filtered client-side, minimizing repeated server round-trips during interactive use.

**Map Interface**

The platform's primary view is an interactive map rendered using MapLibre GL, displaying FIM records as color-coded vector features. Records are distinguished by tier using a configurable color palette, with centroid markers at low zoom levels transitioning to full extent polygons at higher zoom levels. Users can switch between Street, Topographic, and Satellite basemaps (ESRI sources) depending on their analysis context. Clicking a map feature highlights the corresponding record and synchronizes selection state with the data table.

**Filtering and Discovery**

A persistent sidebar provides multi-dimensional filtering of the catalog. Users can filter records by FIM tier (Tier 1–4 and High Water FIM), U.S. state, HUC8 watershed identifier, acquisition date range, and return period. Filters are applied dynamically and update both the map and table in real time. When a HUC8 identifier is entered, state and date filters are suspended to support watershed-centric queries. A reset control restores all filters to their default state.

**Data Table and Download**

All catalog records passing the active filters are presented in a paginated, sortable table displaying key metadata fields including river/basin name, state, acquisition date, spatial resolution, HUC8 identifiers, quality tier, and sensing platform. Each record includes direct download links for the associated flood inundation raster (GeoTIFF) and metadata file (JSON), enabling straightforward data retrieval. Selection state is synchronized bidirectionally between the table and the map.

**Accessibility**

The platform includes a color vision accessibility control that allows users to switch between four rendering modes — Default, Red-Green (Deuteranopia/Protanopia), Blue-Yellow (Tritanopia), and Monochrome (Achromatopsia) — ensuring that tier-based color encodings remain distinguishable across a range of color vision profiles.
