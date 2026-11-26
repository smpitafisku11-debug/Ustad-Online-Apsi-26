import hmac
import hashlib
import os
import re
import secrets
import smtplib
import sqlite3
from datetime import datetime, timedelta
from email.message import EmailMessage
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
        table_sql = connection.execute(
            "SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'users'"
        ).fetchone()
        if table_sql and "'admin'" not in (table_sql[0] or ""):
            connection.execute("ALTER TABLE users RENAME TO users_legacy")
            connection.execute(
                """
                CREATE TABLE users (
                    id INTEGER PRIMARY KEY AUTOINCREMENT,
                    name TEXT NOT NULL,
                    email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                    password_hash TEXT NOT NULL,
                    role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
                    status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
                    phone TEXT NOT NULL DEFAULT '',
                    experience TEXT NOT NULL DEFAULT '',
                    username TEXT NOT NULL DEFAULT '',
                    bio TEXT NOT NULL DEFAULT '',
                    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
                )
                """
            )
            legacy_columns = {row[1] for row in connection.execute("PRAGMA table_info(users_legacy)").fetchall()}
            selected = []
            for column in ("id", "name", "email", "password_hash", "role", "status", "phone", "experience", "username", "bio", "created_at"):
                if column in legacy_columns:
                    selected.append(column)
            column_sql = ", ".join(selected)
            connection.execute(
                f"INSERT INTO users ({column_sql}) SELECT {column_sql} FROM users_legacy"
            )
            connection.execute("DROP TABLE users_legacy")
        connection.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT NOT NULL COLLATE NOCASE UNIQUE,
                password_hash TEXT NOT NULL,
                role TEXT NOT NULL CHECK (role IN ('student', 'teacher', 'admin')),
                status TEXT NOT NULL CHECK (status IN ('approved', 'pending', 'rejected')),
                phone TEXT NOT NULL DEFAULT '',
                experience TEXT NOT NULL DEFAULT '',
                username TEXT NOT NULL DEFAULT '',
                bio TEXT NOT NULL DEFAULT '',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            )
            """
        )
        columns = {row[1] for row in connection.execute("PRAGMA table_info(users)").fetchall()}
        for column, definition in (
            ("phone", "TEXT NOT NULL DEFAULT ''"),
            ("experience", "TEXT NOT NULL DEFAULT ''"),
            ("username", "TEXT NOT NULL DEFAULT ''"),
            ("bio", "TEXT NOT NULL DEFAULT ''"),
        ):
            if column not in columns:
                connection.execute(f"ALTER TABLE users ADD COLUMN {column} {definition}")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                token_hash TEXT NOT NULL UNIQUE,
                expires_at TEXT NOT NULL,
                used_at TEXT,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
            );
            CREATE INDEX IF NOT EXISTS password_reset_tokens_expiry
                ON password_reset_tokens(expires_at, used_at);
            """
        )
        connection.commit()
    finally:
        connection.close()


def ensure_admin_account(path, password):
    if not password:
        return None
    connection = sqlite3.connect(path)
    connection.row_factory = sqlite3.Row
    try:
        row = connection.execute(
            "SELECT id FROM users WHERE role = 'admin' AND username = 'FAMDI_Admin'"
        ).fetchone()
        password_hash = generate_password_hash(password)
        if row:
            connection.execute(
                """
                UPDATE users
                SET name = 'Admin FAMDI', password_hash = ?, status = 'approved'
                WHERE id = ? AND role = 'admin'
                """,
                (password_hash, row["id"]),
            )
            user_id = row["id"]
        else:
            cursor = connection.execute(
                """
                INSERT INTO users (
                    name, email, password_hash, role, status, username, bio
                ) VALUES (?, ?, ?, 'admin', 'approved', 'FAMDI_Admin', '')
                """,
                (
                    "Admin FAMDI",
                    "famdi-admin@ustadonline.local",
                    password_hash,
                ),
            )
            user_id = cursor.lastrowid
        connection.execute(
            "DELETE FROM users WHERE role = 'admin' AND id != ?",
            (user_id,),
        )
        connection.commit()
        return user_id
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


