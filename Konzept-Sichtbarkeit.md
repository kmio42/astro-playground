# Konzept: Wann sind Sonne und Mond von Wohnung/Balkon aus sichtbar?

Stand: 27.10.2026, Konzept abgestimmt, Stufe 1 umgesetzt (`Sichtbarkeit.html`, `visibility.js`,
`testVisibility.js`).

## Ziel

Für einen oder mehrere Standpunkte an einer Adresse (Balkon, Küchenfenster, Sofa) beantwortet die Seite:

- **Jahresbild Sonne:** An welchen Tagen und zu welchen Uhrzeiten scheint die Sonne auf den Balkon bzw. ins
  Zimmer? Wie viele Stunden pro Tag?
- **Mond-Termine:** Wann ist der (Voll-)Mond das nächste Mal vom Fenster aus zu sehen?

Eine Live-Ansicht („ist die Sonne gerade sichtbar?“) ist kein eigenes Ziel. Die Tagesansicht ist das Detail zu
einem Tag aus dem Jahresbild oder der Mondliste.

## Grundidee: alles wird zu einer Sichtmaske

Die Astronomie liefert zu jedem Zeitpunkt eine Richtung (Azimut A, Höhe h). Die Geometrie des Ortes wird
unabhängig davon in eine **Sichtmaske** M(A, h) → sichtbar ja/nein übersetzt. Die Sichtbarkeit ist dann
nur noch `M(A(t), h(t))`.

```
  Eingabe                          Sichtmaske                   Zeitsuche            Ausgabe
  ───────                          ──────────                   ─────────            ───────
  Sichtbereich-Rechtecke ──┐                                                         Horizontdiagramm
  Horizontlinie von Hand ──┤                                                         Jahres-Heatmap
  OSM-Gebäude            ──┼──►  M(A, h) pro Standpunkt  ──►  Intervalle       ──►   Mondliste
  Gelände (Terrarium)    ──┤                                  Sonne / Mond           Tagesdetail
  Quader/Balkon (B/C)    ──┘                                                         Karte
```

### Konventionen

- Lokales Koordinatensystem am Beobachter: x = Ost, y = Nord, z = oben, Meter.
- **Azimut in der Oberfläche von Norden über Osten** (0° = N, 90° = O). `calculateHorizontal()` liefert
  Meeus-Azimut von Süden über Westen: A_N = A_S + 180°.
- Richtungsvektor zu einem Gestirn:

  ```
  d(A, h) = ( sin A · cos h,  cos A · cos h,  sin h )
  ```

## Standpunkte und Maske

- Mehrere **benannte Standpunkte** an derselben Adresse (gemeinsame Breite/Länge), jeder mit eigener Maske,
  eigenem Stockwerk und eigener Augenhöhe (sitzend ≈ 1,2 m, stehend ≈ 1,6 m).
- Ergebnisse pro Standpunkt (umschaltbar) oder kombiniert „von irgendeinem aus“, z. B. in der Mondliste:
  „Vollmond sichtbar – vom Küchenfenster“.

**Bedeutung der Maske:**

```
sichtbar(A, h) =  ( in einem Sichtbereich-Rechteck  ODER  keine Rechtecke definiert )
                  UND  h > h_Horizont(A)
                  [UND Strahltest der Szene frei, ab Stufe 3]

h_Horizont(A)  =  max( Hand-Horizontlinie, OSM-Gebäude, Gelände )
```

- Sichtbereich-Rechteck: Azimut von–bis, Höhe von–bis. Bereich über Nord beachten: 300°–30° heißt
  A ≥ 300° oder A ≤ 30°.
- Hand-Horizontlinie: Punkte (A, h), dazwischen linear in A verbunden. Bäume werden nicht automatisch
  modelliert, sondern als Hand-Punkte eingetragen; keine Unterscheidung Sommer/Winter.
