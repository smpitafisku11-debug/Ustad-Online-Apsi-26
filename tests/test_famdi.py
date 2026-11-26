import os
import sqlite3
import tempfile
import unittest

from app import app, init_famdi_db


class FamdiTests(unittest.TestCase):
    def setUp(self):
        self.temp_directory = tempfile.TemporaryDirectory()
        self.original_database = app.config["AUTH_DATABASE"]
        self.original_admin_password = app.config["USTAD_ADMIN_PASSWORD"]
        app.config.update(TESTING=True, SECRET_KEY="famdi-test-secret")
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_directory.name, "famdi.sqlite3")
        app.config["USTAD_ADMIN_PASSWORD"] = "test-admin-password"
        import auth
        import connect
        auth.init_auth_db(app.config["AUTH_DATABASE"])
        connect.init_connect_db(app.config["AUTH_DATABASE"])
        init_famdi_db(app.config["AUTH_DATABASE"])

        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        connection.execute(
            "INSERT INTO users (name,email,password_hash,role,status) "
            "VALUES ('Siswa FAMDI','famdi.student@example.test','hash','student','approved')"
        )
        connection.execute(
            "INSERT INTO users (name,email,password_hash,role,status) "
            "VALUES ('Ustad FAMDI','famdi.teacher@example.test','hash','teacher','approved')"
        )
        student_id = connection.execute(
            "SELECT id FROM users WHERE email='famdi.student@example.test'"
        ).fetchone()[0]
        teacher_id = connection.execute(
            "SELECT id FROM users WHERE email='famdi.teacher@example.test'"
        ).fetchone()[0]
        connection.execute(
            "INSERT INTO connect_teacher_verifications "
            "(teacher_id,identity_checked,competence_checked,verified_by) VALUES (?,1,1,'test')",
            (teacher_id,),
        )
        connection.execute(
            "INSERT INTO famdi_teacher_students (teacher_id,student_id,active,target) "
            "VALUES (?,?,1,'Membaca Juz 30')",
            (teacher_id, student_id),
        )
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS tahfidz_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL,
                target_key TEXT NOT NULL DEFAULT '',
                target_title TEXT NOT NULL DEFAULT '',
                target_detail TEXT NOT NULL DEFAULT '',
                audio BLOB,
                audio_type TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending',
                review_note TEXT NOT NULL DEFAULT '',
                reviewer_id INTEGER,
                submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TEXT
            )
            """
        )
        connection.commit()
        connection.close()

    def tearDown(self):
        app.config["AUTH_DATABASE"] = self.original_database
        app.config["USTAD_ADMIN_PASSWORD"] = self.original_admin_password
        self.temp_directory.cleanup()

    def _login(self, client, role, email, password="rahasia-123"):
        token = client.get("/api/auth/session").json["csrf_token"]
        return client.post(
            "/api/auth/login",
            json={"role": role, "email": email, "password": password},
            headers={"X-CSRF-Token": token},
        )

    def test_teacher_can_manage_attendance_assignment_and_report(self):
        teacher = app.test_client()
        # Replace test login hash with an actual password hash so login is exercised.
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        from werkzeug.security import generate_password_hash
        connection.execute(
            "UPDATE users SET password_hash=? WHERE email='famdi.teacher@example.test'",
            (generate_password_hash("rahasia-123"),),
        )
        connection.execute(
            "UPDATE users SET password_hash=? WHERE email='famdi.student@example.test'",
            (generate_password_hash("rahasia-123"),),
        )
        connection.commit()
        connection.close()

        teacher = app.test_client()
        login = self._login(teacher, "teacher", "famdi.teacher@example.test")
        self.assertEqual(login.status_code, 200)
        csrf = login.json["csrf_token"]

        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        student_id = connection.execute(
            "SELECT id FROM users WHERE email='famdi.student@example.test'"
        ).fetchone()[0]
        connection.close()

        attendance = teacher.post(
            "/api/famdi/attendance",
            json={
                "student_id": student_id,
                "attendance_date": "2026-11-26",
                "status": "present",
                "note": "Berangkat tepat waktu",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(attendance.status_code, 200)

        assignment = teacher.post(
            "/api/famdi/assignments",
            json={
                "title": "Setor hafalan Juz 30",
                "material": "Surah An-Naba",
                "target": "Ayat 1-20",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(assignment.status_code, 201)

        report = teacher.post(
            "/api/famdi/reports",
            json={
                "student_id": student_id,
                "report_type": "monthly",
                "strengths": "Pelafalan stabil",
                "weaknesses": "Perlu latihan kelancaran",
                "recommendation": "Murajaah 15 menit setiap hari",
                "note": "Perkembangan baik",
            },
            headers={"X-CSRF-Token": csrf},
        )
        self.assertEqual(report.status_code, 201)
        print_page = teacher.get(
            f"/api/famdi/reports/{report.json['report_id']}/print"
        )
        self.assertEqual(print_page.status_code, 200)
        self.assertIn(b"Laporan Perkembangan Murid", print_page.data)

    def test_student_cannot_access_teacher_famdi_api(self):
        connection = sqlite3.connect(app.config["AUTH_DATABASE"])
        from werkzeug.security import generate_password_hash
        connection.execute(
            "UPDATE users SET password_hash=? WHERE email='famdi.student@example.test'",
            (generate_password_hash("rahasia-123"),),
        )
        connection.commit()
        connection.close()

        student = app.test_client()
        login = self._login(student, "student", "famdi.student@example.test")
        self.assertEqual(login.status_code, 200)
        response = student.get("/api/famdi/dashboard")
        self.assertEqual(response.status_code, 403)


if __name__ == "__main__":
    unittest.main()
