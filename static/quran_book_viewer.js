(function () {
    'use strict';

    const totalPages = 604;
    const apiBase = 'https://api.quran.com/api/v4';
    const reader = document.getElementById('quran-book-viewer');
    if (!reader) return;

    const spread = document.getElementById('quran-book-spread');
    const arabicVerses = document.getElementById('quran-arabic-verses');
    const translationVerses = document.getElementById('quran-translation-verses');
    const status = document.getElementById('quran-book-status');
    const pageIndicator = document.getElementById('reader-page-indicator');
    const pageInput = document.getElementById('reader-page-jump');
    const previousButton = document.getElementById('reader-page-previous');
    const nextButton = document.getElementById('reader-page-next');
    const surahSelect = document.getElementById('reader-surah-select');
    const juzSelect = document.getElementById('reader-juz-select');
    const bookmarkButton = document.getElementById('reader-bookmark');
    const themeButton = document.getElementById('reader-theme-toggle');
    const fontSizeSelect = document.getElementById('reader-font-size');
    const audioButton = document.getElementById('reader-audio-toggle');
    const audioPlayer = document.getElementById('reader-audio');
    const reciterSelect = document.getElementById('reciter-select');
    const arabicHeading = document.getElementById('quran-arabic-heading');
    const surahHeading = document.getElementById('quran-surah-heading');
    const surahSubheading = document.getElementById('quran-surah-subheading');
    const readerTitle = document.getElementById('reader-title');
    const readerMeta = document.getElementById('reader-meta');
    const cache = new Map();
    let surahs = [];
    let currentPage = 1;
    let bookmarkedPage = null;
    let currentSurahNumber = 1;
    let requestController = null;
    let requestVersion = 0;
    let pointerStart = null;
    let dragLayer = null;
    let dragDirection = 'next';
    let audioSurahNumber = 0;

    function storageGet(key) {
        return window.UstadOnlineStorage.getItem(key);
    }

    function storageSet(key, value) {
        try {
            window.UstadOnlineStorage.setItem(key, value);
            return true;
        } catch (error) {
            console.error('Preferensi mushaf tidak dapat disimpan:', error);
            setStatus('Perubahan aktif, tetapi tidak dapat disimpan di browser ini.', true);
            return false;
        }
    }

    function setStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    async function requestJson(path, signal) {
        const response = await fetch(`${apiBase}${path}`, signal ? { signal } : {});
        if (!response.ok) throw new Error(`Layanan Al-Qur'an merespons dengan status ${response.status}.`);
        return response.json();
    }

    function createVerseNumber(key) {
        const marker = document.createElement('span');
        marker.className = 'quran-book-verse-number';
        marker.setAttribute('aria-label', `Ayat ${key.split(':')[1]}`);
        marker.textContent = key.split(':')[1];
        return marker;
    }

    function createFlipLayer(direction) {
        const source = direction === 'next'
            ? document.getElementById('quran-arabic-page')
            : document.getElementById('quran-translation-page');
        const layer = document.createElement('div');
        layer.className = 'quran-book-flip-layer';
        layer.dataset.direction = direction;
        layer.innerHTML = source.innerHTML;
        layer.querySelectorAll('[id]').forEach((element) => element.removeAttribute('id'));
        layer.querySelectorAll('button, input, select').forEach((element) => element.remove());
        spread.append(layer);
        return layer;
    }

    function finishFlip(layer, direction, shouldFlip) {
        if (!layer) return;
        if (!shouldFlip) {
            layer.remove();
            spread.classList.remove('is-dragging', 'is-releasing');
            return;
        }
        layer.dataset.direction = direction;
        layer.classList.remove('quran-book-spread');
        if (layer.classList.contains('is-drag-layer')) {
            layer.style.setProperty('--drag-angle', direction === 'next' ? '-180deg' : '180deg');
            spread.classList.remove('is-dragging');
            spread.classList.add('is-releasing');
            window.setTimeout(() => {
                layer.remove();
                spread.classList.remove('is-dragging', 'is-releasing');
            }, 220);
            return;
        }
        layer.addEventListener('animationend', () => layer.remove(), { once: true });
    }

    function renderVerses(verses) {
        arabicVerses.replaceChildren();
        translationVerses.replaceChildren();
        verses.forEach((verse) => {
            const arabicItem = document.createElement('div');
            arabicItem.className = 'quran-book-verse quran-book-verse-arabic';
            arabicItem.append(createVerseNumber(verse.verse_key));
            const arabic = document.createElement('span');
            arabic.textContent = verse.text_uthmani;
            arabicItem.append(arabic);

            const translationItem = document.createElement('div');
            translationItem.className = 'quran-book-verse quran-book-verse-translation';
            translationItem.append(createVerseNumber(verse.verse_key));
            const translation = document.createElement('span');
            translation.textContent = verse.translations && verse.translations[0]
                ? verse.translations[0].text.replace(/<[^>]*>/g, ' ')
                : 'Terjemahan belum tersedia.';
            translationItem.append(translation);
            arabicVerses.append(arabicItem);
            translationVerses.append(translationItem);
        });
    }

    function updateBookmarkButtons() {
        const isBookmarked = bookmarkedPage === currentPage;
        [bookmarkButton, ...reader.querySelectorAll('.quran-book-bookmark')].forEach((button) => {
            button.setAttribute('aria-pressed', String(isBookmarked));
            button.setAttribute('aria-label', isBookmarked ? 'Hapus bookmark halaman' : 'Simpan bookmark halaman');
            const label = button.querySelector('span');
            if (label && label.hasAttribute('aria-hidden')) label.textContent = isBookmarked ? '★' : '☆';
            else button.textContent = isBookmarked ? '★' : '☆';
        });
    }

    function renderPage(pageNumber, verses) {
        const firstVerse = verses[0];
        const [surahNumber] = firstVerse.verse_key.split(':').map(Number);
        const surah = surahs.find((item) => item.number === surahNumber);
        currentSurahNumber = surahNumber;
        currentPage = pageNumber;
        const surahName = surah ? surah.latinName : `Surah ${surahNumber}`;
        const arabicName = surah ? surah.arabicName : 'الْقُرْآنُ الْكَرِيمُ';

        arabicHeading.textContent = arabicName;
        surahHeading.textContent = `${String(surahNumber).padStart(3, '0')} · ${surahName}`;
        surahSubheading.textContent = `${surah && surah.translation ? surah.translation : 'Terjemahan Bahasa Indonesia'} · Ayat ${firstVerse.verse_key.split(':')[1]}`;
        readerTitle.textContent = `${surahNumber}. ${surahName}`;
        readerMeta.textContent = `${verses.length} ayat di halaman ini${surah && surah.revelation ? ` · ${surah.revelation}` : ''}`;
        document.getElementById('quran-arabic-page-label').textContent = `الصفحة ${pageNumber} · ${pageNumber}`;
        document.getElementById('quran-translation-page-label').textContent = `Halaman ${pageNumber}`;
        pageIndicator.textContent = `Halaman ${pageNumber} dari ${totalPages}`;
        pageInput.value = String(pageNumber);
        pageInput.max = String(totalPages);
        previousButton.disabled = pageNumber <= 1;
        nextButton.disabled = pageNumber >= totalPages;
        surahSelect.value = String(surahNumber);
        if (audioSurahNumber !== surahNumber) {
            audioPlayer.pause();
            audioPlayer.removeAttribute('src');
            audioPlayer.load();
            audioSurahNumber = 0;
            updateAudioButton(false);
        }
        renderVerses(verses);
        updateBookmarkButtons();
        storageSet('ustadOnline.lastReadPage', String(pageNumber));
        storageSet('ustadOnline.lastReadSurah', String(surahNumber));
    }

    function updateAudioButton(isPlaying) {
        audioButton.setAttribute('aria-label', isPlaying ? 'Jeda murottal' : 'Putar murottal');
        audioButton.innerHTML = `<span aria-hidden="true">${isPlaying ? 'Ⅱ' : '▶'}</span><span>${isPlaying ? 'Jeda murottal' : 'Putar murottal'}</span>`;
    }

    async function openPage(pageNumber, options) {
        const settings = options || {};
        const page = Math.max(1, Math.min(totalPages, Number(pageNumber)));
        if (!Number.isInteger(page)) return;
        if (requestController) requestController.abort();
        requestController = new AbortController();
        const thisRequest = ++requestVersion;
        const layer = settings.layer || (settings.animate ? createFlipLayer(settings.direction || 'next') : null);
        setStatus(`Memuat halaman ${page} dari ${totalPages}...`, false);
        spread.setAttribute('aria-busy', 'true');
        try {
            let verses = cache.get(page);
            if (!verses) {
                const payload = await requestJson(
                    `/verses/by_page/${page}?fields=text_uthmani&translations=33&per_page=50`,
                    requestController.signal
                );
                if (!Array.isArray(payload.verses) || payload.verses.length === 0 ||
                    payload.verses.some((verse) => !verse.verse_key || !verse.text_uthmani)) {
                    throw new Error('Data halaman mushaf tidak lengkap.');
                }
                verses = payload.verses;
                cache.set(page, verses);
            }
            if (thisRequest !== requestVersion) return;
            renderPage(page, verses);
            setStatus('Teks Arab Utsmani dan terjemahan Indonesia siap.', false);
            finishFlip(layer, settings.direction || 'next', Boolean(settings.animate || settings.layer));
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Halaman mushaf tidak dapat dimuat:', error);
            setStatus('Halaman gagal dimuat. Periksa koneksi internet, lalu coba lagi.', true);
            finishFlip(layer, settings.direction || 'next', false);
        } finally {
            if (thisRequest === requestVersion) spread.removeAttribute('aria-busy');
        }
    }

    async function lookupPage(verseKey) {
        const payload = await requestJson(`/verses/by_key/${encodeURIComponent(verseKey)}?fields=text_uthmani`);
        const page = payload.verse && Number(payload.verse.page_number);
        if (!Number.isInteger(page) || page < 1 || page > totalPages) throw new Error('Nomor halaman ayat tidak valid.');
        return page;
    }

    async function openSurah(number) {
        const surah = surahs.find((item) => item.number === Number(number));
        if (!surah) return;
        setStatus(`Membuka Surah ${surah.latinName}...`, false);
        surahSelect.value = String(surah.number);
        try {
            const page = await lookupPage(`${surah.number}:1`);
            await openPage(page, { animate: true, direction: 'next' });
        } catch (error) {
            console.error('Surah tidak dapat dibuka:', error);
            setStatus('Surah gagal dibuka. Periksa koneksi internet, lalu coba lagi.', true);
        }
    }

    async function openJuz(number) {
        try {
            setStatus(`Mencari awal juz ${number}...`, false);
            const payload = await requestJson(`/juzs/${number}`);
            const mapping = payload.juz && payload.juz.verse_mapping;
            if (!mapping || typeof mapping !== 'object') throw new Error('Peta juz tidak tersedia.');
            const firstChapter = Object.keys(mapping).sort((a, b) => Number(a) - Number(b))[0];
            const firstVerse = String(mapping[firstChapter]).split('-')[0];
            const page = await lookupPage(`${firstChapter}:${firstVerse}`);
            await openPage(page, { animate: true, direction: 'next' });
        } catch (error) {
            console.error('Juz tidak dapat dibuka:', error);
            setStatus('Juz gagal dibuka. Periksa koneksi internet, lalu coba lagi.', true);
        }
    }

    function toggleBookmark() {
        if (bookmarkedPage === currentPage) {
            bookmarkedPage = null;
            window.UstadOnlineStorage.removeItem('ustadOnline.quran.bookmark.v1');
            setStatus('Bookmark halaman dihapus.', false);
        } else {
            bookmarkedPage = currentPage;
            storageSet('ustadOnline.quran.bookmark.v1', JSON.stringify({ page: currentPage }));
            setStatus(`Bookmark halaman ${currentPage} disimpan.`, false);
        }
        updateBookmarkButtons();
    }

    async function toggleAudio() {
        if (!audioPlayer.paused && audioPlayer.src) {
            audioPlayer.pause();
            return;
        }
        if (!audioPlayer.src || audioSurahNumber !== currentSurahNumber) {
            try {
                setStatus('Memuat murottal surah...', false);
                const response = await fetch(`https://equran.id/api/v2/surat/${currentSurahNumber}`);
                if (!response.ok) throw new Error(`Layanan audio merespons dengan status ${response.status}.`);
                const payload = await response.json();
                const audio = payload.data && payload.data.audioFull && payload.data.audioFull[reciterSelect.value];
                if (!audio) throw new Error('Audio qari untuk surah ini tidak tersedia.');
                audioSurahNumber = currentSurahNumber;
                audioPlayer.src = audio;
            } catch (error) {
                console.error('Murottal tidak dapat dimuat:', error);
                setStatus('Murottal gagal dimuat. Coba lagi setelah koneksi tersedia.', true);
                return;
            }
        }
        try {
            await audioPlayer.play();
        } catch (error) {
            console.error('Murottal tidak dapat diputar:', error);
            setStatus('Murottal tidak dapat diputar. Periksa pengaturan audio perangkat.', true);
        }
    }

    function setTheme(theme) {
        reader.dataset.bookTheme = theme;
        const isDark = theme === 'dark';
        themeButton.setAttribute('aria-pressed', String(isDark));
        themeButton.setAttribute('aria-label', isDark ? 'Aktifkan mode terang' : 'Aktifkan mode malam');
        themeButton.innerHTML = `<span aria-hidden="true">${isDark ? '☼' : '☾'}</span><span>${isDark ? 'Mode terang' : 'Mode malam'}</span>`;
        storageSet('ustadOnline.quran.book-theme.v1', theme);
    }

    function finishDrag(event) {
        if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
        const start = pointerStart;
        pointerStart = null;
        if (spread.hasPointerCapture(event.pointerId)) spread.releasePointerCapture(event.pointerId);
        if (!dragLayer) return;
        const progress = Math.min(1, Math.abs(event.clientX - start.x) / Math.max(1, spread.clientWidth / 2));
        const shouldFlip = progress >= .28;
        spread.classList.remove('is-dragging');
        if (shouldFlip) {
            dragLayer.classList.add('is-drag-layer');
            openPage(currentPage + (dragDirection === 'next' ? 1 : -1), {
                direction: dragDirection,
                layer: dragLayer,
                animate: true
            });
        } else {
            dragLayer.style.setProperty('--drag-angle', '0deg');
            spread.classList.add('is-releasing');
            window.setTimeout(() => {
                dragLayer.remove();
                spread.classList.remove('is-releasing');
            }, 220);
        }
        dragLayer = null;
    }

    function setSurahs(items) {
        surahs = items;
        surahSelect.replaceChildren(new Option('Pilih surah', ''));
        items.forEach((surah) => surahSelect.add(new Option(`${surah.number}. ${surah.latinName}`, surah.number)));
        juzSelect.replaceChildren(new Option('Pilih juz', ''));
        for (let number = 1; number <= 30; number += 1) juzSelect.add(new Option(`Juz ${number}`, number));
    }

    previousButton.addEventListener('click', () => {
        openPage(currentPage - 1, { animate: true, direction: 'previous' });
    });
    nextButton.addEventListener('click', () => {
        openPage(currentPage + 1, { animate: true, direction: 'next' });
    });
    pageInput.addEventListener('change', () => {
        const page = Number(pageInput.value);
        if (Number.isInteger(page) && page >= 1 && page <= totalPages) {
            openPage(page, { animate: true, direction: page >= currentPage ? 'next' : 'previous' });
        } else {
            pageInput.value = String(currentPage);
        }
    });
    surahSelect.addEventListener('change', () => {
        if (surahSelect.value) openSurah(surahSelect.value);
    });
    juzSelect.addEventListener('change', () => {
        if (juzSelect.value) openJuz(juzSelect.value);
    });
    bookmarkButton.addEventListener('click', toggleBookmark);
    reader.querySelector('.quran-book-bookmark').addEventListener('click', toggleBookmark);
    document.getElementById('surah-modal').addEventListener('close', () => {
        if (requestController) requestController.abort();
        audioPlayer.pause();
    });
    themeButton.addEventListener('click', () => setTheme(reader.dataset.bookTheme === 'dark' ? 'light' : 'dark'));
    audioButton.addEventListener('click', toggleAudio);
    fontSizeSelect.addEventListener('change', () => {
        reader.style.setProperty('--quran-arabic-size', fontSizeSelect.value);
        storageSet('ustadOnline.quran.font-size.v1', fontSizeSelect.value);
    });
    audioPlayer.addEventListener('play', () => {
        updateAudioButton(true);
        setStatus('Murottal sedang diputar.', false);
    });
    audioPlayer.addEventListener('pause', () => updateAudioButton(false));
    audioPlayer.addEventListener('ended', () => {
        updateAudioButton(false);
        setStatus('Murottal selesai diputar.', false);
    });
    reciterSelect.addEventListener('change', () => {
        if (!audioPlayer.src) return;
        audioPlayer.pause();
        audioPlayer.removeAttribute('src');
        audioPlayer.load();
        audioSurahNumber = 0;
        updateAudioButton(false);
    });

    spread.addEventListener('pointerdown', (event) => {
        if (event.target.closest('button')) return;
        pointerStart = { x: event.clientX, y: event.clientY, pointerId: event.pointerId };
    });
    spread.addEventListener('pointermove', (event) => {
        if (!pointerStart || event.pointerId !== pointerStart.pointerId) return;
        const deltaX = event.clientX - pointerStart.x;
        if (!dragLayer && Math.abs(deltaX) > 18 && Math.abs(deltaX) > Math.abs(event.clientY - pointerStart.y)) {
            dragDirection = deltaX < 0 ? 'next' : 'previous';
            if ((dragDirection === 'next' && currentPage >= totalPages) ||
                (dragDirection === 'previous' && currentPage <= 1)) return;
            dragLayer = createFlipLayer(dragDirection);
            dragLayer.classList.add('is-drag-layer');
            spread.classList.add('is-dragging');
            spread.setPointerCapture(event.pointerId);
        }
        if (dragLayer) {
            const progress = Math.min(1, Math.abs(deltaX) / Math.max(1, spread.clientWidth / 2));
            dragLayer.style.setProperty('--drag-angle', `${(dragDirection === 'next' ? -1 : 1) * progress * 180}deg`);
        }
    });
    spread.addEventListener('pointerup', finishDrag);
    spread.addEventListener('pointercancel', finishDrag);

    try {
        const savedBookmark = JSON.parse(storageGet('ustadOnline.quran.bookmark.v1') || 'null');
        if (savedBookmark && Number.isInteger(savedBookmark.page) &&
            savedBookmark.page >= 1 && savedBookmark.page <= totalPages) {
            bookmarkedPage = savedBookmark.page;
        }
        const savedTheme = storageGet('ustadOnline.quran.book-theme.v1');
        setTheme(savedTheme === 'dark' ? 'dark' : 'light');
        const savedFontSize = storageGet('ustadOnline.quran.font-size.v1');
        if (['1.7rem', '2rem', '2.35rem'].includes(savedFontSize)) {
            fontSizeSelect.value = savedFontSize;
            reader.style.setProperty('--quran-arabic-size', savedFontSize);
        }
    } catch (error) {
        console.error('Pengaturan pembaca mushaf tidak dapat dibaca:', error);
        setStatus('Pengaturan mushaf tidak dapat dibaca; pengaturan bawaan digunakan.', true);
        setTheme('light');
    }

    window.QuranBookViewer = {
        setSurahs,
        openSurah,
        openPage
    };
}());
