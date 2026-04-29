import { Link } from 'react-router-dom';
import HeaderBar from '../components/HeaderBar';
import Footer from '../components/Footer';

// ── Table of contents entries ─────────────────────────────────
const TOC: { id: string; label: string; sub?: { id: string; label: string }[] }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'how-to-use', label: 'How to Use the App' },
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

// ── Code block string constants (avoids JSX escaping issues) ─────
const CODE_CONDA = `# Create env (For example, using Python 3.11)
conda create -n fimbench python=3.11

# Activate env
conda activate fimbench`;

const CODE_VENV = `# Create env in folder .venv
python -m venv .venv

# Activate on macOS / Linux
source .venv/bin/activate

# Activate on Windows (PowerShell)
.venv\\Scripts\\Activate.ps1`;

const CODE_UV = `uv venv
source .venv/bin/activate  # macOS / Linux
.venv\\Scripts\\Activate.ps1  # Windows`;

const CODE_PIP_INSTALL = `pip install fimeval`;

const CODE_UV_INSTALL = `uv pip install fimeval      #This makes way much faster installation.`;

const CODE_BENCH_DATA = `# Import the fimeval package you installed in your virtual environment
import fimeval as fe

# User inputs: either model FIM raster, boundary AOI, or both
raster_path = "./paths/to/your/model_fim.tif"
boundary_path = "./paths/to/your/boundary.gpkg"

"""
Supports multiple combinations of filters. Choose ONE pattern and set the
others to None:

a) AOI-only search (raster or boundary), optional overlap stats.
b) AOI + exact date.
c) AOI + date range (with optional download).
d) Direct filename to download (no AOI/dates) – usually once you know
   the exact benchmark FIM name.
NOTE: if no date: returns all available benchmark FIMs for the AOI.

Common parameters
-----------------
raster_path:
    Optional path to user raster (e.g., model FIM).
boundary_path:
    Optional vector AOI file (can be used with or without raster).
huc8:
    Optional HUC8 filter (mainly for US basins).
event_date:
    Exact event date (optionally with hour).
start_date, end_date:
    Inclusive date range filter.
file_name:
    Exact benchmark FIM filename from the catalog.
area:
    If True and AOI given, return % overlap and km² vs benchmark AOI.
download:
    If True, download matched rasters/GPKGs to out_dir.
out_dir:
    Directory for downloads (required if download=True).
"""

# a) AOI-only search (no dates, no filename)
log_aoi_only = fe.benchFIMquery(
    raster_path = raster_path,   # or None, if you only have boundary
    boundary_path = None,        # or boundary_path
    huc8 = None,
    event_date = None,
    start_date = None,
    end_date = None,
    file_name = None,
    area = True,                 # returns overlap stats vs benchmark AOI
    download = False,
    out_dir = None,
)
print("AOI-only search:", log_aoi_only)

# b) AOI + exact date
log_aoi_exact_date = fe.benchFIMquery(
    raster_path = raster_path,
    boundary_path = None,
    huc8 = None,
    event_date = "2017-05-01",   # YYYY-MM-DD or YYYY-MM-DD HH:MM
    start_date = None,
    end_date = None,
    file_name = None,
    area = True,
    download = False,
    out_dir = None,
)
print("AOI + exact date:", log_aoi_exact_date)

# c) AOI + date range (with optional download)
log_aoi_daterange = fe.benchFIMquery(
    raster_path = raster_path,
    boundary_path = None,
    huc8 = None,
    event_date = None,
    start_date = "2017-04-01",
    end_date = "2017-05-01",
    file_name = None,
    area = True,
    download = True,              # download all matches in this range
    out_dir = "./benchmark_downloads",
)
print("AOI + date range:", log_aoi_daterange)

# d) Direct filename download (no AOI, no dates)
log_by_filename = fe.benchFIMquery(
    raster_path = None,
    boundary_path = None,
    huc8 = None,
    event_date = None,
    start_date = None,
    end_date = None,
    file_name = "BENCHMARK_FIM_03020202_20170501.tif",  # example name
    area = False,               # ignored when no AOI is provided
    download = True,
    out_dir = "./benchmark_downloads",
)
print("Direct filename download:", log_by_filename)`;

