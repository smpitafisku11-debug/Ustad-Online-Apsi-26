(function () {
    'use strict';

    const teacherList = document.querySelector('[data-teacher-list]');
    if (!teacherList) return;

    const teacherDialog = document.querySelector('[data-teacher-dialog]');
    const reportDialog = document.querySelector('[data-report-dialog]');
    const toast = document.querySelector('[data-connect-toast]');
    const searchForm = document.querySelector('[data-search-form]');
    const profileForm = document.querySelector('[data-teacher-profile-form]');
    const bookingForm = document.querySelector('[data-booking-form]');
    const availabilityForm = document.querySelector('[data-availability-form]');
    const bookingList = document.querySelector('[data-booking-list]');
    let csrfToken = '';
    let currentUser = null;
    let selectedTeacher = null;
    let reportBookingId = null;
    let profile = null;
    let toastTimer = 0;

    const fields = {
        tahsin: 'Tahsin',
        tajwid: 'Tajwid',
        tahfidz: 'Tahfidz',
        tilawah: 'Tilawah',
        dasar: 'Dasar Al-Qur’an'
    };
    const modes = { audio: 'Audio', video: 'Video', chat: 'Chat' };
    const statuses = {
        requested: 'Menunggu konfirmasi',
        confirmed: 'Dikonfirmasi',
        completed: 'Selesai',
        cancelled: 'Dibatalkan',
        declined: 'Tidak diterima'
    };

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    function showToast(message, kind) {
        window.clearTimeout(toastTimer);
        toast.textContent = message;
        toast.dataset.kind = kind || 'success';
        toast.classList.add('is-visible');
        toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 4500);
    }

    async function requestJson(path, options) {
        const requestOptions = Object.assign({ credentials: 'same-origin' }, options || {});
        requestOptions.headers = Object.assign({}, requestOptions.headers || {});
        if (requestOptions.body) {
            requestOptions.headers['Content-Type'] = 'application/json';
            requestOptions.headers['X-CSRF-Token'] = csrfToken;
        }
        const response = await fetch(path, requestOptions);
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Permintaan tidak dapat diproses.');
        return payload;
    }

    function formatDate(value) {
        const date = new Date(value);
        return new Intl.DateTimeFormat('id-ID', {
            weekday: 'short', day: 'numeric', month: 'short', year: 'numeric',
            hour: '2-digit', minute: '2-digit', timeZoneName: 'short'
        }).format(date);
    }

    function formatMoney(value) {
        return value === 0 ? 'Gratis' : `Rp${new Intl.NumberFormat('id-ID').format(value)}`;
    }

    function teacherCard(teacher) {
        const initial = teacher.name.trim().charAt(0).toUpperCase() || 'U';
        const schedule = teacher.slots.length ? `${teacher.slots.length} jadwal tersedia` : 'Jadwal belum ditambahkan';
        const modeText = teacher.modes.map((mode) => modes[mode]).filter(Boolean).join(' · ');
        return `<article class="teacher-card">
            <div class="teacher-card-top"><span class="teacher-avatar" aria-hidden="true">${escapeHtml(initial)}</span>
                <div><h3>${escapeHtml(teacher.name)}</h3><span class="verified-badge">✓ Akun disetujui admin</span></div></div>
            <span class="field-tag">${escapeHtml(fields[teacher.method] || teacher.method)}</span>
            <p class="teacher-expertise">${escapeHtml(teacher.expertise)}</p>
            <div class="teacher-meta"><span>◷ ${escapeHtml(schedule)} · ${escapeHtml(String(teacher.duration))} menit</span>
                <span>◉ ${escapeHtml(modeText || 'Metode belum dipilih')}</span>
                ${teacher.reviews.length ? `<span>★ ${escapeHtml(teacher.reviews[0].rating)} · ${teacher.reviews.length} ulasan dimoderasi</span>` : '<span>Belum ada ulasan dimoderasi</span>'}</div>
            <div class="teacher-price"><strong>${escapeHtml(formatMoney(teacher.fee))}</strong> / sesi</div>
            <button type="button" class="button" data-view-teacher="${teacher.id}">Lihat profil & jadwal</button>
        </article>`;
    }

    async function searchTeachers(event) {
        if (event) event.preventDefault();
        const params = new URLSearchParams();
        const formData = new FormData(searchForm);
        for (const [key, value] of formData.entries()) {
            if (value) params.set(key, value);
        }
        const response = await requestJson(`/api/connect/teachers?${params.toString()}`);
        const teachers = response.teachers;
        teacherList.innerHTML = teachers.map(teacherCard).join('');
        document.querySelector('[data-result-count]').textContent = `${teachers.length} pengajar ditemukan`;
        document.querySelector('[data-empty-state]').hidden = teachers.length !== 0;
        if (currentUser && currentUser.role === 'student') {
            teacherList.querySelectorAll('[data-view-teacher]').forEach((button) => {
                button.setAttribute('aria-label', `Lihat profil pengajar ${teachers.find((teacher) => teacher.id === Number(button.dataset.viewTeacher)).name}`);
            });
        }
        return teachers;
    }

    function renderTeacherDetail(teacher) {
        selectedTeacher = teacher;
        const reviews = teacher.reviews.length
            ? teacher.reviews.map((review) => `<blockquote class="review-quote">★ ${review.rating} ${review.comment ? `· ${escapeHtml(review.comment)}` : ''}</blockquote>`).join('')
            : '<p>Belum ada ulasan yang disetujui moderator.</p>';
        document.querySelector('[data-teacher-detail]').innerHTML = `
            <div class="teacher-detail">
                <span class="verified-badge">✓ Akun disetujui admin</span>
                <h2 id="teacher-dialog-title">${escapeHtml(teacher.name)}</h2>
                <p>${escapeHtml(fields[teacher.method] || teacher.method)} · ${escapeHtml(teacher.duration)} menit per sesi · ${escapeHtml(formatMoney(teacher.fee))}</p>
                <div class="teacher-meta"><span><strong>Keahlian:</strong> ${escapeHtml(teacher.expertise)}</span>
                    <span><strong>Keahlian & pengalaman relevan:</strong> ${escapeHtml(teacher.experience || 'Belum dicantumkan')}</span>
                    <span><strong>Metode:</strong> ${escapeHtml(teacher.modes.map((mode) => modes[mode]).filter(Boolean).join(', '))}</span>
                </div>
                <h3>Ulasan siswa (dimoderasi)</h3>${reviews}
            </div>`;
        const slotSelect = bookingForm.elements.slot_id;
        slotSelect.innerHTML = teacher.slots.map((slot) =>
            `<option value="${slot.id}">${escapeHtml(formatDate(slot.starts_at))}</option>`
        ).join('');
        const modeSelect = bookingForm.elements.mode;
        modeSelect.innerHTML = teacher.modes.map((mode) =>
            `<option value="${escapeHtml(mode)}">${escapeHtml(modes[mode] || mode)}</option>`
        ).join('');
        bookingForm.hidden = !currentUser || currentUser.role !== 'student' || !teacher.slots.length;
        if (!currentUser) {
            document.querySelector('[data-teacher-detail]').insertAdjacentHTML(
                'beforeend',
                '<p><a class="button button-primary" href="/">Masuk atau daftar sebagai siswa untuk memesan</a></p>'
            );
        } else if (currentUser.role !== 'student') {
            document.querySelector('[data-teacher-detail]').insertAdjacentHTML(
                'beforeend',
                '<p>Pemesanan sesi hanya tersedia untuk akun Siswa.</p>'
            );
        } else if (!teacher.slots.length) {
            document.querySelector('[data-teacher-detail]').insertAdjacentHTML(
                'beforeend',
                '<p>Belum ada jadwal tersedia saat ini.</p>'
            );
        }
        teacherDialog.showModal();
    }

    function bookingCard(booking) {
        const isTeacher = currentUser.role === 'teacher';
        const counterpart = isTeacher ? booking.student_name : booking.teacher_name;
        const actions = [];
        if (isTeacher && booking.status === 'requested') {
            actions.push(`<button class="button button-primary button-compact" data-booking-action="confirm" data-booking-id="${booking.id}">Konfirmasi</button>`);
            actions.push(`<button class="button button-compact" data-booking-action="decline" data-booking-id="${booking.id}">Tolak & lepaskan jadwal</button>`);
        }
        if (isTeacher && booking.status === 'confirmed') {
            actions.push(`<button class="button button-primary button-compact" data-booking-action="complete" data-booking-id="${booking.id}">Selesaikan & beri evaluasi</button>`);
        }
        if ((isTeacher || currentUser.role === 'student') && ['requested', 'confirmed'].includes(booking.status)) {
            actions.push(`<button class="text-button" data-booking-action="cancel" data-booking-id="${booking.id}">Batalkan sesi</button>`);
        }
        if (booking.status === 'completed' && !isTeacher && !booking.review_status) {
            actions.push(`<form class="review-form" data-review-form="${booking.id}">
                <label>Ulasan untuk ${escapeHtml(counterpart)} (akan dimoderasi)
                    <select name="rating" required><option value="">Pilih bintang</option><option value="5">★★★★★ Sangat baik</option><option value="4">★★★★☆ Baik</option><option value="3">★★★☆☆ Cukup</option><option value="2">★★☆☆☆ Perlu perbaikan</option><option value="1">★☆☆☆☆ Buruk</option></select>
                </label><label>Catatan (opsional, maks. 500 karakter)<textarea name="comment" maxlength="500" rows="2"></textarea></label>
                <button class="button button-compact" type="submit">Kirim ulasan</button></form>`);
        }
        if (['requested', 'confirmed', 'completed'].includes(booking.status)) {
            actions.push(`<button class="text-button" data-report-booking="${booking.id}">Laporkan masalah</button>`);
        }
        const actionMarkup = actions.length ? `<div class="booking-actions">${actions.join('')}</div>` : '';
        const evaluation = booking.evaluation
            ? `<p class="booking-evaluation"><strong>Catatan belajar:</strong><br>${escapeHtml(booking.evaluation)}</p>`
            : '';
        return `<article class="booking-card">
            <div class="booking-card-header"><h3>${isTeacher ? 'Siswa' : 'Pengajar'}: ${escapeHtml(counterpart)}</h3>
                <span class="status-pill status-${escapeHtml(booking.status)}">${escapeHtml(statuses[booking.status] || booking.status)}</span></div>
            <div class="booking-details"><span>${escapeHtml(formatDate(booking.starts_at))}</span><span>${escapeHtml(modes[booking.mode] || 'Sesi Ustad Connect')}</span></div>
            ${evaluation}${actionMarkup}
        </article>`;
    }

    async function loadBookings() {
        if (!currentUser) return;
        const section = document.querySelector('[data-bookings-section]');
        section.hidden = false;
        const response = await requestJson('/api/connect/bookings');
        bookingList.innerHTML = response.bookings.length
            ? response.bookings.map(bookingCard).join('')
            : '<div class="empty-state"><h3>Belum ada sesi</h3><p>Sesi yang diajukan atau Anda ajar akan muncul di sini.</p></div>';
    }

    function fillProfileForm(savedProfile) {
        if (!profileForm || !savedProfile) return;
        profileForm.elements.method.value = savedProfile.method;
        profileForm.elements.expertise.value = savedProfile.expertise;
        profileForm.elements.fee.value = savedProfile.fee;
        profileForm.elements.duration.value = savedProfile.duration;
        profileForm.querySelectorAll('input[name="modes"]').forEach((input) => {
            input.checked = savedProfile.modes.includes(input.value);
        });
    }

    function renderSlots(slots) {
        const container = document.querySelector('[data-availability-list]');
        container.innerHTML = slots.length
            ? slots.map((slot) => `<span class="slot-chip" data-status="${escapeHtml(slot.status)}">${escapeHtml(formatDate(slot.starts_at))} · ${slot.status === 'available' ? 'Tersedia' : 'Dipesan'}</span>`).join('')
            : '<p class="form-hint">Belum ada jadwal mendatang. Tambahkan waktu yang tersedia untuk menerima permintaan sesi.</p>';
    }

    async function initialize() {
        const sessionResponse = await requestJson('/api/auth/session');
        csrfToken = sessionResponse.csrf_token || '';
        currentUser = sessionResponse.user || null;
        if (currentUser) {
            const current = await requestJson('/api/connect/me');
            document.querySelector('[data-connect-login]').textContent = currentUser.name;
            document.querySelector('[data-connect-login]').href = '/';
            if (currentUser.role === 'teacher') {
                if (current.teacher_verified) {
                    document.querySelector('[data-teacher-dashboard]').hidden = false;
                    profile = current.profile;
                    fillProfileForm(profile);
                    renderSlots(current.slots);
                } else {
                    document.querySelector('[data-teacher-unverified]').hidden = false;
                }
            }
            await loadBookings();
        }
        await searchTeachers();
    }

    searchForm.addEventListener('submit', (event) => {
        searchTeachers(event).catch((error) => showToast(error.message, 'error'));
    });

    teacherList.addEventListener('click', (event) => {
        const button = event.target.closest('[data-view-teacher]');
        if (!button) return;
        searchTeachers().then((teachers) => {
            const teacher = teachers.find((item) => item.id === Number(button.dataset.viewTeacher));
            if (teacher) renderTeacherDetail(teacher);
        }).catch((error) => showToast(error.message, 'error'));
    });

    bookingForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        if (!selectedTeacher) return;
        const data = new FormData(bookingForm);
        try {
            const response = await requestJson('/api/connect/bookings', {
                method: 'POST',
                body: JSON.stringify({
                    slot_id: Number(data.get('slot_id')),
                    mode: data.get('mode'),
                    guardian_acknowledged: data.get('guardian_acknowledged') === 'on'
                })
            });
            teacherDialog.close();
            showToast(response.message);
            await Promise.all([loadBookings(), searchTeachers()]);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    if (profileForm) {
        profileForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const data = new FormData(profileForm);
            const modesSelected = data.getAll('modes');
            try {
                const response = await requestJson('/api/connect/profile', {
                    method: 'POST',
                    body: JSON.stringify({
                        method: data.get('method'),
                        expertise: data.get('expertise'),
                        modes: modesSelected,
                        fee: Number(data.get('fee')),
                        duration: Number(data.get('duration'))
                    })
                });
                profile = {
                    method: data.get('method'),
                    expertise: data.get('expertise'),
                    modes: modesSelected,
                    fee: Number(data.get('fee')),
                    duration: Number(data.get('duration'))
                };
                showToast(response.message);
                await searchTeachers();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    if (availabilityForm) {
        availabilityForm.addEventListener('submit', async (event) => {
            event.preventDefault();
            const localStart = new Date(availabilityForm.elements.starts_at.value);
            if (Number.isNaN(localStart.getTime())) {
                showToast('Pilih tanggal dan waktu yang valid.', 'error');
                return;
            }
            const duration = Number(profileForm.elements.duration.value);
            const end = new Date(localStart.getTime() + duration * 60000);
            try {
                const response = await requestJson('/api/connect/availability', {
                    method: 'POST',
                    body: JSON.stringify({ starts_at: localStart.toISOString(), ends_at: end.toISOString() })
                });
                showToast(response.message);
                availabilityForm.reset();
                const current = await requestJson('/api/connect/me');
                renderSlots(current.slots);
                await searchTeachers();
            } catch (error) {
                showToast(error.message, 'error');
            }
        });
    }

    bookingList.addEventListener('click', async (event) => {
        const reportButton = event.target.closest('[data-report-booking]');
        if (reportButton) {
            reportBookingId = Number(reportButton.dataset.reportBooking);
            reportDialog.showModal();
            return;
        }
        const button = event.target.closest('[data-booking-action]');
        if (!button) return;
        const action = button.dataset.bookingAction;
        const bookingId = Number(button.dataset.bookingId);
        if (action === 'complete') {
            const form = document.createElement('form');
            form.className = 'review-form';
            form.dataset.completeForm = String(bookingId);
            form.innerHTML = '<label>Evaluasi belajar (10–1000 karakter)<textarea name="evaluation" minlength="10" maxlength="1000" required placeholder="Materi yang dipelajari dan latihan berikutnya"></textarea></label><button class="button button-primary button-compact" type="submit">Simpan evaluasi & tandai selesai</button>';
            button.closest('.booking-card').appendChild(form);
            button.disabled = true;
            form.querySelector('textarea').focus();
            return;
        }
        if (action === 'cancel' && !window.confirm('Batalkan sesi ini? Jadwal mendatang akan dibuka kembali.')) return;
        try {
            const response = await requestJson(`/api/connect/bookings/${bookingId}/status`, {
                method: 'POST', body: JSON.stringify({ action })
            });
            showToast(response.message);
            await Promise.all([loadBookings(), searchTeachers()]);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    bookingList.addEventListener('submit', async (event) => {
        const reviewForm = event.target.closest('[data-review-form]');
        const completeForm = event.target.closest('[data-complete-form]');
        if (!reviewForm && !completeForm) return;
        event.preventDefault();
        const data = new FormData(event.target);
        try {
            let response;
            if (reviewForm) {
                response = await requestJson('/api/connect/reviews', {
                    method: 'POST',
                    body: JSON.stringify({
                        booking_id: Number(reviewForm.dataset.reviewForm),
                        rating: Number(data.get('rating')),
                        comment: data.get('comment')
                    })
                });
            } else {
                response = await requestJson(`/api/connect/bookings/${completeForm.dataset.completeForm}/status`, {
                    method: 'POST',
                    body: JSON.stringify({ action: 'complete', evaluation: data.get('evaluation') })
                });
            }
            showToast(response.message);
            await loadBookings();
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    document.querySelector('[data-open-general-report]').addEventListener('click', () => {
        reportBookingId = null;
        reportDialog.showModal();
    });

    document.querySelector('[data-report-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(event.currentTarget);
        const payload = { reason: data.get('reason'), details: data.get('details') };
        if (reportBookingId !== null) payload.booking_id = reportBookingId;
        try {
            const response = await requestJson('/api/connect/reports', {
                method: 'POST', body: JSON.stringify(payload)
            });
            reportDialog.close();
            event.currentTarget.reset();
            showToast(response.message);
        } catch (error) {
            showToast(error.message, 'error');
        }
    });

    initialize().catch((error) => {
        showToast(error.message, 'error');
        document.querySelector('[data-result-count]').textContent = 'Pengajar belum dapat dimuat';
    });
})();
