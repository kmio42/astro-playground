// moonRender.js
// Gemeinsame Monddarstellungs-Funktionen für Browser (Mond.html) und Node.js (renderMoon.js).
//
// Abhängigkeiten – in Browser global aus astro.js/render.js; in Node.js vor require() setzen:
//   Object.assign(global, require('./astro.js'), require('./render.js'))
//
//   astro.js:   epsilon, deg2rad, moonOrbitRadius
//   render.js:  createRotationMatrix, multiplyMatrix, transposeMatrix, applyMatrix,
//               drawPolygonLine, calculateLatitudePoints, calculateLongitudePoints

/**
 * Rendert realistische Mondansicht (lroc-Textur + Phasenüberlagerung + Gitternetz).
 * Entspricht drawMoonPhase1 aus Mond.html; ctx ersetzt document.getElementById.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} sunRaDec   {ra, dec, distance}  ra/dec in Rad, distance in km
 * @param {Object} moonRaDec  {ra, dec, distance}  ra/dec in Rad, distance in km
 * @param {number} moonAxisAngle   Positionswinkel Mondachse [Rad]
 * @param {Object} libration       {longitude, latitude} [Rad]
 * @param {number} siderealtime    Sternzeit + Längenkorrektur [Rad]
 * @param {number} latitude        Beobachterbreite [Grad]
 * @param {Object} [opts]
 * @param {*}       opts.moonImage1              Textur-Bild (lroc_color_2k.jpg) oder null
 * @param {boolean} [opts.considerParallacticAngle=true]
 * @param {boolean} [opts.considerLibration=true]
 */
function drawMoonPhaseTexture(ctx, sunRaDec, moonRaDec, moonAxisAngle, libration, siderealtime, latitude, opts) {
    opts = opts || {};
    const moonImage1 = opts.moonImage1 || null;
    const considerParallacticAngle = opts.considerParallacticAngle !== false;
    const considerLibration        = opts.considerLibration !== false;

    const cosPsi = Math.sin(sunRaDec.dec) * Math.sin(moonRaDec.dec) +
        Math.cos(sunRaDec.dec) * Math.cos(moonRaDec.dec) * Math.cos(sunRaDec.ra - moonRaDec.ra);

    const i = Math.atan2(sunRaDec.distance * Math.sqrt(1 - cosPsi * cosPsi),
        moonRaDec.distance - sunRaDec.distance * cosPsi);
    const k = (1 + Math.cos(i)) / 2;

    const chi = Math.atan2(
        Math.cos(sunRaDec.dec) * Math.sin(sunRaDec.ra - moonRaDec.ra),
        Math.sin(sunRaDec.dec) * Math.cos(moonRaDec.dec) -
        Math.cos(sunRaDec.dec) * Math.sin(moonRaDec.dec) * Math.cos(sunRaDec.ra - moonRaDec.ra)
    );

    const q = considerParallacticAngle
        ? Math.atan2(
            Math.sin(siderealtime - moonRaDec.ra),
            Math.tan(latitude * deg2rad) * Math.cos(moonRaDec.dec) -
            Math.sin(moonRaDec.dec) * Math.cos(siderealtime - moonRaDec.ra))
        : 0;

    const libLatitudeRot  = createRotationMatrix({x:1, y:0, z:0},  considerLibration ? -libration.latitude  : 0);
    const libLongitudeRot = createRotationMatrix({x:0, y:-1, z:0}, considerLibration ? -libration.longitude : 0);
    const axleRot         = createRotationMatrix({x:0, y:0, z:1},  -moonAxisAngle + q);
    let rotMatrix = multiplyMatrix(libLongitudeRot, libLatitudeRot);
    rotMatrix     = multiplyMatrix(rotMatrix, axleRot);

    const coordinateTransform = [[1,0,0],[0,0,1],[0,1,0]];
    let rot1Matrix = multiplyMatrix(coordinateTransform, transposeMatrix(rotMatrix));
    rot1Matrix     = multiplyMatrix(rot1Matrix, coordinateTransform);

    const r = Math.floor(Math.min(ctx.canvas.width / 2,
        moonOrbitRadius / moonRaDec.distance * ctx.canvas.width / 2 * 0.93));

    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);

    for (let y = -r; y < r; y++) {
        for (let x = -r; x < r; x++) {
            if (x * x + y * y > r * r) continue;
            const z = Math.sqrt(r * r - x * x - y * y);
            const point = applyMatrix({x, y: -y, z}, rotMatrix);
            const len = Math.sqrt(point.x * point.x + point.y * point.y + point.z * point.z);
            point.x /= len; point.y /= len; point.z /= len;
            const lon_moon = Math.atan2(point.x, point.z);
            const lat_moon = Math.asin(Math.max(-1, Math.min(1, point.y)));
            if (moonImage1) {
                const u = Math.floor((lon_moon + Math.PI) / (2 * Math.PI) * moonImage1.width);
                const v = Math.floor((Math.PI / 2 - lat_moon) / Math.PI * moonImage1.height);
                ctx.drawImage(moonImage1, u, v, 1, 1, x, y, 1, 1);
            } else {
                ctx.fillStyle = '#afa89c';
                ctx.fillRect(x, y, 1, 1);
            }
        }
    }

    // Phasenüberlagerung
    ctx.save();
    ctx.rotate(-chi + q);
    ctx.beginPath();
    ctx.ellipse(0, 0, r, Math.abs(1 - k * 2) * r, 0, 0, Math.PI, k <= 0.5);
    ctx.arc(0, 0, r, Math.PI, 0, true);
    ctx.closePath();
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fill();
    ctx.restore();

    // Mittelpunkt + Gitternetz (Äquator, Nullmeridian)
    ctx.fillStyle = 'red';
    ctx.fillRect(-2, -2, 4, 4);
    drawPolygonLine(ctx, calculateLatitudePoints(r, 0, rot1Matrix), 'red', true);
    drawPolygonLine(ctx, calculateLongitudePoints(r, Math.PI / 2, rot1Matrix), 'red', true);
}

