(function () {
    'use strict';

    const preferenceKey = 'ustadOnline.notifications.v1';
    const seenKey = 'ustadOnline.notifications.seen.v1';
    let registration = null;
    let reminderTimer = null;
    let pollingTimer = null;

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(window.UstadOnlineStorage.getItem(key));
            return value && typeof value === 'object' ? value : fallback;
        } catch (error) {
            return fallback;
        }
    }

    function saveJson(key, value) {
        try {
            window.UstadOnlineStorage.setItem(key, JSON.stringify(value));
        } catch (error) {
            console.error('Status notifikasi tidak dapat disimpan:', error);
        }
    }

    function readSeen() {
        const seen = readJson(seenKey, []);
        return new Set(Array.isArray(seen) ? seen : []);
    }

    function markSeen(id) {
        const seen = readSeen();
        seen.add(id);
        const limited = Array.from(seen).slice(-200);
        saveJson(seenKey, limited);
    }

    async function showNotification(title, body, tag, url) {
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;
        const id = `${tag}:${body}`;
        if (readSeen().has(id)) return false;
        markSeen(id);

        if (registration) {
            await registration.showNotification(title, {
                body,
                tag,
                icon: '/static/icon-192.png',
                badge: '/static/icon-192.png',
                renotify: true,
                data: { url: url || '/' }
            });
        } else {
            new Notification(title, { body, tag, icon: '/static/icon-192.png' });
        }
        return true;
    }

    async function requestPermission() {
        if (!('Notification' in window)) {
            throw new Error('Browser ini belum mendukung notifikasi desktop atau HP.');
        }
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
            throw new Error('Izin notifikasi belum diberikan.');
        }
        const preferences = readJson(preferenceKey, {});
        preferences.enabled = true;
        saveJson(preferenceKey, preferences);
        await showNotification('Notifikasi Ustad Online aktif', 'Chat, tugas guru, setoran, dan target harian akan mengingatkan Anda.', 'notifications-enabled', '/');
        updateMenuAction();
    }

    function updateMenuAction() {
        const menu = document.getElementById('notification-menu');
        if (!menu) return;
        let action = menu.querySelector('[data-enable-phone-notifications]');
        if (!action) {
            action = document.createElement('button');
            action.type = 'button';
            action.dataset.enablePhoneNotifications = 'true';
            action.className = 'phone-notification-action';
            action.innerHTML = '<span>Aktifkan notifikasi HP</span><span>Belum aktif</span>';
            menu.append(action);
            action.addEventListener('click', async () => {
                try {
                    await requestPermission();
                } catch (error) {
                    action.classList.add('is-denied');
                    action.querySelector('span:last-child').textContent = 'Perlu izin';
                }
            });
        }
        const status = action.querySelector('span:last-child');
        if (!('Notification' in window)) {
            action.classList.add('is-denied');
            status.textContent = 'Tidak tersedia';
        } else if (Notification.permission === 'granted') {
            action.classList.remove('is-denied');
            status.textContent = 'Aktif';
        } else if (Notification.permission === 'denied') {
            action.classList.add('is-denied');
            status.textContent = 'Ditolak';
        } else {
            action.classList.remove('is-denied');
            status.textContent = 'Aktifkan';
        }
    }

    function localDateKey(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function checkDailyReminders() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return;
        const reminder = readJson('ustadOnline.additional.reminders.v1', null);
        if (!reminder || !reminder.time) return;
        const now = new Date();
        const [hour, minute] = reminder.time.split(':').map(Number);
        if (now.getHours() !== hour || now.getMinutes() !== minute) return;
        const id = `reminder:${localDateKey(now)}:${reminder.time}`;
        showNotification('Waktunya belajar', `${reminder.activity || 'Target hafalan'} · Pukul ${reminder.time}`, id, '/tahfidz');
    }

    async function pollConnectTasks() {
        try {
            const sessionResponse = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const session = await sessionResponse.json();
            if (!session.user) return;
            const response = await fetch('/api/connect/bookings', { credentials: 'same-origin' });
            if (!response.ok) return;
            const payload = await response.json();
            for (const booking of payload.bookings || []) {
                const id = `booking:${booking.id}:${booking.status}`;
                if (readSeen().has(id)) continue;
                if (booking.status === 'confirmed') {
                    await showNotification('Sesi Ustad Connect dikonfirmasi', `Sesi ${booking.mode || 'belajar'} sudah dikonfirmasi.`, id, '/connect');
                } else if (booking.status === 'completed') {
                    await showNotification('Tugas/sesi telah dinilai', 'Pengajar telah menyelesaikan dan memberi evaluasi sesi.', id, '/connect');
                } else if (booking.status === 'requested' && session.user.role === 'teacher') {
                    await showNotification('Permintaan siswa baru', 'Ada permintaan sesi baru yang menunggu konfirmasi.', id, '/ustad-dashboard');
                }
            }
        } catch (error) {
            console.error('Notifikasi tugas Ustad Connect tidak dapat diperiksa:', error);
        }
    }

    async function pollTahfidzSubmissions() {
        try {
            const sessionResponse = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const session = await sessionResponse.json();
            if (!session.user) return;
            const response = await fetch('/api/tahfidz/submissions', { credentials: 'same-origin' });
            if (!response.ok) return;
            const payload = await response.json();
            for (const submission of payload.submissions || []) {
                if (submission.status === 'approved') {
                    await showNotification('Setoran hafalan disetujui', `${submission.target_title} telah diterima pengajar.`, `tahfidz:${submission.id}:approved`, '/tahfidz');
                } else if (submission.status === 'needs_revision') {
                    await showNotification('Setoran perlu diperbaiki', `${submission.target_title} perlu murajaah dan setoran ulang.`, `tahfidz:${submission.id}:revision`, '/tahfidz');
                } else if (submission.status === 'pending' && session.user.role === 'teacher') {
                    await showNotification('Setoran hafalan baru', 'Ada setoran siswa yang menunggu tinjauan pengajar.', `tahfidz:${submission.id}:pending`, '/ustad-dashboard');
                }
            }
        } catch (error) {
            console.error('Notifikasi Tahfidz tidak dapat diperiksa:', error);
        }
    }

    async function pollCommunityMessages() {
        let memberIds = {};
        try {
            memberIds = JSON.parse(window.UstadOnlineStorage.getItem('ustadOnline.community.member.v1') || '{}');
        } catch (error) {
            return;
        }
        for (const [groupId, memberId] of Object.entries(memberIds)) {
            try {
                const response = await fetch(`/api/community/groups/${encodeURIComponent(groupId)}/messages?member_id=${encodeURIComponent(memberId)}`, { credentials: 'same-origin' });
                if (!response.ok) continue;
                const payload = await response.json();
                const latest = (payload.messages || []).slice(-1)[0];
                if (!latest) continue;
                const id = `chat:${latest.id}`;
                if (readSeen().has(id)) continue;
                const profileName = (window.UstadOnlineStorage.getItem('ustadOnline.community.profile.v1') || '').trim();
                if (profileName && latest.sender === profileName) continue;
                await showNotification(`Pesan baru · ${payload.group?.name || 'Komunitas'}`, `${latest.sender}: ${latest.text}`, id, '/komunitas');
            } catch (error) {
                console.error('Notifikasi chat tidak dapat diperiksa:', error);
            }
        }
    }

    async function start() {
        if ('serviceWorker' in navigator) {
            try {
                registration = await navigator.serviceWorker.register('/static/service-worker.js');
            } catch (error) {
                console.error('Service worker notifikasi tidak dapat dipasang:', error);
            }
        }
        updateMenuAction();
        if (notificationPreferenceEnabled()) {
            document.addEventListener('visibilitychange', () => {
                if (!document.hidden) pollAll();
            });
            pollAll();
            pollingTimer = window.setInterval(pollAll, 30000);
            reminderTimer = window.setInterval(checkDailyReminders, 30000);
        }
    }

    function notificationPreferenceEnabled() {
        if (!('Notification' in window) || Notification.permission !== 'granted') return false;
        return readJson(preferenceKey, {}).enabled !== false;
    }

    function pollAll() {
        pollConnectTasks();
        pollTahfidzSubmissions();
        pollCommunityMessages();
        checkDailyReminders();
    }

    window.UstadNotifications = {
        requestPermission,
        showNotification,
        pollAll
    };

    document.addEventListener('ustad:pagechange', updateMenuAction);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start);
    else start();
})();
