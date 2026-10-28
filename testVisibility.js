// testVisibility.js – Tests für visibility.js und calculateRefraction (Konzept-Sichtbarkeit.md, Stufen 1 bis 3)
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

// ---------------------------------------------------------------
//  Stufe 2: Gebäude und Gelände
// ---------------------------------------------------------------

const origin = { latitude: 52.52, longitude: 13.405 };
// Punkt x Meter östlich, y Meter nördlich von origin
const offset = (x, y) => [origin.latitude + y / (6371000 * DEG2RAD),
                          origin.longitude + x / (6371000 * DEG2RAD * Math.cos(origin.latitude * DEG2RAD))];
// Rechteckiger Grundriss (geschlossener Ring) aus Mittelpunkt und Kantenlängen [m]
const box = (cx, cy, w, d) => [[offset(cx - w / 2, cy + d / 2), offset(cx + w / 2, cy + d / 2), offset(cx + w / 2, cy - d / 2),
                                offset(cx - w / 2, cy - d / 2), offset(cx - w / 2, cy + d / 2)]];

console.log('8. Gebäudehöhe aus OSM-Tags');
{
    const cases = [
        [{ height: '23.5' }, 23.5, 'height'], [{ height: '12 m', 'building:levels': '9' }, 12, 'height'],
        [{ 'building:levels': '5' }, 15, 'levels'], [{ 'building:levels': '5', 'roof:levels': '1' }, 16.5, 'levels'],
        [{ building: 'yes' }, 10, 'default'], [{ height: 'unbekannt' }, 10, 'default'],
    ];
    for (const [tags, h, source] of cases) {
        const r = vis.buildingHeight(tags);
        check(r.height === h && r.source === source, `${JSON.stringify(tags)} → ${r.height} m (${r.source})`);
    }
}

console.log('9. Horizont aus Gebäuden: Würfel 20 m, 50 m südlich');
{
    // Nordwand bei y = −50 m, 20 m breit, 20 m hoch; Auge 1,6 m
    const b = { id: 1, rings: box(0, -60, 20, 20), height: 20, ground: 0 };
    const hz = vis.horizonFromBuildings([b], origin, 1.6);
    const at = az => hz.altitude[Math.round(az / vis.HORIZON_STEP)];
    const expect = Math.atan(18.4 / 50) * RAD2DEG;
    check(Math.abs(at(180) - expect) < 0.01 && Math.abs(hz.distance[720] - 50) < 0.01,
          `Süden ${at(180).toFixed(3)}° (erwartet ${expect.toFixed(3)}°), Entfernung ${hz.distance[720].toFixed(2)} m`);
    const half = Math.atan(10 / 50) * RAD2DEG;  // 11,31°
    check(Number.isFinite(at(180 - 11.25)) && Number.isFinite(at(180 + 11.25)) && isNaN(at(180 - 11.5)) && isNaN(at(180 + 11.5)),
          `Breite ±${half.toFixed(2)}°: Ränder bei ±11,25° belegt, ±11,5° frei`);
    const fromAbove = vis.horizonFromBuildings([b], origin, 30);
    check(fromAbove.altitude[720] < 0, `aus 30 m Höhe unter dem Horizont: ${fromAbove.altitude[720].toFixed(2)}°`);
    const excluded = vis.horizonFromBuildings([b], origin, 1.6, [1]);
    check(excluded.altitude.every(isNaN), 'eigenes Gebäude ausgeschlossen: kein Hindernis');

    const edge = vis.nearestEdge(b.rings, origin.latitude, origin.longitude);
    const facade = vis.facadeAzimuth(b.rings, edge.ring, edge.edge);
    check(edge.edge === 0 && Math.abs(edge.distance - 50) < 0.01 && Math.abs(vis.azimuthInRange(facade, 359.9, 0.1) ? 0 : facade) < 0.01,
          `nächste Kante Nordwand in ${edge.distance.toFixed(2)} m, Fassade ${facade.toFixed(2)}° (Nord)`);
    // Gegenläufiger Ring liefert dieselbe Außennormale; Ostwand zeigt nach Osten
    const reversed = [b.rings[0].slice().reverse()];
    check(Math.abs(vis.facadeAzimuth(reversed, 0, 2) - 90) < 0.01 && Math.abs(vis.facadeAzimuth(b.rings, 0, 1) - 90) < 0.01,
          'Ostwand: 90° in beiden Umlaufrichtungen');
    check(vis.pointInBuilding(b.rings, ...offset(0, -60)) && !vis.pointInBuilding(b.rings, origin.latitude, origin.longitude),
          'Punkt im Gebäude erkannt');
}

