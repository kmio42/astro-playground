// testOrbit3d.js – Tests für orbit3d.js und den Rechenteil von gl3d.js (Konzept-ErdeMond3D.md)
//
//   node testOrbit3d.js
//
// Ohne Testframework; Rückgabewert 1, wenn ein Test fehlschlägt.

'use strict';

const astro = require('./astro.js');
const orb = require('./orbit3d.js');
const gl3d = require('./gl3d.js');
const { DEG2RAD, RAD2DEG } = astro;

let failures = 0;
function check(condition, message) {
    if (!condition) failures++;
    console.log((condition ? '  ok    ' : '  FEHLER ') + message);
}

const jdStart = astro.julianDayFromCalendar(2026, 10, 1, 0);
const utc = (y, mo, d, h, mi) => astro.julianDayFromDate(new Date(Date.UTC(y, mo - 1, d, h, mi)));
const fmtDeg = r => (r * RAD2DEG).toFixed(4) + '°';
const fmtMin = d => (d * 1440).toFixed(2) + ' min';
const angleBetween = (a, b) => Math.acos(Math.max(-1, Math.min(1, gl3d.vec3.dot(gl3d.vec3.normalize(a), gl3d.vec3.normalize(b)))));
const column = (m, i) => [m[i], m[3 + i], m[6 + i]];

// ---------------------------------------------------------------
console.log('1. Mond: Orientierung aus Libration und Positionswinkel (60 Tage, alle 12 h)');
{
    let maxLib = 0, maxCassini = 0, maxMeridian = 0, tiltMin = 9, tiltMax = 0, sameSide = 0;
    for (let k = 0; k < 120; k++) {
        const jd = jdStart + k / 2;
        const s = orb.sceneState(jd);
        const R = s.moon.rotation;
        // Unter-Erde-Punkt = Libration
        const p = orb.subPoint(R, gl3d.vec3.scale(s.moon.position, -1));
        maxLib = Math.max(maxLib, Math.abs(astro.normalizeAngleSigned(p.longitude - s.moon.libration.longitude)),
                          Math.abs(p.latitude - s.moon.libration.latitude));
        // Cassini: Mondpol, Ekliptikpol und Bahnpol in einer Ebene, Mondpol auf der anderen Seite
        const pole = column(R, 2);
        const normal = orb.meanMoonOrbit(jd).normal;
        const planeNormal = gl3d.vec3.normalize(gl3d.vec3.cross([0, 0, 1], normal));
        maxCassini = Math.max(maxCassini, Math.abs(Math.asin(gl3d.vec3.dot(pole, planeNormal))));
        if (pole[0] * normal[0] + pole[1] * normal[1] < 0) sameSide++;
        const tilt = angleBetween(pole, [0, 0, 1]);
        tiltMin = Math.min(tiltMin, tilt); tiltMax = Math.max(tiltMax, tilt);
        // Nullmeridian (Körper-x) im Rahmen des mittleren Mondäquators bei F + 180° (Meeus Kap. 51)
        const T = (astro.dynamicalTime(jd) - 2451545) / 36525;
        const F = (93.2720950 + 483202.0175233 * T - 0.0036539 * T * T) * DEG2RAD;
        const node = s.meanNode, I = 1.54242 * DEG2RAD;
        const x = column(R, 0);
        const xn = [Math.cos(node) * x[0] + Math.sin(node) * x[1], -Math.sin(node) * x[0] + Math.cos(node) * x[1], x[2]];
        const angle = Math.atan2(xn[1] * Math.cos(I) - xn[2] * Math.sin(I), xn[0]);
        maxMeridian = Math.max(maxMeridian, Math.abs(astro.normalizeAngleSigned(angle - F - Math.PI)));
    }
    check(maxLib < 1e-9, `Unter-Erde-Punkt = (l, b), größte Abweichung ${maxLib.toExponential(1)} rad`);
    check(tiltMin > 1.44 * DEG2RAD && tiltMax < 1.64 * DEG2RAD,
          `Mondpol ${fmtDeg(tiltMin)} … ${fmtDeg(tiltMax)} vom Ekliptikpol (I = 1,5424°)`);
    check(maxCassini < 0.1 * DEG2RAD, `Cassini-Ebene: größte Abweichung ${fmtDeg(maxCassini)} < 0,1°`);
    check(sameSide === 120, `Mondpol immer auf der anderen Seite des Ekliptikpols als der Bahnpol (${sameSide}/120)`);
    check(maxMeridian < 0.3 * DEG2RAD, `Nullmeridian bei F + 180°, größte Abweichung ${fmtDeg(maxMeridian)} < 0,3°`);
}

