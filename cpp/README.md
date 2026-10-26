# astro – Astronomische Berechnungen in C++

Stand von Sonne und Mond, Auf- und Untergänge, Mondphase und Libration, Jahreszeiten, Osterdatum, Apsiden und
Knotendurchgänge. Die Algorithmen stammen aus Jean Meeus, *Astronomische Algorithmen* (2. Auflage, Barth 1994);
Kapitel- und Formelnummern in den Kommentaren beziehen sich auf dieses Buch.

Die Bibliothek besteht aus genau zwei Dateien, `astro.h` und `astro.cpp`, ohne weitere Abhängigkeiten. Sie
übersetzt ab C++11 und läuft auf dem PC ebenso wie auf Mikrocontrollern mit 64-Bit-`double` (ESP32, ESP8266,
nRF52). Für AVR (Arduino Uno usw.) ist sie nicht geeignet: Dort ist `double` nur 32 Bit breit, das reicht für einen
Julianischen Tag nicht.

## JavaScript-Fassung

`astro.js` im Hauptordner ist eine Portierung dieser Bibliothek mit denselben Funktionsnamen, Parametern und
Ergebnissen (Abweichung unter 1e-11). Unterschiede ergeben sich nur aus der Sprache:

- Winkel sind Zahlen in Radiant statt `Angle` (`DEG2RAD`/`RAD2DEG` zum Umrechnen).
- Zeitpunkte sind Zahlen (JD in UT); statt der Methoden von `JulianDay` gibt es Funktionen wie
  `julianDayFromDate(date)`, `julianDayToDate(jd)`, `deltaT(jd)` und `julianDayFromDynamicalTime(jde)`.
- Ergebnisse sind Objekte mit denselben Feldnamen, z. B. `{ ra, dec }` oder `{ hasRise, rise, … }`.
- `EquinoxType` und `ApsisType` sind Objekte mit Zahlenwerten, `calculateEaster` liefert `{ year, month, day }`.

```js
const loc = { longitude: 13.405 * DEG2RAD, latitude: 52.52 * DEG2RAD, elevation: 34 };
const jd  = julianDayFromDate(new Date());
const sun = calculateSunPosition(jd);
const hor = calculateHorizontal(calculateEquatorial(sun, calculateObliquity(jd)),
                                calculateLocalSiderealTime(jd, loc), loc);
```

## Inhalt des Ordners

| Datei | Inhalt |
|---|---|
| `astro.h`, `astro.cpp` | Die Bibliothek (Namensraum `astro`). Die Übersicht am Anfang von `astro.h` listet alle umgesetzten Kapitel. |
| `beispiele/` | Kleine, vollständige Programme zu Sonne, Mond und Ereignissen (siehe unten) |
| `moon_testbench.cpp`, `Testbench-Mond.md` | Genauigkeit der Mondberechnung gegen NASA-Ephemeriden (`mooninfo_2025.txt`, `mooninfo_2026.txt`) |
| `Aenderungen-astro-cpp.md` | Änderungen bei der Umstellung auf die Typen `Angle`, `JulianDay` usw. |
| `Plan-Mondaufgang.md` | Geplanter Umbau von `calculateMoonRiseSet` |

## Übersetzen

```bash
cd cpp/beispiele
g++ -std=c++11 -I.. sonne.cpp ../astro.cpp -o sonne && ./sonne
g++ -std=c++11 -I.. mond.cpp ../astro.cpp -o mond && ./mond
g++ -std=c++11 -I.. ereignisse.cpp ../astro.cpp -o ereignisse && ./ereignisse
```

Die Testbench (im Ordner `cpp`, die Referenzdateien liegen daneben):

```bash
g++ -std=c++11 -O2 moon_testbench.cpp astro.cpp -o moon_testbench && ./moon_testbench
```

## Grundbegriffe

### Winkel: `Angle`

Alle Winkel sind vom Typ `Angle`. Die Einheit wird nur beim Erzeugen und beim Auslesen genannt, intern rechnet
`Angle` in Radiant. Verwechslungen von Grad und Radiant fallen so schon beim Übersetzen auf.

```cpp
using namespace astro;

Angle a = 52.52_deg;                      // Literal, auch 45_deg, 1.2_rad, 2_rad
Angle b = Angle::fromDms(13, 24, 18);     // 13° 24′ 18″
Angle c = Angle::fromHours(14.5);         // Rektaszension 14h30m

double grad = a.deg();                    // auch rad(), hours(), arcsec()
double s = sin(a);                        // sin, cos, tan direkt auf Angle
Angle d = (a + 400_deg).normalized();     // auf [0°, 360°) gebracht; normalizedSigned(): (−180°, 180°]
```

### Zeit: `JulianDay`

