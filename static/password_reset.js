(() => {
    const form = document.getElementById('reset-password-form');
    const tokenInput = document.getElementById('reset-token');
    const csrfInput = document.getElementById('reset-csrf-token');
    const feedback = document.getElementById('reset-feedback');
    const actions = document.getElementById('reset-actions');
    if (!form || !tokenInput || !csrfInput || !feedback || !actions) return;

    if (form.dataset.resetState !== 'check') return;
    const initialToken = window.location.hash.slice(1);
    if (initialToken) {
        tokenInput.value = initialToken;
        window.history.replaceState(null, '', `${window.location.pathname}${window.location.search}`);
    }

    if (!form.hidden) return;
    if (!initialToken) {
        feedback.textContent = 'Tautan reset tidak valid. Minta tautan baru untuk melanjutkan.';
        actions.hidden = false;
        return;
    }

    fetch('/auth/reset-password/check', {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
            'Content-Type': 'application/json',
            'X-CSRF-Token': csrfInput.value,
        },
        body: JSON.stringify({ token: initialToken }),
    }).then((response) => {
        if (!response.ok) throw new Error('check-failed');
        return response.json();
    }).then((result) => {
        if (result.state === 'valid') {
            form.hidden = false;
            actions.hidden = true;
            feedback.textContent = '';
        } else if (result.state === 'expired') {
            feedback.textContent = 'Tautan reset sudah kedaluwarsa. Minta tautan baru untuk melanjutkan.';
            actions.hidden = false;
        } else {
            feedback.textContent = 'Tautan reset tidak valid atau sudah pernah digunakan. Minta tautan baru untuk melanjutkan.';
            actions.hidden = false;
        }
    }).catch(() => {
        feedback.textContent = 'Tautan belum dapat diperiksa. Muat ulang halaman atau minta tautan baru.';
        actions.hidden = false;
    });
})();