// ---------------------------------------------------------------
console.log('2. Erde: Unter-Sonnen-Punkt (12 Tage im Jahr)');
{
    let maxLat = 0, maxLon = 0;
    const greenwich = { longitude: 0, latitude: 51.48 * DEG2RAD, elevation: 0 };
    for (let month = 1; month <= 12; month++) {
        const day = astro.julianDayFromCalendar(2026, month, 15, 0);
        const rs = astro.calculateSunRiseSet(day, greenwich);
        const jd = day + rs.transit / 24;
        const s = orb.sceneState(jd);
        const sub = orb.subPoint(s.earth.rotation, s.sun.direction);
        const dec = astro.calculateEquatorial(astro.calculateSunPosition(jd), s.obliquity).dec;
        maxLat = Math.max(maxLat, Math.abs(sub.latitude - dec));
        maxLon = Math.max(maxLon, Math.abs(sub.longitude));
    }
    check(maxLat < 1e-9, `Breite = Deklination der Sonne, größte Abweichung ${maxLat.toExponential(1)} rad`);
    check(maxLon < 0.05 * DEG2RAD, `Zum Meridiandurchgang in Greenwich auf Länge 0°, größte Abweichung ${fmtDeg(maxLon)}`);
    // Drehsinn: eine Stunde später liegt der Punkt 15° weiter westlich
    const day = astro.julianDayFromCalendar(2026, 6, 21, 12);
    const a = orb.subPoint(orb.earthRotation(day), orb.sceneState(day).sun.direction).longitude;
    const b = orb.subPoint(orb.earthRotation(day + 1 / 24), orb.sceneState(day + 1 / 24).sun.direction).longitude;
    check(Math.abs(astro.normalizeAngleSigned(b - a) + 15.04 * DEG2RAD) < 0.05 * DEG2RAD,
          `Nach 1 h wandert der Unter-Sonnen-Punkt ${fmtDeg(astro.normalizeAngleSigned(b - a))} (≈ −15°)`);
}

// ---------------------------------------------------------------
console.log('3. Knotendurchgänge (12 Monate)');
{
    let maxLat = 0, signs = 0, count = 0;
    for (let k = 0; k < 12; k++) {
        const jd = jdStart + 30 * k;
        const n = orb.moonNodePassages(jd);
        for (const key of ['ascending', 'descending']) {
            for (const which of ['previous', 'next']) {
                const e = n[key][which];
                count++;
                maxLat = Math.max(maxLat, Math.abs(e.latitude));
                const before = astro.calculateMoonPosition(e.time - 1 / 24).latitude;
                const after = astro.calculateMoonPosition(e.time + 1 / 24).latitude;
                if (key === 'ascending' ? (before < 0 && after > 0) : (before > 0 && after < 0)) signs++;
                if (which === 'previous' ? !(e.time <= jd) : !(e.time > jd)) check(false, `${key} ${which} auf der falschen Seite`);
            }
        }
    }
    check(maxLat < 0.02 * DEG2RAD, `Mondbreite im Knoten höchstens ${fmtDeg(maxLat)} < 0,02°`);
    check(signs === count, `Vorzeichenwechsel der Breite in der richtigen Richtung (${signs}/${count})`);
}

// ---------------------------------------------------------------
console.log('4. Apsiden (12 Monate)');
{
    let worst = 0, worstFormula = 0, order = true;
    for (let k = 0; k < 12; k++) {
        const jd = jdStart + 30 * k;
        const a = orb.moonApsides(jd);
        for (const key of ['perigee', 'apogee']) {
            for (const which of ['previous', 'next']) {
                const e = a[key][which];
                const path = orb.moonPath(e.time - 2, e.time + 2, 1);
                const extreme = key === 'perigee' ? Math.min(...path.map(p => p.distance)) : Math.max(...path.map(p => p.distance));
                worst = Math.max(worst, Math.abs(e.distance - extreme));
                worstFormula = Math.max(worstFormula, Math.abs(e.distance - e.apsisDistance));
            }
            if (!(a[key].previous.time <= jd && a[key].next.time > jd)) order = false;
        }
    }
    check(worst < 50, `Entfernung zum Apsidenzeitpunkt weicht höchstens ${worst.toFixed(1)} km vom Extremum der Bahn ab`);
    check(worstFormula < 30, `Apsidenformel (Kap. 50) und Mondposition (Kap. 47) auf ${worstFormula.toFixed(1)} km gleich`);
    check(order, 'vorige/nächste Apside liegen vor/nach dem Zeitpunkt');
}

