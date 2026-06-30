// renderMoon.js – Render moon phase to PNG file(s)
//
// Requires:  npm install canvas
//
// Single frame:
//   node renderMoon.js [--date ISO-UTC | --jd <JD>] [--lat deg] [--lon deg]
//                      [--output file] [--size px] [--render texture|picture|both]
//                      [--no-cross] [--no-libration] [--no-parallactic] [--no-distance]
//
// Sweep (one parameter varies, the rest are fixed):
//   node renderMoon.js --sweep time|jd|lat|lon --start <val> --stop <val> --step <val>
//                      [--date ISO | --jd <JD>] [--lat deg] [--lon deg]
//                      [--basename name] [--size px] [--render texture|picture|both]
//                      [--no-cross] [--no-libration] [--no-parallactic] [--no-distance]
//
//   --sweep time : --start/--stop as ISO-UTC timestamps, --step in hours
//   --sweep jd   : --start/--stop/--step as Julian Day numbers
//   --sweep lat  : --start/--stop/--step in decimal degrees (--date/--jd and --lon fixed)
//   --sweep lon  : --start/--stop/--step in decimal degrees (--date/--jd and --lat fixed)
//
// Output (single frame):
//   <output>_textur.png   (LROC photo + phase overlay)   when render=texture|both
//   <output>_schatten.png (mond2.png + shadow mask)       when render=picture|both
//
// Output (sweep):
//   <basename>_0001_textur.png, <basename>_0001_schatten.png, …
//
// Render options (all default to enabled):
//   --no-cross        do not draw the cardinal cross on the texture render
//   --no-libration    ignore libration when computing the moon orientation
//   --no-parallactic  ignore the parallactic angle (north-up instead of horizon-up)
//   --no-distance     do not scale the moon disc by its current distance

'use strict';

const { createCanvas, loadImage } = require('canvas');
const fs   = require('fs');
const path = require('path');

const astro  = require('./astro.js');
const render = require('./render.js');

Object.assign(global, astro, render);

const { drawMoonPhaseTexture, drawMoonPhasePicture } = require('./moonRender.js');

// ── Argument parser ────────────────────────────────────────────────────────────

const BOOL_FLAGS = new Set(['--no-cross', '--no-libration', '--no-parallactic', '--no-distance']);

function printHelp() {
    console.log([
        'Usage:',
        '  node renderMoon.js [options]',
        '',
        'Time input (mutually exclusive):',
        '  --date <ISO-UTC>     UTC timestamp, e.g. 2026-01-15T20:00Z  (default: now)',
        '  --jd   <number>      Julian Day number',
        '',
        'Location:',
        '  --lat  <deg>         Latitude  in decimal degrees (default: 0)',
        '  --lon  <deg>         Longitude in decimal degrees (default: 0)',
        '',
        'Output:',
        '  --output   <file>    Base name for single-frame output (default: moon)',
        '  --basename <name>    Base name for sweep output        (default: moon)',
        '  --size     <px>      Canvas size in pixels             (default: 500)',
        '  --render   <mode>    texture | picture | both          (default: texture)',
        '',
        'Render flags (all enabled by default):',
        '  --no-cross           Omit the cardinal cross (texture render only)',
        '  --no-libration       Ignore libration',
        '  --no-parallactic     Ignore the parallactic angle (north-up)',
        '  --no-distance        Do not scale disc by distance (texture render only)',
        '',
        'Sweep:',
        '  --sweep time|jd|lat|lon',
        '  --start <val>        Start value (ISO or JD for time/jd sweep, degrees otherwise)',
        '  --stop  <val>        Stop value',
        '  --step  <val>        Step size (hours for --sweep time, days for --sweep jd)',
    ].join('\n'));
}