console.log('10. Horizont aus dem Gelände (künstliches Gelände)');
{
    const flat = () => 0;
    const dip = Math.sqrt(2 * 100 * (1 - 0.13) / 6371000) * RAD2DEG;    // Kimmtiefe aus 100 m mit Refraktion
    const hFlat = vis.horizonFromTerrain(vis.terrainProfile(flat, origin, { radius: 100000 }), 100);
    check(hFlat.every(v => Math.abs(v + dip) < 0.005), `Ebene aus 100 m: ${hFlat[0].toFixed(3)}° (Kimmtiefe −${dip.toFixed(3)}°)`);

    // Bergrücken 500 m ab 10 km im Osten (Azimut 80°–100°)
    const project = vis.localProjection(origin);
    const ridge = (lat, lon) => {
        const [x, y] = project(lat, lon);
        const az = (Math.atan2(x, y) * RAD2DEG + 360) % 360;
        return az >= 80 && az <= 100 && Math.hypot(x, y) >= 10000 ? 500 : 0;
    };
    const prof = vis.terrainProfile(ridge, origin, { radius: 50000 });
    const hRidge = vis.horizonFromTerrain(prof, 50);
    // Nächster Abtastpunkt ab 10 km; Absenkung durch Krümmung 6,8 m
    const drop = 10000 ** 2 / (2 * 6371000) * 0.87;
    const expect = Math.atan((500 - drop - 50) / 10000) * RAD2DEG;
    check(Math.abs(hRidge[360] - expect) < 0.03 && hRidge[300] < 0,
          `Osten ${hRidge[360].toFixed(3)}° (erwartet ≈ ${expect.toFixed(3)}°), Absenkung 10 km ${drop.toFixed(1)} m, Westen ${hRidge[1080].toFixed(3)}°`);

    // Hülle gegen dichte Abtastung, mehrere Augenhöhen, mit Beschränkung auf den Augenhöhenbereich
    const hills = (lat, lon) => {
        const [x, y] = project(lat, lon);
        return 100 + 80 * Math.sin(x / 3000) * Math.cos(y / 4000) + 30 * Math.sin((x + y) / 1100);
    };
    const hillProfile = vis.terrainProfile(hills, origin, { radius: 20000, eyeRange: [100, 300] });
    let maxDiff = 0;
    for (const eye of [100, 140, 300]) {
        const h = vis.horizonFromTerrain(hillProfile, eye);
        for (let k = 0; k < vis.HORIZON_BINS; k += 37) {
            let best = -90;
            for (let d = 100; d <= 20000; d += d < 2000 ? 5 : 20) {
                const p = vis.destinationPoint(origin, k * vis.HORIZON_STEP, d);
                const z = hills(p.latitude, p.longitude) - d * d / (2 * 6371000) * 0.87;
                best = Math.max(best, Math.atan2(z - eye, d) * RAD2DEG);
            }
            maxDiff = Math.max(maxDiff, Math.abs(h[k] - best));
        }
    }
    const vertices = hillProfile.hulls.reduce((s, h) => s + h.length / 2, 0) / vis.HORIZON_BINS;
    check(maxDiff < 0.05, `Hülle gegen dichte Abtastung: größte Abweichung ${maxDiff.toFixed(3)}°, ${vertices.toFixed(1)} Ecken je Richtung`);
}