/**
 * Rendert Mondphase mit mond2.png-Textur und pixelweiser Schattenberechnung.
 * Entspricht dem Rendering-Teil von drawMoonPhase aus Mond.html.
 *
 * @param {CanvasRenderingContext2D} ctx
 * @param {Object} sunRaDec
 * @param {Object} moonRaDec
 * @param {number} moonAxisAngle
 * @param {Object} libration  {longitude, latitude}
 * @param {number} siderealtime
 * @param {number} latitude
 * @param {Object} [opts]
 * @param {*}       opts.moonImageOffscreen  Canvas mit mond2.png in Ausgabegröße (oder null → Grauton)
 * @param {boolean} [opts.considerParallacticAngle=true]
 * @param {boolean} [opts.considerLibration=true]
 */
function drawMoonPhaseShaded(ctx, sunRaDec, moonRaDec, moonAxisAngle, libration, siderealtime, latitude, opts) {
    opts = opts || {};
    const moonImageOffscreen       = opts.moonImageOffscreen || null;
    const considerParallacticAngle = opts.considerParallacticAngle !== false;
    const considerLibration        = opts.considerLibration !== false;

    const cosPsi = Math.sin(sunRaDec.dec) * Math.sin(moonRaDec.dec) +
        Math.cos(sunRaDec.dec) * Math.cos(moonRaDec.dec) * Math.cos(sunRaDec.ra - moonRaDec.ra);

    const i = Math.atan2(sunRaDec.distance * Math.sqrt(1 - cosPsi * cosPsi),
        moonRaDec.distance - sunRaDec.distance * cosPsi);
    const k = (1 + Math.cos(i)) / 2;

    const chi = Math.atan2(
        Math.cos(sunRaDec.dec) * Math.sin(sunRaDec.ra - moonRaDec.ra),
        Math.sin(sunRaDec.dec) * Math.cos(moonRaDec.dec) -
        Math.cos(sunRaDec.dec) * Math.sin(moonRaDec.dec) * Math.cos(sunRaDec.ra - moonRaDec.ra)
    );

    const q = considerParallacticAngle
        ? Math.atan2(
            Math.sin(siderealtime - moonRaDec.ra),
            Math.tan(latitude * deg2rad) * Math.cos(moonRaDec.dec) -
            Math.sin(moonRaDec.dec) * Math.cos(siderealtime - moonRaDec.ra))
        : 0;

    // Rotationsmatrizen inkl. Ausrichtungskorrektur für mond2.png
    const rotY1_1 = createRotationMatrix({x:0, y:-1, z:0}, considerLibration ? -libration.longitude : 0);
    const rotX1_1 = createRotationMatrix({x:1, y:0, z:0},  considerLibration ? -libration.latitude  : 0);
    const rotZ1_1 = createRotationMatrix({x:0, y:0, z:1},  -moonAxisAngle + q);
    const rotX1_2 = createRotationMatrix({x:1, y:0, z:0},   5.78 * deg2rad);
    const rotY1_2 = createRotationMatrix({x:0, y:-1, z:0}, -2.24 * deg2rad);
    const rotZ1_2 = createRotationMatrix({x:0, y:0, z:1},   9    * deg2rad);

    let rotMatrix = multiplyMatrix(rotZ1_2, rotX1_2);
    rotMatrix = multiplyMatrix(rotMatrix, rotY1_2);
    rotMatrix = multiplyMatrix(rotMatrix, rotY1_1);
    rotMatrix = multiplyMatrix(rotMatrix, rotX1_1);
    rotMatrix = multiplyMatrix(rotMatrix, rotZ1_1);

    ctx.resetTransform();
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.fillStyle = 'black';
    ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.translate(ctx.canvas.width / 2, ctx.canvas.height / 2);
    ctx.fillStyle = '#afa89c';

    const mask = chi - q + Math.PI / 2;
    const r    = ctx.canvas.width / 2;
    const b    = r * r;
    let a      = r * r;
    if (k > 0.5) {
        a *= (k * 2 - 1) * (k * 2 - 1);
    } else {
        a *= (1 - k * 2) * (1 - k * 2);
    }
    const cosMask = Math.cos(-mask);
    const sinMask = Math.sin(-mask);

    for (let y = -r; y < r; y++) {
        for (let x = -r; x < r; x++) {
            if (x * x + y * y > r * r) continue;
            const conditionX = Math.floor(x * cosMask + y * sinMask);
            const conditionY = Math.floor(-x * sinMask + y * cosMask);
            const ellipse    = conditionX * conditionX * b + conditionY * conditionY * a - a * b;
            const pixelActive = k > 0.5
                ? (conditionX >= 0 || ellipse <= 0)
                : (conditionX >= 0 && ellipse > 0);
            if (pixelActive) {
                const z     = Math.sqrt(r * r - x * x - y * y);
                const point = applyMatrix({x, y: -y, z}, rotMatrix);
                if (moonImageOffscreen && point.z >= 0) {
                    ctx.drawImage(moonImageOffscreen,
                        Math.round(point.x + r), Math.round(-point.y + r), 1, 1,
                        x, y, 1, 1);
                } else {
                    ctx.fillRect(x, y, 1, 1);
                }
            }
        }
    }
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { drawMoonPhaseTexture, drawMoonPhaseShaded };
}
