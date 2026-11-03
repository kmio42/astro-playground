/*
 * embed.js – Startzustand aus der Adresse und Einbettmodus der Modellseiten
 *
 * Die Seite lädt diese Datei im <head> vor ihrem eigenen Skript. Sie stellt `kmEmbed` bereit:
 *   kmEmbed.state   Startzustand aus der Adresse: t (Date), lat, lon (Grad), view (Name einer Ansicht);
 *                   fehlende oder ungültige Angaben sind null. Gilt auch ohne Einbettmodus, damit der Link
 *                   „Eigene Seite“ denselben Zustand öffnet.
 *   kmEmbed.active  true mit dem Parameter „embed“ (die Seite steckt in einem iframe, siehe modelle.js)
 *   kmEmbed.id      Name des Modells für die Nachrichten an die umgebende Seite (Parameter „id“)
 *   kmEmbed.ready() von der Seite aufzurufen, wenn sie eingerichtet ist
 *
 * Im Einbettmodus:
 *   - Blöcke mit data-embed="hide" (Überschrift, Einleitung, Erklärungen, Ortsformular) werden ausgeblendet;
 *   - Farben hell (theme=light, Standard), dunkel (theme=dark) oder nach dem System (theme=auto);
 *   - die Höhe des Inhalts geht an die umgebende Seite, damit das iframe ohne Scrollbalken passt;
 *   - das Mausrad zoomt erst nach einem Klick ins Bild oder mit Strg, sonst scrollt es die umgebende Seite;
 *   - auf dem Touchscreen bleibt senkrechtes Wischen über einem Bild Scrollen, bis das Bild angetippt wurde.
 * Nachrichten gehen nur an Seiten derselben Herkunft (postMessage mit Ziel '/').
 */
