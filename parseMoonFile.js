// parseMoonFile.js
//
// Liest eine Datei mit Monddaten ein (Format siehe Beispiel unten),
// ruft pro Zeile astro.js -> berechne() auf und schreibt das Ergebnis
// als CSV-Datei.
//
// Erwartetes Eingabeformat (whitespace-separiert), z.B.:
//
//    Date       Time    Phase    Age    Diam    Dist     RA        Dec      Slon      Slat     Elon     Elat   AxisA
// 01 Jan 2026 00:00 UT  91.40  11.928  1985.1  361045   4.2348   26.3373    32.520   -1.346  -1.279   -6.556  349.893
//
// Aufruf:
//   node parseMoonFile.js <eingabedatei> [ausgabedatei.csv]
//
// Standard: input.txt -> output.csv

const fs = require('fs');
const path = require('path');
const { calculateMoon, calculateJulianDate, calculateRaDec, normalizeAngleDifferenceRad, calculateHAzFromRaDec, calculateSiderealTime, calculateMoonSimple } = require('./astro.js');

// --- Argumente einlesen ---
const inputPath = process.argv[2] || 'input.txt';
const outputPath = process.argv[3] || 'output.csv';

// --- Hilfsfunktion: deutsche/englische Zahl mit Punkt parsen ---
function toNumber(str) {
  if (str === undefined || str === null || str === '') return null;
  const n = Number(str);
  return Number.isNaN(n) ? null : n;
}

const hours2rad = Math.PI / 12;
const deg2rad = Math.PI / 180;
const rad2deg = 180 / Math.PI;

function berechne(input) {
  const jd = calculateJulianDate(input.timestampUTC);
  const siderealtime = calculateSiderealTime(jd);

  // input.ra ist in Stunden, input.dec in Grad — auf Bogenmaß bringen
  const input_ra_rad = input.ra * hours2rad;
  const input_dec_rad = input.dec * deg2rad;

  const moon_meuss_ecliptical = calculateMoon(jd);
  const moon_meuss_radec = calculateRaDec(moon_meuss_ecliptical.longitude, moon_meuss_ecliptical.latitude);
  const diff_meuss_ra = normalizeAngleDifferenceRad(input_ra_rad - moon_meuss_radec.ra);
  const diff_meuss_dec = normalizeAngleDifferenceRad(input_dec_rad - moon_meuss_radec.dec);

  const moon_simple_radec = calculateMoonSimple(jd);
  const diff_simple_ra = normalizeAngleDifferenceRad(input_ra_rad - moon_simple_radec.ra);
  const diff_simple_dec = normalizeAngleDifferenceRad(input_dec_rad - moon_simple_radec.dec);
  const diff_distance = input.dist - moon_meuss_ecliptical.distance;

  const diff_meuss_simple_ra = normalizeAngleDifferenceRad(moon_meuss_radec.ra - moon_simple_radec.ra);
  const diff_meuss_simple_dec = normalizeAngleDifferenceRad(moon_meuss_radec.dec - moon_simple_radec.dec);


  return {
    diff_meuss_ra: diff_meuss_ra*500/Math.PI,
    diff_meuss_dec: diff_meuss_dec*500/Math.PI,
    diff_simple_ra: diff_simple_ra*500/Math.PI,
    diff_simple_dec: diff_simple_dec*500/Math.PI,
    diff_meuss_simple_ra: diff_meuss_simple_ra*500/Math.PI,
    diff_meuss_simple_dec: diff_meuss_simple_dec*500/Math.PI,
    diff_distance: diff_distance
  }
}

// --- Eine Datenzeile in ein Objekt umwandeln ---
// Die Zeile wird anhand von Whitespace in Tokens zerlegt. Da "Date" aus
// drei Tokens (Tag Monat Jahr) und "Time" aus zwei Tokens (HH:MM UT)
// besteht, werden diese zuerst wieder zusammengesetzt.
function parseLine(line) {
  const tokens = line.trim().split(/\s+/);
  if (tokens.length < 16) return null; // unvollständige/ungültige Zeile

  const [
    day, monthName, year,   // Date
    hhmm, ut,                // Time
    phase, age, diam, dist,
    ra, dec, slon, slat, elon, elat, axisA,
  ] = tokens;

  const dateStr = `${day} ${monthName} ${year}`;
  const timeStr = `${hhmm} ${ut}`;

  // Versuch, einen echten JS-Date-Wert (UTC) zu erzeugen
  const timestampUTC = new Date(`${day} ${monthName} ${year} ${hhmm} UTC`);

  return {
    date: dateStr,
    time: timeStr,
    timestampUTC: Number.isNaN(timestampUTC.getTime()) ? null : timestampUTC,
    phase: toNumber(phase),
    age: toNumber(age),
    diam: toNumber(diam),
    dist: toNumber(dist),
    ra: toNumber(ra),
    dec: toNumber(dec),
    slon: toNumber(slon),
    slat: toNumber(slat),
    elon: toNumber(elon),
    elat: toNumber(elat),
    axisA: toNumber(axisA),
  };
}

// --- CSV-Helfer: Wert sicher escapen ---
function csvEscape(value) {
  if (value === null || value === undefined) return '';
  const str = value instanceof Date ? value.toISOString() : typeof value === 'number'? value.toFixed(6).padStart(8, ' '): String(value);
  if (/[",;\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

function main() {
  if (!fs.existsSync(inputPath)) {
    console.error(`Eingabedatei nicht gefunden: ${inputPath}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(inputPath, 'utf8');
  const lines = raw.split(/\r?\n/);

  const records = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed === '') continue;

    // Kopfzeile überspringen (beginnt nicht mit einer Zahl als Tag)
    if (!/^\d/.test(trimmed)) continue;

    const record = parseLine(trimmed);
    if (record) records.push(record);
  }

  if (records.length === 0) {
    console.error('Keine gültigen Datenzeilen gefunden.');
    process.exit(1);
  }

  // --- Berechnung pro Zeile via astro.js ---
  const results = records.map((record) => {
    const berechnet = berechne(record);
    return { ...berechnet };
  });



  // --- CSV erzeugen ---
  const allKeys = Object.keys(results[0]);
  const headerLine = allKeys.join('\t');
  const dataLines = results.map((row) =>
    allKeys.map((key) => csvEscape(row[key])).join('\t')
  );

  const csvContent = [headerLine, ...dataLines].join('\n');

  fs.writeFileSync(outputPath, csvContent, 'utf8');
  console.log(`${results.length} Datensätze verarbeitet.`);
  console.log(`CSV geschrieben nach: ${path.resolve(outputPath)}`);

  // --- RMS über alle Zeilen je Spalte ---
  const rms = {};
  const max = {};
  for (const key of allKeys) {
    let sumsq = 0;
    let n = 0;
    let max_l = 0;
    for (const row of results) {
      const v = row[key];
      if (typeof v === 'number' && Number.isFinite(v)) {
        sumsq += v * v;
        n++;
        if(Math.abs(v) > max_l) {
          max_l = Math.abs(v);
        }
      }
    }
    rms[key] = n > 0 ? Math.sqrt(sumsq / n) : null;
    max[key] = max_l;
  }

  console.log('RMS je Spalte:');
  for (const key of allKeys) {
    if (rms[key] !== null) {
      console.log(`  ${key}: ${rms[key].toFixed(6)}`);
    }
  }

  console.log('Max je Spalte:');
  for (const key of allKeys) {
    if (max[key] !== null) {
      console.log(`  ${key}: ${max[key].toFixed(6)}`);
    }
  }
}

main();