import hmac
import os
import re
import secrets
import sqlite3
from functools import wraps

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


auth_api = Blueprint("auth_api", __name__)


def _database():
    path = current_app.config["AUTH_DATABASE"]
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def init_auth_db(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    connection = sqlite3.connect(path)
    try:
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('student', 'teacher')),
                status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
                phone TEXT NOT NULL DEFAULT '',
                experience TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        connection.commit()
    finally:
        connection.close()


def _csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return session["csrf_token"]


def _valid_csrf():
    expected = session.get("csrf_token", "")
    supplied = request.headers.get("X-CSRF-Token") or request.form.get("csrf_token", "")
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


def _user_dict(row):
    return {
        "id": row["id"],
        "name": row["name"],
        "email": row["email"],
        "role": row["role"],
        "status": row["status"],
        "phone": row["phone"],
        "username": row["username"],
        "bio": row["bio"],
    }


def _current_user():
    user_id = session.get("user_id")
    if not user_id:
        return None
    connection = _database()
    try:
        row = connection.execute(
            "SELECT * FROM users WHERE id = ?",
            (user_id,),
        ).fetchone()
    finally:
        connection.close()
    if not row or row["status"] != "approved":
        session.pop("user_id", None)
        return None
    return _user_dict(row)


def _csrf_error():
    return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400


