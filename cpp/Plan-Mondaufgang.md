# Plan: Mondauf-/-untergang mit interpolierten RA/Dec

Stand: 11.10.2026, noch nicht umgesetzt. Grundlage sind die Messungen in `Testbench-Mond.md`
(`moon_testbench.cpp`).

## Ausgangslage

`calculateMoonRiseSet` (astro.cpp) ruft stündlich `calculateMoonPosition` auf (26 Aufrufe pro Tag) und legt eine
Parabel durch die **Höhe**. Die Höhe ändert sich durch die Erddrehung schnell und nicht parabelförmig; der Fehler
in h−h0 beträgt bis zu 8,9′, das ist etwa 1 min in der Aufgangszeit.

## Idee

Die Höhe wird weiterhin berechnet, nur nicht mehr interpoliert. Interpoliert werden nur die langsam und
gleichmäßig veränderlichen Größen RA, Dec und Entfernung; die Erddrehung steckt in der Sternzeit, die zu jedem
Zeitpunkt exakt und billig berechnet wird:

```
h(t) = asin( sin φ · sin δ(t) + cos φ · cos δ(t) · cos(θ(t) − α(t)) ) − h0(Δ(t))
              └ interpoliert ┘                    └ exakt ┘└ interp. ┘     └ interp. ┘
```

h(t) lässt sich damit zu jedem Zeitpunkt auswerten, ohne `calculateMoonPosition` aufzurufen.

## Vorgehen

1. **Stützstellen:** `calculateMoonPosition` nur an den Stützstellen aufrufen. Kubisch mit 12 h: −12, 0, 12, 24,
   36 h, das sind 5 Aufrufe pro Tag statt 26. RA vor dem Interpolieren stetig fortsetzen (kein Sprung bei 360°).
2. **Grobsuche wie bisher:** stündlich abtasten, Parabel durch die Werte. Die stündlichen Höhen kommen jetzt aus
   h(t) mit interpolierten RA/Dec. Die bisherige Logik bleibt: Vorzeichenwechsel, Mond streift den Horizont
   (zwei Durchgänge in einer Stunde), kein Aufgang an diesem Tag. Ergebnis: Startwert auf etwa 1 min genau.
3. **Verfeinern** mit der Korrektur Δm aus Meeus Kapitel 14 (Newton-Schritt auf h(t)), 2–3 Schritte bis
   |Δt| < 1 s:

   ```
   Δt = (h(t) − h0) / (15.04°/h · cos δ · cos φ · sin H)        t ← t + Δt
   ```

   Vorzeichen: Beim Aufgang ist H < 0 und h − h0 < 0, also Δt > 0. Dass der Mond langsamer läuft (≈ 14,5°/h),
   stört die Konvergenz nicht.
4. **Meridiandurchgang** ebenso mit Δt = −H(t) / 15.04°/h. Die größte Höhe liegt praktisch beim Durchgang.

Skizze:

```cpp
// Höhe über h0 und Stundenwinkel zum Zeitpunkt t [h seit 0h UT];
// RA/Dec/Entfernung aus den Stützstellen interpoliert, Sternzeit exakt
MoonSample sampleInterpolated(const MoonNodes& nodes, const JulianDay midnight, const double t,
                              const GeoLocation& location);

// Nullstelle von h − h0 nahe t verfeinern (Korrektur Δm, Kapitel 14)
double refineHorizonCrossing(const MoonNodes& nodes, const JulianDay midnight, double t,
                             const GeoLocation& location) {
    for (int i = 0; i < 4; i++) {
        const MoonSample s = sampleInterpolated(nodes, midnight, t, location);
        const double rate = 15.04 * DEG2RAD * cos(s.dec) * cos(location.latitude) * std::sin(s.hourAngle);  // [rad/h]
        const double dt = s.altitude / rate;                            // [h]
        t += dt;
        if (std::fabs(dt) < 1.0 / 3600.0) break;
    }
    return t;
}
```

## Warum die Grobsuche bleibt

Meeus startet direkt mit m0, m1, m2 aus Formel 14.2 und iteriert nur Δm. Für den Mond ist das heikel: an etwa
einem Tag pro Monat gibt es keinen Auf- oder Untergang, in hohen Breiten kann der Mond den Horizont streifen,
und ein schlechter Startwert konvergiert zum Ereignis des Nachbartags. Die Grobsuche erkennt diese Fälle,
die Verfeinerung liefert die Genauigkeit.

## Erwartete Genauigkeit

Aus der Testbench, umgerechnet auf die Aufgangszeit bei 50° Breite (Höhe ändert sich am Horizont um höchstens
etwa 10′ pro Minute):

| Interpolation | Fehler in h−h0 (max) | Aufgangszeit | Aufrufe/Tag |
|---|---|---|---|
| kubisch 12 h | 2,4″ (nur Interpolation) | < 1 s | 5 |
| Parabel 12 h | 22″ | ≈ 2 s | 4 |
| Parabel 24 h (zentriert, wie Meeus) | 2,4′ | ≈ 15 s | 3 |
| heute: Höhenparabel 1 h | 8,9′ | ≈ 1 min | 26 |

Die Refraktion am Horizont schwankt mit dem Wetter um mehrere Bogenminuten (10 s bis etwa 1 min in der Zeit).
Genauer als etwa 10 s muss die Rechnung daher nicht sein; kubisch 12 h ist die sichere Wahl.

Unabhängig davon: TD = UT kostet etwa 0,6′ in der Position (siehe `Testbench-Mond.md`); ein fester Wert
ΔT ≈ 69 s würde das beheben.

## Offene Schritte

- `calculateMoonRiseSet` wie oben umbauen (Stützstellen-Struktur, `sampleInterpolated`, Verfeinerung für Auf-,
  Untergang und Durchgang).
- Testbench um einen direkten Vergleich der Auf-/Untergangszeiten erweitern: heutige Variante, neue Variante
  und eine Referenz, die die Nullstelle mit direkter Rechnung sehr genau bestimmt.
- `astro.js` ist seit dem 26.10.2026 eine Portierung von `astro.cpp` und enthält dasselbe `calculateMoonRiseSet`;
  ein Umbau muss in beiden Dateien erfolgen.
