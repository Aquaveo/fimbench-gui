from tethys_sdk.routing import controller
from django.http import HttpResponse
import requests

# -----------------------------
# Home Page (React SPA)
# -----------------------------
@controller(login_required=False)
def home(request):
    """Controller for the app home page."""
    from tethysapp.fimbench_gui.app import App  # lazy import
    return App.render(request, 'index.html')

# -----------------------------
# Tile Proxy endpoint
# -----------------------------
@controller(url="tile-proxy/{z}/{x}/{tile}", login_required=False)
def tile_proxy(request, z, x, tile):
    y = tile[:-4] if tile.endswith(".pbf") else tile
    
    # print("request:", request)
    
    upstream_url = f"http://127.0.0.1:9000/fimbench/FIM_Viz/tiles/{z}/{x}/{y}.pbf"
    
    # print("upstream_url:", upstream_url)

    try:
        upstream = requests.get(upstream_url, stream=True, timeout=30)

        if upstream.status_code == 404:
            return HttpResponse(status=204)

        upstream.raise_for_status()

        # Keep upstream bytes compressed as-is
        upstream.raw.decode_content = False
        body = upstream.raw.read()

        response = HttpResponse(
            body,
            status=upstream.status_code,
            content_type="application/vnd.mapbox-vector-tile",
        )
        
        # print("HttpResponse:", response)

        # IMPORTANT: body is gzipped, so tell the browser
        response["Content-Encoding"] = "gzip"

        if "Cache-Control" in upstream.headers:
            response["Cache-Control"] = upstream.headers["Cache-Control"]

        return response

    except requests.HTTPError as e:
        status = e.response.status_code if e.response is not None else 502
        return HttpResponse(f"Upstream HTTP error: {e}", status=status)
    except requests.RequestException as e:
        return HttpResponse(f"Upstream tile fetch failed: {e}", status=502)
    except Exception as e:
        return HttpResponse(f"Proxy error: {e}", status=500)

# -----------------------------
# S3 Proxy endpoint (secure)
# -----------------------------
# @controller
# def s3_proxy(request):
#     target_url = request.GET.get("url")

#     if not target_url:
#         return JsonResponse({"error": "Missing 'url' parameter"}, status=400)

#     parsed = urlparse(target_url)

#     if parsed.netloc != ALLOWED_HOST:
#         return JsonResponse({"error": "Forbidden host"}, status=403)

#     try:
#         r = requests.get(target_url, stream=True)

#         return HttpResponse(
#             r.content,
#             status=r.status_code,
#             content_type=r.headers.get("Content-Type", "application/octet-stream"),
#         )

#     except Exception as e:
#         return JsonResponse({"error": str(e)}, status=500)
    
# @controller(url='tile-proxy-test')
# def tile_proxy_test(request):
#     print("\n\n")
#     print("******************************************")
#     print("\n")
#     print("Here is the request that was made:", request)
#     print("\n")
#     print("******************************************")
#     print("\n\n")
#     return HttpResponse("proxy route reachable", status=200)

# @controller
# def raster_proxy(request):
#     tier = request.GET.get("tier")
#     if not tier:
#         return HttpResponse("Missing 'tier' parameter", status=400)

#     # Map tier to folder and file
#     tier_folder_map = {
#         "1": "Tier_1",
#         "2": "Tier_2",
#         "4": "Tier_4",
#     }
#     folder = tier_folder_map.get(tier)
#     if not folder:
#         return HttpResponse("Invalid tier", status=400)

#     # Assume exactly one _BM.tif per folder
#     tif_files = list((WORKSPACE_DIR / folder).glob("*_BM.tif"))
#     if not tif_files:
#         return HttpResponse("No TIFF found for this tier", status=404)

#     # Serve with streaming
#     return FileResponse(open(tif_files[0], "rb"), content_type="image/tiff")