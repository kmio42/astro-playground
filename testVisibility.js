// testVisibility.js – Tests für visibility.js und calculateRefraction (Konzept-Sichtbarkeit.md, Stufe 1)
//
//   node testVisibility.js
//
// Ohne Testframework; Rückgabewert 1, wenn ein Test fehlschlägt.

'use strict';

const astro = require('./astro.js');
const vis = require('./visibility.js');
const { DEG2RAD, RAD2DEG } = astro;

let failures = 0;
function check(condition, message) {
    if (!condition) failures++;
    console.log((condition ? '  ok    ' : '  FEHLER ') + message);
}

const berlin = { longitude: 13.405 * DEG2RAD, latitude: 52.52 * DEG2RAD, elevation: 0 };
const freeSky = { name: 'frei', sectors: [], horizon: [] };
const fmtMin = d => (d * 1440).toFixed(2) + ' min';

// ---------------------------------------------------------------
console.log('1a. Freier Himmel: Sonnenauf-/-untergang wie calculateSunRiseSet (Berlin, 12 Tage im Jahr)');
{
    let maxDiff = 0;
    for (let month = 1; month <= 12; month++) {
        const day = astro.julianDayFromCalendar(2026, month, 15, 0);
        const rs = astro.calculateSunRiseSet(day, berlin);
        const ivs = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [freeSky]);
        // Oberrand über 0° scheinbar entspricht h0 = −50′; das Intervall beginnt mit dem Oberrand
        const iv = ivs.find(i => !i.startsBefore && !i.endsAfter);
        if (!iv || !rs.hasRise || !rs.hasSet) { check(false, `Monat ${month}: kein Tagesbogen`); continue; }
        maxDiff = Math.max(maxDiff, Math.abs(iv.start - (day + rs.rise / 24)), Math.abs(iv.end - (day + rs.set / 24)));
    }
    check(maxDiff < 1 / 1440, `größte Abweichung ${fmtMin(maxDiff)} < 1 min`);
}

// ---------------------------------------------------------------
console.log('1b. Freier Himmel: Mondauf-/-untergang wie calculateMoonRiseSet (Berlin, 60 Tage)');
{
    const start = astro.julianDayFromCalendar(2026, 1, 1, 0);
    const ivs = vis.findVisibilityIntervals('moon', start - 1, start + 61, berlin, [freeSky]);
    let maxDiff = 0, count = 0;
    for (let d = 0; d < 60; d++) {
        const rs = astro.calculateMoonRiseSet(start + d, berlin);
        if (rs.hasRise) {
            const t = start + d + rs.rise / 24;
            maxDiff = Math.max(maxDiff, Math.min(...ivs.map(i => Math.abs(i.start - t))));
            count++;
        }
        if (rs.hasSet) {
            const t = start + d + rs.set / 24;
            maxDiff = Math.max(maxDiff, Math.min(...ivs.map(i => Math.abs(i.end - t))));
            count++;
        }
    }
    check(count > 100 && maxDiff < 1.5 / 1440, `${count} Ereignisse, größte Abweichung ${fmtMin(maxDiff)} < 1,5 min`);
}

// ---------------------------------------------------------------
console.log('2. Rechteck Azimut 150°–210°, Höhe 0°–90° (Berlin, 20.3.2026)');
{
    const vp = { name: 'Süd', sectors: [{ azimuthFrom: 150, azimuthTo: 210, altitudeFrom: 0, altitudeTo: 90 }], horizon: [] };
    const day = astro.julianDayFromCalendar(2026, 3, 20, 0);
    const ivs = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [vp]);
    check(ivs.length === 1, `ein Intervall (${ivs.length})`);
    const iv = ivs[0];
    // Ein- und Austritt über den linken bzw. rechten Rand der Scheibe; der Mittelpunkt passiert 150° bzw. 210°
    const atCenterStart = vis.sunDirection(iv.centerStart, berlin).azimuth;
    const atCenterEnd = vis.sunDirection(iv.centerEnd, berlin).azimuth;
    check(Math.abs(atCenterStart - 150) < 0.01, `Mittelpunkt tritt bei ${atCenterStart.toFixed(4)}° ein`);
    check(Math.abs(atCenterEnd - 210) < 0.01, `Mittelpunkt tritt bei ${atCenterEnd.toFixed(4)}° aus`);
    check(iv.start < iv.centerStart && iv.centerEnd < iv.end,
          `Rand vor Mittelpunkt: ${fmtMin(iv.centerStart - iv.start)}, ${fmtMin(iv.end - iv.centerEnd)}`);
    // Plausibilität: 60° Azimut um die Mittagszeit dauern im März in Berlin 3–5 h
    const hours = (iv.centerEnd - iv.centerStart) * 24;
    check(hours > 3 && hours < 5, `Dauer Mittelpunkt ${hours.toFixed(2)} h`);
}

