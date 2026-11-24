import os
import secrets
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone

from flask import Blueprint, current_app, jsonify, request
from flask_socketio import join_room, leave_room

from extensions import socketio


community_api = Blueprint("community_api", __name__)

# Huruf/angka tanpa karakter yang mudah tertukar (0/O, 1/I/L).
_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
_CODE_LENGTH = 6
_MESSAGE_HISTORY_LIMIT = 100
_MESSAGE_STORAGE_LIMIT = 500


def _now():
    return datetime.now(timezone.utc).isoformat(timespec="seconds")


def _make_id(prefix=""):
    return (prefix + secrets.token_hex(5)) if prefix else secrets.token_hex(8)


def _make_member_id():
    return "member-" + secrets.token_hex(12)


def _make_invite_code():
    return "".join(secrets.choice(_CODE_ALPHABET) for _ in range(_CODE_LENGTH))


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


def _database_path():
    return current_app.config["AUTH_DATABASE"]


@contextmanager
def _database():
    connection = sqlite3.connect(_database_path(), timeout=10)
    connection.row_factory = sqlite3.Row
    try:
        yield connection
        connection.commit()
    except Exception:
        connection.rollback()
        raise
    finally:
        connection.close()


def init_community_db(path):
    os.makedirs(os.path.dirname(os.path.abspath(path)), exist_ok=True)
    connection = sqlite3.connect(path, timeout=10)
    try:
        connection.execute("PRAGMA journal_mode = WAL")
        connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS community_groups (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                invite_code TEXT NOT NULL UNIQUE,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS community_members (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
                name TEXT NOT NULL COLLATE NOCASE,
                UNIQUE (group_id, name)
            );
            CREATE INDEX IF NOT EXISTS community_members_group_idx
                ON community_members(group_id);
            CREATE TABLE IF NOT EXISTS community_messages (
                id TEXT PRIMARY KEY,
                group_id TEXT NOT NULL REFERENCES community_groups(id) ON DELETE CASCADE,
                sender TEXT NOT NULL,
                text TEXT NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS community_messages_group_idx
                ON community_messages(group_id);
            """
        )
        now = _now()
        seeds = (
            ("tajwid-dasar", "Tajwid Dasar", "Belajar hukum bacaan dan makharijul huruf.", "TJ7K2M"),
            ("hafalan-quran", "Hafalan Al-Qur'an", "Murajaah, setoran, dan motivasi menghafal.", "HF9Q4R"),
            ("kajian-umum", "Kajian Umum", "Diskusi adab, tafsir, dan pertanyaan sehari-hari.", "KJ3W8N"),
        )
        for group_id, name, description, invite_code in seeds:
            connection.execute(
                """
                INSERT OR IGNORE INTO community_groups
                    (id, name, description, invite_code, created_at)
                VALUES (?, ?, ?, ?, ?)
                """,
                (group_id, name, description, invite_code, now),
            )
            has_messages = connection.execute(
                "SELECT 1 FROM community_messages WHERE group_id = ? LIMIT 1",
                (group_id,),
            ).fetchone()
            if not has_messages:
                connection.execute(
                    """
                    INSERT INTO community_messages (id, group_id, sender, text, created_at)
                    VALUES (?, ?, ?, ?, ?)
                    """,
                    (
                        _make_id("msg-"),
                        group_id,
                        "Admin Ustad Online",
                        "Assalamu'alaikum! Selamat datang di grup. Jaga sopan dan relevansi diskusi.",
                        now,
                    ),
                )
        connection.commit()
    finally:
        connection.close()


def _error(message, status):
    return jsonify({"error": message}), status


def _json_body():
    body = request.get_json(silent=True)
    return body if isinstance(body, dict) else {}


def _request_member_id():
    return request.args.get("member_id") or request.headers.get("X-Member-Id")


def _find_member(connection, group_id, member_id):
    if not isinstance(member_id, str) or not member_id:
        return None
    return connection.execute(
        "SELECT id, name FROM community_members WHERE group_id = ? AND id = ?",
        (group_id, member_id),
    ).fetchone()


def _message_dict(row):
    if not row:
        return None
    return {
        "id": row["id"],
        "sender": row["sender"],
        "text": row["text"],
        "created_at": row["created_at"],
    }


def _group_view(connection, group, member_id=None):
    last_message = connection.execute(
        """
        SELECT id, sender, text, created_at
        FROM community_messages WHERE group_id = ? ORDER BY rowid DESC LIMIT 1
        """,
        (group["id"],),
    ).fetchone()
    view = {
        "id": group["id"],
        "name": group["name"],
        "description": group["description"],
        "invite_code": group["invite_code"],
        "member_count": connection.execute(
            "SELECT COUNT(*) FROM community_members WHERE group_id = ?",
            (group["id"],),
        ).fetchone()[0],
        "message_count": connection.execute(
            "SELECT COUNT(*) FROM community_messages WHERE group_id = ?",
            (group["id"],),
        ).fetchone()[0],
        "last_message": _message_dict(last_message),
        "created_at": group["created_at"],
    }
    if member_id:
        view["member_id"] = member_id
    return view


@community_api.get("/api/community/groups")
def list_groups():
    search = request.args.get("q", "").strip().lower()
    member_ids = [
        part.strip()
        for part in request.args.get("ids", "").split(",")
        if part.strip()
    ][:50]
    if not member_ids:
        return jsonify([])

    placeholders = ",".join("?" for _ in member_ids)
    with _database() as connection:
        groups = connection.execute(
            f"""
            SELECT g.*, m.id AS member_id
            FROM community_groups g
            JOIN community_members m ON m.group_id = g.id
            WHERE m.id IN ({placeholders})
            ORDER BY g.created_at DESC
            """,
            member_ids,
        ).fetchall()
        result = []
        for group in groups:
            if search and search not in group["name"].lower() and search not in group["description"].lower():
                continue
            result.append(_group_view(connection, group, group["member_id"]))
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

    with _database() as connection:
        group_id = _make_id("group-")
        member_id = _make_member_id()
        invite_code = _make_invite_code()
        while connection.execute(
            "SELECT 1 FROM community_groups WHERE invite_code = ?",
            (invite_code,),
        ).fetchone():
            invite_code = _make_invite_code()
        group = {
            "id": group_id,
            "name": name,
            "description": description or "Grup diskusi komunitas Ustad Online.",
            "invite_code": invite_code,
            "created_at": _now(),
        }
        connection.execute(
            """
            INSERT INTO community_groups (id, name, description, invite_code, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (group_id, group["name"], group["description"], invite_code, group["created_at"]),
        )
        connection.execute(
            "INSERT INTO community_members (id, group_id, name) VALUES (?, ?, ?)",
            (member_id, group_id, creator),
        )
        return jsonify(
            {"group": _group_view(connection, group, member_id), "member_id": member_id}
        ), 201


@community_api.post("/api/community/join")
def join_group_by_code():
    body = _json_body()
    code = _normalize_code(body.get("code"))
    name = _validate_name(body.get("name"))
    if not code:
        return _error("Kode undangan wajib diisi.", 400)
    if not name:
        return _error("Nama anggota harus 2-30 karakter.", 400)

    with _database() as connection:
        group = connection.execute(
            "SELECT * FROM community_groups WHERE invite_code = ?",
            (code,),
        ).fetchone()
        if not group:
            return _error("Kode undangan tidak valid.", 404)
        if connection.execute(
            "SELECT 1 FROM community_members WHERE group_id = ? AND name = ? COLLATE NOCASE",
            (group["id"], name),
        ).fetchone():
            return _error("Nama itu sudah dipakai di grup ini. Gunakan nama lain.", 409)
        member_id = _make_member_id()
        connection.execute(
            "INSERT INTO community_members (id, group_id, name) VALUES (?, ?, ?)",
            (member_id, group["id"], name),
        )
        return jsonify(
            {"group": _group_view(connection, group, member_id), "member_id": member_id}
        )


@community_api.get("/api/community/groups/<group_id>/messages")
def get_messages(group_id):
    member_id = _request_member_id()
    with _database() as connection:
        group = connection.execute(
            "SELECT * FROM community_groups WHERE id = ?",
            (group_id,),
        ).fetchone()
        if not group:
            return _error("Grup tidak ditemukan.", 404)
        if not _find_member(connection, group_id, member_id):
            return _error("Anda belum bergabung ke grup ini.", 403)
        rows = connection.execute(
            """
            SELECT id, sender, text, created_at FROM (
                SELECT rowid, id, sender, text, created_at
                FROM community_messages WHERE group_id = ?
                ORDER BY rowid DESC LIMIT ?
            ) ORDER BY rowid
            """,
            (group_id, _MESSAGE_HISTORY_LIMIT),
        ).fetchall()
        members = connection.execute(
            "SELECT id, name FROM community_members WHERE group_id = ? ORDER BY rowid",
            (group_id,),
        ).fetchall()
        return jsonify({
            "group": _group_view(connection, group),
            "messages": [_message_dict(row) for row in rows],
            "members": [{"id": row["id"], "name": row["name"]} for row in members],
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

    with _database() as connection:
        group = connection.execute(
            "SELECT * FROM community_groups WHERE id = ?",
            (group_id,),
        ).fetchone()
        if not group:
            return _error("Grup tidak ditemukan.", 404)
        member = _find_member(connection, group_id, member_id)
        if not member:
            return _error("Anda belum bergabung ke grup ini.", 403)
        message = {
            "id": _make_id("msg-"),
            "sender": member["name"],
            "text": text,
            "created_at": _now(),
        }
        connection.execute(
            """
            INSERT INTO community_messages (id, group_id, sender, text, created_at)
            VALUES (?, ?, ?, ?, ?)
            """,
            (message["id"], group_id, message["sender"], text, message["created_at"]),
        )
        connection.execute(
            """
            DELETE FROM community_messages
            WHERE group_id = ? AND rowid NOT IN (
                SELECT rowid FROM community_messages
                WHERE group_id = ? ORDER BY rowid DESC LIMIT ?
            )
            """,
            (group_id, group_id, _MESSAGE_STORAGE_LIMIT),
        )
        result = {"message": message, "group": _group_view(connection, group)}

    socketio.emit(
        "community_message",
        {"group_id": group_id, "message": message},
        to=f"community:{group_id}",
    )
    return jsonify(result), 201


@socketio.on("join_community")
def join_community_socket(data):
    if not isinstance(data, dict):
        return {"joined": False}
    group_id = data.get("group_id")
    member_id = data.get("member_id")
    if not isinstance(group_id, str) or not isinstance(member_id, str):
        return {"joined": False}
    with _database() as connection:
        is_member = _find_member(connection, group_id, member_id) is not None
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
