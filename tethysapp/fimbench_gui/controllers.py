from tethys_sdk.routing import controller
from django.http import JsonResponse, HttpResponse
import requests
from urllib.parse import urlparse
import os
from pathlib import Path

from rio_tiler.io import COGReader
from rio_tiler.utils import render
import mercantile

from osgeo import gdal
import os


def warp_to_web_cog(src_path: str, dst_path: str) -> str:
    gdal.UseExceptions()

    # Optional: match your CLI's multi-threading intent
    gdal.SetConfigOption("GDAL_NUM_THREADS", "ALL_CPUS")

    warp_options = gdal.WarpOptions(
        srcSRS="EPSG:5070",
        dstSRS="EPSG:3857",
        resampleAlg="near",
        format="COG",
        creationOptions=[
            "BLOCKSIZE=256",
            "TILING_SCHEME=GoogleMapsCompatible",
            "COMPRESS=DEFLATE",
            "BIGTIFF=IF_SAFER",
            # You can also keep this here if your GDAL build honors it as a creation option
            "NUM_THREADS=ALL_CPUS",
        ],
        multithread=True,
    )

    ds = gdal.Warp(
        destNameOrDestDS=dst_path,
        srcDSOrSrcDSTab=src_path,
        options=warp_options,
    )
    if ds is None:
        raise RuntimeError(f"gdal.Warp failed for {src_path}")

    ds = None  # flush to disk
    return dst_path

TIERS = {
    "1": "http://127.0.0.1:9000/fimbench/Tier_1/AI_0_4m_20160103T2_915444W341929N_BM.tif",
    "2": "http://127.0.0.1:9000/fimbench/Tier_2/PSS_3_0m_20240623T163213_951940W425401N_BM.tif",
    "4": "http://127.0.0.1:9000/fimbench/Tier_4/BLE_10_0m_100_932457W352955N_BM.tif",
}

# -----------------------------
# Load settings
# -----------------------------
ALLOWED_HOST = os.environ.get("S3_ALLOWED_HOST")
BUCKET_URL = os.environ.get("S3_BUCKET_URL")
CATALOG_KEY = os.environ.get("S3_CATALOG_KEY")
VIZ_TILES = os.environ.get("S3_VIZ_TILES")

# -----------------------------
# Home Page (React SPA)
# -----------------------------
@controller
def home(request):
    """Controller for the app home page."""
    from tethysapp.fimbench_gui.app import App  # lazy import
    return App.render(request, 'index.html')

# -----------------------------
# S3 Proxy endpoint (secure)
# -----------------------------
@controller
def s3_proxy(request):
    target_url = request.GET.get("url")

    if not target_url:
        return JsonResponse({"error": "Missing 'url' parameter"}, status=400)

    parsed = urlparse(target_url)

    if parsed.netloc != ALLOWED_HOST:
        return JsonResponse({"error": "Forbidden host"}, status=403)

    try:
        r = requests.get(target_url, stream=True)

        return HttpResponse(
            r.content,
            status=r.status_code,
            content_type=r.headers.get("Content-Type", "application/octet-stream"),
        )

    except Exception as e:
        return JsonResponse({"error": str(e)}, status=500)


# -----------------------------
# Tile Proxy endpoint
# -----------------------------
@controller
def tile_proxy(request, z, x, y):
    if not VIZ_TILES:
        return JsonResponse({"error": "Tile config missing"}, status=500)

    s3_url = VIZ_TILES.format(z=z, x=x, y=y)

    parsed = urlparse(s3_url)

    if parsed.netloc != ALLOWED_HOST:
        return JsonResponse({"error": "Forbidden host"}, status=403)

    try:
        r = requests.get(s3_url, stream=True)

        return HttpResponse(
            r.content,
            status=r.status_code,
            content_type="application/x-protobuf",
        )

    except Exception as e:
        return HttpResponse(str(e), status=500)
    
@controller
def raster_proxy(request):
    tier = request.GET.get("tier")
    if not tier:
        return HttpResponse("Missing 'tier' parameter", status=400)

    # Map tier to folder and file
    tier_folder_map = {
        "1": "Tier_1",
        "2": "Tier_2",
        "4": "Tier_4",
    }
    folder = tier_folder_map.get(tier)
    if not folder:
        return HttpResponse("Invalid tier", status=400)

    # Assume exactly one _BM.tif per folder
    tif_files = list((WORKSPACE_DIR / folder).glob("*_BM.tif"))
    if not tif_files:
        return HttpResponse("No TIFF found for this tier", status=404)

    # Serve with streaming
    return FileResponse(open(tif_files[0], "rb"), content_type="image/tiff")

@controller
def fim_tile(request, tier, z, x, y):
    tif_path = TIERS.get(tier)
    if not tif_path:
        return HttpResponse("Tier not found", status=404)

    tile = mercantile.Tile(x=int(x), y=int(y), z=int(z))

    try:
        with COGReader(tif_path) as cog:
            data, mask = cog.tile(tile.x, tile.y, tile.z)
            # Render as PNG
            img = render(data, mask, rescale=[0, 255])
    except Exception as e:
        return HttpResponse(f"Error reading tile: {str(e)}", status=500)

    return HttpResponse(img, content_type="image/png")