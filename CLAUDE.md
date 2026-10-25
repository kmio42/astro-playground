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

The C++ files live in `cpp/` (`astro.cpp`, `astro.h`, examples in `cpp/beispiele/`, documented in `cpp/README.md`). They have no Makefile and are not integrated into any HTML page — they are a standalone reimplementation in the `astro::` namespace, kept compatible with C++11 (Arduino cores). Build an example: `cd cpp/beispiele && g++ -std=c++11 -I.. sonne.cpp ../astro.cpp -o sonne`.

## Architecture

**`astro.js`** is the core mathematical library (~1385 lines), a port of `cpp/astro.cpp` with the same function names, parameters and result objects (see `cpp/README.md`). Self-contained, wrapped in an IIFE; in the browser all public names are global, in Node.js they come from `require('./astro.js')`. Angles are numbers in radians, time is a Julian Day number in UT (ΔT is applied internally), locations are `{ longitude, latitude, elevation }` objects (radians, east positive). It exports:

- **Constants**: `DEG2RAD`, `RAD2DEG`, `AU_KM`, `EARTH_RADIUS`, `MOON_RADIUS`, `MOON_ORBIT_RADIUS`, `EARTH_SEMI_MAJOR_AXIS`, `OBLIQUITY_J2000`, `EquinoxType`, `ApsisType`
- **Time**: `julianDayFromCalendar()`, `julianDayFromDate()`, `julianDayToDate()`, `julianDayMidnight()`, `deltaT()`, `taiMinusUtc()`, `dynamicalTime()`, `julianDayFromDynamicalTime()`, `calculateEaster()`
- **Solar**: `calculateSunPosition()`, `calculateObliquity()`, `calculateEquationOfTime()`, `calculateEarthTrueAnomaly()`, `calculateEarthEccentricity()`, `calculateGreenwichSiderealTime()`, `calculateLocalSiderealTime()`, `calculateSunRiseSet()`, `calculateEquinoxSolstice()`, `calculateNextEarthApsis()`
- **Coordinate transforms**: `calculateEquatorial()`, `calculateHorizontal()`, `calculateTopocentric()`, `calculateParallacticAngle()`
- **Lunar**: `calculateMoonPosition()`, `calculateMoonPositionSimple()`, `calculateMoonIlluminatedFraction()`, `calculateMoonOrientation()` (libration, position angle), `calculateMoonAscendingNode()`, `calculateMoonRiseSet()`, `calculateNextMoonApsis()`, `calculateNextMoonNode()`
- **Utilities**: `interpolate()`, `normalizeAngle()`, `normalizeAngleSigned()`, `angleFromDms()`

When changing an algorithm, change `astro.js` and `cpp/astro.cpp` together; their results agree to about 1e-11.

**`render.js`** — small shared 3D rendering helpers: `createRotationMatrix(axle, angle)` and `multiplyMatrix(m1, m2)`. Used by the moon surface renderer in `Mond.html`.

**`ui.js`** — shared UI state and formatting helpers (`radToDegString`, time formatting, common variables like `datetime`, `latitude`, `longitude` in degrees, `useLocalTime`). `getLocation()` turns the inputs into the location object for `astro.js`, `siderealTimeHours(jd)` gives Greenwich sidereal time in hours, `normalizeDegrees()` normalizes display values in degrees. Loaded after `astro.js` by the pages that opt into the shared modules.

**`cpp/astro.cpp` / `cpp/astro.h`** — C++ reimplementation of the same algorithms in the `astro::` namespace. Standalone, no build integration. `JulianDay` holds UT and applies ΔT (leap-second table) itself; `ASTRO_EXACT_DELTA_T=0` switches to a fixed 69.184 s. Also in `cpp/`: `moon_testbench.cpp` (accuracy vs. NASA, results in `Testbench-Mond.md`), `Plan-Mondaufgang.md`.

**`easter.py`** — Python script computing Easter dates (Meeus/Jones/Butcher algorithm) with a matplotlib visualization.

**`astro-template`** — bare HTML/CSS scaffold used as a starting point for new pages.

### Visualization pages

| File | Uses shared JS | Description |
|------|----------------|-------------|
| `Erdposition.html` | yes (`astro.js`, `render.js`, `ui.js`) | 2D Earth orbit, sidereal time, moon orbit around Earth |
| `Mond.html` | yes (`astro.js`, `render.js`, `ui.js`) | 3D moon phase rendering with matrix transforms, libration, pixel-by-pixel surface mapping |
| `Mondbahn.html` | yes (`astro.js`, `ui.js`) | Heliocentric Earth and Moon orbit over a given year: adjustable Earth–Moon exaggeration, zoom/pan, new/full moons, charts for distance to the Sun and orbit curvature |

Pages that do not load `astro.js` embed (an older copy of) the calculation logic inline. When changing algorithms, check whether the inline copy in `Astro-Berechnungen.html` also needs updating.

## Key Conventions

- Identifiers (variables, function names) are in English; comments are in German
- Angles in `astro.js` are radians (`DEG2RAD`/`RAD2DEG` to convert); degrees only in UI inputs and display
- Julian Date (JD) is the primary time representation for calculations
- Location inputs are latitude/longitude in decimal degrees (`ui.js` globals); `getLocation()` converts them for `astro.js`
