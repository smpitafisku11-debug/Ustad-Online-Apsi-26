import unittest
import os
import sqlite3
import tempfile
from unittest.mock import patch

from app import app, _load_admin_password
from auth import init_auth_db
from connect import init_connect_db
from werkzeug.security import check_password_hash


class ModulePageTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_database = app.config["AUTH_DATABASE"]
        self.original_admin_password = app.config.get("USTAD_ADMIN_PASSWORD")
        self.original_admin_username = app.config.get("USTAD_ADMIN_USERNAME")
        self.original_session_cookie_secure = app.config.get("SESSION_COOKIE_SECURE")
        app.config["SESSION_COOKIE_SECURE"] = False
        app.config["USTAD_ADMIN_USERNAME"] = "FAMDI_Admin"
        self.temp_directory = tempfile.TemporaryDirectory()
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_directory.name, "test_users.sqlite3")
        init_auth_db(app.config["AUTH_DATABASE"])
        init_connect_db(app.config["AUTH_DATABASE"])
        self.addCleanup(self.temp_directory.cleanup)
        self.addCleanup(self._restore_auth_config)
        self.client = app.test_client()

    def _restore_auth_config(self):
        app.config["AUTH_DATABASE"] = self.original_database
        app.config["USTAD_ADMIN_PASSWORD"] = self.original_admin_password
        app.config["USTAD_ADMIN_USERNAME"] = self.original_admin_username
        app.config["SESSION_COOKIE_SECURE"] = self.original_session_cookie_secure

    def test_ai_tahsin_and_community_routes_render(self):
        for path, title in (
            ("/ai-tahsin", b"Latihan Pelafalan"),
            ("/komunitas", b"Komunitas"),
            ("/quran-battle", b"Quran Battle Arena"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(title, response.data)
        self.assertIn(b"Latihan Pelafalan", self.client.get("/ai-tahsin").data)
        legacy_redirect = self.client.get("/tahsin")
        self.assertEqual(legacy_redirect.status_code, 302)
        self.assertIn("/tilawah", legacy_redirect.headers["Location"])
        tahsin = self.client.get("/ai-tahsin")
        self.assertIn(b"Cakupan pemeriksaan dasar", tahsin.data)
        self.assertIn(b"quran.kemenag.go.id", tahsin.data)
        self.assertIn(b"Cari ustad untuk koreksi makhraj", tahsin.data)

    def test_home_links_to_new_modules(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="account-login-dialog"', response.data)
        self.assertIn(b'id="profile-dialog"', response.data)
        self.assertIn(b'data-profile-open', response.data)
        self.assertIn(b'data-account-role="student"', response.data)
        self.assertIn(b'data-account-role="teacher"', response.data)
        self.assertIn(b'data-account-role="admin"', response.data)
        self.assertIn(b'id="profile-switch-account"', response.data)
        self.assertNotIn(b"Masuk Demo Siswa", response.data)
        self.assertNotIn(b"Masuk Demo Ustad", response.data)
        self.assertIn(b'id="ui-language-select"', response.data)
        for language in (
            b'value="id" lang="id">Bahasa Indonesia',
            b'value="en" lang="en">English',
            b'value="ar" lang="ar" dir="rtl">\xd8\xa7\xd9\x84\xd8\xb9\xd8\xb1\xd8\xa8\xd9\x8a\xd8\xa9',
        ):
            self.assertIn(language, response.data)
        for expected in (
            b"Profil &amp; Dashboard Perkembangan",
            b'data-gamification-xp',
            b'data-gamification-streak',
            b'data-gamification-missions',
            b'data-achievement="daily-finish"',
            b"bukan ukuran keimanan",
            b"+10 EXP",
            b'data-week-chart',
            b'data-week-offset="6"',
            b'data-mission-history',
            b'data-learning-history',
            b'data-profile-target-count',
            b'data-profile-recommendation',
            b'data-reflection-note',
            b'data-save-reflection',
            b'pengajar atau orang tua',
            b'tidak tersinkron antarperangkat',
        ):
            self.assertIn(expected, response.data)
        for href in (
            b'href="/battle"',
            b'href="/komunitas"',
            b'href="/tilawah"',
            b'href="/baca"',
            b'href="/connect"',
            b'href="/tahfidz"',
            b'href="/dzikir-doa"',
        ):
            self.assertIn(href, response.data)
        for href in (
            b'href="/baca" class="menu-card',
            b'href="/tilawah" class="menu-card',
            b'href="/connect" class="menu-card',
            b'href="/tahfidz" class="menu-card',
            b'href="/battle" class="menu-card',
            b'href="/komunitas" class="menu-card',
            b'href="/dzikir-doa" class="menu-card',
        ):
            self.assertIn(href, response.data)
        self.assertIn(b'href="/tilawah" class="flex min-h-11', response.data)

    def test_home_includes_interactive_qibla_compass(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="qibla-button"', response.data)
        self.assertIn(b'id="qibla-dialog"', response.data)
        self.assertIn(b'aria-label="Kompas arah kiblat"', response.data)
        self.assertIn(b"Saat kompas dibuka, lokasi dan sensor arah akan dimulai otomatis", response.data)
        self.assertIn(b"Perbarui lokasi", response.data)
        for path in ("/static/qibla.css", "/static/qibla.js"):
            asset = self.client.get(path)
            self.assertEqual(asset.status_code, 200)
            asset.close()
        script = self.client.get("/static/qibla.js")
        self.assertIn(b"getQiblaBearing", script.data)
        self.assertIn(b"getCurrentPosition", script.data)
        normalized_script = script.data.replace(b"\r\n", b"\n")
        self.assertIn(b"dialog.showModal();\n            findQibla();", normalized_script)
        script.close()

    def test_quran_reader_has_mellow_background_choices_and_volume_settings(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b'id="ambience-select"', response.data)
        self.assertIn(b'value="off">Tanpa suara latar', response.data)
        self.assertIn(b'value="rain">Hujan lembut', response.data)
        self.assertIn(b'value="wind">Angin sepoi-sepoi', response.data)
        self.assertIn(b'value="waves">Ombak tenang', response.data)
        self.assertIn(b'id="ambience-volume"', response.data)
        self.assertIn(b'id="ambience-status"', response.data)
        self.assertLess(
            response.data.index(b'for="reciter-select"'),
            response.data.index(b'for="ambience-select"'),
        )
        self.assertIn(b'createAmbienceBuffer', response.data)
        self.assertIn(b'lowpass', response.data)
        self.assertIn(b'ustadOnline.quranReader.ambience.v1', response.data)

    def test_baca_quran_route_opens_reader_from_home_template(self):
        response = self.client.get("/baca-quran")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<title>Baca Al-Qur&#39;an | Ustad Online</title>", response.data)
        self.assertIn(b"quranLibraryModal.showModal();", response.data)
        for expected in (
            b'id="quran-book-viewer"',
            b'id="quran-translation-verses"',
            b'id="quran-arabic-verses"',
            b'id="reader-juz-select"',
            b'id="reader-bookmark"',
            b'id="reader-theme-toggle"',
            b'id="reader-audio-toggle"',
            b'id="reader-page-indicator"',
            b"window.QuranBookViewer.openSurah(surah.number)",
        ):
            self.assertIn(expected, response.data)
        for path in ("/static/quran_book_viewer.css", "/static/quran_book_viewer.js"):
            asset = self.client.get(path)
            self.assertEqual(asset.status_code, 200)
            asset.close()

    def test_account_storage_namespace_isolated_per_user(self):
        clients = [app.test_client(), app.test_client()]
        account_ids = []
        for index, client in enumerate(clients):
            csrf_token = client.get("/api/auth/session").json["csrf_token"]
            response = client.post(
                "/api/auth/register",
                json={
                    "role": "student",
                    "name": f"Siswa Baru {index}",
                    "email": f"siswa-baru-{index}@example.test",
                    "password": "rahasia-123",
                },
                headers={"X-CSRF-Token": csrf_token},
            )
            self.assertEqual(response.status_code, 201)
            with client.session_transaction() as browser_session:
                account_ids.append(browser_session["user_id"])

        self.assertNotEqual(account_ids[0], account_ids[1])
        for client, account_id in zip(clients, account_ids):
            page = client.get("/")
            self.assertIn(f"let accountId = {account_id};".encode(), page.data)

    def test_ustad_connect_route_renders_guidance_page(self):
        response = self.client.get("/ustad-connect")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Ustad Connect", response.data)
        for expected in (
            b'data-search-form',
            b'data-teacher-dashboard',
            b'data-booking-form',
            b'data-report-form',
            b"orang tua/wali",
            b"panggilan audio/video",
        ):
            self.assertIn(expected, response.data)
        self.assertIn(b"connect.css", response.data)
        self.assertIn(b"connect.js", response.data)
        for asset in ("/static/connect.css", "/static/connect.js", "/static/connect_admin.js"):
            asset_response = self.client.get(asset)
            self.assertEqual(asset_response.status_code, 200)
            asset_response.close()
        service_worker = self.client.get("/static/service-worker.js")
        self.assertIn(b"'/connect'", service_worker.data)
        self.assertIn(b"'/static/connect.js'", service_worker.data)
        service_worker.close()

    def test_teacher_dashboard_is_hidden_from_students_and_role_restricted(self):
        student = app.test_client()
        student_token = student.get("/api/auth/session").json["csrf_token"]
        registered = student.post(
            "/api/auth/register",
            json={
                "role": "student",
                "name": "Siswa Dashboard",
                "email": "dashboard-student@example.test",
                "password": "rahasia-123",
            },
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(registered.status_code, 201)

        denied = student.get("/ustad-dashboard")
        self.assertEqual(denied.status_code, 403)
        denied_profile = student.post(
            "/api/connect/profile",
            json={
                "method": "tajwid",
                "expertise": "Mengajar tajwid dasar untuk pemula.",
                "modes": ["chat"],
                "fee": 10000,
                "duration": 30,
            },
            headers={"X-CSRF-Token": registered.json["csrf_token"]},
        )
        self.assertEqual(denied_profile.status_code, 403)

        teacher = app.test_client()
        teacher_token = teacher.get("/api/auth/session").json["csrf_token"]
        application = teacher.post(
            "/api/auth/register",
            json={
                "role": "teacher",
                "name": "Ustad Dashboard",
                "email": "dashboard-teacher@example.test",
                "password": "rahasia-123",
                "phone": "081234567890",
                "experience": "Mengajar tilawah dan tajwid selama lima tahun.",
            },
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(application.status_code, 202)

        import sqlite3
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            teacher_id = connection.execute(
                "SELECT id FROM users WHERE email = ?",
                ("dashboard-teacher@example.test",),
            ).fetchone()[0]
            connection.execute("UPDATE users SET status = 'approved' WHERE id = ?", (teacher_id,))
            connection.execute(
                """
                INSERT INTO connect_teacher_verifications
                    (teacher_id, identity_checked, competence_checked, verified_by)
                VALUES (?, 1, 1, 'test')
                """,
                (teacher_id,),
            )
            connection.commit()
        finally:
            connection.close()

        login_token = teacher.get("/api/auth/session").json["csrf_token"]
        login = teacher.post(
            "/api/auth/login",
            json={
                "role": "teacher",
                "email": "dashboard-teacher@example.test",
                "password": "rahasia-123",
            },
            headers={"X-CSRF-Token": login_token},
        )
        self.assertEqual(login.status_code, 200)
        dashboard = teacher.get("/ustad-dashboard")
        self.assertEqual(dashboard.status_code, 200)
        for expected in (
            b"KHUSUS AKUN USTAD",
            b"Permintaan siswa",
            b"Kelola jadwal mengajar",
            b"Kelola profil Ustad Connect",
            b"Evaluasi selesai",
            b"ustad_dashboard.js",
        ):
            self.assertIn(expected, dashboard.data)

        home = student.get("/")
        self.assertIn(b'data-teacher-feature hidden', home.data)
        self.assertIn(b"Panel Ustad", home.data)
        dashboard_service_worker = self.client.get("/static/service-worker.js")
        self.assertNotIn(b"'/ustad-dashboard'", dashboard_service_worker.data)
        self.assertIn(b"'/static/ustad_dashboard.js'", dashboard_service_worker.data)
        dashboard_service_worker.close()

    def test_admin_can_preview_student_and_teacher_modes_without_teacher_access(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "test-admin-password"
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        invalid = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "wrong-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(invalid.status_code, 401)

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        login = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "test-admin-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(login.status_code, 200)
        self.assertEqual(login.json["user"]["role"], "admin")
        self.assertEqual(self.client.get("/api/auth/session").json["user"]["role"], "admin")

        home = self.client.get("/")
        self.assertIn(b'data-admin-feature hidden', home.data)
        preview = self.client.get("/ustad-dashboard")
        self.assertEqual(preview.status_code, 200)
        for expected in (
            b"data-admin-preview=\"true\"",
            b"Mode pratinjau Admin",
            b"Data permintaan hanya tersedia",
            b"Panel Admin",
        ):
            self.assertIn(expected, preview.data)
        self.assertNotIn(b'data-dashboard-profile-form', preview.data)
        self.assertNotIn(b'data-dashboard-availability', preview.data)
        self.assertEqual(self.client.get("/api/connect/me").status_code, 401)
        self.assertEqual(self.client.get("/review/teachers").status_code, 200)

    def test_connect_booking_evaluation_moderation_and_safety(self):
        student = app.test_client()
        teacher = app.test_client()

        def register(client, role, name, email):
            token = client.get("/api/auth/session").json["csrf_token"]
            return client.post(
                "/api/auth/register",
                json={
                    "role": role,
                    "name": name,
                    "email": email,
                    "password": "rahasia-123",
                    "phone": "081234567890" if role == "teacher" else "",
                    "experience": "Mengajar tilawah untuk pemula lebih dari tiga tahun." if role == "teacher" else "",
                },
                headers={"X-CSRF-Token": token},
            )

        student_registration = register(student, "student", "Siswa Connect", "connect-student@example.test")
        teacher_registration = register(teacher, "teacher", "Ustad Connect", "connect-teacher@example.test")
        self.assertEqual(student_registration.status_code, 201)
        self.assertEqual(teacher_registration.status_code, 202)

        import sqlite3
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            teacher_id = connection.execute(
                "SELECT id FROM users WHERE email = ?",
                ("connect-teacher@example.test",),
            ).fetchone()[0]
            connection.execute("UPDATE users SET status = 'approved' WHERE id = ?", (teacher_id,))
            connection.execute(
                """
                INSERT INTO connect_teacher_verifications
                    (teacher_id, identity_checked, competence_checked, verified_by)
                VALUES (?, 1, 1, 'test')
                """,
                (teacher_id,),
            )
            connection.commit()
        finally:
            connection.close()

        teacher_token = teacher.get("/api/auth/session").json["csrf_token"]
        login = teacher.post(
            "/api/auth/login",
            json={"role": "teacher", "email": "connect-teacher@example.test", "password": "rahasia-123"},
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(login.status_code, 200)
        teacher_token = login.json["csrf_token"]
        profile = teacher.post(
            "/api/connect/profile",
            json={
                "method": "tajwid",
                "expertise": "Tajwid dasar dan makharijul huruf untuk pemula.",
                "modes": ["audio", "video"],
                "fee": 25000,
                "duration": 30,
            },
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(profile.status_code, 200)
        self.assertEqual(teacher.post(
            "/api/connect/profile",
            json={
                "method": "tajwid", "expertise": "Tajwid dasar dan makharijul huruf untuk pemula.",
                "modes": ["audio"], "fee": 25000, "duration": 30,
            },
        ).status_code, 400)

        from datetime import datetime, timedelta, timezone
        starts = datetime.now(timezone.utc).replace(second=0, microsecond=0) + timedelta(days=2)
        ends = starts + timedelta(minutes=30)
        availability = teacher.post(
            "/api/connect/availability",
            json={"starts_at": starts.isoformat(), "ends_at": ends.isoformat()},
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(availability.status_code, 201)
        slot_id = teacher.get("/api/connect/me").json["slots"][0]["id"]

        listings = student.get(
            "/api/connect/teachers?q=makharij&method=tajwid&mode=video&max_fee=25000&available=1"
        )
        self.assertEqual(listings.status_code, 200)
        self.assertEqual(listings.json["teachers"][0]["id"], teacher_id)
        self.assertEqual(
            listings.json["teachers"][0]["experience"],
            "Tajwid dasar dan makharijul huruf untuk pemula.",
        )
        self.assertNotIn("email", listings.json["teachers"][0])
        self.assertNotIn("phone", listings.json["teachers"][0])

        student_token = student.get("/api/auth/session").json["csrf_token"]
        incomplete = student.post(
            "/api/connect/bookings",
            json={"slot_id": slot_id, "mode": "video", "guardian_acknowledged": False},
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(incomplete.status_code, 400)
        booked = student.post(
            "/api/connect/bookings",
            json={"slot_id": slot_id, "mode": "video", "guardian_acknowledged": True},
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(booked.status_code, 201)
        self.assertEqual(booked.json["status"], "requested")
        duplicate = student.post(
            "/api/connect/bookings",
            json={"slot_id": slot_id, "mode": "audio", "guardian_acknowledged": True},
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(duplicate.status_code, 409)

        booking_id = booked.json["booking_id"]
        teacher_booking = teacher.post(
            f"/api/connect/bookings/{booking_id}/status",
            json={"action": "confirm"},
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(teacher_booking.status_code, 200)
        completed = teacher.post(
            f"/api/connect/bookings/{booking_id}/status",
            json={"action": "complete", "evaluation": "Latihan makharij dan hukum nun sukun berikutnya."},
            headers={"X-CSRF-Token": teacher_token},
        )
        self.assertEqual(completed.status_code, 200)
        self.assertEqual(student.get("/api/connect/bookings").json["bookings"][0]["mode"], "video")

        review = student.post(
            "/api/connect/reviews",
            json={"booking_id": booking_id, "rating": 5, "comment": "Materi dijelaskan dengan jelas."},
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(review.status_code, 201)
        self.assertEqual(student.get("/api/connect/teachers").json["teachers"][0]["reviews"], [])
        starts_again = starts + timedelta(days=3)
        ends_again = starts_again + timedelta(minutes=30)
        self.assertEqual(teacher.post(
            "/api/connect/availability",
            json={"starts_at": starts_again.isoformat(), "ends_at": ends_again.isoformat()},
            headers={"X-CSRF-Token": teacher_token},
        ).status_code, 201)
        available_slot = next(
            slot for slot in teacher.get("/api/connect/me").json["slots"]
            if slot["status"] == "available"
        )
        second_booking = student.post(
            "/api/connect/bookings",
            json={
                "slot_id": available_slot["id"],
                "mode": "audio",
                "guardian_acknowledged": True,
            },
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(second_booking.status_code, 201)
        cancelled = student.post(
            f"/api/connect/bookings/{second_booking.json['booking_id']}/status",
            json={"action": "cancel"},
            headers={"X-CSRF-Token": student_token},
        )
        self.assertEqual(cancelled.status_code, 200)
        open_slots = student.get("/api/connect/teachers").json["teachers"][0]["slots"]
        self.assertIn(available_slot["id"], [slot["id"] for slot in open_slots])
        self.assertEqual(student.post(
            "/api/connect/reports",
            json={"booking_id": booking_id, "reason": "safety", "details": "Perlu ditinjau admin."},
            headers={"X-CSRF-Token": student_token},
        ).status_code, 201)

        self.assertEqual(teacher.get("/api/connect/admin/moderation").status_code, 403)
        admin_token = "moderation-test-token"
        with teacher.session_transaction() as admin_session:
            admin_session["admin_authenticated"] = True
            admin_session["csrf_token"] = admin_token
        queue = teacher.get("/api/connect/admin/moderation")
        self.assertEqual(len(queue.json["reviews"]), 1)
        self.assertEqual(len(queue.json["reports"]), 1)
        moderated = teacher.post(
            f"/api/connect/admin/moderation/reviews/{queue.json['reviews'][0]['id']}",
            json={"decision": "approve"},
            headers={"X-CSRF-Token": admin_token},
        )
        self.assertEqual(moderated.status_code, 200)
        self.assertEqual(len(student.get("/api/connect/teachers").json["teachers"][0]["reviews"]), 1)
        report_id = queue.json["reports"][0]["id"]
        moderated_report = teacher.post(
            f"/api/connect/admin/moderation/reports/{report_id}",
            json={"decision": "approve"},
            headers={"X-CSRF-Token": admin_token},
        )
        self.assertEqual(moderated_report.status_code, 200)

    def test_additional_feature_routes_render_all_feature_sections(self):
        for path in ("/fitur", "/fitur-tambahan", "/pengaturan", "/pusat-bantuan"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"Fitur Tambahan", response.data)
        response = self.client.get("/fitur")
        for expected in (
            b"Pengingat Waktu Belajar",
            b"Hemat Data &amp; Materi Offline",
            b"Bookmark &amp; Catatan",
            b"Teks &amp; Aksesibilitas",
            b"Pengingat Jadwal Kelas",
            b"Sertifikat Kegiatan",
            b"Pelaporan Konten",
            b"Dukungan Orang Tua",
            b"Hafalan Planner",
            b"Pusat Bantuan",
        ):
            self.assertIn(expected, response.data)

    def test_routes_from_supplied_app_example_are_available(self):
        for path, content in (
            ("/baca", b"Daftar Surah Al-Qur'an"),
            ("/tilawah", b"Akademi Tilawah"),
            ("/ai-tahsin", b"Latihan Pelafalan"),
            ("/tahfidz", b"Tahfidz &amp; Murajaah"),
            ("/dzikir-doa", b"Dzikir &amp; Doa"),
            ("/battle", b"Quran Battle Arena"),
            ("/connect", b"Ustad Connect"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(content, response.data)

    def test_dzikir_doa_page_has_daily_categories_and_progress(self):
        response = self.client.get("/dzikir-doa")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b"Al-Ma\xe2\x80\x99tsurat",
            b"Setelah salat",
            b"Doa harian",
            b"daily-progress",
            b"dzikir_doa.js",
        ):
            self.assertIn(expected, response.data)
        script = self.client.get("/static/dzikir_doa.js")
        self.assertEqual(script.status_code, 200)
        for expected in (b"Doa untuk kedua orang tua", b"HR. Muslim 591", b"Surah Al-Isra"):
            self.assertIn(expected, script.data)
        script.close()

    def test_tilawah_academy_has_seven_modules_levels_and_evaluation(self):
        response = self.client.get("/tilawah")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b"Sumber rujukan materi",
            b"quran.kemenag.go.id",
            b"Cari ustad untuk koreksi langsung",
            b'data-learning-level="pemula"',
            b'data-learning-level="menengah"',
            b'data-learning-level="lanjutan"',
            b'data-lesson-id="hijaiyah"',
            b'data-lesson-id="harakat"',
            b'data-lesson-id="makharij"',
            b'data-lesson-id="sifat"',
            b'data-lesson-id="tajwid"',
            b'data-lesson-id="waqaf"',
            b'id="latihan-pelafalan"',
            b'data-lesson-id="evaluasi"',
            b'id="quiz-dialog"',
            b'id="lesson-dialog"',
        ):
            self.assertIn(expected, response.data)
        script = self.client.get("/static/tilawah.js")
        self.assertEqual(script.status_code, 200)
        self.assertIn(b"equran.id/api/v2/surat/1", script.data)
        self.assertIn(b"Misyari Rasyid Al-Afasi", script.data)
        self.assertIn(b"renderMakhrajMap", script.data)
        for expected in (
            b"makharij-illustration",
            b"Ilustrasi tampak samping kepala",
            b"makharij-marker",
            b"Al-Khaisyum",
        ):
            self.assertIn(expected, script.data)
        script.close()

    def test_feature_pages_include_shared_page_transitions(self):
        for path in ("/", "/baca", "/tilawah", "/battle", "/ai-tahsin", "/connect", "/komunitas", "/tahfidz", "/dzikir-doa"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"page_transitions.css", response.data)
                self.assertIn(b"page_transitions.js", response.data)
                self.assertIn(b"ui_customization.js", response.data)
        for asset in ("/static/page_transitions.css", "/static/page_transitions.js", "/static/ui_customization.js", "/static/dzikir_doa.css", "/static/dzikir_doa.js"):
            with self.subTest(asset=asset):
                response = self.client.get(asset)
                self.assertEqual(response.status_code, 200)
                response.close()

    def test_quran_battle_has_requested_modes_and_socket_events(self):
        response = self.client.get("/quran-battle")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b'data-mode-card="tajwid-battle"',
            b'data-mode-card="sambung-ayat"',
            b'data-mode-card="nama-surat"',
            b'data-mode-card="hafalan-battle"',
            b'data-mode-card="makharij-battle"',
            b'data-mode-card="team-battle"',
            b"Buat Ruang Battle",
            b"join_room",
            b"submit_score",
            b"battle_result",
        ):
            self.assertIn(expected, response.data)

    def test_admin_password_reads_private_instance_file_and_prefers_environment(self):
        with tempfile.TemporaryDirectory() as directory:
            password_path = os.path.join(directory, "admin_password")
            with open(password_path, "w", encoding="utf-8") as password_file:
                password_file.write("private-password\n")
            with patch.dict(os.environ, {}, clear=False):
                os.environ.pop("USTAD_ADMIN_PASSWORD", None)
                self.assertEqual(_load_admin_password(directory), "private-password")
            with patch.dict(os.environ, {"USTAD_ADMIN_PASSWORD": "environment-password"}):
                self.assertEqual(_load_admin_password(directory), "environment-password")

    def test_admin_login_opens_admin_review_panel(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "UstadAdmin123!"
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "UstadAdmin123!"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json["user"]["role"], "admin")
        self.assertEqual(self.client.get("/api/auth/session").json["user"]["role"], "admin")
        self.assertEqual(self.client.get("/review/teachers").status_code, 200)

    def test_demo_accounts_are_removed_and_logout_allows_account_switching(self):
        first_token = self.client.get("/api/auth/session").json["csrf_token"]
        first = self.client.post(
            "/api/auth/register",
            json={
                "role": "student",
                "name": "Siswa Pertama",
                "email": "first-student@example.test",
                "password": "rahasia-123",
            },
            headers={"X-CSRF-Token": first_token},
        )
        self.assertEqual(first.status_code, 201)

        other_client = app.test_client()
        other_token = other_client.get("/api/auth/session").json["csrf_token"]
        second = other_client.post(
            "/api/auth/register",
            json={
                "role": "student",
                "name": "Siswa Kedua",
                "email": "second-student@example.test",
                "password": "rahasia-456",
            },
            headers={"X-CSRF-Token": other_token},
        )
        self.assertEqual(second.status_code, 201)

        logout_token = self.client.get("/api/auth/session").json["csrf_token"]
        logout = self.client.post(
            "/api/auth/logout",
            json={},
            headers={"X-CSRF-Token": logout_token},
        )
        self.assertEqual(logout.status_code, 200)
        self.assertIsNone(self.client.get("/api/auth/session").json["user"])

        switch_token = self.client.get("/api/auth/session").json["csrf_token"]
        switched = self.client.post(
            "/api/auth/login",
            json={
                "role": "student",
                "email": "second-student@example.test",
                "password": "rahasia-456",
            },
            headers={"X-CSRF-Token": switch_token},
        )
        self.assertEqual(switched.status_code, 200)
        self.assertEqual(switched.json["user"]["email"], "second-student@example.test")

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        removed_demo_route = self.client.post(
            "/api/auth/demo-login",
            json={"role": "student"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(removed_demo_route.status_code, 404)

    def test_admin_login_reports_missing_server_configuration(self):
        app.config["USTAD_ADMIN_PASSWORD"] = None
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "password": "irrelevant"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(response.status_code, 503)
        self.assertIn("USTAD_ADMIN_PASSWORD", response.json["error"])
        setup_page = self.client.get("/review/teachers")
        self.assertEqual(setup_page.status_code, 503)
        self.assertIn(b"restart atau deploy ulang", setup_page.data)

    def test_admin_can_switch_accounts_from_review_panel(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "test-admin-password"
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        login = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "test-admin-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(login.status_code, 200)

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        switched = self.client.post(
            "/review/logout",
            data={"switch_account": "1", "csrf_token": csrf_token},
        )
        self.assertEqual(switched.status_code, 302)
        self.assertEqual(switched.headers["Location"], "/")
        self.assertIsNone(self.client.get("/api/auth/session").json["user"])

    def test_admin_dashboard_hashes_password_and_previews_without_user_identity(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "dashboard-test-password"
        protected = self.client.get("/admin")
        self.assertEqual(protected.status_code, 302)
        self.assertIn("/admin/login", protected.headers["Location"])
        login_page = self.client.get("/admin/login")
        self.assertEqual(login_page.status_code, 200)
        self.assertIn(b"Masuk sebagai Admin", login_page.data)
        self.assertEqual(self.client.get("/admin/applications").status_code, 302)
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        wrong_username = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "someone-else", "password": "dashboard-test-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(wrong_username.status_code, 401)

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        login = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "dashboard-test-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(login.status_code, 200)
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            password_hash = connection.execute(
                "SELECT password_hash FROM admin_credentials WHERE id = 1"
            ).fetchone()[0]
        finally:
            connection.close()
        self.assertNotEqual(password_hash, "dashboard-test-password")
        self.assertTrue(check_password_hash(password_hash, "dashboard-test-password"))
        for path in ("/admin", "/admin/applications", "/admin/users"):
            self.assertEqual(self.client.get(path).status_code, 200)

        preview = self.client.get("/admin/preview/student")
        self.assertEqual(preview.status_code, 302)
        preview_user = self.client.get("/api/auth/session").json["user"]
        self.assertEqual(preview_user["role"], "student")
        self.assertTrue(preview_user["admin_preview"])
        self.assertEqual(self.client.get("/api/connect/me").status_code, 401)
        teacher_preview = self.client.get("/admin/preview/teacher")
        self.assertEqual(teacher_preview.status_code, 302)
        self.assertIn(b"PRATINJAU MODE USTAD", self.client.get("/ustad-dashboard").data)
        self.assertEqual(self.client.get("/api/connect/me").status_code, 401)

    def test_admin_login_page_creates_and_authenticates_bootstrapped_account(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "direct-login-password"
        login_page = self.client.get("/admin/login")
        self.assertEqual(login_page.status_code, 200)
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            self.assertEqual(
                connection.execute("SELECT COUNT(*) FROM admin_credentials").fetchone()[0],
                0,
            )
        finally:
            connection.close()

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        response = self.client.post(
            "/admin/login",
            data={
                "username": "FAMDI_Admin",
                "password": "direct-login-password",
                "csrf_token": csrf_token,
            },
        )
        self.assertEqual(response.status_code, 302)
        self.assertIn("/admin", response.headers["Location"])
        self.assertEqual(self.client.get("/admin").status_code, 200)
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            row = connection.execute(
                "SELECT username, password_hash FROM admin_credentials WHERE id = 1"
            ).fetchone()
        finally:
            connection.close()
        self.assertEqual(row[0], "FAMDI_Admin")
        self.assertTrue(check_password_hash(row[1], "direct-login-password"))

    def test_rejected_teacher_application_keeps_student_role_and_exposes_notice(self):
        app.config["USTAD_ADMIN_PASSWORD"] = "dashboard-test-password"
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        application = self.client.post(
            "/api/auth/register",
            json={
                "role": "teacher",
                "name": "Calon Ustad",
                "email": "calon-ustad@example.test",
                "password": "rahasia-123",
                "phone": "081234567890",
                "experience": "Saya telah mengajar tahsin selama tiga tahun.",
            },
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(application.status_code, 202)

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        admin_login = self.client.post(
            "/api/auth/login",
            json={"role": "admin", "username": "FAMDI_Admin", "password": "dashboard-test-password"},
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(admin_login.status_code, 200)
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        rejected = self.client.post(
            "/review/teachers/1",
            data={
                "decision": "rejected",
                "rejection_note": "Mohon lengkapi bukti pengalaman mengajar.",
                "csrf_token": csrf_token,
            },
        )
        self.assertEqual(rejected.status_code, 302)

        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        try:
            row = connection.execute(
                "SELECT role, status FROM users WHERE email = ?",
                ("calon-ustad@example.test",),
            ).fetchone()
        finally:
            connection.close()
        self.assertEqual(row, ("student", "approved"))

        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        student_login = self.client.post(
            "/api/auth/login",
            json={
                "role": "student",
                "email": "calon-ustad@example.test",
                "password": "rahasia-123",
            },
            headers={"X-CSRF-Token": csrf_token},
        )
        self.assertEqual(student_login.status_code, 200)
        session_response = self.client.get("/api/auth/session")
        self.assertEqual(session_response.json["application_notification"]["status"], "rejected")
        self.assertIn("lengkapi bukti", session_response.json["application_notification"]["message"])

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
        self.client.post(
            "/review/login",
            data={"username": "FAMDI_Admin", "password": "test-admin-password", "csrf_token": csrf_token},
        )
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        missing_verification = self.client.post(
            "/admin/applications/1",
            data={"decision": "approved", "csrf_token": csrf_token},
            follow_redirects=True,
        )
        self.assertEqual(missing_verification.status_code, 400)
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        self.client.post(
            "/admin/applications/1",
            data={
                "decision": "approved",
                "identity_verified": "1",
                "competence_verified": "1",
                "csrf_token": csrf_token,
            },
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
