const cacheName = 'ustad-online-v16';
const appShell = [
    '/',
    '/connect',
    '/baca-quran',
    '/static/manifest.json',
    '/static/icon-192.png',
    '/static/icon-512.png',
    '/static/ui_customization.css',
    '/static/ui_customization.js',
    '/static/translations.js',
    '/static/profile.css',
    '/static/profile.js',
    '/static/qibla.css',
    '/static/qibla.js',
    '/static/quran_book_viewer.css',
    '/static/quran_book_viewer.js',
    '/static/page_transitions.css',
    '/static/page_transitions.js',
    '/static/ustad_dashboard.css',
    '/static/ustad_dashboard.js',
    '/static/afisku-brand.css',
    '/static/connect.css',
    '/static/connect.js',
    '/fitur',
    '/static/fitur_tambahan.js',
    '/static/notifications.css',
    '/static/notifications.js',
    '/dzikir-doa',
    '/static/dzikir_doa.css',
    '/static/dzikir_doa.js'
];
const offlineCacheName = 'ustad-online-offline-v1';

self.addEventListener('install', (event) => {
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(appShell)));
    self.skipWaiting();
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        Promise.all([
            caches.keys().then((keys) => Promise.all(
                keys.filter((key) => key !== cacheName && key !== offlineCacheName).map((key) => caches.delete(key))
            )),
            self.clients.claim()
        ])
    );
});

self.addEventListener('push', (event) => {
    let payload = {};
    try {
        payload = event.data ? event.data.json() : {};
    } catch (error) {
        payload = { title: 'Ustad Online', body: 'Ada pembaruan baru untuk Anda.' };
    }
    event.waitUntil(self.registration.showNotification(payload.title || 'Ustad Online', {
        body: payload.body || 'Ada pembaruan baru untuk Anda.',
        icon: '/static/icon-192.png',
        badge: '/static/icon-192.png',
        tag: payload.tag || 'ustad-online',
        renotify: true,
        data: payload.data || {}
    }));
});

self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const destination = event.notification.data && event.notification.data.url
        ? event.notification.data.url
        : '/';
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            const existing = windowClients.find((client) => client.url && new URL(client.url).origin === self.location.origin);
            if (existing) {
                existing.focus();
                return existing.navigate(destination);
            }
            return clients.openWindow(destination);
        })
    );
});

self.addEventListener('message', (event) => {
    if (!event.data || event.data.type !== 'show-notification') return;
    event.waitUntil(self.registration.showNotification(event.data.title || 'Ustad Online', {
        body: event.data.body || '',
        icon: '/static/icon-192.png',
        badge: '/static/icon-192.png',
        tag: event.data.tag || 'ustad-online',
        renotify: true,
        data: event.data.data || {}
    }));
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;
    const requestUrl = new URL(event.request.url);
    if (requestUrl.origin !== self.location.origin || requestUrl.pathname.startsWith('/api/')) return;

    event.respondWith(
        fetch(event.request).catch(async () => {
            const cached = await caches.match(event.request);
            if (cached) return cached;
            if (event.request.mode === 'navigate') {
                const home = await caches.match('/');
                if (home) return home;
            }
            return Response.error();
        })
    );
});
