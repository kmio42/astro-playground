# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

A personal sandbox for experimenting with astronomical calculations and visualizations. It computes and visualizes solar/lunar positions, rise/set times, moon phases, and coordinate transformations. All algorithms are based on Jean Meeus' *Astronomische Algorithmen* (Astronomical Algorithms).

## Running the Code

No build step required. HTML files run directly in a browser:

```bash
firefox Mond.html
firefox Erdposition.html
```

Exception: `Sichtbarkeit.html` needs a local web server for the map, because the OpenStreetMap tile servers block requests without a Referer (as sent from `file://`): `python3 -m http.server 8000`, then open `http://localhost:8000/Sichtbarkeit.html`. `ErdeMond3D.html` needs the same server, because WebGL may not use image files from `file://` as textures.

The C++ files live in `cpp/` (`astro.cpp`, `astro.h`, examples in `cpp/beispiele/`, documented in `cpp/README.md`). They have no Makefile and are not integrated into any HTML page — they are a standalone reimplementation in the `astro::` namespace, kept compatible with C++11 (Arduino cores). Build an example: `cd cpp/beispiele && g++ -std=c++11 -I.. sonne.cpp ../astro.cpp -o sonne`.

## Architecture

**`astro.js`** is the core mathematical library (~1385 lines), a port of `cpp/astro.cpp` with the same function names, parameters and result objects (see `cpp/README.md`). Self-contained, wrapped in an IIFE; in the browser all public names are global, in Node.js they come from `require('./astro.js')`. Angles are numbers in radians, time is a Julian Day number in UT (ΔT is applied internally), locations are `{ longitude, latitude, elevation }` objects (radians, east positive). It exports:

- **Constants**: `DEG2RAD`, `RAD2DEG`, `AU_KM`, `EARTH_RADIUS`, `MOON_RADIUS`, `MOON_ORBIT_RADIUS`, `EARTH_SEMI_MAJOR_AXIS`, `OBLIQUITY_J2000`, `EquinoxType`, `ApsisType`
- **Time**: `julianDayFromCalendar()`, `julianDayFromDate()`, `julianDayToDate()`, `julianDayMidnight()`, `deltaT()`, `taiMinusUtc()`, `dynamicalTime()`, `julianDayFromDynamicalTime()`, `calculateEaster()`
- **Solar**: `calculateSunPosition()`, `calculateObliquity()`, `calculateEquationOfTime()`, `calculateEarthTrueAnomaly()`, `calculateEarthEccentricity()`, `calculateGreenwichSiderealTime()`, `calculateLocalSiderealTime()`, `calculateSunRiseSet()`, `calculateEquinoxSolstice()`, `calculateNextEarthApsis()`
- **Coordinate transforms**: `calculateEquatorial()`, `calculateHorizontal()`, `calculateTopocentric()`, `calculateParallacticAngle()`, `calculateRefraction()` (formula 15.4, true → apparent altitude)
- **Lunar**: `calculateMoonPosition()`, `calculateMoonPositionSimple()`, `calculateMoonIlluminatedFraction()`, `calculateMoonOrientation()` (libration, position angle), `calculateMoonAscendingNode()`, `calculateMoonRiseSet()`, `calculateNextMoonApsis()`, `calculateNextMoonNode()`
- **Utilities**: `interpolate()`, `normalizeAngle()`, `normalizeAngleSigned()`, `angleFromDms()`

When changing an algorithm, change `astro.js` and `cpp/astro.cpp` together; their results agree to about 1e-11.

**`render.js`** — small shared 3D rendering helpers: rotation matrices (`createRotationMatrix(axle, angle)`, `multiplyMatrix()`, `transposeMatrix()`, `applyMatrix()`) and canvas line drawing for spheres (`drawPolygonLine()`, `calculateLatitudePoints()`, `calculateLongitudePoints()`). Used by `Erdposition.html` (tilted Earth view), `Mond.html` and `moonRender.js`.

**`moonRender.js`** — moon surface rendering shared by `Mond.html` and the Node.js script `renderMoon.js` (renders moon phase PNGs, needs `npm install canvas`): `drawMoonPhaseTexture()` (pixel-by-pixel mapping of the NASA LROC texture) and `drawMoonPhasePicture()` (moon photo `mond2.png` with pixel-by-pixel shadow). Both take phase, position angle of the axis, libration and parallactic angle into account. Depends on globals from `astro.js` and `render.js`.

**`ui.js`** — shared UI state and formatting helpers (`radToDegString`, time formatting, common variables like `datetime`, `latitude`, `longitude` in degrees, `useLocalTime`). `getLocation()` turns the inputs into the location object for `astro.js`, `siderealTimeHours(jd)` gives Greenwich sidereal time in hours, `normalizeDegrees()` normalizes display values in degrees. `dayUtcOffset()` and `timeZoneLabel()` give the time zone for day-based values (rise/set) depending on the "Lokalzeit" checkbox; `calculateSunRiseSet()`/`calculateMoonRiseSet()` take it as optional third argument `utcOffset`. Loaded after `astro.js` by the pages that opt into the shared modules.

