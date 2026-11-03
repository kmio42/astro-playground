/**
 * longterm.js — Erdbahn und Erdachse über Jahrtausende, für den Zeitraffer in erdbahn3d.html.
 * DOM-frei wie astro.js: im Browser globale Funktionen, in Node.js per require('./longterm.js').
 *
 * Mittlere Bahnelemente der Erde nach Meeus, Kapitel 31 (Tabelle 31.A, mittleres Äquinoktium des Datums), die
 * allgemeine Präzession in Länge nach Kapitel 21 und die Schiefe der Ekliptik nach Laskar (Formel 21.3, über
 * calculateObliquity aus astro.js). Gültig etwa von −8000 bis +12 000 (±10 000 Jahre um 2000); Störungen durch
 * Mond und Planeten fehlen, die Jahrespunkte weichen deshalb um bis zu eine Viertelstunde, das Perihel um bis zu
 * zwei Tage von den genauen Werten ab. Die Bewegung der Ekliptik selbst (planetare Präzession, 0,47″ pro Jahr) fehlt.
 *
 * Winkel in Radiant, Zeiten als Julianischer Tag in UT (ΔT über dynamicalTime aus astro.js).
 */
(function (root) {
    'use strict';
    const A = (typeof module !== 'undefined' && module.exports) ? require('./astro.js') : root;
    const { DEG2RAD, RAD2DEG, dynamicalTime, calculateObliquity, normalizeAngle, normalizeAngleSigned,
            julianDayFromCalendar, OBLIQUITY_J2000 } = A;

    const LONGTERM_YEARS = { min: -8000, max: 12000 };     // Gültigkeitsbereich des Zeitraffers
    const TROPICAL_YEAR = 365.2422;
    const ANOMALISTIC_YEAR = 365.259636;

    /** Julianische Jahrhunderte seit J2000.0 in TD */
    function centuries(jd) {
        return (dynamicalTime(jd) - 2451545.0) / 36525.0;
    }

    function poly(T, ...c) {
        let r = 0;
        for (let i = c.length - 1; i >= 0; i--) r = r * T + c[i];
        return r;
    }

    /**
     * Mittlere Bahnelemente der Erde, Meeus Tabelle 31.A (mittleres Äquinoktium des Datums).
     * @return { L (mittlere Länge), a [AE], e, pi (Länge des Perihels) } , Winkel in Radiant
     */
    function earthElements(jd) {
        const T = centuries(jd);
        return {
            L: normalizeAngle(poly(T, 100.466449, 36000.7698231, 0.00030368, 0.000000021) * DEG2RAD),
            a: 1.000001018,
            e: poly(T, 0.01670862, -0.000042037, -0.0000001236, 0.00000000004),
            pi: normalizeAngle(poly(T, 102.937348, 1.7195269, 0.00045962, 0.000000499) * DEG2RAD),
        };
    }

    /** Allgemeine Präzession in Länge seit J2000.0: p = 5029,0966″T + 1,11113″T² − 0,000006″T³ [rad] */
    function generalPrecession(jd) {
        const T = centuries(jd);
        return poly(T, 0, 5029.0966, 1.11113, -0.000006) / 3600 * DEG2RAD;
    }

    /** Wahre Anomalie aus mittlerer Anomalie M und Exzentrizität e (Keplergleichung, Kapitel 30) */
    function trueAnomaly(M, e) {
        let E = M;
        for (let i = 0; i < 12; i++) E = E - (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
        return 2 * Math.atan2(Math.sqrt(1 + e) * Math.sin(E / 2), Math.sqrt(1 - e) * Math.cos(E / 2));
    }

    /**
     * Ort der Erde von der Sonne aus aus den mittleren Elementen.
     * @return { lon (heliozentrische Länge, Äquinoktium des Datums), r [AE], nu (wahre Anomalie), el (Elemente) }
     */
    function earthHelio(jd) {
        const el = earthElements(jd);
        const nu = trueAnomaly(el.L - el.pi, el.e);
        return { lon: normalizeAngle(nu + el.pi), r: el.a * (1 - el.e * el.e) / (1 + el.e * Math.cos(nu)), nu, el };
    }

    /** Zeitpunkt nahe guess, zu dem f(jd) (Winkel, steigend mit rate [rad/Tag]) durch target geht */
    function solveAngle(f, target, guess, rate) {
        let jd = guess;
        for (let i = 0; i < 8; i++) jd -= normalizeAngleSigned(f(jd) - target) / rate;
        return jd;
    }

    /**
     * Jahrespunkte eines Jahres: Frühlings-, Sommer-, Herbst- und Winteranfang als JD (UT), aus den mittleren
     * Elementen (Sonne bei ekliptikaler Länge 0°, 90°, 180°, 270° des Datums)
     */
    function seasonsOfYear(year) {
        const sunLon = jd => earthHelio(jd).lon + Math.PI;
        const rate = 2 * Math.PI / TROPICAL_YEAR;
        const march = 2451623.8 + (year - 2000) * TROPICAL_YEAR;        // Frühlingsanfang 2000 als Startwert
        return [0, 1, 2, 3].map(k => solveAngle(sunLon, k * Math.PI / 2, march + k * TROPICAL_YEAR / 4, rate));
    }

    /** Perihel (which = 'peri') oder Aphel ('aph') im Jahr year: Zeitpunkt (JD) und Abstand [AE] */
    function apsisOfYear(year, which = 'peri') {
        const anomaly = jd => { const el = earthElements(jd); return el.L - el.pi; };
        const rate = 2 * Math.PI / ANOMALISTIC_YEAR;
        const guess = 2451547.5 + (year - 2000) * ANOMALISTIC_YEAR + (which === 'aph' ? ANOMALISTIC_YEAR / 2 : 0);
        const time = solveAngle(anomaly, which === 'aph' ? Math.PI : 0, guess, rate);
        const el = earthElements(time);
        return { time, distance: el.a * (which === 'aph' ? 1 + el.e : 1 - el.e) };
    }

    /** Länge von Sommer- und Winterhalbjahr der Nordhalbkugel [Tage] */
    function halfYears(year) {
        const s = seasonsOfYear(year), next = seasonsOfYear(year + 1);
        return { summer: s[2] - s[0], winter: next[0] - s[2] };
    }

    // ---------------------------------------------------------------
    //  Himmelspol und Polarsterne
    // ---------------------------------------------------------------

    // Sterne nahe dem Weg des Himmelsnordpols, Rektaszension und Deklination J2000 (ohne Eigenbewegung)
    const POLE_STARS = [
        { name: 'Polarstern', ra: [2, 31, 49.1], dec: [89, 15, 51] },
        { name: 'Kochab', ra: [14, 50, 42.3], dec: [74, 9, 20] },
        { name: 'Thuban', ra: [14, 4, 23.3], dec: [64, 22, 33] },
        { name: 'Errai', ra: [23, 39, 20.8], dec: [77, 37, 57] },
        { name: 'Alderamin', ra: [21, 18, 34.8], dec: [62, 35, 8] },
        { name: 'Deneb', ra: [20, 41, 25.9], dec: [45, 16, 49] },
        { name: 'Wega', ra: [18, 36, 56.3], dec: [38, 47, 1] },
    ];

    /** Einheitsvektor eines Sterns in ekliptikalen Koordinaten J2000 (x zum Frühlingspunkt J2000) */
    function starVector(star) {
        const ra = (star.ra[0] + star.ra[1] / 60 + star.ra[2] / 3600) * 15 * DEG2RAD;
        const dec = (star.dec[0] + star.dec[1] / 60 + star.dec[2] / 3600) * DEG2RAD;
        const q = [Math.cos(dec) * Math.cos(ra), Math.cos(dec) * Math.sin(ra), Math.sin(dec)];
        const c = Math.cos(OBLIQUITY_J2000), s = Math.sin(OBLIQUITY_J2000);
        return [q[0], q[1] * c + q[2] * s, -q[1] * s + q[2] * c];
    }

    /**
     * Himmelsnordpol des Datums als Einheitsvektor in ekliptikalen Koordinaten J2000: um ε gegen den Pol der
     * Ekliptik geneigt, bei der Länge 90° − p (er läuft mit der Präzession rückwärts um den Ekliptikpol)
     */
    function poleOfDate(jd) {
        const eps = calculateObliquity(jd), lon = Math.PI / 2 - generalPrecession(jd);
        return [Math.sin(eps) * Math.cos(lon), Math.sin(eps) * Math.sin(lon), Math.cos(eps)];
    }

    /** Abstände aller POLE_STARS vom Himmelsnordpol des Datums [rad], aufsteigend sortiert */
    function poleStars(jd) {
        const p = poleOfDate(jd);
        return POLE_STARS.map(star => {
            const v = starVector(star);
            return { star, vector: v, distance: Math.acos(Math.min(1, p[0] * v[0] + p[1] * v[1] + p[2] * v[2])) };
        }).sort((a, b) => a.distance - b.distance);
    }

    /** JD zum 1. Juli eines Jahres (Mitte des Jahres, gregorianisch auch vor 1582) */
    function midYear(year) {
        return julianDayFromCalendar(year, 7, 1, 0, 'gregorian');
    }

    const api = {
        LONGTERM_YEARS, earthElements, generalPrecession, earthHelio, seasonsOfYear, apsisOfYear, halfYears,
        POLE_STARS, starVector, poleOfDate, poleStars, midYear,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else Object.assign(root, api);
})(typeof window !== 'undefined' ? window : globalThis);
