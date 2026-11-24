import unittest

from app import app, socketio
from quran_battle import _rooms, _rooms_lock


class QuranBattleSoloTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()
        with _rooms_lock:
            _rooms.clear()

    def start_solo(self, name="Aminah", mode="nama-surat"):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": name, "format": "solo", "mode": mode},
        )
        self.assertEqual(response.status_code, 201, response.get_json())
        return response.get_json()

    def test_solo_matchmaking_starts_immediately_with_one_choice_player(self):
        room = self.start_solo()
        self.assertEqual(room["format"], "solo")
        self.assertEqual(room["status"], "playing")
        self.assertEqual(room["capacity"], 1)
        self.assertEqual(len(room["players"]), 1)
        self.assertEqual(room["mode"]["kind"], "choice")
        self.assertIn("options", room["question"])
        self.assertNotIn("answer", room["question"])

    def test_duo_format_is_rejected(self):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": "Aminah", "format": "duo", "mode": "nama-surat"},
        )
        self.assertEqual(response.status_code, 400)

    def test_fast_correct_answer_gets_more_points(self):
        fast = self.start_solo("Pemain Cepat")
        first_answer = self.client.post(
            f"/api/battle/rooms/{fast['code']}/answer",
            json={"player_id": fast["player_id"], "question_id": 0, "answer": 0},
        )
        self.assertEqual(first_answer.status_code, 200)
        self.assertTrue(first_answer.get_json()["correct"])
        self.assertEqual(first_answer.get_json()["points"], 100)

    def test_incorrect_answer_gets_zero_points(self):
        room = self.start_solo()
        response = self.client.post(
            f"/api/battle/rooms/{room['code']}/answer",
            json={"player_id": room["player_id"], "question_id": 0, "answer": 2},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["correct"])
        self.assertEqual(response.get_json()["points"], 0)

    def test_voice_or_team_mode_is_rejected_as_not_multiple_choice(self):
        for mode in ("sambung-ayat", "team-battle"):
            response = self.client.post(
                "/api/battle/matchmaking",
                json={"name": "Aminah", "format": "solo", "mode": mode},
            )
            self.assertEqual(response.status_code, 400)

    def test_solo_modes_api_only_lists_multiple_choice_modes(self):
        response = self.client.get("/api/battle/modes")
        self.assertEqual(response.status_code, 200)
        modes = response.get_json()
        self.assertTrue(modes)
        self.assertTrue(all(mode["kind"] == "choice" for mode in modes))

    def test_socket_score_submission_uses_server_answer_and_speed_score(self):
        room = self.start_solo("Aminah")
        socket_client = socketio.test_client(app, flask_test_client=self.client)
        try:
            joined = socket_client.emit(
                "join_room",
                {"code": room["code"], "player_id": room["player_id"]},
                callback=True,
            )
            self.assertEqual(joined, {"joined": True})
            result = socket_client.emit(
                "submit_score",
                {
                    "code": room["code"],
                    "player_id": room["player_id"],
                    "question_id": 0,
                    "answer": 0,
                },
                callback=True,
            )
            self.assertTrue(result["correct"])
            self.assertEqual(result["points"], 100)
            battle_result = next(
                event for event in socket_client.get_received()
                if event["name"] == "battle_result"
            )
            self.assertEqual(battle_result["args"][0]["points"], 100)
        finally:
            socket_client.disconnect()

    def test_answer_payload_without_question_id_is_rejected(self):
        room = self.start_solo()
        response = self.client.post(
            f"/api/battle/rooms/{room['code']}/answer",
            json={"player_id": room["player_id"], "answer": 0},
        )
        self.assertEqual(response.status_code, 409)


if __name__ == "__main__":
    unittest.main()