console.log('11. Terrarium-Kacheln');
{
    const encode = h => {
        const v = h + 32768;
        return [Math.floor(v / 256), Math.floor(v) % 256, Math.round((v - Math.floor(v)) * 256)];
    };
    const values = [0, 34.5, -10.25, 8848.3];
    const decoded = vis.decodeTerrarium(Uint8ClampedArray.from(values.flatMap(h => [...encode(h), 255])));
    check(values.every((h, i) => Math.abs(decoded[i] - h) < 0.01), `dekodiert: ${Array.from(decoded, v => v.toFixed(2)).join(', ')}`);

    // Künstliche Kacheln mit linearer Höhe in Breite/Länge; der Sampler muss sie wiedergeben,
    // mit 256 Pixeln je Kachel (AWS) und 512 (Mapterhorn)
    const height = (lat, lon) => 30 + 1000 * (lat - 52.5) + 500 * (lon - 13.4);
    const list = vis.terrainTileList(origin, 3000);
    for (const size of [256, 512]) {
        const tiles = new Map();
        for (const { z, x, y } of list) {
            const n = size * 2 ** z, data = new Float32Array(size * size);
            for (let j = 0; j < size; j++) {
                const lat = Math.atan(Math.sinh(Math.PI * (1 - 2 * (y * size + j + 0.5) / n))) * RAD2DEG;
                for (let i = 0; i < size; i++) data[j * size + i] = height(lat, (x * size + i + 0.5) / n * 360 - 180);
            }
            tiles.set(`${z}/${x}/${y}`, data);
        }
        const sample = vis.createTerrainSampler(tiles);
        let maxErr = 0, missing = 0;
        for (let az = 0; az < 360; az += 10) {
            for (const d of [0, 150, 1999, 2500, 3000]) {
                const p = vis.destinationPoint(origin, az, d);
                const h = sample(p.latitude, p.longitude, d);
                if (!Number.isFinite(h)) missing++; else maxErr = Math.max(maxErr, Math.abs(h - height(p.latitude, p.longitude)));
            }
        }
        const zooms = [...new Set(list.map(t => t.z))].join(', ');
        check(missing === 0 && maxErr < 0.05, `${size} px: ${list.length} Kacheln (Zoom ${zooms}) für 3 km, keine Lücke, Fehler ${maxErr.toFixed(3)} m`);

        // Fehlt Zoom 14 (Mapterhorn außerhalb hochaufgelöster Gebiete), springt der Sampler auf Zoom 12
        const coarse = new Map([...tiles].filter(([k]) => !k.startsWith('14/')));
        const h0 = vis.createTerrainSampler(coarse)(origin.latitude, origin.longitude, 0);
        check(Math.abs(h0 - height(origin.latitude, origin.longitude)) < 0.05, `${size} px ohne Zoom 14: ${h0.toFixed(2)} m aus Zoom 12`);
    }
    const far = vis.terrainTileList(origin, 50000), farthest = vis.terrainTileList(origin, 200000);
    check(far.length <= 100 && farthest.length <= 150, `Kacheln für 50 km: ${far.length}, für 200 km: ${farthest.length}`);
}

console.log('12. Berechnetes Profil in der Maske');
{
    const profile = new Float32Array(vis.HORIZON_BINS).fill(-0.3);
    const auto = vis.compileViewpoint({ name: 'hoch', sectors: [], horizon: [] }, profile);
    const both = vis.compileViewpoint({ name: 'Hand', sectors: [], horizon: [[180, 5]] }, profile);
    check(Math.abs(vis.horizonAltitude(auto, 123) + 0.3) < 1e-6 && Math.abs(vis.horizonAltitude(both, 10) - 5) < 1e-6
          && Math.abs(auto.minAltitude + 0.3) < 1e-6,
          'ohne Hand-Punkte gilt das Profil (−0,3°), sonst das Maximum (5°)');
    const ramp = Float32Array.from({ length: vis.HORIZON_BINS }, (_, k) => k % 2 ? 1 : 0);
    check(Math.abs(vis.profileAltitude(ramp, 0.125) - 0.5) < 1e-6 && Math.abs(vis.profileAltitude(ramp, 359.875) - 0.5) < 1e-6,
          'Profil linear zwischen den Stützstellen, auch über Nord');
    const day = astro.julianDayFromCalendar(2026, 3, 20, 0);
    const free = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [freeSky]).find(i => !i.startsBefore);
    const high = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [auto]).find(i => !i.startsBefore);
    const earlier = (free.start - high.start) * 1440;
    check(earlier > 0.5 && earlier < 4, `Horizont −0,3°: Sonne ${earlier.toFixed(2)} min früher sichtbar`);
}

