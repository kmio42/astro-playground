/*
 * Sichtbarkeit von Sonne und Mond von einem Standpunkt aus (Konzept-Sichtbarkeit.md, Stufe 1).
 * Ohne DOM: im Browser nach astro.js laden (alle Namen global), in Node.js über require('./visibility.js').
 *
 * Konventionen (anders als astro.js in Grad, weil alle Werte aus Eingaben stammen und angezeigt werden):
 *  - Richtungen in Grad: Azimut von Norden über Osten [0, 360), Höhe scheinbar (mit Refraktion).
 *  - Zeitpunkte als Julianischer Tag in UT, Beobachtungsort als { longitude, latitude, elevation } wie in astro.js.
 *  - Standpunkt (wie gespeichert):
 *      { name, sectors: [{ azimuthFrom, azimuthTo, altitudeFrom, altitudeTo }],
 *        horizon: [[azimuth, altitude], …], observations: [{ time, body, event }] }
 *    Für die Rechnung wird er mit compileViewpoint() vorbereitet.
 *
 * Sichtbar ist eine Richtung, wenn sie in einem Sichtbereich-Rechteck liegt (oder keine Rechtecke definiert sind)
 * und über der Horizontlinie. Die Horizontlinie verbindet die Punkte linear im Azimut, ringsum geschlossen;
 * ohne Punkte liegt sie bei 0°, mit einem Punkt überall auf dessen Höhe.
 */
