# Mobile Responsiveness Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make FIMbench GUI fully usable on phones and tablets — collapsible sidebar (slide-over overlay), hidden-by-default table with a toggle tab, and several small responsive fixes.

**Architecture:** `isMobile` boolean state in `App.tsx` (derived from `window.innerWidth <= 768`) drives conditional rendering and layout. The sidebar gets a CSS class-based slide animation via `position: fixed; transform: translateX`. The map/table split uses conditional inline styles on mobile instead of the flex-percent resize system. No new dependencies.

**Tech Stack:** React 18, TypeScript, MapLibre GL, Vite, Vitest (existing). CSS media queries for the header tagline; everything else driven by React state.

---

## File Map

| File | Change |
|------|--------|
| `reactapp/components/Map.tsx` | One-line hover-popup position fix (line 683) |
| `reactapp/components/HeaderBar.tsx` | Add `className="header-tagline"` to tagline `<p>` |
| `reactapp/components/FilterSidebar.tsx` | Add `isOpen/onClose/isMobile` props; close button; `filter-sidebar` className; InfoBadge click toggle |
| `reactapp/src/App.tsx` | Add `isMobile`, `sidebarOpen`, `tableVisible` state; resize listener; toggle button, backdrop, table-tab JSX; conditional map/table heights; pass new props to FilterSidebar |
| `reactapp/src/index.css` | `.filter-sidebar` slide CSS; `.header-tagline` hide rule |

> **Note:** `FIMTable.tsx` already has `overflowX: 'auto'` on its table wrapper (line 429). No change needed there.

---

## Task 1 — Create branch + fix hover-popup flicker

**Files:**
- Modify: `reactapp/components/Map.tsx:683`

- [ ] **Step 1: Create branch**

```bash
cd /home/rragh/tethysdev/tethysapp-fimbench_gui/fimbench-gui
git checkout -b task/mobile-responsiveness
```

Expected: `Switched to a new branch 'task/mobile-responsiveness'`

- [ ] **Step 2: Apply the one-line fix**

In `reactapp/components/Map.tsx` at line 683, change:

```ts
          hoverPopup.addTo(map).trackPointer();
```

to:

```ts
          hoverPopup.setLngLat(e.lngLat).addTo(map).trackPointer();
```

Root cause: on first hover `addTo(map)` renders the popup before `trackPointer()` has attached its `mousemove` listener, placing it at the default `[0,0]` canvas coordinate for one frame. Providing an initial `lngLat` eliminates that rogue frame.

- [ ] **Step 3: Type-check**

```bash
cd reactapp && npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add reactapp/components/Map.tsx
git commit -m "FIX: set initial lngLat before trackPointer to eliminate first-hover popup flicker"
```

---

## Task 2 — HeaderBar: hide tagline on very small screens

**Files:**
- Modify: `reactapp/components/HeaderBar.tsx:18`
- Modify: `reactapp/src/index.css`

- [ ] **Step 1: Add className to the tagline `<p>`**

In `HeaderBar.tsx` the tagline is at line 18. The current code is:

```tsx
        <p style={taglineStyle}>
          Explore and download benchmark Flood Inundation Maps across the U.S.
        </p>
```

Change to:

```tsx
        <p className="header-tagline" style={taglineStyle}>
          Explore and download benchmark Flood Inundation Maps across the U.S.
        </p>
```

- [ ] **Step 2: Add hide rule to `index.css`**

Append to the end of `reactapp/src/index.css`:

```css
/* ─── Responsive: header ─── */
@media (max-width: 30rem) {
  .header-tagline {
    display: none;
  }
}
```

- [ ] **Step 3: Type-check**

```bash
cd reactapp && npx tsc -b
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add reactapp/components/HeaderBar.tsx reactapp/src/index.css
git commit -m "FIX: hide header tagline on narrow phones (< 30rem)"
```

---

## Task 3 — FilterSidebar: new props, close button, InfoBadge tap support

**Files:**
- Modify: `reactapp/components/FilterSidebar.tsx`

- [ ] **Step 1: Extend `FilterSidebarProps`**

At the top of `FilterSidebar.tsx`, the current props type starts at line 8. Replace it:

```tsx
type FilterSidebarProps = {
  filters: Filters;
  setFilters: (filters: Filters) => void;
  onResetFilters: () => void;
  availableStates: string[];
  availableHuc8s: Set<string>;
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;
};
```

- [ ] **Step 2: Accept new props in the component signature**

The function signature at line 110 currently reads:

```tsx
export default function FilterSidebar({ filters, setFilters, onResetFilters, availableStates, availableHuc8s }: FilterSidebarProps) {
```

Change to:

```tsx
export default function FilterSidebar({ filters, setFilters, onResetFilters, availableStates, availableHuc8s, isOpen, onClose, isMobile }: FilterSidebarProps) {
```

- [ ] **Step 3: Add `className` and close button to the sidebar's outer `<div>` and header**

The outer `<div>` is at line 158. Change it from:

```tsx
    <div style={{ width: '15.625rem', padding: '1.25rem 1rem 1.5rem', backgroundImage: 'url(/static/fimbench_gui/images/FilterSidebar.png)', backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff' }}>
```

to:

```tsx
    <div className={`filter-sidebar${isOpen ? ' filter-sidebar--open' : ''}`} style={{ width: '15.625rem', padding: '1.25rem 1rem 1.5rem', backgroundImage: 'url(/static/fimbench_gui/images/FilterSidebar.png)', backgroundSize: 'cover', backgroundPosition: 'center', overflowY: 'auto', display: 'flex', flexDirection: 'column', color: '#fff' }}>
```

Then add a close button inside the `<h2>` header (lines 161–164). The current header is:

```tsx
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', paddingBottom: '0.875rem', marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <img src="/static/fimbench_gui/images/funnel-svgrepo-com.svg" alt="" style={{ width: '1.125rem', height: '1.125rem', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
        Filters
      </h2>
```

Change to:

```tsx
      <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 700, letterSpacing: '0.04em', paddingBottom: '0.875rem', marginBottom: 0, borderBottom: '1px solid rgba(255,255,255,0.15)' }}>
        <img src="/static/fimbench_gui/images/funnel-svgrepo-com.svg" alt="" style={{ width: '1.125rem', height: '1.125rem', filter: 'brightness(0) invert(1)', flexShrink: 0 }} />
        Filters
        {isMobile && (
          <button
            onClick={onClose}
            aria-label="Close filters"
            style={{ marginLeft: 'auto', background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontSize: '1.125rem', padding: '0.125rem 0.25rem', lineHeight: 1 }}
          >
            ✕
          </button>
        )}
      </h2>
```

- [ ] **Step 4: Convert `InfoBadge` from hover-only to click-toggle**

`InfoBadge` starts at line 36. Replace the entire `InfoBadge` function with:

```tsx
function InfoBadge({ description }: { description: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const ref = useRef<HTMLSpanElement>(null);

  const updatePos = () => {
    const el = ref.current;
    if (el) {
      const r = el.getBoundingClientRect();
      setPos({ top: r.top + r.height / 2, left: r.right + 8 });
    }
  };

  return (
    <>
      <span
        ref={ref}
        aria-label={description}
        onMouseEnter={() => { updatePos(); setOpen(true); }}
        onMouseLeave={() => setOpen(false)}
        onClick={(e) => { e.stopPropagation(); updatePos(); setOpen(prev => !prev); }}
        style={infoBadgeStyle}
      >
        <svg width="0.75rem" height="0.75rem" viewBox="0 0 20 20" fill="none" aria-hidden="true" style={{ display: 'block' }}>
          <path d="M9 10C9 9.44772 9.44772 9 10 9C10.5523 9 11 9.44772 11 10V14C11 14.5523 10.5523 15 10 15C9.44772 15 9 14.5523 9 14V10Z" fill="currentColor" />
          <circle cx="10" cy="7" r="1" fill="currentColor" />
          <path fillRule="evenodd" clipRule="evenodd" d="M2 10C2 14.4183 5.58172 18 10 18C14.4183 18 18 14.4183 18 10C18 5.58172 14.4183 2 10 2C5.58172 2 2 5.58172 2 10ZM16 10C16 13.3137 13.3137 16 10 16C6.68629 16 4 13.3137 4 10C4 6.68629 6.68629 4 10 4C13.3137 4 16 6.68629 16 10Z" fill="currentColor" />
        </svg>
      </span>
      {open && createPortal(
        <div
          className="tier-info-tooltip"
          style={{ ...tooltipStyle, top: pos.top, left: pos.left }}
          role="tooltip"
        >
          {description}
        </div>,
        document.body
      )}
    </>
  );
}
```

- [ ] **Step 5: Type-check**

```bash
cd reactapp && npx tsc -b
```

Expected: no errors. (TypeScript will catch any prop mismatches even though App.tsx hasn't been updated yet — it will report that `isOpen`, `onClose`, and `isMobile` are required but not provided. That's expected at this step; it will be resolved in Task 5.)

- [ ] **Step 6: Commit**

```bash
git add reactapp/components/FilterSidebar.tsx
git commit -m "FEAT: add isOpen/onClose/isMobile props to FilterSidebar; close button; InfoBadge tap toggle"
```

---

## Task 4 — CSS: sidebar slide animation

**Files:**
- Modify: `reactapp/src/index.css`