- Horizontwerte unter 0° sind erlaubt (aus höheren Stockwerken sieht man etwas unter den astronomischen
  Horizont).

### Sichtbarkeit von Sonne und Mond

- **Sonne:** Mittelpunkt frei ist das Hauptkriterium („sichtbar“). Zusätzlich vier Randpunkte der Scheibe
  (Radius ≈ 0,27°); ist nur ein Teil frei, gilt das als „teilweise“ und wird heller dargestellt.
- **Mond:** sichtbar, sobald er geometrisch frei ist, auch am Taghimmel. Phase (beleuchteter Anteil) wird als
  Information angezeigt. In der Mondliste filtert ein Schalter „nur bei Sonne unter −6°“.

## Stufe 1: Sichtbereich, Horizontlinie, Sonne und Mond

### Eingabe der Maske

- **Im Horizontdiagramm zeichnen:** Rechtecke aufziehen, Horizontpunkte setzen und ziehen.
- **Synchronisierte Zahlentabelle** zum genauen Nachtippen.
- **Kalibrierung durch Beobachtung:** z. B. „12.10., 15:42, Sonne verschwand“. Die Beobachtung wird als
  **Rohdatum** (Zeit, Gestirn, Ereignis, Standpunkt) gespeichert; der Punkt (A, h) wird daraus berechnet und
  bei Änderungen (Standort, Refraktion) neu bestimmt. Er erscheint im Diagramm und kann in die
  Horizontlinie übernommen werden.

### Astronomische Seite

Vorhandenes aus `astro.js`:

- Sonne: `calculateSunPosition` → `calculateEquatorial` (mit `calculateObliquity`) →
  `calculateHorizontal`.
- Mond: `calculateMoonPosition` → `calculateEquatorial` → **`calculateTopocentric`** (Parallaxe bis 1°,
  bei kleinen Fenstern wichtig) → `calculateHorizontal`.
- Phase: `calculateMoonIlluminatedFraction`.

Neu: **`calculateRefraction()`** in `astro.js` und `cpp/astro.cpp` (gemeinsam ändern, wie für alle
Algorithmen). Formel 15.4 (Saemundsson), wahre → scheinbare Höhe, am Horizont ≈ 34′:

```
R = 1,02′ / tan(h + 10,3° / (h + 5,11°))
```

### Zeitsuche

1. In 2-min-Schritten abtasten (die Sonne bewegt sich dabei höchstens ≈ 0,5°), Maske prüfen.
2. Bei jedem Wechsel sichtbar/verdeckt (und Mittelpunkt sichtbar/verdeckt) per Bisektion auf ≈ 1 s verfeinern.
3. Ergebnis pro Gestirn und Standpunkt eine Liste von Intervallen.

- Ein Jahr sind 365 × 720 ≈ 263 000 Zeitpunkte. Der Test „Rechteck und Horizontlinie“ ist billig; in
  Stufe 1 gibt es **kein Raster**, es wird direkt geprüft.
- Mond wie in `cpp/Plan-Mondaufgang.md`: `calculateMoonPosition` nur stündlich, RA/Dec/Entfernung mit
  `interpolate()` dazwischen, Sternzeit exakt.
- Rechnung im Haupt-Thread. Ein Web Worker kommt erst dazu, wenn die Jahresrechnung spürbar über 1 s dauert.
- Bekannte Grenze: Hindernisse schmaler als 2 min Bahnweg (Laternenmast) können übersehen werden.

Ergebnisstruktur:

```js
// Ein Sichtbarkeitsintervall: mindestens ein Teil der Scheibe ist sichtbar
{
    body: 'sun' | 'moon',
    start: jd, end: jd, duration: min,        // UT
    entry: { azimuth, altitude },             // wo das Gestirn ins Sichtfeld kommt [°]
    exit:  { azimuth, altitude },
    maxAltitude: deg,
    centerStart: jd, centerEnd: jd,           // Mittelpunkt sichtbar (null: nur der Rand)
    viewpoints: ['Balkon', …],                // von welchen Standpunkten aus
    startsBefore, endsAfter,                  // reicht über den Suchbereich hinaus
    illuminatedFraction: 0..1, waxing,        // nur Mond
}
```