// ---------------------------------------------------------------
console.log('5. Mondphasen (veröffentlichte Zeiten, UTC)');
{
    const cases = [
        ['Neumond 10.10.2026 15:50', 0, utc(2026, 10, 10, 15, 50)],
        ['Vollmond 26.10.2026 04:12', Math.PI, utc(2026, 10, 26, 4, 12)],
        ['Neumond 09.11.2026 07:02', 0, utc(2026, 11, 9, 7, 2)],
        ['Vollmond 24.11.2026 14:53', Math.PI, utc(2026, 11, 24, 14, 53)],
    ];
    for (const [label, phase, expected] of cases) {
        const t = orb.nextMoonPhase(expected - 5, phase);
        check(Math.abs(t - expected) < 3 / 1440, `${label}: Abweichung ${fmtMin(t - expected)} < 3 min`);
    }
    const t = orb.nextMoonPhase(jdStart, 0);
    const back = orb.nextMoonPhase(t + 1 / 1440, 0, true);
    check(Math.abs(back - t) < 1e-5, `Rückwärtssuche findet denselben Neumond (${fmtMin(back - t)})`);
    const next = orb.nextMoonPhase(t, 0);
    check(next - t > 29 && next - t < 30, `Nächster Neumond nach einem Neumond: ${(next - t).toFixed(2)} Tage`);
}

// ---------------------------------------------------------------
console.log('6. Mittlere Bahnellipse');
{
    const orbit = orb.meanMoonOrbit(jdStart);
    const peri = orbit.semiMajorAxis * (1 - orbit.eccentricity), apo = orbit.semiMajorAxis * (1 + orbit.eccentricity);
    check(peri > 356000 && peri < 371000 && apo > 404000 && apo < 407000,
          `Perigäum ${peri.toFixed(0)} km, Apogäum ${apo.toFixed(0)} km im beobachteten Bereich`);
    const points = orb.ellipsePoints(orbit, 72);
    const offPlane = Math.max(...points.map(p => Math.abs(gl3d.vec3.dot(p, orbit.normal))));
    check(offPlane < 1e-9, `Ellipse liegt in der Bahnebene (${offPlane.toExponential(1)})`);
    // Aufsteigender Knoten: Punkt, an dem z von − nach + wechselt, liegt in Richtung Ω
    let nodeLon = null;
    for (let k = 0; k < 3600; k++) {
        const a = orb.ellipsePoint(orbit, 2 * Math.PI * k / 3600), b = orb.ellipsePoint(orbit, 2 * Math.PI * (k + 1) / 3600);
        if (a[2] < 0 && b[2] >= 0) nodeLon = Math.atan2(b[1], b[0]);
    }
    check(nodeLon !== null && Math.abs(astro.normalizeAngleSigned(nodeLon - orbit.node)) < 0.2 * DEG2RAD,
          `aufsteigender Knoten der Ellipse bei Ω (${fmtDeg(astro.normalizeAngle(nodeLon))} / ${fmtDeg(orbit.node)})`);
    // Mittleres und wahres Perigäum liegen nicht weit auseinander (Evektion)
    let worst = 0;
    for (let k = 0; k < 24; k++) {
        const jd = jdStart + 30 * k;
        const e = orb.moonApsides(jd).perigee.next;
        worst = Math.max(worst, Math.abs(astro.normalizeAngleSigned(e.longitude - orb.meanMoonOrbit(e.time).perigeeLongitude)));
    }
    check(worst < 35 * DEG2RAD, `wahres Perigäum höchstens ${fmtDeg(worst)} vom mittleren entfernt (Evektion)`);
}

