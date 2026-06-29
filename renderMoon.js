// renderMoon.js – Mondphase als PNG-Datei rendern
//
// Voraussetzung:  npm install canvas
//
// Aufruf (Einzelbild):
//   node renderMoon.js [--date ISO-UTC] [--lat Grad] [--lon Grad] [--output Datei] [--size px]
//
// Aufruf (Sweep):
//   node renderMoon.js --sweep time|lat|lon --start <Wert> --stop <Wert> --step <Wert>
//                      [--date ISO] [--lat Grad] [--lon Grad] [--basename Name] [--size px]
//
//   Sweep time: --start/--stop als ISO-UTC, --step in Stunden
//   Sweep lat:  --start/--stop in Dezimalgrad, --step in Grad (--date und --lon gelten fest)
//   Sweep lon:  --start/--stop in Dezimalgrad, --step in Grad (--date und --lat gelten fest)
//
// Ausgabe (Einzelbild):
//   <output>_textur.png   (lroc-Fotografie + Phasenüberlagerung)
//   <output>_schatten.png (mond2.png + pixelweise Schattenmaske)
//
// Ausgabe (Sweep):
//   <basename>_0001_textur.png, <basename>_0001_schatten.png, …

'use strict';

const { createCanvas, loadImage } = require('canvas');
const fs   = require('fs');
const path = require('path');

const astro  = require('./astro.js');
const render = require('./render.js');

Object.assign(global, astro, render);

const { drawMoonPhaseTexture, drawMoonPhaseShaded } = require('./moonRender.js');

// ── Argumente ──────────────────────────────────────────────────────────────────

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        date:     null,
        lat:      0,
        lon:      0,
        output:   'moon',
        basename: null,
        size:     500,
        sweep:    null,   // 'time' | 'lat' | 'lon'
        start:    null,
        stop:     null,
        step:     null,
    };
    for (let i = 0; i < args.length; i += 2) {
        const key = args[i];
        const val = args[i + 1];
        if (val === undefined) {
            console.error(`Fehlender Wert für ${key}`);
            process.exit(1);
        }
        switch (key) {
            case '--date':     opts.date     = val; break;
            case '--lat':      opts.lat      = parseFloat(val); break;
            case '--lon':      opts.lon      = parseFloat(val); break;
            case '--output':   opts.output   = val; break;
            case '--basename': opts.basename = val; break;
            case '--size':     opts.size     = parseInt(val, 10); break;
            case '--sweep':
                if (!['time', 'lat', 'lon'].includes(val)) {
                    console.error(`--sweep muss time, lat oder lon sein (war: "${val}")`);
                    process.exit(1);
                }
                opts.sweep = val;
                break;
            case '--start': opts.start = val; break;
            case '--stop':  opts.stop  = val; break;
            case '--step':  opts.step  = val; break;
            default:
                console.error(`Unbekanntes Argument: ${key}`);
                console.error('Verwendung: node renderMoon.js [--date ISO] [--lat Grad] [--lon Grad] [--output Datei] [--size px]');
                console.error('            node renderMoon.js --sweep time|lat|lon --start <Wert> --stop <Wert> --step <Wert> [--basename Name] [...]');
                process.exit(1);
        }
    }
    return opts;
}

// ── Sweep-Sequenz erzeugen ─────────────────────────────────────────────────────

function buildFrames(opts) {
    if (!opts.sweep) {
        const datetime = opts.date ? new Date(opts.date) : new Date();
        if (isNaN(datetime.getTime())) {
            console.error(`Ungültiges Datum: "${opts.date}"`);
            process.exit(1);
        }
        return [{ datetime, lat: opts.lat, lon: opts.lon }];
    }

    if (opts.start === null || opts.stop === null || opts.step === null) {
        console.error('--sweep erfordert --start, --stop und --step');
        process.exit(1);
    }

    const frames = [];

    if (opts.sweep === 'time') {
        const start    = new Date(opts.start);
        const stop     = new Date(opts.stop);
        const stepMs   = parseFloat(opts.step) * 3600_000; // Stunden → ms
        if (isNaN(start) || isNaN(stop) || isNaN(stepMs) || stepMs <= 0) {
            console.error('Ungültige Zeit-Sweep-Parameter (--start/--stop als ISO, --step in Stunden)');
            process.exit(1);
        }
        for (let t = start.getTime(); t <= stop.getTime() + 1; t += stepMs) {
            frames.push({ datetime: new Date(t), lat: opts.lat, lon: opts.lon });
        }
    } else {
        const start = parseFloat(opts.start);
        const stop  = parseFloat(opts.stop);
        const step  = parseFloat(opts.step);
        if (isNaN(start) || isNaN(stop) || isNaN(step) || step <= 0) {
            console.error(`Ungültige ${opts.sweep}-Sweep-Parameter`);
            process.exit(1);
        }
        const baseDate = opts.date ? new Date(opts.date) : new Date();
        if (isNaN(baseDate.getTime())) {
            console.error(`Ungültiges Datum: "${opts.date}"`);
            process.exit(1);
        }
        for (let v = start; v <= stop + 1e-9; v += step) {
            if (opts.sweep === 'lat') {
                frames.push({ datetime: baseDate, lat: v, lon: opts.lon });
            } else {
                frames.push({ datetime: baseDate, lat: opts.lat, lon: v });
            }
        }
    }

    if (frames.length === 0) {
        console.error('Sweep ergibt keine Frames (stop < start?)');
        process.exit(1);
    }
    return frames;
}

