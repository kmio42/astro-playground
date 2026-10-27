/*
 * orbit3d.js – Geometrie von Erde, Mond und Sonne für das 3D-Modell (ErdeMond3D.html)
 *
 * Konzept: Konzept-ErdeMond3D.md. DOM-frei wie astro.js: im Browser sind alle öffentlichen Namen global,
 * in Node.js kommen sie aus require('./orbit3d.js'). Benötigt astro.js (im Browser vorher laden).
 *
 * Koordinatensystem: geozentrisch, Ekliptik und mittleres Äquinoktium des Datums, x zum Frühlingspunkt,
 * z zum Ekliptik-Nordpol, Einheit Erdradius (EARTH_RADIUS). Winkel in Radiant, Zeit als Julianischer Tag (UT).
 *
 * Drehmatrizen sind Arrays mit 9 Zahlen, zeilenweise: [m00, m01, m02, m10, ...]. Sie bilden Körperachsen auf
 * Ekliptik-Koordinaten ab. Körperachsen: x zu Länge 0°/Breite 0°, y zu Länge 90° Ost, z zum Nordpol.
 */
(function (global) {
    'use strict';

    const astro = (typeof module !== 'undefined' && module.exports) ? require('./astro.js') : global;
    const { DEG2RAD, EARTH_RADIUS, MOON_RADIUS, MOON_ORBIT_RADIUS } = astro;

    // Neigung der mittleren Mondbahn gegen die Ekliptik
    const MOON_INCLINATION = 5.145396 * DEG2RAD;
    // Mittlere Exzentrizität der Mondbahn
    const MOON_ECCENTRICITY = 0.0549;
    // Mondradius in Erdradien
    const MOON_RADIUS_ER = MOON_RADIUS / EARTH_RADIUS;
    // Mittlere Länge des synodischen Monats [d]
    const SYNODIC_MONTH = 29.530588861;
    // Sonnenradius in Erdradien
    const SUN_RADIUS_ER = 696000 / EARTH_RADIUS;
    // Vergrößerung des Erdschattens durch die Atmosphäre (Chauvenet, 1/50)
    const SHADOW_ENLARGEMENT = 1.02;

    // ---------------------------------------------------------------
    //  Vektoren und Matrizen
    // ---------------------------------------------------------------

    /** Kugelkoordinaten (Länge, Breite, Radius) → rechtwinklig */
    function sphericalToVector(lon, lat, r) {
        const c = Math.cos(lat);
        return [r * c * Math.cos(lon), r * c * Math.sin(lon), r * Math.sin(lat)];
    }

    /** Rechtwinklig → { longitude [0, 2π), latitude, radius } */
    function vectorToSpherical(v) {
        const r = Math.hypot(v[0], v[1], v[2]);
        return {
            longitude: astro.normalizeAngle(Math.atan2(v[1], v[0])),
            latitude: Math.asin(Math.max(-1, Math.min(1, v[2] / r))),
            radius: r,
        };
    }

    function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
    function cross(a, b) {
        return [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
    }
    function scale(a, s) { return [a[0] * s, a[1] * s, a[2] * s]; }
    function add(a, b) { return [a[0] + b[0], a[1] + b[1], a[2] + b[2]]; }
    function sub(a, b) { return [a[0] - b[0], a[1] - b[1], a[2] - b[2]]; }
    function normalize(a) { return scale(a, 1 / Math.hypot(a[0], a[1], a[2])); }

    /** Matrix (zeilenweise, 3×3) mal Vektor */
    function applyRotation(m, v) {
        return [m[0] * v[0] + m[1] * v[1] + m[2] * v[2],
                m[3] * v[0] + m[4] * v[1] + m[5] * v[2],
                m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
    }

    /** Transponierte Matrix mal Vektor (Rückrichtung einer Drehung) */
    function applyRotationInverse(m, v) {
        return [m[0] * v[0] + m[3] * v[1] + m[6] * v[2],
                m[1] * v[0] + m[4] * v[1] + m[7] * v[2],
                m[2] * v[0] + m[5] * v[1] + m[8] * v[2]];
    }

    /** Matrix aus drei Spaltenvektoren */
    function matrixFromColumns(x, y, z) {
        return [x[0], y[0], z[0], x[1], y[1], z[1], x[2], y[2], z[2]];
    }

    /** Äquatoriale Koordinaten → Ekliptik (Drehung um x um ε) */
    function equatorialToEcliptic(v, eps) {
        const c = Math.cos(eps), s = Math.sin(eps);
        return [v[0], c * v[1] + s * v[2], -s * v[1] + c * v[2]];
    }

    /**
     * Unterpunkt einer Richtung auf einem Körper: Länge (Ost positiv, (−π, π]) und Breite des Punktes,
     * über dem die Richtung im Zenit steht.
     * @param rotation Drehmatrix Körper → Ekliptik
     * @param direction Richtung in Ekliptik-Koordinaten (muss nicht normiert sein)
     */
    function subPoint(rotation, direction) {
        const s = vectorToSpherical(applyRotationInverse(rotation, direction));
        return { longitude: astro.normalizeAngleSigned(s.longitude), latitude: s.latitude };
    }

    // ---------------------------------------------------------------
    //  Orientierung der Körper
    // ---------------------------------------------------------------

    /**
     * Drehung der Erde: Achse um ε gegen den Ekliptikpol geneigt (zur Länge 90°), Nullmeridian in Richtung
     * der Rektaszension θ0 (mittlere Greenwich-Sternzeit). Nutation wird vernachlässigt.
     */
    function earthRotation(jd) {
        const eps = astro.calculateObliquity(jd);
        const theta = astro.calculateGreenwichSiderealTime(jd);
        const ct = Math.cos(theta), st = Math.sin(theta);
        const x = equatorialToEcliptic([ct, st, 0], eps);
        const y = equatorialToEcliptic([-st, ct, 0], eps);
        const z = equatorialToEcliptic([0, 0, 1], eps);
        return matrixFromColumns(x, y, z);
    }

    /**
     * Drehung des Mondes aus Libration (l, b) und Positionswinkel P der Achse (calculateMoonOrientation):
     * Der selenografische Punkt (l, b) zeigt zur Erde, die Achse erscheint am Himmel unter dem
     * Positionswinkel P (von Nord über Ost).
     * @param jd Julianischer Tag
     * @param moon Position aus calculateMoonPosition (optional)
     */
    function moonRotation(jd, moon) {
        moon = moon || astro.calculateMoonPosition(jd);
        const eps = astro.calculateObliquity(jd);
        const orientation = astro.calculateMoonOrientation(jd, moon);
        const l = orientation.libration.longitude;
        const b = orientation.libration.latitude;
        const P = orientation.positionAngle;
        const equ = astro.calculateEquatorial(moon, eps);
        const ca = Math.cos(equ.ra), sa = Math.sin(equ.ra);
        const cd = Math.cos(equ.dec), sd = Math.sin(equ.dec);
        // Richtung Mond → Erde, Nord- und Ostrichtung am Himmel (äquatorial)
        const e = [-cd * ca, -cd * sa, -sd];
        const north = [-sd * ca, -sd * sa, cd];
        const east = [-sa, ca, 0];
        const pole = add(scale(e, Math.sin(b)),
                         scale(add(scale(north, Math.cos(P)), scale(east, Math.sin(P))), Math.cos(b)));
        const h = normalize(sub(e, scale(pole, Math.sin(b))));
        const k = cross(pole, h);
        const x = sub(scale(h, Math.cos(l)), scale(k, Math.sin(l)));
        const y = cross(pole, x);
        return matrixFromColumns(equatorialToEcliptic(x, eps), equatorialToEcliptic(y, eps),
                                 equatorialToEcliptic(pole, eps));
    }

    // ---------------------------------------------------------------
    //  Zustand der Szene
    // ---------------------------------------------------------------

    /** Position des Mondes in Erdradien (Ekliptik) */
    function moonVector(moon) {
        return sphericalToVector(moon.longitude, moon.latitude, moon.distance / EARTH_RADIUS);
    }

    /**
     * Alles, was die Szene zu einem Zeitpunkt braucht.
     * @return {
     *   jd, obliquity,
     *   sun:   { longitude, distance [km], position [Erdradien], direction (Einheitsvektor von der Erde) },
     *   moon:  { longitude, latitude, distance [km], position [Erdradien], rotation, libration, positionAngle,
     *            illuminatedFraction, elongation, phaseAngle (Mondphase als Längendifferenz Mond − Sonne [0, 2π)) },
     *   earth: { rotation },
     *   meanNode (Länge des mittleren aufsteigenden Knotens)
     * }
     */
    function sceneState(jd) {
        const eps = astro.calculateObliquity(jd);
        const sun = astro.calculateSunPosition(jd);
        const moon = astro.calculateMoonPosition(jd);
        const sunPos = sphericalToVector(sun.longitude, sun.latitude, sun.distance / EARTH_RADIUS);
        const moonPos = moonVector(moon);
        const orientation = astro.calculateMoonOrientation(jd, moon);
        const sunEqu = astro.calculateEquatorial(sun, eps);
        const moonEqu = astro.calculateEquatorial(moon, eps);
        const cosElong = dot(normalize(sunPos), normalize(moonPos));
        return {
            jd: jd,
            obliquity: eps,
            sun: {
                longitude: sun.longitude,
                distance: sun.distance,
                position: sunPos,
                direction: normalize(sunPos),
            },
            moon: {
                longitude: moon.longitude,
                latitude: moon.latitude,
                distance: moon.distance,
                position: moonPos,
                rotation: moonRotation(jd, moon),
                libration: orientation.libration,
                positionAngle: orientation.positionAngle,
                illuminatedFraction: astro.calculateMoonIlluminatedFraction(sunEqu, sun.distance, moonEqu, moon.distance),
                elongation: Math.acos(Math.max(-1, Math.min(1, cosElong))),
                phaseAngle: astro.normalizeAngle(moon.longitude - sun.longitude),
            },
            earth: {
                rotation: earthRotation(jd),
            },
            meanNode: astro.calculateMoonAscendingNode(jd),
        };
    }

    // ---------------------------------------------------------------
    //  Bahn
    // ---------------------------------------------------------------

    /**
     * Wahre Mondbahn zwischen zwei Zeitpunkten.
     * @param stepHours Schrittweite [h]
     * @return [{ jd, position [Erdradien], latitude, distance [km] }]
     */
    function moonPath(jd0, jd1, stepHours) {
        const n = Math.max(1, Math.round((jd1 - jd0) * 24 / stepHours));
        const points = [];
        for (let i = 0; i <= n; i++) {
            const jd = jd0 + (jd1 - jd0) * i / n;
            const moon = astro.calculateMoonPosition(jd);
            points.push({ jd: jd, position: moonVector(moon), latitude: moon.latitude, distance: moon.distance });
        }
        return points;
    }

    /**
     * Mittlere Bahnelemente des Mondes (Kapitel 47): Knoten Ω (Formel 45.7), Länge des Perigäums
     * ϖ = L′ − M′, feste Neigung und Exzentrizität, große Halbachse = mittlere Entfernung.
     * @return { node, inclination, eccentricity, semiMajorAxis [km], perigeeLongitude, normal (Bahnpol) }
     */
    function meanMoonOrbit(jd) {
        const T = (astro.dynamicalTime(jd) - 2451545.0) / 36525.0;
        // L′ − M′ aus Formel 47.1 und 47.4
        const Lp = 218.3164477 + 481267.88123421 * T - 0.0015786 * T * T + T * T * T / 538841 - T * T * T * T / 65194000;
        const Mp = 134.9633964 + 477198.8675055 * T + 0.0087414 * T * T + T * T * T / 69699 - T * T * T * T / 14712000;
        const node = astro.calculateMoonAscendingNode(jd);
        const i = MOON_INCLINATION;
        return {
            node: node,
            inclination: i,
            eccentricity: MOON_ECCENTRICITY,
            semiMajorAxis: MOON_ORBIT_RADIUS,
            perigeeLongitude: astro.normalizeAngle((Lp - Mp) * DEG2RAD),
            normal: [Math.sin(i) * Math.sin(node), -Math.sin(i) * Math.cos(node), Math.cos(i)],
        };
    }

    /**
     * Punkt der Bahnellipse zur wahren Anomalie ν, in Erdradien.
     * Die Länge des Perigäums ϖ = Ω + ω wird wie üblich als „geknickter“ Winkel gezählt.
     */
    function ellipsePoint(orbit, nu) {
        const a = orbit.semiMajorAxis / EARTH_RADIUS;
        const e = orbit.eccentricity;
        const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
        const u = orbit.perigeeLongitude - orbit.node + nu;   // Argument der Breite
        const cO = Math.cos(orbit.node), sO = Math.sin(orbit.node);
        const ci = Math.cos(orbit.inclination), si = Math.sin(orbit.inclination);
        const cu = Math.cos(u), su = Math.sin(u);
        return [r * (cO * cu - sO * su * ci), r * (sO * cu + cO * su * ci), r * su * si];
    }

    /** n + 1 Punkte der mittleren Bahnellipse (geschlossen) */
    function ellipsePoints(orbit, n) {
        const points = [];
        for (let k = 0; k <= n; k++) points.push(ellipsePoint(orbit, 2 * Math.PI * k / n));
        return points;
    }

    // ---------------------------------------------------------------
    //  Ereignisse: Knoten, Apsiden, Phasen
    // ---------------------------------------------------------------

    /** Ereignis mit Ort des Mondes */
    function eventWithPosition(time, extra) {
        const moon = astro.calculateMoonPosition(time);
        return Object.assign({ time: time, position: moonVector(moon), longitude: moon.longitude,
                               latitude: moon.latitude, distance: moon.distance }, extra);
    }

    /**
     * Knotendurchgänge des Mondes um einen Zeitpunkt.
     * @return { previous, next } für ☊ (ascending) und ☋ (descending), jeweils
     *         { time, position, longitude, latitude, distance, ascending }
     */
    function moonNodePassages(jd) {
        const result = { ascending: {}, descending: {} };
        // vom Zeitpunkt etwas mehr als einen Drachenmonat zurück vorwärts suchen
        let t = jd - 28.5;
        const found = [];
        while (found.length < 6) {
            const node = astro.calculateNextMoonNode(t);
            found.push(node);
            t = node.time + 1;
        }
        for (const node of found) {
            const key = node.ascending ? 'ascending' : 'descending';
            if (node.time <= jd) result[key].previous = eventWithPosition(node.time, { ascending: node.ascending });
            else if (!result[key].next) result[key].next = eventWithPosition(node.time, { ascending: node.ascending });
        }
        return result;
    }

    /**
     * Perigäen und Apogäen um einen Zeitpunkt.
     * @return { perigee: { previous, next }, apogee: { previous, next } },
     *         jeweils { time, position, longitude, latitude, distance }
     */
    function moonApsides(jd) {
        const result = { perigee: {}, apogee: {} };
        const types = { perigee: astro.ApsisType.Periapsis, apogee: astro.ApsisType.Apoapsis };
        for (const key of Object.keys(types)) {
            let t = jd - 29;
            for (let k = 0; k < 4; k++) {
                const apsis = astro.calculateNextMoonApsis(t, types[key]);
                if (apsis.time <= jd) result[key].previous = apsis;
                else if (!result[key].next) result[key].next = apsis;
                t = apsis.time + 1;
            }
            // Ort aus der Mondposition; Entfernung aus der Apsidenformel (Kapitel 50)
            for (const which of ['previous', 'next']) {
                const apsis = result[key][which];
                result[key][which] = eventWithPosition(apsis.time, { apsisDistance: apsis.distance });
            }
        }
        return result;
    }

    /** Ereignis, das dem Zeitpunkt am nächsten liegt (vorher oder nachher) */
    function nearestEvent(pair, jd) {
        if (!pair.previous) return pair.next;
        if (!pair.next) return pair.previous;
        return (jd - pair.previous.time <= pair.next.time - jd) ? pair.previous : pair.next;
    }

    /**
     * Nächster Zeitpunkt nach jd, zu dem die Längendifferenz Mond − Sonne den Wert phase hat
     * (0 = Neumond, π/2 = erstes Viertel, π = Vollmond, 3π/2 = letztes Viertel). Sekantenverfahren auf
     * der Differenz der Längen; Genauigkeit wenige Sekunden.
     * @param backward true sucht den vorigen Zeitpunkt
     */
    function nextMoonPhase(jd, phase, backward) {
        const f = t => astro.normalizeAngleSigned(astro.calculateMoonPosition(t).longitude
                                                 - astro.calculateSunPosition(t).longitude - phase);
        const rate = 2 * Math.PI / SYNODIC_MONTH;
        // Schätzung über die mittlere Geschwindigkeit, dann iterieren
        const f0 = f(jd);
        let wait = astro.normalizeAngle(-f0) / rate;          // Tage bis zum nächsten Durchgang
        if (backward) wait -= SYNODIC_MONTH;
        if (!backward && wait < 1e-4) wait += SYNODIC_MONTH;
        if (backward && wait > -1e-4) wait -= SYNODIC_MONTH;
        let t = jd + wait;
        for (let k = 0; k < 20; k++) {
            const dt = -f(t) / rate;
            t += dt;
            if (Math.abs(dt) < 1e-7) break;
        }
        return t;
    }

    // ---------------------------------------------------------------
    //  Finsternisse
    // ---------------------------------------------------------------

    /**
     * Sichtbarer Anteil der Sonnenscheibe, wenn ein Körper davor steht (Überdeckung zweier Kreisscheiben).
     * Gleiche Rechnung wie im Shader von ErdeMond3D.html.
     * @param rs Winkelradius der Sonne, ro Winkelradius des verdeckenden Körpers, d Winkelabstand der Mitten
     * @return 1 = ganz sichtbar, 0 = ganz verdeckt
     */
    function sunVisibleFraction(rs, ro, d) {
        if (d >= rs + ro) return 1;
        if (d <= Math.abs(rs - ro)) return ro >= rs ? 0 : 1 - (ro * ro) / (rs * rs);
        const clamp = x => Math.max(-1, Math.min(1, x));
        const area = rs * rs * Math.acos(clamp((d * d + rs * rs - ro * ro) / (2 * d * rs)))
                   + ro * ro * Math.acos(clamp((d * d + ro * ro - rs * rs) / (2 * d * ro)))
                   - 0.5 * Math.sqrt(Math.max(0, (-d + rs + ro) * (d + rs - ro) * (d - rs + ro) * (d + rs + ro)));
        return 1 - area / (Math.PI * rs * rs);
    }

    /**
     * Schattengeometrie zu gegebenen Orten von Sonne und Mond [Erdradien].
     * Mondfinsternis: Abstand des Mondes von der Achse des Erdschattens, Radien von Kern- und Halbschatten
     * an dieser Stelle (um SHADOW_ENLARGEMENT vergrößert), Größen wie in den Finsternis-Tabellen
     * (Anteil des Monddurchmessers im Schatten).
     * Sonnenfinsternis: Abstand gamma der Achse des Mondschattens von der Erdmitte (ohne Vorzeichen),
     * Radien von Halb- und Kernschatten an der Erde (Kernschatten negativ = Gegenschatten, ringförmig).
     * @return { lunar: { type, axisDistance, umbraRadius, penumbraRadius, umbralMagnitude,
     *                     penumbralMagnitude },
     *           solar: { type, gamma, umbraRadius, penumbraRadius } }
     *         type: 'none', 'penumbral' (nur Mond), 'partial', 'total', 'annular' (nur Sonne)
     */
    function eclipseGeometry(sunPos, moonPos) {
        const rm = MOON_RADIUS_ER, rs = SUN_RADIUS_ER;
        const ds = Math.hypot(sunPos[0], sunPos[1], sunPos[2]);

        // Mond im Erdschatten: Achse von der Erde weg von der Sonne
        const axis = scale(sunPos, -1 / ds);
        const x = dot(moonPos, axis);
        const axisDistance = Math.hypot(...sub(moonPos, scale(axis, x)));
        const umbra = SHADOW_ENLARGEMENT * (1 - x * (rs - 1) / ds);
        const penumbra = SHADOW_ENLARGEMENT * (1 + x * (rs + 1) / ds);
        const lunar = { axisDistance, umbraRadius: umbra, penumbraRadius: penumbra,
                        umbralMagnitude: (umbra + rm - axisDistance) / (2 * rm),
                        penumbralMagnitude: (penumbra + rm - axisDistance) / (2 * rm) };
        lunar.type = x <= 0 || lunar.penumbralMagnitude <= 0 ? 'none'
                   : lunar.umbralMagnitude >= 1 ? 'total'
                   : lunar.umbralMagnitude > 0 ? 'partial' : 'penumbral';

        // Erde im Mondschatten: Achse vom Mond weg von der Sonne
        const sm = sub(moonPos, sunPos);
        const dms = Math.hypot(sm[0], sm[1], sm[2]);
        const b = scale(sm, 1 / dms);
        const xe = -dot(moonPos, b);                                 // Mond → Erdmitte entlang der Achse
        const gamma = Math.hypot(...add(moonPos, scale(b, xe)));     // Erdmitte – Achse
        const penumbraE = rm + xe * (rs + rm) / dms;
        // Kernschatten dort, wo die Achse die Erde trifft (sonst an der Erdmitte)
        const hit = xe - Math.sqrt(Math.max(0, 1 - gamma * gamma));
        const umbraE = rm - hit * (rs - rm) / dms;
        const solar = { gamma, umbraRadius: umbraE, penumbraRadius: penumbraE };
        solar.type = xe <= 0 || gamma >= 1 + penumbraE ? 'none'
                   : gamma < 1 + Math.abs(umbraE) ? (umbraE > 0 ? 'total' : 'annular') : 'partial';
        return { lunar, solar };
    }

    /** Orte von Sonne und Mond [Erdradien] zu einem Zeitpunkt */
    function sunMoonPositions(jd) {
        const sun = astro.calculateSunPosition(jd);
        return { sun: sphericalToVector(sun.longitude, sun.latitude, sun.distance / EARTH_RADIUS),
                 moon: moonVector(astro.calculateMoonPosition(jd)) };
    }

    /** Schattengeometrie zu einem Zeitpunkt (siehe eclipseGeometry) */
    function eclipseAt(jd) {
        const p = sunMoonPositions(jd);
        return eclipseGeometry(p.sun, p.moon);
    }

    /**
     * Größte Phase einer möglichen Finsternis nahe einer Syzygie: kleinster Abstand Mond – Erdschattenachse
     * (Mondfinsternis) bzw. Mondschattenachse – Erdmitte (Sonnenfinsternis), Suche mit dem Goldenen Schnitt.
     * @param kind 'lunar' oder 'solar'
     * @return { time, kind, type, ...Werte aus eclipseGeometry für diese Art }
     */
    function greatestEclipse(jdSyzygy, kind) {
        const f = t => { const e = eclipseAt(t); return kind === 'lunar' ? e.lunar.axisDistance : e.solar.gamma; };
        const g = (Math.sqrt(5) - 1) / 2;
        let a = jdSyzygy - 0.3, b = jdSyzygy + 0.3;
        let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
        while (b - a > 1e-5) {                                       // etwa 1 s
            if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); }
            else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); }
        }
        const time = (a + b) / 2;
        return Object.assign({ time, kind }, eclipseAt(time)[kind]);
    }

    /**
     * Nächste (oder vorige) Finsternis einer Art nach dem Zeitpunkt jd.
     * @param kind 'lunar' oder 'solar'
     * @return Ergebnis von greatestEclipse, null wenn in 40 Lunationen keine gefunden wird
     */
    function findEclipse(jd, kind, backward) {
        const phase = kind === 'lunar' ? Math.PI : 0;
        let t = jd;
        for (let n = 0; n < 40; n++) {
            t = nextMoonPhase(t, phase, backward);
            const e = greatestEclipse(t, kind);
            if (e.type !== 'none' && (backward ? e.time < jd : e.time > jd)) return e;
        }
        return null;
    }

    // ---------------------------------------------------------------
    //  Export
    // ---------------------------------------------------------------

    const api = {
        MOON_INCLINATION, MOON_ECCENTRICITY, MOON_RADIUS_ER, SYNODIC_MONTH, SUN_RADIUS_ER, SHADOW_ENLARGEMENT,
        sphericalToVector, vectorToSpherical, applyRotation, applyRotationInverse, subPoint,
        earthRotation, moonRotation, sceneState, moonPath, meanMoonOrbit, ellipsePoint, ellipsePoints,
        moonNodePassages, moonApsides, nearestEvent, nextMoonPhase,
        sunVisibleFraction, eclipseGeometry, eclipseAt, greatestEclipse, findEclipse,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else Object.assign(global, api);
})(typeof window !== 'undefined' ? window : globalThis);
