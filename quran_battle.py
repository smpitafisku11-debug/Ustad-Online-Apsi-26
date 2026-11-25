import io
import hmac
import secrets
import sqlite3
import threading
import time

from flask import Blueprint, current_app, jsonify, request, send_file, session
from flask_socketio import join_room as join_socket_room
from flask_socketio import leave_room as leave_socket_room
from werkzeug.exceptions import RequestEntityTooLarge

from extensions import socketio


quran_battle_api = Blueprint("quran_battle_api", __name__)
_rooms = {}
_rooms_lock = threading.RLock()
_room_ttl = 3600


def _notify_room_update(code):
    socketio.emit("room_updated", {"code": code}, to=code)


def _event_room_code(data):
    code = data.get("code", data.get("room"))
    return code if isinstance(code, str) else None


@socketio.on("join_room")
@socketio.on("join_battle_room")
def join_battle_socket_room(data):
    if not isinstance(data, dict):
        return {"error": "Data room tidak valid."}
    code = _event_room_code(data)
    player_id = data.get("player_id")
    if not code or not isinstance(player_id, str):
        return {"error": "Identitas pemain tidak valid."}
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room or not player:
            return {"error": "Pemain tidak terdaftar di room ini."}
        join_socket_room(room["code"])
        socketio.emit(
            "status_message",
            {"msg": f'{player["name"]} telah bergabung ke ruang battle!'},
            to=room["code"],
        )
    return {"joined": True}


@socketio.on("submit_score")
def submit_battle_score(data):
    if not isinstance(data, dict):
        return {"error": "Data skor tidak valid."}
    code = _event_room_code(data)
    if not code:
        return {"error": "Kode room tidak valid."}
    response, _ = _score_submission(code, data)
    return response


@socketio.on("submit_answer")
def submit_battle_answer(data):
    if not isinstance(data, dict):
        return {"error": "Data jawaban tidak valid."}
    code = _event_room_code(data)
    if not code:
        return {"error": "Kode room tidak valid."}
    response, _ = _score_submission(code, data)
    return response


@socketio.on("leave_battle_room")
def leave_battle_socket_room(data):
    if not isinstance(data, dict):
        return {"error": "Data room tidak valid."}
    code = data.get("code")
    player_id = data.get("player_id")
    if not isinstance(code, str) or not isinstance(player_id, str):
        return {"error": "Identitas pemain tidak valid."}
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room or not player:
            return {"error": "Pemain tidak terdaftar di room ini."}
        leave_socket_room(room["code"])
    return {"left": True}


