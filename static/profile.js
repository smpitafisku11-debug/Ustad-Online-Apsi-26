(function () {
    'use strict';

    const photoStorageKey = 'ustadOnline.profile.photo.v1';
    const loginDialog = document.getElementById('account-login-dialog');
    const profileDialog = document.getElementById('profile-dialog');
    const authForm = document.getElementById('account-auth-form');
    const profileForm = document.getElementById('profile-form');
    const nameInput = document.getElementById('login-name');
    const passwordInput = document.getElementById('login-password');
    const phoneInput = document.getElementById('login-phone');
    const experienceInput = document.getElementById('login-experience');
    let user = null;
    let csrfToken = '';
    let authRole = 'student';
    let authMode = 'login';
    let pendingPhoto = '';
    let deferredInstallPrompt = null;

    function safeName(value) {
        return typeof value === 'string' && value.trim() ? value.trim() : 'Pengguna';
    }

    function initials(name) {
        return safeName(name).split(/\s+/).slice(0, 2).map((part) => part.charAt(0).toUpperCase()).join('') || 'U';
    }

    function roleLabel(role) {
        return role === 'teacher' ? 'Ustad' : 'Siswa';
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
            const photo = localStorage.getItem(photoStorageKey);
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
        document.querySelectorAll('[data-profile-name]').forEach((element) => {
            element.textContent = name;
        });
        document.querySelectorAll('[data-profile-avatar]').forEach((element) => {
            const container = element.closest('.profile-photo-preview, .profile-avatar') || element;
            renderAvatar(container, name);
        });
        const button = document.getElementById('profile-button');
        if (button) button.setAttribute('aria-label', user ? `Profil ${name}, ${roleLabel(user.role)}` : 'Login atau profil pengguna');
    }

    function setRole(role) {
        authRole = role;
        document.querySelectorAll('[data-account-role]').forEach((button) => {
            button.setAttribute('aria-selected', String(button.dataset.accountRole === role));
        });
        updateAuthForm();
    }

    function setMode(mode) {
        authMode = mode;
        document.querySelectorAll('[data-auth-mode]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.authMode === mode));
        });
        updateAuthForm();
    }

    function updateAuthForm() {
        const registering = authMode === 'register';
        const teacherRegistration = registering && authRole === 'teacher';
        document.querySelectorAll('[data-register-only]').forEach((group) => {
            group.hidden = !registering;
        });
        document.querySelectorAll('[data-teacher-only]').forEach((group) => {
            group.hidden = !teacherRegistration;
        });
        if (nameInput) nameInput.required = registering;
        if (phoneInput) phoneInput.required = teacherRegistration;
        if (experienceInput) experienceInput.required = teacherRegistration;
        if (passwordInput) {
            passwordInput.autocomplete = registering ? 'new-password' : 'current-password';
            passwordInput.placeholder = registering ? 'Buat kata sandi, minimal 8 karakter' : 'Kata sandi akun';
        }
        const reviewNote = document.getElementById('auth-review-note');
        if (reviewNote) reviewNote.hidden = !teacherRegistration;
        const intro = document.getElementById('auth-intro');
        if (intro) {
            if (teacherRegistration) intro.textContent = 'Ajukan akun pengajar. Admin akan meninjau kelayakan melalui kontak Anda.';
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
            email: String(formData.get('email') || '').trim(),
            password: String(formData.get('password') || '')
        };
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
            pendingPhoto = readPhoto();
            applyProfile();
            loginDialog?.close();
        } catch (error) {
            console.error('Akun tidak dapat diproses:', error);
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
                if (pendingPhoto) localStorage.setItem(photoStorageKey, pendingPhoto);
                else localStorage.removeItem(photoStorageKey);
            } catch (storageError) {
                console.error('Foto profil tidak dapat disimpan:', storageError);
                setStatus(document.getElementById('profile-status'), 'Profil tersimpan, tetapi foto tidak dapat disimpan di browser ini.', 'error');
                applyProfile();
                return;
            }
            applyProfile();
            setStatus(document.getElementById('profile-status'), 'Perubahan profil berhasil disimpan.', 'success');
        } catch (error) {
            console.error('Profil tidak dapat disimpan:', error);
            setStatus(document.getElementById('profile-status'), error.message, 'error');
        }
    });

    document.getElementById('profile-logout')?.addEventListener('click', async () => {
        try {
            const result = await postJson('/api/auth/logout', {});
            csrfToken = result.csrf_token || '';
            user = null;
            pendingPhoto = '';
            localStorage.removeItem(photoStorageKey);
            applyProfile();
            profileDialog?.close();
            authForm?.reset();
            setRole('student');
            setMode('login');
            setStatus(document.getElementById('login-status'), '', '');
            if (loginDialog) loginDialog.showModal();
        } catch (error) {
            console.error('Logout gagal:', error);
            setStatus(document.getElementById('profile-status'), `Tidak dapat keluar: ${error.message}`, 'error');
        }
    });

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

    async function initializeAuth() {
        updateAuthForm();
        try {
            const response = await fetch('/api/auth/session', { credentials: 'same-origin' });
            if (!response.ok) throw new Error('Sesi akun tidak dapat diperiksa.');
            const result = await response.json();
            csrfToken = result.csrf_token || '';
            user = result.user;
            pendingPhoto = readPhoto();
            applyProfile();
            if (!user && loginDialog && !loginDialog.open) loginDialog.showModal();
        } catch (error) {
            console.error('Status login tidak dapat diperiksa:', error);
            setStatus(document.getElementById('login-status'), 'Tidak dapat terhubung ke server. Pastikan aplikasi masih berjalan lalu muat ulang halaman.', 'error');
            if (loginDialog && !loginDialog.open) loginDialog.showModal();
        }
    }

    initializeAuth();
}());