console.log('13. Laufzeit Umgebung');
{
    const buildings = [];
    for (let i = 0; i < 1000; i++) {
        const r = 30 + (i * 7919 % 370), a = i * 2.39996;
        buildings.push({ id: i, rings: box(r * Math.sin(a), r * Math.cos(a), 15, 12), height: 8 + i % 20, ground: 0 });
    }
    let t0 = Date.now();
    vis.horizonFromBuildings(buildings, origin, 10);
    const tb = Date.now() - t0;
    t0 = Date.now();
    const p = vis.terrainProfile((lat, lon) => 40 + 20 * Math.sin(lat * 900) * Math.cos(lon * 700), origin, { radius: 50000, eyeRange: [40, 340] });
    const tt = Date.now() - t0;
    t0 = Date.now();
    vis.horizonFromTerrain(p, 60);
    const th = Date.now() - t0;
    const size = JSON.stringify(p.hulls).length;
    check(tb < 500 && tt < 3000 && th < 100,
          `1000 Gebäude ${tb} ms, Geländeprofil 50 km ${tt} ms, Horizont daraus ${th} ms, gespeichert ${(size / 1024).toFixed(0)} KB`);
}

// ---------------------------------------------------------------
//  Stufe 3: Wohnung und Balkon
// ---------------------------------------------------------------

// Raum 4 × 5 m nach Süden, Wand 35 cm, Fenster 1–3 m, Brüstung 0,9 m, Sturz 2,3 m; Auge mittig 2 m vor der Wand
const room = {
    facade: 180, wall: 0.35,
    room: { width: 4, depth: 5, height: 2.6, windows: [{ wall: 'front', from: 1, to: 3, sill: 0.9, top: 2.3 }] },
    eye: { place: 'room', x: 2, y: 2 },
};
const atan = x => Math.atan(x) * RAD2DEG;

console.log('14. Fenster mit Laibung (Strahltest)');
{
    const cs = vis.compileScene(room, 1.6);
    const free = (A, h) => vis.sceneDirectionFree(cs, A, h);
    // Seitlich begrenzt die Außenkante der Laibung: atan(1 / 2,35)
    const side = atan(1 / 2.35);
    check(free(180 + side - 0.01, 0) && !free(180 + side + 0.01, 0) && free(180 - side + 0.01, 0) && !free(180 - side - 0.01, 0),
          `Breite ±${side.toFixed(2)}° (Außenkante der Laibung)`);
    const up = atan(0.7 / 2.35);
    check(free(180, up - 0.01) && !free(180, up + 0.01) && free(180, -up + 0.01) && !free(180, -up - 0.01),
          `Höhe ±${up.toFixed(2)}° geradeaus (Sturz und Brüstung außen)`);
    // Schräg gesehen ist die Oberkante tiefer: Fensterkanten sind im (A, h)-Raum gekrümmt
    const slanted = atan(0.7 * Math.cos(20 * DEG2RAD) / 2.35);
    check(free(200, slanted - 0.01) && !free(200, slanted + 0.01), `bei 20° seitlich nur bis ${slanted.toFixed(2)}° (gekrümmte Kante)`);
    check(!free(0, 10) && !free(90, 0) && !free(180, 80), 'Rückwand, Seitenwand und Decke verdecken');
    const names = [[180, 0], [180 + side + 1, 0], [180, 18], [0, 10]].map(([A, h]) => (vis.sceneObstacle(cs, A, h) || { name: 'frei' }).name);
    check(names.join(', ') === 'frei, Laibung, Sturz, Wand', `Hindernis benannt: ${names.join(', ')}`);
    const thin = vis.compileScene({ ...room, wall: 0 }, 1.6);
    check(Math.abs(vis.sceneDirectionFree(thin, 180 + atan(0.5) + 0.01, 0) ? 1 : 0) === 0
          && vis.sceneDirectionFree(thin, 180 + atan(0.5) - 0.01, 0), `ohne Wandstärke ±${atan(0.5).toFixed(2)}°`);
}

