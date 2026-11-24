import hmac
import io
import os
import sqlite3

import eventlet

eventlet.monkey_patch()

from flask import Flask, jsonify, render_template, request, send_file, session
from auth import auth_api, init_auth_db
from extensions import socketio
from quran_battle import quran_battle_api
from community import community_api, init_community_db
from connect import connect_api, init_connect_db

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32)
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024 + 64 * 1024
app.config['AUTH_DATABASE'] = os.environ.get(
    'AUTH_DATABASE',
    os.path.join(app.instance_path, 'ustad_online.sqlite3'),
)
app.config['USTAD_ADMIN_PASSWORD'] = os.environ.get('USTAD_ADMIN_PASSWORD')
app.config['SESSION_COOKIE_HTTPONLY'] = True
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
app.config['SESSION_COOKIE_SECURE'] = os.environ.get('SESSION_COOKIE_SECURE') == '1'
socketio.init_app(app, async_mode='eventlet')
app.register_blueprint(auth_api)
app.register_blueprint(quran_battle_api)
app.register_blueprint(community_api)
app.register_blueprint(connect_api)
init_auth_db(app.config['AUTH_DATABASE'])
init_connect_db(app.config['AUTH_DATABASE'])
init_community_db(app.config['AUTH_DATABASE'])


def init_tahfidz_db():
    os.makedirs(os.path.dirname(os.path.abspath(app.config['AUTH_DATABASE'])), exist_ok=True)
    connection = sqlite3.connect(app.config['AUTH_DATABASE'])
    try:
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS tahfidz_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                student_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
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
    finally:
        connection.close()


init_tahfidz_db()

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
    return ai_tahsin()

@app.route('/tilawah')
def akademi_tilawah():
    return render_template('tilawah.html')

@app.route('/komunitas')
def komunitas():
    return render_template('komunitas.html')

@app.route('/tahfidz')
def tahfidz():
    return render_template('tahfidz.html')

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