const CODE_FIM_EVAL = `# continuing from previous step, if user have intend to use FIM Evaluation Framework for evaluation
import fimeval as fe
from pathlib import Path

"""
01. Case Directory Structure
------------------------
The important understanding is for multi-case evaluation, the user need to have a main
directory where each subfolder is a test case containing model FIMs to be evaluated.
For single case evaluation, user can provide the path to that single case folder.

Parameters
----------
Main_dir: root folder where each subfolder is a test case.
Example structure:
  Main_dir/
      HUC11110203_AR/
          model_fim_1.tif
          model_fim_2.tif
      HUC11110204_TX/
          model_fim_1.tif

For instance,
Main_dir = "path/to/your/Main_dir"

02. Positioning benchmark FIMs for evaluation
------------------------------
Now from Step 01, user will access the benchmark FIM for each case. Finding each case by
running QUERY is precise way. However, the automation based on area overlap, FIM tier and
resolution priority is ongoing.

Make a dictionary mapping each test case folder to the benchmark FIM filename obtained from Step 01.

benchmark_dict = {
    "HUC11110203_AR": "benchmark_01.tif"
    "HUC11110204_TX": "benchmark_02.tif"
}

03. Evaluation methods
------------------------------
While accessing the benchmark FIM, It will get all the benchmark boundary along with this,
and use this boundary as AOI method for evaluation.

However, If user explicitly mention other methods like smallest_extent or convex_hull,
FIMeval will use that method instead of benchmark AOI.

Evaluation methods:
"smallest_extent"  -> intersection of all FIM extents
"convex_hull"      -> convex hull around all FIM extents
"AOI"              -> use AOI shapefile as evaluation domain

method_name = "smallest_extent"  #for example

04. Other parameters
------------------------------
output_dir = "./path/to/output" # Optional: Directory to save evaluation results

Optional: user PWB (Permanent Water Bodies) dataset if not using the default one for the US.
PWB_dir = "./path/to/PWB"

target_crs = "EPSG:5070" # Optional: Target CRS

Optional: Target resolution in meters.
target_resolution = 10
"""

# Evaluation usage examples
# Basic evaluation using default method & default PWB
fe.EvaluateFIM(
    Main_dir=Main_dir,
    benchmark_dict=benchmark_dict,
)

# Enforce target CRS / resolution and user AOI
fe.EvaluateFIM(
    Main_dir=Main_dir,
    method_name=method_name,
    target_resolution=target_resolution,
    target_crs=target_crs,
    PWB_dir=PWB_dir,
    output_dir=output_dir,
    benchmark_dict=benchmark_dict,
)

# Print contingency maps (true/false positives, etc.)
fe.PrintContingencyMap(Main_dir, method_name, output_dir)

# Plot evaluation metrics (CSI, POD, FAR, etc.)
fe.PlotEvaluationMetrics(Main_dir, method_name, output_dir)

# FIM evaluation with building footprints
countryISO = "US"  # e.g., "US" for United States
building_footprint = "./path/to/your/building_footprint.shp"

fe.EvaluationWithBuildingFootprint(
    Main_dir,
    method_name,
    output_dir,
    country=countryISO,
    geeprojectID="supathdh",
)
# OR use local building footprint
fe.EvaluationWithBuildingFootprint(
    Main_dir,
    method_name,
    output_dir,
    building_footprint=building_footprint,
)`;

