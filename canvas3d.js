/**
 * canvas3d.js — Hilfen für schematische 3D-Modelle in Canvas 2D (ohne WebGL, läuft auch von file://):
 * Vektoren, Kamera mit fast paralleler Projektion, Zeichenfunktionen, Ziehen/Zoomen, weiche Kamerafahrten
 * und ein Rundgang mit Startknopf, festem Ort und deutscher Uhrzeit.
 *
 * Im Browser: globales Objekt canvas3d. Verwendet von erdbahn3d.html; tagbogen3d.html und himmelsachse3d.html
 * haben noch eigene Fassungen derselben Teile.
 *
 * Koordinaten: rechtshändig, z nach oben. Die Kamera schaut aus Richtung (Azimut az, Höhe el) auf den Zielpunkt;
 * az wird von +y nach +x gezählt, el über der x-y-Ebene, beides in Grad. dist wirkt als Zoom über die Brennweite.
 */
(function (global) {
    'use strict';

    // ---------------------------------------------------------------
    //  Vektoren (Arrays [x, y, z])
    // ---------------------------------------------------------------

    const V = {
        add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
        sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
        scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
        len: a => Math.hypot(a[0], a[1], a[2]),
        norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
        lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
        /** Drehung um die x-Achse um den Winkel a [rad] */
        rotX: (p, a) => [p[0], p[1] * Math.cos(a) - p[2] * Math.sin(a), p[1] * Math.sin(a) + p[2] * Math.cos(a)],
        /** Drehung um die z-Achse um den Winkel a [rad] */
        rotZ: (p, a) => [p[0] * Math.cos(a) - p[1] * Math.sin(a), p[0] * Math.sin(a) + p[1] * Math.cos(a), p[2]],
    };

    /** Farben aus CSS-Variablen der Seite: names ohne „--“ → { name: Wert } */
    function readColors(names) {
        const cs = getComputedStyle(document.documentElement);
        const out = {};
        for (const name of names) out[name] = cs.getPropertyValue('--' + name).trim();
        return out;
    }

    // ---------------------------------------------------------------
    //  Szene: Kamera, Projektion, Zeichnen, Bedienung
    // ---------------------------------------------------------------

    const EYE_DISTANCE = 40;   // weit weg: fast Parallelprojektion, parallele Linien bleiben parallel

    class Scene {
        /**
         * @param canvas Canvas-Element
         * @param opts cam {az, el, dist}, target [x, y, z], aspect (Höhe/Breite), minHeight, maxHeight [px],
         *             zoomScale (Brennweite relativ zur Größe), minDist/maxDist (Zoom), minEl/maxEl [°]
         */
        constructor(canvas, opts = {}) {
            this.canvas = canvas;
            this.ctx = canvas.getContext('2d');
            this.cam = { az: 205, el: 22, dist: 3.6, ...(opts.cam || {}) };
            this.target = opts.target ? [...opts.target] : [0, 0, 0];
            this.aspect = opts.aspect ?? 0.62;
            this.minHeight = opts.minHeight ?? 340;
            this.maxHeight = opts.maxHeight ?? 640;
            this.zoomScale = opts.zoomScale ?? 1.2;
            this.limits = { minDist: opts.minDist ?? 0.3, maxDist: opts.maxDist ?? 12,
                            minEl: opts.minEl ?? -89, maxEl: opts.maxEl ?? 89 };
            this.width = 0;
            this.height = 0;
            this.basis = null;
            this.tween = null;
        }

        /** Canvas an die Breite anpassen (Höhe aus aspect), Auflösung nach devicePixelRatio */
        resize() {
            const dpr = global.devicePixelRatio || 1;
            this.width = this.canvas.clientWidth;
            this.height = Math.round(Math.min(Math.max(this.width * this.aspect, this.minHeight), this.maxHeight));
            this.canvas.style.height = this.height + 'px';
            this.canvas.width = Math.round(this.width * dpr);
            this.canvas.height = Math.round(this.height * dpr);
        }

        /** Kamera aus cam und target berechnen und die Zeichenfläche leeren; vor jedem Zeichnen aufrufen */
        begin() {
            const dpr = global.devicePixelRatio || 1;
            this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
            this.ctx.clearRect(0, 0, this.width, this.height);
            const az = this.cam.az * Math.PI / 180, el = this.cam.el * Math.PI / 180;
            const dir = [Math.cos(el) * Math.sin(az), Math.cos(el) * Math.cos(az), Math.sin(el)];
            const eye = V.add(this.target, V.scale(dir, EYE_DISTANCE));
            const f = V.scale(dir, -1);
            // Blick fast senkrecht nach unten: Bildachsen aus dem Azimut (Grenzwert der schrägen Ansicht)
            const r = Math.abs(el) > 89.5 * Math.PI / 180
                ? [-Math.cos(az), Math.sin(az), 0]
                : V.norm(V.cross(f, [0, 0, 1]));
            const u = V.cross(r, f);
            const focal = this.zoomScale * Math.min(this.width, this.height * 1.3) * EYE_DISTANCE / this.cam.dist;
            this.basis = { eye, f, r, u, focal, toEye: dir };
        }

        /** Bildpunkt [x, y] und Tiefe z (Abstand vor der Kamera) eines Raumpunkts */
        project(p) {
            const b = this.basis;
            const d = V.sub(p, b.eye);
            const z = Math.max(V.dot(d, b.f), 0.05);
            return [this.width / 2 + b.focal * V.dot(d, b.r) / z, this.height / 2 - b.focal * V.dot(d, b.u) / z, z];
        }

        /** Pixel pro Längeneinheit am Punkt p */
        pixelScale(p) {
            return this.basis.focal / Math.max(V.dot(V.sub(p, this.basis.eye), this.basis.f), 0.05);
        }

        /** Liegt p auf der der Kamera zugewandten Seite einer Kugel um center? */
        facing(p, center) {
            return V.dot(V.sub(p, center), this.basis.toEye) >= 0;
        }

        path(points, close = false) {
            const ctx = this.ctx;
            ctx.beginPath();
            points.forEach((p, i) => {
                const s = this.project(p);
                if (i === 0) ctx.moveTo(s[0], s[1]); else ctx.lineTo(s[0], s[1]);
            });
            if (close) ctx.closePath();
        }

        /** Linie; style: { color, width, dash, alpha } */
        stroke(points, { color, width = 1.5, dash = [], alpha = 1 }) {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.strokeStyle = color;
            ctx.lineWidth = width;
            ctx.lineJoin = 'round';
            ctx.lineCap = 'round';
            ctx.setLineDash(dash);
            this.path(points);
            ctx.stroke();
            ctx.restore();
        }

        /** Linie, aufgeteilt in Abschnitte, für die keep(p) gilt (z. B. Vorderseite einer Kugel) */
        strokeWhere(points, keep, style) {
            let run = [];
            for (const p of points) {
                if (keep(p)) run.push(p);
                else { if (run.length > 1) this.stroke(run, style); run = []; }
            }
            if (run.length > 1) this.stroke(run, style);
        }

        fill(points, color, alpha = 1) {
            const ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.fillStyle = color;
            this.path(points, true);
            ctx.fill();
            ctx.restore();
        }

        /** Text mit Rand in der Hintergrundfarben halo, damit er auf Linien lesbar bleibt */
        label(p, text, color, { bold = false, size = 12, align = 'center', baseline = 'middle', dx = 0, dy = 0,
                                alpha = 1, halo = null } = {}) {
            const s = this.project(p), ctx = this.ctx;
            ctx.save();
            ctx.globalAlpha = alpha;
            ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, sans-serif`;
            ctx.textAlign = align;
            ctx.textBaseline = baseline;
            if (halo) {
                ctx.lineJoin = 'round';
                ctx.lineWidth = 3;
                ctx.strokeStyle = halo;
                ctx.strokeText(text, s[0] + dx, s[1] + dy);
            }
            ctx.fillStyle = color;
            ctx.fillText(text, s[0] + dx, s[1] + dy);
            ctx.restore();
        }

        /** Punkt mit Radius in Pixeln */
        dot(p, radius, color, { filled = true, ring = null } = {}) {
            const s = this.project(p), ctx = this.ctx;
            ctx.beginPath();
            ctx.arc(s[0], s[1], radius, 0, 2 * Math.PI);
            if (filled) { ctx.fillStyle = color; ctx.fill(); }
            if (ring || !filled) { ctx.strokeStyle = ring || color; ctx.lineWidth = 1.5; ctx.stroke(); }
        }

        /**
         * Kugel als Scheibe mit Tag- und Nachtseite (Parallelprojektion): center, Radius r (Raumeinheiten),
         * sunDir = Einheitsvektor zur Sonne
         */
        sphere(center, r, sunDir, dayColor, nightColor, outline) {
            const ctx = this.ctx, c = this.project(center), rho = r * this.pixelScale(center);
            ctx.save();
            ctx.beginPath();
            ctx.arc(c[0], c[1], rho, 0, 2 * Math.PI);
            ctx.fillStyle = dayColor;
            ctx.fill();
            // Sonnenrichtung im Bild (Winkel) und zur Kamera hin (sz): die Schattengrenze ist eine Halbellipse
            const b = this.basis;
            const sx = V.dot(sunDir, b.r), sy = -V.dot(sunDir, b.u), sz = V.dot(sunDir, b.toEye);
            ctx.translate(c[0], c[1]);
            ctx.rotate(Math.atan2(sy, sx));
            ctx.beginPath();
            ctx.arc(0, 0, rho, Math.PI / 2, 3 * Math.PI / 2);
            ctx.ellipse(0, 0, Math.max(rho * Math.abs(sz), 0.01), rho, 0, 3 * Math.PI / 2, Math.PI / 2, sz > 0);
            ctx.fillStyle = nightColor;
            ctx.fill();
            ctx.restore();
            if (outline) {
                ctx.beginPath();
                ctx.arc(c[0], c[1], rho, 0, 2 * Math.PI);
                ctx.strokeStyle = outline;
                ctx.lineWidth = 1;
                ctx.stroke();
            }
            return rho;
        }

        /** Weiche Kamerafahrt zu cam {az, el, dist} und/oder target; step() im Animationsschleife aufrufen */
        animateTo({ cam, target }, duration = 700) {
            const from = { cam: { ...this.cam }, target: [...this.target] };
            const to = { cam: { ...this.cam, ...(cam || {}) }, target: target ? [...target] : [...this.target] };
            const dAz = ((to.cam.az - from.cam.az) % 360 + 540) % 360 - 180;   // kürzester Weg
            this.tween = { from, to, dAz, start: performance.now(), duration };
        }

        /** Kamerafahrt fortschreiben; true, solange sie läuft */
        step(now) {
            const t = this.tween;
            if (!t) return false;
            const x = Math.min((now - t.start) / t.duration, 1);
            const e = x < 0.5 ? 2 * x * x : 1 - Math.pow(-2 * x + 2, 2) / 2;
            this.cam.az = t.from.cam.az + t.dAz * e;
            this.cam.el = t.from.cam.el + (t.to.cam.el - t.from.cam.el) * e;
            this.cam.dist = t.from.cam.dist + (t.to.cam.dist - t.from.cam.dist) * e;
            this.target = V.lerp(t.from.target, t.to.target, e);
            if (x >= 1) this.tween = null;
            return true;
        }

        /** Kamerafahrt sofort beenden (Endzustand) */
        finish() {
            if (this.tween) this.step(this.tween.start + this.tween.duration + 1);
        }

        /** Ziehen dreht, Mausrad und zwei Finger zoomen; onChange nach jeder Änderung */
        enableInteraction(onChange) {
            const canvas = this.canvas, lim = this.limits;
            const pointers = new Map();
            let pinch = null;
            canvas.addEventListener('pointerdown', ev => {
                pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
                this.tween = null;
                canvas.setPointerCapture(ev.pointerId);
                canvas.classList.add('dragging');
                if (pointers.size === 2) {
                    const [a, b] = [...pointers.values()];
                    pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), dist: this.cam.dist };
                }
            });
            canvas.addEventListener('pointermove', ev => {
                const prev = pointers.get(ev.pointerId);
                if (!prev) return;
                const cur = { x: ev.clientX, y: ev.clientY };
                pointers.set(ev.pointerId, cur);
                if (pointers.size === 2 && pinch) {
                    const [a, b] = [...pointers.values()];
                    const d = Math.hypot(a.x - b.x, a.y - b.y);
                    this.cam.dist = Math.max(lim.minDist, Math.min(lim.maxDist, pinch.dist * pinch.d / Math.max(d, 1)));
                } else if (pointers.size === 1) {
                    this.cam.az = ((this.cam.az - (cur.x - prev.x) * 0.4) % 360 + 360) % 360;
                    this.cam.el = Math.max(lim.minEl, Math.min(lim.maxEl, this.cam.el + (cur.y - prev.y) * 0.3));
                }
                onChange();
            });
            const end = ev => {
                pointers.delete(ev.pointerId);
                if (pointers.size < 2) pinch = null;
                if (!pointers.size) canvas.classList.remove('dragging');
            };
            canvas.addEventListener('pointerup', end);
            canvas.addEventListener('pointercancel', end);
            canvas.addEventListener('wheel', ev => {
                ev.preventDefault();
                this.cam.dist = Math.max(lim.minDist, Math.min(lim.maxDist, this.cam.dist * Math.exp(ev.deltaY * 0.001)));
                onChange();
            }, { passive: false });
        }
    }

    // ---------------------------------------------------------------
    //  Rundgang mit Startknopf
    // ---------------------------------------------------------------

    /**
     * Rundgänge: Startknöpfe in #tourStart (data-tour = Name), Kasten (#tour) mit #tourTitle, #tourCount,
     * #tourText, #tourBack, #tourNext und einem Knopf zum Beenden. Die Seite liefert:
     *   tours         { name: { title, steps } }, Schritte mit title und text(values) → HTML
     *   apply(step)   Zustand des Schritts einstellen
     *   fixPlace(on)  true: festen Ort und feste Zeitzone setzen (Ort des Lesers merken), false: zurück
     *   placeLabel    Text zum festen Ort für die Kopfzeile
     * Eingebettet (embed.js): Startknöpfe nur mit tour (mit Namen nur dieser), tour mit step startet sofort,
     * step allein stellt nur den Zustand des Schritts ein (ohne Kasten und ohne festen Ort).
     */
    class Tour {
        constructor({ tours, apply, fixPlace, placeLabel = '', onChange = () => {} }) {
            Object.assign(this, { tours, apply, fixPlace, placeLabel, onChange });
            this.name = null;
            this.index = -1;           // -1: kein Rundgang
            this.withBox = false;
            this.showButton = true;
            this.html = '';
            const el = id => document.getElementById(id);
            this.el = { start: el('tourStart'), box: el('tour'), title: el('tourTitle'), count: el('tourCount'),
                        text: el('tourText'), back: el('tourBack'), next: el('tourNext') };
            this.el.back.addEventListener('click', () => this.go(-1));
            this.el.next.addEventListener('click', () => this.go(1));
        }

        get active() { return this.index >= 0; }
        get steps() { return this.name ? this.tours[this.name].steps : []; }
        get step() { return this.active ? this.steps[this.index] : null; }

        /** Rundgang name ab Schritt index (0 = erster); withBox = false stellt nur den Zustand ein */
        start(name, index = 0, withBox = true) {
            if (!this.tours[name]) return;
            if (withBox && !this.withBox) {
                this.fixPlace(true);
                document.body.classList.add('touring');
            }
            this.withBox = this.withBox || withBox;
            this.name = name;
            this.index = Math.min(Math.max(index, 0), this.steps.length - 1);
            this.el.box.hidden = !this.withBox;
            this.el.start.hidden = true;
            this.show();
            // eingebettet nicht scrollen, das würde die umgebende Seite verschieben
            if (withBox && !(global.kmEmbed && global.kmEmbed.active)) {
                this.el.box.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        }

        end() {
            const hadBox = this.withBox;
            this.index = -1;
            this.name = null;
            this.withBox = false;
            this.html = '';
            this.el.box.hidden = true;
            this.el.start.hidden = !this.showButton;
            if (hadBox) {
                document.body.classList.remove('touring');
                this.fixPlace(false);
            }
            this.onChange();
        }

        go(delta) {
            const next = this.index + delta;
            if (next >= this.steps.length) { this.end(); return; }
            this.index = Math.max(0, next);
            this.show();
        }

        show() {
            const step = this.step, n = this.steps.length;
            this.html = '';
            this.apply(step);
            this.el.title.textContent = step.title;
            this.el.count.textContent = `Schritt ${this.index + 1} von ${n}` + (this.withBox && this.placeLabel ? ' · ' + this.placeLabel : '');
            this.el.back.disabled = this.index === 0;
            this.el.next.textContent = this.index === n - 1 ? 'Fertig' : 'Weiter →';
            this.onChange();
        }

        /** Text des Schritts mit den aktuellen Werten; nur neu schreiben, wenn er sich ändert */
        render(values) {
            if (!this.active || !this.withBox) return;
            const html = this.step.text(values);
            if (html !== this.html) {
                this.html = html;
                this.el.text.innerHTML = html;
            }
        }

        /** Startzustand aus embed.js (kmEmbed.state) */
        fromEmbedState(s, embedded) {
            const names = Object.keys(this.tours);
            const name = s.tourName && this.tours[s.tourName] ? s.tourName : null;
            this.showButton = !embedded || s.tour;
            this.el.start.hidden = !this.showButton;
            if (name) {
                for (const b of this.el.start.querySelectorAll('[data-tour]')) b.hidden = b.dataset.tour !== name;
            }
            if (s.step) this.start(name || names[0], s.step - 1, s.tour || !embedded);
        }
    }

    global.canvas3d = { V, Scene, Tour, readColors };
})(typeof window !== 'undefined' ? window : globalThis);
