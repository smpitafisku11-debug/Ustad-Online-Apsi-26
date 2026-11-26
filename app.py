import hmac
import io
import os
import sqlite3

import eventlet

eventlet.monkey_patch()

from flask import Flask, jsonify, redirect, render_template, request, send_file, session, url_for
from auth import auth_api, init_auth_db
from extensions import socketio
from quran_battle import quran_battle_api
from community import community_api, init_community_db
from connect import connect_api, init_connect_db
from famdi import famdi_api, init_famdi_db


def _load_admin_password(instance_path):
    password = os.environ.get('USTAD_ADMIN_PASSWORD')
    if password:
        return password
    try:
        with open(os.path.join(instance_path, 'admin_password'), encoding='utf-8') as password_file:
            return password_file.read().strip() or None
    except FileNotFoundError:
        return None


app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32)
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024 + 64 * 1024
app.config['AUTH_DATABASE'] = os.environ.get(
    'AUTH_DATABASE',
    os.path.join(app.instance_path, 'ustad_online.sqlite3'),
)
app.config['USTAD_ADMIN_PASSWORD'] = _load_admin_password(app.instance_path)
app.config['PUBLIC_BASE_URL'] = os.environ.get('PUBLIC_BASE_URL', '').strip()
app.config['SMTP_USERNAME'] = os.environ.get('SMTP_USERNAME', '').strip()
app.config['SMTP_APP_PASSWORD'] = os.environ.get('SMTP_APP_PASSWORD', '')
app.config['SMTP_FROM_EMAIL'] = os.environ.get('SMTP_FROM_EMAIL', '').strip()
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE') == '1'
socketio.init_app(app, async_mode='eventlet')
app.register_blueprint(auth_api)
app.register_blueprint(quran_battle_api)
app.register_blueprint(community_api)
app.register_blueprint(connect_api)
app.register_blueprint(famdi_api)
init_auth_db(app.config['AUTH_DATABASE'])
init_connect_db(app.config['AUTH_DATABASE'])
init_community_db(app.config['AUTH_DATABASE'])
init_famdi_db(app.config['AUTH_DATABASE'])


def init_tahfidz_db():
    os.makedirs(os.path.dirname(os.path.abspath(app.config['AUTH_DATABASE'])), exist_ok=True)
    connection = sqlite3.connect(app.config['AUTH_DATABASE'])
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tahfidz_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
                target_key TEXT NOT NULL DEFAULT '',
                target_title TEXT NOT NULL,
                target_detail TEXT NOT NULL,
                audio BLOB NOT NULL,
                audio_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'approved', 'needs_revision')),
                review_note TEXT NOT NULL DEFAULT '',
                reviewer_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
                submitted_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                reviewed_at TEXT
            );
            CREATE INDEX IF NOT EXISTS tahfidz_submissions_student
                ON tahfidz_submissions(student_id, submitted_at);
            """
        )
        connection.commit()
        columns = {row[1] for row in connection.execute("PRAGMA table_info(tahfidz_submissions)").fetchall()}
        if 'target_key' not in columns:
            connection.execute("ALTER TABLE tahfidz_submissions ADD COLUMN target_key TEXT NOT NULL DEFAULT ''")
            connection.commit()
    finally:
        connection.close()


init_tahfidz_db()


def _tahfidz_database():
    init_tahfidz_db()
    connection = sqlite3.connect(app.config['AUTH_DATABASE'], timeout=10)
    connection.row_factory = sqlite3.Row
    return connection


def _tahfidz_current_user(connection):
    user_id = session.get('user_id')
    if not user_id:
        return None
    return connection.execute(
        "SELECT id, name, role, status FROM users WHERE id = ?",
        (user_id,),
    ).fetchone()


def _tahfidz_csrf_valid():
    expected = session.get('csrf_token', '')
    supplied = request.headers.get('X-CSRF-Token', '')
    return bool(expected and supplied and hmac.compare_digest(expected, supplied))


@app.post('/api/tahfidz/submissions')
def submit_tahfidz():
    if not _tahfidz_csrf_valid():
        return jsonify(error='Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi.'), 400
    recording = request.files.get('recording')
    target_title = request.form.get('target_title', '').strip()[:120]
    target_detail = request.form.get('target_detail', '').strip()[:500]
    target_key = request.form.get('target_key', '').strip()[:40]
    if not recording or not recording.mimetype.startswith('audio/'):
        return jsonify(error='Rekaman setoran audio tidak valid.'), 400
    if not 3 <= len(target_title) or not 3 <= len(target_detail):
        return jsonify(error='Lengkapi jenis target dan ayat atau surah yang disetorkan.'), 400
    if target_key not in ('hafalan-baru', 'murajaah-terbaru', 'murajaah-lama'):
        return jsonify(error='Pilih target hafalan yang valid.'), 400
    payload = recording.read(3 * 1024 * 1024 + 1)
    if not payload or len(payload) > 3 * 1024 * 1024:
        return jsonify(error='Rekaman kosong atau melebihi 3 MB.'), 413
    connection = _tahfidz_database()
    try:
        user = _tahfidz_current_user(connection)
        if not user or user['status'] != 'approved':
            return jsonify(error='Silakan masuk dengan akun yang sudah aktif.'), 401
        if user['role'] != 'student':
            return jsonify(error='Setoran hafalan hanya dapat dikirim oleh akun siswa.'), 403
        connection.execute(
            """
            INSERT INTO tahfidz_submissions
                (student_id, target_key, target_title, target_detail, audio, audio_type)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (user['id'], target_key, target_title, target_detail, sqlite3.Binary(payload), recording.mimetype),
        )
        connection.commit()
        return jsonify(message='Setoran hafalan dikirim dan menunggu tinjauan pengajar.'), 201
    finally:
        connection.close()