MODES = {
    "tajwid-battle": {
        "name": "Tajwid Battle",
        "kind": "choice",
        "questions": [
            {"prompt": "Apa hukum nun sukun atau tanwin bertemu huruf ba?", "options": ["Ikhfa", "Iqlab", "Idgham"], "answer": 1},
            {"prompt": "Huruf qalqalah terkumpul dalam lafaz...", "options": ["قطب جد", "يرملون", "خص ضغط قظ"], "answer": 0},
            {"prompt": "Apa hukum mim sukun bertemu mim?", "options": ["Idgham mimi", "Izhar syafawi", "Ikhfa haqiqi"], "answer": 0},
        ],
    },
    "makharij-battle": {
        "name": "Makharij Battle",
        "kind": "voice",
        "questions": [
            {"prompt": "Latih pelafalan huruf yang sedang dipelajari. Pengajar dapat memeriksa rekaman."},
            {"prompt": "Ucapkan huruf sesuai materi makharij terverifikasi. Bacaan tidak dinilai otomatis."},
            {"prompt": "Setorkan latihan makharij untuk ditinjau pengajar bila diperlukan."},
        ],
    },
    "hafalan-battle": {
        "name": "Hafalan Battle",
        "kind": "voice",
        "questions": [
            {"prompt": "Setorkan hafalan sesuai kategori yang dipilih dari materi terverifikasi."},
            {"prompt": "Bacakan hafalan yang telah dipelajari. Bacaan tidak dinilai otomatis."},
            {"prompt": "Pilih bagian hafalan yang sesuai tingkat kemampuanmu dan setorkan untuk ditinjau."},
        ],
    },
    "team-battle": {
        "name": "Team Battle",
        "kind": "choice",
        "questions": [
            {"prompt": "Berapa jumlah surat dalam Al-Qur'an?", "options": ["110", "114", "120"], "answer": 1},
            {"prompt": "Surat terpanjang dalam Al-Qur'an adalah...", "options": ["An-Nisa", "Al-Baqarah", "Ali 'Imran"], "answer": 1},
            {"prompt": "Ayat Kursi terdapat dalam surat...", "options": ["Al-Baqarah", "Al-Fatihah", "An-Nas"], "answer": 0},
        ],
    },
    "sambung-ayat": {
        "name": "Sambung Ayat",
        "kind": "voice",
        "questions": [
            {"prompt": "Lanjutkan ayat yang telah dipelajari dengan merujuk mushaf terverifikasi."},
            {"prompt": "Setorkan kelanjutan ayat pilihan dari materi yang telah diverifikasi pengajar."},
            {"prompt": "Bacakan lanjutan ayat dari materi belajar yang telah diverifikasi."},
        ],
    },
    "sambung-surat": {
        "name": "Sambung Surat",
        "kind": "choice",
        "questions": [
            {"prompt": "Surat setelah Al-Falaq dalam urutan mushaf adalah...", "options": ["Al-Ikhlas", "An-Nas", "Al-Lahab"], "answer": 1},
            {"prompt": "Surat setelah Al-Fatihah adalah...", "options": ["Al-Baqarah", "Ali 'Imran", "An-Nisa"], "answer": 0},
            {"prompt": "Surat sebelum Al-Falaq adalah...", "options": ["Al-Ikhlas", "Al-Lahab", "An-Nas"], "answer": 0},
        ],
    },
    "mutasyabihat": {
        "name": "Ayat Mutasyabihat",
        "kind": "choice",
        "questions": [
            {"prompt": "Saat membandingkan ayat yang mirip, apa yang perlu dicermati?", "options": ["Perbedaan kata dan urutannya", "Warna sampul mushaf", "Ukuran layar"], "answer": 0},
            {"prompt": "Apa cara yang baik untuk menguatkan hafalan ayat mirip?", "options": ["Bandingkan lafaz dan konteksnya", "Hindari murajaah", "Abaikan tanda waqaf"], "answer": 0},
            {"prompt": "Petunjuk yang membantu membedakan ayat serupa adalah...", "options": ["Konteks dan kata di sekitarnya", "Warna halaman", "Jenis perangkat"], "answer": 0},
        ],
    },
    "nama-surat": {
        "name": "Tebak Surah",
        "kind": "choice",
        "questions": [
            {"prompt": "Surat pembuka Al-Qur'an yang terdiri dari tujuh ayat adalah...", "options": ["Al-Fatihah", "Al-Ikhlas", "Al-Kautsar"], "answer": 0},
            {"prompt": "Surat terpanjang dalam Al-Qur'an adalah...", "options": ["Ali 'Imran", "Al-Baqarah", "An-Nisa"], "answer": 1},
            {"prompt": "Surat yang namanya berarti waktu subuh adalah...", "options": ["Al-Fajr", "Ad-Duha", "Al-Lail"], "answer": 0},
        ],
    },
    "juz-halaman": {
        "name": "Tebak Juz & Halaman",
        "kind": "choice",
        "questions": [
            {"prompt": "Ada berapa juz dalam pembagian Al-Qur'an yang umum digunakan?", "options": ["20 juz", "30 juz", "40 juz"], "answer": 1},
            {"prompt": "Juz Amma adalah sebutan untuk juz...", "options": ["Juz 1", "Juz 15", "Juz 30"], "answer": 2},
            {"prompt": "Mushaf Madinah standar yang umum digunakan memiliki berapa halaman?", "options": ["604 halaman", "540 halaman", "700 halaman"], "answer": 0},
        ],
    },
    "baca-mundur": {
        "name": "Baca Mundur",
        "kind": "voice",
        "questions": [
            {"prompt": "Setorkan ayat sebelumnya dari Surah Al-Ikhlas ayat 2."},
            {"prompt": "Sebutkan surat sebelumnya dalam urutan mushaf sebelum An-Nas."},
            {"prompt": "Setorkan ayat sebelumnya dari Surah Al-Kautsar ayat 2."},
        ],
    },
    "buzzer": {
        "name": "Cepat Tepat Buzzer",
        "kind": "buzzer",
        "questions": [
            {"prompt": "Rebut buzzer, lalu jawab: berapa jumlah surat dalam Al-Qur'an?", "options": ["110", "114", "120"], "answer": 1},
            {"prompt": "Rebut buzzer, lalu jawab: Ayat Kursi terdapat dalam surat...", "options": ["Al-Baqarah", "Al-Fatihah", "An-Nas"], "answer": 0},
            {"prompt": "Rebut buzzer, lalu jawab: surat terpanjang dalam Al-Qur'an adalah...", "options": ["An-Nisa", "Al-Baqarah", "Ali 'Imran"], "answer": 1},
        ],
    },
    "qari": {
        "name": "Tebak Qari / Imam",
        "kind": "choice",
        "questions": [
            {"prompt": "Dengarkan sampel murottal Surah Al-Fatihah. Siapakah qari yang melantunkannya?", "options": ["Misyari Rasyid Al-Afasi", "Abdullah Al-Juhany", "Yasser Al-Dosari"], "answer": 0},
            {"prompt": "Perhatikan karakter suara pada sampel tilawah ini. Siapakah qari-nya?", "options": ["Misyari Rasyid Al-Afasi", "Abdurrahman as-Sudais", "Ibrahim Al-Dossari"], "answer": 0},
            {"prompt": "Dengarkan baik-baik lalu tebak qari yang membaca.", "options": ["Misyari Rasyid Al-Afasi", "Abdul Muhsin Al-Qasim", "Abdurrahman as-Sudais"], "answer": 0},
        ],
    },
    "makna": {
        "name": "Tebak Makna",
        "kind": "essay",
        "questions": [
            {"prompt": "Jelaskan secara singkat makna umum dari الْحَمْدُ لِلَّهِ."},
            {"prompt": "Tuliskan makna umum dari الرَّحْمَٰنِ الرَّحِيمِ."},
            {"prompt": "Apa makna umum dari اهْدِنَا الصِّرَاطَ الْمُسْتَقِيمَ?"},
        ],
    },
    "asbabun-nuzul": {
        "name": "Asbabun Nuzul",
        "kind": "choice",
        "questions": [
            {"prompt": "Menurut riwayat yang masyhur, wahyu pertama berasal dari awal surat...", "options": ["Al-'Alaq", "Al-Ma'idah", "Al-Fil"], "answer": 0},
            {"prompt": "Asbabun nuzul membahas tentang...", "options": ["Latar peristiwa turunnya ayat", "Cara menulis kaligrafi", "Urutan alfabet Arab"], "answer": 0},
            {"prompt": "Rujukan yang tepat untuk mengkaji konteks turunnya ayat adalah...", "options": ["Kitab tafsir dan ulumul Qur'an tepercaya", "Perkiraan tanpa sumber", "Daftar istilah umum"], "answer": 0},
        ],
    },
    "hukum": {
        "name": "Kandungan Hukum",
        "kind": "essay",
        "questions": [
            {"prompt": "Sebutkan satu contoh nilai hukum atau adab yang dipahami dari ayat tentang amanah."},
            {"prompt": "Jelaskan pesan umum ayat yang menganjurkan berlaku adil."},
            {"prompt": "Tuliskan satu prinsip muamalah yang perlu dijaga menurut ajaran Islam."},
        ],
    },
    "puzzle": {
        "name": "Puzzle Ayat",
        "kind": "choice",
        "questions": [
            {"prompt": "Pilih susunan kata yang benar.", "options": ["قُلْ هُوَ اللَّهُ أَحَدٌ", "هُوَ أَحَدٌ قُلْ اللَّهُ", "اللَّهُ قُلْ أَحَدٌ هُوَ"], "answer": 0},
            {"prompt": "Pilih susunan yang tepat dari awal Surah Al-Kautsar.", "options": ["إِنَّا أَعْطَيْنَاكَ الْكَوْثَرَ", "الْكَوْثَرَ إِنَّا أَعْطَيْنَاكَ", "أَعْطَيْنَاكَ الْكَوْثَرَ إِنَّا"], "answer": 0},
            {"prompt": "Pilih susunan yang tepat dari awal Surah Al-Fatihah.", "options": ["بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ", "الرَّحْمَٰنِ بِسْمِ اللَّهِ الرَّحِيمِ", "اللَّهِ الرَّحِيمِ بِسْمِ الرَّحْمَٰنِ"], "answer": 0},
        ],
    },
}

