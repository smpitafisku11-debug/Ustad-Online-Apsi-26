import hmac
import sqlite3
from datetime import datetime, timedelta, timezone

from flask import Blueprint, current_app, jsonify, render_template, request, session


connect_api = Blueprint("connect_api", __name__)


@connect_api.get("/ustad-dashboard")
def ustad_dashboard():
    if session.get("admin_authenticated") and session.get("admin_review_mode", "teacher") in ("teacher", "admin"):
        return render_template(
            "ustad_dashboard.html",
            teacher_verified=False,
            admin_preview=True,
        )
    connection = _database()
    try:
        user, error = _require_user(connection, "teacher")
        if error:
            return error
        verified = _teacher_verified(connection, user["id"])
    finally:
        connection.close()
    return render_template(
        "ustad_dashboard.html",
        teacher_verified=verified,
        admin_preview=False,
    )


def _database():
    connection = sqlite3.connect(current_app.config["AUTH_DATABASE"], timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys = ON")
    return connection


def init_connect_db(path):
    connection = sqlite3.connect(path)
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS connect_profiles (
                teacher_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                expertise TEXT NOT NULL,
                method TEXT NOT NULL,
                modes TEXT NOT NULL,
                fee INTEGER NOT NULL CHECK (fee >= 0),
                duration INTEGER NOT NULL CHECK (duration IN (30, 45, 60)),
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS connect_teacher_verifications (
                teacher_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
                identity_checked INTEGER NOT NULL CHECK (identity_checked = 1),
                competence_checked INTEGER NOT NULL CHECK (competence_checked = 1),
                verified_by TEXT NOT NULL,
                verified_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS connect_bookings (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES users(id),
                teacher_id INTEGER NOT NULL REFERENCES users(id),
                slot_id INTEGER NOT NULL REFERENCES connect_slots(id),
                mode TEXT NOT NULL DEFAULT 'audio' CHECK (mode IN ('audio', 'video', 'chat')),
                status TEXT NOT NULL CHECK (status IN ('requested', 'confirmed', 'completed', 'cancelled', 'declined')),
                guardian_acknowledged INTEGER NOT NULL CHECK (guardian_acknowledged = 1),
                evaluation TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS connect_slots (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                teacher_id INTEGER NOT NULL REFERENCES users(id),
                starts_at TEXT NOT NULL,
                ends_at TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'available' CHECK (status IN ('available', 'booked', 'closed')),
                booking_id INTEGER REFERENCES connect_bookings(id),
                UNIQUE (teacher_id, starts_at, ends_at)
            );
            CREATE TABLE IF NOT EXISTS connect_reviews (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                booking_id INTEGER NOT NULL UNIQUE REFERENCES connect_bookings(id),
                student_id INTEGER NOT NULL REFERENCES users(id),
                teacher_id INTEGER NOT NULL REFERENCES users(id),
                rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
                comment TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS connect_reports (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                reporter_id INTEGER NOT NULL REFERENCES users(id),
                booking_id INTEGER REFERENCES connect_bookings(id),
                reason TEXT NOT NULL,
                details TEXT NOT NULL DEFAULT '',
                status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS connect_slots_search ON connect_slots(status, starts_at);
            CREATE INDEX IF NOT EXISTS connect_bookings_teacher ON connect_bookings(teacher_id, status);
            """
        )
        connection.commit()
    finally:
        connection.close()


def _csrf_valid():
    expected = session.get("csrf_token", "")
    supplied = request.headers.get("X-CSRF-Token", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def _json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _current_user(connection):
    if session.get("admin_authenticated"):
        virtual_role = session.get("admin_review_mode")
        if virtual_role in ("teacher", "student"):
            return {
                "id": -1,
                "name": "Admin FAMDI",
                "role": virtual_role,
                "status": "approved",
            }
    user_id = session.get("user_id")
    if not user_id:
        return None
    return connection.execute(
        "SELECT id, name, role, status FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def _require_user(connection, role=None):
    user = _current_user(connection)
    if not user or user["status"] != "approved":
        return None, (jsonify(error="Silakan masuk dengan akun yang sudah aktif."), 401)
    if role and user["role"] != role:
        role_name = "siswa" if role == "student" else "ustad/ustazah"
        return None, (jsonify(error=f"Fitur ini hanya dapat digunakan oleh {role_name}."), 403)
    return user, None


def _parse_datetime(value):
    if not isinstance(value, str) or len(value) > 40:
        return None
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
        if parsed.tzinfo is None:
            return None
        return parsed.astimezone(timezone.utc).replace(microsecond=0)
    except ValueError:
        return None


def _teacher_verified(connection, teacher_id):
    return connection.execute(
        """
        SELECT 1 FROM connect_teacher_verifications
        WHERE teacher_id = ? AND identity_checked = 1 AND competence_checked = 1
        """,
        (teacher_id,),
    ).fetchone() is not None


def _slot_dict(row):
    return {
        "id": row["id"],
        "starts_at": row["starts_at"],
        "ends_at": row["ends_at"],
    }


def _teacher_cards(connection, query, method, mode, max_fee, has_schedule):
    clauses = [
        "u.role = 'teacher'", "u.status = 'approved'", "p.teacher_id IS NOT NULL",
        "v.identity_checked = 1", "v.competence_checked = 1",
    ]
    values = []
    if query:
        clauses.append("(u.name LIKE ? OR p.expertise LIKE ? OR p.method LIKE ?)")
        pattern = f"%{query}%"
        values.extend([pattern] * 3)
    if method:
        clauses.append("p.method LIKE ?")
        values.append(f"%{method}%")
    if mode:
        clauses.append("instr(',' || p.modes || ',', ',' || ? || ',') > 0")
        values.append(mode)
    if max_fee is not None:
        clauses.append("p.fee <= ?")
        values.append(max_fee)
    if has_schedule:
        clauses.append(
            "EXISTS (SELECT 1 FROM connect_slots s WHERE s.teacher_id = u.id AND s.status = 'available' AND s.starts_at >= ?)"
        )
        values.append(datetime.now(timezone.utc).isoformat(timespec="seconds"))
    rows = connection.execute(
        f"""
        SELECT u.id, u.name, p.expertise, p.method, p.modes, p.fee, p.duration
        FROM users u JOIN connect_profiles p ON p.teacher_id = u.id
        JOIN connect_teacher_verifications v ON v.teacher_id = u.id
        WHERE {' AND '.join(clauses)}
        ORDER BY u.name COLLATE NOCASE
        LIMIT 50
        """,
        values,
    ).fetchall()
    teachers = []
    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    for row in rows:
        slots = connection.execute(
            """
            SELECT id, starts_at, ends_at FROM connect_slots
            WHERE teacher_id = ? AND status = 'available' AND starts_at >= ?
            ORDER BY starts_at LIMIT 12
            """,
            (row["id"], now),
        ).fetchall()
        reviews = connection.execute(
            """
            SELECT r.rating, r.comment FROM connect_reviews r
            WHERE r.teacher_id = ? AND r.status = 'approved'
            ORDER BY r.created_at DESC LIMIT 5
            """,
            (row["id"],),
        ).fetchall()
        teachers.append({
            "id": row["id"],
            "name": row["name"],
            "experience": row["expertise"],
            "expertise": row["expertise"],
            "method": row["method"],
            "modes": row["modes"].split(","),
            "fee": row["fee"],
            "duration": row["duration"],
            "slots": [_slot_dict(slot) for slot in slots],
            "reviews": [{"rating": review["rating"], "comment": review["comment"]} for review in reviews],
        })
    return teachers


@connect_api.get("/api/connect/teachers")
def find_teachers():
    query = request.args.get("q", "").strip()[:80]
    method = request.args.get("method", "").strip()[:40]
    mode = request.args.get("mode", "").strip()[:40]
    fee_value = request.args.get("max_fee")
    if method and method not in ("tahsin", "tajwid", "tahfidz", "tilawah", "dasar"):
        return jsonify(error="Bidang pencarian tidak valid."), 400
    if mode and mode not in ("audio", "video", "chat"):
        return jsonify(error="Metode sesi pencarian tidak valid."), 400
    if fee_value:
        try:
            max_fee = int(fee_value)
            if not 0 <= max_fee <= 100000000:
                raise ValueError
        except ValueError:
            return jsonify(error="Batas biaya harus berupa angka yang valid."), 400
    else:
        max_fee = None
    has_schedule = request.args.get("available") == "1"
    connection = _database()
    try:
        return jsonify(teachers=_teacher_cards(connection, query, method, mode, max_fee, has_schedule))
    finally:
        connection.close()


@connect_api.get("/api/connect/me")
def connect_me():
    connection = _database()
    try:
        user, error = _require_user(connection)
        if error:
            return error
        profile = None
        slots = []
        teacher_verified = False
        if user["role"] == "teacher":
            teacher_verified = _teacher_verified(connection, user["id"])
            profile = connection.execute(
                "SELECT expertise, method, modes, fee, duration FROM connect_profiles WHERE teacher_id = ?",
                (user["id"],),
            ).fetchone()
            if profile:
                profile = dict(profile)
                profile["modes"] = profile["modes"].split(",")
            slots = connection.execute(
                """
                SELECT id, starts_at, ends_at, status FROM connect_slots
                WHERE teacher_id = ? AND starts_at >= ?
                ORDER BY starts_at LIMIT 30
                """,
                (user["id"], datetime.now(timezone.utc).isoformat(timespec="seconds")),
            ).fetchall()
        return jsonify(
            user={"id": user["id"], "name": user["name"], "role": user["role"]},
            teacher_verified=teacher_verified,
            profile=profile,
            slots=[dict(slot) for slot in slots],
        )
    finally:
        connection.close()


@connect_api.post("/api/connect/profile")
def save_teacher_profile():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    expertise = data.get("expertise", "").strip() if isinstance(data.get("expertise"), str) else ""
    method = data.get("method", "").strip() if isinstance(data.get("method"), str) else ""
    modes = data.get("modes")
    fee = data.get("fee")
    duration = data.get("duration")
    if method not in ("tahsin", "tajwid", "tahfidz", "tilawah", "dasar"):
        return jsonify(error="Pilih bidang pengajaran yang tersedia."), 400
    if not 5 <= len(expertise) <= 300 or not isinstance(modes, list) or not modes:
        return jsonify(error="Lengkapi keahlian (5–300 karakter) dan pilih minimal satu metode sesi."), 400
    if any(mode not in ("audio", "video", "chat") for mode in modes) or len(set(modes)) != len(modes):
        return jsonify(error="Metode sesi tidak valid."), 400
    if type(fee) is not int or not 0 <= fee <= 10000000 or type(duration) is not int or duration not in (30, 45, 60):
        return jsonify(error="Biaya atau durasi sesi tidak valid."), 400
    connection = _database()
    try:
        user, error = _require_user(connection, "teacher")
        if error:
            return error
        if not _teacher_verified(connection, user["id"]):
            return jsonify(error="Akun Ustad Connect menunggu verifikasi identitas dan kompetensi oleh admin."), 403
        connection.execute(
            """
            INSERT INTO connect_profiles (teacher_id, expertise, method, modes, fee, duration)
            VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT(teacher_id) DO UPDATE SET
                expertise = excluded.expertise, method = excluded.method,
                modes = excluded.modes, fee = excluded.fee, duration = excluded.duration,
                updated_at = CURRENT_TIMESTAMP
            """,
            (user["id"], expertise, method, ",".join(modes), fee, duration),
        )
        connection.commit()
        return jsonify(message="Profil Ustad Connect tersimpan dan tampil untuk siswa."), 200
    finally:
        connection.close()


@connect_api.post("/api/connect/availability")
def add_availability():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    starts = _parse_datetime(data.get("starts_at"))
    ends = _parse_datetime(data.get("ends_at"))
    now = datetime.now(timezone.utc)
    if not starts or not ends or starts < now + timedelta(minutes=10) or starts > now + timedelta(days=90):
        return jsonify(error="Pilih jadwal 10 menit hingga 90 hari dari sekarang, beserta zona waktu."), 400
    connection = _database()
    try:
        user, error = _require_user(connection, "teacher")
        if error:
            return error
        if not _teacher_verified(connection, user["id"]):
            return jsonify(error="Akun Ustad Connect menunggu verifikasi identitas dan kompetensi oleh admin."), 403
        profile = connection.execute(
            "SELECT duration FROM connect_profiles WHERE teacher_id = ?",
            (user["id"],),
        ).fetchone()
        if not profile:
            return jsonify(error="Simpan profil pengajar sebelum menambahkan jadwal."), 400
        if ends - starts != timedelta(minutes=profile["duration"]):
            return jsonify(error=f"Durasi slot harus {profile['duration']} menit sesuai profil."), 400
        collision = connection.execute(
            """
            SELECT 1 FROM connect_slots
            WHERE teacher_id = ? AND status != 'closed' AND starts_at < ? AND ends_at > ?
            LIMIT 1
            """,
            (user["id"], ends.isoformat(timespec="seconds"), starts.isoformat(timespec="seconds")),
        ).fetchone()
        if collision:
            return jsonify(error="Jadwal ini bertabrakan dengan slot lain yang sudah tersedia atau dipesan."), 409
        connection.execute(
            "INSERT INTO connect_slots (teacher_id, starts_at, ends_at) VALUES (?, ?, ?)",
            (user["id"], starts.isoformat(timespec="seconds"), ends.isoformat(timespec="seconds")),
        )
        connection.commit()
        return jsonify(message="Jadwal tersedia ditambahkan."), 201
    finally:
        connection.close()


@connect_api.post("/api/connect/bookings")
def create_booking():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    slot_id = data.get("slot_id")
    acknowledged = data.get("guardian_acknowledged") is True
    mode = data.get("mode")
    if type(slot_id) is not int or not acknowledged or mode not in ("audio", "video", "chat"):
        return jsonify(error="Pilih jadwal dan metode serta nyatakan telah membaca ketentuan wali dan biaya."), 400
    connection = _database()
    try:
        user, error = _require_user(connection, "student")
        if error:
            return error
        connection.execute("BEGIN IMMEDIATE")
        slot = connection.execute(
            """
            SELECT s.id, s.teacher_id, s.starts_at, p.fee, p.modes
            FROM connect_slots s JOIN connect_profiles p ON p.teacher_id = s.teacher_id
            JOIN users u ON u.id = s.teacher_id
            JOIN connect_teacher_verifications v ON v.teacher_id = u.id
            WHERE s.id = ? AND s.status = 'available' AND s.starts_at > ? AND u.status = 'approved'
              AND v.identity_checked = 1 AND v.competence_checked = 1
            """,
            (slot_id, datetime.now(timezone.utc).isoformat(timespec="seconds")),
        ).fetchone()
        if not slot:
            connection.rollback()
            return jsonify(error="Jadwal sudah tidak tersedia. Pilih jadwal lain."), 409
        if mode not in slot["modes"].split(","):
            connection.rollback()
            return jsonify(error="Metode sesi yang dipilih tidak sesuai profil pengajar."), 400
        cursor = connection.execute(
            """
            INSERT INTO connect_bookings (student_id, teacher_id, slot_id, mode, status, guardian_acknowledged)
            VALUES (?, ?, ?, ?, 'requested', 1)
            """,
            (user["id"], slot["teacher_id"], slot_id, mode),
        )
        booking_id = cursor.lastrowid
        reserved = connection.execute(
            "UPDATE connect_slots SET status = 'booked', booking_id = ? WHERE id = ? AND status = 'available'",
            (booking_id, slot_id),
        )
        if reserved.rowcount != 1:
            connection.rollback()
            return jsonify(error="Jadwal sudah dipesan pengguna lain. Pilih jadwal lain."), 409
        connection.commit()
        return jsonify(
            message="Permintaan terkirim. Tunggu konfirmasi pengajar sebelum sesi dijadwalkan.",
            booking_id=booking_id,
            status="requested",
        ), 201
    finally:
        connection.close()


@connect_api.get("/api/connect/bookings")
def list_bookings():
    connection = _database()
    try:
        user, error = _require_user(connection)
        if error:
            return error
        column = "student_id" if user["role"] == "student" else "teacher_id"
        rows = connection.execute(
            f"""
            SELECT b.id, b.student_id, b.teacher_id, b.status, b.mode, b.evaluation,
                   s.starts_at, s.ends_at, student.name AS student_name, teacher.name AS teacher_name,
                   r.status AS review_status
            FROM connect_bookings b
            JOIN connect_slots s ON s.id = b.slot_id
            JOIN users student ON student.id = b.student_id
            JOIN users teacher ON teacher.id = b.teacher_id
            LEFT JOIN connect_reviews r ON r.booking_id = b.id
            WHERE b.{column} = ? ORDER BY s.starts_at DESC LIMIT 50
            """,
            (user["id"],),
        ).fetchall()
        return jsonify(bookings=[dict(row) for row in rows])
    finally:
        connection.close()


@connect_api.post("/api/connect/bookings/<int:booking_id>/status")
def update_booking(booking_id):
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    action = data.get("action")
    evaluation = data.get("evaluation", "").strip() if isinstance(data.get("evaluation"), str) else ""
    connection = _database()
    try:
        user, error = _require_user(connection)
        if error:
            return error
        connection.execute("BEGIN IMMEDIATE")
        booking = connection.execute(
            "SELECT * FROM connect_bookings WHERE id = ?",
            (booking_id,),
        ).fetchone()
        if not booking:
            connection.rollback()
            return jsonify(error="Pemesanan tidak ditemukan."), 404
        is_teacher = user["role"] == "teacher" and booking["teacher_id"] == user["id"]
        is_student = user["role"] == "student" and booking["student_id"] == user["id"]
        if is_teacher and action in ("confirm", "decline", "complete") and not _teacher_verified(connection, user["id"]):
            connection.rollback()
            return jsonify(error="Akun Ustad Connect menunggu verifikasi identitas dan kompetensi oleh admin."), 403
        if action in ("confirm", "decline", "complete") and is_teacher:
            expected, status = {
                "confirm": ("requested", "confirmed"),
                "decline": ("requested", "declined"),
                "complete": ("confirmed", "completed"),
            }[action]
            if booking["status"] != expected:
                connection.rollback()
                return jsonify(error="Status pemesanan sudah berubah atau tindakan tidak tersedia."), 409
            if action == "complete" and not 10 <= len(evaluation) <= 1000:
                connection.rollback()
                return jsonify(error="Catatan evaluasi harus berisi 10–1000 karakter."), 400
            connection.execute(
                "UPDATE connect_bookings SET status = ?, evaluation = ? WHERE id = ?",
                (status, evaluation if action == "complete" else booking["evaluation"], booking_id),
            )
            if action == "decline":
                connection.execute(
                    "UPDATE connect_slots SET status = 'available', booking_id = NULL WHERE booking_id = ?",
                    (booking_id,),
                )
        elif action == "cancel" and (is_teacher or is_student) and booking["status"] in ("requested", "confirmed"):
            connection.execute(
                "UPDATE connect_bookings SET status = 'cancelled' WHERE id = ?",
                (booking_id,),
            )
            connection.execute(
                """
                UPDATE connect_slots SET status = 'available', booking_id = NULL
                WHERE booking_id = ? AND starts_at > ?
                """,
                (booking_id, datetime.now(timezone.utc).isoformat(timespec="seconds")),
            )
        else:
            connection.rollback()
            return jsonify(error="Anda tidak berwenang atau tindakan ini tidak sesuai status sesi."), 403
        connection.commit()
        return jsonify(message="Status sesi berhasil diperbarui.", status=status if action != "cancel" else "cancelled")
    finally:
        connection.close()


@connect_api.post("/api/connect/reviews")
def submit_review():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    booking_id = data.get("booking_id")
    rating = data.get("rating")
    comment = data.get("comment", "").strip() if isinstance(data.get("comment"), str) else ""
    if type(booking_id) is not int or type(rating) is not int or not 1 <= rating <= 5 or len(comment) > 500:
        return jsonify(error="Penilaian tidak valid. Pilih bintang 1–5 dan komentar maksimal 500 karakter."), 400
    connection = _database()
    try:
        user, error = _require_user(connection, "student")
        if error:
            return error
        booking = connection.execute(
            "SELECT teacher_id FROM connect_bookings WHERE id = ? AND student_id = ? AND status = 'completed'",
            (booking_id, user["id"]),
        ).fetchone()
        if not booking:
            return jsonify(error="Ulasan hanya dapat dikirim setelah sesi selesai."), 409
        try:
            connection.execute(
                """
                INSERT INTO connect_reviews (booking_id, student_id, teacher_id, rating, comment)
                VALUES (?, ?, ?, ?, ?)
                """,
                (booking_id, user["id"], booking["teacher_id"], rating, comment),
            )
            connection.commit()
        except sqlite3.IntegrityError:
            connection.rollback()
            return jsonify(error="Ulasan untuk sesi ini sudah pernah dikirim."), 409
        return jsonify(message="Ulasan dikirim dan akan ditampilkan setelah ditinjau admin."), 201
    finally:
        connection.close()


@connect_api.post("/api/connect/reports")
def submit_report():
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    reason = data.get("reason", "").strip() if isinstance(data.get("reason"), str) else ""
    details = data.get("details", "").strip() if isinstance(data.get("details"), str) else ""
    booking_id = data.get("booking_id")
    if reason not in ("safety", "conduct", "payment", "other") or len(details) > 1000:
        return jsonify(error="Pilih alasan pelaporan yang valid dan gunakan maksimal 1000 karakter."), 400
    if booking_id is not None and type(booking_id) is not int:
        return jsonify(error="Referensi sesi tidak valid."), 400
    connection = _database()
    try:
        user, error = _require_user(connection)
        if error:
            return error
        if booking_id is not None:
            booking = connection.execute(
                """
                SELECT id FROM connect_bookings
                WHERE id = ? AND (student_id = ? OR teacher_id = ?)
                """,
                (booking_id, user["id"], user["id"]),
            ).fetchone()
            if not booking:
                return jsonify(error="Sesi tidak ditemukan atau bukan milik akun Anda."), 404
        connection.execute(
            "INSERT INTO connect_reports (reporter_id, booking_id, reason, details) VALUES (?, ?, ?, ?)",
            (user["id"], booking_id, reason, details),
        )
        connection.commit()
        return jsonify(message="Laporan terkirim. Tim admin akan meninjaunya."), 201
    finally:
        connection.close()


@connect_api.get("/api/connect/admin/moderation")
def moderation_queue():
    if not session.get("admin_authenticated"):
        return jsonify(error="Akses admin diperlukan."), 403
    connection = _database()
    try:
        reviews = connection.execute(
            """
            SELECT r.id, r.rating, r.comment, r.created_at, teacher.name AS teacher_name,
                   student.name AS student_name
            FROM connect_reviews r
            JOIN users teacher ON teacher.id = r.teacher_id
            JOIN users student ON student.id = r.student_id
            WHERE r.status = 'pending' ORDER BY r.created_at
            """
        ).fetchall()
        reports = connection.execute(
            """
            SELECT r.id, r.booking_id, r.reason, r.details, r.created_at, reporter.name AS reporter_name
            FROM connect_reports r JOIN users reporter ON reporter.id = r.reporter_id
            WHERE r.status = 'pending' ORDER BY r.created_at
            """
        ).fetchall()
        return jsonify(reviews=[dict(row) for row in reviews], reports=[dict(row) for row in reports])
    finally:
        connection.close()


@connect_api.post("/api/connect/admin/moderation/<kind>/<int:item_id>")
def decide_moderation(kind, item_id):
    if not session.get("admin_authenticated"):
        return jsonify(error="Akses admin diperlukan."), 403
    if not _csrf_valid():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = _json_body()
    decision = data.get("decision")
    if kind not in ("reviews", "reports") or decision not in ("approve", "reject"):
        return jsonify(error="Keputusan moderasi tidak valid."), 400
    table, status = ("connect_reviews", "approved" if decision == "approve" else "rejected") if kind == "reviews" else (
        "connect_reports",
        "reviewed" if decision == "approve" else "dismissed",
    )
    connection = _database()
    try:
        cursor = connection.execute(
            f"UPDATE {table} SET status = ? WHERE id = ? AND status = 'pending'",
            (status, item_id),
        )
        connection.commit()
        if cursor.rowcount != 1:
            return jsonify(error="Item moderasi tidak ditemukan atau sudah ditinjau."), 404
        return jsonify(message="Keputusan moderasi disimpan.")
    finally:
        connection.close()