@app.get('/api/tahfidz/submissions')
def list_tahfidz_submissions():
    connection = _tahfidz_database()
    try:
        user = _tahfidz_current_user(connection)
        if not user or user['status'] != 'approved':
            return jsonify(error='Silakan masuk dengan akun yang sudah aktif.'), 401
        if user['role'] == 'teacher':
            rows = connection.execute(
                """
                SELECT s.id, s.student_id, s.target_key, s.target_title, s.target_detail, s.status,
                       s.review_note, s.submitted_at, s.reviewed_at, u.name AS student_name
                FROM tahfidz_submissions s
                JOIN users u ON u.id = s.student_id
                ORDER BY s.submitted_at DESC LIMIT 100
                """
            ).fetchall()
        else:
            rows = connection.execute(
                """
                SELECT s.id, s.target_key, s.target_title, s.target_detail, s.status,
                       s.review_note, s.submitted_at, s.reviewed_at
                FROM tahfidz_submissions s
                WHERE s.student_id = ?
                ORDER BY s.submitted_at DESC LIMIT 50
                """,
                (user['id'],),
            ).fetchall()
        return jsonify(submissions=[dict(row) for row in rows], role=user['role'])
    finally:
        connection.close()


@app.get('/api/tahfidz/submissions/<int:submission_id>/audio')
def tahfidz_submission_audio(submission_id):
    connection = _tahfidz_database()
    try:
        user = _tahfidz_current_user(connection)
        if not user or user['status'] != 'approved':
            return jsonify(error='Silakan masuk dengan akun yang sudah aktif.'), 401
        submission = connection.execute(
            "SELECT student_id, audio, audio_type FROM tahfidz_submissions WHERE id = ?",
            (submission_id,),
        ).fetchone()
        if not submission:
            return jsonify(error='Setoran tidak ditemukan atau sudah ditinjau.'), 409
        if user['role'] != 'teacher' and submission['student_id'] != user['id']:
            return jsonify(error='Rekaman hanya dapat diputar oleh pemilik atau pengajar.'), 403
        return send_file(
            io.BytesIO(submission['audio']),
            mimetype=submission['audio_type'],
            download_name='setoran-hafalan.webm',
            as_attachment=False,
        )
    finally:
        connection.close()


