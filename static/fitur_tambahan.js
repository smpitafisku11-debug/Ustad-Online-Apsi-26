(function () {
    'use strict';

    const keys = {
        reminders: 'ustadOnline.additional.reminders.v1',
        bookmarks: 'ustadOnline.additional.bookmarks.v1',
        classes: 'ustadOnline.additional.classes.v1',
        planner: 'ustadOnline.additional.planner.v1',
        preferences: 'ustadOnline.additional.preferences.v1'
    };
    const defaultPreferences = {
        dataSaver: false,
        accessibility: false,
        highContrast: false,
        parentMode: false,
        textSize: 'normal'
    };
    const storedPreferences = readJson(keys.preferences, defaultPreferences);
    let preferences = {
        dataSaver: typeof storedPreferences.dataSaver === 'boolean' ? storedPreferences.dataSaver : false,
        accessibility: typeof storedPreferences.accessibility === 'boolean' ? storedPreferences.accessibility : false,
        highContrast: typeof storedPreferences.highContrast === 'boolean' ? storedPreferences.highContrast : false,
        parentMode: typeof storedPreferences.parentMode === 'boolean' ? storedPreferences.parentMode : false,
        textSize: ['normal', 'large', 'xlarge'].includes(storedPreferences.textSize)
            ? storedPreferences.textSize
            : 'normal'
    };

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(window.UstadOnlineStorage.getItem(key));
            if (Array.isArray(fallback)) return Array.isArray(value) ? value : fallback;
            return value && typeof value === 'object' && !Array.isArray(value) ? value : fallback;
        } catch (error) {
            console.error('Data fitur tambahan tidak dapat dibaca:', error);
            return fallback;
        }
    }

    function saveJson(key, value, statusId) {
        try {
            window.UstadOnlineStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.error('Data fitur tambahan tidak dapat disimpan:', error);
            if (statusId) setStatus(statusId, 'Data tidak dapat disimpan di perangkat ini.', 'error');
            return false;
        }
    }

    function setStatus(id, message, kind) {
        const element = document.getElementById(id);
        if (!element) return;
        element.textContent = message;
        element.className = `status${kind ? ` ${kind}` : ''}`;
    }

    if ('serviceWorker' in navigator) {
        navigator.serviceWorker.register('/static/service-worker.js').catch((error) => {
            console.error('Service worker tidak dapat dipasang:', error);
        });
    }

    const search = document.getElementById('feature-search');
    search?.addEventListener('input', () => {
        const query = search.value.trim().toLowerCase();
        document.querySelectorAll('[data-feature-search]').forEach((card) => {
            card.hidden = Boolean(query) && !card.dataset.featureSearch.toLowerCase().includes(query);
        });
    });

    document.getElementById('save-reminder')?.addEventListener('click', () => {
        const time = document.getElementById('reminder-time').value;
        const activity = document.getElementById('reminder-activity').value;
        if (!time) {
            setStatus('reminder-status', 'Pilih waktu pengingat terlebih dahulu.', 'error');
            return;
        }
        const reminder = { time, activity };
        if (saveJson(keys.reminders, reminder, 'reminder-status')) {
            setStatus('reminder-status', `Catatan ${activity} tersimpan untuk pukul ${time}.`, 'success');
        }
    });

    document.querySelectorAll('[data-preference]').forEach((button) => {
        const key = button.dataset.preference;
        button.setAttribute('aria-checked', String(Boolean(preferences[key])));
        button.addEventListener('click', () => {
            const previousValue = preferences[key];
            preferences[key] = !previousValue;
            if (!saveJson(keys.preferences, preferences, 'accessibility-status')) {
                preferences[key] = previousValue;
            }
            button.setAttribute('aria-checked', String(preferences[key]));
            document.body.dataset.accessibility = preferences.accessibility ? 'on' : 'off';
            document.body.dataset.highContrast = preferences.highContrast ? 'on' : 'off';
            document.body.dataset.dataSaver = preferences.dataSaver ? 'on' : 'off';
            document.body.dataset.parentMode = preferences.parentMode ? 'on' : 'off';
        });
    });
    document.body.dataset.accessibility = preferences.accessibility ? 'on' : 'off';
    document.body.dataset.highContrast = preferences.highContrast ? 'on' : 'off';
    document.body.dataset.dataSaver = preferences.dataSaver ? 'on' : 'off';
    document.body.dataset.parentMode = preferences.parentMode ? 'on' : 'off';

    const textSize = document.getElementById('text-size');
    if (textSize) {
        textSize.value = preferences.textSize;
        document.body.dataset.textSize = preferences.textSize;
        const sizes = { normal: '16px', large: '18px', xlarge: '20px' };
        document.body.style.fontSize = sizes[preferences.textSize] || sizes.normal;
        textSize.addEventListener('change', (event) => {
            const previousValue = preferences.textSize;
            preferences.textSize = event.target.value;
            if (!saveJson(keys.preferences, preferences, 'accessibility-status')) {
                preferences.textSize = previousValue;
                textSize.value = previousValue;
                return;
            }
            document.body.dataset.textSize = preferences.textSize;
            document.body.style.fontSize = sizes[preferences.textSize] || sizes.normal;
        });
    }

    document.getElementById('save-offline')?.addEventListener('click', async () => {
        if (!('caches' in window)) {
            setStatus('offline-status', 'Browser ini tidak mendukung penyimpanan materi offline.', 'error');
            return;
        }
        try {
            const cache = await caches.open('ustad-online-offline-v1');
            await cache.addAll([
                '/',
                '/baca',
                '/tilawah',
                '/tahfidz',
                '/static/tilawah.js',
                '/static/tilawah.css'
            ]);
            setStatus('offline-status', 'Materi yang tersedia berhasil disiapkan untuk offline.', 'success');
        } catch (error) {
            console.error('Materi offline tidak dapat disimpan:', error);
            setStatus('offline-status', 'Sebagian materi belum dapat diunduh. Periksa koneksi dan lisensi materi.', 'error');
        }
    });

    function renderBookmarks() {
        const list = document.getElementById('bookmark-list');
        const bookmarks = readJson(keys.bookmarks, []).filter((bookmark) =>
            bookmark && typeof bookmark.title === 'string' && typeof bookmark.note === 'string');
        list.innerHTML = '';
        bookmarks.forEach((bookmark, index) => {
            const item = document.createElement('div');
            item.className = 'saved-item';
            const copy = document.createElement('span');
            copy.textContent = `${bookmark.title}: ${bookmark.note}`;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'button';
            remove.textContent = 'Hapus';
            remove.addEventListener('click', () => {
                const updated = bookmarks.filter((_item, itemIndex) => itemIndex !== index);
                if (saveJson(keys.bookmarks, updated, 'bookmark-status')) renderBookmarks();
            });
            item.append(copy, remove);
            list.appendChild(item);
        });
    }

    document.getElementById('save-bookmark')?.addEventListener('click', () => {
        const title = document.getElementById('bookmark-title').value.trim();
        const note = document.getElementById('bookmark-note').value.trim();
        if (!title) {
            setStatus('bookmark-status', 'Masukkan judul atau ayat yang ingin disimpan.', 'error');
            return;
        }
        const bookmarks = readJson(keys.bookmarks, []).filter((bookmark) =>
            bookmark && typeof bookmark.title === 'string' && typeof bookmark.note === 'string');
        bookmarks.unshift({ title, note });
        if (!saveJson(keys.bookmarks, bookmarks, 'bookmark-status')) return;
        document.getElementById('bookmark-title').value = '';
        document.getElementById('bookmark-note').value = '';
        setStatus('bookmark-status', 'Bookmark berhasil disimpan.', 'success');
        renderBookmarks();
    });
    renderBookmarks();

    function renderList(id, items, removeMessage) {
        const list = document.getElementById(id);
        if (!Array.isArray(items)) items = [];
        items = items.filter((item) => item && typeof item.label === 'string');
        list.innerHTML = '';
        items.forEach((item, index) => {
            const row = document.createElement('div');
            row.className = 'saved-item';
            const copy = document.createElement('span');
            copy.textContent = item.label;
            const remove = document.createElement('button');
            remove.type = 'button';
            remove.className = 'button';
            remove.textContent = removeMessage;
            remove.addEventListener('click', () => {
                const updated = items.filter((_item, itemIndex) => itemIndex !== index);
                const isClassList = id === 'class-list';
                const saved = saveJson(
                    isClassList ? keys.classes : keys.planner,
                    updated,
                    isClassList ? 'class-status' : 'planner-status'
                );
                if (saved) renderList(id, updated, removeMessage);
            });
            row.append(copy, remove);
            list.appendChild(row);
        });
    }

    document.getElementById('save-class')?.addEventListener('click', () => {
        const name = document.getElementById('class-name').value.trim();
        const time = document.getElementById('class-time').value;
        if (!name || !time) {
            setStatus('class-status', 'Masukkan nama dan waktu kegiatan.', 'error');
            return;
        }
        const date = new Date(time);
        if (Number.isNaN(date.getTime())) {
            setStatus('class-status', 'Waktu kegiatan tidak valid.', 'error');
            return;
        }
        const classes = readJson(keys.classes, []).filter((item) => item && typeof item.label === 'string');
        classes.push({ label: `${name} — ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(date)}` });
        if (!saveJson(keys.classes, classes, 'class-status')) return;
        renderList('class-list', classes, 'Hapus');
        setStatus('class-status', 'Jadwal tersimpan di perangkat.', 'success');
    });
    renderList('class-list', readJson(keys.classes, []), 'Hapus');

    document.getElementById('save-planner')?.addEventListener('click', () => {
        const period = document.getElementById('planner-period').value;
        const target = document.getElementById('planner-target').value.trim();
        if (!target) return;
        const planner = readJson(keys.planner, []).filter((item) => item && typeof item.label === 'string');
        planner.unshift({ label: `${period.charAt(0).toUpperCase() + period.slice(1)}: ${target}` });
        if (!saveJson(keys.planner, planner, 'planner-status')) return;
        document.getElementById('planner-target').value = '';
        renderList('planner-list', planner, 'Hapus');
        setStatus('planner-status', 'Target tersimpan di perangkat.', 'success');
    });
    renderList('planner-list', readJson(keys.planner, []), 'Hapus');

    document.getElementById('send-report')?.addEventListener('click', async (event) => {
        const button = event.currentTarget;
        const type = document.getElementById('report-type').value;
        const detail = document.getElementById('report-detail').value.trim();
        if (!detail) {
            setStatus('report-status', 'Tulis detail laporan sebelum dikirim.', 'error');
            return;
        }
        const reasons = {
            'Kesalahan materi': 'other',
            'Konten tidak pantas': 'safety',
            'Perilaku pengguna': 'conduct',
            'Masalah teknis': 'other'
        };
        button.disabled = true;
        try {
            const sessionResponse = await fetch('/api/auth/session', { credentials: 'same-origin' });
            const session = await sessionResponse.json();
            if (!sessionResponse.ok) throw new Error(session.error || 'Sesi akun tidak dapat diperiksa.');
            if (!session.user) throw new Error('Masuk ke akun terlebih dahulu dari Beranda untuk mengirim laporan.');

            const response = await fetch('/api/connect/reports', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': session.csrf_token || ''
                },
                body: JSON.stringify({ reason: reasons[type], details: detail })
            });
            const payload = await response.json();
            if (!response.ok) throw new Error(payload.error || 'Laporan tidak dapat dikirim.');
            setStatus('report-status', payload.message, 'success');
            document.getElementById('report-detail').value = '';
        } catch (error) {
            console.error('Laporan tidak dapat dikirim:', error);
            setStatus('report-status', error.message || 'Laporan tidak dapat dikirim.', 'error');
        } finally {
            button.disabled = false;
        }
    });

    if (new URLSearchParams(window.location.search).has('open_help') || document.body.dataset.openHelp === 'true') {
        document.getElementById('help-center')?.scrollIntoView();
    }
}());
