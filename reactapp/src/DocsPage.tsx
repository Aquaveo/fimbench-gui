import { Link } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import Footer from '../components/Footer';

// ── Table of contents entries ─────────────────────────────────
const TOC: { id: string; label: string; sub?: { id: string; label: string }[] }[] = [
  { id: 'overview', label: 'Overview' },
  {
    id: 'how-to-use', label: 'How to Use the App',
    sub: [
      { id: 'how-filters',   label: 'Filters' },
      { id: 'how-map',       label: 'The Map' },
      { id: 'how-table',     label: 'The Table' },
      { id: 'how-downloads', label: 'Downloads' },
    ],
  },
  {
    id: 'fim-tiers', label: 'FIM Tiers',
    sub: [
      { id: 'tier-1', label: 'Tier 1 — Very High Resolution' },
      { id: 'tier-2', label: 'Tier 2 — PlanetScope' },
      { id: 'tier-3', label: 'Tier 3 — Sentinel-1' },
      { id: 'tier-4', label: 'Tier 4 — FEMA BLE' },
      { id: 'hwm',    label: 'High Water Mark (HWM)' },
    ],
  },
  { id: 'data-sources', label: 'Data Sources & Methodology' },
  { id: 'faq',          label: 'FAQ & Known Limitations' },
  { id: 'contact',      label: 'Contact & Attribution' },
];

