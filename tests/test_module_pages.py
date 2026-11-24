import unittest
import os
import tempfile

from app import app
from auth import init_auth_db
from connect import init_connect_db


class ModulePageTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_database = app.config["AUTH_DATABASE"]
        self.original_admin_password = app.config.get("USTAD_ADMIN_PASSWORD")
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
        self.assertIn(b"'/ustad-dashboard'", dashboard_service_worker.data)
        self.assertIn(b"'/static/ustad_dashboard.js'", dashboard_service_worker.data)
        dashboard_service_worker.close()

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

    def test_feature_pages_include_shared_page_transitions(self):
        for path in ("/", "/baca", "/tilawah", "/battle", "/tahsin", "/connect", "/komunitas", "/tahfidz"):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(b"page_transitions.css", response.data)
                self.assertIn(b"page_transitions.js", response.data)
        for asset in ("/static/page_transitions.css", "/static/page_transitions.js"):
            with self.subTest(asset=asset):
                response = self.client.get(asset)
                self.assertEqual(response.status_code, 200)
                response.close()

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
        missing_verification = self.client.post(
            "/review/teachers/1",
            data={"decision": "approved", "csrf_token": csrf_token},
            follow_redirects=True,
        )
        self.assertEqual(missing_verification.status_code, 400)
        csrf_token = self.client.get("/api/auth/session").json["csrf_token"]
        self.client.post(
            "/review/teachers/1",
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
