(function () {
    'use strict';
    const root = document.querySelector('.dashboard-shell');
    if (!root) return;
    if (root.dataset.adminPreview === 'true') {
        document.querySelectorAll('[data-dashboard-tab]').forEach((tab) => {
            tab.addEventListener('click', () => {
                document.querySelectorAll('[data-dashboard-tab]').forEach((item) => item.classList.remove('is-active'));
                document.querySelectorAll('[data-dashboard-panel]').forEach((panel) => panel.classList.remove('is-active'));
                tab.classList.add('is-active');
                document.querySelector(`[data-dashboard-panel="${tab.dataset.dashboardTab}"]`).classList.add('is-active');
            });
        });
        return;
    }
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
        await loadFamdi();
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

    async function loadFamdi() {
        const [dashboard, studentsPayload, attendancePayload, assignmentsPayload, classesPayload, reportsPayload, messagesPayload] =
            await Promise.all([
                requestJson('/api/famdi/dashboard'),
                requestJson('/api/famdi/students'),
                requestJson('/api/famdi/attendance'),
                requestJson('/api/famdi/assignments'),
                requestJson('/api/famdi/classes'),
                requestJson('/api/famdi/reports'),
                requestJson('/api/famdi/messages')
            ]);
        document.querySelector('[data-famdi-students]').textContent = dashboard.students;
        document.querySelector('[data-famdi-assignment-review]').textContent = dashboard.assignments_to_review;
        document.querySelector('[data-famdi-submissions]').textContent = dashboard.pending_submissions;
        document.querySelector('[data-famdi-attendance]').textContent = dashboard.today_attendance;

        const students = studentsPayload.students || [];
        const studentOptions = students.map((student) =>
            `<option value="${student.id}">${escapeHtml(student.name)}</option>`
        ).join('');
        ['[data-attendance-student]','[data-report-student]','[data-message-student]'].forEach((selector) => {
            const select = document.querySelector(selector);
            if (select) select.innerHTML = '<option value="">Pilih murid</option>' + studentOptions;
        });
        const renderStudents = () => {
            const query = document.querySelector('[data-student-search]').value.trim().toLowerCase();
            const status = document.querySelector('[data-student-status]').value;
            const filtered = students.filter((student) =>
                (!status || (status === 'active' ? student.active === 1 : student.active === 0)) &&
                (!query || `${student.name} ${student.email}`.toLowerCase().includes(query))
            );
            const list = document.querySelector('[data-student-list]');
            list.innerHTML = filtered.length ? filtered.map((student) => `
                <article class="dashboard-request">
                    <div class="dashboard-request-header"><h3>${escapeHtml(student.name)}</h3><span class="status-pill">${student.active === 1 ? 'Aktif' : 'Tidak aktif'}</span></div>
                    <div class="dashboard-request-meta"><span>Setoran: ${student.submissions}</span><span>Nilai terbaru: ${student.latest_score == null ? '-' : student.latest_score}</span><span>Hadir: ${student.attendance_present}</span></div>
                    <p>${escapeHtml(student.target || 'Target pembelajaran belum ditetapkan.')}</p>
                </article>
            `).join('') : '<div class="dashboard-empty">Tidak ada murid sesuai pencarian.</div>';
        };
        renderStudents();
        document.querySelector('[data-student-search]').addEventListener('input', renderStudents);
        document.querySelector('[data-student-status]').addEventListener('change', renderStudents);

        const attendanceList = document.querySelector('[data-attendance-list]');
        attendanceList.innerHTML = (attendancePayload.attendance || []).slice(0,30).map((row) =>
            `<article class="schedule-card"><strong>${escapeHtml(row.student_name)} · ${escapeHtml(row.attendance_date)}</strong>${escapeHtml(row.status)}</article>`
        ).join('') || '<div class="dashboard-empty">Belum ada riwayat kehadiran.</div>';

        const assignmentsList = document.querySelector('[data-assignment-list]');
        assignmentsList.innerHTML = (assignmentsPayload.assignments || []).map((assignment) => `
            <article class="dashboard-request">
                <div class="dashboard-request-header"><h3>${escapeHtml(assignment.title)}</h3><span class="status-pill">${escapeHtml(assignment.due_at || 'Tanpa batas')}</span></div>
                <p>${escapeHtml(assignment.material || 'Tidak ada materi tambahan.')}</p>
                ${(assignment.targets || []).map((target) => `
                    <div class="famdi-review-row"><strong>${escapeHtml(target.student_name)}</strong>
                    <span>${escapeHtml(target.status)} ${target.score == null ? '' : '· Nilai '+target.score}</span>
                    ${target.status === 'submitted' ? `<button class="button button-compact" data-assignment-review="${assignment.id}" data-assignment-student="${target.student_id}" type="button">Nilai tugas</button>` : ''}
                    </div>
                `).join('')}
            </article>
        `).join('') || '<div class="dashboard-empty">Belum ada tugas.</div>';

        const classList = document.querySelector('[data-class-list]');
        classList.innerHTML = (classesPayload.classes || []).map((item) => `
            <article class="schedule-card"><strong>${escapeHtml(item.name)}</strong>
            <p>${escapeHtml(item.schedule || 'Jadwal belum ditetapkan.')}</p>
            <p>${escapeHtml(item.announcement || 'Belum ada pengumuman.')}</p>
            <small>${item.members.length} anggota</small></article>
        `).join('') || '<div class="dashboard-empty">Belum ada kelas.</div>';

        const reportList = document.querySelector('[data-report-list]');
        reportList.innerHTML = (reportsPayload.reports || []).map((report) => `
            <article class="schedule-card"><strong>${escapeHtml(report.student_name)} · ${escapeHtml(report.report_type)}</strong>
            <p>${escapeHtml(report.period_start)} s/d ${escapeHtml(report.period_end)}</p>
            <a class="button button-small" href="/api/famdi/reports/${report.id}/print" target="_blank">Cetak / PDF</a></article>
        `).join('') || '<div class="dashboard-empty">Belum ada laporan.</div>';

        const messageList = document.querySelector('[data-message-list]');
        messageList.innerHTML = (messagesPayload.messages || []).map((message) =>
            `<article class="schedule-card"><strong>${escapeHtml(message.sender_name)}</strong><p>${escapeHtml(message.body)}</p><small>${escapeHtml(message.created_at)}</small></article>`
        ).join('') || '<div class="dashboard-empty">Belum ada riwayat komunikasi.</div>';
    }

    const attendanceForm = document.querySelector('[data-attendance-form]');
    attendanceForm.elements.attendance_date.value = new Date().toISOString().slice(0,10);
    attendanceForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            const data = new FormData(attendanceForm);
            await postJson('/api/famdi/attendance', {
                student_id: data.get('student_id'),
                attendance_date: data.get('attendance_date'),
                status: data.get('status'),
                note: data.get('note')
            });
            showToast('Kehadiran berhasil disimpan.');
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

    document.querySelector('[data-assignment-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await postJson('/api/famdi/assignments', {
                title: data.get('title'),
                due_at: data.get('due_at'),
                material: data.get('material'),
                target: data.get('target')
            });
            showToast('Tugas berhasil dibuat dan dikirim.');
            form.reset();
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

    document.querySelector('[data-class-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await postJson('/api/famdi/classes', {
                name: data.get('name'),
                schedule: data.get('schedule'),
                material: data.get('material'),
                announcement: data.get('announcement')
            });
            showToast('Kelas berhasil dibuat.');
            form.reset();
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

    const reportForm = document.querySelector('[data-report-form]');
    reportForm.elements.report_type.addEventListener('change', () => {
        const period = reportForm.querySelector('.famdi-report-period');
        period.hidden = reportForm.elements.report_type.value !== 'individual';
    });
    reportForm.addEventListener('submit', async (event) => {
        event.preventDefault();
        const data = new FormData(reportForm);
        try {
            await postJson('/api/famdi/reports', {
                student_id: data.get('student_id'),
                report_type: data.get('report_type'),
                period_start: data.get('period_start'),
                period_end: data.get('period_end'),
                strengths: data.get('strengths'),
                weaknesses: data.get('weaknesses'),
                recommendation: data.get('recommendation'),
                note: data.get('note')
            });
            showToast('Laporan perkembangan berhasil dibuat.');
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

    document.querySelector('[data-message-form]').addEventListener('submit', async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const data = new FormData(form);
        try {
            await postJson('/api/famdi/messages', {
                recipient_id: data.get('recipient_id'),
                body: data.get('body')
            });
            showToast('Pesan berhasil dikirim.');
            form.reset();
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

    document.querySelector('[data-assignment-list]').addEventListener('click', async (event) => {
        const button = event.target.closest('[data-assignment-review]');
        if (!button) return;
        const scoreText = window.prompt('Masukkan nilai tugas 0–100:', '80');
        if (scoreText === null) return;
        const score = Number(scoreText);
        if (!Number.isInteger(score) || score < 0 || score > 100) {
            showToast('Nilai tugas harus berupa angka 0–100.','error');
            return;
        }
        const comment = window.prompt('Komentar penilaian tugas:', '') || '';
        try {
            await postJson(`/api/famdi/assignments/${button.dataset.assignmentReview}/review`, {
                student_id: button.dataset.assignmentStudent,
                status: 'completed',
                score,
                comment
            });
            showToast('Penilaian tugas berhasil disimpan.');
            await loadFamdi();
        } catch (error) { showToast(error.message,'error'); }
    });

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
                <article class="dashboard-request" data-tahfidz-submission="${item.id}" data-student-id="${item.student_id}">
                    <div class="dashboard-request-header"><h3>${escapeHtml(item.student_name)}</h3><span class="status-pill status-requested">Menunggu tinjauan</span></div>
                    <div class="dashboard-request-meta"><span>${escapeHtml(item.target_title)}</span><span>${escapeHtml(item.target_detail)}</span></div>
                    <audio controls preload="metadata" src="/api/tahfidz/submissions/${item.id}/audio"></audio>
                    <div class="famdi-score-grid">
                        <label>Makharijul huruf<input name="makharij" type="number" min="0" max="100" value="80"></label>
                        <label>Sifat huruf<input name="sifat" type="number" min="0" max="100" value="80"></label>
                        <label>Tajwid<input name="tajwid" type="number" min="0" max="100" value="80"></label>
                        <label>Kelancaran<input name="kelancaran" type="number" min="0" max="100" value="80"></label>
                        <label>Ketepatan hafalan<input name="hafalan" type="number" min="0" max="100" value="80"></label>
                    </div>
                    <label>Catatan penilaian
                        <textarea name="review_note" minlength="3" maxlength="1000" rows="3" required></textarea>
                    </label>
                    <label>Rekomendasi latihan<textarea name="recommendation" maxlength="1000" rows="2"></textarea></label>
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
            let response;
            if (button.dataset.tahfidzReview === 'approved') {
                const score = (name) => Number(card.querySelector(`[name="${name}"]`).value);
                response = await postJson('/api/famdi/evaluations', {
                    submission_id: Number(button.dataset.submissionId),
                    student_id: Number(card.dataset.studentId),
                    makharij: score('makharij'),
                    sifat: score('sifat'),
                    tajwid: score('tajwid'),
                    kelancaran: score('kelancaran'),
                    hafalan: score('hafalan'),
                    comment: note,
                    recommendation: card.querySelector('[name="recommendation"]').value.trim()
                });
            } else {
                response = await requestJson(
                    `/api/tahfidz/submissions/${button.dataset.submissionId}/review`,
                    {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': csrfToken },
                        body: JSON.stringify({ status: 'needs_revision', review_note: note })
                    }
                );
            }
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