def _admin_user():
    connection = _database()
    try:
        row = connection.execute(
            "SELECT * FROM users WHERE role = 'admin' AND username = 'FAMDI_Admin'"
        ).fetchone()
    finally:
        connection.close()
    if row:
        return _user_dict(row)
    return {
        "id": None,
        "name": "Admin FAMDI",
        "email": "famdi-admin@ustadonline.local",
        "role": "admin",
        "status": "approved",
        "phone": "",
        "username": "FAMDI_Admin",
        "bio": "",
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
    user = _admin_user() if session.get("admin_authenticated") else _current_user()
    return jsonify(user=user, csrf_token=_csrf_token())


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
    if role == "admin":
        configured_password = current_app.config.get("USTAD_ADMIN_PASSWORD")
        if not configured_password:
            return jsonify(
                error="Login admin belum dikonfigurasi di server. Atur USTAD_ADMIN_PASSWORD pada environment server lalu mulai ulang aplikasi."
            ), 503
        username = data.get("username", "FAMDI_Admin")
        if not isinstance(username, str) or username.strip() != "FAMDI_Admin":
            return jsonify(error="Username admin tidak sesuai."), 401
        password = data.get("password", "")
        if not isinstance(password, str):
            return jsonify(error="Kata sandi admin tidak cocok."), 401
        connection = _database()
        try:
            admin = connection.execute(
                "SELECT * FROM users WHERE role = 'admin' AND username = 'FAMDI_Admin'"
            ).fetchone()
        finally:
            connection.close()
        valid_password = bool(admin and check_password_hash(admin["password_hash"], password))
        if not valid_password:
            valid_password = hmac.compare_digest(password, configured_password)
        if not valid_password:
            return jsonify(error="Kata sandi admin tidak cocok."), 401
        session.clear()
        session["admin_authenticated"] = True
        return jsonify(user=_admin_user(), csrf_token=_csrf_token())

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


def _send_password_reset_email(email, reset_url):
    username = os.environ.get("GMAIL_USER") or os.environ.get("MAIL_USERNAME")
    app_password = os.environ.get("GMAIL_APP_PASSWORD") or os.environ.get("MAIL_PASSWORD")
    if not username or not app_password:
        return False
    sender = os.environ.get("GMAIL_FROM") or os.environ.get("MAIL_FROM") or username
    message = EmailMessage()
    message["Subject"] = "Reset kata sandi Ustad Online"
    message["From"] = sender
    message["To"] = email
    message.set_content(
        "Anda meminta reset kata sandi Ustad Online.\n\n"
        f"Buka tautan berikut dalam 30 menit:\n{reset_url}\n\n"
        "Jika Anda tidak meminta reset ini, abaikan email ini."
    )
    host = os.environ.get("GMAIL_SMTP_HOST") or "smtp.gmail.com"
    port = int(os.environ.get("GMAIL_SMTP_PORT") or "465")
    if port == 465:
        with smtplib.SMTP_SSL(host, port, timeout=15) as smtp:
            smtp.login(username, app_password)
            smtp.send_message(message)
    else:
        with smtplib.SMTP(host, port, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls()
            smtp.login(username, app_password)
            smtp.send_message(message)
    return True


@auth_api.post("/api/auth/forgot-password")
def forgot_password():
    if not _valid_csrf():
        return _csrf_error()
    data = request.get_json(silent=True) or {}
    email = data.get("email", "").strip().lower() if isinstance(data.get("email"), str) else ""
    generic = "Jika email terdaftar, tautan reset akan dikirim melalui email."
    if not re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email):
        return jsonify(message=generic), 200
    connection = _database()
    try:
        row = connection.execute(
            "SELECT id, email FROM users WHERE email = ? AND role != 'admin'",
            (email,),
        ).fetchone()
        if row:
            token = secrets.token_urlsafe(32)
            token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
            connection.execute(
                "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE user_id = ? AND used_at IS NULL",
                (row["id"],),
            )
            connection.execute(
                """
                INSERT INTO password_reset_tokens (user_id, token_hash, expires_at)
                VALUES (?, ?, ?)
                """,
                (
                    row["id"],
                    token_hash,
                    (datetime.now() + timedelta(minutes=30)).strftime("%Y-%m-%d %H:%M:%S"),
                ),
            )
            connection.commit()
            reset_url = url_for("auth_api.reset_password_page", token=token, _external=True)
            try:
                if not _send_password_reset_email(email, reset_url):
                    current_app.logger.warning("Password reset requested but Gmail SMTP is not configured.")
            except Exception as exc:
                current_app.logger.error("Password reset email failed: %s", exc)
    finally:
        connection.close()
    return jsonify(message=generic), 200


@auth_api.get("/reset-password/<token>")
def reset_password_page(token):
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    connection = _database()
    try:
        row = connection.execute(
            """
            SELECT id FROM password_reset_tokens
            WHERE token_hash = ? AND used_at IS NULL AND expires_at > CURRENT_TIMESTAMP
            """,
            (token_hash,),
        ).fetchone()
    finally:
        connection.close()
    if not row:
        return render_template("reset_password.html", invalid=True, csrf_token=_csrf_token())
    return render_template("reset_password.html", token=token, invalid=False, csrf_token=_csrf_token())


@auth_api.post("/api/auth/reset-password")
def reset_password():
    if not _valid_csrf():
        return _csrf_error()
    data = request.get_json(silent=True) or {}
    token = data.get("token", "")
    password = data.get("password", "")
    if not isinstance(token, str) or not isinstance(password, str) or not 8 <= len(password) <= 128:
        return jsonify(error="Tautan atau kata sandi tidak valid."), 400
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    connection = _database()
    try:
        row = connection.execute(
            """
            SELECT t.id, t.user_id
            FROM password_reset_tokens t
            JOIN users u ON u.id = t.user_id
            WHERE t.token_hash = ? AND t.used_at IS NULL
              AND t.expires_at > CURRENT_TIMESTAMP
              AND u.role != 'admin'
            """,
            (token_hash,),
        ).fetchone()
        if not row:
            return jsonify(error="Tautan reset tidak valid atau sudah kedaluwarsa."), 400
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (generate_password_hash(password), row["user_id"]),
        )
        connection.execute(
            "UPDATE password_reset_tokens SET used_at = CURRENT_TIMESTAMP WHERE id = ?",
            (row["id"],),
        )
        connection.commit()
    finally:
        connection.close()
    return jsonify(message="Kata sandi berhasil diperbarui. Silakan masuk kembali.")


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
        stats = {
            "students": connection.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'student'"
            ).fetchone()[0],
            "teachers": connection.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'teacher'"
            ).fetchone()[0],
            "pending_teachers": connection.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND status = 'pending'"
            ).fetchone()[0],
            "approved_teachers": connection.execute(
                "SELECT COUNT(*) FROM users WHERE role = 'teacher' AND status = 'approved'"
            ).fetchone()[0],
        }
        users = connection.execute(
            """
            SELECT id, name, email, role, status, username, created_at
            FROM users
            WHERE role != 'admin'
            ORDER BY created_at DESC
            LIMIT 200
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
        stats=stats,
        users=[dict(row) for row in users],
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
    switch_account = request.form.get("switch_account") == "1"
    session.clear()
    if switch_account:
        return redirect(url_for("home"))
    return redirect(url_for("auth_api.review_teachers"))


@auth_api.post("/review/mode/<mode>")
@_admin_required
def set_admin_review_mode(mode):
    if not _valid_csrf():
        return _csrf_error()
    if mode not in ("student", "teacher", "admin"):
        return jsonify(error="Mode review tidak valid."), 400
    session["admin_review_mode"] = mode
    if mode == "teacher":
        return redirect(url_for("connect_api.ustad_dashboard"))
    if mode == "student":
        return redirect(url_for("home"))
    session.pop("admin_review_mode", None)
    return redirect(url_for("auth_api.review_teachers"))


@auth_api.post("/review/users/<int:user_id>")
@_admin_required
def manage_user(user_id):
    if not _valid_csrf():
        return _csrf_error()
    action = request.form.get("action")
    if action not in ("approve", "reject", "disable", "restore"):
        return jsonify(error="Aksi pengguna tidak valid."), 400
    status = {
        "approve": "approved",
        "reject": "rejected",
        "disable": "rejected",
        "restore": "approved",
    }[action]
    connection = _database()
    try:
        cursor = connection.execute(
            "UPDATE users SET status = ? WHERE id = ? AND role != 'admin'",
            (status, user_id),
        )
        connection.commit()
    finally:
        connection.close()
    if cursor.rowcount != 1:
        return jsonify(error="Pengguna tidak ditemukan."), 404
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