def _admin_required(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        if not current_app.config.get("USTAD_ADMIN_PASSWORD"):
            return render_template("teacher_review.html", setup_required=True), 503
        if not session.get("admin_authenticated"):
            return render_template(
                "teacher_review.html",
                setup_required=False,
                authenticated=False,
                csrf_token=_csrf_token(),
            )
        return view(*args, **kwargs)

    return wrapped


@auth_api.get("/api/auth/session")
def auth_session():
    return jsonify(user=_current_user(), csrf_token=_csrf_token())


@auth_api.post("/api/auth/register")
def register():
    if not _valid_csrf():
        return _csrf_error()
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    name = data.get("name", "").strip() if isinstance(data.get("name"), str) else ""
    email = data.get("email", "").strip().lower() if isinstance(data.get("email"), str) else ""
    password = data.get("password", "") if isinstance(data.get("password"), str) else ""
    phone = data.get("phone", "").strip() if isinstance(data.get("phone"), str) else ""
    experience = data.get("experience", "").strip() if isinstance(data.get("experience"), str) else ""

    if role not in ("student", "teacher"):
        return jsonify(error="Pilih jenis akun yang tersedia."), 400
    if not 2 <= len(name) <= 60:
        return jsonify(error="Nama harus terdiri dari 2 sampai 60 karakter."), 400
    if len(email) > 120 or not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify(error="Masukkan alamat email yang valid."), 400
    if not 8 <= len(password) <= 128:
        return jsonify(error="Kata sandi harus terdiri dari 8 sampai 128 karakter."), 400
    if role == "teacher":
        if not 8 <= len(phone) <= 24:
            return jsonify(error="Masukkan nomor WhatsApp aktif untuk proses verifikasi."), 400
        if not 20 <= len(experience) <= 1000:
            return jsonify(error="Ceritakan pengalaman mengajar minimal 20 karakter."), 400

    status = "approved" if role == "student" else "pending"
    connection = _database()
    try:
        cursor = connection.execute(
            """
            INSERT INTO users (name, email, password_hash, role, status, phone, experience)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                name,
                email,
                generate_password_hash(password),
                role,
                status,
                phone if role == "teacher" else "",
                experience if role == "teacher" else "",
            ),
        )
        user_id = cursor.lastrowid
        connection.commit()
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user_id,)).fetchone()
    except sqlite3.IntegrityError:
        connection.rollback()
        return jsonify(error="Email ini sudah terdaftar. Silakan masuk dengan jenis akun yang sesuai."), 409
    finally:
        connection.close()

    if role == "teacher":
        return jsonify(
            status="pending",
            message="Pengajuan ustad terkirim. Akun akan aktif setelah admin meninjau dan menghubungi Anda melalui email atau WhatsApp.",
        ), 202

    session.clear()
    session["user_id"] = user_id
    token = _csrf_token()
    return jsonify(user=_user_dict(row), csrf_token=token), 201


@auth_api.post("/api/auth/login")
def login():
    if not _valid_csrf():
        return _csrf_error()
    data = request.get_json(silent=True) or {}
    role = data.get("role")
    email = data.get("email", "").strip().lower() if isinstance(data.get("email"), str) else ""
    password = data.get("password", "") if isinstance(data.get("password"), str) else ""
    if role not in ("student", "teacher") or not email or not password:
        return jsonify(error="Lengkapi email dan kata sandi."), 400

    connection = _database()
    try:
        row = connection.execute(
            "SELECT * FROM users WHERE email = ?",
            (email,),
        ).fetchone()
    finally:
        connection.close()
    if not row or not check_password_hash(row["password_hash"], password):
        return jsonify(error="Email atau kata sandi tidak sesuai."), 401
    if row["role"] != role:
        return jsonify(error="Jenis akun tidak sesuai. Pilih tab Siswa atau Ustad yang benar."), 403
    if row["status"] == "pending":
        return jsonify(
            error="Pengajuan ustad masih ditinjau. Akun ustad belum dapat digunakan.",
            status="pending",
        ), 403
    if row["status"] == "rejected":
        return jsonify(
            error="Pengajuan ustad belum disetujui. Silakan hubungi admin melalui kontak yang tersedia.",
            status="rejected",
        ), 403

    session.clear()
    session["user_id"] = row["id"]
    token = _csrf_token()
    return jsonify(user=_user_dict(row), csrf_token=token)


@auth_api.post("/api/auth/logout")
def logout():
    if not _valid_csrf():
        return _csrf_error()
    session.clear()
    return jsonify(user=None, csrf_token=_csrf_token())


@auth_api.post("/api/auth/profile")
def update_profile():
    if not _valid_csrf():
        return _csrf_error()
    user = _current_user()
    if not user:
        return jsonify(error="Silakan masuk kembali."), 401
    data = request.get_json(silent=True) or {}
    name = data.get("name", "").strip() if isinstance(data.get("name"), str) else ""
    username = data.get("username", "").strip() if isinstance(data.get("username"), str) else ""
    bio = data.get("bio", "").strip() if isinstance(data.get("bio"), str) else ""
    if not 2 <= len(name) <= 60:
        return jsonify(error="Nama harus terdiri dari 2 sampai 60 karakter."), 400
    if len(username) > 30 or len(bio) > 160:
        return jsonify(error="Nama pengguna maksimal 30 karakter dan tentang saya maksimal 160 karakter."), 400

    connection = _database()
    try:
        connection.execute(
            "UPDATE users SET name = ?, username = ?, bio = ? WHERE id = ?",
            (name, username, bio, user["id"]),
        )
        connection.commit()
        row = connection.execute("SELECT * FROM users WHERE id = ?", (user["id"],)).fetchone()
    finally:
        connection.close()
    return jsonify(user=_user_dict(row))


@auth_api.get("/review/teachers")
@_admin_required
def review_teachers():
    connection = _database()
    try:
        pending = connection.execute(
            """
            SELECT id, name, email, phone, experience, created_at
            FROM users WHERE role = 'teacher' AND status = 'pending'
            ORDER BY created_at ASC
            """
        ).fetchall()
        unverified = connection.execute(
            """
            SELECT u.id, u.name, u.email, u.phone, u.experience, u.created_at
            FROM users u
            LEFT JOIN connect_teacher_verifications v ON v.teacher_id = u.id
            WHERE u.role = 'teacher' AND u.status = 'approved' AND v.teacher_id IS NULL
            ORDER BY u.created_at ASC
            """
        ).fetchall()
    finally:
        connection.close()
    applications = []
    for row in pending:
        application = dict(row)
        digits = re.sub(r"\D", "", application["phone"])
        if digits.startswith("0"):
            digits = "62" + digits[1:]
        application["whatsapp_number"] = digits
        applications.append(application)
    return render_template(
        "teacher_review.html",
        setup_required=False,
        authenticated=True,
        pending=applications,
        unverified=[dict(row) for row in unverified],
        csrf_token=_csrf_token(),
    )


@auth_api.post("/review/login")
def review_login():
    configured_password = current_app.config.get("USTAD_ADMIN_PASSWORD")
    if not configured_password:
        return render_template("teacher_review.html", setup_required=True), 503
    if not _valid_csrf():
        return _csrf_error()
    password = request.form.get("password", "")
    if not hmac.compare_digest(password, configured_password):
        return render_template(
            "teacher_review.html",
            setup_required=False,
            authenticated=False,
            csrf_token=_csrf_token(),
            login_error="Kata sandi admin tidak cocok.",
        ), 401
    session.clear()
    session["admin_authenticated"] = True
    _csrf_token()
    return redirect(url_for("auth_api.review_teachers"))


@auth_api.post("/review/logout")
def review_logout():
    if not _valid_csrf():
        return _csrf_error()
    session.pop("admin_authenticated", None)
    session.pop("csrf_token", None)
    return redirect(url_for("auth_api.review_teachers"))


@auth_api.post("/review/teachers/<int:user_id>")
@_admin_required
def decide_teacher(user_id):
    if not _valid_csrf():
        return _csrf_error()
    decision = request.form.get("decision")
    if decision not in ("approved", "rejected", "reverify"):
        return jsonify(error="Keputusan tidak valid."), 400
    if decision in ("approved", "reverify") and (
        request.form.get("identity_verified") != "1"
        or request.form.get("competence_verified") != "1"
    ):
        return jsonify(error="Verifikasi identitas dan kompetensi wajib dilakukan sebelum persetujuan."), 400
    connection = _database()
    try:
        if decision == "reverify":
            cursor = connection.execute(
                """
                INSERT OR IGNORE INTO connect_teacher_verifications (
                    teacher_id, identity_checked, competence_checked, verified_by
                )
                SELECT id, 1, 1, 'admin' FROM users
                WHERE id = ? AND role = 'teacher' AND status = 'approved'
                  AND NOT EXISTS (
                      SELECT 1 FROM connect_teacher_verifications WHERE teacher_id = users.id
                  )
                """,
                (user_id,),
            )
        else:
            cursor = connection.execute(
                """
                UPDATE users SET status = ?
                WHERE id = ? AND role = 'teacher' AND status = 'pending'
                """,
                (decision, user_id),
            )
        if cursor.rowcount == 1 and decision == "approved":
            connection.execute(
                """
                INSERT INTO connect_teacher_verifications (
                    teacher_id, identity_checked, competence_checked, verified_by
                ) VALUES (?, 1, 1, 'admin')
                """,
                (user_id,),
            )
        connection.commit()
    finally:
        connection.close()
    if cursor.rowcount != 1:
        return jsonify(error="Pengajuan tidak ditemukan atau sudah diproses."), 404
    return redirect(url_for("auth_api.review_teachers"))