// ---------------------------------------------------------------
console.log('3. Azimutbereich über Nord 300°–30° (Mitternachtssonne, 70° N, 21.6.2026)');
{
    const north = { longitude: 20 * DEG2RAD, latitude: 70 * DEG2RAD, elevation: 0 };
    const vp = { name: 'Nord', sectors: [{ azimuthFrom: 300, azimuthTo: 30, altitudeFrom: -5, altitudeTo: 90 }], horizon: [] };
    check(vis.azimuthInRange(350, 300, 30) && vis.azimuthInRange(10, 300, 30) && !vis.azimuthInRange(180, 300, 30),
          'azimuthInRange über Nord');
    const day = astro.julianDayFromCalendar(2026, 6, 21, 12);
    const ivs = vis.findVisibilityIntervals('sun', day, day + 1, north, [vp]);
    check(ivs.length === 1, `ein Intervall (${ivs.length})`);
    const iv = ivs[0];
    const a0 = vis.sunDirection(iv.centerStart, north).azimuth;
    const a1 = vis.sunDirection(iv.centerEnd, north).azimuth;
    check(Math.abs(a0 - 300) < 0.01 && Math.abs(a1 - 30) < 0.01,
          `Mittelpunkt von ${a0.toFixed(3)}° bis ${a1.toFixed(3)}°, ${((iv.centerEnd - iv.centerStart) * 24).toFixed(2)} h`);
}

// ---------------------------------------------------------------
console.log('4. Horizontlinie');
{
    const vp = vis.compileViewpoint({ name: 'h', sectors: [], horizon: [[90, 10], [270, 20], [0, 0]] });
    check(Math.abs(vis.horizonAltitude(vp, 180) - 15) < 1e-12, 'linear zwischen 90° und 270°');
    check(Math.abs(vis.horizonAltitude(vp, 315) - 10) < 1e-12, 'linear zwischen 270° und 360°');
    check(Math.abs(vis.horizonAltitude(vp, 45) - 5) < 1e-12, 'linear zwischen 0° und 90°');
    const wrap = vis.compileViewpoint({ name: 'w', sectors: [], horizon: [[350, 10], [10, 30]] });
    check(Math.abs(vis.horizonAltitude(wrap, 0) - 20) < 1e-12, 'über Nord geschlossen');
    check(vis.isDirectionVisible(wrap, 0, 21) && !vis.isDirectionVisible(wrap, 0, 19), 'isDirectionVisible');
}

// ---------------------------------------------------------------
console.log('5. Refraktion (Formel 15.4) gegen Bennett (Formel 15.3)');
{
    // Bennett: R aus der scheinbaren Höhe h0, R = 1′/tan(h0 + 7,31°/(h0 + 4,4°)); Saemundsson ist die Umkehrung
    let maxDiff = 0;
    for (let h0 = 0; h0 <= 89; h0 += 0.5) {
        const RB = 1 / Math.tan((h0 + 7.31 / (h0 + 4.4)) * DEG2RAD);                     // [′]
        const RS = astro.calculateRefraction((h0 - RB / 60) * DEG2RAD) * RAD2DEG * 60;  // [′]
        maxDiff = Math.max(maxDiff, Math.abs(RS - RB));
    }
    check(maxDiff < 0.1, `größte Abweichung ${maxDiff.toFixed(3)}′ < 0,1′`);
    check(Math.abs(astro.calculateRefraction(90 * DEG2RAD)) < 1e-9, 'R(90°) = 0');
    const R0 = astro.calculateRefraction(0) * RAD2DEG * 60;
    check(Math.abs(R0 - 29) < 0.5, `R(0°) = ${R0.toFixed(2)}′`);

    // Gleiche Werte in cpp/astro.cpp, wenn g++ vorhanden ist
    const { execFileSync } = require('child_process');
    const fs = require('fs'), os = require('os'), path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'refraction-'));
    const heights = [-3, -1, -0.5, 0, 0.5, 1, 2, 5, 10, 20, 45, 89.9, 90];
    try {
        fs.writeFileSync(path.join(dir, 'r.cpp'),
            '#include "astro.h"\n#include <cstdio>\nint main(){const double h[]={' + heights.join(',') + '};\n' +
            'for(double x: h) std::printf("%.17g\\n", astro::calculateRefraction(astro::Angle::fromDeg(x)).rad());}\n');
        execFileSync('g++', ['-std=c++11', '-I' + path.join(__dirname, 'cpp'), path.join(dir, 'r.cpp'),
                             path.join(__dirname, 'cpp', 'astro.cpp'), '-o', path.join(dir, 'r')]);
        const cpp = execFileSync(path.join(dir, 'r')).toString().trim().split('\n').map(Number);
        const diff = Math.max(...heights.map((h, i) => Math.abs(astro.calculateRefraction(h * DEG2RAD) - cpp[i])));
        check(diff < 1e-15, `astro.js und astro.cpp gleich (Abweichung ${diff.toExponential(1)} rad)`);
    } catch (e) {
        console.log('  übersprungen: C++-Vergleich (' + e.message.split('\n')[0] + ')');
    } finally {
        fs.rmSync(dir, { recursive: true, force: true });
    }
}

