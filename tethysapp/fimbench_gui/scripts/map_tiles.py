import requests
import mapbox_vector_tile
import gzip

url = "http://localhost:9000/fimbench/FIM_VIZ/tiles/6/12/25.pbf"

data = requests.get(url).content

print("Downloaded bytes:", len(data))

# --- Try raw decode ---
try:
    decoded = mapbox_vector_tile.decode(data)
    print("✅ RAW SUCCESS:", decoded.keys())
except Exception as e:
    print("❌ RAW FAIL:", e)

# --- Try gzip decode ---
try:
    decompressed = gzip.decompress(data)
    decoded = mapbox_vector_tile.decode(decompressed)
    print("✅ GZIP SUCCESS:", decoded.keys())
except Exception as e:
    print("❌ GZIP FAIL:", e)