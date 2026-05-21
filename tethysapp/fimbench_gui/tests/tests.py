# Most of your test classes should inherit from TethysTestCase
from tethys_sdk.testing import TethysTestCase
from unittest.mock import patch, MagicMock

# For testing rendered HTML templates it may be helpful to use BeautifulSoup.
# from bs4 import BeautifulSoup
# For help, see https://www.crummy.com/software/BeautifulSoup/bs4/doc/


"""
To run tests for an app:

    1. In portal_config.yml make sure that the default database user is set to tethys_super or is a super user of the database
        DATABASES:
            default:
                ENGINE: django.db.backends.postgresql_psycopg2
                NAME: tethys_platform
                USER: tethys_super
                PASSWORD: pass
                HOST: 127.0.0.1
                PORT: 5435

    2. From the root directory of your app, run the ``tethys manage test`` command::

        tethys manage test tethysapp/<app_name>/tests


To learn more about writing tests, see:
    https://docs.tethysplatform.org/en/stable/tethys_sdk/testing.html
"""

class TestCase(TethysTestCase):
    """
    In this class you may define as many functions as you'd like to test different aspects of your app.
    Each function must start with the word "test" for it to be recognized and executed during testing.
    You could also create multiple TethysTestCase classes within this or other python files to organize your tests.
    """

    def set_up(self):
        """
        This function is not required, but can be used if any environmental setup needs to take place before
        execution of each test function. Thus, if you have multiple test that require the same setup to run,
        place that code here. For example, if you are testing against any persistent stores, you should call the
        test database creation function here, like so:

            self.create_test_persistent_stores_for_app()

        If you are testing against a controller that check for certain user info, you can create a fake test user and
        get a test client, like so:

            #The test client simulates a browser that can navigate your app's url endpoints
            self.c = self.get_test_client()
            self.user = self.create_test_user(username="joe", password="secret", email="joe@some_site.com")
            # To create a super_user, use "self.create_test_superuser(*params)" with the same params

            # To force a login for the test user
            self.c.force_login(self.user)

            # If for some reason you do not want to force a login, you can use the following:
            login_success = self.c.login(username="joe", password="secret")

        NOTE: You do not have place these functions here, but if they are not placed here and are needed
        then they must be placed at the beginning of your individual test functions. Also, if a certain
        setup does not apply to all of your functions, you should either place it directly in each
        function it applies to, or maybe consider creating a new test file or test class to group similar
        tests.
        """
        pass

    def tear_down(self):
        """
        This function is not required, but should be used if you need to tear down any environmental setup
        that took place before execution of the test functions. If you are testing against any persistent
        stores, you should call the test database destruction function from here, like so:

            self.destroy_test_persistent_stores_for_app()

        NOTE: You do not have to set these functions up here, but if they are not placed here and are needed
        then they must be placed at the very end of your individual test functions. Also, if certain
        tearDown code does not apply to all of your functions, you should either place it directly in each
        function it applies to, or maybe consider creating a new test file or test class to group similar
        tests.
        """
        pass

    def is_tethys_platform_great(self):
        return True

    def test_if_tethys_platform_is_great(self):
        """
        This is an example test function that can be modified to test a specific aspect of your app.
        It is required that the function name begins with the word "test" or it will not be executed.
        Generally, the code written here will consist of many assert methods.
        A list of assert methods is included here for reference or to get you started:
            assertEqual(a, b)           a == b
            assertNotEqual(a, b)        a != b
            assertTrue(x)              bool(x) is True
            assertFalse(x)              bool(x) is False
            assertIs(a, b)              a is b
            assertIsNot(a, b)           a is not b
            assertIsNone(x)             x is None
            assertIsNotNone(x)          x is not None
            assertIn(a, b)              a in b
            assertNotIn(a, b)           a not in b
            assertIsInstance(a, b)      isinstance(a, b)
            assertNotIsInstance(a, b)   !isinstance(a, b)
        Learn more about assert methods here:
            https://docs.python.org/2.7/library/unittest.html#assert-methods
        """

        self.assertEqual(self.is_tethys_platform_great(), True)
        self.assertNotEqual(self.is_tethys_platform_great(), False)
        self.assertTrue(self.is_tethys_platform_great())
        self.assertFalse(not self.is_tethys_platform_great())
        self.assertIs(self.is_tethys_platform_great(), True)
        self.assertIsNot(self.is_tethys_platform_great(), False)

    def test_tile_proxy_rejects_nonnumeric_z(self):
        c = self.get_test_client()
        user = self.create_test_user(username="tp1", password="pass", email="tp1@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/abc/0/0.pbf')
        self.assertEqual(response.status_code, 400)

    def test_tile_proxy_rejects_nonnumeric_x(self):
        c = self.get_test_client()
        user = self.create_test_user(username="tp2", password="pass", email="tp2@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/0/abc/0.pbf')
        self.assertEqual(response.status_code, 400)

    def test_tile_proxy_rejects_nonnumeric_y(self):
        c = self.get_test_client()
        user = self.create_test_user(username="tp3", password="pass", email="tp3@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/0/0/abc.pbf')
        self.assertEqual(response.status_code, 400)

    def test_tile_proxy_rejects_path_traversal(self):
        c = self.get_test_client()
        user = self.create_test_user(username="tp4", password="pass", email="tp4@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/0%2F..%2F..%2Fetc/0/0.pbf')
        self.assertEqual(response.status_code, 400)

    @patch('tethysapp.fimbench_gui.controllers.requests.get')
    def test_tile_proxy_valid_coordinates_proxied(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 200
        mock_resp.headers = {}
        mock_resp.raw.read.return_value = b'\x1f\x8b'  # gzip magic bytes
        mock_get.return_value = mock_resp

        c = self.get_test_client()
        user = self.create_test_user(username="tp5", password="pass", email="tp5@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/8/72/96.pbf')

        mock_get.assert_called_once()
        called_url = mock_get.call_args[0][0]
        self.assertIn('/8/72/96.pbf', called_url)
        self.assertEqual(response.status_code, 200)

    @patch('tethysapp.fimbench_gui.controllers.requests.get')
    def test_tile_proxy_404_upstream_returns_204(self, mock_get):
        mock_resp = MagicMock()
        mock_resp.status_code = 404
        mock_get.return_value = mock_resp

        c = self.get_test_client()
        user = self.create_test_user(username="tp6", password="pass", email="tp6@test.com")
        c.force_login(user)
        response = c.get('/apps/fimbench-gui/tile-proxy/8/72/96.pbf')

        self.assertEqual(response.status_code, 204)

    def test_home_controller(self):
        """
        This is an example test function of how you might test a controller that returns an HTML template rendered
        with context variables.
        """

        # If all test functions were testing controllers or required a test client for another reason, the following
        # 3 lines of code could be placed once in the set_up function. Note that in that case, each variable should be
        # prepended with "self." (i.e. self.c = ...) to make those variables "global" to this test class and able to be
        # used in each separate test function.
        c = self.get_test_client()
        user = self.create_test_user(username="joe", password="secret", email="joe@some_site.com")
        c.force_login(user)

        # Have the test client "browse" to your home page
        response = c.get('/apps/fimbench-gui/')  # The final '/' is essential for all pages/controllers

        # Test that the request processed correctly (with a 200 status code)
        self.assertEqual(response.status_code, 200)

        '''
        NOTE: Next, you would likely test that your context variables returned as expected. That would look
        something like the following:

        context = response.context
        self.assertEqual(context['my_integer'], 10)
        '''