`visibility.js` rechnet anders als `astro.js` in Grad, weil alle Werte aus Eingaben stammen und angezeigt
werden.

### Oberfläche

Neue Seite `Sichtbarkeit.html` aus `astro-template`, lädt `astro.js`, `ui.js` und `visibility.js`
(Geometrie, Maske, Zeitsuche, ohne DOM, damit in Node.js testbar wie `moonRender.js`).

**Horizontdiagramm (zentrale Ansicht):** rechteckig, Azimut waagrecht 0°–360° mit Süden in der Mitte, Höhe
senkrecht linear von −5° bis 90°, optional Zoom auf einen Azimutbereich.

- Maske grau, Sichtbereich frei, Horizontlinie und Beobachtungspunkte,
- Sonnenbahnen für den 21. jedes Monats und Stundenlinien (Analemma-förmig),
- Sonnen- und Mondbahn des gewählten Tages, Mond mit Phase.

**Jahres-Heatmap:** Tag × Uhrzeit, Sonne sichtbar (gelb), teilweise (hell), über dem Horizont aber verdeckt,
Nacht (dunkel). Darunter die Kurve „Sonnenstunden pro Tag“.

- Zeitachse in bürgerlicher Lokalzeit mit Sommerzeit (Standard), umschaltbar über die vorhandene Checkbox
  „Lokalzeit“ (`dayUtcOffset()`, aus = UT). Die Umstellungstage sind als senkrechte Linien markiert.
- Klick auf einen Tag öffnet das Tagesdetail.

**Mondliste:**

- Zeitraum ab dem gewählten Datum: 3 Monate, umschaltbar auf 12.
- Je Eintrag: Datum, von–bis, Ein-/Austrittsrichtung, maximale Höhe, Phase (Prozent + Symbol), Standpunkt.
- Filter: Mindestdauer (Standard 10 min), Mindestbeleuchtung (Standard 0 %), „nur bei Sonne unter −6°“.
- Tage um Vollmond (±2 Tage) hervorgehoben.
- Klick auf einen Eintrag öffnet das Tagesdetail.

**Tagesdetail:** Zeitleiste 0–24 h (Sonne/Mond über dem Horizont, sichtbar, teilweise), Intervalle als
Tabelle (`renderOutputTable`), Bahnen des Tages im Horizontdiagramm. Startdatum beim Öffnen: heute;
Blättern mit `createTimeControls()`.

**Karte** (Leaflet 1.9.4 von cdnjs, Kacheln von `tile.openstreetmap.org` mit Namensnennung):

- Standortmarker zum Verschieben; setzt `latitude`/`longitude` aus `ui.js` und speichert per `saveData()`.
- Sichtbereiche als Kreissektoren (≈ 100 m Radius), Horizontlinie als Strahlen.
- Richtung zu Sonne und Mond zum gewählten Zeitpunkt: durchgezogen, wenn sichtbar, gestrichelt, wenn verdeckt
  oder unter dem Horizont.
- Auf- und Untergangsrichtung der Sonne zu den Sonnenwenden als feste Orientierungslinien.

### Tests

Node-Skript `testVisibility.js` ohne Testframework (wie `renderMoon.js`):

1. Leere Maske + Horizont 0° reproduziert `calculateSunRiseSet`/`calculateMoonRiseSet` auf etwa 1 min
   (Unterschiede durch Refraktion und h0).
2. Künstliches Rechteck mit von Hand nachgerechneten Ein- und Austrittszeiten.
3. Azimutbereich über Nord (300°–30°).
4. `calculateRefraction()` gegen die Bennett-Formel 15.3 (Umkehrung, Abweichung < 0,1′), gleiche Werte in
   `astro.js` und `astro.cpp`.
