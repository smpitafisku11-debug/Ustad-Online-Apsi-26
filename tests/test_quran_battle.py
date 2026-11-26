import io
import unittest
from unittest.mock import patch

from app import app, socketio
from quran_battle import MODES, _rooms, _rooms_lock


class QuranBattleTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        app.config["SESSION_COOKIE_SECURE"] = False
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

    def test_unknown_format_is_rejected(self):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": "Aminah", "format": "duo", "mode": "nama-surat"},
        )
        self.assertEqual(response.status_code, 400)

    def test_correct_streak_adds_combo_bonus_without_speed_scoring(self):
        room = self.start_solo(mode="tajwid-battle")
        with _rooms_lock:
            _rooms[room["code"]]["round_started_at"] -= 10
        answers = []
        for question_index, question in enumerate(MODES["tajwid-battle"]["questions"]):
            response = self.client.post(
                f"/api/battle/rooms/{room['code']}/answer",
                json={
                    "player_id": room["player_id"],
                    "question_id": question_index,
                    "answer": question["answer"],
                },
            )
            self.assertEqual(response.status_code, 200)
            answers.append(response.get_json())

        self.assertEqual([answer["points"] for answer in answers], [100, 100, 110])
        self.assertEqual([answer["streak"] for answer in answers], [1, 2, 3])
        self.assertEqual(answers[-1]["combo_bonus"], 10)
        player = next(player for player in answers[-1]["room"]["players"] if player["is_you"])
        self.assertEqual(player["best_streak"], 3)

    def test_wrong_answer_resets_combo_streak(self):
        room = self.start_solo(mode="tajwid-battle")
        questions = MODES["tajwid-battle"]["questions"]
        answers = (
            questions[0]["answer"],
            (questions[1]["answer"] + 1) % len(questions[1]["options"]),
            questions[2]["answer"],
        )
        responses = []
        for question_index, answer in enumerate(answers):
            response = self.client.post(
                f"/api/battle/rooms/{room['code']}/answer",
                json={
                    "player_id": room["player_id"],
                    "question_id": question_index,
                    "answer": answer,
                },
            )
            self.assertEqual(response.status_code, 200)
            responses.append(response.get_json())

        self.assertEqual([response["streak"] for response in responses], [1, 0, 1])
        self.assertEqual(responses[1]["points"], 0)
        self.assertEqual(responses[2]["combo_bonus"], 0)

    def test_combo_bonus_has_a_server_side_cap(self):
        original_mode = MODES["tajwid-battle"]
        extended_mode = {**original_mode, "questions": original_mode["questions"] * 4}
        with patch.dict(MODES, {"tajwid-battle": extended_mode}):
            room = self.start_solo(mode="tajwid-battle")
            last_response = None
            for question_index, question in enumerate(extended_mode["questions"]):
                last_response = self.client.post(
                    f"/api/battle/rooms/{room['code']}/answer",
                    json={
                        "player_id": room["player_id"],
                        "question_id": question_index,
                        "answer": question["answer"],
                    },
                )
                self.assertEqual(last_response.status_code, 200)

        self.assertEqual(last_response.get_json()["combo_bonus"], 30)
        self.assertEqual(last_response.get_json()["points"], 130)

    def test_correct_answers_get_fixed_points_not_speed_bonus(self):
        fast = self.start_solo("Pemain")
        first_answer = self.client.post(
            f"/api/battle/rooms/{fast['code']}/answer",
            json={"player_id": fast["player_id"], "question_id": 0, "answer": 0},
        )
        self.assertEqual(first_answer.status_code, 200)
        self.assertTrue(first_answer.get_json()["correct"])
        self.assertEqual(first_answer.get_json()["points"], 100)
        self.assertEqual(first_answer.get_json()["room"]["players"][0]["exp"], 5)

    def test_incorrect_answer_gets_zero_points(self):
        room = self.start_solo()
        response = self.client.post(
            f"/api/battle/rooms/{room['code']}/answer",
            json={"player_id": room["player_id"], "question_id": 0, "answer": 2},
        )
        self.assertEqual(response.status_code, 200)
        self.assertFalse(response.get_json()["correct"])
        self.assertEqual(response.get_json()["points"], 0)

    def test_voice_mode_is_available_but_team_battle_requires_team_format(self):
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": "Aminah", "format": "solo", "mode": "sambung-ayat"},
        )
        self.assertEqual(response.status_code, 201)
        self.assertEqual(response.get_json()["mode"]["kind"], "voice")
        response = self.client.post(
            "/api/battle/matchmaking",
            json={"name": "Aminah", "format": "duel", "mode": "team-battle"},
        )
        self.assertEqual(response.status_code, 201)

    def test_modes_api_lists_the_six_requested_modes(self):
        response = self.client.get("/api/battle/modes")
        self.assertEqual(response.status_code, 200)
        self.assertEqual({mode["key"] for mode in response.get_json()}, {
            "tajwid-battle", "sambung-ayat", "hafalan-battle", "nama-surat",
            "makharij-battle", "team-battle",
        })

    def test_duel_room_starts_when_two_players_join(self):
        created = self.client.post(
            "/api/battle/rooms",
            json={"name": "Aminah", "format": "duel", "mode": "tajwid-battle"},
        )
        self.assertEqual(created.status_code, 201)
        room = created.get_json()
        self.assertEqual(room["status"], "waiting")
        self.assertEqual(room["capacity"], 2)
        joined = self.client.post(
            f"/api/battle/rooms/{room['code']}/join",
            json={"name": "Fatimah"},
        )
        self.assertEqual(joined.status_code, 200)
        self.assertEqual(joined.get_json()["status"], "playing")
        self.assertEqual(len(joined.get_json()["players"]), 2)

    def test_team_room_assigns_balanced_teams_and_exposes_team_scores(self):
        created = self.client.post(
            "/api/battle/rooms",
            json={"name": "Aminah", "format": "trio", "mode": "team-battle"},
        )
        self.assertEqual(created.status_code, 201)
        room = created.get_json()
        for name in ("Fatimah", "Aisyah"):
            joined = self.client.post(
                f"/api/battle/rooms/{room['code']}/join",
                json={"name": name},
            )
            self.assertEqual(joined.status_code, 200)
        self.assertEqual(joined.get_json()["status"], "playing")
        self.assertEqual([player["team_id"] for player in joined.get_json()["players"]], [None, None, None])
        self.assertEqual(joined.get_json()["capacity"], 3)
        self.assertEqual(len(joined.get_json()["teams"]), 0)

    def test_team_format_is_rejected_but_custom_side_count_is_supported(self):
        team = self.client.post(
            "/api/battle/rooms",
            json={"name": "Aminah", "format": "team", "mode": "tajwid-battle"},
        )
        self.assertEqual(team.status_code, 400)

        custom = self.client.post(
            "/api/battle/rooms",
            json={"name": "Aminah", "format": "custom", "sides": 5, "mode": "tajwid-battle"},
        )
        self.assertEqual(custom.status_code, 201)
        room = custom.get_json()
        self.assertEqual(room["format"], "custom")
        self.assertEqual(room["capacity"], 5)

    def test_voice_recording_is_unscored_and_not_playable_by_other_players(self):
        created = self.client.post(
            "/api/battle/rooms",
            json={
                "name": "Aminah",
                "format": "duel",
                "mode": "hafalan-battle",
                "category": "surah-pendek",
            },
        )
        room = created.get_json()
        self.assertEqual(room["category"], "Surah pendek")
        opponent = self.client.post(
            f"/api/battle/rooms/{room['code']}/join",
            json={"name": "Fatimah"},
        ).get_json()
        response = self.client.post(
            f"/api/battle/rooms/{room['code']}/recording",
            data={
                "player_id": room["player_id"],
                "recording": (io.BytesIO(b"audio sample"), "sample.webm", "audio/webm"),
            },
            content_type="multipart/form-data",
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.get_json()["points"], 0)
        self.assertEqual(response.get_json()["assessment"], "pending_teacher_review")
        self.assertEqual(response.get_json()["room"]["players"][0]["score"], 0)
        self.assertEqual(response.get_json()["room"]["players"][0]["exp"], 5)
        playback = self.client.get(
            f"/api/battle/rooms/{room['code']}/recordings/{room['player_id']}",
            query_string={"player_id": opponent["player_id"]},
        )
        self.assertEqual(playback.status_code, 403)

    def test_player_can_report_another_player_and_admin_can_read_queue(self):
        created = self.client.post(
            "/api/battle/rooms",
            json={"name": "Aminah", "format": "duel", "mode": "tajwid-battle"},
        ).get_json()
        opponent = self.client.post(
            f"/api/battle/rooms/{created['code']}/join",
            json={"name": "Fatimah"},
        ).get_json()
        response = self.client.post(
            f"/api/battle/rooms/{created['code']}/report",
            json={
                "player_id": created["player_id"],
                "target_id": opponent["player_id"],
                "reason": "perilaku",
                "details": "Perilaku tidak pantas saat pertandingan.",
            },
        )
        self.assertEqual(response.status_code, 201)
        report_id = response.get_json()["report_id"]
        self.assertEqual(
            self.client.get("/api/battle/admin/reports").status_code,
            403,
        )
        with self.client.session_transaction() as admin_session:
            admin_session["admin_authenticated"] = True
            admin_session["csrf_token"] = "battle-report-test-token"
        queue = self.client.get("/api/battle/admin/reports")
        self.assertEqual(queue.status_code, 200)
        report = next(item for item in queue.get_json()["reports"] if item["id"] == report_id)
        self.assertEqual(report["target_name"], "Fatimah")
        reviewed = self.client.post(
            f"/api/battle/admin/reports/{report_id}",
            json={"decision": "reviewed"},
            headers={"X-CSRF-Token": "battle-report-test-token"},
        )
        self.assertEqual(reviewed.status_code, 200)

    def test_socket_score_submission_uses_server_answer_and_combo_score(self):
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