_format_sizes = {"solo": 1, "duel": 2, "trio": 3}
_custom_format_limits = (2, 8)
_difficulty_round_seconds = {"pemula": 45, "menengah": 35, "mahir": 30}
_hafalan_categories = {
    "juz-amma": "Juz Amma",
    "surah-pendek": "Surah pendek",
    "target-pribadi": "Target pribadi",
}
AVAILABLE_MODE_KEYS = {
    "tajwid-battle", "sambung-ayat", "hafalan-battle", "nama-surat",
    "makharij-battle", "team-battle",
}


@quran_battle_api.app_errorhandler(RequestEntityTooLarge)
def handle_upload_too_large(_error):
    return jsonify(error="Ukuran rekaman maksimal 3 MB."), 413


def _error(message, status):
    return jsonify(error=message), status


def _battle_database():
    connection = sqlite3.connect(current_app.config["AUTH_DATABASE"], timeout=10)
    connection.row_factory = sqlite3.Row
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS battle_reports (
            report_id TEXT PRIMARY KEY,
            room_code TEXT NOT NULL,
            reporter_id TEXT NOT NULL,
            reporter_name TEXT NOT NULL,
            target_id TEXT NOT NULL,
            target_name TEXT NOT NULL,
            reason TEXT NOT NULL,
            details TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            created_at REAL NOT NULL,
            reviewed_at REAL,
            UNIQUE (room_code, reporter_id, target_id)
        )
        """
    )
    connection.commit()
    return connection


def _json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _validate_name(value):
    if not isinstance(value, str):
        return None
    name = " ".join(value.split())
    return name if 2 <= len(name) <= 24 else None


def _format_capacity(game_format, data):
    if isinstance(game_format, str):
        normalized = game_format.strip().lower()
        aliases = {
            "1vs1": "duel",
            "1v1": "duel",
            "1vs1vs1": "trio",
            "1v1v1": "trio",
        }
        normalized = aliases.get(normalized, normalized)
        if normalized in _format_sizes:
            return normalized, _format_sizes[normalized]
        if normalized == "custom":
            capacity = data.get("sides", data.get("capacity"))
            if isinstance(capacity, int) and not isinstance(capacity, bool):
                minimum, maximum = _custom_format_limits
                if minimum <= capacity <= maximum:
                    return "custom", capacity
    return None, None


def _new_room(name, player_id, mode_key, game_format, capacity, difficulty, category):
    code = secrets.token_hex(3).upper()
    while code in _rooms:
        code = secrets.token_hex(3).upper()
    now = time.monotonic()
    room = {
        "code": code,
        "format": game_format,
        "capacity": capacity,
        "mode_key": mode_key,
        "difficulty": difficulty,
        "category": category,
        "round_seconds": 90 if MODES[mode_key]["kind"] == "voice" else _difficulty_round_seconds[difficulty],
        "status": "playing" if capacity == 1 else "waiting",
        "host_id": player_id,
        "created_at": now,
        "question_index": 0,
        "round_started_at": now,
        "buzzer_player_id": None,
        "players": {
            player_id: {
                "id": player_id,
                "name": name,
                "team_id": None,
                "score": 0,
                "exp": 0,
                "status": "Bersiap",
                "answered_question": None,
                "recording": None,
                "recording_type": None,
            }
        },
    }
    _rooms[code] = room
    return room


def _new_player_id():
    return secrets.token_urlsafe(18)


def _join_room(room, name):
    player_id = _new_player_id()
    player = {
        "id": player_id,
        "name": name,
        "team_id": None,
        "score": 0,
        "exp": 0,
        "status": "Bersiap",
        "answered_question": None,
        "recording": None,
        "recording_type": None,
    }
    room["players"][player_id] = player
    if len(room["players"]) >= room["capacity"]:
        room["status"] = "playing"
        room["round_started_at"] = time.monotonic()
    return player_id


def _expire_rooms():
    cutoff = time.monotonic() - _room_ttl
    for code in [code for code, room in _rooms.items() if room["created_at"] < cutoff]:
        del _rooms[code]


def _active_players(room):
    return [player for player in room["players"].values() if player["status"] != "Keluar"]


def _advance_if_ready(room):
    if room["status"] != "playing":
        return
    questions = MODES[room["mode_key"]]["questions"]
    question_index = room["question_index"]
    all_answered = all(player["answered_question"] == question_index for player in _active_players(room))
    timed_out = time.monotonic() - room["round_started_at"] >= room["round_seconds"]
    if not all_answered and not timed_out:
        return
    if question_index + 1 == len(questions):
        room["status"] = "finished"
        return
    room["question_index"] += 1
    room["round_started_at"] = time.monotonic()
    room["buzzer_player_id"] = None
    for player in _active_players(room):
        player["answered_question"] = None
        player["status"] = "Bersiap"
        player["recording"] = None
        player["recording_type"] = None
        player["recording_question"] = None


def _room_response(room, player_id):
    _advance_if_ready(room)
    mode = MODES[room["mode_key"]]
    question_index = room["question_index"]
    question = mode["questions"][question_index] if room["status"] == "playing" else None
    if question:
        public_question = {key: value for key, value in question.items() if key != "answer"}
        public_question["id"] = question_index
        public_question["kind"] = mode["kind"]
        seconds_remaining = max(0, room["round_seconds"] - int(time.monotonic() - room["round_started_at"]))
    else:
        public_question = None
        seconds_remaining = 0
    players = []
    for player in room["players"].values():
        players.append({
            "id": player["id"],
            "name": player["name"],
            "team_id": player.get("team_id"),
            "score": player["score"],
            "exp": player["exp"],
            "status": player["status"],
            "is_you": player["id"] == player_id,
            "has_recording": player["id"] == player_id and player["recording"] is not None and player.get("recording_question") == question_index,
        })
    return {
        "code": room["code"],
        "format": room["format"],
        "capacity": room["capacity"],
        "mode": {"key": room["mode_key"], "name": mode["name"], "kind": mode["kind"]},
        "difficulty": room["difficulty"],
        "category": _hafalan_categories.get(room["category"]),
        "status": room["status"],
        "player_id": player_id,
        "players": players,
        "teams": [],
        "question": public_question,
        "question_index": question_index,
        "total_questions": len(mode["questions"]),
        "seconds_remaining": seconds_remaining,
        "buzzer_player_id": room["buzzer_player_id"],
    }


def _room_for_request(code, player_id):
    room = _rooms.get(code.upper())
    if not room or not isinstance(player_id, str):
        return None, None
    return room, room["players"].get(player_id)


def _score_submission(code, data):
    player_id = data.get("player_id", "")
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room:
            return {"error": "Room tidak ditemukan."}, 404
        if not player:
            return {"error": "Pemain tidak terdaftar di room ini."}, 403
        _advance_if_ready(room)
        if room["status"] != "playing":
            return {"error": "Ronde ini tidak sedang berlangsung."}, 409
        question = MODES[room["mode_key"]]["questions"][room["question_index"]]
        question_id = data.get("question_id")
        if not isinstance(question_id, int) or isinstance(question_id, bool) or question_id != room["question_index"]:
            return {"error": "Soal sudah berganti. Muat status pertandingan kembali."}, 409
        if player["answered_question"] == room["question_index"]:
            return {"error": "Jawaban untuk soal ini sudah dikirim."}, 409
        question_kind = MODES[room["mode_key"]]["kind"]
        if question_kind == "voice":
            return {"error": "Mode ini memerlukan rekaman suara."}, 400
        if question_kind == "buzzer" and room["buzzer_player_id"] != player_id:
            return {"error": "Rebut buzzer terlebih dahulu sebelum menjawab."}, 409
        if question_kind in ("choice", "buzzer"):
            answer = data.get("answer")
            if not isinstance(answer, int) or isinstance(answer, bool) or not 0 <= answer < len(question["options"]):
                return {"error": "Pilihan jawaban tidak valid."}, 400
            correct = answer == question["answer"]
            if correct:
                points = 100
            else:
                points = 0
            player["status"] = "Jawaban tepat" if correct else "Sudah menjawab"
        elif question_kind == "essay":
            answer = data.get("answer")
            if not isinstance(answer, str) or not 2 <= len(answer.strip()) <= 1000:
                return {"error": "Jawaban esai harus berisi 2–1.000 karakter."}, 400
            correct = None
            points = 50
            player["status"] = "Esai terkirim"
        else:
            return {"error": "Jenis soal tidak didukung."}, 400
        player["score"] += points
        player["exp"] += 5
        player["answered_question"] = room["question_index"]
        _advance_if_ready(room)
        response = {
            "correct": correct,
            "points": points,
            "room": _room_response(room, player_id),
        }
        socketio.emit(
            "battle_result",
            {
                "code": room["code"],
                "player_id": player_id,
                "correct": correct,
                "points": points,
            },
            to=room["code"],
        )
        socketio.emit(
            "update_score",
            {
                "username": player["name"],
                "is_correct": correct,
                "score": player["score"],
                "points": points,
            },
            to=room["code"],
        )
        return response, 200


@quran_battle_api.post("/api/battle/matchmaking")
def matchmaking():
    data = _json_body()
    name = _validate_name(data.get("name"))
    requested_format = data.get("format")
    mode_key = data.get("mode")
    if not name:
        return _error("Nama harus berisi 2–24 karakter.", 400)
    if not isinstance(mode_key, str) or mode_key not in MODES:
        return _error("Mode permainan tidak dikenali.", 400)
    if mode_key not in AVAILABLE_MODE_KEYS:
        return _error("Mode permainan belum tersedia.", 400)
    game_format, capacity = _format_capacity(requested_format, data)
    if not game_format:
        return _error("Format pertandingan tidak valid.", 400)
    difficulty = data.get("difficulty", "menengah")
    if not isinstance(difficulty, str) or difficulty not in _difficulty_round_seconds:
        return _error("Tingkat kesulitan tidak valid.", 400)
    category = data.get("category", "juz-amma") if mode_key == "hafalan-battle" else None
    if mode_key == "hafalan-battle" and (
        not isinstance(category, str) or category not in _hafalan_categories
    ):
        return _error("Kategori hafalan tidak valid.", 400)
    with _rooms_lock:
        _expire_rooms()
        player_id = _new_player_id()
        room = _new_room(name, player_id, mode_key, game_format, capacity, difficulty, category)
        result_player_id = player_id
        response = _room_response(room, result_player_id)
        _notify_room_update(room["code"])
        return jsonify(response), 201


@quran_battle_api.post("/api/battle/rooms")
def create_room():
    data = _json_body()
    name = _validate_name(data.get("name"))
    mode_key = data.get("mode")
    requested_format = data.get("format", "solo")
    if not name:
        return _error("Nama harus berisi 2–24 karakter.", 400)
    if not isinstance(mode_key, str) or mode_key not in MODES:
        return _error("Mode permainan tidak dikenali.", 400)
    if mode_key not in AVAILABLE_MODE_KEYS:
        return _error("Mode permainan belum tersedia.", 400)
    game_format, capacity = _format_capacity(requested_format, data)
    if not game_format:
        return _error("Format pertandingan tidak valid.", 400)
    difficulty = data.get("difficulty", "menengah")
    if not isinstance(difficulty, str) or difficulty not in _difficulty_round_seconds:
        return _error("Tingkat kesulitan tidak valid.", 400)
    category = data.get("category", "juz-amma") if mode_key == "hafalan-battle" else None
    if mode_key == "hafalan-battle" and (
        not isinstance(category, str) or category not in _hafalan_categories
    ):
        return _error("Kategori hafalan tidak valid.", 400)
    player_id = _new_player_id()
    with _rooms_lock:
        _expire_rooms()
        room = _new_room(name, player_id, mode_key, game_format, capacity, difficulty, category)
        response = _room_response(room, player_id)
        _notify_room_update(room["code"])
        return jsonify(response), 201


@quran_battle_api.post("/api/battle/rooms/<code>/join")
def join_room(code):
    data = _json_body()
    name = _validate_name(data.get("name"))
    if not name:
        return _error("Nama harus berisi 2–24 karakter.", 400)
    with _rooms_lock:
        _expire_rooms()
        room = _rooms.get(code.upper())
        if not room:
            return _error("Kode room tidak ditemukan atau sudah kedaluwarsa.", 404)
        if room["format"] == "solo":
            return _error("Pertandingan solo tidak menerima pemain lain.", 409)
        if room["status"] != "waiting":
            return _error("Pertandingan sudah dimulai atau selesai.", 409)
        if len(room["players"]) >= room["capacity"]:
            return _error("Room sudah penuh.", 409)
        player_id = _join_room(room, name)
        response = _room_response(room, player_id)
        _notify_room_update(room["code"])
        return jsonify(response), 200


@quran_battle_api.get("/api/battle/rooms/<code>")
def get_room(code):
    player_id = request.args.get("player_id", "")
    with _rooms_lock:
        _expire_rooms()
        room, player = _room_for_request(code, player_id)
        if not room:
            return _error("Room tidak ditemukan atau sudah kedaluwarsa.", 404)
        if not player:
            return _error("Pemain tidak terdaftar di room ini.", 403)
        return jsonify(_room_response(room, player_id))


@quran_battle_api.post("/api/battle/rooms/<code>/answer")
def submit_answer(code):
    response, status = _score_submission(code, _json_body())
    return jsonify(response), status


@quran_battle_api.post("/api/battle/rooms/<code>/buzzer")
def press_buzzer(code):
    data = _json_body()
    player_id = data.get("player_id", "")
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room:
            return _error("Room tidak ditemukan.", 404)
        if not player:
            return _error("Pemain tidak terdaftar di room ini.", 403)
        _advance_if_ready(room)
        if room["status"] != "playing":
            return _error("Ronde ini tidak sedang berlangsung.", 409)
        if MODES[room["mode_key"]]["kind"] != "buzzer":
            return _error("Mode ini tidak menggunakan buzzer.", 400)
        if player["answered_question"] == room["question_index"]:
            return _error("Jawaban untuk soal ini sudah dikirim.", 409)
        if room["buzzer_player_id"] is not None:
            return _error("Buzzer sudah direbut pemain lain.", 409)
        room["buzzer_player_id"] = player_id
        player["score"] += 25
        player["status"] = "Merebut buzzer"
        response = _room_response(room, player_id)
        _notify_room_update(room["code"])
        return jsonify(response)


@quran_battle_api.post("/api/battle/rooms/<code>/recording")
def submit_recording(code):
    player_id = request.form.get("player_id", "")
    recording = request.files.get("recording")
    if not recording or not recording.mimetype.startswith("audio/"):
        return _error("Rekaman audio tidak valid.", 400)
    payload = recording.read(3 * 1024 * 1024 + 1)
    if not payload or len(payload) > 3 * 1024 * 1024:
        return _error("Rekaman kosong atau melebihi 3 MB.", 413)
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room:
            return _error("Room tidak ditemukan.", 404)
        if not player:
            return _error("Pemain tidak terdaftar di room ini.", 403)
        _advance_if_ready(room)
        if room["status"] != "playing" or MODES[room["mode_key"]]["kind"] != "voice":
            return _error("Ronde ini tidak menerima rekaman suara.", 409)
        if player["answered_question"] == room["question_index"]:
            return _error("Rekaman untuk soal ini sudah dikirim.", 409)
        player["recording"] = payload
        player["recording_type"] = recording.mimetype
        player["recording_question"] = room["question_index"]
        player["answered_question"] = room["question_index"]
        player["exp"] += 5
        player["status"] = "Menunggu pemeriksaan pengajar"
        _advance_if_ready(room)
        response = _room_response(room, player_id)
        _notify_room_update(room["code"])
        return jsonify({"points": 0, "room": response, "assessment": "pending_teacher_review"})


@quran_battle_api.get("/api/battle/rooms/<code>/recordings/<recording_player_id>")
def get_recording(code, recording_player_id):
    player_id = request.args.get("player_id", "")
    with _rooms_lock:
        room, viewer = _room_for_request(code, player_id)
        if not room:
            return _error("Room tidak ditemukan.", 404)
        if not viewer and not session.get("admin_authenticated"):
            return _error("Pemain tidak terdaftar di room ini.", 403)
        if player_id != recording_player_id and not session.get("admin_authenticated"):
            return _error("Rekaman hanya dapat diputar oleh pemilik atau moderator.", 403)
        player = room["players"].get(recording_player_id)
        if not player or not player["recording"]:
            return _error("Rekaman belum tersedia.", 404)
        payload = player["recording"]
        mimetype = player["recording_type"]
    return send_file(io.BytesIO(payload), mimetype=mimetype, download_name="setoran.webm", as_attachment=False, conditional=False)


@quran_battle_api.post("/api/battle/rooms/<code>/leave")
def leave_room(code):
    data = _json_body()
    player_id = data.get("player_id", "")
    with _rooms_lock:
        room, player = _room_for_request(code, player_id)
        if not room:
            return jsonify({"left": True})
        if not player:
            return _error("Pemain tidak terdaftar di room ini.", 403)
        room_code = room["code"]
        del room["players"][player_id]
        if room["host_id"] == player_id and room["players"]:
            room["host_id"] = next(iter(room["players"]))
        if not room["players"]:
            _rooms.pop(room["code"], None)
        elif room["format"] != "solo" and room["status"] == "playing" and len(_active_players(room)) == 1:
            room["status"] = "finished"
        else:
            _advance_if_ready(room)
        _notify_room_update(room_code)
        return jsonify({"left": True})


@quran_battle_api.get("/api/battle/modes")
def list_modes():
    return jsonify([
        {"key": key, "name": mode["name"], "kind": mode["kind"]}
        for key, mode in MODES.items()
        if key in AVAILABLE_MODE_KEYS
    ])


@quran_battle_api.post("/api/battle/rooms/<code>/report")
def report_player(code):
    data = _json_body()
    reporter_id = data.get("player_id")
    target_id = data.get("target_id")
    reason = data.get("reason")
    details = data.get("details", "")
    if reason not in ("perilaku", "konten", "lainnya"):
        return _error("Kategori laporan tidak valid.", 400)
    if not isinstance(details, str) or not 10 <= len(details.strip()) <= 500:
        return _error("Keterangan laporan harus berisi 10–500 karakter.", 400)
    with _rooms_lock:
        room, reporter = _room_for_request(code, reporter_id)
        if not room:
            return _error("Room tidak ditemukan atau sudah kedaluwarsa.", 404)
        if not reporter:
            return _error("Pemain tidak terdaftar di room ini.", 403)
        if not isinstance(target_id, str) or target_id == reporter_id or target_id not in room["players"]:
            return _error("Pemain yang dilaporkan tidak valid.", 400)
        report = {
            "id": secrets.token_urlsafe(12),
            "code": room["code"],
            "reporter_id": reporter_id,
            "reporter_name": reporter["name"],
            "target_id": target_id,
            "target_name": room["players"][target_id]["name"],
            "reason": reason,
            "details": details.strip(),
        }
    connection = _battle_database()
    try:
        connection.execute(
            """
            INSERT INTO battle_reports
                (report_id, room_code, reporter_id, reporter_name, target_id, target_name, reason, details, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                report["id"], report["code"], report["reporter_id"], report["reporter_name"],
                report["target_id"], report["target_name"], report["reason"], report["details"], time.time(),
            ),
        )
        connection.commit()
    except sqlite3.IntegrityError:
        return _error("Laporan untuk pemain ini sudah dikirim.", 409)
    finally:
        connection.close()
    return jsonify({
        "reported": True,
        "report_id": report["id"],
        "message": "Laporan diteruskan untuk ditinjau moderator.",
    }), 201