function parseArgs() {
    const args = process.argv.slice(2);
    const opts = {
        date:        null,
        jd:          null,
        lat:         0,
        lon:         0,
        output:      'moon',
        basename:    null,
        size:        500,
        render:      'texture',
        sweep:       null,
        start:       null,
        stop:        null,
        step:        null,
        cross:       true,
        libration:   true,
        parallactic: true,
        distance:    true,
    };

    for (let i = 0; i < args.length; ) {
        const key = args[i];

        if (BOOL_FLAGS.has(key)) {
            switch (key) {
                case '--no-cross':       opts.cross       = false; break;
                case '--no-libration':   opts.libration   = false; break;
                case '--no-parallactic': opts.parallactic = false; break;
                case '--no-distance':    opts.distance    = false; break;
            }
            i += 1;
            continue;
        }

        if (key === '--help' || key === '-h') { printHelp(); process.exit(0); }

        const val = args[i + 1];
        if (val === undefined || val.startsWith('--')) {
            console.error(`Missing value for ${key}`);
            process.exit(1);
        }

        switch (key) {
            case '--date':     opts.date     = val; break;
            case '--jd':       opts.jd       = parseFloat(val); break;
            case '--lat':      opts.lat      = parseFloat(val); break;
            case '--lon':      opts.lon      = parseFloat(val); break;
            case '--output':   opts.output   = val; break;
            case '--basename': opts.basename = val; break;
            case '--size':     opts.size     = parseInt(val, 10); break;
            case '--render':
                if (!['texture', 'picture', 'both'].includes(val)) {
                    console.error(`--render must be texture, picture, or both (got: "${val}")`);
                    process.exit(1);
                }
                opts.render = val;
                break;
            case '--sweep':
                if (!['time', 'jd', 'lat', 'lon'].includes(val)) {
                    console.error(`--sweep must be time, jd, lat, or lon (got: "${val}")`);
                    process.exit(1);
                }
                opts.sweep = val;
                break;
            case '--start': opts.start = val; break;
            case '--stop':  opts.stop  = val; break;
            case '--step':  opts.step  = val; break;
            default:
                console.error(`Unknown argument: ${key}`);
                console.error('Run with --help for usage.');
                process.exit(1);
        }
        i += 2;
    }

    if (opts.date !== null && opts.jd !== null) {
        console.error('--date and --jd are mutually exclusive');
        process.exit(1);
    }
    return opts;
}

// ── Resolve base time to JD ────────────────────────────────────────────────────

function baseJdFromOpts(opts) {
    if (opts.jd !== null) {
        if (isNaN(opts.jd)) { console.error('Invalid JD value'); process.exit(1); }
        return opts.jd;
    }
    const dt = opts.date ? new Date(opts.date) : new Date();
    if (isNaN(dt.getTime())) {
        console.error(`Invalid date: "${opts.date}" — expected ISO-8601, e.g. 2026-01-15T20:00Z`);
        process.exit(1);
    }
    return astro.calculateJulianDate(dt);
}

// ── Build frame sequence ───────────────────────────────────────────────────────

function buildFrames(opts) {
    if (!opts.sweep) {
        return [{ jd: baseJdFromOpts(opts), lat: opts.lat, lon: opts.lon }];
    }

    if (opts.start === null || opts.stop === null || opts.step === null) {
        console.error('--sweep requires --start, --stop, and --step');
        process.exit(1);
    }

    const frames = [];

    if (opts.sweep === 'time') {
        const start  = new Date(opts.start);
        const stop   = new Date(opts.stop);
        const stepMs = parseFloat(opts.step) * 3_600_000;
        if (isNaN(start) || isNaN(stop) || isNaN(stepMs) || stepMs <= 0) {
            console.error('Invalid time sweep parameters (--start/--stop as ISO, --step in hours)');
            process.exit(1);
        }
        for (let t = start.getTime(); t <= stop.getTime() + 1; t += stepMs)
            frames.push({ jd: astro.calculateJulianDate(new Date(t)), lat: opts.lat, lon: opts.lon });

    } else if (opts.sweep === 'jd') {
        const start = parseFloat(opts.start);
        const stop  = parseFloat(opts.stop);
        const step  = parseFloat(opts.step);
        if (isNaN(start) || isNaN(stop) || isNaN(step) || step <= 0) {
            console.error('Invalid JD sweep parameters (--start/--stop/--step as Julian Day numbers)');
            process.exit(1);
        }
        for (let jd = start; jd <= stop + 1e-9; jd += step)
            frames.push({ jd, lat: opts.lat, lon: opts.lon });

    } else {
        const start = parseFloat(opts.start);
        const stop  = parseFloat(opts.stop);
        const step  = parseFloat(opts.step);
        if (isNaN(start) || isNaN(stop) || isNaN(step) || step <= 0) {
            console.error(`Invalid ${opts.sweep} sweep parameters`);
            process.exit(1);
        }
        const baseJd = baseJdFromOpts(opts);
        for (let v = start; v <= stop + 1e-9; v += step) {
            if (opts.sweep === 'lat')
                frames.push({ jd: baseJd, lat: v,        lon: opts.lon });
            else
                frames.push({ jd: baseJd, lat: opts.lat, lon: v        });
        }
    }

    if (frames.length === 0) {
        console.error('Sweep produces no frames (stop < start?)');
        process.exit(1);
    }
    return frames;
}

