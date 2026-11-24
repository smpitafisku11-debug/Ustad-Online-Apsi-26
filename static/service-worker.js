const cacheName = 'ustad-online-v4';
const appShell = [
    '/',
    '/static/manifest.json',
    '/static/icon-192.png',
    '/static/icon-512.png',
    '/static/ui_customization.css',
    '/static/ui_customization.js',
    '/static/profile.css',
    '/static/profile.js',
    '/static/page_transitions.css',
    '/static/page_transitions.js',
    '/connect',
    '/ustad-dashboard',
    '/static/ustad_dashboard.css',
    '/static/ustad_dashboard.js',
    '/static/connect.css',
    '/static/connect.js',
    '/fitur',
    '/static/fitur_tambahan.js'
];

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((keys) => Promise.all(
            keys.filter((key) => key !== cacheName).map((key) => caches.delete(key))
        ))
    );
    self.clients.claim();
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    event.respondWith(
        fetch(event.request).catch(() => caches.match(event.request).then((cached) => cached || caches.match('/')))
    );
});
