(function () {
    'use strict';

    const keys = {
        reminders: 'ustadOnline.additional.reminders.v1',
        bookmarks: 'ustadOnline.additional.bookmarks.v1',
        classes: 'ustadOnline.additional.classes.v1',
        planner: 'ustadOnline.additional.planner.v1',
        preferences: 'ustadOnline.additional.preferences.v1'
    };
    let preferences = readJson(keys.preferences, {
        dataSaver: false,
        accessibility: false,
        highContrast: false,
        parentMode: false
    });

    function readJson(key, fallback) {
        try {
            const value = JSON.parse(localStorage.getItem(key));
            return value && typeof value === 'object' ? value : fallback;
        } catch (error) {
            console.error('Data fitur tambahan tidak dapat dibaca:', error);
            return fallback;
        }
    }

    function saveJson(key, value) {
        localStorage.setItem(key, JSON.stringify(value));
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

    document.getElementById('save-reminder')?.addEventListener('click', async () => {
        const time = document.getElementById('reminder-time').value;
        const activity = document.getElementById('reminder-activity').value;
        if (!time) {
            setStatus('reminder-status', 'Pilih waktu pengingat terlebih dahulu.', 'error');
            return;
        }
        const reminder = { time, activity };
        try {
            saveJson(keys.reminders, reminder);
            if ('Notification' in window && Notification.permission === 'default') {
                await Notification.requestPermission();
            }
            setStatus('reminder-status', `Pengingat ${activity} disimpan untuk pukul ${time}.`, 'success');
        } catch (error) {
            console.error('Pengingat tidak dapat disimpan:', error);
            setStatus('reminder-status', 'Pengingat tidak dapat disimpan di perangkat ini.', 'error');
        }
    });

    document.querySelectorAll('[data-preference]').forEach((button) => {
        const key = button.dataset.preference;
        button.setAttribute('aria-checked', String(Boolean(preferences[key])));
        button.addEventListener('click', () => {
            preferences[key] = !preferences[key];
            button.setAttribute('aria-checked', String(preferences[key]));
            saveJson(keys.preferences, preferences);
            document.body.dataset.accessibility = preferences.accessibility ? 'on' : 'off';
            document.body.dataset.highContrast = preferences.highContrast ? 'on' : 'off';
        });
    });
    document.body.dataset.accessibility = preferences.accessibility ? 'on' : 'off';
    document.body.dataset.highContrast = preferences.highContrast ? 'on' : 'off';

    document.getElementById('text-size')?.addEventListener('change', (event) => {
        document.body.dataset.textSize = event.target.value;
        const sizes = { normal: '16px', large: '18px', xlarge: '20px' };
        document.body.style.fontSize = sizes[event.target.value] || sizes.normal;
    });

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
        const bookmarks = readJson(keys.bookmarks, []);
        if (!Array.isArray(bookmarks)) return;
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
                bookmarks.splice(index, 1);
                saveJson(keys.bookmarks, bookmarks);
                renderBookmarks();
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
        const bookmarks = readJson(keys.bookmarks, []);
        if (!Array.isArray(bookmarks)) return;
        bookmarks.unshift({ title, note });
        saveJson(keys.bookmarks, bookmarks);
        document.getElementById('bookmark-title').value = '';
        document.getElementById('bookmark-note').value = '';
        setStatus('bookmark-status', 'Bookmark berhasil disimpan.', 'success');
        renderBookmarks();
    });
    renderBookmarks();

    function renderList(id, items, removeMessage) {
        const list = document.getElementById(id);
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
                items.splice(index, 1);
                saveJson(id === 'class-list' ? keys.classes : keys.planner, items);
                renderList(id, items, removeMessage);
            });
            row.append(copy, remove);
            list.appendChild(row);
        });
    }

    document.getElementById('save-class')?.addEventListener('click', () => {
        const name = document.getElementById('class-name').value.trim();
        const time = document.getElementById('class-time').value;
        if (!name || !time) return;
        const classes = readJson(keys.classes, []);
        classes.push({ label: `${name} — ${new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(time))}` });
        saveJson(keys.classes, classes);
        renderList('class-list', classes, 'Hapus');
    });
    renderList('class-list', readJson(keys.classes, []), 'Hapus');

    document.getElementById('save-planner')?.addEventListener('click', () => {
        const period = document.getElementById('planner-period').value;
        const target = document.getElementById('planner-target').value.trim();
        if (!target) return;
        const planner = readJson(keys.planner, []);
        planner.unshift({ label: `${period.charAt(0).toUpperCase() + period.slice(1)}: ${target}` });
        saveJson(keys.planner, planner);
        document.getElementById('planner-target').value = '';
        renderList('planner-list', planner, 'Hapus');
    });
    renderList('planner-list', readJson(keys.planner, []), 'Hapus');

    document.getElementById('send-report')?.addEventListener('click', () => {
        const type = document.getElementById('report-type').value;
        const detail = document.getElementById('report-detail').value.trim();
        if (!detail) {
            setStatus('report-status', 'Tulis detail laporan sebelum dikirim.', 'error');
            return;
        }
        setStatus('report-status', `Laporan "${type}" berhasil dibuat untuk ditinjau moderator.`, 'success');
        document.getElementById('report-detail').value = '';
    });

    if (new URLSearchParams(window.location.search).has('open_help') || document.body.dataset.openHelp === 'true') {
        document.getElementById('help-center')?.scrollIntoView();
    }
}());
