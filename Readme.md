# Astro Playground

> **Disclaimer:** This is a private playground. No claims are made regarding completeness, correctness, or explanatory value. Things may be wrong, half-finished, or just experiments.

A personal sandbox for experimenting with astronomical calculations and visualizations. Algorithms are primarily based on Jean Meeus' *Astronomical Algorithms*, implemented from scratch in JavaScript, C, and C++.

---

## Core Files

### `astro.js`
The main calculation library (~780 lines, no external dependencies). Implements:
- Julian Date conversion and Gregorian calendar
- Solar position: equation of time, ecliptical length, true anomaly, orbit radius, sidereal time
- Rise/set times for sun and moon
- Solstices and equinoxes (via Meeus tables)
- Coordinate transforms: ecliptic → equatorial → horizontal
- Lunar position with 60+ periodic correction terms, moon phase, ascending node
- Helper utilities: angle normalization, interpolation

### `astro.c` / `astro.cpp` / `astro.h`
Partial C/C++ reimplementations of the same algorithms (not integrated into any build, standalone files).

### `render.js`
Shared 3D rendering utilities: rotation matrix construction and matrix multiplication, used for moon surface rendering in `Mond.html`.

### `easter.py`
Python script computing Easter dates using the Meeus/Jones/Butcher algorithm, with a matplotlib visualization of the distribution of Easter dates over time.

---

## Visualization Pages (HTML + Canvas)

All pages run directly in a browser without a build step. Open them with Firefox or serve via `python3 -m http.server 8000` if local resources (images) are needed.

| File | Description |
|------|-------------|
| `Erdposition.html` | Solar position, rise/set times, equation of time, solstices/equinoxes, sidereal time, 2D Earth orbit visualization |
| `Mond.html` | moon orbit around Earth, 3D moon phase rendering with pixel-by-pixel surface mapping |
---
