import hmac
import hashlib
import html
import os
import re
import secrets
import sqlite3
import smtplib
import ssl
import time
from email.message import EmailMessage
from email.utils import formataddr
from functools import wraps
from urllib.parse import urljoin, urlsplit

from flask import Blueprint, current_app, jsonify, redirect, render_template, request, session, url_for
from werkzeug.security import check_password_hash, generate_password_hash


auth_api = Blueprint("auth_api", __name__)
PASSWORD_RESET_TTL_SECONDS = 15 * 60
PASSWORD_RESET_MAX_REQUESTS = 3


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
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS password_reset_tokens (
                token_hash TEXT PRIMARY KEY,
                user_id INTEGER NOT NULL,
                created_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS password_reset_tokens_user
                ON password_reset_tokens(user_id);
            CREATE TABLE IF NOT EXISTS password_reset_requests (
                email_key TEXT NOT NULL,
                requested_at INTEGER NOT NULL
            );
            CREATE INDEX IF NOT EXISTS password_reset_requests_window
                ON password_reset_requests(email_key, requested_at);
            """
        )
        connection.commit()
    finally:
        connection.close()


def _password_reset_response(template, **context):
    response = current_app.make_response(render_template(template, **context))
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


def _password_reset_email_key(email):
    secret = current_app.config["SECRET_KEY"]
    key = secret if isinstance(secret, bytes) else str(secret).encode("utf-8")
    return hmac.new(key, email.encode("utf-8"), hashlib.sha256).hexdigest()


def _password_reset_public_url(token):
    base_url = current_app.config.get("PUBLIC_BASE_URL", "").strip()
    parsed = urlsplit(base_url)
    if (
        parsed.scheme != "https"
        or not parsed.netloc
        or parsed.hostname in ("localhost", "127.0.0.1", "::1")
        or parsed.username
        or parsed.password
    ):
        return None
    reset_path = url_for("auth_api.reset_password")
    return f"{urljoin(base_url.rstrip('/') + '/', reset_path.lstrip('/'))}#{token}"


def _send_password_reset_email(user, reset_url):
    smtp_username = current_app.config.get("SMTP_USERNAME", "").strip()
    smtp_password = current_app.config.get("SMTP_APP_PASSWORD", "")
    sender = current_app.config.get("SMTP_FROM_EMAIL", "").strip() or smtp_username
    if not smtp_username or not smtp_password or not sender:
        current_app.logger.error("Password reset email is not configured.")
        return False

    name = html.escape(user["name"])
    message = EmailMessage()
    message["Subject"] = "Reset password akun Ustad Online"
    message["From"] = formataddr(("Ustad Online", sender))
    message["To"] = user["email"]
    message.set_content(
        f"Halo {user['name']},\n\n"
        "Kami menerima permintaan untuk mengatur ulang password akun Ustad Online Anda. "
        "Gunakan tautan berikut dalam 15 menit:\n"
        f"{reset_url}\n\n"
        "Jika Anda tidak meminta reset password, abaikan email ini."
    )
    message.add_alternative(
        f"""\
<!doctype html>
<html lang="id">
  <body style="margin:0;background:#f4f7f3;font-family:Arial,sans-serif;color:#243b32">
    <div style="max-width:560px;margin:32px auto;background:#fff;border:1px solid #e1e9df;border-radius:16px;overflow:hidden">
      <div style="padding:24px 30px;background:#123b37;color:#fff;font-size:18px;font-weight:bold">Ustad Online</div>
      <div style="padding:30px">
        <p>Halo {name},</p>
        <p>Kami menerima permintaan untuk mengatur ulang password akun Ustad Online Anda.</p>
        <p style="margin:28px 0"><a href="{html.escape(reset_url, quote=True)}" style="display:inline-block;background:#17684f;color:#fff;text-decoration:none;padding:13px 22px;border-radius:9px;font-weight:bold">Reset Password</a></p>
        <p>Link ini hanya berlaku selama <strong>15 menit</strong> dan hanya dapat digunakan satu kali.</p>
        <p>Jika Anda tidak meminta reset password, email ini dapat diabaikan. Password Anda tidak akan berubah.</p>
        <p style="margin-top:24px;color:#68776d;font-size:13px">Jika tombol tidak berfungsi, salin link berikut ke browser:<br><a href="{html.escape(reset_url, quote=True)}" style="color:#17684f;word-break:break-all">{html.escape(reset_url)}</a></p>
      </div>
    </div>
  </body>
</html>""",
        subtype="html",
    )

    try:
        with smtplib.SMTP("smtp.gmail.com", 587, timeout=15) as smtp:
            smtp.ehlo()
            smtp.starttls(context=ssl.create_default_context())
            smtp.ehlo()
            smtp.login(smtp_username, smtp_password)
            smtp.send_message(message)
    except (OSError, smtplib.SMTPException) as error:
        current_app.logger.error(
            "Password reset email delivery failed (%s).",
            type(error).__name__,
        )
        return False
    return True


def _password_reset_token_state(connection, token, now):
    if not isinstance(token, str) or not token or len(token) > 200:
        return "invalid", None
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    row = connection.execute(
        "SELECT user_id, created_at FROM password_reset_tokens WHERE token_hash = ?",
        (token_hash,),
    ).fetchone()
    if not row:
        return "invalid", None
    age = now - row["created_at"]
    if age < 0 or age >= PASSWORD_RESET_TTL_SECONDS:
        return "expired", row["user_id"]
    return "valid", row["user_id"]


def _reset_page(token="", state="check", feedback=""):
    return _password_reset_response(
        "reset_password.html",
        csrf_token=_csrf_token(),
        reset_token=token,
        reset_state=state,
        feedback=feedback,
    )


def _csrf_token():
    if "csrf_token" not in session:
        session["csrf_token"] = secrets.token_urlsafe(32)
    return session["csrf_token"]


def _clear_auth_session():
    language = session.get("ui_language")
    session.clear()
    if language in ("id", "en", "ar"):
        session["ui_language"] = language


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
    return {
        "id": None,
        "name": "Admin",
        "email": "",
        "role": "admin",
        "status": "approved",
        "phone": "",
        "username": "",
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


@auth_api.route("/api/preferences/language", methods=["GET", "POST"])
def language_preference():
    if request.method == "GET":
        language = session.get("ui_language", "id")
        if language not in ("id", "en", "ar"):
            language = "id"
        return jsonify(language=language, csrf_token=_csrf_token())
    if not _valid_csrf():
        return jsonify(error="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi."), 400
    data = request.get_json(silent=True)
    language = data.get("language") if isinstance(data, dict) else None
    if language not in ("id", "en", "ar"):
        return jsonify(error="Pilihan bahasa tidak valid."), 400
    session["ui_language"] = language
    return jsonify(language=language)


@auth_api.route("/auth/forgot-password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "GET":
        return _password_reset_response(
            "forgot_password.html",
            csrf_token=_csrf_token(),
            feedback="",
        )
    if not _valid_csrf():
        return _password_reset_response(
            "forgot_password.html",
            csrf_token=_csrf_token(),
            feedback="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi.",
        ), 400

    email = request.form.get("email", "")
    email = email.strip().lower() if isinstance(email, str) else ""
    email_key = _password_reset_email_key(email)
    now = int(time.time())
    token = None
    token_hash = None
    user = None

    connection = _database()
    try:
        connection.execute("BEGIN IMMEDIATE")
        connection.execute(
            "DELETE FROM password_reset_requests WHERE requested_at < ?",
            (now - PASSWORD_RESET_TTL_SECONDS,),
        )
        request_count = connection.execute(
            """
            SELECT COUNT(*) FROM password_reset_requests
            WHERE email_key = ? AND requested_at >= ?
            """,
            (email_key, now - PASSWORD_RESET_TTL_SECONDS),
        ).fetchone()[0]
        if request_count < PASSWORD_RESET_MAX_REQUESTS:
            connection.execute(
                "INSERT INTO password_reset_requests (email_key, requested_at) VALUES (?, ?)",
                (email_key, now),
            )
            if (
                len(email) <= 254
                and re.fullmatch(r"[^@\s]+@[^@\s]+\.[^@\s]+", email)
            ):
                user = connection.execute(
                    "SELECT id, name, email FROM users WHERE email = ?",
                    (email,),
                ).fetchone()
                if user:
                    token = secrets.token_urlsafe(32)
                    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
                    connection.execute(
                        "DELETE FROM password_reset_tokens WHERE user_id = ?",
                        (user["id"],),
                    )
                    connection.execute(
                        """
                        INSERT INTO password_reset_tokens (token_hash, user_id, created_at)
                        VALUES (?, ?, ?)
                        """,
                        (token_hash, user["id"], now),
                    )
        connection.commit()
    finally:
        connection.close()

    if user and token:
        reset_url = _password_reset_public_url(token)
        if reset_url:
            sent = _send_password_reset_email(user, reset_url)
        else:
            current_app.logger.error("Password reset public URL is not configured.")
            sent = False
        if not sent:
            connection = _database()
            try:
                connection.execute(
                    "DELETE FROM password_reset_tokens WHERE token_hash = ?",
                    (token_hash,),
                )
                connection.commit()
            finally:
                connection.close()

    return _password_reset_response(
        "forgot_password.html",
        csrf_token=_csrf_token(),
        feedback="Jika alamat email terdaftar, kami akan mengirimkan tautan reset password.",
    )


@auth_api.post("/auth/reset-password/check")
def check_password_reset_token():
    if not _valid_csrf():
        response = jsonify(error="Sesi formulir tidak valid.")
        response.headers["Cache-Control"] = "no-store"
        return response, 400
    data = request.get_json(silent=True)
    token = data.get("token") if isinstance(data, dict) else None
    connection = _database()
    try:
        state, _ = _password_reset_token_state(connection, token, int(time.time()))
    finally:
        connection.close()
    response = jsonify(state=state)
    response.headers["Cache-Control"] = "no-store"
    response.headers["Referrer-Policy"] = "no-referrer"
    return response


@auth_api.route("/auth/reset-password", methods=["GET", "POST"])
def reset_password():
    if request.method == "GET":
        return _reset_page()
    token = request.form.get("token", "")
    if not _valid_csrf():
        return _reset_page(
            token=token,
            state="valid",
            feedback="Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi.",
        ), 400

    now = int(time.time())
    connection = _database()
    try:
        state, _ = _password_reset_token_state(connection, token, now)
    finally:
        connection.close()
    if state != "valid":
        feedback = (
            "Tautan reset sudah kedaluwarsa. Minta tautan baru untuk melanjutkan."
            if state == "expired"
            else "Tautan reset tidak valid atau sudah pernah digunakan. Minta tautan baru untuk melanjutkan."
        )
        return _reset_page(state=state, feedback=feedback)

    password = request.form.get("password", "")
    confirmation = request.form.get("password_confirmation", "")
    if not 8 <= len(password) <= 128:
        return _reset_page(
            token=token,
            state="valid",
            feedback="Password baru harus terdiri dari 8 sampai 128 karakter.",
        )
    if password != confirmation:
        return _reset_page(
            token=token,
            state="valid",
            feedback="Konfirmasi password tidak sama.",
        )

    connection = _database()
    try:
        connection.execute("BEGIN IMMEDIATE")
        state, user_id = _password_reset_token_state(connection, token, int(time.time()))
        if state != "valid":
            connection.rollback()
            feedback = (
                "Tautan reset sudah kedaluwarsa. Minta tautan baru untuk melanjutkan."
                if state == "expired"
                else "Tautan reset tidak valid atau sudah pernah digunakan. Minta tautan baru untuk melanjutkan."
            )
            return _reset_page(state=state, feedback=feedback)
        connection.execute(
            "UPDATE users SET password_hash = ? WHERE id = ?",
            (generate_password_hash(password), user_id),
        )
        connection.execute(
            "DELETE FROM password_reset_tokens WHERE user_id = ?",
            (user_id,),
        )
        connection.commit()
    finally:
        connection.close()

    _clear_auth_session()
    return _reset_page(
        state="done",
        feedback="Password berhasil diubah. Silakan masuk dengan password baru.",
    )


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

    _clear_auth_session()
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
        password = data.get("password", "")
        if not isinstance(password, str) or not hmac.compare_digest(password, configured_password):
            return jsonify(error="Kata sandi admin tidak cocok."), 401
        _clear_auth_session()
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

    _clear_auth_session()
    session["user_id"] = row["id"]
    token = _csrf_token()
    return jsonify(user=_user_dict(row), csrf_token=token)


@auth_api.post("/api/auth/logout")
def logout():
    if not _valid_csrf():
        return _csrf_error()
    _clear_auth_session()
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
    _clear_auth_session()
    session["admin_authenticated"] = True
    _csrf_token()
    return redirect(url_for("auth_api.review_teachers"))


@auth_api.post("/review/logout")
def review_logout():
    if not _valid_csrf():
        return _csrf_error()
    switch_account = request.form.get("switch_account") == "1"
    _clear_auth_session()
    if switch_account:
        return redirect(url_for("home"))
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
