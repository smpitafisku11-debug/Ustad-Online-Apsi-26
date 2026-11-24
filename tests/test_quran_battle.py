import io
import unittest

from app import app, socketio
from quran_battle import _rooms, _rooms_lock


class QuranBattleApiTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()
        with _rooms_lock:
            _rooms.clear()

    def match(self, name, game_format, mode):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": name, "format": game_format, "mode": mode},
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_duo_matchmaking_synchronizes_players_and_scores(self):
        first = self.match("Aminah", "duo", "nama-surat")
        self.assertEqual(first["status"], "waiting")
        second = self.match("Fauzi", "duo", "nama-surat")
        self.assertEqual(first["code"], second["code"])
        self.assertEqual(second["status"], "playing")

        first_answer = self.client.post(
            f"/api/battle/rooms/{first['code']}/answer",
            json={"player_id": first["player_id"], "question_id": 0, "answer": 0},
        )
        self.assertTrue(first_answer.get_json()["correct"])
        second_answer = self.client.post(
            f"/api/battle/rooms/{first['code']}/answer",
            json={"player_id": second["player_id"], "question_id": 0, "answer": 0},
        )
        self.assertEqual(second_answer.get_json()["room"]["question_index"], 1)

    def test_trio_matchmaking_starts_at_three_players(self):
        players = [self.match(f"Pemain {index}", "trio", "puzzle") for index in range(3)]
        self.assertEqual(len({player["code"] for player in players}), 1)
        self.assertEqual(players[1]["status"], "waiting")
        self.assertEqual(players[2]["status"], "playing")
        self.assertEqual(len(players[2]["players"]), 3)

    def test_team_battle_assigns_two_teams_and_aggregates_scores(self):
        first = self.match("Aminah", "duo", "team-battle")
        second = self.match("Fauzi", "duo", "team-battle")
        self.assertEqual([player["team_id"] for player in second["players"]], ["A", "B"])

        for player in (first, second):
            response = self.client.post(
                f"/api/battle/rooms/{first['code']}/answer",
                json={"player_id": player["player_id"], "question_id": 0, "answer": 1},
            )
            self.assertEqual(response.status_code, 200, response.get_json())

        teams = response.get_json()["room"]["teams"]
        self.assertEqual(teams, [{"id": "A", "score": 100}, {"id": "B", "score": 100}])

    def test_team_battle_requires_multiple_players(self):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": "Pemain", "format": "solo", "mode": "team-battle"},
        )
        self.assertEqual(response.status_code, 400)

    def test_room_members_receive_socket_updates(self):
        first = self.match("Aminah", "duo", "nama-surat")
        socket_client = socketio.test_client(app, flask_test_client=self.client)
        try:
            joined = socket_client.emit(
                "join_room",
                {"code": first["code"], "player_id": first["player_id"]},
                callback=True,
            )
            self.assertEqual(joined, {"joined": True})

            self.match("Fauzi", "duo", "nama-surat")
            events = socket_client.get_received()
            self.assertTrue(any(event["name"] == "room_updated" for event in events))

            left = socket_client.emit(
                "leave_battle_room",
                {"code": first["code"], "player_id": first["player_id"]},
                callback=True,
            )
            self.assertEqual(left, {"left": True})
            socketio.emit("room_updated", {"code": first["code"]}, to=first["code"])
            self.assertEqual(socket_client.get_received(), [])
        finally:
            socket_client.disconnect()

    def test_submit_score_emits_a_battle_result_to_room_members(self):
        first = self.match("Aminah", "duo", "tajwid-battle")
        second = self.match("Fauzi", "duo", "tajwid-battle")
        first_socket = socketio.test_client(app, flask_test_client=self.client)
        second_socket = socketio.test_client(app, flask_test_client=self.client)
        try:
            for socket_client, player in ((first_socket, first), (second_socket, second)):
                joined = socket_client.emit(
                    "join_room",
                    {"code": first["code"], "player_id": player["player_id"]},
                    callback=True,
                )
                self.assertEqual(joined, {"joined": True})

            result = first_socket.emit(
                "submit_score",
                {
                    "code": first["code"],
                    "player_id": first["player_id"],
                    "question_id": 0,
                    "answer": 1,
                },
                callback=True,
            )
            self.assertTrue(result["correct"])
            self.assertEqual(result["points"], 100)
            received = second_socket.get_received()
            battle_result = next(event for event in received if event["name"] == "battle_result")
            self.assertEqual(battle_result["args"][0]["player_id"], first["player_id"])
        finally:
            first_socket.disconnect()
            second_socket.disconnect()

    def test_legacy_socket_events_use_server_identity_and_scoring(self):
        player = self.match("Aminah", "duo", "tajwid-battle")
        self.match("Fauzi", "duo", "tajwid-battle")
        socket_client = socketio.test_client(app, flask_test_client=self.client)
        try:
            joined = socket_client.emit(
                "join_battle_room",
                {
                    "room": player["code"],
                    "player_id": player["player_id"],
                    "username": "Nama Palsu",
                },
                callback=True,
            )
            self.assertEqual(joined, {"joined": True})
            status_event = next(
                event for event in socket_client.get_received()
                if event["name"] == "status_message"
            )
            self.assertEqual(
                status_event["args"][0]["msg"],
                "Aminah telah bergabung ke ruang battle!",
            )

            result = socket_client.emit(
                "submit_answer",
                {
                    "room": player["code"],
                    "player_id": player["player_id"],
                    "question_id": 0,
                    "answer": 0,
                    "is_correct": True,
                    "score": 99999,
                },
                callback=True,
            )
            self.assertFalse(result["correct"])
            self.assertEqual(result["points"], 0)
            score_event = next(
                event for event in socket_client.get_received()
                if event["name"] == "update_score"
            )
            self.assertEqual(
                score_event["args"][0],
                {
                    "username": "Aminah",
                    "is_correct": False,
                    "score": 0,
                    "points": 0,
                },
            )
        finally:
            socket_client.disconnect()

    def test_buzzer_is_first_come_first_served(self):
        first = self.match("Hana", "duo", "buzzer")
        second = self.match("Rafi", "duo", "buzzer")
        path = f"/api/battle/rooms/{first['code']}/buzzer"
        self.assertEqual(
            self.client.post(path, json={"player_id": first["player_id"]}).status_code,
            200,
        )
        self.assertEqual(
            self.client.post(path, json={"player_id": second["player_id"]}).status_code,
            409,
        )

    def test_invalid_api_payloads_are_rejected(self):
        self.assertEqual(
            self.client.post("/api/battle/matchmaking", json=[]).status_code,
            400,
        )
        player = self.match("Pemain", "solo", "nama-surat")
        missing_question_id = self.client.post(
            f"/api/battle/rooms/{player['code']}/answer",
            json={"player_id": player["player_id"], "answer": 0},
        )
        self.assertEqual(missing_question_id.status_code, 409)

    def test_custom_room_shares_recordings_only_with_room_members(self):
        room = self.client.post(
            "/api/battle/rooms",
            json={"name": "Host", "format": "custom", "capacity": 2, "mode": "sambung-ayat"},
        ).get_json()
        guest = self.client.post(
            f"/api/battle/rooms/{room['code']}/join", json={"name": "Guest"}
        ).get_json()
        uploaded = self.client.post(
            f"/api/battle/rooms/{room['code']}/recording",
            data={
                "player_id": guest["player_id"],
                "recording": (io.BytesIO(b"audio"), "setoran.webm", "audio/webm"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(uploaded.status_code, 200, uploaded.get_json())
        media_path = f"/api/battle/rooms/{room['code']}/recordings/{guest['player_id']}"
        allowed = self.client.get(f"{media_path}?player_id={room['player_id']}")
        denied = self.client.get(f"{media_path}?player_id=not-a-room-member")
        self.assertEqual(allowed.data, b"audio")
        self.assertEqual(denied.status_code, 403)


if __name__ == "__main__":
    unittest.main()