// ---------------------------------------------------------------
console.log('6. Mond: Dunkelheit, Vollmond, Raster');
{
    const start = astro.julianDayFromCalendar(2026, 1, 1, 0);
    const eph = vis.createMoonEphemeris(start, start + 90);
    const fullMoons = vis.findFullMoons(eph);
    // Vollmonde 2026 (UT): 3.1. 10:03, 1.2. 22:09, 3.3. 11:38
    const expected = [[2026, 1, 3, 10 + 3 / 60], [2026, 2, 1, 22 + 9 / 60], [2026, 3, 3, 11 + 38 / 60]]
        .map(([y, m, d, h]) => astro.julianDayFromCalendar(y, m, d, h));
    const diff = Math.max(...expected.map(t => Math.min(...fullMoons.map(f => Math.abs(f - t)))));
    check(fullMoons.length === 3 && diff < 10 / 1440, `${fullMoons.length} Vollmonde, größte Abweichung ${fmtMin(diff)}`);

    const all = vis.findVisibilityIntervals('moon', start, start + 30, berlin, [freeSky], { ephemeris: eph });
    const dark = vis.findVisibilityIntervals('moon', start, start + 30, berlin, [freeSky], { ephemeris: eph, requireDark: true });
    const sum = list => list.reduce((s, i) => s + i.duration, 0);
    check(sum(dark) < sum(all), `bei Dunkelheit ${(sum(dark) / 60).toFixed(1)} h statt ${(sum(all) / 60).toFixed(1)} h`);
    const sunAtDark = Math.max(...dark.map(i => vis.sunDirection((i.start + i.end) / 2, berlin).trueAltitude));
    check(sunAtDark <= -6, `Sonne in der Mitte der Intervalle höchstens ${sunAtDark.toFixed(1)}°`);

    const grid = vis.computeLevelGrid('sun', [start], 2, berlin, [freeSky]);
    const visibleMinutes = grid.levels.reduce((s, l) => s + (l >= vis.VisibilityLevel.Partial ? 2 : 0), 0);
    const rs = astro.calculateSunRiseSet(start, berlin);
    check(Math.abs(visibleMinutes - (rs.set - rs.rise) * 60) <= 4,
          `Raster: ${visibleMinutes} min Tag, Auf-/Untergang ${((rs.set - rs.rise) * 60).toFixed(1)} min`);
}

// ---------------------------------------------------------------
console.log('7. Laufzeit Jahresraster Sonne (2 min)');
{
    const vp = { name: 'Balkon', sectors: [{ azimuthFrom: 120, azimuthTo: 250, altitudeFrom: 5, altitudeTo: 60 }],
                 horizon: [[100, 12], [140, 8.5], [230, 15]] };
    const start = astro.julianDayFromCalendar(2026, 1, 1, 0);
    const days = Array.from({ length: 365 }, (_, i) => start + i);
    const t0 = Date.now();
    vis.computeLevelGrid('sun', days, 2, berlin, [vp]);
    const ms = Date.now() - t0;
    check(ms < 3000, `${ms} ms`);
}

console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden');
process.exit(failures ? 1 : 0);
