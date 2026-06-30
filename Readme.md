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

### `astro.cpp` / `astro.h`
Partial C/C++ reimplementations of the same algorithms (not integrated into any build, standalone files).

### `render.js`
Shared 3D rendering utilities: rotation matrix construction and matrix multiplication, used for moon surface rendering in `Mond.html`.

### `moonRender.js`
Canvas rendering functions for the moon disc, shared between the browser (`Mond.html`) and the command-line renderer. Provides `drawMoonPhaseTexture` (LROC photo with phase overlay) and `drawMoonPhaseShaded` (mond2.png with pixel-by-pixel shadow mask). Requires `astro.js` and `render.js` globals to be in scope.

### `easter.py`
Python script computing Easter dates using the Meeus/Jones/Butcher algorithm, with a matplotlib visualization of the distribution of Easter dates over time.

---

## Visualization in Browser (HTML + Canvas)

All pages run directly in a browser without a build step.

| File | Description |
|------|-------------|
| `Erdposition.html` | Solar position, rise/set times, equation of time, solstices/equinoxes, sidereal time, 2D Earth orbit visualization |
| `Mond.html` | moon orbit around Earth, 3D moon phase rendering with pixel-by-pixel surface mapping |
---

## CLI Interface for nodejs

### `renderMoon.js`
Command-line PNG renderer for the moon phase. Requires `npm install canvas`.

**Single frame:**
```bash
node renderMoon.js [--date ISO-UTC | --jd <JD>] [--lat deg] [--lon deg]
                   [--output file] [--size px] [--render texture|picture|both]
                   [--no-cross] [--no-libration] [--no-parallactic] [--no-distance]
```

**Sweep** (one parameter varies, the others stay fixed):
```bash
node renderMoon.js --sweep time|jd|lat|lon \
  --start <value> --stop <value> --step <value> \
  [--date ISO | --jd <JD>] [--lat deg] [--lon deg] \
  [--basename name] [--size px] [--render texture|picture|both]
  [--no-cross] [--no-libration] [--no-parallactic] [--no-distance]
```
- `--sweep time`: `--start`/`--stop` as ISO-UTC timestamps, `--step` in hours
- `--sweep jd`: `--start`/`--stop`/`--step` as Julian Day numbers
- `--sweep lat` / `--sweep lon`: `--start`/`--stop`/`--step` in decimal degrees

**Render mode** (`--render`, default: `texture`):
- `texture` — LROC photo with phase overlay → `<output>_textur.png`
- `picture` — mond2.png with pixel-by-pixel shadow mask → `<output>_schatten.png`
- `both` — produces both files

**Render flags** (all enabled by default):
- `--no-cross` — omit the cardinal cross (texture mode only)
- `--no-libration` — ignore libration when computing moon orientation
- `--no-parallactic` — ignore the parallactic angle (north-up instead of horizon-up)
- `--no-distance` — do not scale the moon disc by its current distance (texture mode only)

Sweep output files are numbered sequentially: `<basename>_0001_textur.png`, …  
Textures (`lroc_color_2k.jpg`, `mond2.png`) are loaded once and reused for all frames.