console.log('15. Raster-Maske gegen exakten Test');
{
    const scenes = [
        ['Raum', room],
        ['Raum mit Eckfenster und Balkon', { ...room,
            room: { ...room.room, windows: [...room.room.windows, { wall: 'left', from: 0.5, to: 2, sill: 0.4, top: 2.3 },
                                            { wall: 'front', from: 3.2, to: 3.8, sill: 0, top: 2.3 }] },
            balcony: { from: 0.5, to: 4.5, depth: 1.6, ceiling: 2.5, slab: true, parapet: 1, dividerRight: true } }],
        ['Balkon', { facade: 210, wall: 0.3, balcony: { from: 0, to: 3, depth: 1.5, ceiling: 2.5, slab: true, parapet: 1,
                                                        dividerLeft: true }, eye: { place: 'balcony', x: 1, y: 0.75 } }],
    ];
    let seed = 12345;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    for (const [name, scene] of scenes) {
        const t0 = Date.now();
        const cs = vis.compileScene(scene, 1.6);
        const ms = Date.now() - t0;
        let wrong = 0, freeCount = 0;
        const n = 50000;
        for (let k = 0; k < n; k++) {
            const A = rnd() * 360, h = -5 + rnd() * 95;
            const exact = vis.sceneDirectionFree(cs, A, h);
            if (exact) freeCount++;
            if (exact !== vis.sceneVisible(cs, A, h)) wrong++;
        }
        check(wrong === 0 && ms < 2000, `${name}: ${wrong} von ${n} Richtungen abweichend, ${(100 * freeCount / n).toFixed(1)} % frei, `
              + `Raster in ${ms} ms, ${cs.rects.length} Rechtecke`);
    }
}

console.log('16. Balkon: Platte, Brüstung, Hauswand, Glas');
{
    const balcony = { facade: 180, wall: 0.3, balcony: { from: 0, to: 3, depth: 1.5, ceiling: 2.5, slab: true, parapet: 1 },
                      eye: { place: 'balcony', x: 1.5, y: 0.75 } };
    const cs = vis.compileScene(balcony, 1.6);
    const free = (A, h) => vis.sceneDirectionFree(cs, A, h);
    const up = atan(0.9 / 0.75), down = atan(0.6 / 0.75);
    check(free(180, up - 0.01) && !free(180, up + 0.01), `Balkonplatte darüber ab ${up.toFixed(2)}°`);
    check(free(180, -down + 0.01) && !free(180, -down - 0.01), `Brüstung bis ${(-down).toFixed(2)}°`);
    check(!free(0, 30) && !free(85, 1) && free(95, 10), 'Hauswand verdeckt alles hinter der Fassade, seitlich über die Brüstung frei');
    const glass = vis.compileScene({ ...balcony, balcony: { ...balcony.balcony, glass: true } }, 1.6);
    check(vis.sceneDirectionFree(glass, 180, -down - 1), 'Glasbrüstung ist durchsichtig');
    const top = vis.compileScene({ ...balcony, balcony: { ...balcony.balcony, slab: false } }, 1.6);
    check(vis.sceneDirectionFree(top, 180, 85) && top.minAltitude < -5, 'ohne Platte (oberstes Geschoss) frei bis zum Zenit');
}

