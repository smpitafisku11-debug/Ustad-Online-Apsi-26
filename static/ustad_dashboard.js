(function () {
    'use strict';
    const root = document.querySelector('.dashboard-shell');
    if (!root) return;
    let csrfToken = '';
    let profile = null;
    let bookings = [];
    let slots = [];
    let evaluatingId = null;
    const toast = document.querySelector('[data-dashboard-toast]');
    const dialog = document.querySelector('[data-evaluation-dialog]');

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }
    function showToast(message, kind) {
        toast.textContent = message;
        toast.dataset.kind = kind || 'success';
        toast.classList.add('is-visible');
        window.setTimeout(() => toast.classList.remove('is-visible'), 4300);
    }
    async function requestJson(path, options) {
        const response = await fetch(path, Object.assign({ credentials: 'same-origin' }, options || {}));
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Permintaan tidak dapat diproses.');
        return payload;
    }
    async function postJson(path, payload) {
        return requestJson(path, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
            body: JSON.stringify(payload)
        });
    }
    function formatDate(value) {
        return new Intl.DateTimeFormat('id-ID', {
            weekday:'short', day:'numeric', month:'short', year:'numeric',
            hour:'2-digit', minute:'2-digit'
        }).format(new Date(value));
    }
    function statusLabel(status) {
        return {requested:'Menunggu konfirmasi',confirmed:'Dikonfirmasi',completed:'Selesai',cancelled:'Dibatalkan',declined:'Tidak diterima'}[status] || status;
    }

    async function loadDashboard() {
        const session = await requestJson('/api/auth/session');
        csrfToken = session.csrf_token || '';
        if (!session.user || session.user.role !== 'teacher') {
            window.location.replace('/');
            return;
        }
        document.querySelector('[data-dashboard-name]').textContent = session.user.name;
        const me = await requestJson('/api/connect/me');
        profile = me.profile;
        slots = me.slots || [];
        if (profile) {
            const form = document.querySelector('[data-dashboard-profile-form]');
            form.elements.method.value = profile.method;
            form.elements.expertise.value = profile.expertise;
            form.elements.fee.value = profile.fee;
            form.elements.duration.value = profile.duration;
            form.querySelectorAll('input[name="modes"]').forEach((input) => input.checked = profile.modes.includes(input.value));
        }
        document.querySelector('[data-verification-status]').innerHTML = me.teacher_verified
            ? '<span class="status-dot is-approved"></span><strong>Pengajar terverifikasi</strong><small>Identitas & kompetensi telah diperiksa admin</small>'
            : '<span class="status-dot"></span><strong>Verifikasi belum selesai</strong><small>Profil belum dapat menerima pemesanan</small>';
        await loadBookings();
        await loadTahfidzSubmissions();
    }
    async function loadBookings() {
        const payload = await requestJson('/api/connect/bookings');
        bookings = payload.bookings || [];
        const requested = bookings.filter((item) => item.status === 'requested');
        const upcoming = bookings.filter((item) => item.status === 'confirmed');
        const completed = bookings.filter((item) => item.status === 'completed');
        document.querySelector('[data-stat-requested]').textContent = String(requested.length);
        document.querySelector('[data-stat-upcoming]').textContent = String(upcoming.length);
        document.querySelector('[data-stat-completed]').textContent = String(completed.length);
        document.querySelector('[data-stat-slots]').textContent = String(slots.filter((slot) => slot.status === 'available').length);
        document.querySelector('[data-nav-requested]').textContent = String(requested.length);
        renderRequests();
        renderSchedule();
        renderEvaluations(completed);
    }
    function renderRequests() {
        const active = bookings.filter((item) => ['requested','confirmed','cancelled','declined','completed'].includes(item.status));
        const list = document.querySelector('[data-request-list]');
        if (!active.length) {
            list.innerHTML = '<div class="dashboard-empty">Belum ada permintaan sesi siswa.</div>';
            return;
        }
        list.innerHTML = active.map((booking) => {
            let actions = '';
            if (booking.status === 'requested') {
                actions = `<button class="button button-primary button-compact" data-teacher-action="confirm" data-booking-id="${booking.id}">Konfirmasi</button>
                    <button class="button button-compact" data-teacher-action="decline" data-booking-id="${booking.id}">Tolak</button>`;
            } else if (booking.status === 'confirmed') {
                actions = `<button class="button button-primary button-compact" data-teacher-action="complete" data-booking-id="${booking.id}">Selesaikan & evaluasi</button>
                    <button class="text-button" data-teacher-action="cancel" data-booking-id="${booking.id}">Batalkan</button>`;
            }
            return `<article class="dashboard-request">
                <div class="dashboard-request-header"><h3>${escapeHtml(booking.student_name)}</h3><span class="status-pill status-${escapeHtml(booking.status)}">${escapeHtml(statusLabel(booking.status))}</span></div>
                <div class="dashboard-request-meta"><span>${escapeHtml(formatDate(booking.starts_at))}</span><span>Metode: ${escapeHtml({audio:'Audio',video:'Video',chat:'Chat'}[booking.mode] || booking.mode)}</span></div>
                ${booking.evaluation ? `<p class="booking-evaluation">${escapeHtml(booking.evaluation)}</p>` : ''}
                ${actions ? `<div class="dashboard-request-actions">${actions}</div>` : ''}
            </article>`;
        }).join('');
    }
    function renderSchedule() {
        const list = document.querySelector('[data-schedule-list]');
        if (!slots.length) {
            list.innerHTML = '<div class="dashboard-empty">Belum ada jadwal mendatang.</div>';
            return;
        }
        list.innerHTML = slots.map((slot) => `<article class="schedule-card"><strong>${escapeHtml(formatDate(slot.starts_at))}</strong>${slot.status === 'available' ? 'Masih tersedia untuk siswa' : 'Sudah dipesan atau ditutup'}</article>`).join('');
    }

    async function loadTahfidzSubmissions() {
        const list = document.querySelector('[data-tahfidz-review-list]');
        try {
            const payload = await requestJson('/api/tahfidz/submissions');
            const pending = (payload.submissions || []).filter((item) => item.status === 'pending');
            if (!pending.length) {
                list.innerHTML = '<div class="dashboard-empty">Belum ada setoran hafalan yang menunggu tinjauan.</div>';
                return;
            }
            list.innerHTML = pending.map((item) => `
                <article class="dashboard-request" data-tahfidz-submission="${item.id}">
                    <div class="dashboard-request-header"><h3>${escapeHtml(item.student_name)}</h3><span class="status-pill status-requested">Menunggu tinjauan</span></div>
                    <div class="dashboard-request-meta"><span>${escapeHtml(item.target_title)}</span><span>${escapeHtml(item.target_detail)}</span></div>
                    <audio controls preload="metadata" src="/api/tahfidz/submissions/${item.id}/audio"></audio>
                    <label>Catatan penilaian
                        <textarea name="review_note" minlength="3" maxlength="1000" rows="3" required></textarea>
                    </label>
                    <div class="dashboard-request-actions">
                        <button class="button button-primary button-compact" type="button" data-tahfidz-review="approved" data-submission-id="${item.id}">Setujui</button>
                        <button class="button button-compact" type="button" data-tahfidz-review="needs_revision" data-submission-id="${item.id}">Perlu diperbaiki</button>
                    </div>
                </article>
            `).join('');
        } catch (error) {
            list.innerHTML = `<div class="dashboard-empty">${escapeHtml(error.message)}</div>`;
        }
    }

    document.querySelector('[data-tahfidz-review-list]').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-tahfidz-review]');
        if (!button) return;
        const card = button.closest('[data-tahfidz-submission]');
        const note = card.querySelector('[name="review_note"]').value.trim();
        if (note.length < 3) {
            showToast('Catatan penilaian minimal 3 karakter.','error');
            return;
        }
        button.disabled = true;
        try {
            const response = await requestJson(
                `/api/tahfidz/submissions/${button.dataset.submissionId}/review`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                    body: JSON.stringify({ status: button.dataset.tahfidzReview, review_note: note })
                }
            );
            showToast(response.message);
            await loadTahfidzSubmissions();
        } catch (error) {
            showToast(error.message,'error');
            button.disabled = false;
        }
    });
    function renderEvaluations(completed) {
        const list = document.querySelector('[data-evaluation-list]');
        if (!completed.length) {
            list.innerHTML = '<div class="dashboard-empty">Belum ada evaluasi yang diterbitkan.</div>';
            return;
        }
        list.innerHTML = completed.map((booking) => `<article class="evaluation-card"><strong>${escapeHtml(booking.student_name)} · ${escapeHtml(formatDate(booking.starts_at))}</strong><p>${escapeHtml(booking.evaluation || 'Belum ada catatan evaluasi.')}</p></article>`).join('');
    }

    document.querySelectorAll('[data-dashboard-tab]').forEach((tab) => {
        tab.addEventListener('click', () => {
            document.querySelectorAll('[data-dashboard-tab]').forEach((item) => item.classList.remove('is-active'));
            document.querySelectorAll('[data-dashboard-panel]').forEach((panel) => panel.classList.remove('is-active'));
            tab.classList.add('is-active');
            document.querySelector(`[data-dashboard-panel="${tab.dataset.dashboardTab}"]`).classList.add('is-active');
        });
    });

    const profileForm = document.querySelector('[data-dashboard-profile-form]');
    profileForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(profileForm);
        try {
            const result = await postJson('/api/connect/profile', {
                method:data.get('method'), expertise:data.get('expertise'),
                modes:data.getAll('modes'), fee:Number(data.get('fee')), duration:Number(data.get('duration'))
            });
            showToast(result.message);
        } catch (error) {
            showToast(error.message,'error');
        }
    });

    const availabilityForm = document.querySelector('[data-dashboard-availability]');
    availabilityForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const localStart = new Date(availabilityForm.elements.starts_at.value);
        if (Number.isNaN(localStart.getTime())) {
            showToast('Pilih tanggal dan waktu yang valid.','error');
            return;
        }
        if (!profile) {
            showToast('Simpan profil pengajar sebelum menambahkan jadwal.','error');
            return;
        }
        const end = new Date(localStart.getTime() + Number(profile.duration) * 60000);
        try {
            const result = await postJson('/api/connect/availability', {
                starts_at: localStart.toISOString(),
                ends_at: end.toISOString()
            });
            showToast(result.message);
            availabilityForm.reset();
            const me = await requestJson('/api/connect/me');
            slots = me.slots || [];
            await loadBookings();
        } catch (error) {
            showToast(error.message,'error');
        }
    });

    document.querySelector('[data-request-list]').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-teacher-action]');
        if (!button) return;
        const action = button.dataset.teacherAction;
        const bookingId = Number(button.dataset.bookingId);
        if (action === 'complete') {
            evaluatingId = bookingId;
            dialog.showModal();
            dialog.querySelector('textarea').focus();
            return;
        }
        if (action === 'cancel' && !window.confirm('Batalkan sesi ini? Jadwal mendatang akan dibuka kembali untuk siswa.')) return;
        button.disabled = true;
        try {
            const result = await postJson(`/api/connect/bookings/${bookingId}/status`, {action});
            showToast(result.message);
            await loadBookings();
        } catch (error) {
            showToast(error.message,'error');
            button.disabled = false;
        }
    });

    document.querySelector('[data-evaluation-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!evaluatingId) return;
        const form = event.currentTarget;
        const evaluation = form.elements.evaluation.value.trim();
        try {
            const result = await postJson(`/api/connect/bookings/${evaluatingId}/status`, {
                action:'complete',
                evaluation
            });
            dialog.close();
            form.reset();
            evaluatingId = null;
            showToast(result.message);
            await loadBookings();
        } catch (error) {
            showToast(error.message,'error');
        }
    });

    loadDashboard().catch((error) => {
        showToast(error.message,'error');
        document.querySelector('[data-request-list]').innerHTML =
            '<div class="dashboard-empty">Panel pengajar tidak dapat dimuat. Pastikan akun Ustad aktif.</div>';
    });
})();
