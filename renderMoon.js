// renderMoon.js – Mondphase als PNG-Datei rendern
//
// Voraussetzung:  npm install canvas
//
// Aufruf:
//   node renderMoon.js [--date ISO-UTC] [--lat Grad] [--lon Grad] [--output Datei] [--size px]
//
// Beispiele:
//   node renderMoon.js
//   node renderMoon.js --date 2026-01-15T20:00Z --lat 48.1 --lon 11.6
//   node renderMoon.js --date 2026-01-15T20:00Z --lat 48.1 --lon 11.6 --output mond.png --size 800
//
// Ausgabe: <output>_textur.png  (lroc-Fotografie + Phasenüberlagerung)
//          <output>_schatten.png (mond2.png + pixelweise Schattenmaske)

'use strict';

const { createCanvas, loadImage } = require('canvas');
const fs   = require('fs');
const path = require('path');

const astro  = require('./astro.js');
const render = require('./render.js');

// Globale Abhängigkeiten setzen (von moonRender.js und astro.js intern benötigt)
Object.assign(global, astro, render);

const { drawMoonPhaseTexture, drawMoonPhaseShaded } = require('./moonRender.js');

// ── Argumente ──────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = { date: null, lat: 0, lon: 0, output: 'moon.png', size: 500 };
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const val = args[i + 1];
        if (val === undefined && key !== undefined) {
            console.error(`Fehlender Wert für ${key}`);
            process.exit(1);
        }
        switch (key) {
            case '--date':   opts.date   = val; break;
            case '--lat':    opts.lat    = parseFloat(val); break;
            case '--lon':    opts.lon    = parseFloat(val); break;
            case '--output': opts.output = val; break;
            case '--size':   opts.size   = parseInt(val, 10); break;
            default:
                console.error(`Unbekanntes Argument: ${key}`);
                console.error('Verwendung: node renderMoon.js [--date ISO] [--lat Grad] [--lon Grad] [--output Datei] [--size px]');
                process.exit(1);
        }
    }
    return opts;
}

// ── Hauptprogramm ──────────────────────────────────────────────────────────────

async function main() {
    const opts     = parseArgs();
    const datetime = opts.date ? new Date(opts.date) : new Date();

    if (isNaN(datetime.getTime())) {
        console.error(`Ungültiges Datum: "${opts.date}"\nFormat: ISO-8601, z.B. 2026-01-15T20:00Z`);
        process.exit(1);
    }

    // latitude als global setzen (wird von calculateHAzFromRaDec / calculateParallax benötigt)
    global.latitude = opts.lat;

    // ── Astronomische Berechnungen ──
    const jd              = astro.calculateJulianDate(datetime);
    const siderealTime    = astro.calculateSiderealTime(jd);
    const eclipticalLen   = astro.calculateEclipticalLength(jd);
    const orbitRadius     = astro.calculateOrbitRadiusEarth(astro.calculateTrueAnomaly(jd));
    const siderealRad     = siderealTime / 12 * Math.PI + opts.lon * astro.deg2rad;

    const sunRaDec        = astro.calculateRaDec(eclipticalLen, 0);
    sunRaDec.distance     = orbitRadius * astro.aeTokm;

    const moonCoords      = astro.calculateMoon(jd);
    const moonParallax    = Math.asin(6378.14 / moonCoords.distance);
    const moonRaDecRaw    = astro.calculateRaDec(moonCoords.longitude, moonCoords.latitude);
    const moonRaDec       = astro.calculateParallax(moonRaDecRaw, moonParallax, siderealRad);
    moonRaDec.distance    = moonCoords.distance;

    const moonAxis        = astro.calculateMoonAxis(jd, moonCoords);
    const phase           = astro.calculateMoonPhase(sunRaDec, orbitRadius * astro.aeTokm, moonRaDec, moonCoords.distance);

    // ── Texturen laden ──
    const dir        = __dirname;
    let moonImage1       = null;
    let moonImageOffscreen = null;

    const pathLroc = path.join(dir, 'lroc_color_2k.jpg');
    const pathMond = path.join(dir, 'mond2.png');

    let moonTexData = null;
    if (fs.existsSync(pathLroc)) {
        moonImage1 = await loadImage(pathLroc);
        console.log(`Textur: lroc_color_2k.jpg (${moonImage1.width}×${moonImage1.height})`);
        const texCanvas = createCanvas(moonImage1.width, moonImage1.height);
        texCanvas.getContext('2d').drawImage(moonImage1, 0, 0);
        const imgData = texCanvas.getContext('2d').getImageData(0, 0, moonImage1.width, moonImage1.height);
        moonTexData = { pixels: imgData.data, width: moonImage1.width, height: moonImage1.height };
    } else {
        console.warn('lroc_color_2k.jpg nicht gefunden – Grauton-Fallback.');
    }

    if (fs.existsSync(pathMond)) {
        const mondImg      = await loadImage(pathMond);
        moonImageOffscreen = createCanvas(opts.size, opts.size);
        moonImageOffscreen.getContext('2d').drawImage(mondImg, 0, 0, opts.size, opts.size);
        console.log(`Textur: mond2.png`);
    } else {
        console.warn('mond2.png nicht gefunden – Grauton-Fallback für Schattendarstellung.');
    }

    // ── Rendern ──
    const renderOpts = { considerParallacticAngle: true, considerLibration: true };

    const canvas1 = createCanvas(opts.size, opts.size);
    drawMoonPhaseTexture(
        canvas1.getContext('2d'),
        sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
        siderealRad, opts.lat,
        { moonImage1, texData: moonTexData, ...renderOpts }
    );

    const canvas2 = createCanvas(opts.size, opts.size);
    drawMoonPhaseShaded(
        canvas2.getContext('2d'),
        sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
        siderealRad, opts.lat,
        { moonImageOffscreen, ...renderOpts }
    );

    // ── Speichern ──
    const ext  = path.extname(opts.output);
    const base = opts.output.slice(0, -ext.length || undefined);

    async function savePng(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            canvas.createPNGStream().pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });
    }

    const out1 = `${base}_textur.png`;
    const out2 = `${base}_schatten.png`;

    await savePng(canvas1, out1);
    console.log(`Gespeichert: ${path.resolve(out1)}`);

    await savePng(canvas2, out2);
    console.log(`Gespeichert: ${path.resolve(out2)}`);

    // ── Zusammenfassung ──
    const latStr = opts.lat >= 0 ? `${opts.lat}°N` : `${Math.abs(opts.lat)}°S`;
    const lonStr = opts.lon >= 0 ? `${opts.lon}°E` : `${Math.abs(opts.lon)}°W`;
    console.log(`\nDatum:    ${datetime.toUTCString()}`);
    console.log(`Standort: ${latStr}, ${lonStr}`);
    console.log(`Phase:    ${(phase * 100).toFixed(1)}%`);
    console.log(`Abstand:  ${Math.round(moonCoords.distance).toLocaleString('de-DE')} km`);
}

main().catch(err => {
    console.error('Fehler:', err.message);
    process.exit(1);
});