export default function DocsPage() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      <HeaderBar />

      <div style={bodyWrapStyle}>
        {/* ── Sticky TOC sidebar ── */}
        <aside style={sidebarStyle}>
          <nav aria-label="Table of contents">
            <p style={tocTitleStyle}>Contents</p>
            <ol style={tocListStyle}>
              {TOC.map((entry) => (
                <li key={entry.id} style={tocItemStyle}>
                  <a href={`#${entry.id}`} style={tocLinkStyle}>{entry.label}</a>
                  {entry.sub && (
                    <ol style={tocSubListStyle}>
                      {entry.sub.map((sub) => (
                        <li key={sub.id}>
                          <a href={`#${sub.id}`} style={tocLinkStyle}>{sub.label}</a>
                        </li>
                      ))}
                    </ol>
                  )}
                </li>
              ))}
            </ol>
          </nav>
        </aside>

        {/* ── Main content ── */}
        <main style={mainStyle}>
          <Link to="/" style={backLinkStyle}>← Back to Map</Link>

          <h1 style={pageTitleStyle}>FIMBench Documentation</h1>

        {/* ── 1. Overview ── */}
        <section id="overview" style={sectionStyle}>
          <h2 style={h2Style}>1. Overview</h2>
          <p>
            [PLACEHOLDER: Provide a 2–3 paragraph overview of FIMBench — what it is,
            why it was created, and who the intended audience is. Describe the catalog
            at a high level: how many records it contains, what geographic coverage it
            has, and what types of flood events are represented.]
          </p>
          <p>
            [PLACEHOLDER: Mention the project sponsors and partner institutions
            (CIROH, University of Alabama, BYU, Aquaveo). Briefly note the relationship
            to NOAA's National Water Model and the broader goal of operational flood
            inundation forecasting.]
          </p>
        </section>

        <hr style={hrStyle} />

        {/* ── 2. How to Use the App ── */}
        <section id="how-to-use" style={sectionStyle}>
          <h2 style={h2Style}>2. How to Use the App</h2>
          <p>
            [PLACEHOLDER: Short intro sentence explaining the three-panel layout —
            filter sidebar on the left, interactive map in the upper right, and data
            table in the lower right.]
          </p>

          <h3 id="how-filters" style={h3Style}>2.1 Filters</h3>
          <p>
            [PLACEHOLDER: Describe each filter control in the left sidebar:
            FIM Tier checkboxes, HUC8 ID text field, State multi-select dropdown,
            Start/End Date pickers, and Return Period selector. Explain how filters
            interact (e.g., HUC8 overrides state and date filters; Return Period only
            applies when Tier 4 is selected).]
          </p>

          <h3 id="how-map" style={h3Style}>2.2 The Map</h3>
          <p>
            [PLACEHOLDER: Explain how to navigate the map (pan, zoom), how FIM extents
            are rendered as colored polygons and point clusters, what clicking a feature
            does (popup with site details, highlight in table), and how the basemap
            switcher works.]
          </p>

          <h3 id="how-table" style={h3Style}>2.3 The Table</h3>
          <p>
            [PLACEHOLDER: Describe the table below the map — what columns are shown,
            how to sort by clicking column headers, and how row selection works:
            plain click for single select, Ctrl+click to toggle, Shift+click for range
            selection. Mention that selecting a row highlights the corresponding feature
            on the map.]
          </p>

          <h3 id="how-downloads" style={h3Style}>2.4 Downloads</h3>
          <p>
            [PLACEHOLDER: Explain the two download modes. (1) Individual: clicking the
            "Download" link in the "Download FIM" or "Metadata" columns opens the file
            directly from the data store. (2) Bulk: selecting one or more rows and
            clicking "Download Selected" packages all GeoTIFFs and metadata JSON files
            into a single zip archive named <code>fim_N_records.zip</code>, where N is
            the number of selected records.]
          </p>
        </section>

        <hr style={hrStyle} />

        {/* ── 3. FIM Tiers ── */}
        <section id="fim-tiers" style={sectionStyle}>
          <h2 style={h2Style}>3. FIM Tiers</h2>
          <p>
            The benchmark FIM rasters are available for four tiers and one separate class
            for High Water Marks–generated FIM.
          </p>

          <h3 id="tier-1" style={h3Style}>3.1 Tier 1 — Very High Resolution</h3>
          <p style={tierBadgeWrapStyle}>
            <TierBadge color="#E74C3C">Tier 1</TierBadge>
          </p>
          <p>
            This category includes FIMs derived from very high resolution NOAA Emergency
            Response Imagery. Flood rasters are generated by classifying raw images into
            two classes: flood pixels (1) and non-flooded pixels (0), using a combination
            of automated and hand-labelled processing (storms.ngs.noaa.gov).
          </p>
          <ul style={specListStyle}>
            <li><strong>Spatial Resolution:</strong> 20–50 cm</li>
            <li><strong>NoData Value:</strong> -9999</li>
          </ul>

          <h3 id="tier-2" style={h3Style}>3.2 Tier 2 — PlanetScope</h3>
          <p style={tierBadgeWrapStyle}>
            <TierBadge color="#F39C12">Tier 2</TierBadge>
          </p>
          <p>
            This tier consists of FIMs generated from PlanetScope scenes integrated with
            a hydrologically guided algorithm. The flood rasters contain three classes:
            non-flooded pixels (0), flooded pixels from remote-sensing sensor (1), and
            flooded pixels from gap-filled algorithm (2).
          </p>
          <ul style={specListStyle}>
            <li><strong>Spatial Resolution:</strong> 3–5 m</li>
            <li><strong>NoData Value:</strong> -9999</li>
          </ul>

          <h3 id="tier-3" style={h3Style}>3.3 Tier 3 — Sentinel-1</h3>
          <p style={tierBadgeWrapStyle}>
            <TierBadge color="#2ECC71">Tier 3</TierBadge>
          </p>
          <p>
            This category of FIMs contains flood rasters derived from Sentinel-1A
            integrated with the hydrologically guided gap-filled algorithm. Similar to
            Tier 2, the flood rasters contain three classes: non-flooded pixels (0),
            flooded pixels from remote-sensing sensor (1), and flooded pixels from
            gap-filled algorithm (2).
          </p>
          <ul style={specListStyle}>
            <li><strong>Spatial Resolution:</strong> 10 m</li>
            <li><strong>NoData Value:</strong> -9999</li>
          </ul>

          <h3 id="tier-4" style={h3Style}>3.4 Tier 4 — FEMA BLE</h3>
          <p style={tierBadgeWrapStyle}>
            <TierBadge color="#9B59B6">Tier 4 (BLE)</TierBadge>
          </p>
          <p>
            This tier contains FEMA's Base Level Engineering (BLE) flood maps representing
            synthetic flood events. It includes HEC-RAS-derived FIMs of 100-year and
            500-year floods containing two classes: flooded pixels (1) and non-flooded
            pixels (0).
          </p>
          <ul style={specListStyle}>
            <li><strong>Spatial Resolution:</strong> 10 m</li>
            <li><strong>NoData Value:</strong> -9999</li>
          </ul>

          <h3 id="hwm" style={h3Style}>3.5 High Water Mark (HWM)</h3>
          <p style={tierBadgeWrapStyle}>
            <TierBadge color="#EC6FA3">HWM</TierBadge>
          </p>
          <p>
            This category of FIM contains flood maps derived from surveyed USGS high water
            marks. The rasters contain two classes: flooded pixels (1) and non-flooded
            pixels (0).
          </p>
          <ul style={specListStyle}>
            <li><strong>Spatial Resolution:</strong> 10 m</li>
            <li><strong>NoData Value:</strong> -9999</li>
          </ul>
        </section>

        <hr style={hrStyle} />

        {/* ── 4. Data Sources & Methodology ── */}
        <section id="data-sources" style={sectionStyle}>
          <h2 style={h2Style}>4. Data Sources & Methodology</h2>
          <p>
            [PLACEHOLDER: Describe where the underlying data comes from — satellite
            providers, NOAA, FEMA, USGS, etc. Explain the general processing pipeline:
            imagery acquisition → flood extent delineation → quality review →
            catalog ingestion.]
          </p>
          <p>
            [PLACEHOLDER: Describe the catalog structure and the MinIO/S3 data store.
            Explain what files are available for each record (GeoTIFF, metadata JSON)
            and what information the metadata JSON contains.]
          </p>
          <p>
            [PLACEHOLDER: Link to or cite any peer-reviewed publications or technical
            reports that describe the methodology in detail.]
          </p>
        </section>

        <hr style={hrStyle} />

        {/* ── 5. FAQ & Known Limitations ── */}
        <section id="faq" style={sectionStyle}>
          <h2 style={h2Style}>5. FAQ & Known Limitations</h2>

          <h3 style={h3Style}>Why are some records missing dates?</h3>
          <p>
            [PLACEHOLDER: Explain why some records have no observation date — e.g.,
            Tier 4 (BLE) records are synthetic and carry no event date; some older
            records may have incomplete metadata.]
          </p>

          <h3 style={h3Style}>Why does my HUC8 filter return no results?</h3>
          <p>
            [PLACEHOLDER: Explain that the catalog only covers watersheds where FIM
            data has been collected. Not all HUC8 units are represented. Suggest using
            the map and state filter to explore available coverage.]
          </p>

          <h3 style={h3Style}>Known Limitations</h3>
          <p>
            [PLACEHOLDER: List known limitations of the catalog and/or the application.
            Examples: coverage gaps, sensor-specific artifacts, latency between event
            and catalog availability, file size constraints for bulk download, etc.]
          </p>
        </section>

        <hr style={hrStyle} />

        {/* ── 6. Contact & Attribution ── */}
        <section id="contact" style={sectionStyle}>
          <h2 style={h2Style}>6. Contact & Attribution</h2>
          <p>
            [PLACEHOLDER: Provide contact information or a link to a project page /
            GitHub repository for bug reports and questions.]
          </p>
          <p>
            [PLACEHOLDER: List full attribution for data providers, partner institutions,
            and open-source software used (MapLibre GL JS, React, Vite, JSZip, etc.).]
          </p>
        </section>

        </main>
      </div>

      <Footer />
    </div>
  );
}