(function () {
    'use strict';

    const params = new URLSearchParams(location.search);
    const active = params.has('embed');
    const id = params.get('id') || '';

    /** Zahl aus der Adresse (Dezimalkomma erlaubt) innerhalb der Grenzen, sonst null */
    function number(name, limit) {
        const text = params.get(name);
        if (text === null || text.trim() === '') return null;
        const value = Number(text.trim().replace(',', '.'));
        return Number.isFinite(value) && Math.abs(value) <= limit ? value : null;
    }

    /** Zeitpunkt: ISO 8601 mit Zeitzone (2026-06-21T10:00Z) oder ohne (dann Ortszeit des Browsers) */
    function time() {
        const text = params.get('t');
        if (!text) return null;
        const date = new Date(text.trim().replace(' ', 'T'));
        return isNaN(date) ? null : date;
    }

    function post(message) {
        if (window.parent === window) return;
        window.parent.postMessage(Object.assign({ source: 'km-model', id }, message), '/');
    }

    const kmEmbed = {
        active,
        id,
        state: {
            t: time(),
            lat: number('lat', 90),
            lon: number('lon', 180),
            view: params.get('view') || null,
        },
        ready() {
            if (active) post({ type: 'ready' });
        },
    };
    window.kmEmbed = kmEmbed;
    if (!active) return;

    const root = document.documentElement;
    root.setAttribute('data-embed', '');
    const theme = params.get('theme') || 'light';
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);

    const style = document.createElement('style');
    style.id = 'km-embed-styles';
    style.textContent = `
        html[data-embed] { overflow: hidden; }
        html[data-embed] [data-embed="hide"] { display: none !important; }
        html[data-embed] body { margin: 0 !important; padding: 0 0 2px !important; max-width: none !important; }
        html[data-embed][data-theme="light"] body { background: transparent !important; }
        html[data-embed]:not(.km-touch-active) canvas { touch-action: pan-y !important; }
        .km-hint {
            position: absolute; z-index: 1000; transform: translate(-50%, -50%);
            max-width: 80%; padding: 7px 12px; border-radius: 6px; text-align: center;
            background: rgba(20, 20, 20, 0.78); color: #fff; font: 14px/1.35 Arial, sans-serif;
            pointer-events: none; opacity: 0; transition: opacity 0.2s;
        }
        .km-hint.show { opacity: 1; }`;
    document.head.appendChild(style);

    // Höhe melden: Unterkante von <body> (ohne die Höhe des iframes selbst, sonst wächst es nur)
    let lastHeight = 0, heightRequested = false;
    function reportHeight() {
        heightRequested = false;
        const body = document.body;
        if (!body) return;
        const height = Math.ceil(body.getBoundingClientRect().bottom + window.scrollY
            + parseFloat(getComputedStyle(body).marginBottom || 0));
        if (height > 0 && Math.abs(height - lastHeight) > 1) {
            lastHeight = height;
            post({ type: 'height', height });
        }
    }
    function requestHeight() {
        if (heightRequested) return;
        heightRequested = true;
        requestAnimationFrame(reportHeight);
    }
    document.addEventListener('DOMContentLoaded', () => {
        new ResizeObserver(requestHeight).observe(document.body);
        requestHeight();
    });
    window.addEventListener('load', requestHeight);

    // Kurzer Hinweis mitten über einem Element
    let hintBox = null, hintTimer = 0;
    function showHint(target, text) {
        if (!hintBox) {
            hintBox = document.createElement('div');
            hintBox.className = 'km-hint';
            hintBox.setAttribute('role', 'status');
            document.body.appendChild(hintBox);
        }
        const rect = target.getBoundingClientRect();
        hintBox.textContent = text;
        hintBox.style.left = (rect.left + window.scrollX + rect.width / 2) + 'px';
        hintBox.style.top = (rect.top + window.scrollY + rect.height / 2) + 'px';
        hintBox.classList.add('show');
        clearTimeout(hintTimer);
        hintTimer = setTimeout(() => hintBox.classList.remove('show'), 1600);
    }

    // Mausrad: erst nach einem Klick in die Seite oder mit Strg an das Bild weitergeben. Sonst erreicht das
    // Ereignis die Seite nicht, und der Browser scrollt die umgebende Seite.
    let wheelArmed = false;
    window.addEventListener('pointerdown', ev => {
        if (ev.pointerType === 'mouse') wheelArmed = true;
    }, true);
    document.addEventListener('mouseout', ev => {
        if (!ev.relatedTarget) wheelArmed = false;     // Maus hat das iframe verlassen
    });
    window.addEventListener('wheel', ev => {
        if (wheelArmed || ev.ctrlKey) return;
        const target = ev.target instanceof Element ? ev.target.closest('canvas') : null;
        if (!target) return;
        ev.stopImmediatePropagation();
        showHint(target, 'Zum Zoomen erst ins Bild klicken (oder Strg + Mausrad)');
    }, { capture: true, passive: true });

    // Touch: Antippen eines Bilds gibt es für alle Richtungen frei (touch-action: none); 4 s nach der letzten
    // Berührung bleibt senkrechtes Wischen wieder Scrollen.
    let touchStart = null, touchTimer = 0, touchHintShown = false;
    window.addEventListener('pointerdown', ev => {
        if (ev.pointerType === 'mouse') return;
        touchStart = { x: ev.clientX, y: ev.clientY, time: ev.timeStamp };
        clearTimeout(touchTimer);
    }, true);
    window.addEventListener('pointerup', ev => {
        if (ev.pointerType === 'mouse' || !touchStart) return;
        const tap = Math.hypot(ev.clientX - touchStart.x, ev.clientY - touchStart.y) < 10
            && ev.timeStamp - touchStart.time < 500;
        touchStart = null;
        const onCanvas = ev.target instanceof Element && ev.target.closest('canvas');
        if (tap && onCanvas) root.classList.add('km-touch-active');
        if (root.classList.contains('km-touch-active')) {
            touchTimer = setTimeout(() => root.classList.remove('km-touch-active'), 4000);
        }
    }, true);
    window.addEventListener('pointercancel', ev => {
        // Der Browser hat das Wischen als Scrollen übernommen
        if (ev.pointerType === 'mouse') return;
        touchStart = null;
        const target = ev.target instanceof Element ? ev.target.closest('canvas') : null;
        if (target && !touchHintShown && !root.classList.contains('km-touch-active')) {
            touchHintShown = true;
            showHint(target, 'Zum Drehen in alle Richtungen erst antippen');
        }
        if (root.classList.contains('km-touch-active')) {
            touchTimer = setTimeout(() => root.classList.remove('km-touch-active'), 4000);
        }
    }, true);
})();