@quran_battle_api.get("/api/battle/admin/reports")
def battle_report_queue():
    if not session.get("admin_authenticated"):
        return _error("Akses admin diperlukan.", 403)
    connection = _battle_database()
    try:
        reports = [
            dict(report)
            for report in connection.execute(
                """
                SELECT report_id AS id, room_code AS code, reporter_id, reporter_name,
                       target_id, target_name, reason, details, status, created_at
                FROM battle_reports
                WHERE status = 'pending'
                ORDER BY created_at
                LIMIT 1000
                """
            )
        ]
    finally:
        connection.close()
    return jsonify({"reports": reports})


@quran_battle_api.post("/api/battle/admin/reports/<report_id>")
def review_battle_report(report_id):
    if not session.get("admin_authenticated"):
        return _error("Akses admin diperlukan.", 403)
    expected = session.get("csrf_token", "")
    supplied = request.headers.get("X-CSRF-Token", "")
    if not expected or not supplied or not hmac.compare_digest(expected, supplied):
        return _error("Sesi formulir tidak valid. Muat ulang halaman lalu coba lagi.", 400)
    decision = _json_body().get("decision")
    if decision not in ("reviewed", "action_taken", "dismissed"):
        return _error("Keputusan moderasi tidak valid.", 400)
    connection = _battle_database()
    try:
        result = connection.execute(
            """
            UPDATE battle_reports
            SET status = ?, reviewed_at = ?
            WHERE report_id = ? AND status = 'pending'
            """,
            (decision, time.time(), report_id),
        )
        if result.rowcount == 0:
            exists = connection.execute(
                "SELECT 1 FROM battle_reports WHERE report_id = ?",
                (report_id,),
            ).fetchone()
            return _error(
                "Laporan tidak ditemukan." if not exists else "Laporan sudah ditinjau.",
                404 if not exists else 409,
            )
        connection.commit()
    finally:
        connection.close()
    return jsonify({"updated": True, "status": decision})