// ── Astronomische Berechnungen für einen Frame ─────────────────────────────────

function computeAstro(datetime, lat, lon) {
    global.latitude = lat;

    const jd            = astro.calculateJulianDate(datetime);
    const siderealTime  = astro.calculateSiderealTime(jd);
    const eclipticalLen = astro.calculateEclipticalLength(jd);
    const orbitRadius   = astro.calculateOrbitRadiusEarth(astro.calculateTrueAnomaly(jd));
    const siderealRad   = siderealTime / 12 * Math.PI + lon * astro.deg2rad;

    const sunRaDec      = astro.calculateRaDec(eclipticalLen, 0);
    sunRaDec.distance   = orbitRadius * astro.aeTokm;

    const moonCoords    = astro.calculateMoon(jd);
    const moonParallax  = Math.asin(6378.14 / moonCoords.distance);
    const moonRaDecRaw  = astro.calculateRaDec(moonCoords.longitude, moonCoords.latitude);
    const moonRaDec     = astro.calculateParallax(moonRaDecRaw, moonParallax, siderealRad);
    moonRaDec.distance  = moonCoords.distance;

    const moonAxis      = astro.calculateMoonAxis(jd, moonCoords);
    const phase         = astro.calculateMoonPhase(sunRaDec, orbitRadius * astro.aeTokm, moonRaDec, moonCoords.distance);

    return { sunRaDec, moonRaDec, moonAxis, siderealRad, moonCoords, phase };
}

// ── Einen Frame rendern und speichern ──────────────────────────────────────────

async function renderFrame(frame, textures, opts, outBase) {
    const { datetime, lat, lon } = frame;
    const { moonImage1, moonTexData, moonImageOffscreen } = textures;

    const { sunRaDec, moonRaDec, moonAxis, siderealRad, moonCoords, phase } =
        computeAstro(datetime, lat, lon);

    const renderOpts = { considerParallacticAngle: true, considerLibration: true };

    const canvas1 = createCanvas(opts.size, opts.size);
    drawMoonPhaseTexture(
        canvas1.getContext('2d'),
        sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
        siderealRad, lat,
        { moonImage1, texData: moonTexData, ...renderOpts }
    );

    const canvas2 = createCanvas(opts.size, opts.size);
    drawMoonPhaseShaded(
        canvas2.getContext('2d'),
        sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
        siderealRad, lat,
        { moonImageOffscreen, ...renderOpts }
    );

    async function savePng(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            canvas.createPNGStream().pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });
    }

    const out1 = `${outBase}_textur.png`;
    const out2 = `${outBase}_schatten.png`;
    await savePng(canvas1, out1);
    await savePng(canvas2, out2);

    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
    console.log(`${path.basename(out1)}  |  ${datetime.toISOString().slice(0,16)}Z  ${latStr} ${lonStr}  Phase ${(phase * 100).toFixed(1)}%  Abstand ${Math.round(moonCoords.distance).toLocaleString('de-DE')} km`);

    return { out1, out2 };
}

// ── Texturen laden (einmalig) ──────────────────────────────────────────────────

async function loadTextures(size) {
    const dir = __dirname;
    let moonImage1         = null;
    let moonTexData        = null;
    let moonImageOffscreen = null;

    const pathLroc = path.join(dir, 'lroc_color_2k.jpg');
    const pathMond = path.join(dir, 'mond2.png');

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
        moonImageOffscreen = createCanvas(size, size);
        moonImageOffscreen.getContext('2d').drawImage(mondImg, 0, 0, size, size);
        console.log(`Textur: mond2.png`);
    } else {
        console.warn('mond2.png nicht gefunden – Grauton-Fallback für Schattendarstellung.');
    }

    return { moonImage1, moonTexData, moonImageOffscreen };
}

// ── Hauptprogramm ──────────────────────────────────────────────────────────────

async function main() {
    const opts   = parseArgs();
    const frames = buildFrames(opts);
    const sweep  = opts.sweep !== null;

    const textures = await loadTextures(opts.size);

    if (!sweep) {
        // Einzelbild: --output bestimmt Basisnamen (Erweiterung wird abgeschnitten)
        const ext  = path.extname(opts.output);
        const base = ext ? opts.output.slice(0, -ext.length) : opts.output;
        const { out1, out2 } = await renderFrame(frames[0], textures, opts, base);
        console.log(`\nGespeichert: ${path.resolve(out1)}`);
        console.log(`Gespeichert: ${path.resolve(out2)}`);
    } else {
        // Sweep: --basename bestimmt Basisnamen, Dateien erhalten fortlaufende Nummer
        const basename = opts.basename ?? 'moon';
        const ext      = path.extname(basename);
        const base     = ext ? basename.slice(0, -ext.length) : basename;
        const pad      = String(frames.length).length;  // Anzahl Stellen

        console.log(`\nSweep: ${frames.length} Frame(s), Basis "${base}"\n`);

        for (let i = 0; i < frames.length; i++) {
            const num    = String(i + 1).padStart(Math.max(pad, 4), '0');
            const outBase = `${base}_${num}`;
            await renderFrame(frames[i], textures, opts, outBase);
        }

        console.log(`\n${frames.length} Frame(s) gespeichert.`);
    }
}

main().catch(err => {
    console.error('Fehler:', err.message);
    process.exit(1);
});
