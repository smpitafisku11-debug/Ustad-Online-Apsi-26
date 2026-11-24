(function () {
    'use strict';

    const preferenceKey = 'ustadOnline.quranBattle.preferences.v1';
    const transitionDuration = 440;
    const motionPreference = window.matchMedia('(prefers-reduced-motion: reduce)');
    let leaving = false;

    function motionIsEnabled() {
        if (motionPreference.matches) return false;
        try {
            const saved = JSON.parse(localStorage.getItem(preferenceKey));
            return !(saved && saved.animations === false);
        } catch (error) {
            console.error('Preferensi transisi halaman tidak dapat dibaca:', error);
            return true;
        }
    }

    document.body.dataset.pageMotion = motionIsEnabled() ? 'on' : 'off';
    if (motionPreference.matches) document.body.classList.add('page-transition-reduced');

    const overlay = document.createElement('div');
    overlay.className = 'page-transition-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML = '<span class="page-transition-emblem">ت</span><span class="page-transition-label">ILMU · ADAB · AMAL</span>';
    document.body.appendChild(overlay);
    document.body.classList.add('page-transition-ready');

    window.addEventListener('pageshow', () => {
        leaving = false;
        document.body.classList.remove('page-transition-leaving');
    });

    const handleMotionChange = (event) => {
        if (event.matches) {
            document.body.dataset.pageMotion = 'off';
            document.body.classList.add('page-transition-reduced');
        } else {
            document.body.classList.remove('page-transition-reduced');
            document.body.dataset.pageMotion = motionIsEnabled() ? 'on' : 'off';
        }
    };
    if (motionPreference.addEventListener) motionPreference.addEventListener('change', handleMotionChange);
    else if (motionPreference.addListener) motionPreference.addListener(handleMotionChange);

    document.addEventListener('click', (event) => {
        if (leaving || event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;

        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') ||
            (link.target && link.target !== '_self') ||
            link.hasAttribute('data-no-page-transition')) return;

        const destination = new URL(link.href, window.location.href);
        if (destination.origin !== window.location.origin) return;
        if (destination.pathname === window.location.pathname &&
            destination.search === window.location.search) return;
        if (!motionIsEnabled()) return;

        const destinationIsHome = destination.pathname === '/';
        const overlayLabel = overlay.querySelector('.page-transition-label');
        overlayLabel.textContent = destinationIsHome ? 'KEMBALI KE BERANDA' : 'MEMBUKA RUANG BELAJAR';
        document.body.dataset.transitionDirection = destinationIsHome ? 'home' : 'feature';

        event.preventDefault();
        leaving = true;
        document.body.classList.add('page-transition-leaving');
        window.setTimeout(() => {
            window.location.assign(destination.href);
        }, transitionDuration);
    }, true);
}());