const CODE_FIMSERV = `# Install FIMSERV if not already installed
uv pip install fimserve
import fimserve as fm

"""
Query and optionally generate HAND-FIM for a given HUC8 and event date.

Parameters
----------
HUCID : str
    8-digit HUC ID for the basin of interest.
date_input : str
    Event datetime used to search for the correct benchmark FIM.
    Format: "YYYY-MM-DD HH:MM:SS".
run_handfim : bool
    If True, FIMSERV will look for an OWP HAND-FIM for the given HUC8
    and date. If not found, it downloads inputs and generates HAND-FIM automatically.
start_date, end_date : str, optional
    Date range filter when searching for benchmark FIMs. Format: "YYYY-MM-DD".
file_name : str, optional
    If provided, FIMSERV downloads this specific benchmark FIM file.
out_dir : str, optional
    Directory where fim_lookup saves the benchmark FIM, HAND-FIM, and metadata.
"""

# Optional: Directory where benchmark FIM and HAND-FIM will be saved
out_dir = "path/to/fimserve_case_output"

# User can pass either exact date or date range
result = fm.fim_lookup(
    HUCID="10170203",
    date_input="2019-09-19 12:00:00",  # exact date/hour match for benchmark FIM
    start_date="2019-09-18",           # optional date range start
    end_date="2019-09-20",             # optional date range end
)
print("Lookup result from fim_lookup:")
print(result)

# Once the benchmark FIM is decided, generate the OWP HAND-FIM if not already present
fm.fim_lookup(
    HUCID="10170203",
    date_input="2019-09-19 12:00:00",
    run_handfim=True,
    file_name="specific_benchmark_fim_filename.tif",  # from fim_lookup result above
    out_dir=out_dir,
)

"""
Run the FIM evaluation once the benchmark FIM file name is decided.

Parameters
----------
Main_dir : str
    Directory containing FIM outputs to evaluate (same as out_dir from fim_lookup).
output_dir : str
    Where evaluation results (CSV, plots, etc.) are saved.
"""
fm.run_evaluation(
    Main_dir=Main_dir,
    output_dir="./fimserve_eval_results",
    shapefile_path=None,
    PWB_dir=None,
    building_footprint=None,
    target_crs=None,
    target_resolution=None,
    method_name=None,   # default is 'AOI' inside FIMSERV
    countryISO=None,
    geeprojectID=None,
    print_graphs=True,  # generate and save contingency maps / plots
    Evalwith_BF=False,  # set True if evaluating with building footprints
)`;

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
            This explains what benchmark data is within this app and how you can access it
            programmatically- using Python or via the command line. So that user can
            seamlessly QUERY, DOWNLOAD and USE benchmark data for their own analysis. These
            benchmark datasets are stored on Surface Dynamics Modeling Lab (SDML) S3 bucket.
          </p>
          <p>This dataset can be repurposed in multiple ways:</p>
          <ul style={specListStyle}>
            <li>Accessing <strong>ONLY BENCHMARK DATA</strong>,</li>
            <li>
              Accessing seamlessly for{' '}
              <a href="https://github.com/sdmlua/fimeval" target="_blank" rel="noreferrer">
                <strong>FIM EVALUATION FRAMEWORK</strong>
              </a>, and
            </li>
            <li>
              Accessing for{' '}
              <a href="https://github.com/sdmlua/FIMserv" target="_blank" rel="noreferrer">
                <strong>FIMSERV</strong>
              </a>.
            </li>
          </ul>

          <h3 style={h3Style}>Prior to using; INSTALLATION and SETUP</h3>
          <p>
            We recommend using virtual environments to manage dependencies. User can use
            conda, Python's built-in venv, or uv — pick one of the options below.
          </p>

          <p style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: 13 }}>Option A – Using conda</p>
          <pre style={codeBlockStyle}><code>{CODE_CONDA}</code></pre>

          <p style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: 13 }}>Option B – Using venv (built-in Python)</p>
          <pre style={codeBlockStyle}><code>{CODE_VENV}</code></pre>

          <p style={{ margin: '12px 0 4px', fontWeight: 600, fontSize: 13 }}>Option C – Using uv</p>
          <p style={{ margin: '4px 0 8px', fontSize: 13.5 }}>
            <code>uv</code> is a lightweight tool for creating and managing virtual
            environments and can be installed via pip: <code>pip install uv</code>.
          </p>
          <pre style={codeBlockStyle}><code>{CODE_UV}</code></pre>

          <p style={{ margin: '16px 0 4px' }}>
            Once the environment is active, install the fimeval package to access the
            modules and dependencies needed to work with benchmark data.
          </p>
          <pre style={codeBlockStyle}><code>{CODE_PIP_INSTALL}</code></pre>
          <p style={{ margin: '8px 0 4px', fontSize: 13.5 }}>OR</p>
          <pre style={codeBlockStyle}><code>{CODE_UV_INSTALL}</code></pre>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>Accessing ONLY BENCHMARK DATA</summary>
            <div style={detailsBodyStyle}>
              <p style={{ margin: '0 0 12px' }}>
                This section explains how to access benchmark flood inundation data stored
                in the SDML S3 bucket based on user-defined filters (event date, location,
                etc.). Use the benchFIMquery() function from fimeval.
              </p>
              <pre style={codeBlockStyle}><code>{CODE_BENCH_DATA}</code></pre>
            </div>
          </details>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>Accessing seamlessly for FIM EVALUATION FRAMEWORK</summary>
            <div style={detailsBodyStyle}>
              <p style={{ margin: '0 0 12px' }}>
                This dataset can be used directly with the{' '}
                <a href="https://github.com/sdmlua/fimeval" target="_blank" rel="noreferrer">FIM Evaluation Framework</a>{' '}
                to compare model FIMs against benchmark FIMs and compute metrics. The entire
                evaluation workflow is automated with the right benchmark FIMs fetched based
                on user-defined AOI and event date on the step 1. In this step to proceed,
                The user decide all the benchmark FIMs for all the cases to be evaluated.
              </p>
              <pre style={codeBlockStyle}><code>{CODE_FIM_EVAL}</code></pre>
            </div>
          </details>

          <details style={detailsStyle}>
            <summary style={summaryStyle}>Accessing for FIMSERV</summary>
            <div style={detailsBodyStyle}>
              <p style={{ margin: '0 0 12px' }}>
                The{' '}
                <a href="https://github.com/sdmlua/FIMserv" target="_blank" rel="noreferrer">FIM as a Service (FIMSERV)</a>{' '}
                platform allows users to generate FIM using NOAA Office of Water Prediction
                FIM framework based on Height Above Nearest Drainage (HAND) approach. This
                can also use as a test bed for investigating the multiple components of FIM
                (like river slope, geometry, and so on.). For those investigation and even
                to evaluate the performance of OWP HAND FIM approach overall, the seamless
                evaluation makes the task much easier. This step is mainly for FIMSERV users
                who want to evaluate their generated FIMs against benchmark datasets.
              </p>
              <p style={{ margin: '0 0 12px' }}>
                This FIMserv runs on HUC8 basis, so the user need to provide HUC8 and event
                date to query and download the benchmark FIMs.
              </p>
              <pre style={codeBlockStyle}><code>{CODE_FIMSERV}</code></pre>
            </div>
          </details>
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

const codeBlockStyle: React.CSSProperties = {
  background: '#1e2a2e',
  color: '#d4f1f9',
  padding: '0.75rem 1rem',
  borderRadius: '0.375rem',
  fontSize: '0.8125rem',
  lineHeight: 1.6,
  overflowX: 'auto',
  margin: '0 0 0.5rem',
  fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace',
  whiteSpace: 'pre',
};

const detailsStyle: React.CSSProperties = {
  border: '1px solid #d0d7de',
  borderRadius: '0.375rem',
  margin: '1rem 0',
  overflow: 'hidden',
};

const summaryStyle: React.CSSProperties = {
  padding: '0.625rem 1rem',
  fontWeight: 700,
  fontSize: '0.875rem',
  cursor: 'pointer',
  background: '#f6f8fa',
  color: '#152428',
  userSelect: 'none',
  listStyle: 'none',
};

const detailsBodyStyle: React.CSSProperties = {
  padding: '1rem',
  borderTop: '1px solid #d0d7de',
  fontSize: '0.875rem',
  lineHeight: 1.7,
};
