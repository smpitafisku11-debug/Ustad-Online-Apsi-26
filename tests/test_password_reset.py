import os
import re
import sqlite3
import tempfile
import time
import unittest
from unittest.mock import patch

from app import app
from auth import init_auth_db
from werkzeug.security import check_password_hash, generate_password_hash


class PasswordResetTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_config = {
            key: app.config.get(key)
            for key in ("AUTH_DATABASE", "PUBLIC_BASE_URL", "SMTP_USERNAME", "SMTP_APP_PASSWORD", "SMTP_FROM_EMAIL")
        }
        self.temp_directory = tempfile.TemporaryDirectory()
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_directory.name, "password_reset.sqlite3")
        app.config["PUBLIC_BASE_URL"] = "https://ustad.example"
        app.config["SMTP_USERNAME"] = "ustad@example.com"
        app.config["SMTP_APP_PASSWORD"] = "test-app-password"
        app.config["SMTP_FROM_EMAIL"] = ""
        init_auth_db(app.config["AUTH_DATABASE"])
        self.client = app.test_client()
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role, status)
            VALUES (?, ?, ?, ?, ?)
            """,
            ("Pengguna Uji", "pengguna@example.com", generate_password_hash("password-lama-123"), "student", "approved"),
        )
        connection.commit()
        connection.close()
        self.addCleanup(self._restore_config)
        self.addCleanup(self.temp_directory.cleanup)

    def _restore_config(self):
        app.config.update(self.original_config)

    def _csrf_token(self):
        with self.client.session_transaction() as session:
            return session["csrf_token"]

    def _request_reset(self, email="pengguna@example.com"):
        return self.client.post(
            "/auth/forgot-password",
            data={"email": email, "csrf_token": self._csrf_token()},
        )

    def _sent_token(self, smtp_instance):
        message = smtp_instance.send_message.call_args.args[0]
        html_body = message.get_body(("html",)).get_content()
        match = re.search(r"https://ustad\.example/auth/reset-password#([A-Za-z0-9_-]+)", html_body)
        self.assertIsNotNone(match)
        return match.group(1), message

    def test_generic_feedback_and_reset_email_contains_fragment_link(self):
        self.client.get("/auth/forgot-password")
        with patch("auth.smtplib.SMTP") as smtp_factory:
            smtp_instance = smtp_factory.return_value.__enter__.return_value
            unknown = self._request_reset("not-registered@example.com")
            known = self._request_reset()

        self.assertEqual(unknown.status_code, 200)
        self.assertEqual(known.status_code, 200)
        self.assertEqual(unknown.data, known.data)
        self.assertIn(b"Jika alamat email terdaftar", known.data)
        self.assertEqual(smtp_factory.call_count, 1)
        smtp_factory.assert_called_once_with("smtp.gmail.com", 587, timeout=15)
        smtp_instance.starttls.assert_called_once()
        smtp_instance.login.assert_called_once_with("ustad@example.com", "test-app-password")
        token, message = self._sent_token(smtp_instance)
        self.assertIn("Reset Password", message.get_body(("html",)).get_content())
        self.assertIn("15 menit", message.get_body(("html",)).get_content())
        self.assertNotIn("?token=", message.get_body(("html",)).get_content())
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        stored_hash = connection.execute(
            "SELECT token_hash FROM password_reset_tokens"
        ).fetchone()[0]
        connection.close()
        self.assertNotEqual(stored_hash, token)

    def test_token_expires_and_is_single_use_after_password_change(self):
        self.client.get("/auth/forgot-password")
        with patch("auth.smtplib.SMTP") as smtp_factory:
            smtp_instance = smtp_factory.return_value.__enter__.return_value
            self._request_reset()
        token, _ = self._sent_token(smtp_instance)
        reset_page = self.client.get("/auth/reset-password")
        self.assertEqual(reset_page.status_code, 200)
        csrf = self._csrf_token()

        invalid_csrf = self.client.post(
            "/auth/reset-password",
            data={"token": token, "password": "password-baru-123", "password_confirmation": "password-baru-123"},
        )
        self.assertEqual(invalid_csrf.status_code, 400)
        mismatch = self.client.post(
            "/auth/reset-password",
            data={
                "csrf_token": csrf,
                "token": token,
                "password": "password-baru-123",
                "password_confirmation": "password-tidak-sama",
            },
        )
        self.assertIn(b"Konfirmasi password tidak sama", mismatch.data)
        valid = self.client.post(
            "/auth/reset-password",
            data={
                "csrf_token": csrf,
                "token": token,
                "password": "password-baru-123",
                "password_confirmation": "password-baru-123",
            },
        )
        self.assertEqual(valid.status_code, 200)
        self.assertIn(b"Password berhasil diubah", valid.data)

        self.client.get("/api/auth/session")
        reuse = self.client.post(
            "/auth/reset-password",
            data={
                "csrf_token": self._csrf_token(),
                "token": token,
                "password": "password-lain-123",
                "password_confirmation": "password-lain-123",
            },
        )
        self.assertIn(b"sudah pernah digunakan", reuse.data)

        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        password_hash = connection.execute(
            "SELECT password_hash FROM users WHERE email = ?",
            ("pengguna@example.com",),
        ).fetchone()[0]
        connection.close()
        self.assertTrue(check_password_hash(password_hash, "password-baru-123"))
        self.assertFalse(check_password_hash(password_hash, "password-lama-123"))

        csrf = self.client.get("/api/auth/session").json["csrf_token"]
        old_login = self.client.post(
            "/api/auth/login",
            json={"role": "student", "email": "pengguna@example.com", "password": "password-lama-123"},
            headers={"X-CSRF-Token": csrf},
        )
        new_login = self.client.post(
            "/api/auth/login",
            json={"role": "student", "email": "pengguna@example.com", "password": "password-baru-123"},
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(old_login.status_code, 401)
        self.assertEqual(new_login.status_code, 200)
        self.assertEqual(new_login.json["user"]["role"], "student")

    def test_expired_token_offers_new_request_and_requests_are_limited(self):
        self.client.get("/auth/forgot-password")
        with patch("auth.smtplib.SMTP") as smtp_factory:
            smtp_instance = smtp_factory.return_value.__enter__.return_value
            self._request_reset()
            token, _ = self._sent_token(smtp_instance)

            connection = sqlite3.connect(app.config["AUTH_DATABASE"])
            connection.execute(
                "UPDATE password_reset_tokens SET created_at = ?",
                (int(time.time()) - 901,),
            )
            connection.commit()
            connection.close()

            expired = self.client.post(
                "/auth/reset-password/check",
                json={"token": token},
                headers={"X-CSRF-Token": self._csrf_token()},
            )
            self.assertEqual(expired.json["state"], "expired")

            for _ in range(2):
                response = self._request_reset()
                self.assertEqual(response.status_code, 200)
            limited = self._request_reset()
            self.assertEqual(limited.status_code, 200)
            self.assertEqual(response.data, limited.data)
            self.assertEqual(smtp_factory.call_count, 3)

if __name__ == "__main__":
    unittest.main()
