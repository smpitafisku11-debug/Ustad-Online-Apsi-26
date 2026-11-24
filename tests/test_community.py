import unittest

from app import app, socketio
from community import _groups, _groups_lock


class CommunityGroupTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()
        with _groups_lock:
            _groups.clear()
            from community import _seed_groups
            _seed_groups()

    def test_group_page_renders_whatsapp_style_chat(self):
        response = self.client.get("/komunitas")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Grup Komunitas", response.data)
        self.assertIn(b"join_community", response.data)
        self.assertIn(b"community_message", response.data)
        self.assertIn(b"Ketik pesan", response.data)

    def test_create_join_and_send_message(self):
        created = self.client.post(
            "/api/community/groups",
            json={
                "name": "Halaqah Tahsin",
                "description": "Latihan makharijul huruf",
                "creator": "Aminah",
            },
        )
        self.assertEqual(created.status_code, 201)
        payload = created.get_json()
        group_id = payload["group"]["id"]
        member_id = payload["member_id"]

        joined = self.client.post(
            f"/api/community/groups/{group_id}/join",
            json={"name": "Fauzi"},
        )
        self.assertEqual(joined.status_code, 200)

        sent = self.client.post(
            f"/api/community/groups/{group_id}/messages",
            json={"member_id": member_id, "text": "Assalamu'alaikum, siap belajar."},
        )
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(sent.get_json()["message"]["sender"], "Aminah")

        messages = self.client.get(f"/api/community/groups/{group_id}/messages")
        self.assertEqual(messages.status_code, 200)
        data = messages.get_json()
        self.assertEqual(len(data["members"]), 2)
        self.assertEqual(data["messages"][0]["text"], "Assalamu'alaikum, siap belajar.")

    def test_search_groups_and_reject_bad_payload(self):
        search = self.client.get("/api/community/groups?q=tajwid")
        self.assertEqual(search.status_code, 200)
        self.assertTrue(search.get_json())
        invalid = self.client.post(
            "/api/community/groups",
            json={"name": "A", "creator": "A"},
        )
        self.assertEqual(invalid.status_code, 400)

    def test_socket_join_receives_room_events(self):
        groups = self.client.get("/api/community/groups").get_json()
        group_id = groups[0]["id"]
        joined = self.client.post(
            f"/api/community/groups/{group_id}/join",
            json={"name": "Aisyah"},
        ).get_json()
        socket_client = socketio.test_client(app, flask_test_client=self.client)
        try:
            result = socket_client.emit(
                "join_community",
                {"group_id": group_id},
                callback=True,
            )
            self.assertEqual(result, {"joined": True})
            sent = self.client.post(
                f"/api/community/groups/{group_id}/messages",
                json={"member_id": joined["member_id"], "text": "Pesan realtime"},
            )
            self.assertEqual(sent.status_code, 201)
            event = next(
                item for item in socket_client.get_received()
                if item["name"] == "community_message"
            )
            self.assertEqual(event["args"][0]["message"]["text"], "Pesan realtime")
        finally:
            socket_client.disconnect()


if __name__ == "__main__":
    unittest.main()