// ── JD → human-readable timestamp ─────────────────────────────────────────────

function jdToLabel(jd) {
    const g        = astro.calculateGregorianDateFromJulianDate(jd);
    const y        = String(g.year).padStart(4, '0');
    const mo       = String(g.month).padStart(2, '0');
    const d        = String(Math.floor(g.day)).padStart(2, '0');
    const totalMin = Math.round((g.day - Math.floor(g.day)) * 1440);
    const h        = String(Math.floor(totalMin / 60)).padStart(2, '0');
    const mi       = String(totalMin % 60).padStart(2, '0');
    return `${y}-${mo}-${d}T${h}:${mi}Z  (JD ${jd.toFixed(4)})`;
}

// ── Astronomical calculations for one frame ────────────────────────────────────

function computeAstro(jd, lat, lon) {
    global.latitude = lat;

    const siderealTime  = astro.calculateSiderealTime(jd);
    const eclipticalLen = astro.calculateEclipticalLength(jd);
    const orbitRadius   = astro.calculateOrbitRadiusEarth(astro.calculateTrueAnomaly(jd));
    const siderealRad   = siderealTime / 12 * Math.PI + lon * astro.deg2rad;

    const sunRaDec    = astro.calculateRaDec(eclipticalLen, 0);
    sunRaDec.distance = orbitRadius * astro.aeTokm;

    const moonCoords   = astro.calculateMoon(jd);
    const moonParallax = Math.asin(6378.14 / moonCoords.distance);
    const moonRaDecRaw = astro.calculateRaDec(moonCoords.longitude, moonCoords.latitude);
    const moonRaDec    = astro.calculateParallax(moonRaDecRaw, moonParallax, siderealRad);
    moonRaDec.distance = moonCoords.distance;

    const moonAxis = astro.calculateMoonAxis(jd, moonCoords);
    const phase    = astro.calculateMoonPhase(sunRaDec, orbitRadius * astro.aeTokm, moonRaDec, moonCoords.distance);

    return { sunRaDec, moonRaDec, moonAxis, siderealRad, moonCoords, phase };
}

// ── Render and save one frame ──────────────────────────────────────────────────

