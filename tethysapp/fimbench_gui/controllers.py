from tethys_sdk.routing import controller
from django.http import HttpResponse
import requests

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

# -----------------------------
# Tile Proxy endpoint
# -----------------------------

@controller(url='tile-proxy/{z}/{x}/{y}')
def tile_proxy(request, z, x, y):
    
    # print("\n\n")
    # print("******************************************")
    # print("\n")
    # print(f"Request: {request}")
    # print("\n")
    # print("******************************************")
    # print("\n\n")

    # 🔥 Fix the .pbf issue
    y = y.replace(".pbf", "")
    
    print("\n\n")
    print("******************************************")
    print("\n")
    print(f"y: {y}")
    print("\n")
    print("******************************************")
    print("\n\n")

    s3_url = f"http://127.0.0.1:9000/fimbench/FIM_VIZ/tiles/{z}/{x}/{y}.pbf"

    try:
        r = requests.get(s3_url, stream=True)
        
        print("\n\n")
        print("******************************************")
        print("\n")
        print(f"Requested r")
        print("\n")
        print("******************************************")
        print("\n\n")

        # ✅ Handle missing tiles correctly
        if r.status_code == 404:
            return HttpResponse(status=204)

        r.raise_for_status()
        
        print("\n\n")
        print("******************************************")
        print("\n")
        print(f"Raised r for_status()")
        print("\n")
        print("******************************************")
        print("\n\n")

        response = HttpResponse(
            r.content,
            content_type="application/vnd.mapbox-vector-tile",
        )
        
        print("\n\n")
        print("******************************************")
        print("\n")
        print(f"Got a response {response}")
        print("\n")
        print("******************************************")
        print("\n\n")

        # ✅ CRITICAL for your gzip tiles
        response["Content-Encoding"] = "gzip"
        
        print("\n\n")
        print("******************************************")
        print("\n")
        print(f"Response g-zip encoded")
        print("\n")
        print("******************************************")
        print("\n\n")


        return response

    except Exception as e:
        return HttpResponse(str(e), status=500)

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