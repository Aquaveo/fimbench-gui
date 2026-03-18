from tethys_sdk.base import TethysAppBase

class App(TethysAppBase):
    """
    FIMBench GUI Tethys App
    """

    # Display name in Tethys UI
    name = 'FIMBench GUI'

    # Technical package name (folder under tethysapp/)
    package = 'fimbench_gui'

    # URL root for the app
    root_url = 'fimbench-gui'

    # Index route name (must match a controller name)
    index = 'home'

    # Ensuring that 404 is avoided
    catch_all = 'home'

    # Optional metadata
    icon = f'{package}/images/android-chrome-512x512.png'
    description = 'FIMBench app with Tethys backend'
    color = '#007bff'
    tags = 'FIM, Benchmark data, GIS'
    enable_feedback = False
    feedback_emails = []

    # No need to override register_url_maps since controllers are decorated
    # The SPA React frontend uses catch_all=True on the home controller
