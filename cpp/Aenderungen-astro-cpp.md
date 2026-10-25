# Änderungen an astro.cpp / astro.h

Vergleich der Arbeitskopie mit dem Stand in `HEAD` (Commit `b9143a2`), ohne die rein strukturellen Änderungen:
Umstellung auf die Typen `Angle`, `JulianDay`, `SiderealTime` und `GeoLocation`, Horner-Schema, Tabellen als Strukturen.

Die neue Fassung kompiliert mit `g++ -std=c++20 -Wall -Wextra` ohne Warnungen. C++20 ist nötig, weil die Strukturen
mit benannten Feldern (`.x = …`) initialisiert werden. Gegen Referenzwerte getestet wurde nichts.
(Nachtrag: Die benannten Initialisierer sind inzwischen entfernt; astro.cpp übersetzt ab C++11.)

## Geänderte Ergebnisse

### Zeitgleichung (Kapitel 27)
- Der Abzug von 0,0057183° in Formel 27.1 entfällt: α ist geometrisch, nicht scheinbar. Das Ergebnis verschiebt sich
  um etwa 0,023 min (≈ 1,4 s). Die alte Fassung zog die Konstante ab, ohne die scheinbare Rektaszension zu verwenden.
- L0 nach Formel 27.2 (τ in Julianischen Jahrtausenden, mit höheren Gliedern); die wahre Länge L wird mit L0 aus
  Formel 24.2 gebildet.

### Schiefe der Ekliptik (Kapitel 21)
- Bisher wurde für ekliptikal → äquatorial immer die Konstante `EPSILON` = 23,439292° verwendet.
- `calculateEquatorial` erhält ε jetzt als Parameter, normalerweise aus `calculateObliquity(jd)` (Formel 21.2).
- Wirkt sich auch auf den Sonnenaufgang und den Positionswinkel der Mondachse aus.

### Abstand Erde–Sonne (Kapitel 24)
- Bisher `calculateOrbitRadiusEarth(nu)` mit fester Exzentrizität und ν aus der Keplergleichung, Ergebnis in AE.
- Jetzt `calculateSunPosition(jd).distance` mit zeitabhängigem e (Formel 24.4) und ν = M + C (Formel 24.5),
  Ergebnis in **km**.

### Mittlere Länge der Sonne (Formel 24.2)
- Gerundete Koeffizienten aus dem Buch (280,46645 statt 280,46644567 usw.); Abweichung nur Bruchteile einer
  Bogensekunde.

### Libration und Positionswinkel der Mondachse (Kapitel 51)
- Der Positionswinkel P wird durch cos b geteilt (b = b′ + b″, Gesamtlibration in Breite), wie im Buch.
  Bisher stand dort die ekliptikale Breite β des Mondes – ein Fehler.
- Die Libration in Länge wird auf (−π, π] normiert.

### Perihel / Aphel der Erde (Kapitel 37)
- `calculatePerihelAphel(year, month, type)` → `calculateNextEarthApsis(jd, type)`: liefert das erste Ereignis
  nach jd und zusätzlich die Entfernung.
- Die alte Bestimmung von k (Rundung zur Null hin, für Jahre vor 2000 `ceil`) entfällt; für negative k konnte sie
  das falsche Ereignis liefern.

### Sonnenauf-/-untergang (Kapitel 14)
- Ergebnis enthält zusätzlich die Höhe beim Meridiandurchgang (`maxAltitude`).
- Bei Polartag/Polarnacht wird der Meridiandurchgang trotzdem geliefert; bisher nur `valid = false` mit Nullen.

### Parallaxe / topozentrische Position (Kapitel 10, 39)
- Höhe über dem Meeresspiegel aus `GeoLocation.elevation` (bisher fest 0).
- `EARTH_RADIUS` = 6378,14 km (Wert aus dem Buch) statt 6378,137 km.

## Neue Funktionen

