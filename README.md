# FIMBench GUI

A React-based single-page application (SPA) for visualizing and downloading **Flood Inundation Maps (FIMs)**, integrated with the **Tethys Platform** backend.  

This app allows users to explore benchmark FIM datasets hosted in the SDML S3 bucket, providing raster, vector, and metadata files across four quality tiers and High Water Mark (HWM)–derived maps.

---

## Architecture Overview

<p align="center">
  <img src="tethysapp/fimbench_gui/public/images/FIMBench_Architecture.png" width="700">
</p>

## Project Structure

```
tethysapp-fimbench_gui/
├── reactapp/
│   ├── index.html
│   ├── package.json
│   ├── src/
│   │   ├── App.tsx
│   │   ├── main.tsx
│   │   ├── index.css
│   │   ├── assets/
│   │   │   ├── hero.png
│   │   │   └── react.svg
│   │   └── styles/theme.css
│   └── vite.config.ts
├── tethysapp/fimbench_gui/
│   ├── app.py
│   ├── controllers.py
│   ├── public/
│   │   ├── frontend/   # Vite build output
│   │   ├── css/main.css
│   │   └── favicon.ico
│   └── templates/fimbench_gui/index.html
├── tests/
└── pyproject.toml
```

### Frontend

- **Framework:** React + TypeScript
- **Build Tool:** Vite
- **Routing:** React Router (`BrowserRouter` with `import.meta.env.BASE_URL`)
- **Styles:** CSS modules / theme.css
- **Deployment:** Served under Tethys `/apps/fimbench-gui`

### Backend (Tethys)

- Handles:
  - Controller for SPA (`home` with `catch_all=True`)
  - Static file hosting
  - API endpoints for dataset downloads

## FIMBench Data

Benchmark FIMs include:

- **Tier 1:** Very high-resolution NOAA imagery (20–50 cm)
- **Tier 2:** PlanetScope + hydrologically guided algorithm (3–5 m)
- **Tier 3:** Sentinel-1A + gap-filled algorithm (10 m)
- **Tier 4:** FEMA Base Level Engineering synthetic events (10 m)
- **HWM FIM:** High Water Mark–derived maps (10 m)

Each dataset folder contains:

- Flood inundation raster (.tif)
- Flood domain bounding box (.gpkg)
- Metadata (.json)

Access programmatically via Python or CLI from SDML S3.

## Development Setup

### 1. Backend (Tethys)

Assuming you already have Tethys set up on conda with a libmamba-solver, you can run the following inside your project folder (e.g., tethysapp-your_app_name/):

```
tethys install -d
```

... ensure you also have the following in your `install.yaml`:

```
# This file should be committed to your app code.
version: 1.1
# This should be greater or equal to your tethys-platform in your environment
tethys_version: ">=4.0.0"
# This should match the app name in your pyproject.toml without the "tethysapp-" prefix.
name: your_app_name

requirements:
  # Putting in a skip true param will skip the entire section. Ignoring the option will assume it be set to False
  skip: false
  conda:
    channels:
    - conda-forge
    packages:
    - nodejs
    - pandas

  pip:

post:
```

and that you have your `pyproject.toml` also set up.

### 2. Frontend (React)

Ensure you have the following in your reactapp/package.json file:

```
{
  "name": "reactapp",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "lint": "eslint .",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.2.4",
    "react-dom": "^19.2.4",
    "react-router-dom": "^7.13.1",
    "vite-plugin-svgr": "^4.5.0"
  },
  "devDependencies": {
    "@eslint/js": "^9.39.4",
    "@types/node": "^24.12.0",
    "@types/react": "^19.2.14",
    "@types/react-dom": "^19.2.3",
    "@vitejs/plugin-react": "^6.0.0",
    "@vitejs/plugin-react-swc": "^4.3.0",
    "eslint": "^9.39.4",
    "eslint-plugin-react-hooks": "^7.0.1",
    "eslint-plugin-react-refresh": "^0.5.2",
    "globals": "^17.4.0",
    "typescript": "~5.9.3",
    "typescript-eslint": "^8.56.1",
    "vite": "^8.0.0"
  }
}
```

Then:

```
cd reactapp
npm install
npm run dev       # start development server
npm run build     # build for Tethys
```

### 3. Run Tethys App

```
tethys manage start
```

## Testing

- **Vitest + React Testing Library**
- **jsdom environment**

```
npm run test
npm run test:coverage
```

Scope:

- Route rendering
- Navigation behavior
- Download interactions

## Roadmap

- API client abstraction for benchmark queries
- Role-based UI access
- Lazy-loaded tool modules
- Sidebar layout shell
- CI/CD automation


## Contact

For questions on FIMBench:
- [Dr. Sagy Cohen](mailto:sagy.cohen@ua.edu)
- [Dr Anupal Baruah](mailto:abaruah@ua.edu)
- [Supath Dhital](mailto:sdhital@crimson.ua.edu)
- [Dipsikha Devi](mailto:ddevi@ua.edu)
  
For questions on running this application:
- [Reshma Raghavan](mailto:rraghavan@aquaveo.com)
