import os
import sqlite3
import tempfile
import unittest

from app import app
from auth import init_auth_db
from werkzeug.security import generate_password_hash


class LocalizationTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_database = app.config["AUTH_DATABASE"]
        self.temp_directory = tempfile.TemporaryDirectory()
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_directory.name, "localization.sqlite3")
        init_auth_db(app.config["AUTH_DATABASE"])
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("Pengguna Bahasa", "language@example.com", generate_password_hash("password-123"), "student", "approved"),
        )
        connection.commit()
        connection.close()
        self.client = app.test_client()
        self.addCleanup(self._restore_config)
        self.addCleanup(self.temp_directory.cleanup)

    def _restore_config(self):
        app.config["AUTH_DATABASE"] = self.original_database

    def test_language_setting_is_csrf_protected_and_survives_login_and_logout(self):
        current = self.client.get("/api/preferences/language")
        self.assertEqual(current.json["language"], "id")
        csrf = current.json["csrf_token"]

        rejected = self.client.post(
            "/api/preferences/language",
            json={"language": "ar"},
            headers={"X-CSRF-Token": "invalid"},
        )
        self.assertEqual(rejected.status_code, 400)

        saved = self.client.post(
            "/api/preferences/language",
            json={"language": "ar"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(saved.status_code, 200)

        login = self.client.post(
            "/api/auth/login",
            json={"role": "student", "email": "language@example.com", "password": "password-123"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(login.status_code, 200)
        current = self.client.get("/api/preferences/language")
        self.assertEqual(current.json["language"], "ar")

        logout = self.client.post(
            "/api/auth/logout",
            json={},
            headers={"X-CSRF-Token": current.json["csrf_token"]},
        )
        self.assertEqual(logout.status_code, 200)
        self.assertEqual(self.client.get("/api/preferences/language").json["language"], "ar")

    def test_language_endpoint_rejects_unknown_locale(self):
        csrf = self.client.get("/api/preferences/language").json["csrf_token"]
        invalid = self.client.post(
            "/api/preferences/language",
            json={"language": "fr"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_site_pages_load_the_shared_language_settings_and_catalog(self):
        for path in (
            "/",
            "/akademi",
            "/ai-tahsin",
            "/tahfidz",
            "/ustad-connect",
            "/quran-battle",
            "/komunitas",
            "/dzikir-doa",
            "/fitur",
            "/auth/forgot-password",
            "/auth/reset-password",
            "/review/teachers",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertIn(b"translations.js", response.data)
                self.assertIn(b"ui_customization.js", response.data)
        for asset in ("/static/translations.js", "/static/ui_customization.js", "/static/ui_customization.css"):
            with self.subTest(asset=asset):
                response = self.client.get(asset)
                self.assertEqual(response.status_code, 200)
                response.close()


if __name__ == "__main__":
    unittest.main()
