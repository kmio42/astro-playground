/*
 * gl3d.js – kleiner eigener WebGL2-Baustein für 3D-Szenen (Konzept-ErdeMond3D.md)
 *
 * Inhalt: 4×4-Matrizen, Strahl-Kugel-Schnitt, Geometrie (Kugel, Scheibe), Linien als Bänder in
 * Bildschirmpixeln, Shader-Programme mit Uniform-Setzern, Texturen, Bahnkamera mit Maus und Touch.
 *
 * Im Browser sind alle öffentlichen Namen unter dem Objekt `gl3d` erreichbar, in Node.js über
 * require('./gl3d.js') (dort nur der Rechenteil ohne WebGL sinnvoll).
 *
 * Konventionen:
 * - mat4 sind Arrays mit 16 Zahlen in Spalten-Reihenfolge wie in WebGL (m[spalte * 4 + zeile]).
 * - Drehmatrizen mit 9 Zahlen (aus orbit3d.js) sind zeilenweise.
 * - „Oben“ ist z. Die Kamera rechnet kamerarelativ: Die Ansichtsmatrix hat das Auge im Ursprung,
 *   Objektorte werden vorher in double um den Augpunkt verschoben (genau auch weit vom Ursprung).
 */
(function (global) {
    'use strict';

    // ---------------------------------------------------------------
    //  Vektoren
    // ---------------------------------------------------------------

    const vec3 = {
        add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
        sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
        scale: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
        dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
        cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
        length: a => Math.hypot(a[0], a[1], a[2]),
        normalize: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
        lerp: (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t],
    };

    // ---------------------------------------------------------------
    //  Matrizen (Spalten-Reihenfolge)
    // ---------------------------------------------------------------

    const mat4 = {
        identity() {
            return [1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1];
        },

        /** Perspektive, fovy = vertikaler Öffnungswinkel [rad] */
        perspective(fovy, aspect, near, far) {
            const f = 1 / Math.tan(fovy / 2);
            const nf = 1 / (near - far);
            return [f / aspect, 0, 0, 0,
                    0, f, 0, 0,
                    0, 0, (far + near) * nf, -1,
                    0, 0, 2 * far * near * nf, 0];
        },

        /** Ansichtsmatrix: Auge, Zielpunkt, Oben-Richtung */
        lookAt(eye, center, up) {
            const z = vec3.normalize(vec3.sub(eye, center));
            const x = vec3.normalize(vec3.cross(up, z));
            const y = vec3.cross(z, x);
            return [x[0], y[0], z[0], 0,
                    x[1], y[1], z[1], 0,
                    x[2], y[2], z[2], 0,
                    -vec3.dot(x, eye), -vec3.dot(y, eye), -vec3.dot(z, eye), 1];
        },

        multiply(a, b) {
            const out = new Array(16);
            for (let c = 0; c < 4; c++) {
                for (let r = 0; r < 4; r++) {
                    out[c * 4 + r] = a[r] * b[c * 4] + a[4 + r] * b[c * 4 + 1]
                                   + a[8 + r] * b[c * 4 + 2] + a[12 + r] * b[c * 4 + 3];
                }
            }
            return out;
        },

        invert(m) {
            const [a00, a01, a02, a03, a10, a11, a12, a13, a20, a21, a22, a23, a30, a31, a32, a33] = m;
            const b00 = a00 * a11 - a01 * a10, b01 = a00 * a12 - a02 * a10;
            const b02 = a00 * a13 - a03 * a10, b03 = a01 * a12 - a02 * a11;
            const b04 = a01 * a13 - a03 * a11, b05 = a02 * a13 - a03 * a12;
            const b06 = a20 * a31 - a21 * a30, b07 = a20 * a32 - a22 * a30;
            const b08 = a20 * a33 - a23 * a30, b09 = a21 * a32 - a22 * a31;
            const b10 = a21 * a33 - a23 * a31, b11 = a22 * a33 - a23 * a32;
            const det = b00 * b11 - b01 * b10 + b02 * b09 + b03 * b08 - b04 * b07 + b05 * b06;
            if (!det) return null;
            const d = 1 / det;
            return [(a11 * b11 - a12 * b10 + a13 * b09) * d, (a02 * b10 - a01 * b11 - a03 * b09) * d,
                    (a31 * b05 - a32 * b04 + a33 * b03) * d, (a22 * b04 - a21 * b05 - a23 * b03) * d,
                    (a12 * b08 - a10 * b11 - a13 * b07) * d, (a00 * b11 - a02 * b08 + a03 * b07) * d,
                    (a32 * b02 - a30 * b05 - a33 * b01) * d, (a20 * b05 - a22 * b02 + a23 * b01) * d,
                    (a10 * b10 - a11 * b08 + a13 * b06) * d, (a01 * b08 - a00 * b10 - a03 * b06) * d,
                    (a30 * b04 - a31 * b02 + a33 * b00) * d, (a21 * b02 - a20 * b04 - a23 * b00) * d,
                    (a11 * b07 - a10 * b09 - a12 * b06) * d, (a00 * b09 - a01 * b07 + a02 * b06) * d,
                    (a31 * b01 - a30 * b03 - a32 * b00) * d, (a20 * b03 - a21 * b01 + a22 * b00) * d];
        },

        /**
         * Modellmatrix aus Drehung (3×3 zeilenweise, Körper → Welt), Verschiebung und Maßstab
         */
        fromRotation3(r, translation, scale) {
            const s = scale === undefined ? 1 : scale;
            const t = translation || [0, 0, 0];
            return [r[0] * s, r[3] * s, r[6] * s, 0,
                    r[1] * s, r[4] * s, r[7] * s, 0,
                    r[2] * s, r[5] * s, r[8] * s, 0,
                    t[0], t[1], t[2], 1];
        },

        /** Punkt (w = 1) transformieren → [x, y, z, w] */
        transformPoint(m, p) {
            return [m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
                    m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
                    m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
                    m[3] * p[0] + m[7] * p[1] + m[11] * p[2] + m[15]];
        },
    };

    /**
     * Schnitt eines Strahls mit einer Kugel.
     * @param origin Startpunkt, dir Richtung (normiert), center, radius
     * @return Abstand t ≥ 0 zum ersten Schnittpunkt oder null
     */
    function raySphere(origin, dir, center, radius) {
        const oc = vec3.sub(origin, center);
        const b = vec3.dot(oc, dir);
        const c = vec3.dot(oc, oc) - radius * radius;
        const disc = b * b - c;
        if (disc < 0) return null;
        const s = Math.sqrt(disc);
        if (-b - s >= 0) return -b - s;
        if (-b + s >= 0) return 0;          // Start liegt in der Kugel
        return null;
    }

    // ---------------------------------------------------------------
    //  Geometrie
    // ---------------------------------------------------------------

    /**
     * Einheitskugel mit Texturkoordinaten für zylindrische Karten (0° Länge in der Bildmitte,
     * Norden oben). Die Naht bei ±180° ist doppelt, damit die Textur nicht springt.
     * Körperachsen: x zu Länge 0°, y zu 90° Ost, z zum Nordpol. Position = Normale.
     * @return { positions: Float32Array (xyz), uvs: Float32Array (uv), indices: Uint32Array }
     */
    function sphereGeometry(nLat, nLon) {
        const positions = new Float32Array((nLat + 1) * (nLon + 1) * 3);
        const uvs = new Float32Array((nLat + 1) * (nLon + 1) * 2);
        let p = 0, q = 0;
        for (let i = 0; i <= nLat; i++) {
            const lat = Math.PI / 2 - Math.PI * i / nLat;
            const cl = Math.cos(lat), sl = Math.sin(lat);
            for (let j = 0; j <= nLon; j++) {
                const lon = -Math.PI + 2 * Math.PI * j / nLon;
                positions[p++] = cl * Math.cos(lon);
                positions[p++] = cl * Math.sin(lon);
                positions[p++] = sl;
                uvs[q++] = j / nLon;
                uvs[q++] = i / nLat;
            }
        }
        const indices = new Uint32Array(nLat * nLon * 6);
        let k = 0;
        for (let i = 0; i < nLat; i++) {
            for (let j = 0; j < nLon; j++) {
                const a = i * (nLon + 1) + j, b = a + nLon + 1;
                indices[k++] = a; indices[k++] = b; indices[k++] = a + 1;
                indices[k++] = a + 1; indices[k++] = b; indices[k++] = b + 1;
            }
        }
        return { positions, uvs, indices };
    }

    /**
     * Kreisscheibe (Kreisring) in der xy-Ebene, Radius 1 außen.
     * @return { positions, indices }
     */
    function discGeometry(innerRadius, n) {
        const positions = new Float32Array((n + 1) * 2 * 3);
        const indices = new Uint32Array(n * 6);
        for (let j = 0; j <= n; j++) {
            const a = 2 * Math.PI * j / n, c = Math.cos(a), s = Math.sin(a);
            positions.set([innerRadius * c, innerRadius * s, 0, c, s, 0], j * 6);
        }
        for (let j = 0; j < n; j++) {
            const a = 2 * j;
            indices.set([a, a + 1, a + 2, a + 2, a + 1, a + 3], j * 6);
        }
        return { positions, indices };
    }

    /**
     * Linienzug als Bänder: Jedes Segment wird zu einem Rechteck (4 Ecken, 2 Dreiecke), das der
     * Linien-Shader in Bildschirmpixeln auf Breite bringt.
     * @param points Array von [x, y, z]
     * @param options { colors: Array von [r, g, b, a] je Punkt oder eine Farbe, dashed: Array von 0/1 je
     *                  Punkt oder ein Wert, dashLength: Länge eines Strich-Lücke-Paares in Welteinheiten }
     * @return Attribut-Arrays { start, end, side, color, dash, indices }
     */
    function lineGeometry(points, options) {
        options = options || {};
        const n = Math.max(0, points.length - 1);
        const start = new Float32Array(n * 12), end = new Float32Array(n * 12);
        const side = new Float32Array(n * 8), color = new Float32Array(n * 16), dash = new Float32Array(n * 8);
        const indices = new Uint32Array(n * 6);
        const colorAt = i => Array.isArray(options.colors && options.colors[0]) ? options.colors[i]
                                                                                : (options.colors || [1, 1, 1, 1]);
        const dashedAt = i => Array.isArray(options.dashed) ? options.dashed[i] : (options.dashed ? 1 : 0);
        const dashLength = options.dashLength || 1;
        let dist = 0;
        for (let s = 0; s < n; s++) {
            const a = points[s], b = points[s + 1];
            const len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
            // Ein Segment ist gestrichelt, wenn einer seiner Endpunkte es ist (Übergänge sauber)
            const dashed = Math.max(dashedAt(s), dashedAt(s + 1));
            const corners = [[0, -1], [0, 1], [1, -1], [1, 1]];
            for (let c = 0; c < 4; c++) {
                const v = s * 4 + c;
                start.set(a, v * 3);
                end.set(b, v * 3);
                side.set(corners[c], v * 2);
                color.set(colorAt(corners[c][0] ? s + 1 : s), v * 4);
                // Strichmuster: Parameter entlang der Linie (in Strich-Lücke-Paaren), dashed-Flag
                dash.set([(dist + corners[c][0] * len) / dashLength, dashed], v * 2);
            }
            dist += len;
            const v0 = s * 4;
            indices.set([v0, v0 + 2, v0 + 1, v0 + 1, v0 + 2, v0 + 3], s * 6);
        }
        return { start, end, side, color, dash, indices };
    }

    // ---------------------------------------------------------------
    //  WebGL: Kontext, Programme, Netze, Texturen
    // ---------------------------------------------------------------

    /** Feste Attribut-Plätze (in den Shadern mit layout(location = …) zu verwenden) */
    const ATTR = { position: 0, uv: 1, start: 2, end: 3, side: 4, color: 5, dash: 6 };

    /** WebGL2-Kontext mit Kantenglättung; null, wenn nicht verfügbar */
    function createContext(canvas) {
        return canvas.getContext('webgl2', { antialias: true, alpha: false, premultipliedAlpha: false });
    }

    /**
     * Zeichenfläche an Anzeigegröße × devicePixelRatio anpassen.
     * @return true, wenn sich die Größe geändert hat
     */
    function resizeCanvas(canvas) {
        const dpr = Math.min(global.devicePixelRatio || 1, 2);
        const w = Math.max(1, Math.round(canvas.clientWidth * dpr));
        const h = Math.max(1, Math.round(canvas.clientHeight * dpr));
        if (canvas.width === w && canvas.height === h) return false;
        canvas.width = w;
        canvas.height = h;
        return true;
    }

    function compileShader(gl, type, source, label) {
        const shader = gl.createShader(type);
        gl.shaderSource(shader, source);
        gl.compileShader(shader);
        if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
            // Fehlermeldung mit der betroffenen Quelltextzeile
            const log = gl.getShaderInfoLog(shader);
            const lines = source.split('\n');
            const detail = log.replace(/ERROR: \d+:(\d+):/g, (m, n) => `${m} [${(lines[n - 1] || '').trim()}]`);
            throw new Error(`Shader ${label}: ${detail}`);
        }
        return shader;
    }

    /**
     * Shader-Programm. Uniforms setzt man mit program.set(name, wert); der Typ kommt aus dem Programm
     * (float, vec2–4, int/sampler, mat3, mat4). Unbekannte Namen werden ignoriert (z. B. wegoptimiert).
     */
    function createProgram(gl, vertexSource, fragmentSource, label) {
        label = label || 'program';
        const program = gl.createProgram();
        gl.attachShader(program, compileShader(gl, gl.VERTEX_SHADER, vertexSource, label + ' (vertex)'));
        gl.attachShader(program, compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource, label + ' (fragment)'));
        gl.linkProgram(program);
        if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
            throw new Error(`Programm ${label}: ${gl.getProgramInfoLog(program)}`);
        }
        const uniforms = {};
        const count = gl.getProgramParameter(program, gl.ACTIVE_UNIFORMS);
        for (let i = 0; i < count; i++) {
            const info = gl.getActiveUniform(program, i);
            uniforms[info.name] = { location: gl.getUniformLocation(program, info.name), type: info.type };
        }
        return {
            program,
            use() { gl.useProgram(program); return this; },
            set(name, value) {
                const u = uniforms[name];
                if (!u) return this;
                const l = u.location;
                switch (u.type) {
                    case gl.FLOAT: gl.uniform1f(l, value); break;
                    case gl.FLOAT_VEC2: gl.uniform2fv(l, value); break;
                    case gl.FLOAT_VEC3: gl.uniform3fv(l, value); break;
                    case gl.FLOAT_VEC4: gl.uniform4fv(l, value); break;
                    case gl.FLOAT_MAT3: gl.uniformMatrix3fv(l, false, value); break;
                    case gl.FLOAT_MAT4: gl.uniformMatrix4fv(l, false, value); break;
                    case gl.BOOL: case gl.INT: case gl.SAMPLER_2D: gl.uniform1i(l, value); break;
                    default: throw new Error('Uniform-Typ nicht unterstützt: ' + name);
                }
                return this;
            },
        };
    }

    /**
     * Netz aus Attributen (Vertex-Array-Objekt).
     * @param attributes { name: { data: Float32Array, size } } mit name aus ATTR
     * @param indices Uint32Array oder null
     * @return { draw(mode), update(attributes, indices) }
     */
    function createMesh(gl, attributes, indices) {
        const vao = gl.createVertexArray();
        const buffers = {};
        let indexBuffer = null, count = 0;
        function upload(attrs, idx) {
            gl.bindVertexArray(vao);
            for (const name of Object.keys(attrs)) {
                const a = attrs[name];
                if (!buffers[name]) {
                    buffers[name] = gl.createBuffer();
                    gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
                    gl.enableVertexAttribArray(ATTR[name]);
                    gl.vertexAttribPointer(ATTR[name], a.size, gl.FLOAT, false, 0, 0);
                }
                gl.bindBuffer(gl.ARRAY_BUFFER, buffers[name]);
                gl.bufferData(gl.ARRAY_BUFFER, a.data, gl.DYNAMIC_DRAW);
                if (!idx) count = a.data.length / a.size;
            }
            if (idx) {
                if (!indexBuffer) indexBuffer = gl.createBuffer();
                gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, indexBuffer);
                gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.DYNAMIC_DRAW);
                count = idx.length;
            }
            gl.bindVertexArray(null);
        }
        upload(attributes, indices);
        return {
            update: upload,
            draw(mode) {
                if (!count) return;
                gl.bindVertexArray(vao);
                if (indexBuffer) gl.drawElements(mode === undefined ? gl.TRIANGLES : mode, count, gl.UNSIGNED_INT, 0);
                else gl.drawArrays(mode === undefined ? gl.TRIANGLES : mode, 0, count);
                gl.bindVertexArray(null);
            },
        };
    }

    /** Linien-Netz direkt aus Punkten (siehe lineGeometry); update(points, options) ersetzt die Punkte */
    function createLineMesh(gl, points, options) {
        const toAttributes = g => ({
            start: { data: g.start, size: 3 }, end: { data: g.end, size: 3 }, side: { data: g.side, size: 2 },
            color: { data: g.color, size: 4 }, dash: { data: g.dash, size: 2 },
        });
        const g = lineGeometry(points, options);
        const mesh = createMesh(gl, toAttributes(g), g.indices);
        return {
            draw: () => mesh.draw(gl.TRIANGLES),
            update(newPoints, newOptions) {
                const h = lineGeometry(newPoints, newOptions);
                mesh.update(toAttributes(h), h.indices);
            },
        };
    }

    /**
     * Textur laden. Bis das Bild da ist, gilt eine 1×1-Ersatzfarbe.
     * @param options { srgb: Farbkarte (sRGB → linear beim Lesen), placeholder: [r, g, b, a] 0–255 }
     * @return { texture, ready: Promise }
     */
    function loadTexture(gl, url, options) {
        options = options || {};
        const texture = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, texture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE,
                      new Uint8Array(options.placeholder || [128, 128, 128, 255]));
        const ready = new Promise((resolve, reject) => {
            const image = new Image();
            image.onload = () => {
                gl.bindTexture(gl.TEXTURE_2D, texture);
                gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
                gl.texImage2D(gl.TEXTURE_2D, 0, options.srgb ? gl.SRGB8_ALPHA8 : gl.RGBA8,
                              gl.RGBA, gl.UNSIGNED_BYTE, image);
                gl.generateMipmap(gl.TEXTURE_2D);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
                // Länge wiederholt sich (Naht bei ±180°), Breite nicht
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.REPEAT);
                gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
                const aniso = gl.getExtension('EXT_texture_filter_anisotropic');
                if (aniso) {
                    gl.texParameterf(gl.TEXTURE_2D, aniso.TEXTURE_MAX_ANISOTROPY_EXT,
                                     Math.min(8, gl.getParameter(aniso.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
                }
                resolve(texture);
            };
            image.onerror = () => reject(new Error('Textur nicht geladen: ' + url));
            image.src = url;
        });
        return { texture, ready };
    }

    // ---------------------------------------------------------------
    //  Bahnkamera
    // ---------------------------------------------------------------

    /**
     * Kamera, die um einen Zielpunkt kreist. „Oben“ ist immer z.
     * Zustand: target (Welt), distance, azimuth (um z, 0 = von +x her), elevation (über der xy-Ebene), fovy.
     * Bedienung (attach): Ziehen dreht, Rad/Pinch zoomt, rechte Taste/Umschalt/zwei Finger verschieben.
     */
    function OrbitCamera(options) {
        options = options || {};
        this.target = options.target || [0, 0, 0];
        this.distance = options.distance || 10;
        this.azimuth = options.azimuth || 0;
        this.elevation = options.elevation || 0.4;
        this.fovy = options.fovy || 40 * Math.PI / 180;
        this.minDistance = options.minDistance || 0.01;
        this.maxDistance = options.maxDistance || 1e6;
        this.animation = null;
        this.onChange = null;          // wird bei Bedienung aufgerufen
        this.onPan = null;             // wird beim Verschieben aufgerufen (z. B. Mitführen beenden)
        this.onRotate = null;          // wird beim Drehen von Hand aufgerufen
    }

    OrbitCamera.prototype.clamp = function () {
        const lim = 89.5 * Math.PI / 180;
        this.elevation = Math.max(-lim, Math.min(lim, this.elevation));
        this.distance = Math.max(this.minDistance, Math.min(this.maxDistance, this.distance));
    };

    /** Richtung vom Ziel zum Auge (Einheitsvektor) */
    OrbitCamera.prototype.direction = function () {
        const ce = Math.cos(this.elevation);
        return [ce * Math.cos(this.azimuth), ce * Math.sin(this.azimuth), Math.sin(this.elevation)];
    };

    OrbitCamera.prototype.eye = function () {
        return vec3.add(this.target, vec3.scale(this.direction(), this.distance));
    };

    /** Ansichtsmatrix mit dem Auge im Ursprung (kamerarelativ) */
    OrbitCamera.prototype.viewMatrix = function () {
        return mat4.lookAt([0, 0, 0], vec3.scale(this.direction(), -1), [0, 0, 1]);
    };

    /** Rechts- und Oben-Vektor der Bildebene in Weltkoordinaten */
    OrbitCamera.prototype.screenAxes = function () {
        const back = this.direction();
        const right = vec3.normalize(vec3.cross([0, 0, 1], back));
        const up = vec3.cross(back, right);
        return { right, up };
    };

    /**
     * Weich zu einem neuen Zustand fahren.
     * @param state { target, distance, azimuth, elevation } (fehlende Werte bleiben)
     */
    OrbitCamera.prototype.animateTo = function (state, duration) {
        const from = { target: this.target.slice(), distance: this.distance, azimuth: this.azimuth,
                       elevation: this.elevation };
        const to = Object.assign({}, from, state);
        // Azimut auf kürzestem Weg
        to.azimuth = from.azimuth + Math.atan2(Math.sin(to.azimuth - from.azimuth), Math.cos(to.azimuth - from.azimuth));
        this.animation = { from, to, start: performance.now(), duration: duration || 800 };
    };

    /**
     * Animation fortschreiben. targetOverride: aktueller Ort des Ziels, falls es sich bewegt.
     * @return true, solange die Animation läuft
     */
    OrbitCamera.prototype.update = function (now) {
        const a = this.animation;
        if (!a) return false;
        const t = Math.min(1, (now - a.start) / a.duration);
        const e = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;   // weich an- und auslaufen
        this.target = vec3.lerp(a.from.target, a.to.target, e);
        // Abstand logarithmisch, damit große Zoomsprünge gleichmäßig wirken
        this.distance = Math.exp(Math.log(a.from.distance) + (Math.log(a.to.distance) - Math.log(a.from.distance)) * e);
        this.azimuth = a.from.azimuth + (a.to.azimuth - a.from.azimuth) * e;
        this.elevation = a.from.elevation + (a.to.elevation - a.from.elevation) * e;
        this.clamp();
        if (t >= 1) this.animation = null;
        return true;
    };

    /** Zielpunkt während einer Animation nachführen (bewegtes Ziel) */
    OrbitCamera.prototype.retarget = function (target) {
        if (this.animation) this.animation.to.target = target.slice();
        else this.target = target.slice();
    };

    /** Bedienung an ein Element hängen */
    OrbitCamera.prototype.attach = function (element) {
        const cam = this;
        const pointers = new Map();
        let pinch = null;
        const changed = () => { cam.clamp(); if (cam.onChange) cam.onChange(); };
        const pan = (dx, dy) => {
            const { right, up } = cam.screenAxes();
            const k = 2 * cam.distance * Math.tan(cam.fovy / 2) / element.clientHeight;
            cam.target = vec3.add(cam.target, vec3.add(vec3.scale(right, -dx * k), vec3.scale(up, dy * k)));
            if (cam.onPan) cam.onPan();
        };
        element.addEventListener('contextmenu', ev => ev.preventDefault());
        element.addEventListener('pointerdown', ev => {
            element.setPointerCapture(ev.pointerId);
            pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY, button: ev.button, shift: ev.shiftKey });
            cam.animation = null;
            pinch = null;
        });
        element.addEventListener('pointermove', ev => {
            const p = pointers.get(ev.pointerId);
            if (!p) return;
            const dx = ev.clientX - p.x, dy = ev.clientY - p.y;
            if (pointers.size === 1) {
                if (p.button === 2 || p.shift || ev.shiftKey) pan(dx, dy);
                else {
                    cam.azimuth -= dx * 0.006;
                    cam.elevation += dy * 0.006;
                    if (cam.onRotate) cam.onRotate();
                }
                p.x = ev.clientX; p.y = ev.clientY;
            } else if (pointers.size === 2) {
                p.x = ev.clientX; p.y = ev.clientY;
                const [a, b] = [...pointers.values()];
                const dist = Math.hypot(a.x - b.x, a.y - b.y);
                const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
                if (pinch) {
                    if (dist > 0 && pinch.dist > 0) cam.distance *= pinch.dist / dist;
                    pan(mid.x - pinch.mid.x, mid.y - pinch.mid.y);
                }
                pinch = { dist, mid };
            }
            changed();
        });
        const up = ev => { pointers.delete(ev.pointerId); pinch = null; };
        element.addEventListener('pointerup', up);
        element.addEventListener('pointercancel', up);
        element.addEventListener('wheel', ev => {
            ev.preventDefault();
            const delta = ev.deltaMode === 1 ? ev.deltaY * 33 : ev.deltaY;
            cam.animation = null;
            cam.distance *= Math.exp(delta * 0.0015);
            changed();
        }, { passive: false });
    };

    /**
     * Strahl durch einen Bildpunkt (CSS-Pixel relativ zum Element).
     * @return { origin, dir } in Weltkoordinaten
     */
    OrbitCamera.prototype.ray = function (x, y, width, height) {
        const proj = mat4.perspective(this.fovy, width / height, 1, 10);
        const inv = mat4.invert(mat4.multiply(proj, this.viewMatrix()));
        const ndc = [2 * x / width - 1, 1 - 2 * y / height];
        const far = mat4.transformPoint(inv, [ndc[0], ndc[1], 1]);
        const dir = vec3.normalize([far[0] / far[3], far[1] / far[3], far[2] / far[3]]);
        return { origin: this.eye(), dir };
    };

    /**
     * Weltpunkt → Bildpunkt (CSS-Pixel). viewProj ist die kamerarelative Matrix, eye der Augpunkt.
     * @return { x, y, visible (vor der Kamera und im Bild) }
     */
    function projectPoint(viewProj, eye, point, width, height) {
        const p = mat4.transformPoint(viewProj, vec3.sub(point, eye));
        if (p[3] <= 0) return { x: 0, y: 0, visible: false };
        const x = (p[0] / p[3] + 1) / 2 * width, y = (1 - p[1] / p[3]) / 2 * height;
        return { x, y, visible: x >= -50 && x <= width + 50 && y >= -50 && y <= height + 50 };
    }

    // ---------------------------------------------------------------
    //  Export
    // ---------------------------------------------------------------

    const api = {
        vec3, mat4, raySphere, sphereGeometry, discGeometry, lineGeometry,
        ATTR, createContext, resizeCanvas, createProgram, createMesh, createLineMesh, loadTexture,
        OrbitCamera, projectPoint,
    };
    if (typeof module !== 'undefined' && module.exports) module.exports = api;
    else global.gl3d = api;
})(typeof window !== 'undefined' ? window : globalThis);