- [ ] **Step 1: Append sidebar mobile CSS to `index.css`**

Append these rules to the end of `reactapp/src/index.css` (after the header-tagline rule added in Task 2):

```css
/* ─── Responsive: sidebar slide-over (mobile) ─── */
@media (max-width: 48rem) {
  .filter-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    width: 15.625rem;
  }

  .filter-sidebar--open {
    transform: translateX(0);
    box-shadow: 0.25rem 0 1.5rem rgba(0, 0, 0, 0.35);
  }
}
```

- [ ] **Step 2: Type-check + lint**

```bash
cd reactapp && npx tsc -b && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 3: Commit**

```bash
git add reactapp/src/index.css
git commit -m "STYLE: add mobile slide-over CSS for filter sidebar"
```

---

## Task 5 — App.tsx: wire up all mobile state and layout

**Files:**
- Modify: `reactapp/src/App.tsx`

This is the biggest task. Make changes in this order: state, resize effect, layout JSX.

- [ ] **Step 1: Add `isMobile`, `sidebarOpen`, `tableVisible` state**

In `App.tsx`, the existing state declarations begin at line 15. After the `showWelcome` state (around line 25), add:

```tsx
  const [isMobile, setIsMobile] = useState(() => window.innerWidth <= 768);
  const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
  const [tableVisible, setTableVisible] = useState(() => window.innerWidth > 768);
```

- [ ] **Step 2: Add resize listener effect**

After the existing `mapRef` declaration (around line 27), add a new `useEffect`:

```tsx
  useEffect(() => {
    const onResize = () => {
      const mobile = window.innerWidth <= 768;
      setIsMobile(mobile);
      if (!mobile) {
        setSidebarOpen(true);
        setTableVisible(true);
      }
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
```

- [ ] **Step 3: Pass new props to `FilterSidebar`**

The `<FilterSidebar>` JSX is around line 132. Add the three new props:

```tsx
      <FilterSidebar
        filters={filters}
        setFilters={handleFiltersChange}
        onResetFilters={handleResetFilters}
        availableStates={availableStates}
        availableHuc8s={availableHuc8s}
        isOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
        isMobile={isMobile}
      />
```

- [ ] **Step 4: Add sidebar backdrop**

Directly before `<FilterSidebar>` in the JSX (inside the `display: flex` wrapper div at line 129), add the backdrop:

```tsx
      {isMobile && sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.4)',
            zIndex: 199,
          }}
        />
      )}
```

- [ ] **Step 5: Replace the map panel `<div>` style with mobile-aware conditional**

The map panel div currently reads (around line 143):

```tsx
        <div style={{ flex: `${mapPercent} 1 0`, minHeight: 0, position: 'relative' }}>
```

Replace with:

```tsx
        <div style={
          isMobile
            ? { flex: 'none', height: tableVisible ? '35%' : '100%', minHeight: 0, position: 'relative', transition: 'height 0.25s ease' }
            : { flex: `${mapPercent} 1 0`, minHeight: 0, position: 'relative' }
        }>
```

- [ ] **Step 6: Add the Filters toggle button inside the map panel**

Inside the map panel div, after `<ColorblindToggle />` and before `<Map ...>`, add:

```tsx
          {isMobile && !sidebarOpen && (
            <button
              onClick={() => setSidebarOpen(true)}
              aria-label="Open filters"
              style={{
                position: 'absolute',
                top: '0.75rem',
                left: '0.75rem',
                zIndex: 10,
                background: '#25C2DF',
                color: '#fff',
                border: 'none',
                borderRadius: '1.5rem',
                padding: '0.375rem 0.75rem',
                fontSize: '0.8125rem',
                fontWeight: 700,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '0.375rem',
                boxShadow: '0 0.125rem 0.5rem rgba(0,0,0,0.2)',
              }}
            >
              ☰ Filters
            </button>
          )}
```

- [ ] **Step 7: Add the table toggle tab at the bottom of the map panel**

At the very end of the map panel div (just before its closing `</div>`), add:

```tsx
          {isMobile && (
            <div
              onClick={() => setTableVisible(v => !v)}
              style={{
                position: 'absolute',
                bottom: 0,
                left: 0,
                right: 0,
                background: 'rgba(255,255,255,0.95)',
                borderTop: '0.0625rem solid #ddd',
                padding: '0.5rem 1rem',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                fontSize: '0.8125rem',
                fontWeight: 600,
                color: '#25C2DF',
                zIndex: 5,
                userSelect: 'none',
              }}
            >
              {tableVisible ? '▼ Hide Table' : `▲ Show Table (${visibleFeatures.length} results)`}
            </div>
          )}