@app.post('/api/tahfidz/submissions/<int:submission_id>/review')
def review_tahfidz(submission_id):
    if not _tahfidz_csrf_valid():
        return jsonify(error='Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi.'), 400
    data = request.get_json(silent=True)
    data = data if isinstance(data, dict) else {}
    status = data.get('status')
    note = data.get('review_note', '').strip() if isinstance(data.get('review_note'), str) else ''
    if status not in ('approved', 'needs_revision'):
        return jsonify(error='Status tinjauan tidak valid.'), 400
    if not 3 <= len(note) <= 1000:
        return jsonify(error='Catatan tinjauan harus berisi 3–1000 karakter.'), 400
    connection = _tahfidz_database()
    try:
        user = _tahfidz_current_user(connection)
        if not user or user['status'] != 'approved' or user['role'] != 'teacher':
            return jsonify(error='Fitur tinjauan hanya untuk ustad/ustazah.'), 403
        submission = connection.execute(
            "SELECT id FROM tahfidz_submissions WHERE id = ? AND status = 'pending'",
            (submission_id,),
        ).fetchone()
        if not submission:
            return jsonify(error='Setoran tidak ditemukan atau sudah ditinjau.'), 409
        verification = connection.execute(
            """
            SELECT 1 FROM connect_teacher_verifications
            WHERE teacher_id = ? AND identity_checked = 1 AND competence_checked = 1
            """,
            (user['id'],),
        ).fetchone()
        if not verification:
            return jsonify(error='Akun pengajar belum diverifikasi untuk meninjau setoran.'), 403
        connection.execute(
            """
            UPDATE tahfidz_submissions
            SET status = ?, review_note = ?, reviewer_id = ?, reviewed_at = CURRENT_TIMESTAMP
            WHERE id = ? AND status = 'pending'
            """,
            (status, note, user['id'], submission_id),
        )
        connection.commit()
        return jsonify(message='Hasil tinjauan setoran hafalan berhasil disimpan.')
    finally:
        connection.close()

@app.route('/')
def home():
    return render_template('index.html', active_learning_endpoint='akademi_tilawah')

@app.route('/akademi')
def akademi():
    return render_template('akademi.html')

@app.route('/baca-quran')
def baca_quran():
    return render_template(
        'baca.html',
        open_quran_library=True,
        page_title="Baca Al-Qur'an | Ustad Online",
        active_learning_endpoint='akademi_tilawah',
    )

@app.route('/baca')
def baca_alquran():
    return baca_quran()

@app.route('/quran-battle')
def quran_battle():
    return render_template('quran_battle.html')

@app.route('/battle')
def battle():
    return quran_battle()

@app.route('/ai-tahsin')
def ai_tahsin():
    return render_template('ai_tahsin.html')

@app.route('/tahsin')
def tahsin():
    return redirect(url_for('akademi_tilawah'))

@app.route('/tilawah')
def akademi_tilawah():
    return render_template('tilawah.html')

@app.route('/komunitas')
def komunitas():
    return render_template('komunitas.html')

@app.route('/tahfidz')
def tahfidz():
    return render_template('tahfidz.html')

@app.route('/dzikir-doa')
def dzikir_doa():
    return render_template('dzikir_doa.html')

@app.route('/fitur')
@app.route('/fitur-tambahan')
@app.route('/pengaturan')
def fitur_tambahan():
    return render_template('fitur_tambahan.html')

@app.route('/pusat-bantuan')
def pusat_bantuan():
    return render_template('fitur_tambahan.html', open_help=True)

@app.route('/ustad-connect')
def ustad_connect():
    return render_template('ustad_connect.html')

@app.route('/connect')
def connect():
    return ustad_connect()

if __name__ == '__main__':
    socketio.run(
        app,
        host='0.0.0.0',
        port=int(os.environ.get('PORT', 5000)),
        debug=os.environ.get('FLASK_DEBUG') == '1',
    )
