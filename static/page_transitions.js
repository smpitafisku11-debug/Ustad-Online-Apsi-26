(function () {
    'use strict';

    let activeRequest = null;
    let currentRoute = `${window.location.pathname}${window.location.search}`;
    let navigationId = 0;

    function persistentScript(script) {
        const source = script.src || '';
        return source.includes('/page_transitions.js') ||
            source.includes('/notifications.js') ||
            source.includes('cdn.tailwindcss.com');
    }

    function copyPageStyles(parsedHead) {
        const oldStyles = Array.from(document.head.querySelectorAll(
            'link[rel="stylesheet"], link[rel="preconnect"], style'
        )).filter((node) => !node.matches('style[data-tailwindcss], style[id^="tailwind"]'));

        const newStyles = Array.from(parsedHead.querySelectorAll(
            'link[rel="stylesheet"], link[rel="preconnect"], style'
        ));
        const loading = [];
        newStyles.forEach((source) => {
            const style = document.importNode(source, true);
            style.dataset.spaManaged = 'true';
            if (style.tagName === 'LINK' && style.rel === 'stylesheet') {
                loading.push(new Promise((resolve) => {
                    style.addEventListener('load', resolve, { once: true });
                    style.addEventListener('error', () => {
                        console.error(`Stylesheet tidak dapat dimuat: ${style.href}`);
                        resolve();
                    }, { once: true });
                }));
            }
            document.head.append(style);
        });

        return Promise.race([
            Promise.all(loading),
            new Promise((resolve) => window.setTimeout(resolve, 1800))
        ]).then(() => oldStyles.forEach((style) => style.remove()));
    }

    function replaceBody(parsedBody) {
        const preserved = {};
        ['theme', 'effects', 'pageMotion', 'language', 'arabicSize'].forEach((key) => {
            if (document.body.dataset[key] !== undefined) preserved[key] = document.body.dataset[key];
        });
        document.body.className = parsedBody.className;
        Object.keys(preserved).forEach((key) => {
            document.body.dataset[key] = preserved[key];
        });
        const content = Array.from(parsedBody.childNodes)
            .filter((node) => !(node.nodeType === Node.ELEMENT_NODE && node.tagName === 'SCRIPT'))
            .map((node) => document.importNode(node, true));
        document.body.replaceChildren(...content);
        document.body.setAttribute('aria-busy', 'true');
    }

    function runScript(source) {
        if (persistentScript(source)) return Promise.resolve();
        if (source.src && source.src.includes('socket.io') && typeof window.io === 'function') {
            return Promise.resolve();
        }

        return new Promise((resolve) => {
            const script = document.createElement('script');
            Array.from(source.attributes).forEach((attribute) => {
                if (!['defer', 'async', 'src'].includes(attribute.name)) {
                    script.setAttribute(attribute.name, attribute.value);
                }
            });
            if (source.src) {
                script.src = source.src;
                script.async = false;
                script.addEventListener('load', resolve, { once: true });
                script.addEventListener('error', () => {
                    console.error(`Skrip halaman tidak dapat dimuat: ${source.src}`);
                    resolve();
                }, { once: true });
            } else {
                script.textContent = source.textContent;
                resolve();
            }
            document.body.append(script);
        });
    }

    async function navigate(destination, requestOptions) {
        const target = `${destination.pathname}${destination.search}`;
        if (!requestOptions && target === currentRoute) {
            if (destination.hash) {
                document.getElementById(decodeURIComponent(destination.hash.slice(1)))
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
            return;
        }
        if (activeRequest) activeRequest.abort();
        activeRequest = new AbortController();
        const requestId = ++navigationId;
        try {
            const response = await fetch(destination.href, {
                ...(requestOptions || {}),
                credentials: 'same-origin',
                headers: {
                    ...((requestOptions && requestOptions.headers) || {}),
                    Accept: 'text/html',
                    'X-Requested-With': 'UstadOnline-SPA'
                },
                signal: activeRequest.signal
            });
            if (!response.ok) throw new Error(`Halaman merespons dengan status ${response.status}.`);
            const markup = await response.text();
            const parsed = new DOMParser().parseFromString(markup, 'text/html');
            if (!parsed.body || !parsed.querySelector('body')) {
                throw new Error('Konten halaman tidak valid.');
            }
            if (requestId !== navigationId) return;

            window.dispatchEvent(new Event('pagehide'));
            await copyPageStyles(parsed.head);
            if (requestId !== navigationId) return;
            document.title = parsed.title;
            document.documentElement.lang = parsed.documentElement.lang || 'id';
            document.body.classList.add('spa-view-leaving');
            await new Promise((resolve) => window.requestAnimationFrame(resolve));
            if (requestId !== navigationId) return;
            replaceBody(parsed.body);
            const responseUrl = new URL(response.url, destination.href);
            currentRoute = `${responseUrl.pathname}${responseUrl.search}`;

            const scripts = Array.from(parsed.querySelectorAll('script'));
            for (const script of scripts) {
                await runScript(script);
                if (requestId !== navigationId) return;
            }

            window.dispatchEvent(new CustomEvent('ustad:pagechange', {
                detail: { route: currentRoute }
            }));
            document.body.removeAttribute('aria-busy');
            document.body.classList.remove('spa-view-leaving');
            document.body.classList.add('spa-view-entering');
            window.setTimeout(() => document.body.classList.remove('spa-view-entering'), 180);
            const main = document.querySelector('main');
            if (main) {
                main.setAttribute('tabindex', '-1');
                main.focus({ preventScroll: true });
            }
            if (destination.hash) {
                document.getElementById(decodeURIComponent(destination.hash.slice(1)))
                    ?.scrollIntoView({ behavior: 'smooth', block: 'start' });
            } else {
                window.scrollTo(0, 0);
            }
        } catch (error) {
            if (error.name === 'AbortError') return;
            console.error('Navigasi SPA gagal:', error);
            document.body.classList.remove('spa-view-leaving');
            const status = document.createElement('p');
            status.className = 'spa-navigation-error';
            status.setAttribute('role', 'alert');
            status.textContent = 'Halaman gagal dimuat. Periksa koneksi lalu coba kembali.';
            document.querySelector('.spa-navigation-error')?.remove();
            document.body.prepend(status);
        }
    }

    document.addEventListener('click', (event) => {
        if (event.defaultPrevented || event.button !== 0 ||
            event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        const link = event.target.closest('a[href]');
        if (!link || link.hasAttribute('download') ||
            (link.target && link.target !== '_self') ||
            link.hasAttribute('data-no-spa')) return;

        const virtualBase = new URL(currentRoute, window.location.origin);
        const destination = new URL(link.getAttribute('href'), virtualBase);
        if (destination.origin !== window.location.origin) return;
        if (!destination.pathname.startsWith('/')) return;
        if (destination.pathname.startsWith('/static/')) return;
        event.preventDefault();
        navigate(destination);
    });

    document.addEventListener('submit', (event) => {
        if (event.defaultPrevented) return;
        const form = event.target;
        if (!(form instanceof HTMLFormElement) || form.hasAttribute('data-no-spa')) return;

        const submitter = event.submitter;
        const target = submitter?.formTarget || form.target;
        const enctype = submitter?.formEnctype || form.enctype;
        if ((target && target !== '_self') || enctype === 'multipart/form-data') return;
        const virtualBase = new URL(currentRoute, window.location.origin);
        const destination = new URL(
            submitter?.formAction || form.getAttribute('action') || currentRoute,
            virtualBase
        );
        if (destination.origin !== window.location.origin ||
            destination.pathname.startsWith('/static/')) return;
        const formData = submitter ? new FormData(form, submitter) : new FormData(form);
        const method = (submitter?.formMethod || form.method).toUpperCase();
        if (method === 'GET') {
            formData.forEach((value, key) => destination.searchParams.append(key, String(value)));
            event.preventDefault();
            navigate(destination);
            return;
        }
        if (method !== 'POST') return;
        event.preventDefault();
        navigate(destination, { method, body: formData });
    });

    window.UstadSpa = { navigate };
}());