**`visibility.js`** — visibility of sun and moon from a viewpoint (concept in `Konzept-Sichtbarkeit.md`). DOM-free IIFE like `astro.js` (browser: globals, Node: `require`). Unlike `astro.js` it works in **degrees**, azimuth from **north**, apparent altitude (with refraction). A viewpoint `{ name, sectors, horizon, observations }` is a mask: visible = inside a sector rectangle (or no sectors) and above the horizon line. Provides `sunDirection()`, `moonDirection()` (topocentric, hourly ephemeris + interpolation), `visibilityLevel()`, `findVisibilityIntervals()`, `computeLevelGrid()`/`computeLevelSeries()`, `findFullMoons()`, `observationDirection()`. Stage 2 (environment): `horizonFromBuildings()` (OSM outlines, ray per 0.25° azimuth), `terrainTileList()`/`decodeTerrarium()`/`createTerrainSampler()` (Terrarium tiles of any size: Mapterhorn 512 px bare-earth DTM, AWS Terrain Tiles 256 px as fallback), `terrainProfile()` (upper convex hull per azimuth, so eye height stays adjustable) and `horizonFromTerrain()`; `compileViewpoint(vp, profile)` takes the maximum of the hand-drawn horizon and this computed profile. Stage 3 (room/balcony): `viewpoint.scene` describes a room (walls with window openings and reveals) and/or a balcony (slab above, parapet, dividers); `compileScene()` turns it into axis-aligned opaque rectangles in room coordinates (x along the facade, y outward, z up) plus a 0.25° raster mask, `sceneVisible()` uses the raster with an exact ray test at transitions, `sceneObstacle()` names the blocking part, `sunPatch()` samples the sunlit floor. Tests: `node testVisibility.js` (also compares `calculateRefraction` with `cpp/astro.cpp` if g++ is available).

