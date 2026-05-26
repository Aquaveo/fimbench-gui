# Mobile Responsiveness Design

**Date:** 2026-05-25  
**Status:** Approved  
**Scope:** Collapsible sidebar (Task 1) + full mobile/tablet responsiveness pass (Task 2)  
**Breakpoint:** Mobile ≤ 768 px (`48rem`); Tablet 769–1024 px (`48.0625–64rem`)

---

## Motivation

The app is shared via QR code. QR codes are scanned on phones. The current layout renders a fixed-width sidebar that occupies ~250 px on a 375 px phone screen, covering the map almost entirely on first load.

---

## Decision Summary

| Decision | Choice |
|----------|--------|
| Sidebar collapse pattern | Slide-over overlay (Option A) |
| Mobile table behaviour | Hidden by default, toggle tab (Option A) |

---

## 1. Collapsible Sidebar

### Behaviour

- **Desktop (> 768 px):** sidebar always visible; no toggle button; layout unchanged.
- **Mobile (≤ 768 px):**
  - Sidebar is off-screen by default.
  - A "☰ Filters" pill button floats in the top-left of the map area.
  - Tapping it opens the sidebar (slides in from the left).
  - A semi-transparent backdrop covers the rest of the screen; tapping it closes the sidebar.
  - A ✕ close button in the sidebar header also closes it.

### State

`sidebarOpen: boolean` added to `App.tsx`.

Initialisation:
```ts
const [sidebarOpen, setSidebarOpen] = useState(() => window.innerWidth > 768);
```

A `resize` listener keeps it in sync if the window is resized across the breakpoint:
```ts
useEffect(() => {
  const onResize = () => setSidebarOpen(window.innerWidth > 768);
  window.addEventListener('resize', onResize);
  return () => window.removeEventListener('resize', onResize);
}, []);
```

### Props added to FilterSidebar

```ts
type FilterSidebarProps = {
  // existing props ...
  isOpen: boolean;
  onClose: () => void;
  isMobile: boolean;  // controls whether close button and backdrop render
};
```

### CSS

```css
/* Sidebar — mobile slide-over */
@media (max-width: 48rem) {
  .filter-sidebar {
    position: fixed;
    top: 0;
    left: 0;
    bottom: 0;
    z-index: 200;
    transform: translateX(-100%);
    transition: transform 0.25s ease;
    overflow-y: auto;
    width: 15.625rem;      /* unchanged */
  }

  .filter-sidebar--open {
    transform: translateX(0);
  }

  .filter-sidebar-backdrop {
    display: none;
    position: fixed;
    inset: 0;
    background: rgba(0, 0, 0, 0.4);
    z-index: 199;
  }

  .filter-sidebar-backdrop--visible {
    display: block;
  }

  .filter-sidebar-toggle {
    display: flex;         /* only shown on mobile */
  }
}

/* Toggle button hidden on desktop */
.filter-sidebar-toggle {
  display: none;
}
```

The toggle button ("☰ Filters") is absolutely positioned inside the map wrapper div in `App.tsx`, above the `<Map>` component (`z-index: 10`).

---

## 2. Mobile Table Toggle

### Behaviour

- **Desktop (> 768 px):** existing split layout and drag-resize handle are unchanged.
- **Mobile (≤ 768 px):**
  - Drag-resize handle is hidden.
  - Table panel is hidden by default (`tableVisible = false`).
  - A sticky toggle tab sits at the bottom of the map area: `▲ Show Table (N results)`.
  - Tapping it sets `tableVisible = true`: map shrinks to a 35% peek strip; table expands to fill remaining space.
  - Tab label becomes `▼ Hide Table` when table is visible.
  - `N` reflects `visibleFeatures.length` (live-updates with filters).

### State

`tableVisible: boolean` added to `App.tsx`.

```ts
const [tableVisible, setTableVisible] = useState(() => window.innerWidth > 768);
```

Same `resize` listener as sidebar (can share a single `isMobile` derived value).

### Layout

On mobile the split container uses explicit heights rather than `flex` percentages:

```css
@media (max-width: 48rem) {
  .map-panel {
    height: 100%;          /* when table hidden */
    flex: none;
    transition: height 0.25s ease;
  }

  .map-panel--table-visible {
    height: 35%;
  }

  .table-panel {
    display: none;
    flex: none;
    height: 65%;
    overflow: hidden;
  }

  .table-panel--visible {
    display: block;
  }

  .split-resize-handle {
    display: none;         /* no drag-resize on mobile */
  }

  .table-toggle-tab {
    display: flex;         /* only on mobile */
  }
}

.table-toggle-tab {
  display: none;
}
```

---

## 3. Other Responsive Fixes

These require no design decisions — applied during implementation.

### 3a. Header tagline

Hide the subtitle on very narrow screens to prevent overflow:

```css
@media (max-width: 30rem) {
  .header-tagline {
    display: none;
  }
}
```

`HeaderBar.tsx` gets a `className="header-tagline"` on the `<p>` tagline element (currently inline-styled only).

### 3b. InfoBadge tap support

`InfoBadge` in `FilterSidebar.tsx` currently only responds to `onMouseEnter/Leave`. Add a click toggle:

```tsx
const [open, setOpen] = useState(false);

const handleEnter = () => { /* existing */ setOpen(true); };
const handleLeave = () => { setOpen(false); };
const handleClick = (e: React.MouseEvent) => {
  e.stopPropagation();
  setOpen(prev => !prev);
};
```

Replace `hovered` with `open` throughout.

### 3c. FIMTable horizontal scroll

Wrap the `<table>` element in:

```tsx
<div style={{ overflowX: 'auto', width: '100%' }}>
  <table ...>
```

This allows the table to scroll horizontally on narrow screens without breaking the column layout.

### 3d. Resize handle — touch

The drag-resize handle in `App.tsx` is hidden on mobile (§2 above), so no touch-drag logic is needed.

### 3e. Map hover tooltip

No change needed. The hover popup (`hoverPopup.trackPointer()`) only fires on `mousemove`, which doesn't occur on touch devices. Tap-to-click already shows the full click popup on mobile.

---

## 4. Files Changed

| File | Changes |
|------|---------|
| `reactapp/src/App.tsx` | Add `sidebarOpen`, `tableVisible` state; `isMobile` derived value; resize listener; toggle button JSX; backdrop JSX; table toggle tab JSX; conditional CSS classes |
| `reactapp/src/App.css` | Add all mobile media-query rules (sidebar slide-over, table toggle, resize handle hide, tagline hide) |
| `reactapp/components/FilterSidebar.tsx` | Accept `isOpen`, `onClose`, `isMobile` props; add close button; replace `hovered` with `open` in `InfoBadge` |
| `reactapp/components/HeaderBar.tsx` | Add `className="header-tagline"` to tagline `<p>` |
| `reactapp/components/FIMTable.tsx` | Wrap `<table>` in `overflow-x: auto` container |
| `reactapp/src/index.css` | Minor: add `.table-toggle-tab`, `.filter-sidebar-toggle`, `.filter-sidebar-backdrop` base rules |

No new files. No new dependencies.

---

## 5. Out of Scope

- Tablet-specific layout (769–1024 px): the slide-over sidebar and table toggle degrade acceptably at tablet sizes without special-casing. The existing desktop layout kicks in above 768 px.
- Touch-drag resize handle: hidden on mobile; not implemented.
- Map touch gesture improvements (pinch-zoom, etc.): MapLibre handles these natively.
- The `tile_proxy` endpoint: not involved in any of these changes.
