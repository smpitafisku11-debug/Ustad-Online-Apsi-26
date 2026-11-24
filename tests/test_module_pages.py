import unittest
import os
import tempfile

from app import app
from auth import init_auth_db


class ModulePageTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_database = app.config["AUTH_DATABASE"]
        self.original_admin_password = app.config.get("USTAD_ADMIN_PASSWORD")
        self.temp_directory = tempfile.TemporaryDirectory()
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_directory.name, "test_users.sqlite3")
        init_auth_db(app.config["AUTH_DATABASE"])
        self.addCleanup(self.temp_directory.cleanup)
        self.addCleanup(self._restore_auth_config)
        self.client = app.test_client()

    def _restore_auth_config(self):
        app.config["AUTH_DATABASE"] = self.original_database
        app.config["USTAD_ADMIN_PASSWORD"] = self.original_admin_password

    def test_ai_tahsin_and_community_routes_render(self):
        for path, title in (
            ("/ai-tahsin", b"AI Tahsin"),
            ("/komunitas", b"Komunitas"),
            ("/quran-battle", b"Quran Battle Arena"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(title, response.data)

    def test_home_links_to_new_modules(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="account-login-dialog"', response.data)
        self.assertIn(b'id="profile-dialog"', response.data)
        self.assertIn(b'data-profile-open', response.data)
        self.assertIn(b'data-account-role="student"', response.data)
        self.assertIn(b'data-account-role="teacher"', response.data)
        for expected in (
            b"Profil &amp; Perjalanan Belajar",
            b'data-gamification-xp',
            b'data-gamification-streak',
            b'data-gamification-missions',
            b'data-achievement="daily-finish"',
            b"bukan ukuran keimanan",
            b"+10 EXP",
        ):
            self.assertIn(expected, response.data)
        for href in (
            b'href="/battle"',
            b'href="/tahsin"',
            b'href="/komunitas"',
            b'href="/tilawah"',
            b'href="/baca"',
            b'href="/connect"',
            b'href="/tahfidz"',
        ):
            self.assertIn(href, response.data)
        for href in (
            b'href="/baca" class="menu-card',
            b'href="/tilawah" class="menu-card',
            b'href="/tahsin" class="menu-card',
            b'href="/connect" class="menu-card',
            b'href="/tahfidz" class="menu-card',
            b'href="/battle" class="menu-card',
            b'href="/komunitas" class="menu-card',
        ):
            self.assertIn(href, response.data)
        self.assertIn(b'href="/tilawah" class="flex min-h-11', response.data)

    def test_baca_quran_route_opens_reader_from_home_template(self):
        response = self.client.get("/baca-quran")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<title>Baca Al-Qur&#39;an | Ustad Online</title>", response.data)
        self.assertIn(b"quranLibraryModal.showModal();", response.data)

    def test_ustad_connect_route_renders_guidance_page(self):
        response = self.client.get("/ustad-connect")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Ustad Connect", response.data)
        self.assertIn(b'href="/komunitas#discussion-form"', response.data)

    def test_routes_from_supplied_app_example_are_available(self):
        for path, content in (
            ("/baca", b"Daftar Surah Al-Qur'an"),
            ("/tilawah", b"Akademi Tilawah"),
            ("/tahsin", b"AI Tahsin"),
            ("/tahfidz", b"Tahfidz &amp; Murajaah"),
            ("/battle", b"Quran Battle Arena"),
            ("/connect", b"Ustad Connect"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(content, response.data)

    def test_tilawah_academy_has_seven_modules_levels_and_evaluation(self):
        response = self.client.get("/tilawah")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b'data-learning-level="pemula"',
            b'data-learning-level="menengah"',
            b'data-learning-level="lanjutan"',
            b'data-lesson-id="hijaiyah"',
            b'data-lesson-id="harakat"',
            b'data-lesson-id="makharij"',
            b'data-lesson-id="sifat"',
            b'data-lesson-id="tajwid"',
            b'data-lesson-id="waqaf"',
            b'data-lesson-id="evaluasi"',
            b'id="quiz-dialog"',
            b'id="lesson-dialog"',
        ):
            self.assertIn(expected, response.data)
        script = self.client.get("/static/tilawah.js")
        self.assertEqual(script.status_code, 200)
        self.assertIn(b"speechSynthesis", script.data)
        script.close()

    def test_quran_battle_has_requested_modes_and_socket_events(self):
        response = self.client.get("/quran-battle")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b'data-mode-card="tajwid-battle"',
            b'data-mode-card="sambung-surat"',
            b'data-mode-card="nama-surat"',
            b"Mulai Lomba Solo",
            b"join_room",
            b"submit_score",
            b"battle_result",
        ):
            self.assertIn(expected, response.data)

    def test_student_cannot_log_in_as_ustad_or_change_role(self):
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/register",
            json={
                "role": "student",
                "name": "Siswa Uji",
                "email": "siswa@example.test",
                "password": "rahasia-123",
            },
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.json["user"]["role"], "student")

        csrf_token = response.json["csrf_token"]
        response = self.client.post(
            "/api/auth/login",
            json={"role": "teacher", "email": "siswa@example.test", "password": "rahasia-123"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 403)

        response = self.client.post(
            "/api/auth/profile",
            json={"name": "Siswa Uji", "username": "", "bio": "", "role": "teacher"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["user"]["role"], "student")

    def test_teacher_application_requires_admin_approval(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "test-admin-password"
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/register",
            json={
                "role": "teacher",
                "name": "Ustad Uji",
                "email": "ustad@example.test",
                "password": "rahasia-123",
                "phone": "081234567890",
                "experience": "Mengajar tahsin selama tiga tahun.",
            },
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 202)
        self.assertEqual(response.json["status"], "pending")
        self.assertIn("admin", response.json["message"])

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/login",
            json={"role": "teacher", "email": "ustad@example.test", "password": "rahasia-123"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 403)
        self.assertEqual(response.json["status"], "pending")

        self.assertEqual(self.client.get("/review/teachers").status_code, 200)
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        self.client.post("/review/login", data={"password": "test-admin-password", "csrf_token": csrf_token})
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        self.client.post(
            "/review/teachers/1",
            data={"decision": "approved", "csrf_token": csrf_token},
            follow_redirects=True,
        )

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/login",
            json={"role": "teacher", "email": "ustad@example.test", "password": "rahasia-123"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["user"]["role"], "teacher")


if __name__ == "__main__":
    unittest.main()
