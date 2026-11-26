(function () {
    'use strict';

    const storageKey = 'ustadOnline.quranBattle.preferences.v1';
    const languageStorageKey = 'ustadOnline.language.v1';
    const defaults = { arabicSize: 'normal', buzzerSound: true, animations: true, language: 'id' };
    const i18n = window.UstadOnlineI18n;

    function ensureSettingsUi() {
        if (!document.getElementById('ui-customization-dialog')) {
            const dialog = document.createElement('dialog');
            dialog.className = 'settings-dialog';
            dialog.id = 'ui-customization-dialog';
            dialog.setAttribute('aria-labelledby', 'ui-customization-title');
            dialog.innerHTML = `
                <header class="settings-header">
                    <div><span class="kicker" data-language-key="settings.kicker"></span><h2 id="ui-customization-title" data-language-key="settings.title"></h2></div>
                    <button class="small-button" id="ui-close-settings" type="button" data-language-aria="settings.close">✕</button>
                </header>
                <div class="settings-content">
                    <section class="setting-section">
                        <label class="setting-title" for="ui-language-select" data-language-key="settings.language"></label>
                        <select class="language-select" id="ui-language-select" data-language-aria="settings.languageSelect">
                            <option value="id" lang="id" data-language-key="settings.option.id"></option>
                            <option value="en" lang="en" data-language-key="settings.option.en"></option>
                            <option value="ar" lang="ar" dir="rtl" data-language-key="settings.option.ar"></option>
                        </select>
                        <p class="language-note" data-language-key="settings.languageNote"></p>
                    </section>
                    <section class="setting-section">
                        <span class="setting-title" data-language-key="settings.arabicSize"></span>
                        <div class="size-options" role="group" data-language-aria="settings.sizeAria">
                            <button class="size-option" type="button" data-arabic-option="normal" data-language-key="settings.normal"></button>
                            <button class="size-option" type="button" data-arabic-option="large" data-language-key="settings.large"></button>
                            <button class="size-option" type="button" data-arabic-option="xlarge" data-language-key="settings.xlarge"></button>
                        </div>
                    </section>
                    <section class="setting-section" data-language-aria="settings.effectsAndSound">
                        <div class="switch-row">
                            <div class="switch-copy"><strong data-language-key="settings.sound"></strong><span data-language-key="settings.soundDescription"></span></div>
                            <button class="switch" type="button" role="switch" data-preference="buzzerSound" data-language-aria="settings.sound"></button>
                        </div>
                        <div class="switch-row" style="margin-top:16px">
                            <div class="switch-copy"><strong data-language-key="settings.animations"></strong><span data-language-key="settings.animationsDescription"></span></div>
                            <button class="switch" type="button" role="switch" data-preference="animations" data-language-aria="settings.animations"></button>
                        </div>
                    </section>
                    <div class="setting-actions">
                        <button class="reset-settings" id="ui-reset-settings" type="button" data-language-key="settings.reset"></button>
                        <span class="settings-save-note" data-language-key="settings.savedOnDevice"></span>
                    </div>
                    <p class="settings-status" id="ui-settings-status" role="status" aria-live="polite"></p>
                </div>`;
            document.body.appendChild(dialog);
        }
        if (!document.querySelector('[data-open-ui-customization]')) {
            const button = document.createElement('button');
            button.className = 'settings-button global-settings-launcher';
            button.type = 'button';
            button.setAttribute('data-open-ui-customization', '');
            button.setAttribute('aria-haspopup', 'dialog');
            button.setAttribute('aria-controls', 'ui-customization-dialog');
            button.setAttribute('data-language-aria', 'settings.open');
            button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 8.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/><path d="m19.4 15 .1.1a1.7 1.7 0 0 1-2.4 2.4l-.1-.1a1.7 1.7 0 0 0-2.9 1.2v.2a1.7 1.7 0 0 1-3.4 0v-.2a1.7 1.7 0 0 0-2.9-1.2l-.1.1a1.7 1.7 0 1 1-2.4-2.4l.1-.1a1.7 1.7 0 0 0-1.2-2.9H4a1.7 1.7 0 0 1 0-3.4h.2a1.7 1.7 0 0 0 1.2-2.9l-.1-.1a1.7 1.7 0 1 1 2.4-2.4l.1.1a1.7 1.7 0 0 0 2.9-1.2V4a1.7 1.7 0 0 1 3.4 0v.2a1.7 1.7 0 0 0 2.9 1.2l.1-.1a1.7 1.7 0 1 1 2.4 2.4l-.1.1a1.7 1.7 0 0 0 1.2 2.9h.2a1.7 1.7 0 0 1 0 3.4h-.2a1.7 1.7 0 0 0-1.2 2.9Z"/></svg>';
            document.body.appendChild(button);
        }
    }

    ensureSettingsUi();
    const dialog = document.getElementById('ui-customization-dialog');
    const status = document.getElementById('ui-settings-status');
    const languageSelect = document.getElementById('ui-language-select');
    let preferences = { ...defaults };
    let languageCsrfToken = '';
    const languageSessionReady = fetch('/api/preferences/language', { credentials: 'same-origin' })
        .then((response) => {
            if (!response.ok) throw new Error(`Language preference request failed (${response.status}).`);
            return response.json();
        })
        .then((result) => {
            languageCsrfToken = result.csrf_token;
            if (preferences.language !== result.language) persistLanguageInSession(preferences.language);
            return result;
        })
        .catch((error) => {
            console.error('Preferensi bahasa sesi tidak dapat disinkronkan:', error);
            return null;
        });

    function message(key) {
        return i18n ? i18n.translate(key, preferences.language) : key;
    }

    function setStatus(message, kind) {
        if (!status) return;
        status.textContent = message;
        status.className = `settings-status${kind ? ` ${kind}` : ''}`;
    }

    function persistLanguageInSession(language) {
        languageSessionReady.then((result) => {
            if (!result || !languageCsrfToken) return;
            return fetch('/api/preferences/language', {
                method: 'POST',
                credentials: 'same-origin',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-Token': languageCsrfToken
                },
                body: JSON.stringify({ language })
            }).then((response) => {
                if (!response.ok) throw new Error(`Language preference update failed (${response.status}).`);
            }).catch((error) => {
                console.error('Preferensi bahasa tidak dapat disimpan ke sesi:', error);
            });
        });
    }

    function loadPreferences() {
        try {
            let deviceLanguage = null;
            try {
                deviceLanguage = window.localStorage.getItem(languageStorageKey);
            } catch (error) {
                console.error('Preferensi bahasa perangkat tidak dapat dibaca:', error);
            }
            const serialized = window.UstadOnlineStorage.getItem(storageKey);
            if (!serialized) {
                return {
                    ...defaults,
                    language: ['id', 'en', 'ar'].includes(deviceLanguage)
                        ? deviceLanguage
                        : ['id', 'en', 'ar'].includes(window.UstadOnlineSessionLanguage)
                            ? window.UstadOnlineSessionLanguage
                            : defaults.language
                };
            }
            const saved = JSON.parse(serialized);
            if (!saved || typeof saved !== 'object' || Array.isArray(saved)) {
                throw new Error('Format preferensi tidak dikenali.');
            }
            const savedLanguage = ['id', 'en', 'ar'].includes(saved.language) ? saved.language : defaults.language;
            const sessionLanguage = ['id', 'en', 'ar'].includes(window.UstadOnlineSessionLanguage)
                ? window.UstadOnlineSessionLanguage
                : defaults.language;
            return {
                arabicSize: ['normal', 'large', 'xlarge'].includes(saved.arabicSize) ? saved.arabicSize : defaults.arabicSize,
                buzzerSound: typeof saved.buzzerSound === 'boolean' ? saved.buzzerSound : defaults.buzzerSound,
                animations: typeof saved.animations === 'boolean' ? saved.animations : defaults.animations,
                language: ['id', 'en', 'ar'].includes(deviceLanguage)
                    ? deviceLanguage
                    : ['id', 'en', 'ar'].includes(window.UstadOnlineSessionLanguage)
                        ? sessionLanguage
                        : savedLanguage
            };
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat dibaca:', error);
            setStatus(message('status.storageError'), 'error');
            return { ...defaults };
        }
    }

    function applyLanguage() {
        const language = preferences.language;
        if (i18n) {
            i18n.setLanguage(language);
            i18n.apply(dialog);
        }
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
            window.localStorage.setItem(languageStorageKey, preferences.language);
            persistLanguageInSession(preferences.language);
            setStatus(message('status.saved'), 'success');
        } catch (error) {
            console.error('Preferensi tampilan tidak dapat disimpan:', error);
            setStatus(message('status.saveError'), 'error');
        }
    }

    function updatePreference(key, value) {
        preferences = { ...preferences, [key]: value };
        applyPreferences();
        savePreferences();
    }

    preferences = loadPreferences();
    try {
        if (!window.localStorage.getItem(languageStorageKey)) {
            window.localStorage.setItem(languageStorageKey, preferences.language);
        }
    } catch (error) {
        console.error('Preferensi bahasa tidak dapat disimpan di perangkat:', error);
    }
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
        if (event.key !== languageStorageKey && event.key !== window.UstadOnlineStorage.key(storageKey)) return;
        preferences = loadPreferences();
        applyPreferences();
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
