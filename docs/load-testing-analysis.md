# FIMbench GUI — Mock Load Analysis

**Date:** 2026-05-25  
**Type:** Analytical estimation (no live load tests were run against the production site)  
**Site:** https://tethys.ciroh.org/apps/fimbench-gui/

---

## Summary

| Concurrent Users | Django Load | Tile/Catalog Load (S3) | Expected UX |
|-----------------|-------------|------------------------|-------------|
| 10  | Comfortable — minor HTML queue | Trivial for S3 | Smooth |
| 20  | Light queue on initial load | Easy for S3 | Slight delay (< 1 s) |
| 50  | Moderate queue — pages slow | Fine for S3 | Noticeable 2–5 s load times |
| 100 | Heavy queue — HTML may timeout | Approaching S3 request rate | Poor; some users see failures |
| 200 | Overloaded; connection backlog fills | S3 rate limit edge case | Effectively broken for late arrivals |

**Key insight:** tiles and catalog JSON bypass Django entirely in production (hardcoded to `sdmlab.s3.amazonaws.com`). Django only serves the HTML shell + static assets, so the bottleneck is static-file throughput, not map data. If tiles were routed through the `tile_proxy` endpoint (as they are in local dev via MinIO), the site would become unusable at ≥ 50 concurrent users.

---

## 1. Request Architecture (Production)

### What each user requests, and where

| Request | Destination | Frequency | Notes |
|---------|-------------|-----------|-------|
| HTML page (`/apps/fimbench-gui/`) | Tethys/Django | Once per session | Template render ~50–150 ms |
| Static assets (JS bundle, CSS, images) | Tethys/Django static | Once per session (~20 files) | Browser-cached after first visit |
| Catalog JSON (`catalog_core.json`) | S3 direct | Once per session | ~300–500 KB; bypasses Django |
| Map tiles (`tiles/{z}/{x}/{y}.pbf`) | S3 direct | Continuous during map use | ~30 on load; ~15–25 per pan/zoom |
| File downloads (GeoTIFF, metadata) | S3 direct (user-triggered) | Rare; 0–1 per session | Not routed through Django |

**Important:** `Map.tsx` hardcodes tile URLs to `https://sdmlab.s3.amazonaws.com/...`. The backend `tile_proxy` endpoint exists but is not invoked by the current frontend. This means Django's workload is limited to page shells and static files.

### Tile volume per user session

- **Initial viewport fill (zoom 4, continental US):** ~28–35 tiles
- **Per pan/zoom interaction:** ~12–25 tiles
- **Assumed average interactions:** 1–2/min for an engaged user
- **Sustained rate:** ~20–40 tiles/min = 0.33–0.67 tiles/sec per user

---

## 2. Infrastructure Assumptions

- **Gunicorn workers:** 4 synchronous workers (conservative default for a Tethys install; actual count depends on server sizing)
- **HTML response time:** ~100 ms (Django template render + context lookup)
- **Static asset response time:** ~20–50 ms each (WhiteNoise or Django staticfiles)
- **S3 GET latency:** ~30–80 ms per request (AWS East/West dependent)
- **S3 GET throughput limit per prefix:** ~5,500 requests/second (AWS default; automatically partitioned per prefix)
- **Tile size (gzip compressed):** ~30–150 KB depending on feature density at that tile
- **Catalog JSON size:** ~300–500 KB

---

## 3. Per-Concurrency Analysis

### 3.1 — 10 Concurrent Users

**Django (HTML + static):**
- 10 HTML requests: 10 ÷ 4 workers = 2.5 per worker. Queue depth ≈ 2. Wait time: ~200 ms. Effectively instant.
- Static assets: ~200 requests staggered over ~2 s. 4 workers handle comfortably; most assets are small.

**S3 (tiles + catalog):**
- Catalog: 10 simultaneous requests (~300 KB × 10 = 3 MB). S3 handles effortlessly.
- Initial tiles: 10 × 30 = 300 requests, spread over ~2 s (MapLibre staggers tile fetches). Peak rate ~150 req/sec. Far below S3's 5,500 req/sec limit.

**Bandwidth:**
- Per user: ~300 KB catalog + 30 × 100 KB tiles = ~3.3 MB
- Total at peak: ~33 MB

**Verdict:** ✅ Smooth experience for all users. No perceptible delays.

---

### 3.2 — 20 Concurrent Users

**Django:**
- 20 HTML requests: 5 per worker. Queue wait ≈ 400–500 ms for the last user. Still acceptable.
- Static assets: ~400 requests. Small queue; pages fully load within 3–5 s.

