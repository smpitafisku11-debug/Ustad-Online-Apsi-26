import hmac
import json
import sqlite3
from datetime import datetime, timedelta

from flask import Blueprint, current_app, jsonify, render_template, request, session


famdi_api = Blueprint("famdi_api", __name__)


def _database():
    connection = sqlite3.connect(current_app.config["AUTH_DATABASE"], timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def _csrf_valid():
    expected = session.get("csrf_token", "")
    supplied = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def _current_user(connection):
    user_id = session.get("user_id")
    if not user_id:
        return None
    return connection.execute(
        "SELECT id, name, role, status FROM users WHERE id = ?", (user_id,)
    ).fetchone()


def _require(connection, role=None):
    user = _current_user(connection)
    if not user or user["status"] != "approved":
        return None, (jsonify(error="Silakan masuk dengan akun yang sudah aktif."), 401)
    if role and user["role"] != role:
        return None, (jsonify(error="Akses fitur ini tidak sesuai dengan peran akun."), 403)
    return user, None


def _verified_teacher(connection, teacher_id):
    return connection.execute(
        """
        SELECT 1 FROM connect_teacher_verifications
        WHERE teacher_id = ? AND identity_checked = 1 AND competence_checked = 1
        """,
        (teacher_id,),
    ).fetchone()


def init_famdi_db(path):
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS famdi_teacher_students (
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                active INTEGER NOT NULL CHECK (active IN (0,1)),
                target TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (teacher_id, student_id)
            );
            CREATE TABLE IF NOT EXISTS famdi_learning_events (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                event_type TEXT NOT NULL,
                source_id INTEGER,
                title TEXT NOT NULL DEFAULT '',
                detail TEXT NOT NULL DEFAULT '',
                score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_evaluations (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                submission_id INTEGER REFERENCES tahfidz_submissions(id) ON DELETE SET NULL,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                makharij INTEGER CHECK (makharij BETWEEN 0 AND 100),
                sifat INTEGER CHECK (sifat BETWEEN 0 AND 100),
                tajwid INTEGER CHECK (tajwid BETWEEN 0 AND 100),
                kelancaran INTEGER CHECK (kelancaran BETWEEN 0 AND 100),
                hafalan INTEGER CHECK (hafalan BETWEEN 0 AND 100),
                overall_score INTEGER CHECK (overall_score BETWEEN 0 AND 100),
                comment TEXT NOT NULL DEFAULT '',
                recommendation TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_attendance (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                class_id INTEGER,
                attendance_date TEXT NOT NULL,
                status TEXT NOT NULL CHECK (status IN ('present','permit','sick','absent')),
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (teacher_id, student_id, attendance_date, class_id)
            );
            CREATE TABLE IF NOT EXISTS famdi_assignments (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                class_id INTEGER,
                title TEXT NOT NULL,
                material TEXT NOT NULL DEFAULT '',
                target TEXT NOT NULL DEFAULT '',
                due_at TEXT,
                status TEXT NOT NULL DEFAULT 'published',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_assignment_targets (
                assignment_id INTEGER NOT NULL REFERENCES famdi_assignments(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                submission TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','submitted','revision','completed')),
                score INTEGER CHECK (score IS NULL OR score BETWEEN 0 AND 100),
                comment TEXT NOT NULL DEFAULT '',
                submitted_at TEXT,
                reviewed_at TEXT,
                PRIMARY KEY (assignment_id, student_id)
            );
            CREATE TABLE IF NOT EXISTS famdi_classes (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                name TEXT NOT NULL,
                schedule TEXT NOT NULL DEFAULT '',
                material TEXT NOT NULL DEFAULT '',
                announcement TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_class_members (
                class_id INTEGER NOT NULL REFERENCES famdi_classes(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                active INTEGER NOT NULL CHECK (active IN (0,1)) DEFAULT 1,
                PRIMARY KEY (class_id, student_id)
            );
            CREATE TABLE IF NOT EXISTS famdi_messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                recipient_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                class_id INTEGER REFERENCES famdi_classes(id) ON DELETE CASCADE,
                body TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_notifications (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                title TEXT NOT NULL,
                body TEXT NOT NULL DEFAULT '',
                link TEXT NOT NULL DEFAULT '',
                read INTEGER NOT NULL CHECK (read IN (0,1)) DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS famdi_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                report_type TEXT NOT NULL CHECK (report_type IN ('daily','weekly','monthly','individual')),
                period_start TEXT NOT NULL,
                period_end TEXT NOT NULL,
                data_json TEXT NOT NULL DEFAULT '{}',
                strengths TEXT NOT NULL DEFAULT '',
                weaknesses TEXT NOT NULL DEFAULT '',
                recommendation TEXT NOT NULL DEFAULT '',
                note TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS famdi_events_student ON famdi_learning_events(student_id, created_at);
            CREATE INDEX IF NOT EXISTS famdi_attendance_lookup ON famdi_attendance(teacher_id, student_id, attendance_date);
            CREATE INDEX IF NOT EXISTS famdi_notifications_user ON famdi_notifications(user_id, read, created_at);
            """
        )
        connection.commit()
    finally:
        connection.close()


def _json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _sync_teacher_students(connection, teacher_id):
    connection.execute(
        """
        INSERT OR IGNORE INTO famdi_teacher_students (teacher_id, student_id, active)
        SELECT teacher_id, student_id, 1
        FROM (
            SELECT c.teacher_id, cm.student_id
            FROM famdi_classes c JOIN famdi_class_members cm ON cm.class_id = c.id
            UNION
            SELECT teacher_id, student_id FROM connect_bookings
        )
        WHERE teacher_id = ?
        """,
        (teacher_id,),
    )
    connection.commit()


@famdi_api.get("/api/famdi/dashboard")
def dashboard():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        if not _verified_teacher(connection, user["id"]):
            return jsonify(error="Akun ustad/ustazah belum diverifikasi."), 403
        _sync_teacher_students(connection, user["id"])
        today = datetime.now().strftime("%Y-%m-%d")
        pending = connection.execute(
            "SELECT COUNT(*) FROM tahfidz_submissions s JOIN famdi_teacher_students ts "
            "ON ts.student_id=s.student_id AND ts.active=1 "
            "WHERE ts.teacher_id=? AND s.status='pending'", (user["id"],)
        ).fetchone()[0]
        students = connection.execute(
            "SELECT COUNT(*) FROM famdi_teacher_students WHERE teacher_id=? AND active=1",
            (user["id"],),
        ).fetchone()[0]
        assignments = connection.execute(
            "SELECT COUNT(*) FROM famdi_assignment_targets t JOIN famdi_assignments a ON a.id=t.assignment_id "
            "WHERE a.teacher_id=? AND t.status='submitted'", (user["id"],)
        ).fetchone()[0]
        attendance = connection.execute(
            "SELECT COUNT(*) FROM famdi_attendance WHERE teacher_id=? AND attendance_date=?",
            (user["id"], today),
        ).fetchone()[0]
        notifications = connection.execute(
            "SELECT id,title,body,link,created_at FROM famdi_notifications "
            "WHERE user_id=? AND read=0 ORDER BY created_at DESC LIMIT 10", (user["id"],)
        ).fetchall()
        activity = connection.execute(
            "SELECT event_type,title,detail,score,created_at FROM famdi_learning_events "
            "WHERE teacher_id=? ORDER BY created_at DESC LIMIT 12", (user["id"],)
        ).fetchall()
        schedule = connection.execute(
            "SELECT id,starts_at,ends_at,status FROM connect_slots "
            "WHERE teacher_id=? AND substr(starts_at,1,10)>=? "
            "ORDER BY starts_at LIMIT 8", (user["id"], today)
        ).fetchall()
        return jsonify(
            students=students,
            pending_submissions=pending,
            assignments_to_review=assignments,
            today_attendance=attendance,
            schedule=[dict(row) for row in schedule],
            notifications=[dict(row) for row in notifications],
            activity=[dict(row) for row in activity],
        )
    finally:
        connection.close()


@famdi_api.get("/api/famdi/students")
def students():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        _sync_teacher_students(connection, user["id"])
        query = request.args.get("q", "").strip()[:80]
        status = request.args.get("status", "").strip()
        clauses = ["ts.teacher_id=?", "u.role='student'", "u.status='approved'"]
        values = [user["id"]]
        if query:
            clauses.append("(u.name LIKE ? OR u.email LIKE ?)")
            values.extend([f"%{query}%", f"%{query}%"])
        if status in ("active", "inactive"):
            clauses.append("ts.active=?")
            values.append(1 if status == "active" else 0)
        rows = connection.execute(
            f"""
            SELECT u.id,u.name,u.email,u.phone,u.username,u.bio,ts.active,ts.target,ts.note,
                   ts.updated_at
            FROM famdi_teacher_students ts
            JOIN users u ON u.id=ts.student_id
            WHERE {' AND '.join(clauses)}
            ORDER BY u.name COLLATE NOCASE
            """,
            values,
        ).fetchall()
        result = []
        for row in rows:
            sid = row["id"]
            submissions = connection.execute(
                "SELECT COUNT(*) FROM tahfidz_submissions WHERE student_id=?", (sid,)
            ).fetchone()[0]
            evaluation = connection.execute(
                "SELECT overall_score,created_at FROM famdi_evaluations "
                "WHERE student_id=? ORDER BY created_at DESC LIMIT 1", (sid,)
            ).fetchone()
            attendance = connection.execute(
                "SELECT COUNT(*) FROM famdi_attendance "
                "WHERE teacher_id=? AND student_id=? AND status='present'",
                (user["id"], sid),
            ).fetchone()[0]
            item = dict(row)
            item.update(submissions=submissions, latest_score=evaluation["overall_score"] if evaluation else None,
                        attendance_present=attendance)
            result.append(item)
        return jsonify(students=result)
    finally:
        connection.close()


@famdi_api.get("/api/famdi/students/<int:student_id>")
def student_detail(student_id):
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        relation = connection.execute(
            "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
            (user["id"], student_id),
        ).fetchone()
        if not relation:
            # A completed or current booking also establishes a legitimate bimbingan relationship.
            relation = connection.execute(
                "SELECT 1 FROM connect_bookings WHERE teacher_id=? AND student_id=?",
                (user["id"], student_id),
            ).fetchone()
        if not relation:
            return jsonify(error="Data murid tidak berada dalam pengawasan Anda."), 403
        profile = connection.execute(
            "SELECT id,name,email,phone,username,bio FROM users WHERE id=? AND role='student'",
            (student_id,),
        ).fetchone()
        if not profile:
            return jsonify(error="Murid tidak ditemukan."), 404
        submissions = connection.execute(
            "SELECT id,target_title,target_detail,status,review_note,submitted_at,reviewed_at "
            "FROM tahfidz_submissions WHERE student_id=? ORDER BY submitted_at DESC LIMIT 100",
            (student_id,),
        ).fetchall()
        evaluations = connection.execute(
            "SELECT * FROM famdi_evaluations WHERE student_id=? AND teacher_id=? "
            "ORDER BY created_at DESC LIMIT 100", (student_id, user["id"])
        ).fetchall()
        attendance = connection.execute(
            "SELECT attendance_date,status,note FROM famdi_attendance "
            "WHERE teacher_id=? AND student_id=? ORDER BY attendance_date DESC LIMIT 100",
            (user["id"], student_id),
        ).fetchall()
        events = connection.execute(
            "SELECT event_type,title,detail,score,created_at FROM famdi_learning_events "
            "WHERE teacher_id=? AND student_id=? ORDER BY created_at DESC LIMIT 100",
            (user["id"], student_id),
        ).fetchall()
        relation_row = connection.execute(
            "SELECT active,target,note FROM famdi_teacher_students "
            "WHERE teacher_id=? AND student_id=?", (user["id"], student_id)
        ).fetchone()
        return jsonify(
            profile=dict(profile),
            target=dict(relation_row) if relation_row else {"active": 1, "target": "", "note": ""},
            submissions=[dict(row) for row in submissions],
            evaluations=[dict(row) for row in evaluations],
            attendance=[dict(row) for row in attendance],
            learning_history=[dict(row) for row in events],
        )
    finally:
        connection.close()


@famdi_api.post("/api/famdi/students/<int:student_id>")
def update_student(student_id):
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        _sync_teacher_students(connection, user["id"])
        data = _json_body()
        active = 1 if data.get("active") is True else 0
        target = str(data.get("target", "")).strip()[:500]
        note = str(data.get("note", "")).strip()[:1000]
        cursor = connection.execute(
            "UPDATE famdi_teacher_students SET active=?,target=?,note=?,updated_at=CURRENT_TIMESTAMP "
            "WHERE teacher_id=? AND student_id=?", (active, target, note, user["id"], student_id)
        )
        connection.commit()
        if cursor.rowcount != 1:
            return jsonify(error="Murid tidak ditemukan dalam bimbingan Anda."), 404
        return jsonify(message="Profil bimbingan murid diperbarui.")
    finally:
        connection.close()


@famdi_api.post("/api/famdi/attendance")
def save_attendance():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        data = _json_body()
        attendance_date = str(data.get("attendance_date", ""))[:10]
        status = data.get("status")
        student_id = data.get("student_id")
        class_id = data.get("class_id")
        if not attendance_date or status not in ("present", "permit", "sick", "absent"):
            return jsonify(error="Tanggal atau status kehadiran tidak valid."), 400
        try:
            datetime.strptime(attendance_date, "%Y-%m-%d")
            student_id = int(student_id)
            class_id = int(class_id) if class_id not in (None, "") else None
        except (TypeError, ValueError):
            return jsonify(error="Data kehadiran tidak valid."), 400
        relation = connection.execute(
            "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
            (user["id"], student_id),
        ).fetchone()
        if not relation:
            return jsonify(error="Murid tidak berada dalam bimbingan Anda."), 403
        connection.execute(
            """
            INSERT INTO famdi_attendance
                (teacher_id,student_id,class_id,attendance_date,status,note)
            VALUES (?,?,?,?,?,?)
            ON CONFLICT(teacher_id,student_id,attendance_date,class_id)
            DO UPDATE SET status=excluded.status,note=excluded.note
            """,
            (user["id"], student_id, class_id, attendance_date, status,
             str(data.get("note", "")).strip()[:500]),
        )
        connection.execute(
            "INSERT INTO famdi_learning_events "
            "(teacher_id,student_id,event_type,title,detail) VALUES (?,?,?,?,?)",
            (user["id"], student_id, "attendance",
             "Kehadiran diperbarui",
             f"{attendance_date}: {status}")
        )
        connection.commit()
        return jsonify(message="Kehadiran murid berhasil disimpan.")
    finally:
        connection.close()


@famdi_api.get("/api/famdi/attendance")
def attendance_recap():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        date_from = request.args.get("from", "")[:10]
        date_to = request.args.get("to", "")[:10]
        where = "teacher_id=?"
        values = [user["id"]]
        if date_from:
            where += " AND attendance_date>=?"
            values.append(date_from)
        if date_to:
            where += " AND attendance_date<=?"
            values.append(date_to)
        rows = connection.execute(
            f"""
            SELECT a.*,u.name AS student_name
            FROM famdi_attendance a JOIN users u ON u.id=a.student_id
            WHERE {where} ORDER BY attendance_date DESC,u.name
            """,
            values,
        ).fetchall()
        return jsonify(attendance=[dict(row) for row in rows])
    finally:
        connection.close()


@famdi_api.get("/api/famdi/classes")
def list_classes():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        rows = connection.execute(
            "SELECT * FROM famdi_classes WHERE teacher_id=? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
        result = []
        for row in rows:
            members = connection.execute(
                "SELECT u.id,u.name,cm.active FROM famdi_class_members cm "
                "JOIN users u ON u.id=cm.student_id WHERE cm.class_id=? ORDER BY u.name",
                (row["id"],),
            ).fetchall()
            item = dict(row)
            item["members"] = [dict(member) for member in members]
            result.append(item)
        return jsonify(classes=result)
    finally:
        connection.close()


@famdi_api.post("/api/famdi/classes")
def create_class():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        data = _json_body()
        name = str(data.get("name", "")).strip()[:120]
        if len(name) < 3:
            return jsonify(error="Nama kelas minimal 3 karakter."), 400
        cursor = connection.execute(
            "INSERT INTO famdi_classes (teacher_id,name,schedule,material,announcement) "
            "VALUES (?,?,?,?,?)",
            (user["id"], name, str(data.get("schedule", "")).strip()[:300],
             str(data.get("material", "")).strip()[:2000],
             str(data.get("announcement", "")).strip()[:2000]),
        )
        class_id = cursor.lastrowid
        for student_id in data.get("student_ids", []) if isinstance(data.get("student_ids"), list) else []:
            try:
                sid = int(student_id)
            except (TypeError, ValueError):
                continue
            relation = connection.execute(
                "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
                (user["id"], sid),
            ).fetchone()
            if relation:
                connection.execute(
                    "INSERT OR IGNORE INTO famdi_class_members (class_id,student_id,active) VALUES (?,?,1)",
                    (class_id, sid),
                )
        connection.commit()
        return jsonify(message="Kelas berhasil dibuat.", class_id=class_id), 201
    finally:
        connection.close()


@famdi_api.get("/api/famdi/assignments")
def list_assignments():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        rows = connection.execute(
            "SELECT * FROM famdi_assignments WHERE teacher_id=? ORDER BY created_at DESC",
            (user["id"],),
        ).fetchall()
        result = []
        for row in rows:
            targets = connection.execute(
                "SELECT t.*,u.name AS student_name FROM famdi_assignment_targets t "
                "JOIN users u ON u.id=t.student_id WHERE t.assignment_id=?",
                (row["id"],),
            ).fetchall()
            item = dict(row)
            item["targets"] = [dict(target) for target in targets]
            result.append(item)
        return jsonify(assignments=result)
    finally:
        connection.close()


@famdi_api.post("/api/famdi/assignments")
def create_assignment():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        data = _json_body()
        title = str(data.get("title", "")).strip()[:180]
        if len(title) < 3:
            return jsonify(error="Judul tugas minimal 3 karakter."), 400
        class_id = data.get("class_id")
        try:
            class_id = int(class_id) if class_id not in (None, "") else None
        except (TypeError, ValueError):
            class_id = None
        due_at = str(data.get("due_at", "")).strip()[:40]
        cursor = connection.execute(
            "INSERT INTO famdi_assignments "
            "(teacher_id,class_id,title,material,target,due_at) VALUES (?,?,?,?,?,?)",
            (user["id"], class_id, title, str(data.get("material", "")).strip()[:2000],
             str(data.get("target", "")).strip()[:500], due_at or None),
        )
        assignment_id = cursor.lastrowid
        student_ids = data.get("student_ids", [])
        if class_id:
            member_ids = connection.execute(
                "SELECT student_id FROM famdi_class_members "
                "WHERE class_id=? AND active=1", (class_id,)
            ).fetchall()
            student_ids = [row["student_id"] for row in member_ids]
        if not isinstance(student_ids, list):
            student_ids = []
        if not class_id and not student_ids:
            member_ids = connection.execute(
                "SELECT student_id FROM famdi_teacher_students "
                "WHERE teacher_id=? AND active=1", (user["id"],)
            ).fetchall()
            student_ids = [row["student_id"] for row in member_ids]
        for student_id in student_ids:
            try:
                sid = int(student_id)
            except (TypeError, ValueError):
                continue
            relation = connection.execute(
                "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
                (user["id"], sid),
            ).fetchone()
            if relation:
                connection.execute(
                    "INSERT OR IGNORE INTO famdi_assignment_targets "
                    "(assignment_id,student_id,status) VALUES (?,?,'assigned')",
                    (assignment_id, sid),
                )
                connection.execute(
                    "INSERT INTO famdi_notifications (user_id,title,body,link) VALUES (?,?,?,?)",
                    (sid, "Tugas pembelajaran baru", title, "/tahfidz"),
                )
        connection.commit()
        return jsonify(message="Tugas berhasil dibuat dan dikirim.", assignment_id=assignment_id), 201
    finally:
        connection.close()


@famdi_api.post("/api/famdi/assignments/<int:assignment_id>/review")
def review_assignment(assignment_id):
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        data = _json_body()
        student_id = data.get("student_id")
        status = data.get("status")
        score = data.get("score")
        try:
            student_id = int(student_id)
            score = int(score)
        except (TypeError, ValueError):
            return jsonify(error="Data penilaian tugas tidak valid."), 400
        if status not in ("revision", "completed") or not 0 <= score <= 100:
            return jsonify(error="Status atau nilai tugas tidak valid."), 400
        owned = connection.execute(
            "SELECT 1 FROM famdi_assignments WHERE id=? AND teacher_id=?",
            (assignment_id, user["id"]),
        ).fetchone()
        if not owned:
            return jsonify(error="Tugas tidak ditemukan."), 404
        cursor = connection.execute(
            "UPDATE famdi_assignment_targets SET status=?,score=?,comment=?,reviewed_at=CURRENT_TIMESTAMP "
            "WHERE assignment_id=? AND student_id=?",
            (status, score, str(data.get("comment", "")).strip()[:1000],
             assignment_id, student_id),
        )
        if cursor.rowcount != 1:
            return jsonify(error="Murid tidak terdaftar pada tugas ini."), 404
        connection.execute(
            "INSERT INTO famdi_notifications (user_id,title,body,link) VALUES (?,?,?,?)",
            (student_id, "Tugas telah dinilai",
             f"Nilai: {score}. {str(data.get('comment','')).strip()[:300]}",
             "/tahfidz"),
        )
        connection.execute(
            "INSERT INTO famdi_learning_events "
            "(teacher_id,student_id,event_type,title,detail,score) VALUES (?,?,?,?,?,?)",
            (user["id"], student_id, "assignment", "Penilaian tugas",
             str(data.get("comment", "")).strip()[:500], score),
        )
        connection.commit()
        return jsonify(message="Penilaian tugas berhasil disimpan.")
    finally:
        connection.close()


@famdi_api.post("/api/famdi/evaluations")
def save_evaluation():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        _sync_teacher_students(connection, user["id"])
        data = _json_body()
        try:
            submission_id = int(data["submission_id"])
            student_id = int(data["student_id"])
            scores = [
                int(data["makharij"]), int(data["sifat"]), int(data["tajwid"]),
                int(data["kelancaran"]), int(data["hafalan"]),
            ]
        except (KeyError, TypeError, ValueError):
            return jsonify(error="Data evaluasi tidak lengkap atau tidak valid."), 400
        if any(score < 0 or score > 100 for score in scores):
            return jsonify(error="Nilai evaluasi harus 0–100."), 400
        submission = connection.execute(
            "SELECT id,student_id FROM tahfidz_submissions "
            "WHERE id=? AND student_id=?",
            (submission_id, student_id),
        ).fetchone()
        if not submission:
            return jsonify(error="Setoran tidak ditemukan."), 404
        relation = connection.execute(
            "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
            (user["id"], student_id),
        ).fetchone()
        if not relation:
            return jsonify(error="Setoran bukan milik murid bimbingan Anda."), 403
        overall = round(sum(scores) / len(scores))
        comment = str(data.get("comment", "")).strip()[:1000]
        recommendation = str(data.get("recommendation", "")).strip()[:1000]
        connection.execute(
            "INSERT INTO famdi_evaluations "
            "(submission_id,teacher_id,student_id,makharij,sifat,tajwid,kelancaran,hafalan,"
            "overall_score,comment,recommendation) VALUES (?,?,?,?,?,?,?,?,?,?,?)",
            (submission_id, user["id"], student_id, *scores, overall, comment, recommendation),
        )
        connection.execute(
            "UPDATE tahfidz_submissions SET status='approved',review_note=?,reviewer_id=?,"
            "reviewed_at=CURRENT_TIMESTAMP WHERE id=?",
            (comment or "Setoran telah dievaluasi.", user["id"], submission_id),
        )
        connection.execute(
            "INSERT INTO famdi_learning_events "
            "(teacher_id,student_id,event_type,source_id,title,detail,score) "
            "VALUES (?,?,?,?,?,?,?)",
            (user["id"], student_id, "submission", submission_id,
             "Evaluasi setoran", comment or "Setoran dinilai.", overall),
        )
        connection.execute(
            "INSERT INTO famdi_notifications (user_id,title,body,link) VALUES (?,?,?,?)",
            (student_id, "Hasil evaluasi setoran",
             f"Nilai keseluruhan: {overall}. {recommendation[:300]}",
             "/tahfidz"),
        )
        connection.commit()
        return jsonify(message="Evaluasi digital berhasil disimpan.", overall_score=overall), 201
    finally:
        connection.close()


@famdi_api.post("/api/famdi/reports")
def create_report():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        data = _json_body()
        try:
            student_id = int(data["student_id"])
        except (KeyError, TypeError, ValueError):
            return jsonify(error="Murid laporan tidak valid."), 400
        report_type = data.get("report_type")
        if report_type not in ("daily", "weekly", "monthly", "individual"):
            return jsonify(error="Jenis laporan tidak valid."), 400
        relation = connection.execute(
            "SELECT 1 FROM famdi_teacher_students WHERE teacher_id=? AND student_id=?",
            (user["id"], student_id),
        ).fetchone()
        if not relation:
            return jsonify(error="Murid tidak berada dalam bimbingan Anda."), 403
        today = datetime.now()
        if report_type == "daily":
            start = today.strftime("%Y-%m-%d")
            end = start
        elif report_type == "weekly":
            start = (today - timedelta(days=6)).strftime("%Y-%m-%d")
            end = today.strftime("%Y-%m-%d")
        elif report_type == "monthly":
            start = today.strftime("%Y-%m-01")
            end = today.strftime("%Y-%m-%d")
        else:
            start = str(data.get("period_start", ""))[:10]
            end = str(data.get("period_end", ""))[:10]
            if not start or not end:
                return jsonify(error="Periode laporan wajib diisi."), 400
            try:
                datetime.strptime(start, "%Y-%m-%d")
                datetime.strptime(end, "%Y-%m-%d")
            except ValueError:
                return jsonify(error="Format periode laporan tidak valid."), 400
        submissions = connection.execute(
            "SELECT COUNT(*) FROM tahfidz_submissions "
            "WHERE student_id=? AND substr(submitted_at,1,10)>=? "
            "AND substr(submitted_at,1,10)<=?",
            (student_id, start, end),
        ).fetchone()[0]
        approved = connection.execute(
            "SELECT COUNT(*) FROM tahfidz_submissions "
            "WHERE student_id=? AND status='approved' "
            "AND substr(reviewed_at,1,10)>=? AND substr(reviewed_at,1,10)<=?",
            (student_id, start, end),
        ).fetchone()[0]
        eval_rows = connection.execute(
            "SELECT makharij,sifat,tajwid,kelancaran,hafalan,overall_score,comment,recommendation "
            "FROM famdi_evaluations WHERE teacher_id=? AND student_id=? "
            "AND substr(created_at,1,10)>=? AND substr(created_at,1,10)<=?",
            (user["id"], student_id, start, end),
        ).fetchall()
        avg_score = round(sum(row["overall_score"] or 0 for row in eval_rows) / len(eval_rows)) if eval_rows else 0
        attendance_rows = connection.execute(
            "SELECT status,COUNT(*) AS total FROM famdi_attendance "
            "WHERE teacher_id=? AND student_id=? AND attendance_date>=? AND attendance_date<=?"
            " GROUP BY status",
            (user["id"], student_id, start, end),
        ).fetchall()
        attendance = {row["status"]: row["total"] for row in attendance_rows}
        target = connection.execute(
            "SELECT target,note FROM famdi_teacher_students "
            "WHERE teacher_id=? AND student_id=?", (user["id"], student_id)
        ).fetchone()
        completed_targets = connection.execute(
            "SELECT COUNT(*) FROM famdi_assignment_targets t "
            "JOIN famdi_assignments a ON a.id=t.assignment_id "
            "WHERE a.teacher_id=? AND t.student_id=? AND t.status='completed'",
            (user["id"], student_id),
        ).fetchone()[0]
        report_data = {
            "submissions": submissions,
            "approved_submissions": approved,
            "evaluations": len(eval_rows),
            "average_score": avg_score,
            "attendance": attendance,
            "completed_assignments": completed_targets,
            "learning_target": target["target"] if target else "",
        }
        strengths = str(data.get("strengths", "")).strip()[:1000]
        weaknesses = str(data.get("weaknesses", "")).strip()[:1000]
        recommendation = str(data.get("recommendation", "")).strip()[:1000]
        note = str(data.get("note", "")).strip()[:1000]
        cursor = connection.execute(
            "INSERT INTO famdi_reports "
            "(teacher_id,student_id,report_type,period_start,period_end,data_json,"
            "strengths,weaknesses,recommendation,note) VALUES (?,?,?,?,?,?,?,?,?,?)",
            (user["id"], student_id, report_type, start, end, json.dumps(report_data),
             strengths, weaknesses, recommendation, note),
        )
        connection.commit()
        return jsonify(message="Laporan perkembangan berhasil dibuat.", report_id=cursor.lastrowid,
                       report=report_data), 201
    finally:
        connection.close()


@famdi_api.get("/api/famdi/reports")
def list_reports():
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        rows = connection.execute(
            "SELECT r.*,u.name AS student_name,u.email AS student_email "
            "FROM famdi_reports r JOIN users u ON u.id=r.student_id "
            "WHERE r.teacher_id=? ORDER BY r.created_at DESC",
            (user["id"],),
        ).fetchall()
        return jsonify(reports=[dict(row) for row in rows])
    finally:
        connection.close()


@famdi_api.get("/api/famdi/reports/<int:report_id>/print")
def print_report(report_id):
    connection = _database()
    try:
        user, error = _require(connection, "teacher")
        if error:
            return error
        row = connection.execute(
            "SELECT r.*,u.name AS student_name,tu.name AS teacher_name "
            "FROM famdi_reports r "
            "JOIN users u ON u.id=r.student_id "
            "JOIN users tu ON tu.id=r.teacher_id "
            "WHERE r.id=? AND r.teacher_id=?",
            (report_id, user["id"]),
        ).fetchone()
        if not row:
            return jsonify(error="Laporan tidak ditemukan."), 404
        report = dict(row)
        report["data"] = json.loads(report["data_json"] or "{}")
        return render_template("famdi_report_print.html", report=report)
    finally:
        connection.close()


@famdi_api.post("/api/famdi/messages")
def send_message():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid."), 400
    connection = _database()
    try:
        user, error = _require(connection)
        if error:
            return error
        data = _json_body()
        body = str(data.get("body", "")).strip()[:2000]
        if len(body) < 2:
            return jsonify(error="Pesan terlalu pendek."), 400
        recipient_id = data.get("recipient_id")
        class_id = data.get("class_id")
        try:
            recipient_id = int(recipient_id) if recipient_id not in (None, "") else None
            class_id = int(class_id) if class_id not in (None, "") else None
        except (TypeError, ValueError):
            return jsonify(error="Penerima pesan tidak valid."), 400
        if user["role"] == "teacher" and recipient_id:
            allowed = connection.execute(
                "SELECT 1 FROM famdi_teacher_students "
                "WHERE teacher_id=? AND student_id=?", (user["id"], recipient_id)
            ).fetchone()
            if not allowed:
                return jsonify(error="Pesan hanya dapat dikirim kepada murid bimbingan."), 403
        elif user["role"] == "student" and recipient_id:
            allowed = connection.execute(
                "SELECT 1 FROM famdi_teacher_students "
                "WHERE teacher_id=? AND student_id=?", (recipient_id, user["id"])
            ).fetchone()
            if not allowed:
                return jsonify(error="Pesan hanya dapat dikirim kepada ustad pembimbing."), 403
        connection.execute(
            "INSERT INTO famdi_messages (sender_id,recipient_id,class_id,body) VALUES (?,?,?,?)",
            (user["id"], recipient_id, class_id, body),
        )
        if recipient_id:
            connection.execute(
                "INSERT INTO famdi_notifications (user_id,title,body,link) VALUES (?,?,?,?)",
                (recipient_id, "Pesan baru dari pembelajaran",
                 body[:300], "/ustad-dashboard" if user["role"] == "student" else "/"),
            )
        connection.commit()
        return jsonify(message="Pesan berhasil dikirim."), 201
    finally:
        connection.close()


@famdi_api.get("/api/famdi/messages")
def list_messages():
    connection = _database()
    try:
        user, error = _require(connection)
        if error:
            return error
        if user["role"] == "student":
            rows = connection.execute(
                "SELECT m.*,u.name AS sender_name FROM famdi_messages m "
                "JOIN users u ON u.id=m.sender_id "
                "WHERE m.recipient_id=? OR m.sender_id=? ORDER BY m.created_at DESC LIMIT 100",
                (user["id"], user["id"]),
            ).fetchall()
        else:
            rows = connection.execute(
                "SELECT m.*,u.name AS sender_name FROM famdi_messages m "
                "JOIN users u ON u.id=m.sender_id "
                "WHERE m.sender_id=? OR m.recipient_id=? ORDER BY m.created_at DESC LIMIT 100",
                (user["id"], user["id"]),
            ).fetchall()
        return jsonify(messages=[dict(row) for row in rows])
    finally:
        connection.close()
