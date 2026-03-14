# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is an astronomical calculation and visualization project (German: "Zeiten" = times). It computes and visualizes solar/lunar positions, rise/set times, moon phases, and coordinate transformations. All algorithms are based on Jean Meeus' *Astronomische Algorithmen* (Astronomical Algorithms).

## Running the Code

No build step required. HTML files run directly in a browser:

```bash
firefox Astro-Berechnungen.html
firefox Mond.html
firefox Erdposition.html
```

If local image files (e.g. `mond.png`) need to load, serve via HTTP:

```bash
python3 -m http.server 8000
```

The C file (`astro.c`) has no Makefile and is not integrated — it's a partial reimplementation.

## Architecture

**`astro.js`** is the core mathematical library (~780 lines, ~40 functions). It is self-contained with no external dependencies. It exports:

- **Constants**: `aeTokm`, `e` (eccentricity), `epsilon` (axial tilt), `deg2rad`, `rad2deg`, radii
- **Time**: `calculateJulianDate()`, `calculateGregorianDateFromJulianDate()`, `calculateJulianEpoch()`
- **Solar**: `calculateEquationOfTime()`, `calculateEclipticalLength()`, `calculateTrueAnomaly()`, `calculateOrbitRadiusEarth()`, `calculateSiderealTime()`, `calculateSunriseSunset()`, `calculateJDOfPoint()` (solstices/equinoxes via Meeus tables), `calculatePerihelAphel()`
- **Coordinate transforms**: `calculateRaDek()` (ecliptic→equatorial), `calculateHAzFromRaDek()` (equatorial→horizontal)
- **Lunar**: `calculateMoon()` (position with 60+ periodic correction terms), `calculateRisingKnotMoon()`, `getMoonPhase()`
- **Utilities**: `interpolate()`, `normalizeAngleDegree()`, `normalizeAngleDifferenceRad()`

**HTML visualization pages** each embed their own copy of the calculation logic (not importing `astro.js`) and use the HTML5 Canvas API for rendering:

- `Astro-Berechnungen.html` — solar position, rise/set times, equation of time, solstices/equinoxes
- `Erdposition.html` — 2D Earth orbit, sidereal time, moon orbit around Earth
- `Mond.html` — 3D moon phase rendering with matrix transforms, libration, pixel-by-pixel surface mapping
- `mondbahn.html` — interactive 3D moon orbit with perspective projection and axis rotation controls
- `astroled.html` — LED ring visualization

The `chatgpt/` directory contains historical experiment files and `three.js-master/` contains the full Three.js library distribution (not currently used in the project).

## Key Conventions

- German variable and function names throughout (`berechne*`, `Sonnenstand`, etc.)
- Angles internally in degrees unless a function explicitly works in radians
- Julian Date (JD) is the primary time representation for calculations
- Location inputs are latitude/longitude in decimal degrees
