(function () {
    'use strict';

    const storageKey = 'ustadOnline.quranBattle.preferences.v1';
    const defaults = { arabicSize: 'normal', buzzerSound: true, animations: true, language: 'id' };
    const translations = {
        id: {
            'settings.kicker': 'PREFERENSI GLOBAL',
            'settings.title': 'Pengaturan Belajar',
            'settings.close': 'Tutup pengaturan',
            'settings.open': 'Pengaturan belajar',
            'settings.language': 'Bahasa antarmuka',
            'settings.languageSelect': 'Pilih bahasa antarmuka',
            'settings.languageNote': 'Bagian antarmuka yang belum diterjemahkan akan tetap ditampilkan dalam bahasa sumbernya.',
            'settings.sizeAria': 'Ukuran teks Arab dan konten',
            'settings.arabicSize': "Ukuran teks Arab & konten Al-Qur'an",
            'settings.normal': 'Normal',
            'settings.large': 'Besar',
            'settings.xlarge': 'Ekstra Besar',
            'settings.effectsAndSound': 'Efek dan suara',
            'settings.sound': 'Efek suara interaktif',
            'settings.soundDescription': 'Bunyi singkat untuk buzzer Quran Battle.',
            'settings.animations': 'Animasi transisi',
            'settings.animationsDescription': 'Transisi halus di seluruh halaman dan arena.',
            'settings.reset': 'Pulihkan default',
            'settings.savedOnDevice': 'Tersimpan otomatis di perangkat ini',
            'status.saved': 'Preferensi berhasil disimpan di perangkat ini.',
            'status.storageError': 'Preferensi tersimpan tidak dapat dibaca. Default digunakan untuk sesi ini.',
            'status.saveError': 'Pengaturan aktif untuk sesi ini, tetapi tidak dapat disimpan di perangkat.'
        },
        en: {
            'settings.kicker': 'GLOBAL PREFERENCES',
            'settings.title': 'Learning Settings',
            'settings.close': 'Close settings',
            'settings.open': 'Learning settings',
            'settings.language': 'Interface language',
            'settings.languageSelect': 'Choose interface language',
            'settings.languageNote': 'Interface sections that have not been translated remain in their source language.',
            'settings.sizeAria': 'Arabic text and content size',
            'settings.arabicSize': 'Arabic text and Qur’an content size',
            'settings.normal': 'Normal',
            'settings.large': 'Large',
            'settings.xlarge': 'Extra large',
            'settings.effectsAndSound': 'Effects and sound',
            'settings.sound': 'Interactive sound effects',
            'settings.soundDescription': 'Short sound for the Quran Battle buzzer.',
            'settings.animations': 'Transition animations',
            'settings.animationsDescription': 'Smooth transitions across pages and arenas.',
            'settings.reset': 'Restore defaults',
            'settings.savedOnDevice': 'Saved automatically on this device',
            'status.saved': 'Preferences saved on this device.',
            'status.storageError': 'Saved preferences could not be read. Defaults are being used for this session.',
            'status.saveError': 'Settings are active for this session but could not be saved on this device.'
        },
        ar: {
            'settings.kicker': 'التفضيلات العامة',
            'settings.title': 'إعدادات التعلّم',
            'settings.close': 'إغلاق الإعدادات',
            'settings.open': 'إعدادات التعلّم',
            'settings.language': 'لغة الواجهة',
            'settings.languageSelect': 'اختر لغة الواجهة',
            'settings.languageNote': 'ستبقى أجزاء الواجهة التي لم تُترجم معروضة بلغتها الأصلية.',
            'settings.sizeAria': 'حجم النص العربي والمحتوى',
            'settings.arabicSize': 'حجم النص العربي ومحتوى القرآن',
            'settings.normal': 'عادي',
            'settings.large': 'كبير',
            'settings.xlarge': 'كبير جدًا',
            'settings.effectsAndSound': 'المؤثرات والصوت',
            'settings.sound': 'المؤثرات الصوتية التفاعلية',
            'settings.soundDescription': 'صوت قصير لجرس مسابقة القرآن.',
            'settings.animations': 'حركات الانتقال',
            'settings.animationsDescription': 'انتقالات سلسة بين الصفحات وساحات اللعب.',
            'settings.reset': 'استعادة الإعدادات الافتراضية',
            'settings.savedOnDevice': 'يُحفظ تلقائيًا على هذا الجهاز',
            'status.saved': 'تم حفظ التفضيلات على هذا الجهاز.',
            'status.storageError': 'تعذّرت قراءة التفضيلات المحفوظة. ستُستخدم الإعدادات الافتراضية لهذه الجلسة.',
            'status.saveError': 'الإعدادات مفعّلة لهذه الجلسة، لكن تعذّر حفظها على هذا الجهاز.'
        }
    };
    const dialog = document.getElementById('ui-customization-dialog');
    const status = document.getElementById('ui-settings-status');
    const languageSelect = document.getElementById('ui-language-select');
    let preferences = { ...defaults };

    function setStatus(message, kind) {
        if (!status) return;
        status.textContent = message;
        status.className = `settings-status${kind ? ` ${kind}` : ''}`;
    }

    function loadPreferences() {
        try {
            const serialized = window.UstadOnlineStorage.getItem(storageKey);
            if (!serialized) return { ...defaults };
            const saved = JSON.parse(serialized);
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                throw new Error('Format preferensi tidak dikenali.');
            }
            return {
                arabicSize: ['normal', 'large', 'xlarge'].includes(saved.arabicSize) ? saved.arabicSize : defaults.arabicSize,
                buzzerSound: typeof saved.buzzerSound === 'boolean' ? saved.buzzerSound : defaults.buzzerSound,
                animations: typeof saved.animations === 'boolean' ? saved.animations : defaults.animations,
                language: ['id', 'en', 'ar'].includes(saved.language) ? saved.language : defaults.language
            };
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat dibaca:', error);
            setStatus(translations[preferences.language]['status.storageError'], 'error');
            return { ...defaults };
        }
    }

    function applyLanguage() {
        const language = preferences.language;
        const messages = translations[language];
        document.body.dataset.language = language;
        if (dialog) {
            dialog.lang = language;
            dialog.dir = language === 'ar' ? 'rtl' : 'ltr';
        }
        document.querySelectorAll('[data-language-key]').forEach((element) => {
            const translated = messages[element.dataset.languageKey];
            if (translated) element.textContent = translated;
        });
        document.querySelectorAll('[data-language-aria]').forEach((element) => {
            const translated = messages[element.dataset.languageAria];
            if (translated) element.setAttribute('aria-label', translated);
        });
        if (languageSelect) languageSelect.value = language;
    }

    function applyPreferences() {
        applyLanguage();
        document.body.dataset.arabicSize = preferences.arabicSize;
        document.body.dataset.effects = preferences.animations ? 'on' : 'off';
        document.body.dataset.pageMotion = preferences.animations ? 'on' : 'off';
        document.querySelectorAll('[data-arabic-option]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.arabicOption === preferences.arabicSize));
        });
        document.querySelectorAll('[data-preference]').forEach((button) => {
            button.setAttribute('aria-checked', String(preferences[button.dataset.preference]));
        });
    }

    function savePreferences() {
        try {
            window.UstadOnlineStorage.setItem(storageKey, JSON.stringify(preferences));
            setStatus(translations[preferences.language]['status.saved'], 'success');
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat disimpan:', error);
            setStatus(translations[preferences.language]['status.saveError'], 'error');
        }
    }

    function updatePreference(key, value) {
        preferences = { ...preferences, [key]: value };
        applyPreferences();
        savePreferences();
    }

    preferences = loadPreferences();
    applyPreferences();

    document.querySelectorAll('[data-open-ui-customization]').forEach((button) => {
        button.addEventListener('click', () => {
            if (dialog && !dialog.open) dialog.showModal();
        });
    });

    const closeButton = document.getElementById('ui-close-settings');
    if (closeButton && dialog) closeButton.addEventListener('click', () => dialog.close());
    if (dialog) {
        dialog.addEventListener('click', (event) => {
            if (event.target === dialog) dialog.close();
        });
    }
    document.querySelectorAll('[data-arabic-option]').forEach((button) => {
        button.addEventListener('click', () => updatePreference('arabicSize', button.dataset.arabicOption));
    });
    if (languageSelect) {
        languageSelect.addEventListener('change', () => {
            updatePreference('language', languageSelect.value);
        });
    }
    document.querySelectorAll('[data-preference]').forEach((button) => {
        button.addEventListener('click', () => {
            const key = button.dataset.preference;
            updatePreference(key, !preferences[key]);
        });
    });
    const resetButton = document.getElementById('ui-reset-settings');
    if (resetButton) {
        resetButton.addEventListener('click', () => {
            preferences = { ...defaults };
            applyPreferences();
            savePreferences();
        });
    }
    window.UstadOnlineUI = {
        reloadPreferences() {
            preferences = loadPreferences();
            applyPreferences();
        },
        getPreference(name) {
            return preferences[name];
        },
        getLanguage() {
            return preferences.language;
        },
        async playBuzzerTone(statusElement) {
            if (!preferences.buzzerSound) return;
            const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
            if (!AudioContextConstructor) {
                if (statusElement) {
                    statusElement.textContent = 'Browser ini tidak mendukung efek suara; buzzer tetap berfungsi.';
                    statusElement.className = 'status-message error';
                }
                return;
            }
            let audioContext;
            try {
                audioContext = new AudioContextConstructor();
                await audioContext.resume();
                const oscillator = audioContext.createOscillator();
                const gain = audioContext.createGain();
                const now = audioContext.currentTime;
                oscillator.type = 'sine';
                oscillator.frequency.setValueAtTime(720, now);
                gain.gain.setValueAtTime(0.001, now);
                gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
                gain.gain.exponentialRampToValueAtTime(0.001, now + 0.18);
                oscillator.connect(gain);
                gain.connect(audioContext.destination);
                oscillator.addEventListener('ended', () => audioContext.close(), { once: true });
                oscillator.start(now);
                oscillator.stop(now + 0.19);
            } catch (error) {
                console.error('Efek suara buzzer tidak dapat diputar:', error);
                if (audioContext && audioContext.state !== 'closed') await audioContext.close();
                if (statusElement) {
                    statusElement.textContent = 'Efek suara gagal diputar; buzzer tetap berfungsi.';
                    statusElement.className = 'status-message error';
                }
            }
        }
    };

    if (!window.ustadUiStorageSyncBound) {
        window.ustadUiStorageSyncBound = true;
        window.addEventListener('storage', (event) => {
            if (event.key !== window.UstadOnlineStorage.key(storageKey)) return;
            if (window.UstadOnlineUI) window.UstadOnlineUI.reloadPreferences();
        });
    }
}());
