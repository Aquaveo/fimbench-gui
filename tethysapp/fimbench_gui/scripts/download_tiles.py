import requests
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed
from tqdm import tqdm
import json  # 👈 NEW

BASE_URL = "https://sdmlab.s3.amazonaws.com/FIM_Database/FIM_Viz/tiles"
OUTPUT_DIR = Path("home/rragh/tethysdev/tethysapp-fimbench_gui/fimbench-gui/tethysapp/fimbench_gui/resources/FIM_Viz/tiles")

MAX_WORKERS = 12

ZOOMS_TO_DOWNLOAD = [3, 4]

FAILED_LOG = Path("failed_tiles.json")  # 👈 NEW

# -----------------------------
# Load metadata
# -----------------------------
meta_url = f"{BASE_URL}/metadata.json"

print("📥 Fetching metadata...")
meta = requests.get(meta_url).json()

minzoom = int(meta["minzoom"])
maxzoom = int(meta["maxzoom"])

print(f"Zoom levels: {minzoom} → {maxzoom}")


# -----------------------------
# Build tasks
# -----------------------------
def build_tasks():
    tasks = []

    for z in ZOOMS_TO_DOWNLOAD:
        for x in range(2 ** z):
            for y in range(2 ** z):
                url = f"{BASE_URL}/{z}/{x}/{y}.pbf"
                out = OUTPUT_DIR / str(z) / str(x) / f"{y}.pbf"

                tasks.append((url, out))

    return tasks


# -----------------------------
# Download function
# -----------------------------
def download_tile(url, out_path):
    
    if out_path.exists():
        return True  # already downloaded → skip
    
    try:
        r = requests.get(url, timeout=10)

        if r.status_code == 404:
            return "404"  # 👈 NEW: distinguish missing tiles

        r.raise_for_status()
        
        if r.status_code != 404:
            out_path.parent.mkdir(parents=True, exist_ok=True)
            with open(out_path, "wb") as f:
                f.write(r.content)
            print(f"✅ Saved {out_path}")  # <- debug
            return True

    except Exception:
        return False


# -----------------------------
# Build + download
# -----------------------------
tasks = build_tasks()
print(f"📦 Total possible tiles: {len(tasks):,}")

success = 0
failed = []      # 👈 NEW
missing = 0      # 👈 NEW (404s)

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {
        executor.submit(download_tile, url, path): (url, path)
        for url, path in tasks
    }

    for future in tqdm(as_completed(futures), total=len(futures)):
        url, path = futures[future]
        result = future.result()

        if result is True:
            success += 1

        elif result == "404":
            missing += 1  # 👈 track separately (not really “failure”)

        else:
            failed.append({
                "url": url,
                "path": str(path)
            })


# -----------------------------
# Save failed tiles
# -----------------------------
if failed:
    with open(FAILED_LOG, "w") as f:
        json.dump(failed, f, indent=2)

    print(f"\n💾 Saved failed tiles → {FAILED_LOG.resolve()}")


# -----------------------------
# Summary
# -----------------------------
print("\n============================")
print(f"✅ Downloaded tiles: {success}")
print(f"🚫 Missing tiles (404): {missing}")
print(f"❌ Failed tiles: {len(failed)}")
print("============================")

if failed:
    print("\nFailed tiles:")
    for item in failed:
        print(f"- {item['url']}")