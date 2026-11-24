import secrets
import threading
import time
from datetime import datetime, timezone

from flask import Blueprint, jsonify, request
from flask_socketio import join_room, leave_room

from extensions import socketio


community_api = Blueprint("community_api", __name__)
_groups_lock = threading.RLock()
_groups = {}


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix=""):
    return (prefix + secrets.token_hex(5)) if prefix else secrets.token_hex(8)


def _validate_name(value):
    if not isinstance(value, str):
        return None
    value = " ".join(value.split())
    if not 2 <= len(value) <= 30:
        return None
    return value


def _group_view(group):
    last = group["messages"][-1] if group["messages"] else None
    return {
        "id": group["id"],
        "name": group["name"],
        "description": group["description"],
        "member_count": len(group["members"]),
        "message_count": len(group["messages"]),
        "last_message": last,
        "created_at": group["created_at"],
    }


def _seed_groups():
    now = _now()
    seeds = (
        ("tajwid-dasar", "Tajwid Dasar", "Belajar hukum bacaan dan makharijul huruf."),
        ("hafalan-quran", "Hafalan Al-Qur'an", "Murajaah, setoran, dan motivasi menghafal."),
        ("kajian-umum", "Kajian Umum", "Diskusi adab, tafsir, dan pertanyaan sehari-hari."),
    )
    for group_id, name, description in seeds:
        _groups[group_id] = {
            "id": group_id,
            "name": name,
            "description": description,
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


@community_api.get("/api/community/groups")
def list_groups():
    search = request.args.get("q", "").strip().lower()
    with _groups_lock:
        groups = list(_groups.values())
        if search:
            groups = [
                group for group in groups
                if search in group["name"].lower() or search in group["description"].lower()
            ]
        return jsonify([_group_view(group) for group in groups])


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
        member_id = _make_id("member-")
        group = {
            "id": group_id,
            "name": name,
            "description": description or "Grup diskusi komunitas Ustad Online.",
            "created_at": _now(),
            "members": {member_id: {"id": member_id, "name": creator}},
            "messages": [],
        }
        _groups[group_id] = group
        return jsonify({"group": _group_view(group), "member_id": member_id}), 201


@community_api.post("/api/community/groups/<group_id>/join")
def join_group(group_id):
    body = _json_body()
    name = _validate_name(body.get("name"))
    if not name:
        return _error("Nama anggota harus 2-30 karakter.", 400)
    with _groups_lock:
        group = _groups.get(group_id)
        if not group:
            return _error("Grup tidak ditemukan.", 404)
        for member in group["members"].values():
            if member["name"].lower() == name.lower():
                return jsonify({"group": _group_view(group), "member_id": member["id"]})
        member_id = _make_id("member-")
        group["members"][member_id] = {"id": member_id, "name": name}
        return jsonify({"group": _group_view(group), "member_id": member_id})


@community_api.get("/api/community/groups/<group_id>/messages")
def get_messages(group_id):
    with _groups_lock:
        group = _groups.get(group_id)
        if not group:
            return _error("Grup tidak ditemukan.", 404)
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
        member = group["members"].get(member_id)
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
    if not isinstance(group_id, str) or group_id not in _groups:
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