**S3:**
- Initial tiles: 20 × 30 = 600 requests at ~300 req/sec peak. Trivial.
- Catalog: 20 simultaneous (~6 MB burst). No issue.

**Bandwidth:** ~66 MB at peak.

**Verdict:** ✅ Slight delay on initial HTML for late-arriving users (< 1 s extra). Maps load normally. Unnoticeable in practice.

---

### 3.3 — 50 Concurrent Users

**Django:**
- 50 HTML requests: 12–13 per worker. Queue wait: ~1.2–1.5 s for users at the back of the queue.
- Static assets: 50 × 20 = 1,000 requests. With 4 workers at ~30 ms each, clearing 1,000 requests takes: 1,000 ÷ (4 × 33 req/sec) ≈ 7–8 s. Users may see partially loaded pages for 5–10 s.

**S3:**
- Initial tiles: 50 × 30 = 1,500 requests, ~750 req/sec peak. Still below S3 limit. Maps load fine once the SPA shell arrives.
- Catalog: 50 × ~400 KB = 20 MB burst. Fine.

**Bandwidth:** ~165 MB at peak.

**Verdict:** ⚠️ Noticeable degradation. HTML loads in 1–2 s (vs. < 0.5 s baseline). Static assets may stagger in over 5–10 s. Map tiles load quickly once the page shell arrives (S3 is fast). Users on slow connections may perceive an incomplete page briefly. Not a hard failure but the experience is visibly slower.

---

### 3.4 — 100 Concurrent Users

**Django:**
- 100 HTML requests: 25 per worker. Queue wait: 2.5–3 s for last-in users.
- Static assets: 100 × 20 = 2,000 requests. Clearing time ≈ 15–17 s. Most users will see assets still loading well after page shell arrives.
- Worker exhaustion risk: if any static-asset request is slow (cold filesystem cache, network jitter), it holds a worker and the queue cascades.
- OS TCP accept backlog (default 128–512 connections): with 100 users each holding several connections, the backlog may fill. Users arriving late get connection-refused errors.

**S3:**
- Initial tiles: 100 × 30 = 3,000 requests, ~1,500 req/sec peak. 
- Catalog: 100 × ~400 KB = 40 MB. Fine.
- No S3 throttling expected, but download volume spikes significantly.

**Bandwidth:** ~330 MB at peak. At a 1 Gbps uplink this is ~2.6 s to serve everything, but S3 spreads this across its own infrastructure so the server upload isn't the constraint.

**Verdict:** ❌ Poor experience. HTML takes 2–4 s. Static assets may take 15+ s to fully load. Some users hitting the connection at the wrong moment will get timeouts or refused connections. Maps will eventually display correctly (tiles come from S3 independently), but the overall page load is degraded enough to feel broken.

---

### 3.5 — 200 Concurrent Users

**Django:**
- 200 HTML requests: 50 per worker. Queue wait: 5+ s for later users. Many browsers time out before receiving HTML (default browser timeout ~30 s, but users give up much sooner).
- Static assets: 200 × 20 = 4,000 requests. Estimated clearing time: 30+ s. The server's OS-level TCP backlog overflows; incoming connections get dropped entirely.
- Gunicorn's default backlog is 2,048 sockets, but with 4 workers and 50+ requests queued per worker, effective response for the last-in users approaches 30–60 s.

**S3:**
- Initial tiles: 200 × 30 = 6,000 requests. At peak this approaches S3's 5,500 GET/sec single-prefix limit. AWS would begin throttling or returning `503 Slow Down` on some requests, causing MapLibre retries. 
- Catalog: 200 × 400 KB = 80 MB burst. Fine.

**Bandwidth:** ~660 MB at peak from S3. Server-side (static assets): 200 × 1 MB = 200 MB. At 1 Gbps: ~1.6 s to transmit, but the bottleneck is Django workers, not bandwidth.

**Verdict:** ❌ Site effectively broken for a significant fraction of users. HTML delivery is severely delayed. Some users get TCP connection errors. Those who do get through will see maps load (S3 handles tiles), but the overall experience is non-functional. The 200-user failure mode is not graceful.

---

## 4. Bottleneck Summary

