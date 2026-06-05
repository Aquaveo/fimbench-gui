from tethys_sdk.base import TethysAppBase
from tethys_sdk.app_settings import CustomSetting
import os

class App(TethysAppBase):
    """
    FIMbench GUI Tethys App
    """

    # Display name in Tethys UI
    name = 'FIMbench GUI'

    # Technical package name (folder under tethysapp/)
    package = 'fimbench_gui'

    # URL root for the app
    root_url = 'fimbench-gui'

    # Index route name (must match a controller name)
    index = 'home'

    # Ensuring that 404 is avoided
    catch_all = 'home'

    icon = f'{package}/images/android-chrome-512x512.png'
    # Optional metadata
    description = 'FIMbench app with Tethys backend'
    color = '#007bff'
    tags = 'FIM, Flood Mapping, Flood Inundation Mapping, Hydrology, Benchmark data, GIS'
    enable_feedback = False
    feedback_emails = []

    def custom_settings(self):
        return (
            CustomSetting(
                name="s3_allowed_host",
                type=CustomSetting.TYPE_STRING,
                description="Allowed S3 host for proxy",
                required=True,
            ),
            CustomSetting(
                name="s3_bucket_url",
                type=CustomSetting.TYPE_STRING,
                description="Base S3 bucket URL",
                required=True,
            ),
            CustomSetting(
                name="s3_catalog_key",
                type=CustomSetting.TYPE_STRING,
                description="Path to catalog JSON",
                required=True,
            ),
            CustomSetting(
                name="s3_viz_tiles",
                type=CustomSetting.TYPE_STRING,
                description="Tile URL template",
                required=True,
            ),
        )

    @staticmethod
    def get_settings():
        """
        Helper to fetch settings safely from Tethys CustomSettings.
        """
        app = App.get_app()  # gets the singleton app instance
        return {
            "ALLOWED_HOST": app.get_custom_setting("s3_allowed_host"),
            "BUCKET_URL":   app.get_custom_setting("s3_bucket_url"),
            "CATALOG_KEY":  app.get_custom_setting("s3_catalog_key"),
            "VIZ_TILES":    app.get_custom_setting("s3_viz_tiles"),
        }