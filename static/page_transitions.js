(function () {
    'use strict';

    const preferenceKey = 'ustadOnline.quranBattle.preferences.v1';
    const transitionDuration = 320;
    const tabTransitions = {
        '/': { key: 'home', emblem: 'ت', label: 'BERANDA · RUANG BELAJAR' },
        '/baca': { key: 'quran', emblem: 'القرآن', label: 'MEMBUKA AL-QUR\'AN' },
        '/baca-quran': { key: 'quran', emblem: 'القرآن', label: 'MEMBUKA AL-QUR\'AN' },
        '/tilawah': { key: 'academy', emblem: 'أ', label: 'AKADEMI TILAWAH' },
        '/akademi': { key: 'academy', emblem: 'أ', label: 'AKADEMI TILAWAH' },
        '/ai-tahsin': { key: 'academy', emblem: 'ا', label: 'LATIHAN PELAFALAN · AKADEMI' },
        '/tahsin': { key: 'academy', emblem: 'أ', label: 'AKADEMI TILAWAH' },
        '/ustad-connect': { key: 'connect', emblem: 'س', label: 'USTAD CONNECT' },
        '/connect': { key: 'connect', emblem: 'س', label: 'USTAD CONNECT' },
        '/ustad-dashboard': { key: 'connect', emblem: 'س', label: 'PANEL USTAD' },
        '/tahfidz': { key: 'tahfidz', emblem: 'ح', label: 'TAHFIDZ & MURAJAAH' },
        '/dzikir-doa': { key: 'prayer', emblem: 'ذ', label: 'DZIKIR & DOA' },
        '/quran-battle': { key: 'battle', emblem: 'VS', label: 'QURAN BATTLE' },
        '/battle': { key: 'battle', emblem: 'VS', label: 'QURAN BATTLE' },
        '/komunitas': { key: 'community', emblem: 'م', label: 'KOMUNITAS' },
        '/fitur': { key: 'feature', emblem: '⋯', label: 'FITUR TAMBAHAN' },
        '/fitur-tambahan': { key: 'feature', emblem: '⋯', label: 'FITUR TAMBAHAN' },
        '/pengaturan': { key: 'feature', emblem: '⋯', label: 'PENGATURAN' },
        '/pusat-bantuan': { key: 'feature', emblem: '؟', label: 'PUSAT BANTUAN' }
    };
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
    overlay.innerHTML = '<span class="page-transition-door page-transition-door-left"></span><span class="page-transition-door page-transition-door-right"></span><span class="page-transition-emblem">ت</span><span class="page-transition-label">ILMU · ADAB · AMAL</span>';
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
        const tabTransition = tabTransitions[destination.pathname] || { key: destinationIsHome ? 'home' : 'feature', emblem: 'ت', label: 'MEMBUKA RUANG BELAJAR' };
        const overlayLabel = overlay.querySelector('.page-transition-label');
        overlay.querySelector('.page-transition-emblem').textContent = tabTransition.emblem;
        overlayLabel.textContent = destinationIsHome ? 'KEMBALI KE BERANDA · ILMU · ADAB · AMAL' : tabTransition.label;
        document.body.dataset.transitionDirection = tabTransition.key;

        event.preventDefault();
        leaving = true;
        document.body.classList.add('page-transition-leaving');
        const navigationDelay = tabTransition.key === 'quran'
            && window.UstadPageTransition
            && typeof window.UstadPageTransition.openMushaf === 'function'
            ? window.UstadPageTransition.openMushaf()
            : transitionDuration;
        window.setTimeout(() => {
            window.location.assign(destination.href);
        }, typeof navigationDelay === 'number' ? navigationDelay : transitionDuration);
    }, true);

    const surahStartPages = [
        1,2,2,77,106,128,151,177,187,208,221,235,249,255,262,267,282,293,305,312,322,332,342,350,359,367,377,385,396,404,
        411,415,418,428,434,440,446,453,458,467,477,483,489,496,497,502,507,511,515,518,520,523,526,528,531,534,537,542,545,549,
        551,553,554,556,558,560,562,564,566,568,570,572,575,577,578,580,582,583,585,586,587,587,589,590,591,591,592,593,594,595,595,
        596,596,597,597,598,598,599,599,600,600,601,601,602,602,602,603,603,603,604,604,604,604,604
    ];

    window.UstadPageTransition = {
        openMushaf() {
            if (!motionIsEnabled()) return transitionDuration;
            document.body.dataset.transitionDirection = 'quran';
            document.body.classList.add('page-transition-quran-leaving');
            overlay.classList.add('is-quran-opening');
            overlay.querySelector('.page-transition-emblem').textContent = 'القرآن';
            overlay.querySelector('.page-transition-label').textContent = 'MEMBUKA MUSHAF';

            const scene = document.createElement('div');
            scene.className = 'quran-book-opening';
            scene.setAttribute('aria-hidden', 'true');
            scene.innerHTML = `
                <div class="quran-book-cover"><span>القرآن الكريم</span></div>
                <div class="quran-book-left"><i></i><i></i><i></i></div>
                <div class="quran-book-right"><i></i><i></i><i></i></div>
                <div class="quran-book-spine"></div>`;
            overlay.append(scene);
            window.setTimeout(() => {
                overlay.classList.remove('is-quran-opening');
                scene.remove();
            }, 620);
            return 620;
        },
        playQuranSurah(fromSurah, toSurah) {
            if (!motionIsEnabled() || !Number.isInteger(toSurah)) return Promise.resolve();
            const fromPage = Number.isInteger(fromSurah) ? surahStartPages[fromSurah - 1] : surahStartPages[toSurah - 1];
            const toPage = surahStartPages[toSurah - 1];
            document.body.dataset.transitionDirection = 'quran';
            document.body.classList.add('page-transition-quran-leaving');
            overlay.classList.add('is-quran-flipping');
            overlay.querySelector('.page-transition-emblem').textContent = 'القرآن';
            overlay.querySelector('.page-transition-label').textContent =
                `HALAMAN ${fromPage} → ${toPage} · SURAH ${toSurah}`;

            const scene = document.createElement('div');
            scene.className = 'quran-page-flip';
            scene.setAttribute('aria-hidden', 'true');
            scene.innerHTML = `
                <div class="quran-page-base">
                    <span class="quran-page-number quran-page-from">${fromPage}</span>
                    <span class="quran-page-rule"></span>
                    <span class="quran-page-number quran-page-to">${toPage}</span>
                </div>
                <div class="quran-turning-page"></div>
                <div class="quran-page-mid">${Math.min(fromPage, toPage)}</div>
                <div class="quran-page-progress"><span></span></div>`;
            overlay.append(scene);

            const distance = Math.abs(toPage - fromPage);
            const flipDuration = distance > 1 ? 920 : 620;
            document.body.classList.add('page-transition-leaving');
            return new Promise((resolve) => {
                const started = performance.now();
                const pageCounter = scene.querySelector('.quran-page-mid');
                const progress = scene.querySelector('.quran-page-progress span');
                const tick = (now) => {
                    const amount = Math.min(1, (now - started) / flipDuration);
                    const currentPage = Math.round(fromPage + (toPage - fromPage) * amount);
                    pageCounter.textContent = String(currentPage);
                    progress.style.transform = `scaleX(${amount})`;
                    if (amount < 1) window.requestAnimationFrame(tick);
                };
                window.requestAnimationFrame(tick);
                window.setTimeout(() => {
                    document.body.classList.remove('page-transition-leaving', 'page-transition-quran-leaving');
                    overlay.classList.remove('is-quran-flipping');
                    scene.remove();
                    resolve();
                }, flipDuration);
            });
        }
    };
}());