// ---------------------------------------------------------------
console.log('7. gl3d: Matrizen, Strahl, Geometrie');
{
    const { mat4, vec3 } = gl3d;
    const M = mat4.multiply(mat4.perspective(0.8, 1.5, 0.1, 100), mat4.lookAt([3, -4, 2], [0, 1, 0.5], [0, 0, 1]));
    const P = mat4.multiply(mat4.invert(M), M);
    const err = Math.max(...P.map((v, i) => Math.abs(v - mat4.identity()[i])));
    check(err < 1e-12, `invert(M)·M = E (${err.toExponential(1)})`);

    const view = mat4.lookAt([0, 0, 10], [0, 0, 0], [0, 1, 0]);
    const t = mat4.transformPoint(view, [0, 0, 0]);
    check(Math.abs(t[2] + 10) < 1e-12 && Math.abs(t[0]) < 1e-12, 'lookAt: Ziel liegt auf der −z-Achse');
    const proj = mat4.perspective(1, 1, 0.5, 50);
    const near = mat4.transformPoint(proj, [0, 0, -0.5]), far = mat4.transformPoint(proj, [0, 0, -50]);
    check(Math.abs(near[2] / near[3] + 1) < 1e-12 && Math.abs(far[2] / far[3] - 1) < 1e-12,
          'perspective: nahe Ebene → −1, ferne Ebene → +1');

    check(Math.abs(gl3d.raySphere([0, 0, -5], [0, 0, 1], [0, 0, 0], 1) - 4) < 1e-12, 'Strahl trifft Kugel im Abstand 4');
    check(gl3d.raySphere([0, 2, -5], [0, 0, 1], [0, 0, 0], 1) === null, 'Strahl verfehlt Kugel');
    check(gl3d.raySphere([0, 0, 5], [0, 0, 1], [0, 0, 0], 1) === null, 'Kugel hinter dem Strahl');

    const g = gl3d.sphereGeometry(8, 16);
    let maxR = 0;
    for (let i = 0; i < g.positions.length; i += 3) {
        maxR = Math.max(maxR, Math.abs(Math.hypot(g.positions[i], g.positions[i + 1], g.positions[i + 2]) - 1));
    }
    check(maxR < 1e-6, 'Kugel: alle Punkte auf dem Einheitskreis');
    // Punkt Länge 0°, Breite 0° (Zeile 4, Spalte 8) hat u = v = 0,5 und liegt auf +x
    const idx = 4 * 17 + 8;
    check(Math.abs(g.uvs[idx * 2] - 0.5) < 1e-6 && Math.abs(g.uvs[idx * 2 + 1] - 0.5) < 1e-6
          && Math.abs(g.positions[idx * 3] - 1) < 1e-6, 'Kugel: Länge 0°/Breite 0° bei u = v = 0,5 auf +x');
    const idxEast = 4 * 17 + 12;   // Länge +90°
    check(Math.abs(g.positions[idxEast * 3 + 1] - 1) < 1e-6 && Math.abs(g.uvs[idxEast * 2] - 0.75) < 1e-6,
          'Kugel: Länge 90° Ost auf +y bei u = 0,75');
    check(g.positions[2] > 0.999 && g.uvs[1] === 0, 'Kugel: Nordpol oben in der Textur (v = 0)');

    const lines = gl3d.lineGeometry([[0, 0, 0], [1, 0, 0], [1, 2, 0]], { dashed: [0, 1, 1], dashLength: 0.5 });
    check(lines.indices.length === 12 && lines.start.length === 24, 'Linie: 2 Segmente → 8 Ecken, 4 Dreiecke');
    check(lines.dash[2 * 7] === 6 && lines.dash[2 * 7 + 1] === 1, 'Linie: Strichparameter am Ende = Länge/Strichlänge');

    const cam = new gl3d.OrbitCamera({ target: [1, 2, 3], distance: 5, azimuth: 0.3, elevation: 0.2 });
    const vp = mat4.multiply(mat4.perspective(cam.fovy, 2, 0.1, 100), cam.viewMatrix());
    const c = gl3d.projectPoint(vp, cam.eye(), [1, 2, 3], 800, 400);
    check(Math.abs(c.x - 400) < 1e-6 && Math.abs(c.y - 200) < 1e-6, 'Kamera: Zielpunkt in der Bildmitte');
    const r = cam.ray(400, 200, 800, 400);
    check(angleBetween(r.dir, vec3.sub([1, 2, 3], cam.eye())) < 1e-6, 'Kamera: Strahl durch die Bildmitte trifft das Ziel');
}

console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden');
process.exit(failures ? 1 : 0);
