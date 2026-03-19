from tethys_sdk.routing import controller
from django.http import JsonResponse, HttpResponse
import requests
from urllib.parse import urlparse
import os

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