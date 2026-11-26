(function () {
    'use strict';

    const photoStorageKey = 'ustadOnline.profile.photo.v1';
    const gamificationStorageKey = 'ustadOnline.gamification.v1';
    const loginDialog = document.getElementById('account-login-dialog');
    const profileDialog = document.getElementById('profile-dialog');
    const authForm = document.getElementById('account-auth-form');
    const profileForm = document.getElementById('profile-form');
    const nameInput = document.getElementById('login-name');
    const passwordInput = document.getElementById('login-password');
    const phoneInput = document.getElementById('login-phone');
    const experienceInput = document.getElementById('login-experience');
    const emailFields = document.querySelector('[data-account-email]');
    const usernameFields = document.querySelector('[data-account-username]');
    const authModeSwitch = document.querySelector('.auth-mode-switch');
    const passwordLabel = document.getElementById('login-password-label');
    let user = null;
    let csrfToken = '';
    let authRole = 'student';
    let authMode = 'login';
    let pendingPhoto = '';
    let deferredInstallPrompt = null;
    let gamificationStorageAvailable = true;
    let gamification = emptyGamification();

    function emptyGamification() {
        return {
            version: 1,
            totalXp: 0,
            earnedTasks: [],
            activityDates: [],
            achievements: [],
            reflectionNote: '',
            saveReflection: true
        };
    }

    function setGamificationNote(message) {
        document.querySelectorAll('[data-gamification-note]').forEach((element) => {
            element.textContent = message;
        });
    }

    function readGamification() {
        try {
            const stored = window.UstadOnlineStorage.getItem(gamificationStorageKey);
            if (stored === null) return emptyGamification();
            const value = JSON.parse(stored);
            if (
                !value ||
                value.version !== 1 ||
                !Number.isSafeInteger(value.totalXp) ||
                value.totalXp < 0 ||
                !Array.isArray(value.earnedTasks) ||
                !value.earnedTasks.every((item) => typeof item === 'string') ||
                !Array.isArray(value.activityDates) ||
                !value.activityDates.every((item) => /^\d{4}-\d{2}-\d{2}$/.test(item)) ||
                !Array.isArray(value.achievements) ||
                !value.achievements.every((item) => typeof item === 'string') ||
                (value.reflectionNote !== undefined && typeof value.reflectionNote !== 'string') ||
                (value.saveReflection !== undefined && typeof value.saveReflection !== 'boolean')
            ) {
                throw new Error('Format progres gamifikasi tersimpan tidak valid.');
            }
            if (value.reflectionNote === undefined) value.reflectionNote = '';
            if (value.saveReflection === undefined) value.saveReflection = true;
            if (!value.saveReflection) value.reflectionNote = '';
            return value;
        } catch (error) {
            gamificationStorageAvailable = false;
            console.error('Progres gamifikasi tidak dapat dibaca:', error);
            setGamificationNote('Penyimpanan progres tidak dapat dibaca. Aktivitas hanya berlaku selama halaman ini terbuka.');
            return emptyGamification();
        }
    }

    function saveGamification() {
        if (!gamificationStorageAvailable) return false;
        try {
            window.UstadOnlineStorage.setItem(gamificationStorageKey, JSON.stringify(gamification));
            return true;
        } catch (error) {
            gamificationStorageAvailable = false;
            console.error('Progres gamifikasi tidak dapat disimpan:', error);
            setGamificationNote('Progres sesi ini berjalan, tetapi tidak dapat disimpan di browser perangkat.');
            return false;
        }
    }

    function localDateKey(date) {
        return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
    }

    function dateDifferenceInDays(later, earlier) {
        const [laterYear, laterMonth, laterDay] = later.split('-').map(Number);
        const [earlierYear, earlierMonth, earlierDay] = earlier.split('-').map(Number);
        return Math.round((Date.UTC(laterYear, laterMonth - 1, laterDay) - Date.UTC(earlierYear, earlierMonth - 1, earlierDay)) / 86400000);
    }

    function activeDayStreak() {
        const dates = [...new Set(gamification.activityDates)].sort();
        if (!dates.length) return 0;
        const today = localDateKey(new Date());
        const latestDateOffset = dateDifferenceInDays(today, dates[dates.length - 1]);
        if (latestDateOffset < 0 || latestDateOffset > 2) return 0;
        let streak = 1;
        for (let index = dates.length - 1; index > 0; index -= 1) {
            const gap = dateDifferenceInDays(dates[index], dates[index - 1]);
            if (gap > 2) break;
            streak += 1;
        }
        return streak;
    }

    function recordAchievement(id) {
        if (!gamification.achievements.includes(id)) {
            gamification.achievements.push(id);
            saveGamification();
        }
    }

    function updateGamification() {
        const today = localDateKey(new Date());
        const taskInputs = Array.from(document.querySelectorAll('[data-hafalan-task]'));
        const completedToday = taskInputs.filter((input) => input.checked).length;
        const streak = activeDayStreak();
        const level = gamification.totalXp === 0 ? 0 : Math.floor(gamification.totalXp / 100) + 1;
        const levelXp = gamification.totalXp % 100;
        const rankNames = ['Penjelajah Ilmu', 'Sahabat Ilmu', 'Penjaga Konsistensi', 'Ahli Tilawah', 'Cahaya Ilmu'];
        const rank = level === 0 ? 'Belum ada' : rankNames[Math.min(level - 1, rankNames.length - 1)];
        const formattedXp = new Intl.NumberFormat('id-ID').format(gamification.totalXp);

        document.querySelectorAll('[data-gamification-level], [data-home-level]').forEach((element) => {
            element.textContent = String(level).padStart(2, '0');
        });
        document.querySelectorAll('[data-gamification-xp], [data-home-xp]').forEach((element) => {
            element.textContent = formattedXp;
        });
        document.querySelectorAll('[data-gamification-streak], [data-home-streak]').forEach((element) => {
            element.textContent = String(streak);
        });
        document.querySelectorAll('[data-gamification-missions]').forEach((element) => {
            element.textContent = `${completedToday}/${taskInputs.length}`;
        });
        document.querySelectorAll('[data-gamification-rank], [data-home-rank]').forEach((element) => {
            element.textContent = rank;
        });
        document.querySelectorAll('[data-gamification-level-xp]').forEach((element) => {
            element.textContent = String(levelXp);
        });
        document.querySelectorAll('[data-gamification-next-xp]').forEach((element) => {
            element.textContent = '100';
        });
        document.querySelectorAll('.profile-level-track').forEach((element) => {
            element.setAttribute('aria-valuenow', String(levelXp));
            element.setAttribute('aria-valuetext', `${levelXp} dari 100 EXP menuju level berikutnya`);
        });
        document.querySelectorAll('[data-gamification-progress]').forEach((element) => {
            element.style.width = `${levelXp}%`;
        });

        if (gamification.totalXp >= 10) recordAchievement('first-step');
        if (streak >= 3) recordAchievement('steady-rhythm');
        if (taskInputs.length > 0 && completedToday === taskInputs.length) recordAchievement('daily-finish');
        gamification.achievements.forEach((id) => {
            const achievement = Array.from(document.querySelectorAll('[data-achievement]'))
                .find((element) => element.dataset.achievement === id);
            if (achievement) {
                achievement.classList.add('is-earned');
                achievement.setAttribute('aria-label', `${achievement.querySelector('strong').textContent}, berhasil diraih`);
                achievement.querySelector('b').textContent = '✓';
            }
        });
        updateProfileDashboard();
    }

    function recordMission(input) {
        if (!input.checked) {
            updateGamification();
            return;
        }
        const today = localDateKey(new Date());
        const rewardKey = `${today}:${input.dataset.hafalanTask}`;
        if (!gamification.earnedTasks.includes(rewardKey)) {
            gamification.earnedTasks.push(rewardKey);
            gamification.totalXp += 10;
            if (!gamification.activityDates.includes(today)) gamification.activityDates.push(today);
            saveGamification();
        }
        updateGamification();
    }

    function readAcademyProgress() {
        const storageKey = 'ustadOnline.tilawah.progress.v1';
        try {
            const stored = window.UstadOnlineStorage.getItem(storageKey);
            if (!stored) return null;
            const value = JSON.parse(stored);
            if (!value || typeof value !== 'object' || !value.byLevel || typeof value.byLevel !== 'object') {
                throw new Error('Format riwayat Akademi Tilawah tidak valid.');
            }
            document.querySelector('[data-learning-history]')?.removeAttribute('data-error');
            return value;
        } catch (error) {
            console.error('Riwayat Akademi Tilawah tidak dapat dibaca:', error);
            const history = document.querySelector('[data-learning-history]');
            if (history) history.dataset.error = 'true';
            return null;
        }
    }

    function profileActivityCounts() {
        const counts = new Map();
        gamification.earnedTasks.forEach((reward) => {
            const match = /^(\d{4}-\d{2}-\d{2}):[0-2]$/.exec(reward);
            if (match) counts.set(match[1], (counts.get(match[1]) || 0) + 1);
        });
        return counts;
    }

    function renderWeeklyActivity() {
        const chart = document.querySelector('[data-week-chart]');
        if (!chart) return;
        const counts = profileActivityCounts();
        let total = 0;
        chart.querySelectorAll('[data-week-offset]').forEach((column) => {
            const date = new Date();
            date.setHours(12, 0, 0, 0);
            date.setDate(date.getDate() - Number(column.dataset.weekOffset));
            const dateKey = localDateKey(date);
            const completed = counts.get(dateKey) || 0;
            total += completed;
            column.querySelector('[data-week-value]').textContent = String(completed);
            column.querySelector('[data-week-label]').textContent = new Intl.DateTimeFormat('id-ID', { weekday: 'short' }).format(date);
            column.setAttribute('aria-label', `${new Intl.DateTimeFormat('id-ID', { weekday: 'long', day: 'numeric', month: 'long' }).format(date)}: ${completed} misi selesai`);
            column.querySelector('[data-week-bar]').style.height = `${Math.min(100, (completed / 3) * 100)}%`;
        });
        const totalElement = document.querySelector('[data-week-total]');
        if (totalElement) totalElement.textContent = `${total} misi`;
    }

    function renderLearningHistory(academyProgress) {
        const history = document.querySelector('[data-learning-history]');
        const missions = document.querySelector('[data-mission-history]');
        if (!history || !missions) return;
        history.replaceChildren();
        missions.replaceChildren();
        const missionTitles = ['Hafalan baru · Surah Al-Mulk', 'Setoran · Surah Ar-Rahman', 'Murajaah · Juz 30'];
        const missionActivities = [];
        gamification.earnedTasks.forEach((reward) => {
            const match = /^(\d{4}-\d{2}-\d{2}):([0-2])$/.exec(reward);
            if (match) missionActivities.push({ date: match[1], title: missionTitles[Number(match[2])], type: 'Target' });
        });
        missionActivities.sort((first, second) => second.date.localeCompare(first.date));
        if (!missionActivities.length) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = 'Belum ada target yang ditandai selesai.';
            missions.append(empty);
        } else {
            missionActivities.slice(0, 3).forEach((activity) => appendHistoryItem(missions, activity));
        }

        if (history.dataset.error === 'true') {
            const unavailable = document.createElement('li');
            unavailable.className = 'empty';
            unavailable.textContent = 'Riwayat materi tidak dapat dibaca dari browser ini.';
            history.append(unavailable);
            return;
        }

        const lessons = [];
        const lessonTitles = {
            hijaiyah: 'Huruf Hijaiyah',
            harakat: 'Harakat & Tanda Baca',
            makharij: 'Makharijul Huruf',
            sifat: 'Sifat Huruf',
            tajwid: 'Hukum Tajwid',
            waqaf: 'Waqaf & Ibtida'
        };
        const levelTitles = { pemula: 'Pemula', menengah: 'Menengah', lanjutan: 'Lanjutan' };
        if (academyProgress && academyProgress.byLevel) {
            Object.keys(levelTitles).forEach((level) => {
                const progress = academyProgress.byLevel[level];
                if (!progress || typeof progress !== 'object') return;
                [...new Set(Array.isArray(progress.completed) ? progress.completed : [])].forEach((id) => {
                    if (lessonTitles[id]) lessons.push({ title: `${lessonTitles[id]} · ${levelTitles[level]}`, type: 'Materi' });
                });
                if (progress.quiz && Number.isFinite(progress.quiz.score) && progress.quiz.score >= 0 && progress.quiz.score <= 100) {
                    lessons.push({ title: `Evaluasi ${levelTitles[level]} · ${progress.quiz.score}%`, type: 'Latihan' });
                }
            });
        }
        if (!lessons.length) {
            const empty = document.createElement('li');
            empty.className = 'empty';
            empty.textContent = 'Belum ada materi selesai atau hasil evaluasi.';
            history.append(empty);
            return;
        }
        lessons.slice(0, 5).forEach((activity) => appendHistoryItem(history, activity));
    }

    function appendHistoryItem(list, activity) {
        const item = document.createElement('li');
        const badge = document.createElement('span');
        badge.className = 'profile-history-type';
        badge.textContent = activity.type;
        const title = document.createElement('span');
        title.className = 'profile-history-title';
        title.textContent = activity.title;
        item.append(badge, title);
        if (activity.date) {
            const date = document.createElement('time');
            date.dateTime = activity.date;
            const [year, month, day] = activity.date.split('-').map(Number);
            date.textContent = new Intl.DateTimeFormat('id-ID', { day: 'numeric', month: 'short' }).format(new Date(year, month - 1, day));
            item.append(date);
        }
        list.append(item);
    }

    function updateLearningRecommendation(academyProgress) {
        const title = document.querySelector('[data-profile-recommendation-title]');
        const message = document.querySelector('[data-profile-recommendation]');
        const quizResult = document.querySelector('[data-profile-quiz-result]');
        if (!title || !message) return;

        const lessonTitles = {
            hijaiyah: 'Huruf Hijaiyah',
            harakat: 'Harakat & Tanda Baca',
            makharij: 'Makharijul Huruf',
            sifat: 'Sifat Huruf',
            tajwid: 'Hukum Tajwid',
            waqaf: 'Waqaf & Ibtida'
        };
        const levels = ['pemula', 'menengah', 'lanjutan'];
        const levelTitles = { pemula: 'Pemula', menengah: 'Menengah', lanjutan: 'Lanjutan' };
        const lessonIds = Object.keys(lessonTitles);
        let recommendation = 'Mulai dari materi Huruf Hijaiyah, atau pilih target murajaah yang terasa ringan hari ini.';
        let evaluation = null;

        if (academyProgress && academyProgress.byLevel) {
            const level = levels.includes(academyProgress.level) ? academyProgress.level : 'pemula';
            const progress = academyProgress.byLevel[level];
            if (progress && progress.quiz && Number.isFinite(progress.quiz.score)) {
                evaluation = progress.quiz.score;
                const missedLesson = Array.isArray(progress.quiz.missed)
                    ? progress.quiz.missed.find((id) => lessonTitles[id])
                    : null;
                recommendation = missedLesson
                    ? `Ulangi ${lessonTitles[missedLesson]} pada jalur ${levelTitles[level]} berdasarkan catatan latihanmu.`
                    : `Kamu telah menuntaskan evaluasi jalur ${levelTitles[level]}. Kamu bisa mengulang materi pilihan atau mencoba jalur berikutnya.`;
            } else if (progress && Array.isArray(progress.completed)) {
                const nextLesson = lessonIds.find((id) => !progress.completed.includes(id));
                recommendation = nextLesson
                    ? `Langkah berikut yang belum ditandai selesai: ${lessonTitles[nextLesson]} pada jalur ${levelTitles[level]}.`
                    : `Semua materi jalur ${levelTitles[level]} telah ditandai selesai. Coba evaluasi untuk melihat topik yang ingin kamu ulangi.`;
            }
        }

        title.textContent = evaluation === null ? 'Saran langkah berikutnya' : 'Saran dari latihan terakhir';
        message.textContent = recommendation;
        if (quizResult) {
            quizResult.hidden = evaluation === null;
            if (evaluation !== null) quizResult.textContent = `Hasil evaluasi tercatat: ${evaluation}%. Ini catatan latihan, bukan penilaian menyeluruh atas kemampuanmu.`;
        }
    }

    function updateProfileDashboard() {
        renderWeeklyActivity();
        const academyProgress = readAcademyProgress();
        renderLearningHistory(academyProgress);
        updateLearningRecommendation(academyProgress);

        const inputs = Array.from(document.querySelectorAll('[data-hafalan-task]'));
        const completed = inputs.filter((input) => input.checked).length;
        const count = document.querySelector('[data-profile-target-count]');
        const progress = document.querySelector('.profile-target-card [role="progressbar"]');
        const fill = document.querySelector('[data-profile-target-progress]');
        if (count) count.textContent = `${completed}/${inputs.length}`;
        if (progress) {
            progress.setAttribute('aria-valuenow', String(completed));
            progress.setAttribute('aria-valuetext', `${completed} dari ${inputs.length} target selesai`);
        }
        if (fill) fill.style.width = `${inputs.length ? (completed / inputs.length) * 100 : 0}%`;
        const targetNote = document.querySelector('[data-profile-target-note]');
        if (targetNote) {
            targetNote.textContent = completed === inputs.length
                ? 'Semua target hari ini sudah ditandai. Istirahat juga bagian dari belajar.'
                : `${inputs.length - completed} target tersedia—pilih yang terasa ringan, tidak perlu diselesaikan sekaligus.`;
        }
    }

    function initializeReflectionNotes() {
        const note = document.querySelector('[data-reflection-note]');
        const savePreference = document.querySelector('[data-save-reflection]');
        const status = document.querySelector('[data-reflection-status]');
        if (!note || !savePreference || !status) return;
        savePreference.checked = gamification.saveReflection;
        note.value = gamification.saveReflection ? gamification.reflectionNote : '';
        if (!savePreference.checked) status.textContent = 'Penyimpanan dimatikan. Catatan hanya berlaku selama halaman ini terbuka.';

        document.querySelector('[data-save-reflection-note]')?.addEventListener('click', () => {
            if (savePreference.checked) {
                gamification.reflectionNote = note.value.trim();
                gamification.saveReflection = true;
                status.textContent = saveGamification()
                    ? 'Catatan murajaah tersimpan di browser perangkat ini.'
                    : 'Catatan tidak dapat disimpan. Perangkat hanya menyimpannya selama halaman ini terbuka.';
            } else {
                gamification.reflectionNote = '';
                status.textContent = 'Catatan tidak disimpan dan hanya berlaku selama halaman ini terbuka.';
            }
        });
        savePreference.addEventListener('change', () => {
            gamification.saveReflection = savePreference.checked;
            gamification.reflectionNote = savePreference.checked ? note.value.trim() : '';
            const saved = saveGamification();
            status.textContent = !saved
                ? 'Preferensi penyimpanan tidak dapat disimpan pada browser ini.'
                : savePreference.checked
                    ? 'Penyimpanan catatan di browser perangkat ini aktif.'
                    : 'Penyimpanan catatan dimatikan. Catatan hanya berlaku selama halaman ini terbuka.';
        });
    }

    function safeName(value) {
        return typeof value === 'string' && value.trim() ? value.trim() : 'Pengguna';
    }

    function initials(name) {
        return safeName(name).split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
    }

    function roleLabel(role) {
        return role === 'teacher' ? 'Ustad' : role === 'admin' ? 'Admin' : 'Siswa';
    }

    function setStatus(element, message, kind) {
        if (!element) return;
        element.textContent = message;
        element.className = `profile-status${kind ? ` ${kind}` : ''}`;
    }

    async function postJson(url, payload) {
        const response = await fetch(url, {
            method: 'POST',
            credentials: 'same-origin',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRF-Token': csrfToken
            },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        if (result.csrf_token) csrfToken = result.csrf_token;
        if (!response.ok) {
            const error = new Error(result.error || 'Permintaan tidak dapat diproses.');
            error.status = response.status;
            throw error;
        }
        return result;
    }

    function readPhoto() {
        try {
            const photo = window.UstadOnlineStorage.getItem(photoStorageKey);
            return typeof photo === 'string' ? photo : '';
        } catch (error) {
            console.error('Foto profil tidak dapat dibaca:', error);
            return '';
        }
    }

    function renderAvatar(container, name) {
        if (!container) return;
        container.innerHTML = '';
        if (pendingPhoto) {
            const image = document.createElement('img');
            image.src = pendingPhoto;
            image.alt = `Foto profil ${safeName(name)}`;
            container.appendChild(image);
        } else {
            const initial = document.createElement('span');
            initial.textContent = initials(name);
            container.appendChild(initial);
        }
    }

    function applyProfile() {
        const name = user ? user.name : 'Pengguna';
        const isTeacher = Boolean(user && ['teacher', 'admin'].includes(user.role));
        const isAdmin = Boolean(user && user.role === 'admin');
        document.querySelectorAll('[data-teacher-feature]').forEach((element) => {
            element.hidden = !isTeacher;
        });
        document.querySelectorAll('[data-admin-feature]').forEach((element) => {
            element.hidden = !isAdmin;
        });
        updateFeatureCount();
        document.querySelectorAll('[data-profile-name]').forEach((element) => {
            element.textContent = name;
        });
        document.querySelectorAll('.profile-photo-preview, .profile-avatar, .profile-journey-avatar')
            .forEach((container) => renderAvatar(container, name));
        const button = document.getElementById('profile-button');
        if (button) button.setAttribute('aria-label', user ? `Profil ${name}, ${roleLabel(user.role)}` : 'Login atau profil pengguna');
    }

    function updateFeatureCount() {
        const isTeacher = Boolean(user && ['teacher', 'admin'].includes(user.role));
        const isAdmin = Boolean(user && user.role === 'admin');
        const count = isAdmin ? 10 : isTeacher ? 9 : 8;
        const language = document.documentElement.lang || 'id';
        const formattedCount = new Intl.NumberFormat(language).format(count);
        const label = window.UstadOnlineI18n
            ? window.UstadOnlineI18n.translateKey('app.featuresAvailable')
            : 'fitur tersedia';
        document.querySelectorAll('[data-feature-count]').forEach((element) => {
            element.textContent = `${formattedCount} ${label}`;
        });
    }

    window.addEventListener('ustadonline:languagechange', updateFeatureCount);
    document.addEventListener('DOMContentLoaded', updateFeatureCount, { once: true });

    function setRole(role) {
        authRole = role;
        document.querySelectorAll('[data-account-role]').forEach((button) => {
            button.setAttribute('aria-selected', String(button.dataset.accountRole === role));
        });
        updateAuthForm();
    }

    function setMode(mode) {
        authMode = authRole === 'admin' ? 'login' : mode;
        document.querySelectorAll('[data-auth-mode]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.authMode === authMode));
        });
        updateAuthForm();
    }

    function updateAuthForm() {
        const isAdminLogin = authRole === 'admin';
        const registering = authMode === 'register' && !isAdminLogin;
        const teacherRegistration = registering && authRole === 'teacher';
        document.querySelectorAll('[data-register-only]').forEach((group) => {
            group.hidden = !registering;
        });
        document.querySelectorAll('[data-teacher-only]').forEach((group) => {
            group.hidden = !teacherRegistration;
        });
        if (emailFields) emailFields.hidden = isAdminLogin;
        if (usernameFields) usernameFields.hidden = !isAdminLogin;
        const emailInput = document.getElementById('login-email');
        if (emailInput) emailInput.required = !isAdminLogin;
        const usernameInput = document.getElementById('login-username');
        if (usernameInput) usernameInput.required = isAdminLogin;
        if (authModeSwitch) authModeSwitch.hidden = isAdminLogin;
        if (nameInput) nameInput.required = registering;
        if (phoneInput) phoneInput.required = teacherRegistration;
        if (experienceInput) experienceInput.required = teacherRegistration;
        if (passwordInput) {
            passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
            passwordInput.minLength = isAdminLogin ? 1 : 8;
            passwordInput.placeholder = isAdminLogin ? 'Kata sandi admin server' : registering ? 'Buat kata sandi, minimal 8 karakter' : 'Kata sandi akun';
        }
        if (passwordLabel) passwordLabel.textContent = isAdminLogin ? 'Kata sandi admin' : 'Kata sandi';
        const reviewNote = document.getElementById('auth-review-note');
        if (reviewNote) reviewNote.hidden = !teacherRegistration;
        const intro = document.getElementById('auth-intro');
        if (intro) {
            if (isAdminLogin) intro.textContent = 'Masuk untuk membuka pratinjau mode Siswa dan Ustad serta panel review admin.';
            else if (teacherRegistration) intro.textContent = 'Ajukan akun pengajar. Admin akan meninjau kelayakan melalui kontak Anda.';
            else if (registering) intro.textContent = 'Buat akun siswa untuk menyimpan profil dan perjalanan belajarmu.';
            else intro.textContent = `Masuk dengan akun ${roleLabel(authRole)} yang sudah terdaftar.`;
        }
        const submit = document.getElementById('auth-submit');
        if (submit) {
            const action = registering ? (authRole === 'teacher' ? 'Kirim pengajuan Ustad' : 'Buat akun Siswa') : `Masuk sebagai ${roleLabel(authRole)}`;
            submit.innerHTML = `${action} <span aria-hidden="true">↗</span>`;
        }
    }

    function openProfile() {
        if (user && user.role === 'admin') {
            window.location.assign('/admin');
            return;
        }
        if (!user) {
            if (loginDialog && !loginDialog.open) loginDialog.showModal();
            return;
        }
        document.getElementById('profile-name').value = user.name;
        document.getElementById('profile-username').value = user.username || '';
        document.getElementById('profile-email').value = user.email;
        document.getElementById('profile-role').value = roleLabel(user.role);
        document.getElementById('profile-bio').value = user.bio || '';
        pendingPhoto = readPhoto();
        renderAvatar(document.getElementById('profile-photo-preview'), user.name);
        setStatus(document.getElementById('profile-status'), '', '');
        if (profileDialog && !profileDialog.open) profileDialog.showModal();
    }

    document.querySelectorAll('[data-account-role]').forEach((button) => {
        button.addEventListener('click', () => {
            if (button.dataset.accountRole === 'admin') setMode('login');
            setRole(button.dataset.accountRole);
            setStatus(document.getElementById('login-status'), '', '');
        });
    });
    document.querySelectorAll('[data-auth-mode]').forEach((button) => {
        button.addEventListener('click', () => {
            setMode(button.dataset.authMode);
            setStatus(document.getElementById('login-status'), '', '');
        });
    });
    document.querySelectorAll('[data-profile-open]').forEach((button) => button.addEventListener('click', openProfile));
    document.querySelectorAll('[data-open-profile-missions]').forEach((button) => {
        button.addEventListener('click', () => {
            profileDialog?.close();
            document.getElementById('hafalan-modal')?.showModal();
        });
    });
    document.querySelectorAll('[data-profile-close]').forEach((button) => {
        button.addEventListener('click', () => profileDialog?.close());
    });
    [loginDialog, profileDialog].forEach((dialog) => {
        dialog?.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    });

    authForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!authForm.reportValidity()) return;
        const formData = new FormData(authForm);
        const data = {
            role: authRole,
            password: String(formData.get('password') || '')
        };
        if (authRole !== 'admin') data.email = String(formData.get('email') || '').trim();
        else data.username = String(formData.get('username') || '').trim();
        if (authMode === 'register') {
            data.name = String(formData.get('name') || '').trim();
            if (authRole === 'teacher') {
                data.phone = String(formData.get('phone') || '').trim();
                data.experience = String(formData.get('experience') || '').trim();
            }
        }
        const submit = document.getElementById('auth-submit');
        submit.disabled = true;
        setStatus(document.getElementById('login-status'), 'Memeriksa data akun...', '');
        try {
            const result = await postJson(
                authMode === 'register' ? '/api/auth/register' : '/api/auth/login',
                data
            );
            if (result.status === 'pending') {
                authForm.reset();
                setMode('login');
                setRole('teacher');
                setStatus(document.getElementById('login-status'), result.message, 'success');
                return;
            }
            user = result.user;
            window.UstadOnlineStorage.setAccount(user.id);
            pendingPhoto = readPhoto();
            applyProfile();
            if (user.role === 'admin') {
                window.location.assign('/admin');
                return;
            }
            loginDialog?.close();
            window.location.reload();
        } catch (error) {
            if (!error.status || error.status >= 500) console.error('Akun tidak dapat diproses:', error);
            setStatus(document.getElementById('login-status'), error.message, 'error');
        } finally {
            submit.disabled = false;
        }
    });

    document.getElementById('profile-photo')?.addEventListener('change', (event) => {
        const file = event.target.files && event.target.files[0];
        if (!file) return;
        if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
            setStatus(document.getElementById('profile-status'), 'Gunakan foto PNG, JPG, atau WebP.', 'error');
            event.target.value = '';
            return;
        }
        if (file.size > 2 * 1024 * 1024) {
            setStatus(document.getElementById('profile-status'), 'Ukuran foto maksimal 2 MB.', 'error');
            event.target.value = '';
            return;
        }
        const reader = new FileReader();
        reader.onload = () => {
            pendingPhoto = String(reader.result);
            renderAvatar(document.getElementById('profile-photo-preview'), user ? user.name : 'Pengguna');
        };
        reader.onerror = () => {
            setStatus(document.getElementById('profile-status'), 'Foto tidak dapat dibaca. Coba pilih file lain.', 'error');
        };
        reader.readAsDataURL(file);
    });

    profileForm?.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!profileForm.reportValidity()) return;
        const formData = new FormData(profileForm);
        try {
            const result = await postJson('/api/auth/profile', {
                name: String(formData.get('name') || '').trim(),
                username: String(formData.get('username') || '').trim(),
                bio: String(formData.get('bio') || '').trim()
            });
            user = result.user;
            try {
                if (pendingPhoto) window.UstadOnlineStorage.setItem(photoStorageKey, pendingPhoto);
                else window.UstadOnlineStorage.removeItem(photoStorageKey);
            } catch (storageError) {
                console.error('Foto profil tidak dapat disimpan:', storageError);
                setStatus(document.getElementById('profile-status'), 'Profil tersimpan, tetapi foto tidak dapat disimpan di browser ini.', 'error');
                applyProfile();
                return;
            }
            applyProfile();
            setStatus(document.getElementById('profile-status'), 'Perubahan profil berhasil disimpan.', 'success');
        } catch (error) {
            if (!error.status || error.status >= 500) console.error('Profil tidak dapat disimpan:', error);
            setStatus(document.getElementById('profile-status'), error.message, 'error');
        }
    });

    async function endSession(openLogin) {
        try {
            const result = await postJson('/api/auth/logout', {});
            csrfToken = result.csrf_token || '';
            window.UstadOnlineStorage.removeItem(photoStorageKey);
            user = null;
            window.UstadOnlineStorage.setAccount(null);
            pendingPhoto = '';
            applyProfile();
            profileDialog?.close();
            authForm?.reset();
            setRole('student');
            setMode('login');
            setStatus(document.getElementById('login-status'), '', '');
            if (openLogin && loginDialog) loginDialog.showModal();
            window.location.reload();
        } catch (error) {
            console.error('Sesi akun tidak dapat diakhiri:', error);
            setStatus(document.getElementById('profile-status'), `Tidak dapat mengakhiri sesi: ${error.message}`, 'error');
        }
    }

    document.getElementById('profile-logout')?.addEventListener('click', () => endSession(false));
    document.getElementById('profile-switch-account')?.addEventListener('click', () => endSession(true));

    document.getElementById('profile-install-button')?.addEventListener('click', async () => {
        if (!deferredInstallPrompt) return;
        deferredInstallPrompt.prompt();
        await deferredInstallPrompt.userChoice;
        deferredInstallPrompt = null;
        document.getElementById('profile-install-button').hidden = true;
    });
    window.addEventListener('beforeinstallprompt', (event) => {
        event.preventDefault();
        deferredInstallPrompt = event;
        const installButton = document.getElementById('profile-install-button');
        if (installButton) installButton.hidden = false;
    });

    if ('serviceWorker' in navigator) {
        window.addEventListener('load', () => {
            navigator.serviceWorker.register('/static/service-worker.js').catch((error) => {
                console.error('Service worker tidak dapat dipasang:', error);
            });
        });
    }

    document.querySelectorAll('[data-hafalan-task]').forEach((input) => {
        input.addEventListener('change', () => recordMission(input));
    });

    async function initializeAuth() {
        updateAuthForm();
        try {
            const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Sesi akun tidak dapat diperiksa.');
            const result = await response.json();
            csrfToken = result.csrf_token || '';
            user = result.user;
            window.UstadOnlineStorage.setAccount(user ? user.id : null);
            pendingPhoto = readPhoto();
            applyProfile();
            if (user && user.admin_preview) {
                document.getElementById('admin-preview-mode')?.removeAttribute('hidden');
            }
            const notification = document.getElementById('application-notification');
            if (notification && result.application_notification) {
                const note = result.application_notification.message || 'Silakan hubungi admin untuk informasi lebih lanjut.';
                notification.textContent = `Pengajuan Ustad ditolak. Catatan admin: ${note}`;
                notification.hidden = false;
            }
            gamificationStorageAvailable = true;
            gamification = readGamification();
            document.querySelectorAll('[data-hafalan-task]').forEach((input) => {
                if (input.checked) recordMission(input);
            });
            document.querySelectorAll('[data-achievement]').forEach((achievement) => {
                achievement.classList.remove('is-earned');
                achievement.setAttribute('aria-label', `${achievement.querySelector('strong').textContent}, belum diraih`);
                achievement.querySelector('b').textContent = '·';
            });
            updateGamification();
            initializeReflectionNotes();
            if (!user && loginDialog && !loginDialog.open) loginDialog.showModal();
        } catch (error) {
            console.error('Status login tidak dapat diperiksa:', error);
            setStatus(document.getElementById('login-status'), 'Tidak dapat terhubung ke server. Pastikan aplikasi masih berjalan lalu muat ulang halaman.', 'error');
            if (loginDialog && !loginDialog.open) loginDialog.showModal();
        }
    }

    initializeAuth();
}());
