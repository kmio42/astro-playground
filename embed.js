/*
 * embed.js – Startzustand aus der Adresse und Einbettmodus der Modellseiten
 *
 * Die Seite lädt diese Datei im <head> vor ihrem eigenen Skript. Sie stellt `kmEmbed` bereit:
 *   kmEmbed.state   Startzustand aus der Adresse; fehlende oder ungültige Angaben sind null. Gilt auch ohne
 *                   Einbettmodus, damit der Link „Eigene Seite“ denselben Zustand öffnet.
 *                     t         Zeitpunkt (Date)
 *                     lat, lon  Ort in Grad (Vorgabe, solange der Leser keinen Ort gemerkt hat)
 *                     fixedPlace  true mit „ortfest“: lat/lon gelten auch gegenüber dem gemerkten Ort
 *                     view      Name einer Ansicht
 *                     step      Tourschritt ab 1
 *                     tour      true mit „tour“: Startknopf des Rundgangs zeigen, mit step den Rundgang sofort starten
 *                     tourName  Name eines Rundgangs bei Seiten mit mehreren (tour=nodes), sonst null
 *                     layers    Liste sichtbarer Ebenen (Namen der Seite)
 *                     play      'day', 'month' oder 'year'
 *                     controls  'full' (Standard), 'min' (nur Datum/Uhrzeit), 'none' (nur das Bild)
 *   kmEmbed.active  true mit dem Parameter „embed“ (die Seite steckt in einem iframe, siehe modelle.js)
 *   kmEmbed.id      Name des Modells für die Nachrichten an die umgebende Seite (Parameter „id“)
 *   kmEmbed.ready() von der Seite aufzurufen, wenn sie eingerichtet ist
 *   kmEmbed.usePlace(fallback, apply)
 *                   Ort des Lesers: ruft apply(lat, lon) sofort und bei jeder Änderung auf (anderes Modell oder
 *                   anderer Tab hat einen Ort gemerkt oder vergessen, Eingabe in der Ortszeile). Vorrang:
 *                   ortfest → gemerkter Ort (localStorage latitude/longitude) → lat/lon → fallback {lat, lon}.
 *                   Im Einbettmodus füllt es das Element #kmPlace mit der Ortszeile.
 *   kmEmbed.visible, kmEmbed.onVisibility(fn)
 *                   false, solange das Modell außerhalb des Bildschirms oder der Tab verborgen ist; fn(visible)
 *                   bei jeder Änderung. Animationen sollen dann pausieren.
 *   kmEmbed.fullscreen  true, solange die umgebende Seite das iframe im Vollbild zeigt
 *
 * Im Einbettmodus:
 *   - Blöcke mit data-embed="hide" (Überschrift, Einleitung, Erklärungen, Ortsformular) werden ausgeblendet,
 *     mit controls=min auch Bedienelemente mit data-control="extra", mit controls=none alle mit data-control;
 *   - Farben hell (theme=light, Standard), dunkel (theme=dark) oder nach dem System (theme=auto);
 *   - die Höhe des Inhalts geht an die umgebende Seite, damit das iframe ohne Scrollbalken passt;
 *   - das Mausrad zoomt erst nach einem Klick ins Bild oder mit Strg, sonst scrollt es die umgebende Seite;
 *   - auf dem Touchscreen bleibt senkrechtes Wischen über einem Bild Scrollen, bis das Bild angetippt wurde;
 *   - im Vollbild (Nachricht der umgebenden Seite) scrollt der Inhalt selbst, Mausrad und Touch sind frei.
 * Nachrichten gehen nur an Seiten derselben Herkunft (postMessage mit Ziel '/') und werden nur von dort angenommen.
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

    /** Ein Wort aus einer festen Liste, sonst null */
    function choice(name, allowed) {
        const text = (params.get(name) || '').trim();
        return allowed.includes(text) ? text : null;
    }

    function step() {
        const value = Number(params.get('step'));
        return Number.isInteger(value) && value >= 1 ? value : null;
    }

    function layers() {
        const text = params.get('layers');
        if (text === null) return null;
        return text.split(',').map(x => x.trim()).filter(Boolean);
    }

    /** Breite oder Länge: Dezimalgrad (auch mit Komma) oder 50°06'42"N wie in ui.js; sonst NaN */
    function parseCoordinate(text, limit) {
        if (typeof text !== 'string') return NaN;
        const s = text.trim().replace(',', '.');
        let value = NaN;
        if (/^[-+]?\d+(\.\d+)?$/.test(s)) {
            value = parseFloat(s);
        } else {
            const m = s.match(/^(\d{1,3})°\s*(?:(\d{1,2}(?:\.\d+)?)['′]?\s*)?(?:(\d{1,2}(?:\.\d+)?)["″]?\s*)?([NSEWO])?$/i);
            if (m) {
                value = Number(m[1]) + Number(m[2] || 0) / 60 + Number(m[3] || 0) / 3600;
                if (/[SW]/i.test(m[4] || '')) value = -value;
            }
        }
        return Number.isFinite(value) && Math.abs(value) <= limit ? value : NaN;
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
            fixedPlace: params.has('ortfest'),
            view: params.get('view') || null,
            step: step(),
            tour: params.has('tour'),
            tourName: (params.get('tour') || '').trim() || null,
            layers: layers(),
            play: choice('play', ['day', 'month', 'year']),
            controls: choice('controls', ['full', 'min', 'none']) || 'full',
        },
        ready() {
            if (active) post({ type: 'ready' });
        },
        usePlace,
        visible: true,
        onVisibility(fn) { visibilityListeners.push(fn); },
        fullscreen: false,
    };
    window.kmEmbed = kmEmbed;

    // ---------------------------------------------------------------- Sichtbarkeit

    const visibilityListeners = [];
    let onScreen = true;
    function updateVisibility() {
        const visible = onScreen && !document.hidden;
        if (visible === kmEmbed.visible) return;
        kmEmbed.visible = visible;
        for (const fn of visibilityListeners) fn(visible);
    }
    document.addEventListener('visibilitychange', updateVisibility);
    if (active && 'IntersectionObserver' in window) {
        // Im iframe misst der Beobachter ohne root gegen den Bildschirm der obersten Seite
        document.addEventListener('DOMContentLoaded', () => {
            new IntersectionObserver(entries => {
                onScreen = entries[entries.length - 1].isIntersecting;
                updateVisibility();
            }).observe(document.body);
        });
    }

    // ---------------------------------------------------------------- Ort des Lesers

    function readStored() {
        try {
            const lat = parseCoordinate(localStorage.getItem('latitude'), 90);
            const lon = parseCoordinate(localStorage.getItem('longitude'), 180);
            return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
        } catch (e) {
            return null;        // Speicher gesperrt
        }
    }

    function usePlace(fallback, apply) {
        const given = kmEmbed.state.lat !== null && kmEmbed.state.lon !== null
            ? { lat: kmEmbed.state.lat, lon: kmEmbed.state.lon } : null;
        let ownPlace = !(kmEmbed.state.fixedPlace && given);    // false: Ort laut Text gilt
        let typed = null;                                       // in der Ortszeile eingegeben, nicht gemerkt
        let current = null;

        function resolve() {
            if (!ownPlace) return { ...given, source: 'text' };
            if (typed) return { ...typed, source: 'typed' };
            const stored = readStored();
            if (stored) return { ...stored, source: 'stored' };
            if (given) return { ...given, source: 'given' };
            return { lat: fallback.lat, lon: fallback.lon, source: 'default' };
        }

        function update() {
            const next = resolve();
            const changed = !current || next.lat !== current.lat || next.lon !== current.lon;
            current = next;
            if (changed) apply(current.lat, current.lon);
            if (line) line.render();
        }

        // Ein anderes Dokument derselben Herkunft hat den Ort gemerkt oder vergessen. Die Schlüssel kommen
        // einzeln; erst im nächsten Bildschritt beide lesen.
        let storageRequested = false;
        window.addEventListener('storage', ev => {
            if (ev.key !== null && ev.key !== 'latitude' && ev.key !== 'longitude') return;
            if (storageRequested) return;
            storageRequested = true;
            requestAnimationFrame(() => {
                storageRequested = false;
                typed = null;
                update();
            });
        });

        const line = active ? placeLine({
            get: () => current,
            stored: () => readStored() !== null,
            useOwn() { ownPlace = true; update(); },
            type(lat, lon) { typed = { lat, lon }; update(); },
            // Breiten-Regler: gilt auch gegenüber einem Ort laut Text als eigene Eingabe
            slide(lat) { ownPlace = true; typed = { lat, lon: current.lon }; update(); },
            save(lat, lon) {
                try {
                    localStorage.setItem('latitude', String(lat));
                    localStorage.setItem('longitude', String(lon));
                } catch (e) {
                    return false;
                }
                typed = null;
                ownPlace = true;
                update();
                return true;
            },
            forget() {
                try {
                    localStorage.removeItem('latitude');
                    localStorage.removeItem('longitude');
                } catch (e) { /* gesperrt */ }
                typed = null;
                update();
            },
        }) : null;
        update();
    }

    function formatDegrees(value, positive, negative) {
        const text = Math.abs(value).toFixed(2).replace(/\.?0+$/, '').replace('.', ',');
        return `${text}° ${value < 0 ? negative : positive}`;
    }

    /** Ortszeile „📍 50° N, 10° O · ändern“ mit aufklappbarer Eingabe im Element #kmPlace */
    function placeLine(place) {
        const box = document.getElementById('kmPlace');
        if (!box) return null;
        box.hidden = false;
        box.classList.add('km-place');
        box.innerHTML = `
            <div class="km-place-line"><span class="km-place-text"></span>
                <input type="range" class="km-place-slider" min="-90" max="90" step="0.5" aria-label="Breite">
                <button type="button" class="km-place-own"></button>
                <button type="button" class="km-place-toggle" aria-expanded="false">ändern</button></div>
            <div class="km-place-form" hidden>
                <label>Breite <input type="text" class="km-place-lat" inputmode="decimal" size="9"></label>
                <label>Länge (Ost +) <input type="text" class="km-place-lon" inputmode="decimal" size="9"></label>
                <button type="button" class="km-place-gps">Mein Standort</button>
                <button type="button" class="km-place-save">Ort merken</button>
                <button type="button" class="km-place-forget">Ort vergessen</button>
                <span class="km-place-feedback" role="status"></span>
            </div>`;
        const $ = sel => box.querySelector(sel);
        const form = $('.km-place-form'), toggle = $('.km-place-toggle'), own = $('.km-place-own');
        const latInput = $('.km-place-lat'), lonInput = $('.km-place-lon'), feedback = $('.km-place-feedback');
        const slider = $('.km-place-slider');

        function inputs() {
            const lat = parseCoordinate(latInput.value, 90), lon = parseCoordinate(lonInput.value, 180);
            latInput.classList.toggle('invalid', !Number.isFinite(lat));
            lonInput.classList.toggle('invalid', !Number.isFinite(lon));
            return Number.isFinite(lat) && Number.isFinite(lon) ? { lat, lon } : null;
        }
        function fillInputs() {
            const p = place.get();
            latInput.value = String(p.lat).replace('.', ',');
            lonInput.value = String(p.lon).replace('.', ',');
            inputs();
        }
        function onInput() {
            feedback.textContent = '';
            const p = inputs();
            if (p) place.type(p.lat, p.lon);
        }

        toggle.addEventListener('click', () => {
            const open = form.hidden;
            form.hidden = !open;
            toggle.setAttribute('aria-expanded', String(open));
            if (open) { fillInputs(); feedback.textContent = ''; }
        });
        own.addEventListener('click', () => {
            place.useOwn();
            if (place.get().source !== 'stored') {      // kein gemerkter Ort: Eingabe öffnen
                form.hidden = false;
                toggle.setAttribute('aria-expanded', 'true');
                fillInputs();
            }
        });
        // Regler: höchstens eine Neuberechnung pro Bild; die geöffnete Eingabe zeigt die neue Breite
        let slideFrame = null;
        slider.addEventListener('input', () => {
            if (slideFrame !== null) return;
            slideFrame = requestAnimationFrame(() => {
                slideFrame = null;
                feedback.textContent = '';
                place.slide(Number(slider.value));
                if (!form.hidden) fillInputs();
            });
        });
        latInput.addEventListener('input', onInput);
        lonInput.addEventListener('input', onInput);
        $('.km-place-gps').addEventListener('click', () => {
            if (!navigator.geolocation) { feedback.textContent = 'Standort wird nicht unterstützt'; return; }
            feedback.textContent = 'Standort wird ermittelt …';
            navigator.geolocation.getCurrentPosition(pos => {
                // ungerundet, wie in ui.js
                latInput.value = String(pos.coords.latitude).replace('.', ',');
                lonInput.value = String(pos.coords.longitude).replace('.', ',');
                onInput();
                feedback.textContent = 'Standort übernommen; „Ort merken“ behält ihn für alle Modelle';
            }, err => {
                feedback.textContent = 'Standort nicht ermittelt: ' + err.message;
            });
        });
        $('.km-place-save').addEventListener('click', () => {
            const p = inputs();
            if (!p) { feedback.textContent = 'Breite und Länge prüfen'; return; }
            feedback.textContent = place.save(p.lat, p.lon)
                ? 'Gemerkt – gilt für alle Modelle in diesem Browser' : 'Speichern nicht möglich (Browser sperrt den Speicher)';
        });
        $('.km-place-forget').addEventListener('click', () => {
            place.forget();
            fillInputs();
            feedback.textContent = 'Vergessen';
        });

        return {
            render() {
                const p = place.get();
                const where = `${formatDegrees(p.lat, 'N', 'S')}, ${formatDegrees(p.lon, 'O', 'W')}`;
                const label = { text: 'Ort laut Text', stored: 'Dein Ort', typed: 'Ort' }[p.source] || 'Ort';
                $('.km-place-text').textContent = `📍 ${label}: ${where}`;
                slider.value = p.lat;
                own.hidden = p.source !== 'text';
                own.textContent = 'eigenen Ort verwenden';
                toggle.hidden = p.source === 'text';
                $('.km-place-forget').hidden = !place.stored();
            },
        };
    }

    if (!active) return;

    // ---------------------------------------------------------------- Einbettmodus

    const root = document.documentElement;
    root.setAttribute('data-embed', '');
    const theme = params.get('theme') || 'light';
    if (theme === 'light' || theme === 'dark') root.setAttribute('data-theme', theme);
    root.setAttribute('data-controls', kmEmbed.state.controls);

    const style = document.createElement('style');
    style.id = 'km-embed-styles';
    style.textContent = `
        html[data-embed] { overflow: hidden; }
        html[data-embed].km-fullscreen { overflow: auto; }
        html[data-embed] [data-embed="hide"],
        html[data-controls="min"] [data-control="extra"],
        html[data-controls="none"] [data-control] { display: none !important; }
        html[data-embed] body { margin: 0 !important; padding: 0 0 2px !important; max-width: none !important; }
        html[data-embed].km-fullscreen body { padding: 8px 12px !important; }
        html[data-embed][data-theme="light"]:not(.km-fullscreen) body { background: transparent !important; }
        html[data-embed]:not(.km-touch-active):not(.km-fullscreen) canvas { touch-action: pan-y !important; }
        .km-place { margin: 6px 0; font-size: 0.92em; }
        .km-place[hidden], .km-place [hidden] { display: none !important; }
        .km-place-line { display: flex; flex-wrap: wrap; gap: 4px 10px; align-items: baseline; }
        .km-place-slider { width: min(200px, 40vw); margin: 0; align-self: center; accent-color: var(--accent, #1a5fb4); }
        .km-place-line button { padding: 0; border: 0; background: none; color: var(--accent, #1a5fb4);
            font: inherit; text-decoration: underline; cursor: pointer; }
        .km-place-form { display: flex; flex-wrap: wrap; gap: 6px 10px; align-items: center; margin-top: 6px; }
        .km-place-form input { width: 7.5em; font: inherit; }
        .km-place-form input.invalid { border-color: #c01c28; }
        .km-place-feedback { color: var(--text-2, #555); }
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

    // Vollbild: die umgebende Seite zeigt das iframe auf dem ganzen Bildschirm (modelle.js)
    window.addEventListener('message', ev => {
        if (ev.origin !== location.origin || ev.source !== window.parent) return;
        const data = ev.data;
        if (!data || data.source !== 'km-host' || data.type !== 'fullscreen') return;
        kmEmbed.fullscreen = !!data.on;
        root.classList.toggle('km-fullscreen', kmEmbed.fullscreen);
        window.dispatchEvent(new Event('resize'));
        requestHeight();
    });

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
        if (wheelArmed || ev.ctrlKey || kmEmbed.fullscreen) return;
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
