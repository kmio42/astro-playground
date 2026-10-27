# Konzept: Wann sind Sonne und Mond von Wohnung/Balkon aus sichtbar?

Stand: 27.10.2026, Konzept abgestimmt, Stufen 1 bis 3 umgesetzt (`Sichtbarkeit.html`, `visibility.js`,
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

1. Gebäude im Umkreis von **400 m** (einstellbar) über die Overpass-API laden, auch Multipolygon-Relationen
   (große Blöcke mit Innenhöfen, z. B. das Rote Rathaus):

   ```
   [out:json][timeout:25];
   (way["building"](around:400,{lat},{lon}); relation["building"](around:400,{lat},{lon}););
   out body geom;
   ```

   `out geom tags` reicht nicht: Relationen kommen dann ohne Mitglieder. Die öffentlichen Overpass-Server sind
   oft überlastet (502/504); die Seite versucht nacheinander overpass-api.de, overpass.kumi.systems und
   maps.mail.ru. `building:part` wird nicht ausgewertet (würde doppelt zählen).

2. Höhe: `height` → sonst `building:levels` × 3 m + `roof:levels` × 1,5 m → sonst 10 m. Geschätzte Höhen
   werden in der Karte farblich markiert und sind per Klick änderbar.
3. Eigenes Gebäude per Klick ausschließen.
4. Grundrisse ins lokale System umrechnen (bei < 1 km genügt eine Ebene: x = R·Δλ·cos φ₀, y = R·Δφ).
5. Für jedes Azimut in 0,25°-Schritten den Strahl mit allen Gebäudekanten schneiden; Höhenwinkel
   atan((z_Dach − z_Auge) / Entfernung), das Maximum ist der Gebäude-Horizont.

### Gelände

Quelle sind Kacheln im **Terrarium-Format**, dekodiert im Browser per Canvas:

- **[Mapterhorn](https://mapterhorn.com)** (`tiles.mapterhorn.com/{z}/{x}/{y}.webp`, 512 px, CORS erlaubt): ein
  **Bodenmodell** aus 151 offenen Quellen, in Deutschland das DGM1 der Länder (Berlin: ATKIS-DGM 1 m,
  dl-de/zero-2-0; Brandenburg: DGM1, dl-de/by-2-0 „© GeoBasis-DE/LGB“), sonst u. a. Copernicus GLO-30. Zoomstufen
  bis 16 in Gebieten mit feinen Daten, sonst bis 12; über dem Meer 0 m. Keine eigene Datenlizenz (es gelten die
  der Quellen), keine veröffentlichten Nutzungsgrenzen. Namensnennung „© Mapterhorn“ mit Link auf
  mapterhorn.com/attribution.
- **Ersatz: [Terrain Tiles auf AWS](https://registry.opendata.aws/terrain-tiles)** (`…/terrarium/{z}/{x}/{y}.png`,
  256 px), in Europa EU-DEM, ein **Oberflächenmodell** (Dächer teils enthalten).

Beim Laden wird per Probekachel (Zoom 12 am Standort) entschieden; alle Kacheln eines Ladevorgangs kommen aus
derselben Quelle, weil die Modelle in Städten über 10 m auseinanderliegen und gemischt Kanten erzeugen würden.
Gebäude und Gelände speichern ihre Quelle und ihre eigene Bodenhöhe am Standort; das Auge bezieht sich jeweils
auf dieselbe Quelle wie die Hindernisse.

```
Höhe [m] = R · 256 + G + B / 256 − 32768
```

Geprüft in Berlin-Mitte (52,52° N, 13,405° O): Mapterhorn 35,5 m, Open-Meteo (Copernicus GLO-90) 37 m, AWS
48 m. Die AWS-Kacheln der Zoomstufe 14 sind aus gröberen Daten interpoliert (effektiv 30–90 m); Fußpunkthöhen
benachbarter Gebäude streuen damit zwischen 31 und 49 m, mit Mapterhorn zwischen 34 und 37 m. Bei AWS gilt
deshalb als Bodenhöhe das **Minimum** mehrerer Punkte (Standort: Mitte und 8 Punkte in 20 m; Gebäude:
Mittelpunkt und bis zu 12 Ecken), bei Mapterhorn der Wert am Punkt selbst. Für die Fußpunkte werden Zoom 14 und
als Rückfall Zoom 12 geladen.

**Nahbereich (Fußpunkthöhen):**

```
z_Dach  = Gelände(Gebäudemittelpunkt) + Gebäudehöhe          [m über NN]
z_Auge  = Gelände(Standpunkt) + Stockwerk × Geschosshöhe + Augenhöhe
```

**Fernbereich (Hügel und Berge):**

- Standardradius **50 km**, einstellbar bis 200 km.
- Abtastung pro 0,25° Azimut entlang des Strahls: bis 2 km alle 25 m, darüber in Schritten von 1 % der
  Entfernung. Zoomstufe nach Entfernung: bis 2 km 14, bis 10 km 12, bis 40 km 10, darüber 8 (Pixel etwa ein
  Drittel des Abtastschritts). Das sind 61 Kacheln für 50 km und 87 für 200 km (mit Zoomstufe 11 durchgehend
  wären es ≈ 100 bzw. über 1000).
- Meer statt Meeresboden: Höhen unter 0 m zählen als 0 m (die Kacheln enthalten Bathymetrie).
- Die ersten ~100 m um den Standpunkt bleiben unberücksichtigt, sonst erzeugt die grobe Auflösung
  Phantom-Hindernisse direkt vor dem Haus.
- Absenkung durch Erdkrümmung mit Refraktion: Δz = d² / (2R) · (1 − k), k ≈ 0,13
  (10 km ≈ 6,8 m, 50 km ≈ 170 m). Test: Ebene aus 100 m Höhe ergibt die Kimmtiefe −0,299°.
- **Gespeichert wird je Azimut die obere konvexe Hülle** der Punkte (Entfernung, Höhe). Der höchste
  Höhenwinkel von einem Auge in Höhe z liegt immer auf einer Ecke dieser Hülle; Ecken, die für Augenhöhen
  zwischen Boden − 5 m und Boden + 300 m nicht in Frage kommen, entfallen. In Berlin bleiben ≈ 8 Ecken je
  Richtung (≈ 120 KB). So lassen sich Stockwerk und Augenhöhe ändern, ohne neu zu laden.

### Zwischenspeichern

Overpass-Gebäude (Umriss, wenige Tags, Fußpunkthöhe), Geländeprofil (Hüllen) und Höhenkorrekturen werden
einmal geladen und im gespeicherten Zustand abgelegt (localStorage + JSON-Export). Neu geladen wird nur auf
Knopfdruck („Umgebung laden“ holt beides parallel); eigene Korrekturen bleiben erhalten. Nur die
Kartenkacheln brauchen dann noch Internet. Liegt der Standort mehr als 100 m vom Ladeort entfernt, werden die
Daten nicht verwendet und die Seite bittet um Neuladen. Das eigene Gebäude wird beim Laden vorgewählt, wenn der
Standort in einem Grundriss liegt.

### Karte in Stufe 2

- Gebäude nach Höhe eingefärbt (6-m-Stufen), geschätzte Höhen gestrichelt, eigenes Gebäude grau. Klick öffnet
  ein Popup: Höhe ändern (zurück zum OSM-Wert per Knopf), „eigenes Gebäude“.
- **Fassade per Klick übernehmen:** Die Kante, die der Klickstelle am nächsten liegt, wird markiert; ihre
  Normale nach außen ist der Fassaden-Azimut (genauer als Kompass). „Als Sichtbereich“ legt den Halbraum vor
  der Wand an (Fassade ± 90°, Höhe −5°…90°).
- Schattenwurf der Gebäude zur gewählten Zeit (konvexe Hülle aus Grundriss und um H / tan h entgegen der
  Sonnenrichtung verschobenem Grundriss) als Plausibilitätskontrolle der Höhen.
- Im Horizontdiagramm erscheint die berechnete Linie grau; der Tooltip nennt das Hindernis („Nikolaikirche
  (84,4 m) in 135 m“ bzw. „Gelände“). Kirchtürme und Türme gelten über den ganzen Grundriss als so hoch wie
  die Spitze – solche Höhen von Hand senken.

## Stufe 3: Wohnung als Quader (B) und Balkon (C)

### Eingabe

- Grundriss der Wohnung bzw. des Balkons in der Karte: Klick auf ein Gebäude, „Wohnung hier“ übernimmt die
  Richtung der angeklickten Fassade und setzt die Mitte der Wohnung an die Klickstelle. Statt eines drehbaren
  Rechtecks zum Ziehen gibt es die Fassadenrichtung als Zahl im Formular (Feinkorrektur).
- Fenster, Balkonplatte, Brüstung, Trennwände per Formular (Maße in m).
- Kontrolle über eine Raum-Draufsicht (mit Sonnenfleck und Richtung zur Sonne) und eine Ansicht der Fensterwand
  **von innen**: so stimmen links und rechts mit der Draufsicht und dem Formular überein (Blick nach draußen).
  Dazu das Horizontdiagramm, in dem die Fenster als freie Flächen erscheinen; der Tooltip nennt das verdeckende
  Teil (Wand, Laibung, Sturz, Balkonplatte …).

Modell B (Quader): Breite, Tiefe, Raumhöhe; pro Fenster Wand, Lage entlang der Wand (u₁…u₂), Brüstungshöhe
z₁, Sturzhöhe z₂, Wandstärke s (Laibung). Modell C (Balkon): Hauswand dahinter, Balkonplatte darüber,
Trennwände, Brüstung (Glas als „durchsichtig“ markierbar).

Umgesetzt sind B und C **in einer Szene**: Raum und Balkon sind je optional, das Auge steht im Raum oder auf dem
Balkon. So lässt sich auch „Sofa im Zimmer hinter dem Balkon“ rechnen (Fenster, davor Balkonplatte und
Trennwand). Ein neuer Standpunkt übernimmt Raum und Balkon des gewählten (gleiche Wohnung, anderer Platz).
Vereinfachungen: Balkonboden auf Höhe des Raumbodens; Balkonplatte darüber so groß wie der Balkon; Trennwände so
hoch wie die Platte; vom Balkon aus ist die Hauswand undurchsichtig (kein Blick durch die Wohnung).

Raum-Koordinaten: x entlang der Fassade (nach rechts mit Blick nach draußen), y nach außen (y = 0 Außenseite
der Fensterwand), z nach oben (z = 0 Fußboden). Fenster an Fensterwand und Rückwand zählen ab der linken
Raumecke, an den Seitenwänden ab der Fensterwand; der Balkon zählt ebenfalls ab der linken Raumecke.

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

Umsetzung: Alle Teile liegen parallel zu den Achsen der Raum-Koordinaten, darum sind die Rechtecke achsparallel
(Ebene x, y oder z = konstant). Der Raum ist innen geschlossen (Wände mit Fensterlöchern, Decke, Boden), jedes
Fenster ist ein Durchgang mit vier Laibungsflächen. Die Raster-Maske speichert die 1440 × 381 Knoten; sind die
vier Ecken einer Zelle gleich, gilt ihr Wert, sonst entscheidet der exakte Strahltest. Unter −5° wird immer
exakt gerechnet. Die Szene wirkt zusätzlich zu Sichtbereichen und Horizontlinie (alle Bedingungen „und“).

Ergebnisse der Tests (`testVisibility.js`, Nr. 14–17):

- Fenster 2 m breit, 2 m vor der Wand, Wand 35 cm: frei ±23,05° = atan(1 / 2,35); die Außenkante der Laibung
  begrenzt. Geradeaus nach oben bis 16,59°, 20° seitlich nur bis 15,64° (gekrümmte Kante).
- Raster gegen exakten Test: 0 von 50 000 Zufallsrichtungen abweichend (Raum, Raum mit Eckfenster und Balkon,
  Balkon); Raster in 10–45 ms.
- Jahres-Heatmap mit Szene nicht langsamer als ohne (weniger Randpunkte zu prüfen).

### Optionales Extra: Sonnenfleck

Projektion der vier Fensterecken entlang −d auf den Boden (z = 0), beschnitten auf den Grundriss, in der
Raum-Draufsicht zur gewählten Zeit.

Umgesetzt anders: Der Boden von Raum und Balkon wird im 10-cm-Raster abgetastet, von jedem Punkt geht ein
Strahl zur Sonne durch dieselben Rechtecke. Das berücksichtigt Laibung, Balkonplatte und mehrere Fenster ohne
Polygon-Schnitte. Die Umgebung (Horizontlinie) entscheidet vorab, ob die Sonne überhaupt frei steht. Test: Sonne
aus Süden in 30° Höhe, Fenster wie oben → 4,20 m² (exakt 4,15 m²).

## Datenmodell

Gespeichert in `localStorage` wie die übrigen Einstellungen in `ui.js`; zusätzlich Export/Import als JSON.

```json
{
  "location": { "latitude": 52.52, "longitude": 13.40 },
  "viewpoints": [
    {
      "name": "Balkon", "floor": 3, "floorHeight": 3.0, "eyeHeight": 1.6,     // floor 0 = Erdgeschoss
      "sectors": [ { "azimuthFrom": 120, "azimuthTo": 250, "altitudeFrom": 5, "altitudeTo": 60 } ],
      "horizon": [ [100, 12.0], [140, 8.5], [230, 15.0] ],
      "observations": [ { "time": "2026-10-12T15:42:00+02:00", "body": "sun", "event": "disappear" } ],
      "scene": {                                                              // null ohne Raum/Balkon
        "facade": 180, "wall": 0.35, "anchor": { "latitude": 52.52, "longitude": 13.40 },   // anchor: x = 0, y = 0
        "room": { "width": 4, "depth": 5, "height": 2.6,
                  "windows": [ { "wall": "front", "from": 1, "to": 3, "sill": 0.9, "top": 2.2 } ] },  // front|left|right|back
        "balcony": { "from": 0.5, "to": 3.5, "depth": 1.5, "ceiling": 2.7, "slab": true,
                     "parapet": 1.0, "glass": false, "dividerLeft": false, "dividerRight": true },
        "eye": { "place": "room", "x": 2, "y": 1.5 }                          // y: Abstand zur Wand
      }
    }
  ],
  "environment": {
    "buildingRadius": 400, "terrainRadius": 50000,
    "useBuildings": true, "useTerrain": true, "showShadows": false,
    "ownBuilding": "way/123456789",
    "groundElevation": 41.4,
    "buildings": { "origin": { "latitude": 52.52, "longitude": 13.40 }, "radius": 400, "loaded": "2026-10-27T…",
                   "items": [ { "id": "relation/23745", "tags": { "building:levels": "4" }, "rings": [ [[52.51, 13.41], …] ], "ground": 41.6 } ] },
    "terrain": { "origin": { … }, "radius": 50000, "loaded": "…", "groundElevation": 41.4,
                 "hulls": [ [ 2350, 78.6, 9351, 56.6 ], … ] },          // je 0,25° Azimut: Entfernung, Höhe, …
    "heightOverrides": { "way/987654321": 18.0 }
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
2. **Stufe 2 (umgesetzt):** OSM-Gebäude (auch Relationen), Gelände (Nah- und Fernbereich), Zwischenspeichern,
   Fassade per Klick, Höhen bearbeiten, Schattenwurf; Stockwerk/Geschosshöhe/Augenhöhe je Standpunkt.
3. **Stufe 3 (umgesetzt):** Modell B/C als eine Szene mit Strahltest und Raster-Maske, Sonnenfleck,
   Draufsicht und Fensterwand-Ansicht, Einrasten an einer OSM-Fassade.

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

Umgesetzt in Stufe 2 (Orte als { latitude, longitude } in Grad, Höhen in m ü. NN; Profile mit
HORIZON_BINS = 1440 Werten für 0°, 0,25°, …):

```js
compileViewpoint(viewpoint, profile)                // Maximum aus Hand-Horizontlinie und Profil
buildingHeight(tags)                                // { height, source: 'height' | 'levels' | 'default' }
horizonFromBuildings(buildings, origin, eyeElevation, excludeIds)   // { altitude, building, distance }
terrainTileList(origin, radius, zoom?)              // benötigte Terrarium-Kacheln
decodeTerrarium(rgba), createTerrainSampler(tiles)  // Kacheln → sampleElevation(lat, lon, distance)
terrainProfile(sampleElevation, origin, options)    // obere Hülle je Azimut (wird gespeichert)
horizonFromTerrain(profile, eyeElevation)           // Profil für eine Augenhöhe
combineProfiles(...profiles)                        // Maximum
pointInBuilding, nearestEdge, facadeAzimuth         // Karte: eigenes Gebäude, Fassade per Klick
```

Umgesetzt in Stufe 3 (Szene im Standpunkt als `viewpoint.scene`, Augenhöhe aus `viewpoint.eyeHeight`):

```js
normalizeScene(scene)                               // Zahlen begrenzen, Fenster in die Wand, Auge in den Raum
compileScene(scene, eyeHeight)                      // Rechtecke + Raster-Maske (compileViewpoint ruft es selbst auf)
sceneRectangles(scene, place)                       // undurchsichtige Rechtecke für Auge im Raum / auf dem Balkon
sceneDirectionFree(cs, azimuth, altitude)           // exakter Strahltest
sceneVisible(cs, azimuth, altitude)                 // über die Raster-Maske, exakt an Übergängen
sceneObstacle(cs, azimuth, altitude)                // { name, distance } des verdeckenden Teils
sunPatch(cs, azimuth, altitude, step)               // besonnte Bodenstellen und Fläche
```