Ein Zeitpunkt ist ein `JulianDay` in Weltzeit (UT, ab 1961 identisch mit UTC, also derselben Zeit wie `time_t`).

```cpp
JulianDay jd1 = JulianDay::fromCalendar(2026, 10, 25, 12.0);  // 25.10.2026, 12:00 UT
JulianDay jd2 = JulianDay::fromUnixTime(time(nullptr));       // jetzt
JulianDay jd3 = jd1 + 1.5;                                   // anderthalb Tage später
double tage = jd2 - jd1;                                     // Abstand in Tagen
time_t t = jd1.toUnixTime();                                 // zurück, z. B. für localtime_r
JulianDay mitternacht = jd1.midnight();                      // 0h UT desselben Tages
```

Die Formeln für Sonne und Mond verlangen die Dynamische Zeit TD, die der Weltzeit um ΔT voraus ist (2026: 69,184 s;
der Mond legt in dieser Zeit etwa 38″ zurück). `JulianDay` rechnet das selbst um, man übergibt den Funktionen
immer UT. Auch Ergebnisse, die das Buch in TD liefert (Jahreszeiten, Apsiden, Knoten), kommen in UT zurück.

```cpp
double dt  = jd1.deltaT();          // ΔT = TD − UT [s]
double jde = jd1.dynamicalTime();   // Julianischer Tag in TD
double ls  = jd1.taiMinusUtc();     // Summe der Schaltsekunden TAI − UTC [s]
JulianDay ut = JulianDay::fromDynamicalTime(jde);   // TD → UT
```

ΔT kommt ab 1961 aus der Tabelle der Schaltsekunden (IERS, gültig bis 28.6.2027), davor aus den Polynomen von
Espenak und Meeus. Eine neue Schaltsekunde wird als weitere Zeile in `LEAP_SECONDS` in `astro.cpp` eingetragen.

### Beobachtungsort: `GeoLocation`

```cpp
//                        Länge (Ost +)  Breite     Höhe [m]  Zeitzone (POSIX-TZ)
const GeoLocation berlin = { 13.405_deg, 52.52_deg, 34.0, "CET-1CEST,M3.5.0,M10.5.0/3" };
```

Die Zeitzone dient nur der Ausgabe in Ortszeit, gerechnet wird in UT.

### Konventionen

- Geographische Länge **Ost positiv** (im Buch West positiv).
- Azimut **von Süden über Westen** gezählt wie im Buch. Für die übliche Zählung ab Norden:
  `(hor.azimuth + 180_deg).normalized()`.
- Entfernungen in km.
- `calculateEquatorial(ecliptic)` ohne Schiefe der Ekliptik verwendet die feste Schiefe `OBLIQUITY_J2000`. Das
  passt zu Koordinaten, die auf J2000.0 bezogen sind. Sonne und Mond liefern aber Koordinaten zum mittleren
  Äquinoktium des Datums, dafür `calculateObliquity(jd)` übergeben. Ohne diese Angabe ist die Position 2026 um
  12″ falsch, 1900 und 2100 um 47″, im Jahr 1000 um 8′.
- Auf- und Untergänge gelten für einen **UT-Tag** und werden in Stunden UT ab dessen Mitternacht angegeben. In
  Mitteleuropa beginnt der UT-Tag um 1:00 MEZ bzw. 2:00 MESZ; ein Mondaufgang um 0:30 Ortszeit gehört also zum
  vorigen UT-Tag.

## Beispiele

### Sonne (`beispiele/sonne.cpp`)

Stand der Sonne über Berlin, Zeitgleichung und Tageslauf:

```cpp
const GeoLocation berlin = { 13.405_deg, 52.52_deg, 34.0, "CET-1CEST,M3.5.0,M10.5.0/3" };
const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 12.0);

// Ekliptikale → äquatoriale → horizontale Koordinaten
const Ecliptic sun = calculateSunPosition(jd);
const Equatorial equ = calculateEquatorial(sun, calculateObliquity(jd));
const Horizontal hor = calculateHorizontal(equ, calculateLocalSiderealTime(jd, berlin), berlin);

std::printf("Höhe: %.2f°\n", hor.altitude.deg());
std::printf("Azimut: %.2f° (von Nord)\n", (hor.azimuth + 180_deg).normalized().deg());
std::printf("Zeitgleichung: %.2f min\n", calculateEquationOfTime(jd, true));

// Auf-, Untergang und Meridiandurchgang am UT-Tag, Zeiten in Stunden UT.
// Mit drittem Argument utcOffset [h] gilt der Kalendertag dieser Zeitzone, Zeiten in Stunden seit dessen Beginn.
const RiseTransitSet rts = calculateSunRiseSet(jd, berlin);
if (rts.hasRise) printLocalTime("Sonnenaufgang", jd, rts.rise);
printLocalTime("Höchster Stand", jd, rts.transit);
if (rts.hasSet) printLocalTime("Sonnenuntergang", jd, rts.set);
```

