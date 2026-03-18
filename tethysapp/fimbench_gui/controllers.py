from tethys_sdk.routing import controller

# -----------------------------
# Home Page (React SPA)
# -----------------------------
@controller
def home(request):
    """Controller for the app home page."""
    from tethysapp.fimbench_gui.app import App  # lazy import
    return App.render(request, 'index.html')