// ── Small helper for tier colour badges ───────────────────────
function TierBadge({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      display: 'inline-block', padding: '2px 12px', borderRadius: 12,
      backgroundColor: color, color: '#fff', fontSize: 12, fontWeight: 600,
    }}>
      {children}
    </span>
  );
}

// ── Styles ────────────────────────────────────────────────────
const bodyWrapStyle: React.CSSProperties = {
  display: 'flex',
  flex: 1,
  alignItems: 'flex-start',
  overflowY: 'auto',
  minHeight: 0,
};

const sidebarStyle: React.CSSProperties = {
  width: 240,
  flexShrink: 0,
  position: 'sticky',
  top: 0,
  maxHeight: '100vh',
  overflowY: 'auto',
  padding: '28px 16px 48px 20px',
  boxSizing: 'border-box',
  borderRight: '1px solid #e0e0e0',
  fontSize: 13.5,
  lineHeight: 1.8,
};

const mainStyle: React.CSSProperties = {
  flex: 1,
  padding: '28px 48px 48px',
  boxSizing: 'border-box',
  minWidth: 0,
};

const backLinkStyle: React.CSSProperties = {
  display: 'inline-block',
  marginBottom: 20,
  fontSize: 13,
  color: '#152428',
  textDecoration: 'none',
};

const pageTitleStyle: React.CSSProperties = {
  fontSize: 28,
  fontWeight: 700,
  margin: '0 0 20px',
  color: '#25C2DF',
};

const tocTitleStyle: React.CSSProperties = {
  margin: '0 0 6px',
  fontWeight: 700,
  fontSize: 14,
};

const tocListStyle: React.CSSProperties = {
  margin: 0,
  paddingLeft: 18,
};

const tocSubListStyle: React.CSSProperties = {
  margin: '2px 0',
  paddingLeft: 18,
};

const tocItemStyle: React.CSSProperties = {
  marginBottom: 2,
};

const tocLinkStyle: React.CSSProperties = {
  color: '#0645ad',
  textDecoration: 'none',
};

const sectionStyle: React.CSSProperties = {
  marginBottom: 8,
};

const h2Style: React.CSSProperties = {
  fontSize: 20,
  fontWeight: 700,
  margin: '0 0 12px',
  color: '#152428',
  borderBottom: '1px solid #e0e0e0',
  paddingBottom: 4,
};

const h3Style: React.CSSProperties = {
  fontSize: 16,
  fontWeight: 700,
  margin: '20px 0 8px',
  color: '#2a3a3e',
};

const hrStyle: React.CSSProperties = {
  border: 'none',
  borderTop: '1px solid #e8e8e8',
  margin: '28px 0',
};

const tierBadgeWrapStyle: React.CSSProperties = {
  margin: '4px 0 8px',
};

const specListStyle: React.CSSProperties = {
  margin: '8px 0 0',
  paddingLeft: 20,
  fontSize: 13.5,
  color: '#333',
  lineHeight: 1.8,
};