| Component | Bottleneck? | Why |
|-----------|-------------|-----|
| Django (HTML) | ✅ Yes — at 50+ users | 4 synchronous workers queue requests |
| Django (static assets) | ✅ Yes — at 50+ users | Same worker pool; assets are numerous |
| Django (tile_proxy) | N/A in production | Frontend bypasses it; direct S3 |
| S3 (catalog JSON) | No | Single fetch per session; S3 scales to thousands/sec |
| S3 (map tiles) | Minor at 200 users | Approaches per-prefix rate limit; AWS auto-throttles |
| MinIO (local dev) | ✅ Yes — at any scale | tile_proxy is synchronous; 4 workers = ~80 tiles/sec max |
| Bandwidth | No | S3 absorbs the bulk; static assets are small |

---

## 5. tile_proxy vs. Direct S3 — Comparison

The current production frontend uses direct S3 URLs for tiles. If tiles were routed through `tile_proxy` (as in local dev with MinIO), performance would be dramatically worse:

| Scenario | Capacity | 50 Users | 100 Users |
|----------|----------|----------|-----------|
| **Direct S3 (current production)** | S3 handles ~5,500 req/sec | Fine | Minor S3 pressure |
| **Via tile_proxy (local dev / hypothetical)** | ~80 req/sec (4 workers × 20 req/worker/sec at 50 ms each) | 1,500 tiles ÷ 80 = 18 s queue | Tiles timeout entirely |

Keeping tiles on direct S3 is the single biggest performance decision in the app. The current setup is correct for scale.

---

## 6. Downloads (GeoTIFF / Metadata)

Downloads are user-triggered and go directly from the browser to S3 — they bypass Django and MinIO entirely. GeoTIFFs can be large (hundreds of MB), but since they are direct S3 transfers, the only concern is:

- **S3 egress cost** at scale (not a performance issue)
- **S3 bandwidth** is shared globally across all S3 customers, so no single client can starve others

Downloads are not a scalability concern for the Tethys server.

---

## 7. Recommended Mitigations (Ordered by Impact)

### 7.1 Increase gunicorn workers *(low effort, immediate gain)*

The rule of thumb for synchronous workers is `2 × CPU_cores + 1`. For a 4-core VM, that is 9 workers instead of 4. This more than doubles static-file throughput and delays the degradation curve by roughly 2×.

```bash
# In the Tethys/gunicorn startup config:
gunicorn --workers 9 tethysapp.fimbench_gui.wsgi
```

This alone shifts the "noticeably slow" threshold from ~50 to ~100 concurrent users.

### 7.2 Serve static files via nginx (not Django) *(medium effort, large gain)*

Every static-asset request that hits Django consumes a worker. An nginx `location /static/` block serves files at OS speed without touching Python, freeing all 4–9 workers for HTML responses only. This is the standard production pattern for Django apps.

### 7.3 Add aggressive `Cache-Control` headers to static assets *(low effort)*

The JS bundle and CSS rarely change. Setting `Cache-Control: max-age=31536000, immutable` (with content-hash filenames from Vite — already done) means repeat visitors never touch Django for assets. This eliminates the static-asset queue for returning users.

### 7.4 Add a CDN in front of static assets *(medium effort)*

CloudFront or Fastly in front of `/static/fimbench_gui/` would cache static files at edge nodes globally, removing the static-asset load from Django entirely even for first visits.

### 7.5 Async Django / ASGI for tile_proxy *(required if tiles are ever re-routed through Django)*

The synchronous `requests.get` in `tile_proxy` blocks a worker for 50–150 ms per request. Replacing it with `httpx.AsyncClient` and deploying under daphne/uvicorn would allow thousands of concurrent tile requests with just a few workers. Only relevant if the production frontend ever switches back to routing tiles through Django.

---

## 8. S3 Bucket CORS / Rate-Limit Notes

The catalog and tiles are served from `sdmlab.s3.amazonaws.com`. At 200 concurrent users, tile requests peak at ~6,000/sec against a single key prefix. AWS S3 supports 5,500 GET requests/second per prefix by default. To stay safely under this limit at scale:

- AWS automatically partitions prefixes under load; 6,000/sec is in the "acceptable with minor retries" range.
- Consider splitting the tile prefix (e.g., `/tiles/a/`, `/tiles/b/`) for extreme scale, but this is unnecessary for the expected audience size.

---

## 9. Projected Failure Point

Without any infrastructure changes, the site degrades meaningfully at approximately **40–60 concurrent users** (HTML/static-asset queue fills the 4-worker pool) and becomes non-functional for a significant fraction of arrivals at **100+ concurrent users**.

With mitigations 7.1 + 7.2 applied (more workers + nginx for statics), the comfortable ceiling rises to approximately **150–200 concurrent users** with graceful degradation beyond that.

---

*Analysis performed analytically against the codebase (`controllers.py`, `Map.tsx`, `App.tsx`). No requests were made to the live production site.*
