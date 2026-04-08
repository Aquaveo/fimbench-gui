import requests
import json
import os
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path
import time
import random
from tqdm import tqdm

CATALOG_URL = "https://sdmlab.s3.amazonaws.com/FIM_Database/FIM_Viz/catalog_core.json"
OUTPUT_DIR = Path("/home/rragh/tethysdev/tethysapp-fimbench_gui/fimbench-gui/tethysapp/fimbench_gui/resources")

MAX_WORKERS = 8
MAX_RETRIES = 5

FAILED_LOG = Path("failed_downloads.json")

# -----------------------------
# CONFIG
# -----------------------------
TARGET_TIER = "Tier_4"     # "HWM", "Tier_1", "Tier_2", etc.
RETRY_ONLY_FAILED = False  # 🔥 set to True for 2nd run


# -----------------------------
# Helpers
# -----------------------------
def download_file(url, out_path):
    for attempt in range(MAX_RETRIES):
        try:
            r = requests.get(url, stream=True, timeout=30)
            r.raise_for_status()

            out_path.parent.mkdir(parents=True, exist_ok=True)

            with open(out_path, "wb") as f:
                for chunk in r.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)

            return True

        except Exception as e:
            wait = (2 ** attempt) + random.uniform(0, 1)
            print(f"⚠️ Retry {attempt+1}/{MAX_RETRIES} for {url} in {wait:.1f}s")
            time.sleep(wait)

    print(f"❌ FAILED: {url}")
    return False


# -----------------------------
# Load catalog OR failed list
# -----------------------------
if RETRY_ONLY_FAILED and FAILED_LOG.exists():
    print("🔁 Retrying ONLY failed downloads...")
    
    with open(FAILED_LOG, "r") as f:
        tasks = [(item["url"], Path(item["path"])) for item in json.load(f)]

else:
    print("📥 Fetching catalog...")
    catalog = requests.get(CATALOG_URL).json()
    records = catalog["records"]

    print(f"✅ Found {len(records)} records")

    # -----------------------------
    # Filter
    # -----------------------------
    filtered = [r for r in records if r["tier"] == TARGET_TIER]

    print(f"🎯 Downloading {len(filtered)} records for {TARGET_TIER}")

    # -----------------------------
    # Build download list
    # -----------------------------
    tasks = []

    for r in filtered:
        base_path = OUTPUT_DIR / r["tier"] / r["site_id"]

        tasks.append((r["tif_url"], base_path / os.path.basename(r["tif_url"])))
        tasks.append((r["gpkg_url"], base_path / os.path.basename(r["gpkg_url"])))
        tasks.append((r["json_url"], base_path / os.path.basename(r["json_url"])))

    print(f"📦 Total files to download: {len(tasks)}")


# -----------------------------
# Parallel download
# -----------------------------
success = 0
failed = []

with ThreadPoolExecutor(max_workers=MAX_WORKERS) as executor:
    futures = {
        executor.submit(download_file, url, path): (url, path)
        for url, path in tasks
    }

    for future in tqdm(as_completed(futures), total=len(futures)):
        url, path = futures[future]

        if future.result():
            success += 1
        else:
            failed.append({
                "url": url,
                "path": str(path)
            })


# -----------------------------
# Save failed list
# -----------------------------
if failed:
    with open(FAILED_LOG, "w") as f:
        json.dump(failed, f, indent=2)

    print(f"\n💾 Saved failed list → {FAILED_LOG.resolve()}")


# -----------------------------
# Summary
# -----------------------------
print("\n============================")
print(f"✅ Success: {success}/{len(tasks)}")
print(f"❌ Failed: {len(failed)}")
print("============================")

if failed:
    print("\nFailed files:")
    for item in failed:
        print(f"- {item['url']}")