| Funktion | Inhalt |
|----------|--------|
| `calculateMoonRiseSet` | Mondauf-/-untergang, Meridiandurchgang, höchster Stand. Eigenes Verfahren (nicht aus dem Buch): stündliche Werte, Parabel durch je drei Stützstellen; erkennt auch zwei Horizontdurchgänge innerhalb einer Stunde. Standardhöhe h0 = 0,7275·π − 0°34′. Rechnet anders als `astro.js` (dort `calculateMoonSimple` mit 2-Stunden-Schritten). |
| `calculateMoonPositionSimple` | Mondposition niedriger Genauigkeit nach MINI_MOON aus Montenbruck/Pfleger, „Astronomie mit dem Personal Computer“ (nicht Meeus). Liefert λ und β, als Entfernung nur die mittlere Entfernung `MOON_ORBIT_RADIUS`. Abweichung von `calculateMoonPosition` über 2025–2028 max. 4,7′ in Länge, 0,8′ in Breite. Entspricht `calculateMoonSimple` in `astro.js`. |
| `calculateNextMoonApsis` | Perigäum/Apogäum mit Entfernung (Kapitel 48, Tabellen 48.1/48.2) |
| `calculateNextMoonNode` | Knotendurchgänge des Mondes (Kapitel 49); in `astro.js` vorhanden, in C++ bisher nicht |
| `calculateLocalSiderealTime` | Lokale Sternzeit, Länge Ost positiv |
| `JulianDay::fromTm`, `toUnixTime`, `midnight` | Umrechnung von/nach `struct tm` und Unix-Zeit, 0h UT des Tages |
| `GeoLocation` | Länge, Breite, Höhe und POSIX-Zeitzonen-String (nur für die Ausgabe in Lokalzeit) |

## Entfernt bzw. ersetzt

| Alt | Neu |
|-----|-----|
| `normalizeAngleDegree`, `normalizeAngleDifferenceRad` | `Angle::normalized()`, `Angle::normalizedSigned()` |
| `calculateJulianDate`, `calculateJulianEpoch` | `JulianDay::fromCalendar`, `JulianDay::centuries()` |
| `calculateSiderealTime` (Stunden) | `calculateGreenwichSiderealTime` (`SiderealTime`) |
| `calculateEclipticalLength`, `calculateOrbitRadiusEarth` | `calculateSunPosition` |
| `calculateTrueAnomaly`, `calculateCurrentExcentric` | `calculateEarthTrueAnomaly`, `calculateEarthEccentricity` |
| `calculateRaDek`, `calculateHAzFromRaDek` | `calculateEquatorial`, `calculateHorizontal` |
| `calculateParallax` | `calculateTopocentric` |
| `calculateSunriseSunset` | `calculateSunRiseSet` |
| `calculateJDOfPoint` | `calculateEquinoxSolstice` |
| `calculateMoon`, `calculateRisingKnotMoon` | `calculateMoonPosition`, `calculateMoonAscendingNode` |
| `calculateMoonPhase` | `calculateMoonIlluminatedFraction` |
| `calculateMoonAxle` | `calculateMoonOrientation` |
| `multiplyMatrix`, `applyMatrix` | `operator*` |
| Konstanten `ECCENTRICITY`, `EPSILON`, Struktur `MoonPhasePixel` | entfallen |

## Unverändert in der Rechnung

- Julianisches Datum (Formel 7.1), Sternzeit (Formel 11.4)
- Äquinoktien und Solstitien (Kapitel 26)
- Mondposition (Tabellen 45.1/45.2, gleiche Werte) und aufsteigender Knoten (Formel 45.7)
- Beleuchteter Teil der Mondscheibe (Kapitel 46), Interpolation (Kapitel 3), Rotationsmatrizen

## Sonstiges

- `astro.h` enthält eine Übersicht, welche Kapitel aus Meeus umgesetzt sind und welche nicht.
- Die Dynamische Zeit TD wird mit UT gleichgesetzt (ΔT aus Kapitel 9 fehlt).
- Ein Kommentar weist auf Arduino als Ziel hin („Arduino.h definiert PI als Makro“).

## Abweichungen zu astro.js

Zeitgleichung, Positionswinkel der Mondachse und Perihel/Aphel rechnen in `astro.js` noch nach der alten Variante.
