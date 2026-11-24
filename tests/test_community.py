import os
import tempfile
import unittest

from app import app, socketio
from community import init_community_db


class CommunityGroupTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.original_database = app.config["AUTH_DATABASE"]
        self.temp_dir = tempfile.TemporaryDirectory()
        app.config["AUTH_DATABASE"] = os.path.join(self.temp_dir.name, "community.sqlite3")
        init_community_db(app.config["AUTH_DATABASE"])
        self.client = app.test_client()

    def tearDown(self):
        app.config["AUTH_DATABASE"] = self.original_database
        self.temp_dir.cleanup()

    def test_group_page_renders_invite_and_realtime_chat(self):
        response = self.client.get("/komunitas")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Grup Komunitas", response.data)
        self.assertIn(b"join_community", response.data)
        self.assertIn(b"community_message", response.data)
        self.assertIn(b"Kode undangan", response.data)

    def test_create_join_send_and_keep_groups_private(self):
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
        owner_id = payload["member_id"]
        self.assertEqual(self.client.get("/api/community/groups").get_json(), [])

        joined = self.client.post(
            "/api/community/join",
            json={"code": payload["group"]["invite_code"].lower(), "name": "Fauzi"},
        )
        self.assertEqual(joined.status_code, 200)
        guest_id = joined.get_json()["member_id"]

        listed = self.client.get(f"/api/community/groups?ids={owner_id}").get_json()
        self.assertEqual([group["id"] for group in listed], [group_id])
        self.assertEqual(
            self.client.get(f"/api/community/groups?ids=invalid-member").get_json(),
            [],
        )
        self.assertEqual(
            self.client.get(f"/api/community/groups/{group_id}/messages").status_code,
            403,
        )
        self.assertEqual(
            self.client.get(
                f"/api/community/groups/{group_id}/messages",
                headers={"X-Member-Id": guest_id},
            ).status_code,
            200,
        )

        sent = self.client.post(
            f"/api/community/groups/{group_id}/messages",
            json={"member_id": owner_id, "text": "Assalamu'alaikum, siap belajar."},
        )
        self.assertEqual(sent.status_code, 201)
        self.assertEqual(sent.get_json()["message"]["sender"], "Aminah")

        messages = self.client.get(
            f"/api/community/groups/{group_id}/messages",
            headers={"X-Member-Id": guest_id},
        )
        self.assertEqual(messages.status_code, 200)
        data = messages.get_json()
        self.assertEqual(len(data["members"]), 2)
        self.assertEqual(data["messages"][-1]["text"], "Assalamu'alaikum, siap belajar.")

        # Memberships and messages survive app/database reinitialization.
        init_community_db(app.config["AUTH_DATABASE"])
        persisted = self.client.get(
            f"/api/community/groups/{group_id}/messages",
            headers={"X-Member-Id": guest_id},
        )
        self.assertEqual(persisted.status_code, 200)
        self.assertEqual(persisted.get_json()["messages"][-1]["text"], "Assalamu'alaikum, siap belajar.")

    def test_search_requires_membership_and_rejects_bad_payload(self):
        search = self.client.get("/api/community/groups?q=tajwid")
        self.assertEqual(search.status_code, 200)
        self.assertEqual(search.get_json(), [])
        invalid = self.client.post(
            "/api/community/groups",
            json={"name": "A", "creator": "A"},
        )
        self.assertEqual(invalid.status_code, 400)
        invalid_code = self.client.post(
            "/api/community/join",
            json={"code": "INVALID", "name": "Aisyah"},
        )
        self.assertEqual(invalid_code.status_code, 404)

    def test_socket_requires_membership_and_receives_group_events(self):
        created = self.client.post(
            "/api/community/groups",
            json={"name": "Grup Realtime", "creator": "Aisyah"},
        ).get_json()
        group_id = created["group"]["id"]
        member_id = created["member_id"]
        socket_client = socketio.test_client(app, flask_test_client=self.client)
        try:
            denied = socket_client.emit(
                "join_community",
                {"group_id": group_id, "member_id": "not-a-member"},
                callback=True,
            )
            self.assertEqual(denied, {"joined": False})
            joined = socket_client.emit(
                "join_community",
                {"group_id": group_id, "member_id": member_id},
                callback=True,
            )
            self.assertEqual(joined, {"joined": True})
            sent = self.client.post(
                f"/api/community/groups/{group_id}/messages",
                json={"member_id": member_id, "text": "Pesan realtime"},
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