5. Vollmondzeiten, Filter „Dunkelheit“, Laufzeit des Jahresrasters (≈ 0,25 s).

## Stufe 2: Umgebung aus OpenStreetMap und Gelände

### Gebäude

1. Gebäude im Umkreis von **400 m** (einstellbar) über die Overpass-API laden:

   ```
   [out:json][timeout:25];
   way["building"](around:400,{lat},{lon});
   out geom tags;
   ```

2. Höhe: `height` → sonst `building:levels` × 3 m + `roof:levels` × 1,5 m → sonst 10 m. Geschätzte Höhen
   werden in der Karte farblich markiert und sind per Klick änderbar.
3. Eigenes Gebäude per Klick ausschließen.
4. Grundrisse ins lokale System umrechnen (bei < 1 km genügt eine Ebene: x = R·Δλ·cos φ₀, y = R·Δφ).
5. Für jedes Azimut in 0,25°-Schritten den Strahl mit allen Gebäudekanten schneiden; Höhenwinkel
   atan((z_Dach − z_Auge) / Entfernung), das Maximum ist der Gebäude-Horizont.

### Gelände

Quelle sind die **Terrarium-Kacheln** von [Terrain Tiles auf AWS](https://registry.opendata.aws/terrain-tiles)
(frei, CORS erlaubt, Namensnennung nötig). Dekodiert werden sie im Browser per Canvas:

```
Höhe [m] = R · 256 + G + B / 256 − 32768
```

Die Auflösung liegt im Flachland vermutlich bei etwa 30 m (bei der Umsetzung prüfen). Die
[Open-Meteo Elevation API](https://open-meteo.com/en/docs/elevation-api) (Copernicus GLO-90, CORS erlaubt)
dient nur als Gegenprobe für einzelne Punkte im Test.

**Nahbereich (Fußpunkthöhen):**

```
z_Dach  = Gelände(Gebäudemittelpunkt) + Gebäudehöhe          [m über NN]
z_Auge  = Gelände(Standpunkt) + Stockwerk × Geschosshöhe + Augenhöhe
```

**Fernbereich (Hügel und Berge):**

- Standardradius **50 km**, einstellbar bis 200 km.
- Abtastung pro 0,25° Azimut entlang des Strahls: bis 2 km alle 25 m aus Zoomstufe 14, darüber Zoomstufe 11
  mit Schritten von 1 % der Entfernung.
- Die ersten ~100 m um den Standpunkt bleiben unberücksichtigt, sonst erzeugt die grobe Auflösung
  Phantom-Hindernisse direkt vor dem Haus.
- Absenkung durch Erdkrümmung mit Refraktion: Δz = d² / (2R) · (1 − k), k ≈ 0,13
  (10 km ≈ 6,8 m, 50 km ≈ 170 m).

### Zwischenspeichern

Overpass-Gebäude, Geländekacheln-Auszug und Höhenkorrekturen werden einmal geladen und im gespeicherten
Zustand abgelegt (localStorage + JSON-Export). Neu geladen wird nur auf Knopfdruck; eigene Korrekturen
bleiben erhalten. Nur die Kartenkacheln brauchen dann noch Internet.

### Karte in Stufe 2

- Gebäude nach Höhe eingefärbt, geschätzte Höhen markiert, Klick öffnet Höhe zum Bearbeiten.
- **Fassade per Klick übernehmen:** Klick auf eine Gebäudekante → Kantenrichtung ± 90° ergibt den
  Fassaden-Azimut (genauer als Kompass).
- Optional: Schattenwurf der Gebäude zur gewählten Zeit (Grundriss um H / tan h entgegen der
  Sonnenrichtung verschoben) als Plausibilitätskontrolle der Höhen.

## Stufe 3: Wohnung als Quader (B) und Balkon (C)

### Eingabe

- Grundriss der Wohnung bzw. des Balkons als drehbares Rechteck in der Karte, das an der per Klick gewählten
  OSM-Fassade einrastet.
- Fenster, Balkonplatte, Brüstung, Trennwände per Formular (Maße in m).
- Kontrolle über eine Raum-Draufsicht und eine Ansicht von außen auf die Fassade.

Modell B (Quader): Breite, Tiefe, Raumhöhe; pro Fenster Wand, Lage entlang der Wand (u₁…u₂), Brüstungshöhe
z₁, Sturzhöhe z₂, Wandstärke s (Laibung). Modell C (Balkon): Hauswand dahinter, Balkonplatte darüber,
Trennwände, Brüstung (Glas als „durchsichtig“ markierbar).

### Strahltest

Die Szene wird in eine Liste undurchsichtiger Rechtecke im 3D-Raum übersetzt (Wand mit Fensterloch = bis zu
4 Rechtecke, Laibung = 4 Rechtecke). Eine Richtung d ist frei, wenn der Strahl P + t·d (t > 0) kein Rechteck
trifft. Für eine Wand mit Azimut α_w:

```
n = (sin α_w, cos α_w, 0)      Wandnormale nach außen
r = (cos α_w, −sin α_w, 0)     entlang der Wand, von innen nach außen gesehen rechts

t = n · (W₀ − P) / (n · d)     nur wenn n · d > 0
X = P + t · d,   u = r · (X − W₀),   z = X_z
im Fenster, wenn u₁ ≤ u ≤ u₂ und z₁ ≤ z ≤ z₂, auf Innen- und Außenebene (W₀ + s·n) der Wand
```

Warum Strahlverfolgung: Ein Fenster erscheint im (A, h)-Raum nicht als Rechteck; die waagrechten Kanten
sind gekrümmt. Der Strahltest ist exakt und einfach.

Ab hier lohnt die **Raster-Maske**: Azimut 0,25° × Höhe 0,25°, Höhe −5°…90° (1440 × 380 Zellen) pro
Standpunkt einmal vorberechnen; an Übergängen exakter Test. Das Ergebnis ist wieder eine Maske pro
Standpunkt, verknüpft mit der Horizontlinie wie in Stufe 1.

### Optionales Extra: Sonnenfleck

Projektion der vier Fensterecken entlang −d auf den Boden (z = 0), beschnitten auf den Grundriss, in der
Raum-Draufsicht zur gewählten Zeit.

## Datenmodell

Gespeichert in `localStorage` wie die übrigen Einstellungen in `ui.js`; zusätzlich Export/Import als JSON.

```json
{
  "location": { "latitude": 52.52, "longitude": 13.40 },
  "viewpoints": [
    {
      "name": "Balkon", "floor": 3, "floorHeight": 3.0, "eyeHeight": 1.6,
      "sectors": [ { "azimuthFrom": 120, "azimuthTo": 250, "altitudeFrom": 5, "altitudeTo": 60 } ],
      "horizon": [ [100, 12.0], [140, 8.5], [230, 15.0] ],
      "observations": [ { "time": "2026-10-12T15:42:00+02:00", "body": "sun", "event": "disappear" } ],
      "scene": null
    }
  ],
  "environment": {
    "buildingRadius": 400, "terrainRadius": 50000,
    "ownBuilding": 123456789,
    "buildings": [ "… zwischengespeicherte Overpass-Daten …" ],
    "heightOverrides": { "987654321": 18.0 }
  },
  "settings": { "moonMinDuration": 10, "moonMinIllumination": 0, "moonOnlyDark": false, "moonListMonths": 3 }
}
```

## Genauigkeit

Die astronomische Rechnung ist um Größenordnungen genauer als die Geometrie. Entscheidend sind:

| Fehlerquelle | Größe | Wirkung |
|---|---|---|
| Fassadenrichtung | 1° | Ein-/Austrittszeit um einige Minuten verschoben |
| Fenstermaße, Standpunkt | 10 cm auf 3 m | ≈ 2° an der Fensterkante |
| Gebäudehöhe aus OSM | oft geschätzt, ± 3 m | auf 50 m Entfernung ± 3,5° |
| Geländemodell | ≈ 30 m Raster | einzelne Böschungen und Mauern fehlen |
| Refraktion am Horizont | 34′, schwankt mit Wetter | Zeit am Horizont ± 1–2 min |

Die Kalibrierung über Beobachtungen (Stufe 1) gleicht vor allem Fehler bei Gebäudehöhen und Fassadenrichtung
aus.

## Umsetzung in Stufen

1. **Stufe 1 (umgesetzt):** `calculateRefraction()` (JS + C++), `visibility.js` mit Standpunkten,
   Rechtecken, Horizontlinie, Beobachtungen und Zeitsuche; `Sichtbarkeit.html` mit Horizontdiagramm,
   Jahres-Heatmap, Mondliste, Tagesdetail und Karte; `testVisibility.js`.
2. **Stufe 2:** OSM-Gebäude, Gelände (Nah- und Fernbereich), Zwischenspeichern, Fassade per Klick,
   Höhen bearbeiten, optional Schattenwurf.
3. **Stufe 3:** Modell B/C mit Strahltest und Raster-Maske; optional Sonnenfleck.

Später und optional:

- **Amtliche 3D-Gebäudemodelle (LoD2) und DGM1** der Bundesländer (Open Data z. B. in NRW, Berlin, Hamburg,
  Sachsen, Thüringen). Sie sind viel genauer als OSM, kommen aber als CityGML ohne Web-API und bräuchten einen
  Node-Vorverarbeitungsschritt. Ob es sich lohnt, hängt vom Bundesland und der OSM-Qualität vor Ort ab.
- **C++-Fassung** (z. B. LED-Anzeige „Sonne gleich auf dem Balkon“): über eine exportierte Horizontlinie
  (360 Werte pro Standpunkt), nicht über das Raster.

Nicht vorgesehen: Bäume als eigene Objekte, Sommer/Winter-Unterscheidung beim Laub, Einbindung in
`Erdposition.html`/`Mond.html`. Die gespeicherte Maske ist aber so angelegt, dass andere Seiten sie
später lesen können.

## Schnittstelle `visibility.js`

Umgesetzt in Stufe 1 (Richtungen in Grad, Azimut von Norden):

```js
compileViewpoint(viewpoint)                         // Standpunkt für die Rechnung vorbereiten
horizonAltitude(viewpoint, azimuth)                 // Höhe der Horizontlinie
isDirectionVisible(viewpoint, azimuth, altitude)    // Rechtecke + Horizontlinie
sunDirection(jd, location)                          // { azimuth, trueAltitude, altitude, radius }
moonDirection(jd, location, ephemeris)              // topozentrisch, + illuminatedFraction, waxing
createMoonEphemeris(jdStart, jdEnd)                 // stündliche Stützstellen
findFullMoons(ephemeris)
visibilityLevel(direction, viewpoint)               // Below, Hidden, Partial, Visible
findVisibilityIntervals(body, jdStart, jdEnd, location, viewpoints, options)
computeLevelGrid(body, dayStarts, stepMinutes, location, viewpoints)       // Jahres-Heatmap
computeLevelSeries(body, jdStart, jdEnd, stepMinutes, location, viewpoints) // Tageszeitleiste
observationDirection(observation, location)         // Kalibrierung
```

Geplant für Stufe 2 (Horizontlinie als Maximum aus Hand-Punkten, Gebäuden und Gelände):

```js
horizonFromBuildings(buildings, origin, eyeElevation, excludeIds)   // Höhenwinkel pro 0,25° Azimut
horizonFromTerrain(sampleElevation, origin, eyeElevation, radius)
```
