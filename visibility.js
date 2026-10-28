/*
 * Sichtbarkeit von Sonne und Mond von einem Standpunkt aus (Konzept-Sichtbarkeit.md, Stufen 1 bis 3).
 * Ohne DOM: im Browser nach astro.js laden (alle Namen global), in Node.js über require('./visibility.js').
 *
 * Konventionen (anders als astro.js in Grad, weil alle Werte aus Eingaben stammen und angezeigt werden):
 *  - Richtungen in Grad: Azimut von Norden über Osten [0, 360), Höhe scheinbar (mit Refraktion).
 *  - Zeitpunkte als Julianischer Tag in UT, Beobachtungsort als { longitude, latitude, elevation } wie in astro.js.
 *  - Standpunkt (wie gespeichert):
 *      { name, sectors: [{ azimuthFrom, azimuthTo, altitudeFrom, altitudeTo }],
 *        horizon: [[azimuth, altitude], …], observations: [{ time, body, event }],
 *        eyeHeight, scene (optional, Stufe 3) }
 *    Für die Rechnung wird er mit compileViewpoint() vorbereitet.
 *
 * Sichtbar ist eine Richtung, wenn sie in einem Sichtbereich-Rechteck liegt (oder keine Rechtecke definiert sind)
 * und über der Horizontlinie. Die Horizontlinie verbindet die Punkte linear im Azimut, ringsum geschlossen;
 * ohne Punkte liegt sie bei 0°, mit einem Punkt überall auf dessen Höhe.
 *
 * Stufe 2: Aus OSM-Gebäuden (horizonFromBuildings) und Geländekacheln (terrainProfile, horizonFromTerrain) entsteht
 * eine berechnete Horizontlinie im 0,25°-Raster; compileViewpoint(viewpoint, profile) nimmt das Maximum aus ihr und
 * der Hand-Horizontlinie.
 *
 * Stufe 3: Eine Szene (Raum mit Fenstern, Balkon) verdeckt zusätzlich alles, was ein Strahl vom Auge nicht durch
 * eine Öffnung ins Freie schafft (compileScene, sceneVisible).
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

    // Berechnete Horizontlinie (Gebäude, Gelände): ein Wert je 0,25° Azimut
    const HORIZON_STEP = 0.25;
    const HORIZON_BINS = 360 / HORIZON_STEP;

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
     * @param profile optional: berechnete Horizontlinie aus Gebäuden und Gelände, HORIZON_BINS Werte [°] für die
     *   Azimute 0°, 0,25°, 0,5° …; nicht endliche Werte gelten als 0°. Mit Profil zählt das Maximum aus
     *   Hand-Horizontlinie und Profil; ohne Hand-Punkte allein das Profil (darf unter 0° liegen).
     */
    function compileViewpoint(viewpoint, profile) {
        const horizon = (viewpoint.horizon || [])
            .filter(p => Number.isFinite(p[0]) && Number.isFinite(p[1]))
            .map(p => [wrap360(p[0]), p[1]])
            .sort((p, q) => p[0] - q[0]);
        const sectors = (viewpoint.sectors || []).filter(s =>
            [s.azimuthFrom, s.azimuthTo, s.altitudeFrom, s.altitudeTo].every(Number.isFinite));
        const prof = profile && profile.length === HORIZON_BINS
            ? Float32Array.from(profile, v => Number.isFinite(v) ? v : 0) : null;

        // Unter dieser Höhe ist nichts sichtbar [°]; beide Linien sind untere Schranken des Maximums
        const handMin = horizon.length ? Math.min(...horizon.map(p => p[1])) : null;
        const profileMin = prof ? prof.reduce((m, v) => Math.min(m, v), Infinity) : null;
        let minAltitude = handMin === null && profileMin === null ? 0 : Math.max(handMin ?? -90, profileMin ?? -90);
        if (sectors.length) {
            minAltitude = Math.max(minAltitude, Math.min(...sectors.map(s => Math.min(s.altitudeFrom, s.altitudeTo))));
        }
        // Wohnung/Balkon (Stufe 3); bereits vorbereitete Szenen (compileScene) werden übernommen
        const scene = viewpoint.scene ? compileScene(viewpoint.scene, viewpoint.eyeHeight ?? 1.6) : null;
        if (scene) minAltitude = Math.max(minAltitude, scene.minAltitude);
        return { compiled: true, name: viewpoint.name, horizon, profile: prof, sectors, scene, minAltitude };
    }

    function compiled(viewpoint) {
        return viewpoint.compiled ? viewpoint : compileViewpoint(viewpoint);
    }

    /** Höhe der Horizontlinie im Azimut [°]: Hand-Punkte, berechnetes Profil oder das Maximum aus beiden */
    function horizonAltitude(viewpoint, azimuth) {
        const vp = compiled(viewpoint);
        const hand = handHorizonAltitude(vp.horizon, azimuth);
        if (!vp.profile) return hand === null ? 0 : hand;
        const auto = profileAltitude(vp.profile, azimuth);
        return hand === null ? auto : Math.max(hand, auto);
    }

    /** Wert eines Horizontprofils (HORIZON_BINS Werte) im Azimut, linear zwischen den Stützstellen [°] */
    function profileAltitude(profile, azimuth) {
        const x = wrap360(azimuth) / HORIZON_STEP;
        const i = Math.min(Math.floor(x), HORIZON_BINS - 1);
        const j = (i + 1) % HORIZON_BINS;
        return profile[i] + (profile[j] - profile[i]) * (x - i);
    }

    // Hand-Horizontlinie im Azimut [°]; null ohne Punkte
    function handHorizonAltitude(pts, azimuth) {
        const n = pts.length;
        if (n === 0) return null;
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
        if (vp.sectors.length && !vp.sectors.some(s =>
            altitude >= Math.min(s.altitudeFrom, s.altitudeTo) && altitude <= Math.max(s.altitudeFrom, s.altitudeTo)
            && azimuthInRange(azimuth, s.azimuthFrom, s.azimuthTo))) return false;
        return !vp.scene || sceneVisible(vp.scene, azimuth, altitude);
    }

    // ---------------------------------------------------------------
    //  Umgebung: Gebäude aus OpenStreetMap und Gelände (Stufe 2)
    //  Orte hier als { latitude, longitude } in Grad, Höhen in m über NN.
    // ---------------------------------------------------------------

    const EARTH_RADIUS_M = 6371000;         // mittlerer Erdradius [m]
    const TERRAIN_REFRACTION = 0.13;        // Refraktionskoeffizient k: Krümmung wirkt nur zu (1 − k)

    /**
     * Gebäudehöhe aus OSM-Tags: height → building:levels × 3 m + roof:levels × 1,5 m → 10 m.
     * @return { height [m], source: 'height' | 'levels' | 'default' }
     */
    function buildingHeight(tags = {}) {
        const num = v => {
            const x = parseFloat(String(v ?? '').replace(',', '.'));
            return Number.isFinite(x) ? x : null;
        };
        const h = num(tags.height);
        if (h !== null && h > 0) return { height: h, source: 'height' };
        const levels = num(tags['building:levels']);
        if (levels !== null && levels > 0) {
            return { height: levels * 3 + (num(tags['roof:levels']) || 0) * 1.5, source: 'levels' };
        }
        return { height: 10, source: 'default' };
    }

    /** Ebene Näherung um origin (bis einige km genau genug): (lat, lon) [°] → [x Ost, y Nord] [m] */
    function localProjection(origin) {
        const k = EARTH_RADIUS_M * DEG2RAD;
        const c = Math.cos(origin.latitude * DEG2RAD);
        return (lat, lon) => [(lon - origin.longitude) * k * c, (lat - origin.latitude) * k];
    }

    // Punkt in Entfernung distance [m] und Azimut azimuth [°] auf der Kugel
    function destinationPoint(origin, azimuth, distance) {
        const phi1 = origin.latitude * DEG2RAD, theta = azimuth * DEG2RAD, delta = distance / EARTH_RADIUS_M;
        const sinPhi2 = Math.sin(phi1) * Math.cos(delta) + Math.cos(phi1) * Math.sin(delta) * Math.cos(theta);
        const phi2 = Math.asin(sinPhi2);
        const dLambda = Math.atan2(Math.sin(theta) * Math.sin(delta) * Math.cos(phi1), Math.cos(delta) - Math.sin(phi1) * sinPhi2);
        return { latitude: phi2 * RAD2DEG, longitude: origin.longitude + dLambda * RAD2DEG };
    }

    /** Liegt der Punkt im Gebäude? Ringe als [[lat, lon], …], gerade/ungerade Regel (Innenhöfe sind außen) */
    function pointInBuilding(rings, lat, lon) {
        let inside = false;
        for (const ring of rings) {
            for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
                const [yi, xi] = ring[i], [yj, xj] = ring[j];
                if ((yi > lat) !== (yj > lat) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) inside = !inside;
            }
        }
        return inside;
    }

    /** Nächste Kante zum Punkt: { ring, edge (Index des Anfangspunkts), distance [m] } oder null */
    function nearestEdge(rings, lat, lon) {
        const project = localProjection({ latitude: lat, longitude: lon });
        let best = null;
        rings.forEach((ring, r) => {
            for (let i = 0; i + 1 < ring.length; i++) {
                const [ax, ay] = project(ring[i][0], ring[i][1]), [bx, by] = project(ring[i + 1][0], ring[i + 1][1]);
                const ex = bx - ax, ey = by - ay, len2 = ex * ex + ey * ey;
                const s = len2 > 0 ? Math.min(1, Math.max(0, -(ax * ex + ay * ey) / len2)) : 0;
                const d = Math.hypot(ax + s * ex, ay + s * ey);
                if (!best || d < best.distance) best = { ring: r, edge: i, distance: d };
            }
        });
        return best;
    }

    /** Fassaden-Azimut einer Kante: Richtung der Wandnormale nach außen [°] */
    function facadeAzimuth(rings, ringIndex, edgeIndex) {
        const ring = rings[ringIndex];
        const [lat1, lon1] = ring[edgeIndex], [lat2, lon2] = ring[edgeIndex + 1];
        const mid = { latitude: (lat1 + lat2) / 2, longitude: (lon1 + lon2) / 2 };
        const project = localProjection(mid);
        const [ax, ay] = project(lat1, lon1), [bx, by] = project(lat2, lon2);
        const len = Math.hypot(bx - ax, by - ay) || 1;
        const nx = (by - ay) / len, ny = -(bx - ax) / len;          // rechts der Kantenrichtung
        // Normale zeigt nach außen, wenn ein Punkt 0,5 m daneben nicht im Gebäude liegt
        const k = 0.5 / (EARTH_RADIUS_M * DEG2RAD);
        const probe = [mid.latitude + ny * k, mid.longitude + nx * k / Math.cos(mid.latitude * DEG2RAD)];
        const outward = pointInBuilding(rings, probe[0], probe[1]) ? -1 : 1;
        return wrap360(Math.atan2(outward * nx, outward * ny) * RAD2DEG);
    }

    /**
     * Horizontlinie aus Gebäuden: Für jedes Azimut (Raster HORIZON_STEP) wird der Strahl mit allen Gebäudekanten
     * geschnitten; der Höhenwinkel zur Dachkante ist atan((ground + height − eyeElevation) / Entfernung).
     * @param buildings [{ id, rings: [[[lat, lon], …], …], height [m], ground [m ü. NN, ohne Gelände 0] }]
     * @param origin Standpunkt { latitude, longitude } [°]
     * @param eyeElevation Augenhöhe [m ü. NN]
     * @param exclude Kennungen, die nicht zählen (eigenes Gebäude)
     * @return { altitude [°] (NaN: kein Gebäude), building (Index in buildings oder −1), distance [m] } je Azimut
     */
    function horizonFromBuildings(buildings, origin, eyeElevation, exclude = []) {
        const excluded = new Set(exclude);
        const altitude = new Float32Array(HORIZON_BINS).fill(NaN);
        const building = new Int32Array(HORIZON_BINS).fill(-1);
        const distance = new Float32Array(HORIZON_BINS).fill(NaN);
        const project = localProjection(origin);

        buildings.forEach((b, index) => {
            if (excluded.has(b.id)) return;
            const dz = (b.ground || 0) + b.height - eyeElevation;
            for (const ring of b.rings) {
                const pts = ring.map(p => project(p[0], p[1]));
                for (let i = 0; i + 1 < pts.length; i++) {
                    const [px, py] = pts[i], [qx, qy] = pts[i + 1];
                    const ex = qx - px, ey = qy - py;
                    // Azimutbereich der Kante (kürzerer Weg); Kanten durch den Standpunkt auslassen
                    const a1 = Math.atan2(px, py) * RAD2DEG;
                    const span = wrap360(Math.atan2(qx, qy) * RAD2DEG - a1 + 180) - 180;
                    if (Math.abs(span) > 179.9) continue;
                    const from = Math.min(a1, a1 + span), to = Math.max(a1, a1 + span);
                    for (let k = Math.ceil(from / HORIZON_STEP); k * HORIZON_STEP <= to; k++) {
                        const A = k * HORIZON_STEP * DEG2RAD;
                        const dx = Math.sin(A), dy = Math.cos(A);
                        const denom = dx * ey - dy * ex;                // d × E
                        if (Math.abs(denom) < 1e-12) continue;
                        const t = (px * ey - py * ex) / denom;           // (P × E) / (d × E)
                        if (t <= 0) continue;
                        const dist = Math.max(t, 1);
                        const alt = Math.atan2(dz, dist) * RAD2DEG;
                        const bin = ((k % HORIZON_BINS) + HORIZON_BINS) % HORIZON_BINS;
                        if (!(alt <= altitude[bin])) {                   // auch wenn noch NaN
                            altitude[bin] = alt;
                            building[bin] = index;
                            distance[bin] = dist;
                        }
                    }
                }
            }
        });
        return { altitude, building, distance };
    }

    // Zoomstufen der Geländekacheln nach Entfernung: nah fein (z 14 ≈ 6 m/Pixel), fern grob
    const TERRAIN_BANDS = [
        { maxDistance: 2000, zoom: 14 },
        { maxDistance: 10000, zoom: 12 },
        { maxDistance: 40000, zoom: 10 },
        { maxDistance: Infinity, zoom: 8 },
    ];

    function terrainZoom(distance) {
        return TERRAIN_BANDS.find(b => distance <= b.maxDistance).zoom;
    }

    // Kachelkoordinaten mit Nachkommastellen (Web-Mercator, unabhängig von der Pixelzahl je Kachel)
    function tileCoord(lat, lon, zoom) {
        const n = 2 ** zoom;
        const phi = lat * DEG2RAD;
        return [(lon + 180) / 360 * n, (1 - Math.log(Math.tan(phi) + 1 / Math.cos(phi)) / Math.PI) / 2 * n];
    }

    /**
     * Benötigte Terrarium-Kacheln für einen Umkreis, je Entfernungsband in dessen Zoomstufe.
     * @param zoom optional: nur diese Zoomstufe (z. B. 14 für die Fußpunkte der Gebäude)
     * @return [{ z, x, y }]
     */
    function terrainTileList(origin, radius, zoom) {
        const bands = zoom === undefined ? TERRAIN_BANDS : [{ maxDistance: Infinity, zoom }];
        const result = [];
        const seen = new Set();
        let inner = 0;
        for (const band of bands) {
            if (inner >= radius) break;
            const r = Math.min(band.maxDistance, radius) + 100;
            const dLat = r / EARTH_RADIUS_M * RAD2DEG;
            const dLon = dLat / Math.max(Math.cos(origin.latitude * DEG2RAD), 0.01);
            const z = band.zoom, n = 2 ** z;
            const [x0, y0] = tileCoord(Math.min(origin.latitude + dLat, 85), origin.longitude - dLon, z);
            const [x1, y1] = tileCoord(Math.max(origin.latitude - dLat, -85), origin.longitude + dLon, z);
            for (let tx = Math.floor(x0); tx <= Math.floor(x1); tx++) {
                for (let ty = Math.max(0, Math.floor(y0)); ty <= Math.min(n - 1, Math.floor(y1)); ty++) {
                    const x = ((tx % n) + n) % n;
                    const key = z + '/' + x + '/' + ty;
                    if (!seen.has(key)) {
                        seen.add(key);
                        result.push({ z, x, y: ty });
                    }
                }
            }
            inner = band.maxDistance;
        }
        return result;
    }

    /** Terrarium-Pixel (RGBA) dekodieren: Höhe = R · 256 + G + B / 256 − 32768 [m] */
    function decodeTerrarium(rgba) {
        const n = rgba.length / 4;
        const out = new Float32Array(n);
        for (let i = 0; i < n; i++) {
            out[i] = rgba[4 * i] * 256 + rgba[4 * i + 1] + rgba[4 * i + 2] / 256 - 32768;
        }
        return out;
    }

    /**
     * Abfrage der Geländehöhe aus dekodierten Kacheln, bilinear zwischen den Pixelmitten.
     * @param tiles Map 'z/x/y' → Float32Array(size · size); die Kachelgröße (256 bei AWS, 512 bei Mapterhorn)
     *   ergibt sich aus der Länge
     * @return sampleElevation(lat, lon, distance = 0) [m]; wählt die Zoomstufe nach distance, fehlt die
     *   Kachel, die nächstgröbere; NaN, wenn keine vorhanden ist
     */
    function createTerrainSampler(tiles) {
        const tileKey = (z, tx, ty) => {
            const n = 2 ** z;
            return z + '/' + (((tx % n) + n) % n) + '/' + ty;
        };
        // Pixel in globalen Pixelkoordinaten bei size Pixeln je Kachel; NaN ohne passende Kachel
        function pixel(z, size, X, Y) {
            const tx = Math.floor(X / size), ty = Math.floor(Y / size);
            const t = tiles.get(tileKey(z, tx, ty));
            return t && t.length === size * size ? t[(Y - ty * size) * size + (X - tx * size)] : NaN;
        }
        function sampleAt(lat, lon, z) {
            const [cx, cy] = tileCoord(lat, lon, z);
            const t = tiles.get(tileKey(z, Math.floor(cx), Math.floor(cy)));
            if (!t) return NaN;
            const size = Math.round(Math.sqrt(t.length));
            const fx = cx * size - 0.5, fy = cy * size - 0.5;
            const X = Math.floor(fx), Y = Math.floor(fy), u = fx - X, v = fy - Y;
            let sum = 0, weight = 0;
            for (const [dx, dy, w] of [[0, 0, (1 - u) * (1 - v)], [1, 0, u * (1 - v)], [0, 1, (1 - u) * v], [1, 1, u * v]]) {
                const h = pixel(z, size, X + dx, Y + dy);
                if (Number.isFinite(h)) { sum += w * h; weight += w; }
            }
            return weight > 1e-9 ? sum / weight : NaN;
        }
        return function sampleElevation(lat, lon, distance = 0) {
            for (let z = terrainZoom(distance); z >= TERRAIN_BANDS[TERRAIN_BANDS.length - 1].zoom; z--) {
                const h = sampleAt(lat, lon, z);
                if (Number.isFinite(h)) return h;
            }
            return NaN;
        };
    }

    // Entfernungen entlang eines Strahls: bis 2 km alle 25 m, darüber Schritte von 1 % der Entfernung
    function terrainDistances(radius, minDistance) {
        const d = [];
        let x = minDistance;
        for (; x <= Math.min(2000, radius); x += 25) d.push(x);
        for (x = Math.max(x, 2000) * 1.01; x < radius; x *= 1.01) d.push(x);
        if (d[d.length - 1] < radius) d.push(radius);
        return d;
    }

    /**
     * Geländeprofil um den Standpunkt: je Azimut die obere konvexe Hülle der Punkte (Entfernung, Höhe), Höhe schon
     * um die Erdkrümmung abgesenkt (Δz = d² / 2R · (1 − k)). Der höchste Höhenwinkel von einem Auge aus liegt immer
     * auf einer Ecke dieser Hülle; so genügen wenige Zahlen pro Richtung und die Augenhöhe bleibt änderbar.
     * @param sampleElevation (lat, lon, distance) → Höhe [m ü. NN] oder NaN (z. B. aus createTerrainSampler)
     * @param options { radius [m] (50 km), minDistance [m] (100; davor erzeugt das grobe Raster Phantom-Hindernisse),
     *   eyeRange [min, max] [m ü. NN] (Ecken außerhalb dieses Augenhöhenbereichs werden weggelassen) }
     * @return { radius, hulls: je Azimut [d0, z0, d1, z1, …] (d [m] gerundet, z [m] auf 0,1 m) }
     */
    function terrainProfile(sampleElevation, origin, options = {}) {
        const radius = options.radius || 50000;
        const distances = terrainDistances(radius, options.minDistance ?? 100);
        const drop = distances.map(d => d * d / (2 * EARTH_RADIUS_M) * (1 - TERRAIN_REFRACTION));
        const hulls = new Array(HORIZON_BINS);
        const xs = [], zs = [];
        for (let k = 0; k < HORIZON_BINS; k++) {
            // Obere Hülle, Entfernung aufsteigend (Andrew)
            xs.length = 0;
            zs.length = 0;
            distances.forEach((d, i) => {
                const p = destinationPoint(origin, k * HORIZON_STEP, d);
                const h = sampleElevation(p.latitude, p.longitude, d);
                if (!Number.isFinite(h)) return;
                // Meer statt Meeresboden (Bathymetrie in den Kacheln)
                const z = Math.max(h, 0) - drop[i];
                while (xs.length >= 2) {
                    const n = xs.length;
                    const cross = (xs[n - 1] - xs[n - 2]) * (z - zs[n - 2]) - (zs[n - 1] - zs[n - 2]) * (d - xs[n - 2]);
                    if (cross < 0) break;
                    xs.pop();
                    zs.pop();
                }
                xs.push(d);
                zs.push(z);
            });
            let first = 0, last = xs.length - 1;
            if (options.eyeRange && xs.length) {
                const a = bestHullIndex(xs, zs, options.eyeRange[0]), b = bestHullIndex(xs, zs, options.eyeRange[1]);
                first = Math.min(a, b);
                last = Math.max(a, b);
            }
            const hull = [];
            for (let i = first; i <= last; i++) hull.push(Math.round(xs[i]), Math.round(zs[i] * 10) / 10);
            hulls[k] = hull;
        }
        return { radius, hulls };
    }

    // Index der Hüllenecke mit dem größten Höhenwinkel vom Auge in Höhe eye
    function bestHullIndex(xs, zs, eye) {
        let best = 0;
        for (let i = 1; i < xs.length; i++) {
            if ((zs[i] - eye) * xs[best] > (zs[best] - eye) * xs[i]) best = i;
        }
        return best;
    }

    /** Horizontlinie aus dem Geländeprofil für eine Augenhöhe [m ü. NN] → HORIZON_BINS Werte [°] (NaN: keine Daten) */
    function horizonFromTerrain(profile, eyeElevation) {
        const out = new Float32Array(HORIZON_BINS).fill(NaN);
        profile.hulls.forEach((hull, k) => {
            let best = -Infinity;
            for (let i = 0; i + 1 < hull.length; i += 2) {
                best = Math.max(best, Math.atan2(hull[i + 1] - eyeElevation, hull[i]));
            }
            if (best > -Infinity) out[k] = best * RAD2DEG;
        });
        return out;
    }

    /** Maximum mehrerer Horizontprofile, NaN-Werte zählen nicht (null-Einträge werden übersprungen) */
    function combineProfiles(...profiles) {
        const out = new Float32Array(HORIZON_BINS).fill(NaN);
        for (const p of profiles) {
            if (!p) continue;
            for (let k = 0; k < HORIZON_BINS; k++) {
                if (Number.isFinite(p[k]) && !(p[k] <= out[k])) out[k] = p[k];
            }
        }
        return out;
    }

    // ---------------------------------------------------------------
    //  Wohnung und Balkon (Stufe 3)
    //  Raum-Koordinaten in m: x entlang der Fassade (nach rechts, Blick nach draußen), y nach außen
    //  (y = 0 ist die Außenseite der Fensterwand), z nach oben (z = 0 Fußboden).
    //  Szene: { facade [°, Außennormale der Fensterwand], wall [m, Wandstärke], anchor { latitude, longitude }
    //           (Punkt x = 0, y = 0 in der Karte, optional),
    //           room: { width, depth, height, windows: [{ wall: 'front'|'left'|'right'|'back', from, to, sill, top }] },
    //           balcony: { from, to, depth, ceiling, slab, parapet, glass, dividerLeft, dividerRight },
    //           eye: { place: 'room'|'balcony', x, y [Abstand zur Wand] } }
    //  Fensterlage from/to: an Fassade und Rückwand ab der linken Raumecke, an den Seitenwänden ab der Fensterwand.
    // ---------------------------------------------------------------

    const SCENE_ALT_MIN = -5;           // Raster-Maske von −5° …
    const SCENE_ALT_MAX = 90;           // … bis 90° Höhe, Knoten alle HORIZON_STEP
    const SCENE_ROWS = Math.round((SCENE_ALT_MAX - SCENE_ALT_MIN) / HORIZON_STEP) + 1;
    const SCENE_FAR = 1e4;              // Ausdehnung der Hauswand hinter dem Balkon [m]
    const SCENE_MARGIN = 0.05;          // Mindestabstand des Auges zu Wänden [m]
    const SCENE_WALLS = ['front', 'left', 'right', 'back'];

    /**
     * Szene prüfen und ergänzen: Zahlen begrenzt, Fenster in ihrer Wand, Auge im Raum bzw. auf dem Balkon.
     * @return bereinigte Kopie oder null (weder Raum noch Balkon)
     */
    function normalizeScene(scene) {
        if (!scene || typeof scene !== 'object') return null;
        const num = (v, def, min, max) => {
            const x = Number(v);
            return Number.isFinite(x) ? Math.min(max, Math.max(min, x)) : def;
        };
        const sorted = (a, b) => a <= b ? [a, b] : [b, a];
        const a = scene.anchor;
        const out = {
            facade: wrap360(num(scene.facade, 180, -1e6, 1e6)),
            wall: num(scene.wall, 0.35, 0, 2),
            anchor: a && Number.isFinite(a.latitude) && Number.isFinite(a.longitude)
                ? { latitude: a.latitude, longitude: a.longitude } : null,
            room: null, balcony: null, eye: null,
        };
        if (scene.room) {
            const r = scene.room;
            const room = { width: num(r.width, 4, 0.3, 100), depth: num(r.depth, 5, 0.3, 100),
                           height: num(r.height, 2.6, 0.5, 20), windows: [] };
            for (const w of Array.isArray(r.windows) ? r.windows : []) {
                if (!w) continue;
                const wall = SCENE_WALLS.includes(w.wall) ? w.wall : 'front';
                const len = wall === 'front' || wall === 'back' ? room.width : room.depth;
                const [from, to] = sorted(num(w.from, 0, 0, len), num(w.to, len, 0, len));
                const [sill, top] = sorted(num(w.sill, 0.9, 0, room.height), num(w.top, room.height, 0, room.height));
                if (to > from && top > sill) room.windows.push({ wall, from, to, sill, top });
            }
            out.room = room;
        }
        if (scene.balcony) {
            const b = scene.balcony;
            const [from, to] = sorted(num(b.from, 0, -100, 200), num(b.to, 3, -100, 200));
            if (to - from >= 0.3) {
                out.balcony = {
                    from, to, depth: num(b.depth, 1.5, 0.3, 20), ceiling: num(b.ceiling, 2.5, 0.5, 20),
                    slab: b.slab !== false, parapet: num(b.parapet, 1, 0, 3), glass: !!b.glass,
                    dividerLeft: !!b.dividerLeft, dividerRight: !!b.dividerRight,
                };
            }
        }
        if (!out.room && !out.balcony) return null;

        // Auge in den freien Raum legen
        const e = scene.eye || {};
        const place = (e.place === 'balcony' && out.balcony) || !out.room ? 'balcony' : 'room';
        const m = SCENE_MARGIN;
        const [x0, x1, depth] = place === 'room' ? [0, out.room.width, out.room.depth]
                                                 : [out.balcony.from, out.balcony.to, out.balcony.depth];
        out.eye = {
            place,
            x: num(e.x, (x0 + x1) / 2, x0 + m, x1 - m),
            y: num(e.y, depth / 2, m, depth - m),
        };
        return out;
    }

    // Undurchsichtiges, achsparalleles Rechteck in der Ebene p[axis] = c; ranges: { Achse: [von, bis] }
    function sceneRect(axis, c, ranges, name) {
        const [o1, o2] = Object.keys(ranges).map(Number).sort();
        return { axis, c, o1, o2, a0: ranges[o1][0], a1: ranges[o1][1], b0: ranges[o2][0], b1: ranges[o2][1], name };
    }

    // Wandfläche (u: Bereich entlang der Wand, z: 0 … Höhe) ohne die Fensterlöcher, zerlegt in Rechtecke
    function wallWithHoles(axis, c, uAxis, uRange, zRange, holes) {
        const rects = [];
        const us = [...new Set([uRange[0], uRange[1], ...holes.flatMap(h => [h.u0, h.u1])])].sort((p, q) => p - q);
        for (let k = 0; k + 1 < us.length; k++) {
            const ua = us[k], ub = us[k + 1];
            if (ub - ua < 1e-9) continue;
            // Löcher in diesem Streifen von unten nach oben; dazwischen bleibt Wand
            const gaps = holes.filter(h => h.u0 <= ua && h.u1 >= ub).map(h => [h.z0, h.z1]).sort((p, q) => p[0] - q[0]);
            let z = zRange[0];
            for (const [g0, g1] of [...gaps, [zRange[1], zRange[1]]]) {
                if (g0 > z + 1e-9) rects.push(sceneRect(axis, c, { [uAxis]: [ua, ub], 2: [z, g0] }, 'Wand'));
                z = Math.max(z, g1);
            }
        }
        return rects;
    }

    /**
     * Rechtecke der Szene für ein Auge im Raum oder auf dem Balkon. Der Raum ist innen geschlossen; jedes
     * Fenster ist ein Durchgang durch die Wand mit vier Laibungsflächen. Vom Balkon aus wirkt die Hauswand als
     * große Fläche (durch die Wohnung sieht man nicht hindurch).
     */
    function sceneRectangles(sc, place) {
        const rects = [];
        const s = sc.wall;
        if (place === 'room' && sc.room) {
            const { width: W, depth: D, height: H } = sc.room;
            const yIn = -s, yBack = -s - D;
            // Wände: Achse der Normalen, Innen- und Außenebene, Achse entlang der Wand und deren Bereich
            const walls = {
                front: { axis: 1, cIn: yIn, cOut: 0, uAxis: 0, range: [0, W], u: (f, t) => [f, t] },
                back: { axis: 1, cIn: yBack, cOut: yBack - s, uAxis: 0, range: [0, W], u: (f, t) => [f, t] },
                left: { axis: 0, cIn: 0, cOut: -s, uAxis: 1, range: [yBack, yIn], u: (f, t) => [yIn - t, yIn - f] },
                right: { axis: 0, cIn: W, cOut: W + s, uAxis: 1, range: [yBack, yIn], u: (f, t) => [yIn - t, yIn - f] },
            };
            for (const [name, w] of Object.entries(walls)) {
                const holes = sc.room.windows.filter(win => win.wall === name).map(win => {
                    const [u0, u1] = w.u(win.from, win.to);
                    return { u0, u1, z0: win.sill, z1: win.top };
                });
                rects.push(...wallWithHoles(w.axis, w.cIn, w.uAxis, w.range, [0, H], holes));
                const thick = [Math.min(w.cIn, w.cOut), Math.max(w.cIn, w.cOut)];
                for (const h of holes) {
                    rects.push(sceneRect(w.uAxis, h.u0, { [w.axis]: thick, 2: [h.z0, h.z1] }, 'Laibung'));
                    rects.push(sceneRect(w.uAxis, h.u1, { [w.axis]: thick, 2: [h.z0, h.z1] }, 'Laibung'));
                    rects.push(sceneRect(2, h.z0, { [w.axis]: thick, [w.uAxis]: [h.u0, h.u1] }, 'Fensterbank'));
                    rects.push(sceneRect(2, h.z1, { [w.axis]: thick, [w.uAxis]: [h.u0, h.u1] }, 'Sturz'));
                }
            }
            rects.push(sceneRect(2, 0, { 0: [0, W], 1: [yBack, yIn] }, 'Fußboden'));
            rects.push(sceneRect(2, H, { 0: [0, W], 1: [yBack, yIn] }, 'Decke'));
        } else {
            rects.push(sceneRect(1, 0, { 0: [-SCENE_FAR, SCENE_FAR], 2: [-SCENE_FAR, SCENE_FAR] }, 'Hauswand'));
        }
        const b = sc.balcony;
        if (b) {
            const xs = [b.from, b.to], ys = [0, b.depth];
            rects.push(sceneRect(2, 0, { 0: xs, 1: ys }, 'Balkonboden'));
            if (b.slab) rects.push(sceneRect(2, b.ceiling, { 0: xs, 1: ys }, 'Balkonplatte darüber'));
            if (b.parapet > 0 && !b.glass) {
                rects.push(sceneRect(1, b.depth, { 0: xs, 2: [0, b.parapet] }, 'Brüstung'));
                rects.push(sceneRect(0, b.from, { 1: ys, 2: [0, b.parapet] }, 'Brüstung'));
                rects.push(sceneRect(0, b.to, { 1: ys, 2: [0, b.parapet] }, 'Brüstung'));
            }
            if (b.dividerLeft) rects.push(sceneRect(0, b.from, { 1: ys, 2: [0, b.ceiling] }, 'Trennwand links'));
            if (b.dividerRight) rects.push(sceneRect(0, b.to, { 1: ys, 2: [0, b.ceiling] }, 'Trennwand rechts'));
        }
        return rects;
    }

    // Nächstes Rechteck auf dem Strahl p + t·d (t > 0) oder null
    function rayHit(rects, p, d) {
        let best = null, bestT = Infinity;
        for (const r of rects) {
            const dn = d[r.axis];
            if (Math.abs(dn) < 1e-12) continue;
            const t = (r.c - p[r.axis]) / dn;
            if (t <= 1e-9 || t >= bestT) continue;
            const q1 = p[r.o1] + t * d[r.o1], q2 = p[r.o2] + t * d[r.o2];
            if (q1 >= r.a0 && q1 <= r.a1 && q2 >= r.b0 && q2 <= r.b1) { best = r; bestT = t; }
        }
        return best && { name: best.name, distance: bestT };
    }

    // Trifft der Strahl p + t·d (t > 0) eines der Rechtecke?
    function rayBlocked(rects, p, d) {
        for (const r of rects) {
            const dn = d[r.axis];
            if (Math.abs(dn) < 1e-12) continue;
            const t = (r.c - p[r.axis]) / dn;
            if (t <= 1e-9) continue;
            const q1 = p[r.o1] + t * d[r.o1];
            if (q1 < r.a0 || q1 > r.a1) continue;
            const q2 = p[r.o2] + t * d[r.o2];
            if (q2 >= r.b0 && q2 <= r.b1) return true;
        }
        return false;
    }

    // Richtung (Azimut, Höhe) [°] in Raum-Koordinaten
    function sceneVector(facade, azimuth, altitude) {
        const a = (azimuth - facade) * DEG2RAD, h = altitude * DEG2RAD;
        return [Math.cos(h) * Math.sin(a), Math.cos(h) * Math.cos(a), Math.sin(h)];
    }

    /**
     * Szene für die Rechnung vorbereiten: Rechtecke für die Augenposition und die Raster-Maske
     * (HORIZON_BINS × SCENE_ROWS Knoten, 1 = frei).
     * @param eyeHeight Augenhöhe über dem Fußboden [m]
     * @return { compiledScene: true, scene, eye [x, y, z], rects, grid, minAltitude } oder null
     */
    function compileScene(scene, eyeHeight = 1.6) {
        if (scene && scene.compiledScene) return scene;
        const sc = normalizeScene(scene);
        if (!sc) return null;
        const e = sc.eye;
        const zMax = e.place === 'room' ? sc.room.height : sc.balcony.slab ? sc.balcony.ceiling : Infinity;
        const z = Math.min(Math.max(eyeHeight, SCENE_MARGIN), zMax - SCENE_MARGIN);
        const eye = e.place === 'room' ? [e.x, -sc.wall - e.y, z] : [e.x, e.y, z];
        const rects = sceneRectangles(sc, e.place);

        const grid = new Uint8Array(HORIZON_BINS * SCENE_ROWS);
        const sinA = new Float64Array(HORIZON_BINS), cosA = new Float64Array(HORIZON_BINS);
        for (let i = 0; i < HORIZON_BINS; i++) {
            const a = (i * HORIZON_STEP - sc.facade) * DEG2RAD;
            sinA[i] = Math.sin(a);
            cosA[i] = Math.cos(a);
        }
        let minAltitude = SCENE_ALT_MAX;
        const d = [0, 0, 0];
        for (let j = SCENE_ROWS - 1; j >= 0; j--) {
            const alt = SCENE_ALT_MIN + j * HORIZON_STEP;
            const ch = Math.cos(alt * DEG2RAD);
            d[2] = Math.sin(alt * DEG2RAD);
            for (let i = 0; i < HORIZON_BINS; i++) {
                d[0] = ch * sinA[i];
                d[1] = ch * cosA[i];
                if (!rayBlocked(rects, eye, d)) {
                    grid[j * HORIZON_BINS + i] = 1;
                    minAltitude = alt;
                }
            }
        }
        // Zwischen den Knoten kann noch etwas frei sein: eine Rasterstufe Sicherheit; unter dem Raster frei,
        // wenn die unterste Zeile frei ist
        minAltitude = minAltitude <= SCENE_ALT_MIN ? -90 : minAltitude - HORIZON_STEP;
        return { compiledScene: true, scene: sc, eye, rects, grid, minAltitude };
    }

    /** Exakter Strahltest: Ist die Richtung (Azimut, Höhe) [°] vom Auge aus frei? */
    function sceneDirectionFree(cs, azimuth, altitude) {
        return !rayBlocked(cs.rects, cs.eye, sceneVector(cs.scene.facade, azimuth, altitude));
    }

    /** Was verdeckt die Richtung? { name (z. B. 'Laibung'), distance [m] } oder null, wenn frei */
    function sceneObstacle(cs, azimuth, altitude) {
        return rayHit(cs.rects, cs.eye, sceneVector(cs.scene.facade, azimuth, altitude));
    }

    /** Wie sceneDirectionFree, aber über die Raster-Maske; nur an Übergängen (Knoten verschieden) exakt */
    function sceneVisible(cs, azimuth, altitude) {
        const y = (altitude - SCENE_ALT_MIN) / HORIZON_STEP;
        const j = Math.floor(y);
        if (j < 0 || j >= SCENE_ROWS - 1) return sceneDirectionFree(cs, azimuth, altitude);
        const x = wrap360(azimuth) / HORIZON_STEP;
        const i = Math.min(Math.floor(x), HORIZON_BINS - 1), i1 = (i + 1) % HORIZON_BINS;
        const g = cs.grid, r0 = j * HORIZON_BINS, r1 = r0 + HORIZON_BINS;
        const v = g[r0 + i];
        if (g[r0 + i1] === v && g[r1 + i] === v && g[r1 + i1] === v) return v === 1;
        return sceneDirectionFree(cs, azimuth, altitude);
    }

    /**
     * Sonnenfleck: Bodenstellen (Raum und Balkon), die aus der Richtung (Azimut, Höhe) [°] frei sind, abgetastet
     * im Raster step [m]. Getestet wird der Strahl vom Boden zur Sonne mit allen Wänden, Laibungen und
     * Balkonteilen; die Umgebung (Horizontlinie) prüft der Aufrufer.
     * @return { step, room: [[x, y], …], balcony: [[x, y], …] (Zellmitten), area [m²] }
     */
    function sunPatch(cs, azimuth, altitude, step = 0.1) {
        const sc = cs.scene;
        const d = sceneVector(sc.facade, azimuth, altitude);
        const result = { step, room: [], balcony: [], area: 0 };
        if (d[2] <= 0) return result;
        const scan = (place, x0, x1, y0, y1) => {
            const rects = sceneRectangles(sc, place);
            const list = result[place];
            for (let x = x0 + step / 2; x < x1; x += step) {
                for (let y = y0 + step / 2; y < y1; y += step) {
                    if (!rayBlocked(rects, [x, y, 1e-6], d)) list.push([x, y]);
                }
            }
            result.area += list.length * step * step;
        };
        if (sc.room) scan('room', 0, sc.room.width, -sc.wall - sc.room.depth, -sc.wall);
        if (sc.balcony) scan('balcony', sc.balcony.from, sc.balcony.to, 0, sc.balcony.depth);
        return result;
    }

    /**
     * Größe des Sonnenflecks für alle Richtungen vorrechnen: Fläche [m²] für Azimut 0–360° × Höhe 0–90° im Raster
     * step [°]. Die Fläche hängt nur von der Richtung ab, nicht vom Datum; für eine Jahresübersicht reicht daher
     * diese Tabelle (sunPatchArea liest sie aus). cell: Abtastweite des Bodens [m], siehe sunPatch.
     * @return { step, cols, rows, area: Float32Array (Zeile = Höhe, Spalte = Azimut) }
     */
    function sunPatchTable(cs, { step = 2, cell = 0.25 } = {}) {
        const cols = Math.round(360 / step), rows = Math.round(90 / step) + 1;
        const area = new Float32Array(cols * rows);
        for (let j = 0; j < rows; j++) {
            // Höhe 0° selbst trifft den Boden nie; die unterste Zeile mit knapp darüber rechnen
            const alt = Math.max(j * step, 0.25);
            for (let i = 0; i < cols; i++) area[j * cols + i] = sunPatch(cs, i * step, alt, cell).area;
        }
        return { step, cols, rows, area };
    }

    /** Fläche des Sonnenflecks [m²] aus der Tabelle, bilinear interpoliert; unter 0,05 m² gilt als kein Fleck */
    function sunPatchArea(table, azimuth, altitude) {
        if (!table || altitude <= 0) return 0;
        const { step, cols, rows, area } = table;
        const x = wrap360(azimuth) / step, y = Math.min(altitude / step, rows - 1);
        const i = Math.floor(x) % cols, i1 = (i + 1) % cols, fx = x - Math.floor(x);
        const j = Math.min(Math.floor(y), rows - 2), fy = y - j;
        const at = (jj, ii) => area[jj * cols + ii];
        const v = (1 - fy) * ((1 - fx) * at(j, i) + fx * at(j, i1)) + fy * ((1 - fx) * at(j + 1, i) + fx * at(j + 1, i1));
        return v < 0.05 ? 0 : v;
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

    /**
     * Hauptphasen im Bereich der Stützstellen: Neumond (0), erstes Viertel (1), Vollmond (2), letztes Viertel (3)
     * bei Elongation 0°, 90°, 180°, 270°, linear zwischen den Stunden.
     * @return [{ jd, phase }] zeitlich sortiert
     */
    function findMoonPhases(eph) {
        const result = [];
        for (let k = 1; k < eph.n; k++) {
            const e0 = eph.elongation[k - 1];
            let e1 = eph.elongation[k];
            if (e1 < e0 - 180) e1 += 360;           // Neumond: Sprung von 360° auf 0°
            for (let p = 0; p < 4; p++) {
                for (const target of [p * 90, p * 90 + 360]) {
                    if (e0 < target && e1 >= target) {
                        result.push({ jd: eph.t0 + (k - 1 + (target - e0) / (e1 - e0)) * eph.step, phase: p });
                    }
                }
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
        HORIZON_STEP, HORIZON_BINS,
        azimuthInRange, compileViewpoint, horizonAltitude, profileAltitude, isDirectionVisible,
        buildingHeight, localProjection, destinationPoint, pointInBuilding, nearestEdge, facadeAzimuth,
        horizonFromBuildings, terrainZoom, terrainTileList, decodeTerrarium, createTerrainSampler,
        terrainProfile, horizonFromTerrain, combineProfiles,
        SCENE_ALT_MIN, SCENE_ALT_MAX, normalizeScene, sceneRectangles, compileScene, sceneDirectionFree, sceneVisible,
        sceneObstacle, sunPatch, sunPatchTable, sunPatchArea,
        apparentAltitude, sunDirection, moonDirection, createMoonEphemeris, findFullMoons, findMoonPhases,
        visibilityLevel, findVisibilityIntervals, computeLevelGrid, computeLevelSeries, observationDirection,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