**`orbit3d.js`** — geometry for the 3D model `ErdeMond3D.html` (concept in `Konzept-ErdeMond3D.md`). DOM-free IIFE like `astro.js` (browser: globals, Node: `require`). Geocentric frame: ecliptic and mean equinox of date, x to the vernal equinox, z to the ecliptic north pole, unit Earth radius; rotation matrices are 9-element row-major arrays (body axes → ecliptic, body x to longitude 0°, z to north pole). `sceneState(jd)` (sun direction, moon position, illuminated fraction, libration, Earth/Moon rotation), `earthRotation()` (GMST, obliquity), `moonRotation()` (built from libration l, b and position angle P of `calculateMoonOrientation`, so (l, b) faces Earth), `moonPath()`, `meanMoonOrbit()`/`ellipsePoints()` (mean elements, perigee longitude L′ − M′), `moonNodePassages()`, `moonApsides()`, `nearestEvent()`, `nextMoonPhase()` (secant search on λ_moon − λ_sun), `subPoint()`. Eclipses: `sunVisibleFraction()` (overlap of two discs, same formula as the shadow shader), `eclipseGeometry()`/`eclipseAt()` (moon distance from the Earth's shadow axis with Chauvenet's 1.02 enlargement, umbral/penumbral magnitude; gamma of the Moon's shadow axis, total/annular/partial), `greatestEclipse()` (golden-section search near a syzygy), `findEclipse(jd, 'lunar'|'solar', backward)`.

**`gl3d.js`** — small own WebGL2 helper (no external library), all names under the global object `gl3d` (Node: `require`, only the math part). mat4 column-major, `OrbitCamera` (z up, camera-relative rendering: view matrix with the eye at the origin, object positions shifted by the eye in double; mouse/touch, `animateTo`, `ray`, hooks `onChange`/`onPan`/`onRotate`), `sphereGeometry()` (UVs for equirectangular maps, 0° longitude at the image center, north at v = 0), `discGeometry()`, `lineGeometry()`/`createLineMesh()` (segments as screen-space bands with width in pixels and dashes; fixed attribute locations `ATTR`), `createProgram()` (`program.set(name, value)` picks the uniform type), `createMesh()`, `loadTexture()` (sRGB option), `projectPoint()`, `raySphere()`. Tests for `orbit3d.js` and `gl3d.js`: `node testOrbit3d.js`.

**`prepareTextures3d.py`** — builds `textures/` (Earth day 4k from Blue Marble NG May 2004, night 2k from Black Marble 2016, water mask 2k from GEBCO land heights plus blue-ness of Blue Marble, moon normal map 2k as JPG from LOLA `ldem_16_uint.tif`, channels east/north/up) from the NASA downloads in `textures/src/` (git-ignored, URLs in the script); single steps by name, e.g. `python3 prepareTextures3d.py moon_normal`. The moon color uses `lroc_color_2k.jpg` from the project root.

**`cpp/astro.cpp` / `cpp/astro.h`** — C++ reimplementation of the same algorithms in the `astro::` namespace. Standalone, no build integration. `JulianDay` holds UT and applies ΔT (leap-second table) itself; `ASTRO_EXACT_DELTA_T=0` switches to a fixed 69.184 s. Also in `cpp/`: `moon_testbench.cpp` (accuracy vs. NASA, results in `Testbench-Mond.md`), `Plan-Mondaufgang.md`.

**`easter.py`** — Python script computing Easter dates (Meeus/Jones/Butcher algorithm) with a matplotlib visualization.

**`astro-template`** — bare HTML/CSS scaffold used as a starting point for new pages.

### Visualization pages

| File | Uses shared JS | Description |
|------|----------------|-------------|
| `Erdposition.html` | yes (`astro.js`, `render.js`, `ui.js`) | 2D Earth orbit around the Sun (equinoxes/solstices, perihelion/aphelion, meridian direction, moon position), view of the Earth with tilted axis and lit half; table with sidereal time, equation of time, sun and moon position, sunrise/sunset |
| `Mond.html` | yes (`astro.js`, `render.js`, `moonRender.js`, `ui.js`) | Moon orbit around the Earth (±13.5 days, ascending node, apogee, part below the ecliptic), textured moon phase rendering with libration and parallactic angle, sky chart of the moon's path (altitude/azimuth); table with rise/set/transit, perigee/apogee, elongation, position angles |
| `Sichtbarkeit.html` | yes (`astro.js`, `ui.js`, `visibility.js`, Leaflet from cdnjs) | When are sun and moon visible from a balcony/window: viewpoints with sector rectangles and horizon line (drawn in a horizon diagram or typed in tables), observations for calibration, OSM map (Leaflet) with sectors and sun/moon directions, buildings from Overpass (height colors, edit height, own building, facade → sector or room, shadows) and terrain tiles for a computed horizon line, room/balcony form with top view, window-wall view and sun patch, yearly heatmap and sun hours, day timeline, moon visibility list; state in localStorage `sichtbarkeit`, JSON export/import |
| `Mondbahn.html` | yes (`astro.js`, `ui.js`) | Heliocentric Earth and Moon orbit over a given year: adjustable Earth–Moon exaggeration, zoom/pan, new/full moons, charts for distance to the Sun and orbit curvature |
| `ErdeMond3D.html` | yes (`astro.js`, `ui.js`, `orbit3d.js`, `gl3d.js`) | Interactive 3D model of Earth and Moon in own WebGL2 (needs local web server): ecliptic plane with 30° spokes, mean moon orbit plane, true moon path ±14 days (dashed below the ecliptic, day ticks), optional mean ellipse, node line with true node passages, apsides, sun direction, axes; location pin; Earth with day texture, twilight, city lights, sun glint and atmosphere (haze in the Earth shader, halo from the back faces of a shell), Moon (LROC) with LOLA normal map, Lommel-Seeliger shading, earthshine and correct libration; scale sliders (bodies ×1–8, distance ×0.25–1), camera target Earth/Moon/system with follow, view buttons (overview, top, edge-on, from the Sun, Earth → Moon, Moon → Earth; the last four keep their direction while following), jumps to the previous/next phase, node or apsis, playback up to 1 year/s; Stage 3: umbra/penumbra in the shaders from the true positions (red light in the Earth's umbra, Moon's shadow as a dark spot on the Earth), shadow cones in true size (scaled like distances), eclipse season hint and thicker node line, jumps to the previous/next lunar/solar eclipse; table with moon position, phase, node/apsis/phase dates, angle sun–node line, Earth phase seen from the Moon, current and next eclipses; glossary. Concept and stages in `Konzept-ErdeMond3D.md` |
| `Tageslaenge.html` | yes (`astro.js`, `ui.js`) | Day length over a year for a location (like `../NOAA_Solar_Calculations_year.ods`): chart of the daily gain at sunrise, at sunset and of the day length (min/day), chart of absolute sunrise/sunset/transit times with daylight band; current time marked; local time with DST, zone time or UTC; key figures table |

Pages that do not load `astro.js` embed (an older copy of) the calculation logic inline. When changing algorithms, check whether the inline copy in `Astro-Berechnungen.html` also needs updating.

## Key Conventions

- Identifiers (variables, function names) are in English; comments are in German
- Angles in `astro.js` are radians (`DEG2RAD`/`RAD2DEG` to convert); degrees only in UI inputs and display
- Julian Date (JD) is the primary time representation for calculations
- Location inputs are latitude/longitude in decimal degrees (`ui.js` globals); `getLocation()` converts them for `astro.js`