async function renderFrame(frame, textures, opts, outBase) {
    const { jd, lat, lon } = frame;
    const { moonImage1, moonTexData, moonImageOffscreen } = textures;

    const { sunRaDec, moonRaDec, moonAxis, siderealRad, moonCoords, phase } =
        computeAstro(jd, lat, lon);

    const renderOpts = {
        considerParallacticAngle: opts.parallactic,
        considerLibration:        opts.libration,
        drawCross:                opts.cross,
        considerDistance:         opts.distance,
    };

    async function savePng(canvas, filePath) {
        return new Promise((resolve, reject) => {
            const out = fs.createWriteStream(filePath);
            canvas.createPNGStream().pipe(out);
            out.on('finish', resolve);
            out.on('error', reject);
        });
    }

    const saved = [];

    if (opts.render === 'texture' || opts.render === 'both') {
        const canvas = createCanvas(opts.size, opts.size);
        drawMoonPhaseTexture(
            canvas.getContext('2d'),
            sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
            siderealRad, lat,
            { moonImage1, texData: moonTexData, ...renderOpts }
        );
        const p = `${outBase}_textur.png`;
        await savePng(canvas, p);
        saved.push(p);
    }

    if (opts.render === 'picture' || opts.render === 'both') {
        const canvas = createCanvas(opts.size, opts.size);
        drawMoonPhasePicture(
            canvas.getContext('2d'),
            sunRaDec, moonRaDec, moonAxis.axle, moonAxis.libration,
            siderealRad, lat,
            { moonImageOffscreen, ...renderOpts }
        );
        const p = `${outBase}_schatten.png`;
        await savePng(canvas, p);
        saved.push(p);
    }

    const latStr = lat >= 0 ? `${lat.toFixed(2)}°N` : `${Math.abs(lat).toFixed(2)}°S`;
    const lonStr = lon >= 0 ? `${lon.toFixed(2)}°E` : `${Math.abs(lon).toFixed(2)}°W`;
    const files  = saved.map(p => path.basename(p)).join(', ');
    console.log(`${files}  |  ${jdToLabel(jd)}  ${latStr} ${lonStr}  phase ${(phase * 100).toFixed(1)}%  ${Math.round(moonCoords.distance).toLocaleString('en-US')} km`);

    return saved;
}

// ── Load textures (once) ───────────────────────────────────────────────────────

async function loadTextures(opts) {
    const dir = __dirname;
    let moonImage1 = null, moonTexData = null, moonImageOffscreen = null;

    if (opts.render === 'texture' || opts.render === 'both') {
        const p = path.join(dir, 'lroc_color_2k.jpg');
        if (fs.existsSync(p)) {
            moonImage1 = await loadImage(p);
            console.log(`Texture: lroc_color_2k.jpg (${moonImage1.width}×${moonImage1.height})`);
            const tc = createCanvas(moonImage1.width, moonImage1.height);
            tc.getContext('2d').drawImage(moonImage1, 0, 0);
            const id = tc.getContext('2d').getImageData(0, 0, moonImage1.width, moonImage1.height);
            moonTexData = { pixels: id.data, width: moonImage1.width, height: moonImage1.height };
        } else {
            console.warn('lroc_color_2k.jpg not found — greyscale fallback.');
        }
    }

    if (opts.render === 'picture' || opts.render === 'both') {
        const p = path.join(dir, 'mond2.png');
        if (fs.existsSync(p)) {
            const img      = await loadImage(p);
            moonImageOffscreen = createCanvas(opts.size, opts.size);
            moonImageOffscreen.getContext('2d').drawImage(img, 0, 0, opts.size, opts.size);
            console.log('Texture: mond2.png');
        } else {
            console.warn('mond2.png not found — greyscale fallback for shadow render.');
        }
    }

    return { moonImage1, moonTexData, moonImageOffscreen };
}

// ── Main ───────────────────────────────────────────────────────────────────────

async function main() {
    const opts     = parseArgs();
    const frames   = buildFrames(opts);
    const textures = await loadTextures(opts);

    if (!opts.sweep) {
        const ext  = path.extname(opts.output);
        const base = ext ? opts.output.slice(0, -ext.length) : opts.output;
        const saved = await renderFrame(frames[0], textures, opts, base);
        for (const p of saved) console.log(`Saved: ${path.resolve(p)}`);
    } else {
        const basename = opts.basename ?? 'moon';
        const ext      = path.extname(basename);
        const base     = ext ? basename.slice(0, -ext.length) : basename;
        const pad      = Math.max(String(frames.length).length, 4);

        console.log(`\nSweep: ${frames.length} frame(s), base "${base}", render: ${opts.render}\n`);

        for (let i = 0; i < frames.length; i++) {
            const num = String(i + 1).padStart(pad, '0');
            await renderFrame(frames[i], textures, opts, `${base}_${num}`);
        }

        console.log(`\n${frames.length} frame(s) saved.`);
    }
}

main().catch(err => {
    console.error('Error:', err.message);
    process.exit(1);
});
