(function () {
    'use strict';

    const storageKey = 'ustadOnline.quranBattle.preferences.v1';
    const defaults = { arabicSize: 'normal', buzzerSound: true, animations: true };
    const dialog = document.getElementById('ui-customization-dialog');
    const status = document.getElementById('ui-settings-status');
    let preferences = { ...defaults };

    function setStatus(message, kind) {
        if (!status) return;
        status.textContent = message;
        status.className = `settings-status${kind ? ` ${kind}` : ''}`;
    }

    function loadPreferences() {
        try {
            const serialized = localStorage.getItem(storageKey);
            if (!serialized) return { ...defaults };
            const saved = JSON.parse(serialized);
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                throw new Error('Format preferensi tidak dikenali.');
            }
            return {
                arabicSize: ['normal', 'large', 'xlarge'].includes(saved.arabicSize) ? saved.arabicSize : defaults.arabicSize,
                buzzerSound: typeof saved.buzzerSound === 'boolean' ? saved.buzzerSound : defaults.buzzerSound,
                animations: typeof saved.animations === 'boolean' ? saved.animations : defaults.animations
            };
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat dibaca:', error);
            setStatus('Preferensi tersimpan tidak dapat dibaca. Default digunakan untuk sesi ini.', 'error');
            return { ...defaults };
        }
    }

    function applyPreferences() {
        document.body.dataset.arabicSize = preferences.arabicSize;
        document.body.dataset.effects = preferences.animations ? 'on' : 'off';
        document.querySelectorAll('[data-arabic-option]').forEach((button) => {
            button.setAttribute('aria-pressed', String(button.dataset.arabicOption === preferences.arabicSize));
        });
        document.querySelectorAll('[data-preference]').forEach((button) => {
            button.setAttribute('aria-checked', String(preferences[button.dataset.preference]));
        });
    }

    function savePreferences() {
        try {
            localStorage.setItem(storageKey, JSON.stringify(preferences));
            setStatus('Preferensi berhasil disimpan di perangkat ini.', 'success');
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat disimpan:', error);
            setStatus('Pengaturan aktif untuk sesi ini, tetapi tidak dapat disimpan di perangkat.', 'error');
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
        if (event.key !== storageKey) return;
        preferences = loadPreferences();
        applyPreferences();
    });

    window.UstadOnlineUI = {
        getPreference(name) {
            return preferences[name];
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
}());