console.log('17. Szene in der Maske und Sonnenfleck');
{
    const vp = vis.compileViewpoint({ name: 'Zimmer', sectors: [], horizon: [], eyeHeight: 1.6, scene: room });
    check(vis.isDirectionVisible(vp, 180, 5) && !vis.isDirectionVisible(vp, 180, 25) && !vis.isDirectionVisible(vp, 180, -1)
          && vp.minAltitude === 0 && vp.scene.minAltitude === -90,
          'Szene wirkt in isDirectionVisible; ohne Umgebung gilt weiter Horizont 0°');
    // Hohe Brüstung (1,5 m): tiefste freie Richtung atan(0,1 / 2,35) unter 0°, eine Rasterstufe Sicherheit
    const high = vis.compileScene({ ...room, room: { ...room.room, windows: [{ ...room.room.windows[0], sill: 1.5 }] } }, 1.6);
    const lowest = -atan(0.1 / 2.35);
    check(high.minAltitude <= lowest && high.minAltitude > lowest - 0.5,
          `Vorprüfung: Fenster ab ${lowest.toFixed(2)}° frei, Schranke ${high.minAltitude.toFixed(2)}°`);
    // 21. Dezember in Berlin: Sonne mittags ≈ 14° im Süden, durchs Fenster sichtbar
    const day = astro.julianDayFromCalendar(2026, 12, 21, 0);
    const free = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [freeSky]).find(i => !i.startsBefore);
    const win = vis.findVisibilityIntervals('sun', day, day + 1, berlin, [vp]).filter(i => !i.startsBefore);
    const minutes = win.reduce((s, i) => s + i.duration, 0);
    check(win.length === 1 && minutes > 60 && minutes < free.duration,
          `21.12.: Sonne ${minutes.toFixed(0)} min durchs Fenster (frei ${free.duration.toFixed(0)} min)`);

    // Sonne aus Süden in 30° Höhe: Fleck x 1…3 m, Abstand zur Wand 0,9/tan 30° … (2,3/tan 30° − 0,35)
    const patch = vis.sunPatch(vp.scene, 180, 30, 0.05);
    const t = Math.tan(30 * DEG2RAD);
    const expected = 2 * (2.3 / t - 0.35 - 0.9 / t);
    const ys = patch.room.map(p => -0.35 - p[1]);
    check(Math.abs(patch.area - expected) < 0.15 && Math.min(...ys) > 0.9 / t - 0.05 && Math.max(...ys) < 2.3 / t - 0.35 + 0.05,
          `Sonnenfleck ${patch.area.toFixed(2)} m² (erwartet ${expected.toFixed(2)} m²), ${(0.9 / t).toFixed(2)}–${(2.3 / t - 0.35).toFixed(2)} m vor der Wand`);
    check(vis.sunPatch(vp.scene, 0, 30).area === 0, 'Sonne von Norden: kein Fleck');

    // Tabelle der Fleckgröße je Richtung: stimmt mit der direkten Rechnung überein
    const table = vis.sunPatchTable(vp.scene);
    let worst = 0;
    for (const [az, alt] of [[180, 30], [165, 15], [200, 40], [150, 25], [181, 9]]) {
        worst = Math.max(worst, Math.abs(vis.sunPatchArea(table, az, alt) - vis.sunPatch(vp.scene, az, alt, 0.05).area));
    }
    check(worst < 0.5, `Fleck aus der Tabelle weicht höchstens ${worst.toFixed(2)} m² ab`);
    check(vis.sunPatchArea(table, 0, 30) === 0 && vis.sunPatchArea(table, 270, 20) === 0 && vis.sunPatchArea(table, 180, -1) === 0,
          'Tabelle: kein Fleck hinter der Fassade und unter dem Horizont');
}

console.log(failures ? `\n${failures} Fehler` : '\nAlle Tests bestanden');
process.exit(failures ? 1 : 0);
