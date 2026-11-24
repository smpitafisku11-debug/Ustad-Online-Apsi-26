import unittest

from app import app


class ModulePageTests(unittest.TestCase):
    def setUp(self):
        app.testing = True
        self.client = app.test_client()

    def test_ai_tahsin_and_community_routes_render(self):
        for path, title in (
            ("/ai-tahsin", b"AI Tahsin"),
            ("/komunitas", b"Komunitas"),
            ("/quran-battle", b"Quran Battle Arena"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(title, response.data)

    def test_home_links_to_new_modules(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        for href in (
            b'href="/battle"',
            b'href="/tahsin"',
            b'href="/komunitas"',
            b'href="/tilawah"',
            b'href="/baca"',
            b'href="/connect"',
            b'href="/tahfidz"',
        ):
            self.assertIn(href, response.data)
        for href in (
            b'href="/baca" class="menu-card',
            b'href="/tilawah" class="menu-card',
            b'href="/tahsin" class="menu-card',
            b'href="/connect" class="menu-card',
            b'href="/tahfidz" class="menu-card',
            b'href="/battle" class="menu-card',
            b'href="/komunitas" class="menu-card',
        ):
            self.assertIn(href, response.data)
        self.assertIn(b'href="/tilawah" class="flex min-h-11', response.data)

    def test_baca_quran_route_opens_reader_from_home_template(self):
        response = self.client.get("/baca-quran")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"<title>Baca Al-Qur&#39;an | Ustad Online</title>", response.data)
        self.assertIn(b"quranLibraryModal.showModal();", response.data)

    def test_ustad_connect_route_renders_guidance_page(self):
        response = self.client.get("/ustad-connect")
        self.assertEqual(response.status_code, 200)
        self.assertIn(b"Ustad Connect", response.data)
        self.assertIn(b'href="/komunitas#discussion-form"', response.data)

    def test_routes_from_supplied_app_example_are_available(self):
        for path, content in (
            ("/baca", b"Daftar Surah Al-Qur'an"),
            ("/tilawah", b"Akademi Tilawah"),
            ("/tahsin", b"AI Tahsin"),
            ("/tahfidz", b"Tahfidz &amp; Murajaah"),
            ("/battle", b"Quran Battle Arena"),
            ("/connect", b"Ustad Connect"),
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 200)
                self.assertIn(content, response.data)

    def test_quran_battle_has_requested_modes_and_socket_events(self):
        response = self.client.get("/quran-battle")
        self.assertEqual(response.status_code, 200)
        for expected in (
            b'data-mode-card="tajwid-battle"',
            b'data-mode-card="sambung-ayat"',
            b'data-mode-card="hafalan-battle"',
            b"join_room",
            b"submit_score",
            b"battle_result",
        ):
            self.assertIn(expected, response.data)


if __name__ == "__main__":
    unittest.main()