`printLocalTime` rechnet die Stunden UT in Ortszeit um:

```cpp
static void printLocalTime(const char* label, const JulianDay day, const double hoursUT) {
    const time_t t = (day.midnight() + hoursUT / 24.0).toUnixTime();
    struct tm local;
    localtime_r(&t, &local);    // Zeitzone vorher mit setenv("TZ", berlin.timezone, 1); tzset(); setzen
    std::printf("%s: %02d:%02d\n", label, local.tm_hour, local.tm_min);
}
```

Ausgabe (gekürzt):

```
Höhe: 23.57°
Azimut: 198.58° (von Nord)
Zeitgleichung: 15.93 min
Sonnenaufgang: 06:49
Höchster Stand: 11:50
Sonnenuntergang: 16:51
```

### Mond (`beispiele/mond.cpp`)

Für den Anblick vom Beobachtungsort braucht der Mond die Parallaxe (bis zu 1°), die Sonne nicht:

```cpp
const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 20.0);     // 21:00 MEZ
const Angle eps = calculateObliquity(jd);
const SiderealTime theta = calculateLocalSiderealTime(jd, berlin);

const Ecliptic moon = calculateMoonPosition(jd);
const Equatorial moonEqu = calculateEquatorial(moon, eps);

// Topozentrische Position und Höhe über dem Horizont
const Angle parallax = Angle::asin(EARTH_RADIUS / moon.distance);
const Equatorial topo = calculateTopocentric(moonEqu, parallax, theta, berlin);
const Horizontal hor = calculateHorizontal(topo, theta, berlin);

// Phase: beleuchteter Teil der Scheibe, zunehmend oder abnehmend
const Ecliptic sun = calculateSunPosition(jd);
const double k = calculateMoonIlluminatedFraction(calculateEquatorial(sun, eps), sun.distance,
                                                  moonEqu, moon.distance);
const bool waxing = (moon.longitude - sun.longitude).normalized() < 180_deg;

// Libration und Positionswinkel der Mondachse
const MoonOrientation o = calculateMoonOrientation(jd, moon);

// Auf- und Untergang am UT-Tag von jd
const RiseTransitSet rts = calculateMoonRiseSet(jd, berlin);
```

Ausgabe:

```
Höhe: 41.70°
Azimut: 128.58° (von Nord)
Entfernung: 370110 km
Beleuchtet: 99.7 % (zunehmend)
Libration: Länge -4.53°, Breite -5.69°
Positionswinkel: 339.42°
Mondaufgang: 25.10. 16:03
Meridian: 25.10. 23:31
Monduntergang: 25.10. 05:53
```

Der Untergang um 5:53 gehört zum Mond, der am Vortag aufgegangen ist; der Mond geht jeden Tag etwa 50 min später auf. Wer schnell
eine Position braucht, etwa für viele Werte in einer Schleife, nimmt `calculateMoonPositionSimple` (etwa achtmal
schneller, Fehler bis zu einigen Bogenminuten; Vergleich in `Testbench-Mond.md`).

### Zeitskalen und Ereignisse (`beispiele/ereignisse.cpp`)

```cpp
const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 12.0);
std::printf("ΔT = TD − UT: %.3f s\n", jd.deltaT());

// Jahreszeiten (in UT)
printLocal("Frühlingsanfang 2027", calculateEquinoxSolstice(2027, EquinoxType::Spring));

// Ostersonntag, ab 1583 Gregorianisch, davor Julianisch
const CalendarDate easter = calculateEaster(2027);
std::printf("Ostersonntag 2027: %02d.%02d.%d\n", easter.day, easter.month, easter.year);

// Nächstes Ereignis nach jd
const Apsis perihelion = calculateNextEarthApsis(jd, ApsisType::Periapsis);
const Apsis perigee = calculateNextMoonApsis(jd, ApsisType::Periapsis);
const NodePassage node = calculateNextMoonNode(jd);
printLocal("Perigäum des Mondes", perigee.time);
std::printf("  Entfernung: %.0f km\n", perigee.distance);
```

`printLocal` gibt einen `JulianDay` mit `localtime_r` und `strftime` in Ortszeit aus. Ausgabe (gekürzt):

```
ΔT = TD − UT: 69.184 s
TAI − UTC: 37 s
Frühlingsanfang 2027: 20.03.2027 21:24 CET
Sommeranfang 2027: 21.06.2027 16:10 CEST
Ostersonntag 2027: 28.03.2027
Perigäum des Mondes: 28.10.2026 19:00 CET
  Entfernung: 364410 km
Absteigender Knoten: 03.11.2026 04:02 CET
```