```

- [ ] **Step 8: Hide the resize handle on mobile**

The resize handle `<div>` is around line 159. Wrap it in a mobile guard:

```tsx
        {!isMobile && (
          <div
            onMouseDown={handleSeparatorMouseDown}
            onMouseEnter={() => setHandleHover(true)}
            onMouseLeave={() => setHandleHover(false)}
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize map and table panels"
            style={{
              height: '0.4rem',
              flexShrink: 0,
              cursor: 'row-resize',
              background: (handleHover || resizing) ? '#888' : '#ddd',
              transition: 'background 0.15s ease',
            }}
          />
        )}
```

- [ ] **Step 9: Replace the table panel `<div>` style with mobile-aware conditional**

The table panel div currently reads (around line 175):

```tsx
        <div style={{ flex: `${100 - mapPercent} 1 0`, minHeight: 0, overflow: 'hidden' }}>
```

Replace with:

```tsx
        <div style={
          isMobile
            ? { flex: 'none', height: '65%', minHeight: 0, overflow: 'hidden', display: tableVisible ? 'flex' : 'none', flexDirection: 'column' }
            : { flex: `${100 - mapPercent} 1 0`, minHeight: 0, overflow: 'hidden' }
        }>
```

- [ ] **Step 10: Type-check + lint**

```bash
cd reactapp && npx tsc -b && npm run lint
```

Expected: no errors or warnings.

- [ ] **Step 11: Commit**

```bash
git add reactapp/src/App.tsx
git commit -m "FEAT: mobile-responsive layout — collapsible sidebar, table toggle tab, hidden resize handle"
```

---

## Task 6 — Build verification + manual smoke test

- [ ] **Step 1: Run the frontend test suite**

```bash
cd reactapp && npm run test
```

Expected: all existing tests pass (utility tests are unaffected by these changes).

- [ ] **Step 2: Build the frontend**

```bash
cd reactapp && npm run build
```

Expected: build completes with no TypeScript errors or Vite warnings.

- [ ] **Step 3: Manual smoke test — mobile**

Open the app in a browser (local dev: `npm run dev`, then navigate to `http://localhost:5173/apps/fimbench-gui/`).

Open DevTools → Toggle device toolbar → set to **iPhone SE (375 × 667)**:

1. Sidebar is **not visible** on load — map fills the full width ✓
2. "☰ Filters" button is visible in the top-left of the map ✓
3. Tap "☰ Filters" → sidebar slides in from the left ✓
4. Backdrop covers the map; tap it → sidebar closes ✓
5. "✕" button in sidebar header → sidebar closes ✓
6. "▲ Show Table (N results)" tab at bottom of map shows correct count ✓
7. Tap tab → map shrinks to 35%, table appears below ✓
8. Tab changes to "▼ Hide Table" ✓
9. Tap tab again → table hides, map returns to full height ✓
10. Hover over a tier "ⓘ" badge → tooltip shows ✓ (or tap on mobile — tooltip toggles ✓)
11. Header tagline is hidden ✓

- [ ] **Step 4: Manual smoke test — desktop**

Set DevTools to **responsive, width > 768 px** (or just resize the browser):

1. Sidebar is always visible — no toggle button ✓
2. Drag-resize handle between map and table works ✓
3. Table always visible ✓
4. No regressions in filter, map interaction, or table behavior ✓

- [ ] **Step 5: Final commit (if any fixups needed from smoke test)**

```bash
git add -A
git commit -m "FIX: mobile smoke-test fixups"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|-----------------|------|
| Sidebar: slide-over on mobile, default closed | Task 3 (props/CSS), Task 4 (CSS), Task 5 (state/JSX) |
| Sidebar: toggle button "☰ Filters" in map area | Task 5 step 6 |
| Sidebar: backdrop + tap-outside to close | Task 5 step 4 |
| Sidebar: ✕ close button | Task 3 step 3 |
| Sidebar: unchanged on desktop | Task 5 (conditional inline styles) |
| Table: hidden by default on mobile | Task 5 step 9 |
| Table: "▲ Show Table (N)" tab | Task 5 step 7 |
| Table: map shrinks to 35% when table visible | Task 5 steps 5 + 9 |
| Resize handle: hidden on mobile | Task 5 step 8 |
| Header tagline: hidden on < 30rem | Task 2 |
| InfoBadge: click toggle on touch | Task 3 step 4 |
| FIMTable horizontal scroll | Already implemented (line 429) |
| Hover popup flicker fix | Task 1 |

**Placeholder scan:** No TBDs, no "implement later", no vague steps. All code blocks are complete.

**Type consistency:** `isOpen`, `onClose`, `isMobile` used consistently in Task 3 and Task 5. `isMobile`, `sidebarOpen`, `tableVisible` declared in Task 5 step 1 and used consistently throughout.
