(function () {
    'use strict';

    if (window.UstadPrayerReminder) {
        window.UstadPrayerReminder.mount();
        return;
    }

    const prayers = [
        ['Fajr', 'Subuh'],
        ['Dhuhr', 'Zuhur'],
        ['Asr', 'Asar'],
        ['Maghrib', 'Magrib'],
        ['Isha', 'Isya']
    ];
    const firedStorageKey = 'ustadOnline.prayerReminder.fired.v1';
    let activeRoot = null;
    let enabled = false;
    let coordinates = null;
    let scheduleDate = '';
    let schedule = [];
    let audioContext = null;
    let timer = null;
    let requestSequence = 0;
    let refreshing = false;
    let firedReminders = readFiredReminders();

    function readFiredReminders() {
        try {
            const value = JSON.parse(window.localStorage.getItem(firedStorageKey) || '[]');
            return new Set(Array.isArray(value) ? value.filter((item) => typeof item === 'string') : []);
        } catch (error) {
            console.error('Riwayat alarm sholat tidak dapat dibaca:', error);
            return new Set();
        }
    }

    function saveFiredReminder(key) {
        firedReminders.add(key);
        const values = Array.from(firedReminders).slice(-100);
        firedReminders = new Set(values);
        try {
            window.localStorage.setItem(firedStorageKey, JSON.stringify(values));
        } catch (error) {
            console.error('Riwayat alarm sholat tidak dapat disimpan:', error);
        }
    }

    function localDateKey(date) {
        return [
            date.getFullYear(),
            String(date.getMonth() + 1).padStart(2, '0'),
            String(date.getDate()).padStart(2, '0')
        ].join('-');
    }

    function setStatus(message, isError) {
        const status = activeRoot && activeRoot.querySelector('#prayer-reminder-status');
        if (!status) return;
        status.textContent = message;
        status.classList.toggle('text-red-700', Boolean(isError));
        status.classList.toggle('text-slate-600', !isError);
    }

    function renderSchedule() {
        if (!activeRoot) return;
        const list = activeRoot.querySelector('#prayer-times-list');
        list.replaceChildren();
        if (!schedule.length) {
            const empty = document.createElement('li');
            empty.className = 'col-span-2 rounded-lg border border-slate-200 bg-white p-3 text-xs text-slate-500 sm:col-span-5';
            empty.textContent = 'Jadwal belum dimuat.';
            list.append(empty);
            return;
        }
        schedule.forEach((prayer) => {
            const item = document.createElement('li');
            item.className = 'rounded-lg border border-slate-200 bg-white p-3';
            const label = document.createElement('span');
            label.className = 'block text-[10px] font-semibold uppercase tracking-wide text-slate-500';
            label.textContent = prayer.label;
            const time = document.createElement('strong');
            time.className = 'mt-1 block text-base text-blue-950';
            time.textContent = prayer.time;
            item.append(label, time);
            list.append(item);
        });
    }

    function parsePrayerTime(value) {
        const match = /^(\d{1,2}):(\d{2})/.exec(value || '');
        if (!match) return null;
        const hour = Number(match[1]);
        const minute = Number(match[2]);
        if (hour > 23 || minute > 59) return null;
        return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`;
    }

    async function loadSchedule(position, sequence) {
        if (refreshing) return;
        refreshing = true;
        try {
            const { latitude, longitude } = position;
            const query = new URLSearchParams({
                latitude: String(latitude),
                longitude: String(longitude),
                method: '3'
            });
            const response = await fetch(`https://api.aladhan.com/v1/timings?${query.toString()}`);
            if (!response.ok) throw new Error(`Layanan jadwal sholat merespons dengan status ${response.status}.`);
            const payload = await response.json();
            if (!payload || payload.code !== 200 || !payload.data || !payload.data.timings) {
                throw new Error('Data waktu sholat dari layanan tidak lengkap.');
            }
            if (sequence !== requestSequence || !enabled) return;
            const timings = payload.data.timings;
            schedule = prayers.map(([key, label]) => ({
                key,
                label,
                time: parsePrayerTime(timings[key])
            })).filter((prayer) => prayer.time);
            if (schedule.length !== prayers.length) {
                throw new Error('Jadwal dari layanan tidak mencakup semua waktu sholat.');
            }
            scheduleDate = localDateKey(new Date());
            renderSchedule();
            const timezone = payload.data.meta && payload.data.meta.timezone
                ? ` Zona waktu lokasi: ${payload.data.meta.timezone}.`
                : '';
            setStatus(`Pengingat aktif menggunakan lokasi yang Anda izinkan.${timezone}`);
            updateClock();
        } finally {
            refreshing = false;
        }
    }

    function getPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Browser ini tidak mendukung akses lokasi perangkat.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(
                (position) => resolve({
                    latitude: position.coords.latitude,
                    longitude: position.coords.longitude
                }),
                (error) => {
                    if (error.code === 1) reject(new Error('Izin lokasi ditolak. Izinkan lokasi di pengaturan browser lalu coba lagi.'));
                    else if (error.code === 2) reject(new Error('Lokasi tidak dapat ditentukan. Pastikan layanan lokasi aktif.'));
                    else if (error.code === 3) reject(new Error('Pencarian lokasi terlalu lama. Periksa sinyal lalu coba lagi.'));
                    else reject(new Error('Lokasi perangkat tidak dapat diakses.'));
                },
                { enableHighAccuracy: false, timeout: 12000, maximumAge: 300000 }
            );
        });
    }

    function playAlarm() {
        if (!audioContext || audioContext.state !== 'running') return;
        try {
            const startAt = audioContext.currentTime;
            [0, 0.32, 0.64].forEach((offset, index) => {
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(index === 1 ? 660 : 880, startAt + offset);
                gain.gain.setValueAtTime(0.0001, startAt + offset);
                gain.gain.exponentialRampToValueAtTime(0.18, startAt + offset + 0.025);
                gain.gain.exponentialRampToValueAtTime(0.0001, startAt + offset + 0.24);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.start(startAt + offset);
                oscillator.stop(startAt + offset + 0.25);
            });
        } catch (error) {
            console.error('Nada pengingat sholat tidak dapat diputar:', error);
            setStatus('Jadwal aktif, tetapi suara tidak dapat diputar oleh browser ini.', true);
        }
    }

    function triggerReminder(prayer) {
        const now = new Date();
        const key = `${localDateKey(now)}:${prayer.key}`;
        if (firedReminders.has(key)) return;
        saveFiredReminder(key);
        const alert = activeRoot && activeRoot.querySelector('#prayer-reminder-alert');
        const message = activeRoot && activeRoot.querySelector('#prayer-reminder-alert-text');
        if (alert && message) {
            message.textContent = `Waktu ${prayer.label} telah tiba · ${prayer.time}`;
            alert.hidden = false;
        }
        playAlarm();
        if (window.UstadNotifications) {
            window.UstadNotifications.showNotification(
                `Waktu ${prayer.label}`,
                `Waktu sholat ${prayer.label} telah tiba.`,
                `prayer:${key}`,
                '/'
            ).catch((error) => console.error('Notifikasi waktu sholat gagal ditampilkan:', error));
        }
    }

    function updateClock() {
        if (!activeRoot) return;
        const clock = activeRoot.querySelector('#prayer-reminder-clock');
        if (!clock) return;
        const now = new Date();
        clock.textContent = `Waktu perangkat: ${new Intl.DateTimeFormat('id-ID', {
            weekday: 'long',
            day: 'numeric',
            month: 'long',
            hour: '2-digit',
            minute: '2-digit'
        }).format(now)} · ${Intl.DateTimeFormat().resolvedOptions().timeZone || 'zona waktu lokal'}`;

        if (!enabled || !schedule.length) return;
        if (scheduleDate !== localDateKey(now) && coordinates) {
            loadSchedule(coordinates, requestSequence).catch((error) => {
                console.error('Jadwal sholat hari baru tidak dapat dimuat:', error);
                setStatus(error.message, true);
            });
            return;
        }
        const currentTime = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const due = schedule.find((prayer) => prayer.time === currentTime);
        if (due) triggerReminder(due);
    }

    async function enableReminder() {
        const enableButton = activeRoot.querySelector('#enable-prayer-reminder');
        const disableButton = activeRoot.querySelector('#disable-prayer-reminder');
        enableButton.disabled = true;
        setStatus('Meminta izin lokasi dan menyiapkan nada pengingat...');
        try {
            const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
            if (AudioContextConstructor) {
                if (!audioContext) audioContext = new AudioContextConstructor();
                await audioContext.resume();
            }
            const position = await getPosition();
            coordinates = position;
            enabled = true;
            requestSequence += 1;
            await loadSchedule(position, requestSequence);
            enableButton.hidden = true;
            disableButton.hidden = false;
        } catch (error) {
            enabled = false;
            setStatus(error.message || 'Pengingat tidak dapat diaktifkan.', true);
            console.error('Pengingat sholat tidak dapat diaktifkan:', error);
        } finally {
            enableButton.disabled = false;
        }
    }

    function disableReminder() {
        enabled = false;
        schedule = [];
        scheduleDate = '';
        requestSequence += 1;
        if (audioContext && audioContext.state === 'running') audioContext.suspend();
        const enableButton = activeRoot.querySelector('#enable-prayer-reminder');
        const disableButton = activeRoot.querySelector('#disable-prayer-reminder');
        enableButton.hidden = false;
        disableButton.hidden = true;
        const alert = activeRoot.querySelector('#prayer-reminder-alert');
        alert.hidden = true;
        renderSchedule();
        setStatus('Pengingat dimatikan. Lokasi tidak disimpan di perangkat.');
    }

    function mount() {
        activeRoot = document.getElementById('prayer-reminder');
        if (!activeRoot) return;
        if (activeRoot.dataset.bound !== 'true') {
            activeRoot.dataset.bound = 'true';
            activeRoot.querySelector('#enable-prayer-reminder').addEventListener('click', enableReminder);
            activeRoot.querySelector('#disable-prayer-reminder').addEventListener('click', disableReminder);
            activeRoot.querySelector('#dismiss-prayer-reminder').addEventListener('click', () => {
                activeRoot.querySelector('#prayer-reminder-alert').hidden = true;
            });
        }
        activeRoot.querySelector('#enable-prayer-reminder').hidden = enabled;
        activeRoot.querySelector('#disable-prayer-reminder').hidden = !enabled;
        renderSchedule();
        updateClock();
        if (enabled && schedule.length) setStatus('Pengingat aktif menggunakan lokasi yang Anda izinkan.');
        if (!timer) timer = window.setInterval(updateClock, 15000);
    }

    window.UstadPrayerReminder = { mount };
    mount();
}());