### Arduino (ESP32)

`astro.h` und `astro.cpp` in den Sketch-Ordner kopieren. Die Uhrzeit kommt per NTP; `time()` liefert UTC, egal
welche Zeitzone für die Ausgabe eingestellt ist.

```cpp
#include <WiFi.h>
#include <time.h>
#include "astro.h"

using namespace astro;

const GeoLocation ort = { 13.405_deg, 52.52_deg, 34.0, "CET-1CEST,M3.5.0,M10.5.0/3" };

void setup() {
    Serial.begin(115200);
    WiFi.begin("SSID", "Passwort");
    while (WiFi.status() != WL_CONNECTED) delay(500);
    configTzTime(ort.timezone, "pool.ntp.org");    // NTP und Zeitzone für localtime
}

void loop() {
    const time_t now = time(nullptr);
    if (now > 1700000000) {                          // erst rechnen, wenn NTP geantwortet hat
        const JulianDay jd = JulianDay::fromUnixTime(now);
        const Ecliptic moon = calculateMoonPosition(jd);
        const Ecliptic sun = calculateSunPosition(jd);
        const Angle eps = calculateObliquity(jd);
        const double k = calculateMoonIlluminatedFraction(calculateEquatorial(sun, eps), sun.distance,
                                                          calculateEquatorial(moon, eps), moon.distance);
        Serial.printf("Mond zu %.1f %% beleuchtet\n", k * 100.0);
    }
    delay(60000);
}
```

Auf Controllern mit wenig Flash lässt sich die ΔT-Tabelle abschalten (spart etwa 2,4 KB): in `astro.h` den Wert
von `ASTRO_EXACT_DELTA_T` auf 0 setzen oder mit `-DASTRO_EXACT_DELTA_T=0` übersetzen. ΔT ist dann fest
69,184 s; das ist von 2017 bis mindestens Mitte 2027 exakt und wird für frühere Jahre zunehmend falsch.

## Genauigkeit

| Größe | Genauigkeit |
|---|---|
| Mondposition (`calculateMoonPosition`) | 3″ RMS, max. 12″ gegen NASA (2025/26, `Testbench-Mond.md`) |
| Mondposition (`calculateMoonPositionSimple`) | etwa 1′ RMS, max. 4′ |
| Sonnenposition | etwa 0,01° (Kapitel 24, niedrige Genauigkeit) |
| Sonnenauf-/-untergang | genähert ohne die Korrekturen Δm: bis 1,6 min bei 50° Breite, 2,3 min bei 60° |
| Mondauf-/-untergang | etwa 1 min (`Plan-Mondaufgang.md`) |
| Jahreszeiten | etwa 1 min |
| Perihel/Aphel der Erde | mittlerer Fehler 3 h (Kapitel 37) |
| Perigäum/Apogäum des Mondes | bis 31 min bzw. 3 min (Kapitel 48) |
| ΔT ab 1961 | bis auf UT1 − UTC (< 0,9 s) exakt |

Nicht berücksichtigt sind Nutation und Aberration; die Positionen beziehen sich auf das mittlere Äquinoktium des
Datums. Die atmosphärische Refraktion steckt nur pauschal in der Standardhöhe für Auf- und Untergang.

## Funktionen im Überblick

| Bereich | Funktionen |
|---|---|
| Kalender | `calculateEaster` (Ostersonntag) |
| Zeit | `JulianDay::fromCalendar`, `fromTm`, `fromUnixTime`, `fromDynamicalTime`, `toUnixTime`, `midnight`, `deltaT`, `taiMinusUtc`, `dynamicalTime` |
| Sternzeit | `calculateGreenwichSiderealTime`, `calculateLocalSiderealTime` |
| Sonne, Erdbahn | `calculateSunPosition`, `calculateObliquity`, `calculateEquationOfTime`, `calculateEarthTrueAnomaly`, `calculateEarthEccentricity`, `calculateNextEarthApsis`, `calculateEquinoxSolstice` |
| Koordinaten | `calculateEquatorial`, `calculateHorizontal`, `calculateTopocentric`, `calculateParallacticAngle` |
| Mond | `calculateMoonPosition`, `calculateMoonPositionSimple`, `calculateMoonIlluminatedFraction`, `calculateMoonOrientation`, `calculateMoonAscendingNode`, `calculateNextMoonApsis`, `calculateNextMoonNode` |
| Auf-/Untergang | `calculateSunRiseSet`, `calculateMoonRiseSet` |
| Sonstiges | `interpolate`, `createRotationMatrix`, Operatoren für `Mat3` und `Vec3` |

Parameter, Einheiten und Formelnummern stehen an jeder Funktion in `astro.cpp`.
