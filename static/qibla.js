(function () {
    'use strict';

    const kaaba = { latitude: 21.4225, longitude: 39.8262 };
    const button = document.getElementById('qibla-button');
    const dialog = document.getElementById('qibla-dialog');
    const locateButton = document.getElementById('qibla-locate');
    const status = document.getElementById('qibla-status');
    const bearingOutput = document.getElementById('qibla-bearing');
    const directionOutput = document.getElementById('qibla-direction');
    const dial = document.getElementById('qibla-dial');
    const needle = document.getElementById('qibla-needle');
    let qiblaBearing = null;
    let deviceHeading = null;
    let orientationListening = false;
    let sensorTimeout = null;

    function normalize(degrees) {
        return (degrees % 360 + 360) % 360;
    }

    function getQiblaBearing(latitude, longitude) {
        const toRadians = (degrees) => degrees * Math.PI / 180;
        const latitudeRadians = toRadians(latitude);
        const kaabaLatitudeRadians = toRadians(kaaba.latitude);
        const longitudeDifference = toRadians(kaaba.longitude - longitude);
        const y = Math.sin(longitudeDifference) * Math.cos(kaabaLatitudeRadians);
        const x = Math.cos(latitudeRadians) * Math.sin(kaabaLatitudeRadians)
            - Math.sin(latitudeRadians) * Math.cos(kaabaLatitudeRadians) * Math.cos(longitudeDifference);
        return normalize(Math.atan2(y, x) * 180 / Math.PI);
    }

    function directionName(degrees) {
        const names = ['Utara', 'Timur laut', 'Timur', 'Tenggara', 'Selatan', 'Barat daya', 'Barat', 'Barat laut'];
        return names[Math.round(normalize(degrees) / 45) % names.length];
    }

    function setStatus(message, isError) {
        status.textContent = message;
        status.classList.toggle('is-error', Boolean(isError));
    }

    function updateCompass() {
        if (qiblaBearing === null) return;
        bearingOutput.textContent = `${Math.round(qiblaBearing)}°`;
        directionOutput.textContent = `${directionName(qiblaBearing)} dari utara`;
        needle.style.setProperty('--qibla-bearing', `${qiblaBearing}deg`);
        dial.style.transform = `rotate(${deviceHeading === null ? 0 : -deviceHeading}deg)`;
        if (deviceHeading !== null) {
            setStatus('Kompas aktif. Putar badan/perangkat sampai penunjuk mengarah ke atas.', false);
        }
    }

    function handleOrientation(event) {
        if (typeof event.webkitCompassHeading === 'number' && Number.isFinite(event.webkitCompassHeading)) {
            deviceHeading = normalize(event.webkitCompassHeading);
        } else if (event.absolute && typeof event.alpha === 'number' && Number.isFinite(event.alpha)) {
            const screenAngle = window.screen && window.screen.orientation
                ? window.screen.orientation.angle
                : 0;
            deviceHeading = normalize(360 - event.alpha + screenAngle);
        } else {
            return;
        }
        updateCompass();
    }

    async function requestOrientationAccess() {
        if (!('DeviceOrientationEvent' in window)) {
            setStatus('Sensor kompas tidak tersedia. Arah derajat tetap dihitung dari lokasimu.', false);
            return;
        }

        try {
            if (typeof window.DeviceOrientationEvent.requestPermission === 'function') {
                const permission = await window.DeviceOrientationEvent.requestPermission();
                if (permission !== 'granted') {
                    setStatus('Izin sensor tidak diberikan. Arah kiblat tetap tersedia dalam derajat dari utara.', false);
                    return;
                }
            }
            window.addEventListener('deviceorientation', handleOrientation);
            if ('ondeviceorientationabsolute' in window) {
                window.addEventListener('deviceorientationabsolute', handleOrientation);
            }
            orientationListening = true;
            window.clearTimeout(sensorTimeout);
            sensorTimeout = window.setTimeout(() => {
                if (deviceHeading === null && qiblaBearing !== null) {
                    setStatus('Sensor belum mengirim arah. Gunakan angka derajat dari utara atau periksa izin sensor kompas.', false);
                }
            }, 4000);
        } catch (error) {
            console.error('Akses sensor kompas tidak tersedia:', error);
            setStatus('Sensor kompas tidak dapat diakses. Arah kiblat tetap tersedia dalam derajat dari utara.', false);
        }
    }

    function getCurrentPosition() {
        return new Promise((resolve, reject) => {
            if (!navigator.geolocation) {
                reject(new Error('Browser ini tidak mendukung lokasi perangkat.'));
                return;
            }
            navigator.geolocation.getCurrentPosition(resolve, reject, {
                enableHighAccuracy: true,
                timeout: 15000,
                maximumAge: 60000
            });
        });
    }

    function locationErrorMessage(error) {
        if (error.code === 1) return 'Izin lokasi ditolak. Izinkan akses lokasi di pengaturan browser untuk menghitung arah kiblat.';
        if (error.code === 2) return 'Lokasi tidak dapat ditentukan. Pastikan GPS/lokasi perangkat aktif lalu coba lagi.';
        if (error.code === 3) return 'Pencarian lokasi terlalu lama. Periksa sinyal GPS lalu coba lagi.';
        return error.message || 'Lokasi tidak dapat diakses.';
    }

    async function findQibla() {
        locateButton.disabled = true;
        locateButton.textContent = 'Mencari lokasi...';
        setStatus('Meminta izin sensor kompas dan lokasi perangkat...', false);

        const orientationRequest = requestOrientationAccess();
        try {
            const position = await getCurrentPosition();
            qiblaBearing = getQiblaBearing(position.coords.latitude, position.coords.longitude);
            updateCompass();
            if (deviceHeading === null) {
                const accuracy = Math.round(position.coords.accuracy);
                setStatus(`Lokasi ditemukan (akurasi ±${accuracy} m). Arah kiblat ditampilkan dari utara; aktifkan sensor kompas jika tersedia.`, false);
            }
            await orientationRequest;
        } catch (error) {
            console.error('Lokasi untuk kompas kiblat tidak dapat ditentukan:', error);
            setStatus(locationErrorMessage(error), true);
        } finally {
            locateButton.disabled = false;
            locateButton.textContent = qiblaBearing === null ? 'Coba aktifkan lokasi lagi' : 'Perbarui lokasi';
        }
    }

    button.addEventListener('click', () => {
        if (!dialog.open) dialog.showModal();
    });
    locateButton.addEventListener('click', findQibla);
    document.querySelectorAll('[data-close-qibla]').forEach((closeButton) => {
        closeButton.addEventListener('click', () => dialog.close());
    });
    dialog.addEventListener('click', (event) => {
        if (event.target === dialog) dialog.close();
    });
    dialog.addEventListener('close', () => {
        if (orientationListening) {
            window.removeEventListener('deviceorientation', handleOrientation);
            window.removeEventListener('deviceorientationabsolute', handleOrientation);
            orientationListening = false;
        }
        window.clearTimeout(sensorTimeout);
        deviceHeading = null;
        updateCompass();
    });
}());