(function (root) {
    'use strict';

    const astro = (typeof module !== 'undefined' && module.exports) ? require('./astro.js') : root;
    const { DEG2RAD, RAD2DEG, AU_KM, EARTH_RADIUS, MOON_RADIUS } = astro;

    /** Sichtbarkeit eines Gestirns, aufsteigend geordnet */
    const VisibilityLevel = Object.freeze({
        Below: 0,       // ganz unter dem Horizont 0° und nicht sichtbar
        Hidden: 1,      // über dem Horizont 0°, aber verdeckt
        Partial: 2,     // nur ein Teil der Scheibe sichtbar, Mittelpunkt verdeckt
        Visible: 3,     // Mittelpunkt sichtbar
    });

    // Sonnenhöhe, unter der der Mond mit der Option requireDark als sichtbar gilt [°]
    const DARK_SUN_ALTITUDE = -6;

    // Winkel in Grad auf [0, 360)
    function wrap360(deg) {
        return ((deg % 360) + 360) % 360;
    }

    // ---------------------------------------------------------------
    //  Maske
    // ---------------------------------------------------------------

    /**
     * Liegt der Azimut im Bereich von from im Uhrzeigersinn bis to? Bereiche über Nord (300° bis 30°) sind erlaubt;
     * sind from und to gleich (z. B. 0° und 360°), gilt der ganze Kreis.
     */
    function azimuthInRange(azimuth, from, to) {
        const span = wrap360(to - from);
        return span === 0 || wrap360(azimuth - from) <= span;
    }

    /**
     * Standpunkt für die Rechnung vorbereiten: Horizontpunkte sortiert, kleinste sichtbare Höhe für die
     * schnelle Vorprüfung.
     */
    function compileViewpoint(viewpoint) {
        const horizon = (viewpoint.horizon || [])
            .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
            .map(p => [wrap360(p[0]), p[1]])
            .sort((p, q) => p[0] - q[0]);
        const sectors = (viewpoint.sectors || []).filter(s =>
            [s.azimuthFrom, s.azimuthTo, s.altitudeFrom, s.altitudeTo].every(Number.isFinite));

        // Unter dieser Höhe ist nichts sichtbar [°]
        let minAltitude = horizon.length ? Math.min(...horizon.map(p => p[1])) : 0;
        if (sectors.length) {
            minAltitude = Math.max(minAltitude, Math.min(...sectors.map(s => Math.min(s.altitudeFrom, s.altitudeTo))));
        }
        return { compiled: true, name: viewpoint.name, horizon, sectors, minAltitude };
    }

    function compiled(viewpoint) {
        return viewpoint.compiled ? viewpoint : compileViewpoint(viewpoint);
    }

    /** Höhe der Horizontlinie im Azimut [°] */
    function horizonAltitude(viewpoint, azimuth) {
        const pts = compiled(viewpoint).horizon;
        const n = pts.length;
        if (n === 0) return 0;
        if (n === 1) return pts[0][1];
        const A = wrap360(azimuth);

        // Nachbarpunkte p (davor) und q (danach), über Nord hinweg geschlossen
        let p, q;
        if (A < pts[0][0] || A >= pts[n - 1][0]) {
            p = pts[n - 1];
            q = pts[0];
        } else {
            let lo = 0, hi = n - 1;           // pts[lo][0] ≤ A < pts[hi][0]
            while (hi - lo > 1) {
                const mid = (lo + hi) >> 1;
                if (pts[mid][0] <= A) lo = mid; else hi = mid;
            }
            p = pts[lo];
            q = pts[hi];
        }
        const span = wrap360(q[0] - p[0]);
        if (span === 0) return Math.max(p[1], q[1]);
        return p[1] + (q[1] - p[1]) * wrap360(A - p[0]) / span;
    }

    /** Ist die Richtung (Azimut, scheinbare Höhe) [°] vom Standpunkt aus frei? */
    function isDirectionVisible(viewpoint, azimuth, altitude) {
        const vp = compiled(viewpoint);
        if (altitude <= horizonAltitude(vp, azimuth)) return false;
        if (vp.sectors.length === 0) return true;
        return vp.sectors.some(s =>
            altitude >= Math.min(s.altitudeFrom, s.altitudeTo) && altitude <= Math.max(s.altitudeFrom, s.altitudeTo)
            && azimuthInRange(azimuth, s.azimuthFrom, s.azimuthTo));
    }

    // ---------------------------------------------------------------
    //  Richtung von Sonne und Mond
    // ---------------------------------------------------------------

    /** Scheinbare Höhe aus der wahren Höhe [°] (Refraktion nach Formel 15.4) */
    function apparentAltitude(trueAltitude) {
        return trueAltitude + astro.calculateRefraction(trueAltitude * DEG2RAD) * RAD2DEG;
    }

    // Azimut von Süden (Meeus) [rad] → von Norden [°]
    function azimuthFromNorth(azimuthSouth) {
        return wrap360(azimuthSouth * RAD2DEG + 180);
    }

    /**
     * Richtung zur Sonne.
     * @return { azimuth, trueAltitude, altitude (scheinbar), radius (Halbmesser) } [°]
     */
    function sunDirection(jd, location) {
        const sun = astro.calculateSunPosition(jd);
        const equ = astro.calculateEquatorial(sun, astro.calculateObliquity(jd));
        const hor = astro.calculateHorizontal(equ, astro.calculateLocalSiderealTime(jd, location), location);
        const trueAltitude = hor.altitude * RAD2DEG;
        return {
            azimuth: azimuthFromNorth(hor.azimuth),
            trueAltitude,
            altitude: apparentAltitude(trueAltitude),
            radius: 959.63 / 3600 / (sun.distance / AU_KM),     // Halbmesser 959,63″ in 1 AE
        };
    }

    // Geozentrische Mond- und Sonnenwerte zu einem Zeitpunkt
    function moonNode(jd) {
        const moon = astro.calculateMoonPosition(jd);
        const sun = astro.calculateSunPosition(jd);
        const eps = astro.calculateObliquity(jd);
        const moonEqu = astro.calculateEquatorial(moon, eps);
        const sunEqu = astro.calculateEquatorial(sun, eps);
        return {
            ra: moonEqu.ra,
            dec: moonEqu.dec,
            distance: moon.distance,
            illuminated: astro.calculateMoonIlluminatedFraction(sunEqu, sun.distance, moonEqu, moon.distance),
            elongation: wrap360((moon.longitude - sun.longitude) * RAD2DEG),    // 0° Neumond, 180° Vollmond
        };
    }

    /**
     * Stündliche Stützstellen des Mondes für jdStart … jdEnd (wie in cpp/Plan-Mondaufgang.md):
     * calculateMoonPosition nur einmal pro Stunde, dazwischen Interpolation nach Formel 3.3.
     */
    function createMoonEphemeris(jdStart, jdEnd) {
        const step = 1 / 24;
        const t0 = Math.floor(jdStart * 24) / 24 - step;
        const n = Math.ceil((jdEnd - t0) / step) + 2;
        const eph = {
            t0, step, n,
            ra: new Float64Array(n), dec: new Float64Array(n), distance: new Float64Array(n),
            illuminated: new Float64Array(n), elongation: new Float64Array(n),
        };
        for (let k = 0; k < n; k++) {
            const node = moonNode(t0 + k * step);
            // RA stetig fortsetzen (kein Sprung bei 360°)
            eph.ra[k] = k === 0 ? node.ra : eph.ra[k - 1] + astro.normalizeAngleSigned(node.ra - eph.ra[k - 1]);
            eph.dec[k] = node.dec;
            eph.distance[k] = node.distance;
            eph.illuminated[k] = node.illuminated;
            eph.elongation[k] = node.elongation;
        }
        return eph;
    }

    // Wert aus den Stützstellen zum Zeitpunkt jd; null außerhalb
    function ephemerisValue(eph, values, jd) {
        const x = (jd - eph.t0) / eph.step;
        const i = Math.round(x);
        if (i < 1 || i > eph.n - 2) return null;
        return astro.interpolate(values[i - 1], values[i], values[i + 1], x - i);
    }

    /**
     * Richtung zum Mond, topozentrisch (Parallaxe bis 1°).
     * @param eph Stützstellen aus createMoonEphemeris (optional; ohne sie wird direkt gerechnet)
     * @return { azimuth, trueAltitude, altitude (scheinbar), radius, illuminatedFraction [0..1], waxing } [°]
     */
    function moonDirection(jd, location, eph) {
        let ra = eph ? ephemerisValue(eph, eph.ra, jd) : null;
        let dec, distance, illuminated, elongation;
        if (ra === null) {
            const node = moonNode(jd);
            ({ ra, dec, distance, illuminated, elongation } = node);
        } else {
            dec = ephemerisValue(eph, eph.dec, jd);
            distance = ephemerisValue(eph, eph.distance, jd);
            illuminated = ephemerisValue(eph, eph.illuminated, jd);
            elongation = eph.elongation[Math.round((jd - eph.t0) / eph.step)];
        }
        const theta = astro.calculateLocalSiderealTime(jd, location);
        const parallax = Math.asin(EARTH_RADIUS / distance);
        const topo = astro.calculateTopocentric({ ra, dec }, parallax, theta, location);
        const hor = astro.calculateHorizontal(topo, theta, location);
        const trueAltitude = hor.altitude * RAD2DEG;
        return {
            azimuth: azimuthFromNorth(hor.azimuth),
            trueAltitude,
            altitude: apparentAltitude(trueAltitude),
            radius: Math.asin(MOON_RADIUS / distance) * RAD2DEG,
            illuminatedFraction: Math.min(1, Math.max(0, illuminated)),
            waxing: elongation < 180,
        };
    }

    /** Vollmonde (Elongation 180°) im Bereich der Stützstellen, linear zwischen den Stunden [jd] */
    function findFullMoons(eph) {
        const result = [];
        for (let k = 1; k < eph.n; k++) {
            const e0 = eph.elongation[k - 1], e1 = eph.elongation[k];
            if (e0 < 180 && e1 >= 180) {
                result.push(eph.t0 + (k - 1 + (180 - e0) / (e1 - e0)) * eph.step);
            }
        }
        return result;
    }

    // ---------------------------------------------------------------
    //  Sichtbarkeit der Scheibe
    // ---------------------------------------------------------------

    /**
     * Sichtbarkeit einer Scheibe (Sonne, Mond) von einem Standpunkt aus. Geprüft werden Mittelpunkt und vier
     * Randpunkte (oben, unten, links, rechts).
     * @param dir Richtung aus sunDirection/moonDirection
     * @return VisibilityLevel
     */
    function visibilityLevel(dir, viewpoint) {
        const vp = compiled(viewpoint);
        const topTrue = dir.trueAltitude + dir.radius;
        // Schnelle Vorprüfung: Oberrand mit größter Refraktion (≈ 39′) unter allem Sichtbaren
        if (topTrue + 0.7 < Math.min(0, vp.minAltitude)) return VisibilityLevel.Below;

        const A = dir.azimuth;
        const h = dir.altitude;
        if (isDirectionVisible(vp, A, h)) return VisibilityLevel.Visible;

        const top = apparentAltitude(topTrue);
        const bottom = apparentAltitude(dir.trueAltitude - dir.radius);
        const dA = dir.radius / Math.max(Math.cos(h * DEG2RAD), 1e-3);
        if (isDirectionVisible(vp, A, top) || isDirectionVisible(vp, A, bottom)
            || isDirectionVisible(vp, A - dA, h) || isDirectionVisible(vp, A + dA, h)) {
            return VisibilityLevel.Partial;
        }
        return top > 0 ? VisibilityLevel.Hidden : VisibilityLevel.Below;
    }

    // Auswertung zu einem Zeitpunkt: Richtung, Sichtbarkeit je Standpunkt und insgesamt (Maximum)
    function makeEvaluator(body, location, viewpoints, options) {
        const vps = viewpoints.map(compiled);
        const eph = body === 'moon' ? options.ephemeris : null;
        const requireDark = body === 'moon' && options.requireDark;
        return function evaluate(jd) {
            const dir = body === 'sun' ? sunDirection(jd, location) : moonDirection(jd, location, eph);
            const levels = vps.map(vp => visibilityLevel(dir, vp));
            if (requireDark && sunDirection(jd, location).trueAltitude > DARK_SUN_ALTITUDE) {
                // Am hellen Himmel gilt der Mond als verdeckt
                for (let i = 0; i < levels.length; i++) levels[i] = Math.min(levels[i], VisibilityLevel.Hidden);
            }
            return { jd, dir, levels, level: Math.max(...levels) };
        };
    }

    // Grenze zwischen t0 und t1 per Bisektion, an der test(evaluate(t)) wechselt; Genauigkeit ≈ 1 s
    function refineBoundary(evaluate, t0, t1, test) {
        const v0 = test(evaluate(t0));
        while (t1 - t0 > 1 / 86400) {
            const tm = (t0 + t1) / 2;
            if (test(evaluate(tm)) === v0) t0 = tm; else t1 = tm;
        }
        return (t0 + t1) / 2;
    }

    // ---------------------------------------------------------------
    //  Zeitsuche
    // ---------------------------------------------------------------

    /**
     * Zeiträume, in denen ein Gestirn (mindestens teilweise) sichtbar ist.
     * Abgetastet in Schritten von options.stepMinutes (Standard 2 min), Grenzen per Bisektion auf ≈ 1 s.
     * @param body 'sun' oder 'moon'
     * @param viewpoints Liste von Standpunkten; sichtbar heißt: von mindestens einem aus
     * @param options { stepMinutes, requireDark (nur Mond: Sonne unter −6°), ephemeris (nur Mond) }
     * @return Liste von Intervallen:
     *   { body, start, end [jd], duration [min], entry, exit { azimuth, altitude } [°], maxAltitude [°],
     *     centerStart, centerEnd [jd] (Mittelpunkt sichtbar, sonst null), viewpoints [Namen],
     *     startsBefore, endsAfter (Intervall reicht über den Suchbereich hinaus),
     *     illuminatedFraction, waxing (nur Mond, zum Zeitpunkt der größten Höhe) }
     */
    function findVisibilityIntervals(body, jdStart, jdEnd, location, viewpoints, options = {}) {
        const step = (options.stepMinutes || 2) / 1440;
        const opts = { ...options };
        if (body === 'moon' && !opts.ephemeris) opts.ephemeris = createMoonEphemeris(jdStart - 0.1, jdEnd + 0.1);
        const evaluate = makeEvaluator(body, location, viewpoints, opts);
        const names = viewpoints.map(v => v.name);

        const seen = s => s.level >= VisibilityLevel.Partial;
        const centerSeen = s => s.level === VisibilityLevel.Visible;

        const intervals = [];
        let current = null;

        const open = (start, s, startsBefore) => {
            current = { body, start, startsBefore, centerStart: null, centerEnd: null,
                        maxAltitude: -90, maxSample: s, seenBy: new Set() };
        };
        const note = (s) => {
            s.levels.forEach((l, i) => { if (l >= VisibilityLevel.Partial) current.seenBy.add(names[i]); });
            if (s.dir.altitude > current.maxAltitude) {
                current.maxAltitude = s.dir.altitude;
                current.maxSample = s;
            }
        };
        const close = (end, endsAfter) => {
            const entry = evaluate(current.start).dir;
            const exit = evaluate(end).dir;
            const interval = {
                body, start: current.start, end, duration: (end - current.start) * 1440,
                entry: { azimuth: entry.azimuth, altitude: entry.altitude },
                exit: { azimuth: exit.azimuth, altitude: exit.altitude },
                maxAltitude: Math.max(current.maxAltitude, entry.altitude, exit.altitude),
                centerStart: current.centerStart, centerEnd: current.centerEnd,
                viewpoints: names.filter(n => current.seenBy.has(n)),
                startsBefore: current.startsBefore, endsAfter,
            };
            if (body === 'moon') {
                interval.illuminatedFraction = current.maxSample.dir.illuminatedFraction;
                interval.waxing = current.maxSample.dir.waxing;
            }
            intervals.push(interval);
            current = null;
        };

        let prev = evaluate(jdStart);
        if (seen(prev)) {
            open(jdStart, prev, true);
            note(prev);
            if (centerSeen(prev)) current.centerStart = jdStart;
        }
        for (let t = jdStart + step; prev.jd < jdEnd; t += step) {
            const s = evaluate(Math.min(t, jdEnd));
            if (!current && seen(s)) {
                open(refineBoundary(evaluate, prev.jd, s.jd, seen), s, false);
            }
            if (current) {
                // Mittelpunkt wird sichtbar bzw. verschwindet
                if (centerSeen(s) && !centerSeen(prev) && current.centerStart === null) {
                    current.centerStart = refineBoundary(evaluate, prev.jd, s.jd, centerSeen);
                }
                if (!centerSeen(s) && centerSeen(prev)) {
                    current.centerEnd = refineBoundary(evaluate, prev.jd, s.jd, centerSeen);
                }
                if (centerSeen(s)) current.centerEnd = null;    // noch sichtbar, Ende offen
                if (seen(s)) {
                    note(s);
                } else {
                    close(refineBoundary(evaluate, prev.jd, s.jd, seen), false);
                }
            }
            prev = s;
        }
        if (current) {
            if (centerSeen(prev) && current.centerStart !== null) current.centerEnd = jdEnd;
            close(jdEnd, true);
        }
        // Mittelpunkt bis zum Ende sichtbar: Ende des Intervalls
        for (const iv of intervals) {
            if (iv.centerStart !== null && iv.centerEnd === null) iv.centerEnd = iv.end;
        }
        return intervals;
    }

    /**
     * Sichtbarkeit als Raster: eine Zeile pro Tag ab dayStarts[i], stepMinutes pro Spalte über 24 h.
     * Für die Jahres-Heatmap.
     * @return { slots, levels: Uint8Array(dayStarts.length · slots) } mit VisibilityLevel je Zelle (Zellmitte)
     */
    function computeLevelGrid(body, dayStarts, stepMinutes, location, viewpoints, options = {}) {
        const slots = Math.round(1440 / stepMinutes);
        const opts = { ...options };
        if (body === 'moon' && !opts.ephemeris && dayStarts.length) {
            opts.ephemeris = createMoonEphemeris(Math.min(...dayStarts), Math.max(...dayStarts) + 1);
        }
        const evaluate = makeEvaluator(body, location, viewpoints, opts);
        const levels = new Uint8Array(dayStarts.length * slots);
        dayStarts.forEach((day, d) => {
            for (let k = 0; k < slots; k++) {
                levels[d * slots + k] = evaluate(day + (k + 0.5) * stepMinutes / 1440).level;
            }
        });
        return { slots, levels };
    }

    /**
     * Sichtbarkeit als Zeitreihe von jdStart bis jdEnd in Schritten von stepMinutes (Zellmitte).
     * Für die Tageszeitleiste; der Bereich darf von 24 h abweichen (Tage mit Zeitumstellung).
     * @return { step [d], levels: Uint8Array } mit VisibilityLevel je Schritt
     */
    function computeLevelSeries(body, jdStart, jdEnd, stepMinutes, location, viewpoints, options = {}) {
        const step = stepMinutes / 1440;
        const n = Math.max(0, Math.ceil((jdEnd - jdStart) / step - 1e-9));
        const opts = { ...options };
        if (body === 'moon' && !opts.ephemeris) opts.ephemeris = createMoonEphemeris(jdStart, jdEnd);
        const evaluate = makeEvaluator(body, location, viewpoints, opts);
        const levels = new Uint8Array(n);
        for (let k = 0; k < n; k++) {
            levels[k] = evaluate(Math.min(jdStart + (k + 0.5) * step, jdEnd)).level;
        }
        return { step, levels };
    }

    /**
     * Beobachtung → Richtung (Azimut, scheinbare Höhe) [°] des Scheibenmittelpunkts. Beobachtet wird meist der
     * Rand („verschwand“); der Unterschied beträgt höchstens den Halbmesser (≈ 0,27°).
     * @param observation { time (ISO-Zeitstempel), body: 'sun' | 'moon' }
     */
    function observationDirection(observation, location) {
        const jd = astro.julianDayFromDate(new Date(observation.time));
        if (!Number.isFinite(jd)) return null;
        const dir = observation.body === 'moon' ? moonDirection(jd, location) : sunDirection(jd, location);
        return { azimuth: dir.azimuth, altitude: dir.altitude };
    }

    // ---------------------------------------------------------------
    //  Export: im Browser global, in Node.js über module.exports
    // ---------------------------------------------------------------

    const api = {
        VisibilityLevel,
        azimuthInRange, compileViewpoint, horizonAltitude, isDirectionVisible,
        apparentAltitude, sunDirection, moonDirection, createMoonEphemeris, findFullMoons,
        visibilityLevel, findVisibilityIntervals, computeLevelGrid, computeLevelSeries, observationDirection,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
