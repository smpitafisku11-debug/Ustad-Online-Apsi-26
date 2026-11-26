(function () {
    'use strict';

    const storageKey = 'ustadOnline.quranBattle.preferences.v1';
    const defaults = { arabicSize: 'normal', buzzerSound: true, animations: true, language: 'id' };
    const dialog = document.getElementById('ui-customization-dialog');
    const status = document.getElementById('ui-settings-status');
    const languageSelect = document.getElementById('ui-language-select');
    let preferences = { ...defaults };

    function setStatus(message, kind) {
        if (!status) return;
        status.textContent = window.UstadOnlineI18n.translateKey(message) || message;
        status.className = `settings-status${kind ? ` ${kind}` : ''}`;
    }

    function loadPreferences() {
        try {
            const serialized = window.UstadOnlineStorage.getItem(storageKey);
            const saved = serialized ? JSON.parse(serialized) : {};
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                throw new Error('Format preferensi tidak dikenali.');
            }
            const language = window.UstadOnlineI18n.hasSavedLanguage()
                ? window.UstadOnlineI18n.getLanguage()
                : (['id', 'en', 'ar'].includes(saved.language) ? saved.language : defaults.language);
            return {
                arabicSize: ['normal', 'large', 'xlarge'].includes(saved.arabicSize) ? saved.arabicSize : defaults.arabicSize,
                buzzerSound: typeof saved.buzzerSound === 'boolean' ? saved.buzzerSound : defaults.buzzerSound,
                animations: typeof saved.animations === 'boolean' ? saved.animations : defaults.animations,
                language
            };
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat dibaca:', error);
            setStatus('status.storageError', 'error');
            return {
                ...defaults,
                language: window.UstadOnlineI18n.getLanguage()
            };
        }
    }

    function applyLanguage() {
        window.UstadOnlineI18n.setLanguage(preferences.language);
        if (languageSelect) languageSelect.value = preferences.language;
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
            setStatus('status.saved', 'success');
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat disimpan:', error);
            setStatus('status.saveError', 'error');
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
    window.addEventListener('storage', (event) => {
        if (event.key !== window.UstadOnlineStorage.key(storageKey)) return;
        preferences = loadPreferences();
        applyPreferences();
    });
    window.addEventListener('ustadonline:languagechange', (event) => {
        preferences = { ...preferences, language: event.detail.language };
        if (languageSelect) languageSelect.value = preferences.language;
    });

    window.UstadOnlineUI = {
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
                    statusElement.textContent = window.UstadOnlineI18n.translateKey('status.audioUnsupported');
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
                    statusElement.textContent = window.UstadOnlineI18n.translateKey('status.audioFailed');
                    statusElement.className = 'status-message error';
                }
            }
        }
    };
}());
