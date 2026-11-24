import io
import secrets
import threading
import time

from flask import Blueprint, jsonify, request, send_file
from flask_socketio import join_room as join_socket_room
from flask_socketio import leave_room as leave_socket_room
from werkzeug.exceptions import RequestEntityTooLarge

from extensions import socketio


quran_battle_api = Blueprint("quran_battle_api", __name__)
_rooms = {}
_rooms_lock = threading.RLock()
_room_ttl = 3600
_round_seconds = 30


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
    "hafalan-battle": {
        "name": "Hafalan Battle",
        "kind": "voice",
        "questions": [
            {"prompt": "Lanjutkan bacaan setelah potongan ayat ini.", "arabic": "قُلْ هُوَ اللَّهُ أَحَدٌ"},
            {"prompt": "Setorkan lanjutan ayat pertama Surah Al-Kautsar.", "arabic": "إِنَّا أَعْطَيْنَاكَ"},
            {"prompt": "Bacakan ayat berikutnya dari Surah Al-Falaq.", "arabic": "مِن شَرِّ مَا خَلَقَ"},
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
            {"prompt": "Bacakan kelanjutan ayat berikut.", "arabic": "قُلْ هُوَ اللَّهُ أَحَدٌ"},
            {"prompt": "Setorkan lanjutan ayat pertama Surah Al-Kautsar.", "arabic": "إِنَّا أَعْطَيْنَاكَ"},
            {"prompt": "Lanjutkan bacaan setelah potongan ayat ini.", "arabic": "وَالضُّحَىٰ"},
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
        "name": "Tebak Nama Surat",
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

_format_sizes = {"solo": 1, "duo": 2, "trio": 3}


@quran_battle_api.app_errorhandler(RequestEntityTooLarge)
def handle_upload_too_large(_error):
    return jsonify(error="Ukuran rekaman maksimal 3 MB."), 413


def _error(message, status):
    return jsonify(error=message), status


def _json_body():
    data = request.get_json(silent=True)
    return data if isinstance(data, dict) else {}


def _validate_name(value):
    if not isinstance(value, str):
        return None
    name = " ".join(value.split())
    return name if 2 <= len(name) <= 24 else None


def _new_room(name, player_id, mode_key, game_format, capacity):
    code = secrets.token_hex(3).upper()
    while code in _rooms:
        code = secrets.token_hex(3).upper()
    now = time.monotonic()
    room = {
        "code": code,
        "format": game_format,
        "capacity": capacity,
        "mode_key": mode_key,
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
                "team_id": "A" if mode_key == "team-battle" else None,
                "score": 0,
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
    team_id = None
    if room["mode_key"] == "team-battle":
        team_counts = {
            team: sum(player.get("team_id") == team for player in room["players"].values())
            for team in ("A", "B")
        }
        team_id = "A" if team_counts["A"] <= team_counts["B"] else "B"
    player = {
        "id": player_id,
        "name": name,
        "team_id": team_id,
        "score": 0,
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
    timed_out = time.monotonic() - room["round_started_at"] >= _round_seconds
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
        seconds_remaining = max(0, _round_seconds - int(time.monotonic() - room["round_started_at"]))
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
            "status": player["status"],
            "is_you": player["id"] == player_id,
            "has_recording": player["recording"] is not None and player.get("recording_question") == question_index,
        })
    return {
        "code": room["code"],
        "format": room["format"],
        "capacity": room["capacity"],
        "mode": {"key": room["mode_key"], "name": mode["name"], "kind": mode["kind"]},
        "status": room["status"],
        "player_id": player_id,
        "players": players,
        "teams": [
            {
                "id": team,
                "score": sum(player["score"] for player in room["players"].values() if player.get("team_id") == team),
            }
            for team in ("A", "B")
        ] if room["mode_key"] == "team-battle" else [],
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
            points = 100 if correct else 0
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
    game_format = data.get("format")
    mode_key = data.get("mode")
    if not name:
        return _error("Nama harus berisi 2–24 karakter.", 400)
    if not isinstance(game_format, str) or game_format not in _format_sizes:
        return _error("Pilih format Solo, Duo, atau Trio.", 400)
    if not isinstance(mode_key, str) or mode_key not in MODES:
        return _error("Mode permainan tidak dikenali.", 400)
    if mode_key == "team-battle" and game_format == "solo":
        return _error("Team Battle memerlukan format Duo atau Trio.", 400)
    with _rooms_lock:
        _expire_rooms()
        if game_format == "solo":
            player_id = _new_player_id()
            room = _new_room(name, player_id, mode_key, "solo", 1)
        else:
            capacity = _format_sizes[game_format]
            room = next((
                item for item in _rooms.values()
                if item["status"] == "waiting"
                and item["format"] == game_format
                and item["mode_key"] == mode_key
                and item["capacity"] == capacity
            ), None)
            if room:
                result_player_id = _join_room(room, name)
            else:
                player_id = _new_player_id()
                room = _new_room(name, player_id, mode_key, game_format, capacity)
                result_player_id = player_id
        if game_format == "solo":
            result_player_id = player_id
        response = _room_response(room, result_player_id)
        _notify_room_update(room["code"])
        return jsonify(response), 201


@quran_battle_api.post("/api/battle/rooms")
def create_room():
    data = _json_body()
    name = _validate_name(data.get("name"))
    mode_key = data.get("mode")
    game_format = data.get("format", "custom")
    if not name:
        return _error("Nama harus berisi 2–24 karakter.", 400)
    if not isinstance(mode_key, str) or mode_key not in MODES:
        return _error("Mode permainan tidak dikenali.", 400)
    if not isinstance(game_format, str) or game_format not in ("custom", *_format_sizes.keys()):
        return _error("Format room tidak dikenali.", 400)
    capacity = _format_sizes.get(game_format, data.get("capacity"))
    if not isinstance(capacity, int) or isinstance(capacity, bool) or not 1 <= capacity <= 6:
        return _error("Kapasitas room harus 1–6 pemain.", 400)
    if game_format == "solo" and capacity != 1:
        return _error("Format Solo hanya memiliki satu pemain.", 400)
    if mode_key == "team-battle" and capacity < 2:
        return _error("Team Battle memerlukan minimal dua pemain.", 400)
    player_id = _new_player_id()
    with _rooms_lock:
        _expire_rooms()
        room = _new_room(name, player_id, mode_key, game_format, capacity)
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
        player["score"] += 50
        player["status"] = "Rekaman terkirim"
        _advance_if_ready(room)
        response = _room_response(room, player_id)
        _notify_room_update(room["code"])
        return jsonify({"points": 50, "room": response})


@quran_battle_api.get("/api/battle/rooms/<code>/recordings/<recording_player_id>")
def get_recording(code, recording_player_id):
    player_id = request.args.get("player_id", "")
    with _rooms_lock:
        room, viewer = _room_for_request(code, player_id)
        if not room:
            return _error("Room tidak ditemukan.", 404)
        if not viewer:
            return _error("Pemain tidak terdaftar di room ini.", 403)
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
    ])
