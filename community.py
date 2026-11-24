import secrets
import threading
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_socketio import join_room, leave_room

from extensions import socketio


community_api = Blueprint("community_api", __name__)
_groups_lock = threading.RLock()
_groups = {}

# Huruf/angka tanpa karakter yang mudah tertukar (0/O, 1/I/L).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix=""):
    return (prefix + secrets.token_hex(5)) if prefix else secrets.token_hex(8)


def _make_member_id():
    # member_id berfungsi sebagai "kunci" anggota, jadi dibuat panjang dan acak.
    return "member-" + secrets.token_hex(12)


def _make_invite_code():
    # Dipanggil di dalam _groups_lock.
    while True:
        code = "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))
        if not any(group["invite_code"] == code for group in _groups.values()):
            return code


def _normalize_code(value):
    if not isinstance(value, str):
        return ""
    return "".join(value.split()).upper()


def _validate_name(value):
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    if not 2 <= len(value) <= 30:
        return None
    return value


def _group_view(group):
    # Hanya boleh dikirim ke anggota grup, karena memuat kode undangan.
    last = group["messages"][-1] if group["messages"] else None
    return {
        "id": group["id"],
        "name": group["name"],
        "description": group["description"],
        "invite_code": group["invite_code"],
        "member_count": len(group["members"]),
        "message_count": len(group["messages"]),
        "last_message": last,
        "created_at": group["created_at"],
    }


def _seed_groups():
    now = _now()
    # Kode undangan grup resmi. GANTI dengan kode milikmu sendiri, lalu bagikan
    # hanya ke orang yang boleh masuk. Gunakan huruf besar dan angka saja.
    seeds = (
        ("tajwid-dasar", "Tajwid Dasar", "Belajar hukum bacaan dan makharijul huruf.", "TJ7K2M"),
        ("hafalan-quran", "Hafalan Al-Qur'an", "Murajaah, setoran, dan motivasi menghafal.", "HF9Q4R"),
        ("kajian-umum", "Kajian Umum", "Diskusi adab, tafsir, dan pertanyaan sehari-hari.", "KJ3W8N"),
    )
    for group_id, name, description, invite_code in seeds:
        _groups[group_id] = {
            "id": group_id,
            "name": name,
            "description": description,
            "invite_code": invite_code,
            "created_at": now,
            "members": {},
            "messages": [
                {
                    "id": _make_id("msg-"),
                    "sender": "Admin Ustad Online",
                    "text": "Assalamu'alaikum! Selamat datang di grup. Jaga sopan dan relevansi diskusi.",
                    "created_at": now,
                }
            ],
        }


with _groups_lock:
    _seed_groups()


def _error(message, status):
    return jsonify({"error": message}), status


def _json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _request_member_id():
    return request.args.get("member_id") or request.headers.get("X-Member-Id")


def _find_member(group, member_id):
    if not isinstance(member_id, str) or not member_id:
        return None
    return group["members"].get(member_id)


@community_api.get("/api/community/groups")
def list_groups():
    # Hanya grup yang diikuti. Browser mengirim daftar member_id miliknya,
    # contoh: /api/community/groups?ids=member-aaa,member-bbb
    search = request.args.get("q", "").strip().lower()
    member_ids = [part.strip() for part in request.args.get("ids", "").split(",") if part.strip()]
    member_ids = member_ids[:50]
    result = []
    with _groups_lock:
        for group in _groups.values():
            mine = next((mid for mid in member_ids if mid in group["members"]), None)
            if not mine:
                continue
            if search and search not in group["name"].lower() and search not in group["description"].lower():
                continue
            view = _group_view(group)
            view["member_id"] = mine
            result.append(view)
    return jsonify(result)


