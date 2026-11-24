(function () {
    'use strict';

    const root = document.querySelector('[data-connect-moderation]');
    if (!root) return;
    const token = root.querySelector('[data-admin-csrf]').value;
    const reviewList = root.querySelector('[data-pending-reviews]');
    const reportList = root.querySelector('[data-pending-reports]');
    const error = root.querySelector('[data-moderation-error]');

    function escapeHtml(value) {
        return String(value == null ? '' : value).replace(/[&<>"']/g, (character) => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        })[character]);
    }

    async function fetchJson(url, options) {
        const response = await fetch(url, Object.assign({ credentials: 'same-origin' }, options || {}));
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error || 'Moderasi tidak dapat dimuat.');
        return payload;
    }

    function reviewCard(review) {
        return `<article class="application"><p class="eyebrow">ULASAN MENUNGGU · ${escapeHtml(review.created_at)}</p>
            <h2>${escapeHtml(review.teacher_name)} · ${review.rating}/5</h2>
            <p>Pengirim: ${escapeHtml(review.student_name)}</p><p>${escapeHtml(review.comment || 'Tanpa komentar')}</p>
            <div class="decision"><button type="button" data-moderate="reviews" data-id="${review.id}" data-decision="approve">Setujui & tampilkan</button>
                <button type="button" class="reject" data-moderate="reviews" data-id="${review.id}" data-decision="reject">Tolak ulasan</button></div></article>`;
    }

    function reportCard(report) {
        return `<article class="application"><p class="eyebrow">LAPORAN PRIVAT · ${escapeHtml(report.created_at)}</p>
            <h2>${escapeHtml(report.reason)}${report.booking_id ? ` · Sesi #${report.booking_id}` : ''}</h2>
            <p>Pelapor: ${escapeHtml(report.reporter_name)}</p><p>${escapeHtml(report.details || 'Tidak ada detail tambahan.')}</p>
            <div class="decision"><button type="button" data-moderate="reports" data-id="${report.id}" data-decision="approve">Tandai sudah ditinjau</button>
                <button type="button" class="reject" data-moderate="reports" data-id="${report.id}" data-decision="reject">Tutup sebagai tidak perlu tindakan</button></div></article>`;
    }

    async function loadQueue() {
        const queue = await fetchJson('/api/connect/admin/moderation');
        reviewList.innerHTML = queue.reviews.length
            ? queue.reviews.map(reviewCard).join('')
            : '<div class="empty">Tidak ada ulasan yang menunggu moderasi.</div>';
        reportList.innerHTML = `<h2 style="margin-top:22px">Laporan keamanan</h2>${queue.reports.length
            ? queue.reports.map(reportCard).join('')
            : '<div class="empty">Tidak ada laporan yang menunggu peninjauan.</div>'}`;
    }

    root.addEventListener('click', async (event) => {
        const button = event.target.closest('[data-moderate]');
        if (!button) return;
        button.disabled = true;
        error.hidden = true;
        try {
            await fetchJson(`/api/connect/admin/moderation/${button.dataset.moderate}/${button.dataset.id}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'X-CSRF-Token': token },
                body: JSON.stringify({ decision: button.dataset.decision })
            });
            await loadQueue();
        } catch (failure) {
            error.textContent = failure.message;
            error.hidden = false;
            button.disabled = false;
        }
    });

    loadQueue().catch((failure) => {
        error.textContent = failure.message;
        error.hidden = false;
        reviewList.textContent = 'Antrean moderasi tidak dapat dimuat.';
        reportList.textContent = '';
    });
})();
