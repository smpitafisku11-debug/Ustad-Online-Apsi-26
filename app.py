import os

import eventlet

eventlet.monkey_patch()

from flask import Flask, render_template
from extensions import socketio
from quran_battle import quran_battle_api

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY') or os.urandom(32)
app.config['MAX_CONTENT_LENGTH'] = 3 * 1024 * 1024 + 64 * 1024
socketio.init_app(app, async_mode='eventlet')
app.register_blueprint(quran_battle_api)

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