@community_api.post("/api/community/groups")
def create_group():
    body = _json_body()
    name = _validate_name(body.get("name"))
    description = body.get("description", "")
    creator = _validate_name(body.get("creator"))
    if not name:
        return _error("Nama grup harus 2-30 karakter.", 400)
    if not creator:
        return _error("Nama anggota harus 2-30 karakter.", 400)
    if not isinstance(description, str):
        return _error("Deskripsi grup tidak valid.", 400)
    description = " ".join(description.split())[:160]
    with _groups_lock:
        group_id = _make_id("group-")
        member_id = _make_member_id()
        group = {
            "id": group_id,
            "name": name,
            "description": description or "Grup diskusi komunitas Ustad Online.",
            "invite_code": _make_invite_code(),
            "created_at": _now(),
            "members": {member_id: {"id": member_id, "name": creator}},
            "messages": [],
        }
        _groups[group_id] = group
        return jsonify({"group": _group_view(group), "member_id": member_id}), 201


@community_api.post("/api/community/join")
def join_group_by_code():
    body = _json_body()
    code = _normalize_code(body.get("code"))
    name = _validate_name(body.get("name"))
    if not code:
        return _error("Kode undangan wajib diisi.", 400)
    if not name:
        return _error("Nama anggota harus 2-30 karakter.", 400)
    with _groups_lock:
        group = next((g for g in _groups.values() if g["invite_code"] == code), None)
        if not group:
            return _error("Kode undangan tidak valid.", 404)
        if any(m["name"].lower() == name.lower() for m in group["members"].values()):
            return _error("Nama itu sudah dipakai di grup ini. Gunakan nama lain.", 409)
        member_id = _make_member_id()
        group["members"][member_id] = {"id": member_id, "name": name}
        return jsonify({"group": _group_view(group), "member_id": member_id})


@community_api.get("/api/community/groups/<group_id>/messages")
def get_messages(group_id):
    member_id = _request_member_id()
    with _groups_lock:
        group = _groups.get(group_id)
        if not group:
            return _error("Grup tidak ditemukan.", 404)
        if not _find_member(group, member_id):
            return _error("Anda belum bergabung ke grup ini.", 403)
        return jsonify({
            "group": _group_view(group),
            "messages": list(group["messages"]),
            "members": list(group["members"].values()),
        })


@community_api.post("/api/community/groups/<group_id>/messages")
def send_message(group_id):
    body = _json_body()
    member_id = body.get("member_id")
    text = body.get("text")
    if not isinstance(member_id, str):
        return _error("Identitas anggota tidak valid.", 400)
    if not isinstance(text, str):
        return _error("Pesan tidak valid.", 400)
    text = " ".join(text.split())
    if not 1 <= len(text) <= 1000:
        return _error("Pesan harus 1-1000 karakter.", 400)
    with _groups_lock:
        group = _groups.get(group_id)
        if not group:
            return _error("Grup tidak ditemukan.", 404)
        member = _find_member(group, member_id)
        if not member:
            return _error("Anda belum bergabung ke grup ini.", 403)
        message = {
            "id": _make_id("msg-"),
            "sender": member["name"],
            "text": text,
            "created_at": _now(),
        }
        group["messages"].append(message)
        if len(group["messages"]) > 500:
            group["messages"] = group["messages"][-500:]
        socketio.emit(
            "community_message",
            {"group_id": group_id, "message": message},
            to=f"community:{group_id}",
        )
        return jsonify({"message": message, "group": _group_view(group)}), 201


@socketio.on("join_community")
def join_community_socket(data):
    if not isinstance(data, dict):
        return {"joined": False}
    group_id = data.get("group_id")
    member_id = data.get("member_id")
    if not isinstance(group_id, str) or not isinstance(member_id, str):
        return {"joined": False}
    with _groups_lock:
        group = _groups.get(group_id)
        is_member = bool(group) and member_id in group["members"]
    if not is_member:
        return {"joined": False}
    join_room(f"community:{group_id}")
    return {"joined": True}


@socketio.on("leave_community")
def leave_community_socket(data):
    if not isinstance(data, dict):
        return {"left": False}
    group_id = data.get("group_id")
    if not isinstance(group_id, str):
        return {"left": False}
    leave_room(f"community:{group_id}")
    return {"left": True}