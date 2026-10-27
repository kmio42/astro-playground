# Konzept: Interaktives 3D-Modell von Erde und Mond

Stand: 28.10.2026, Konzept abgestimmt, Stufe 1 und 2 umgesetzt (`ErdeMond3D.html`, `orbit3d.js`, `gl3d.js`,
`testOrbit3d.js`, `prepareTextures3d.py`, `textures/`). Abweichungen in Stufe 2: Die Mond-Normal-Map ist ein JPG
(1,2 MB statt 3,8 MB als PNG), der Atmosphärensaum ist immer an (abschaltbar) und 9-fach überhöht, der Erdschein
etwa 300-fach verstärkt und nach der Phasenkurve einer Lambert-Kugel gewichtet. Zusätzlich: Sprünge zu den
Vierteln und zum absteigenden Knoten, Ansicht „Kante“ von der sonnenbeschienenen Seite.

## Ziel

Eine Seite `ErdeMond3D.html`, die Erde und Mond als drehbares 3D-Modell zeigt und dabei die Geometrie
sichtbar macht, die in `Mond.html`, `Mondbahn.html` und `Erdposition.html` nur in 2D-Projektionen vorkommt:

- **Ekliptikebene** und **Mondbahnebene** mit ihrer Neigung von etwa 5,1°
- **Knotenlinie** mit aufsteigendem ☊ und absteigendem ☋ Knoten, und wie sie in 18,6 Jahren rückwärts wandert
- **Apsiden** (Perigäum, Apogäum) und Apsidenlinie, die in 8,85 Jahren vorwärts wandert
- **Beleuchtete Seiten**: Tag und Nacht auf der Erde (mit Stadtlichtern), Mondphase von jeder Seite aus
  betrachtet, später auch Finsternisse

Alles zu einem frei wählbaren Zeitpunkt, mit Zeitraffer. Die Positionen kommen aus `astro.js`, das Modell ist
also keine Animation nach Schema, sondern zeigt den echten Himmel des gewählten Datums.

**Ohne Internet:** Die Seite lädt nichts aus dem Internet. Bibliothek und Texturen liegen im Projekt und
werden von einem lokalen Webserver ausgeliefert, siehe [Offline-Betrieb](#offline-betrieb).

**Kein Ziel:** heliozentrische Gesamtansicht (das zeigen `Erdposition.html` und `Mondbahn.html`),
Sternhintergrund, Planeten.

## Szene

```
                         Ekliptik-Nordpol (z)
                                │
                     Mondbahnebene (blau, 5,1° geneigt)
              ☋ ─ ─ ─ ─ ─ ─ ─ ─ ┼ ─ ─ ─ ─ ─ ─ ─ ─ ☊      Knotenlinie
         Apogäum ●──────────── (Erde) ─────────● Perigäum   Apsidenlinie
                                │                  ○ Mond
       ─────────── Ekliptikebene (gelb, Gradskala 0°–360°) ──────────
                     ♈ (x) ◄──                ──► zur Sonne ☀ (Lichtrichtung)
```

### Koordinatensystem

- Geozentrisch, **Ekliptik und mittleres Äquinoktium des Datums** (wie `calculateSunPosition()` und
  `calculateMoonPosition()`): x zum Frühlingspunkt ♈, z zum Ekliptik-Nordpol, Einheit **Erdradius**.
- Dieses System gilt auch für WebGL (z oben, Kamera-„Oben“ = Ekliptik-Nordpol). Es gibt keine Umrechnung
  zwischen Rechnung und Darstellung.
- Die Sonne ist kein Körper der Szene, sondern eine **parallele Lichtquelle**. Ihre Richtung wird pro Körper
  berechnet (Sonne minus Körperort); der Unterschied zwischen Erde und Mond ist höchstens 0,15°.

### Elemente

| Element | Darstellung | Quelle |
|---|---|---|
| Erde | Kugel mit Tag-, Nacht- und Wassertextur, Achse um ε geneigt, dreht sich mit der Sternzeit | `calculateGreenwichSiderealTime()`, `calculateObliquity()` |
| Mond | Kugel mit LROC-Farbe und LOLA-Relief (Normal-Map), Libration und Achsneigung korrekt | `calculateMoonPosition()`, `calculateMoonOrientation()` |
| Ekliptikebene | durchscheinende Scheibe, Ringe, Gradteilung alle 30°, Pfeil zum ♈ | fest |
| Mondbahnebene | durchscheinende Scheibe, um die Knotenlinie geneigt | mittlerer Knoten Ω, i = 5,145° |
| Wahre Mondbahn | Linie ±14 Tage um das Datum, oberhalb der Ekliptik durchgezogen, unterhalb gestrichelt/blasser, Tagesmarken | `calculateMoonPosition()` stündlich |
| Mittlere Bahnellipse | dünne Linie, Erde im Brennpunkt (umschaltbar) | Ω, i, e = 0,0549, a = 384 400 km, Perigäumslänge ϖ = L′ − M′ |
| Knoten | ☊/☋ an den Durchgängen der wahren Bahn, Knotenlinie durch die Erde, Beschriftung mit Länge | `calculateNextMoonNode()`, Mondlänge zu dem Zeitpunkt |
| Apsiden | Marken an nächstem Perigäum/Apogäum, Linie durch die Erde, Entfernung in km | `calculateNextMoonApsis()` |
| Sonnenrichtung | Pfeil von der Erde, optional einige parallele Lichtstrahlen | `calculateSunPosition()` |
| Erdachse, Äquatorebene | Linie durch die Pole, Ebene optional | ε |
| Mondachse | kurze Linie durch die Pole des Mondes | Orientierung |
| Standort | Nadel auf der Erde an Breite/Länge aus `ui.js` (optional) | `getLocation()` |
| Beschriftungen | HTML-Elemente über dem Canvas, an projizierte Punkte gesetzt (scharf, keine Texturschrift) | — |

**Wahre Bahn und mittlere Ellipse zusammen** zeigen einen Lerneffekt: Die echte Bahn ist keine feste Ellipse.
Perigäum und Apogäum liegen nicht genau gegenüber, und die momentane Perigäumsrichtung weicht von der
mittleren um bis zu etwa 20–30° ab (Evektion). Die Marken für Knoten und Apsiden kommen deshalb aus den
**echten Durchgängen** (`calculateNextMoonNode()`, `calculateNextMoonApsis()`), die mittleren Werte nur als
dünne Hilfslinie.

### Maßstab

Maßstäblich ist der Mond 0,27 Erdradien groß und 60 Erdradien entfernt. In der Gesamtansicht wäre die Erde
nur etwa 17 px, der Mond 4–5 px groß. Deshalb zwei Regler wie in `Mondbahn.html`:

- **Körper vergrößern** ×1 … ×8 (Standard ×4): Erde und Mond gleich stark, das Größenverhältnis bleibt.
- **Abstand stauchen** ×1 … ×0,25 (Standard ×1).
- Taste **„maßstäblich“** setzt beides auf ×1.

Die Schatten für Finsternisse (Stufe 3) rechnen immer mit der echten Geometrie, nicht mit der vergrößerten.

## Orientierung der Körper

### Erde

Körperachsen → Ekliptik:

```
M_Erde = R_ekl←äq(ε) · R_z(θ₀)        θ₀ = Greenwich-Sternzeit, ε = Schiefe der Ekliptik
```

Der Nullmeridian der Textur (Bildmitte bei Blue Marble) liegt in Richtung Rektaszension θ₀. Nutation und
Präzession der Achse innerhalb des Datums werden vernachlässigt (Fehler < 0,01°, nicht sichtbar).

### Mond

Die Orientierung folgt vollständig aus `calculateMoonOrientation()`. So stimmt das 3D-Modell genau mit der
Darstellung in `Mond.html` überein, einschließlich der physischen Libration:

- **e** = Einheitsvektor Mond → Erde (äquatorial)
- **n̂**, **ô** = Nord- und Ostrichtung am Himmel am Ort des Mondes (senkrecht zur Sichtlinie)
- Libration (l, b), Positionswinkel P der Achse

```
Pol         p = sin b · e + cos b · (cos P · n̂ + sin P · ô)
            h = (e − sin b · p) / cos b,   k = p × h
Körper-x    X = cos l · h − sin l · k
Körper-y    Y = p × X
M_Mond      = R_ekl←äq(ε) · [X Y p]
```

Damit zeigt der selenografische Punkt (l, b) genau zur Erde. Der Nullmeridian der LROC-Textur liegt in der
Bildmitte. Kontrolle (Test): Mondpol, Ekliptikpol und Bahnpol liegen in einer Ebene (Cassini), der Mondpol
ist ≈ 1,54° gegen den Ekliptikpol geneigt.

## Beleuchtung (Shader)

Je ein Shader für Erde und Mond, ein einfacher für Linien und Ebenen. Gerechnet wird in linearen Farben
(Farbtexturen als sRGB-Textur hochgeladen, die Grafikkarte wandelt beim Lesen um), am Ende wird nach sRGB
zurückgewandelt.

**Erde**

- Tagseite: Tagtextur × Lambert (n·s), weicher Übergang über ±6° Sonnenhöhe (Dämmerung).
- Nachtseite: Stadtlichter (Black Marble), eingeblendet, wo die Sonne tiefer als etwa −6° steht.
- Meer: schwache Spiegelung der Sonne (Glanzpunkt) über die Wassermaske.
- Atmosphärensaum: leichter blauer Rand (Fresnel), optional.
- Wolken: nicht in Stufe 1/2 (verdecken Kontinente, brauchen eigenes Datum).

**Mond**

- Lommel-Seeliger statt Lambert: μ₀ / (μ₀ + μ). Der Vollmond erscheint dann wie in Wirklichkeit gleichmäßig
  hell bis zum Rand, ohne Randverdunkelung.
- Relief über eine Normal-Map aus den LOLA-Höhen (CGI Moon Kit). Das macht die Krater am Terminator sichtbar,
  wo das Licht flach einfällt. Die Geometrie bleibt eine glatte Kugel (Relief ±10 km = 0,6 % des Radius).
- **Erdschein** auf der Nachtseite: schwache bläulich-graue Aufhellung, Stärke ∝ beleuchteter Anteil der Erde
  vom Mond aus gesehen (≈ 1 − k des Mondes). Kurz nach Neumond am deutlichsten, wie am Himmel.

**Schatten (Stufe 3)**

Im Fragment-Shader wird für jeden Oberflächenpunkt berechnet, welcher Teil der Sonnenscheibe vom anderen
Körper verdeckt wird (Überdeckung zweier Kreisscheiben, analytisch). Daraus ergeben sich Kern- und
Halbschatten:

- Erdschatten auf dem Mond → Mondfinsternis, mit rötlicher Tönung im Kernschatten
- Mondschatten auf der Erde → Sonnenfinsternis als dunkler Fleck, der über die Erde wandert

Gerechnet wird mit den echten Orten in Erdradien, auch wenn die Darstellung vergrößert ist. Zusätzlich
lassen sich die **Schattenkegel** als durchscheinende Kegel einblenden. Dann wird anschaulich, warum es nicht
jeden Monat eine Finsternis gibt: Der Kegel trifft den Mond nur, wenn Neu- oder Vollmond nahe einem Knoten
liegt.

## Texturen

### Mond: CGI Moon Kit (NASA SVS 4720)

| Datei im Kit | Verwendung | Vorhanden |
|---|---|---|
| `lroc_color_2k.jpg` (2048×1024, Version 2025) | Farbe | ja, im Projekt |
| `lroc_color_16bit_srgb_4k.tif` (4096×2048) | Farbe für Nahansicht, nach JPG umrechnen | nein, 59 MB |
| `ldem_16_uint.tif` (5760×2880, 16 px/°, Halbmeter, Offset +10 km) | Normal-Map 2k (`textures/moon_normal_2k.jpg`, 3-fach überhöht) | in `textures/src/`, 32 MB |
| `ldem_4_uint.tif` (1440×720) | Normal-Map 1k, nur falls 2k zu groß ist | nein, 2 MB |

Beide Karten sind zylindrisch (equirectangular), 0° Länge in der Bildmitte. Die 16-bit-Variante der Höhen
statt der Float-TIFF, weil Pillow sie sicher lesen kann.

### Erde: Entsprechung aus NASA Visible Earth

Ein offizielles „CGI Earth Kit“ gibt es nicht. Die beste Entsprechung mit gleichem Aufbau (Farbe + Höhen,
zylindrisch, 0° in der Bildmitte, gemeinfrei) ist:

| Rolle (wie im Moon Kit) | Datensatz | Datei (beim Download prüfen) |
|---|---|---|
| Farbe ≙ `lroc_color` | **Blue Marble Next Generation** (Reto Stöckli, NASA Earth Observatory), Monatskomposit 2004 mit Relief und Meeresboden | `world.topo.bathy.2004MM.3x5400x2700.jpg` |
| Höhen ≙ `ldem` | **Topography/Bathymetry** (Visible Earth, GEBCO/SRTM) | Graustufen-Höhenkarte 5400×2700 oder 21600×10800 |
| zusätzlich: Nachtseite | **Black Marble 2016** (Suomi NPP VIIRS) | `BlackMarble_2016_3km.jpg` (13500×6750) bzw. 3600×1800 |

Aus der Höhenkarte entstehen die **Wassermaske** (Höhe < 0) für den Glanz auf dem Meer und optional eine
schwache Normal-Map für die Gebirge.

Blue Marble gibt es für jeden Monat (Schnee, Vegetation). Stufe 1 nimmt einen Monat (Vorschlag: Mai, wenig
Schnee auf der Nordhalbkugel). Später kann die Seite den Monat passend zum Datum wählen. Das sind 12 Texturen,
deshalb nur als Option.

### Vorbereitung und Größe

Ein Skript `prepareTextures3d.py` (Python mit Pillow und NumPy, beide installiert) macht aus den Downloads
die Texturen für die Seite:

- Farbkarten verkleinern und als JPG speichern
- Normal-Maps aus den Höhen berechnen (Gradienten auf der Kugel, an den Polen den Längenabstand mit cos φ
  berücksichtigen, Überhöhungsfaktor als Parameter)
- Wassermaske aus den Erdhöhen
- Ergebnis als normale Bilddateien nach `textures/`

| Textur | Auflösung | ca. Größe |
|---|---|---|
| Erde Tag | 4096×2048 JPG | 1,5–2,5 MB |
| Erde Nacht | 2048×1024 JPG | 0,3 MB |
| Erde Wasser (+ Normal) | 2048×1024 PNG, Kanäle zusammengelegt | 0,5 MB |
| Mond Farbe | 2048×1024 JPG (vorhanden) bzw. 4096 | 0,45 / 1,5 MB |
| Mond Normal | 2048×1024 PNG | 1–2 MB |
| **Summe** | | **≈ 4–7 MB** |

Die großen Originaldownloads kommen nach `textures/src/` und in `.gitignore`. Ins Repository kommen das
Skript und die fertigen Texturen in `textures/`.

**Quellenangabe** auf der Seite (wie in `Mond.html`): NASA SVS CGI Moon Kit (LROC, LOLA), NASA Earth
Observatory Blue Marble (R. Stöckli), Black Marble (NASA Earth Observatory / Suomi NPP).

## Offline-Betrieb

Die Seite läuft wie `Sichtbarkeit.html` über einen lokalen Webserver (`python3 -m http.server 8000`, dann
`http://localhost:8000/ErdeMond3D.html`). Unter `file://` ginge es nicht, weil WebGL dort keine Bilddateien
als Textur verwenden darf (gleiche Sperre wie `getImageData` in `Mond.html`).

- **Texturen** sind normale JPG/PNG-Dateien in `textures/`.
- **Keine Fremdbibliothek.** Alle Skripte sind eigene, klassisch eingebunden (`<script src>`) wie `astro.js`.
- Die Seite zeigt einen Hinweis, wenn sie per `file://` geöffnet wird.

## WebGL-Baustein `gl3d.js`

Eigenes WebGL2 statt three.js. Die wiederverwendbaren Teile kommen in `gl3d.js` (IIFE, im Browser global
wie `render.js`). Die Seite enthält nur die Szene, die Shader und die Bedienung. Der Rechenteil von
`gl3d.js` (Matrizen, Geometrie, Strahltest) braucht kein WebGL und läuft auch in Node, damit er testbar ist.

**Mathematik**

- `mat4` (Spalten-Reihenfolge wie WebGL): `perspective`, `lookAt`, `multiply`, `invert`, `fromRotation3`
  (übernimmt die 3×3-Matrizen aus `orbit3d.js`), `transformPoint`; dazu `vec3`-Hilfen.
- **Kamera-relative Koordinaten:** Die Positionen werden in JavaScript (double) um den Kameraort verschoben,
  bevor sie als float32 an die Grafikkarte gehen. Damit bleibt eine Nahansicht des Mondes 60 Erdradien vom
  Ursprung genau.
- **Nahe Schnittebene dynamisch:** Abstand zur nächsten Oberfläche × 0,5, ferne Ebene passend zur Szene. So
  reicht der 24-bit-Tiefenpuffer vom Krater bis zur Gesamtansicht.

**WebGL-Grundgerüst**

- `createContext(canvas)`: WebGL2 mit Kantenglättung (MSAA), Größe nach `devicePixelRatio`, Neuzeichnen
  nur bei Änderung (Kamera, Zeit, Abspielen). Ohne WebGL2 erscheint ein Hinweis.
- `createProgram(gl, vs, fs)`: übersetzt die Shader, Fehlermeldungen mit Zeilennummer und Quelltextzeile.
  Uniforms werden über ihren Namen gesetzt (Zwischenspeicher der Adressen).
- `loadTexture(gl, url, { srgb, mipmaps })`: Farbkarten als `SRGB8_ALPHA8`, Normal-Map und Masken linear,
  Mipmaps und anisotrope Filterung, falls vorhanden. Gibt ein Promise zurück. Die Szene zeichnet schon
  vorher mit einfarbigen Ersatztexturen.

**Geometrie**

- `sphere(nLat, nLon)`: Positionen = Normalen, UV mit doppelter Naht bei ±180°, damit die Textur nicht
  springt. Die Tangente für die Normal-Map folgt auf der Kugel direkt aus dem Ort und wird im Shader
  berechnet.
- `disc(rInnen, rAußen, n)` für die Ebenen, `cone(...)` für Schattenkegel und Pfeilspitzen.
- `createMesh(gl, { positions, normals, uvs, indices })` → Vertex-Array-Objekt.

**Linien**

WebGL zeichnet Linien nur 1 px breit und ohne Strichelung. Deshalb ein eigener Linien-Shader: Jedes
Segment wird als Rechteck aus zwei Dreiecken gezeichnet, das der Vertex-Shader in Bildschirmpixeln auf die
gewünschte Breite aufzieht (Attribute: Start, Ende, Seite). Eine Attribut-Spalte mit der aufsummierten
Länge ergibt Strichelung (Bahn unterhalb der Ekliptik) und Tagesmarken. Die Bahnkurven sind fein genug
unterteilt, sodass keine eigenen Eckverbindungen nötig sind.

**Zeichenreihenfolge**

1. Erde und Mond (undurchsichtig, schreiben Tiefe)
2. Linien und Marken (Tiefentest an, damit die Bahn hinter der Erde verschwindet; kleiner Tiefenversatz
   gegen Flimmern auf den Ebenen)
3. Ekliptik- und Mondbahnebene: durchscheinend, Tiefe nicht schreiben, **additive Mischung**. Additiv ist
   unabhängig von der Reihenfolge, daher gibt es kein Sortierproblem, obwohl sich die beiden Ebenen in der
   Knotenlinie schneiden.

**Kamera**

Eigene Bahnkamera: Ziel, Abstand, Azimut, Höhe, „Oben“ immer z (Ekliptik-Nordpol).

- Maus: Ziehen dreht, Rad zoomt (Faktor pro Schritt), rechte Taste oder Umschalt+Ziehen verschiebt.
- Touch: ein Finger dreht, zwei Finger zoomen (Pinch) und verschieben (Pointer Events).
- Höhe begrenzt auf ±89°, damit „oben“ eindeutig bleibt; Abstand begrenzt, damit die Kamera nicht in einen
  Körper fährt.
- Ansichten-Knöpfe fahren weich in etwa 0,8 s zur neuen Einstellung. Mitführen: Das Ziel folgt dem Körper.

**Beschriftungen und Anklicken**

- HTML-Elemente über dem Canvas. Pro Bild wird ihr 3D-Punkt projiziert. Sie werden ausgeblendet, wenn der
  Punkt hinter der Kamera liegt oder ein Körper davor ist (Strahl-Kugel-Test).
- Doppelklick: Strahl durch den Mauspunkt, Schnitt mit den Kugeln von Erde und Mond.

## Bedienung

**Kamera**

- Ziehen dreht um das Ziel, Mausrad/Pinch zoomt, Rechtsklick/zwei Finger verschieben. Die „Oben“-Richtung
  bleibt der Ekliptik-Nordpol, damit man die Orientierung nicht verliert.
- Ziel umschalten: Erde, Mond, Mitte des Systems. Doppelklick auf einen Körper setzt ihn als Ziel.
- **Ansichten** per Knopf:
  - *Übersicht*, schräg von oben
  - *Ekliptik von oben*: Bahnform, Apsiden, Phasen als Draufsicht
  - *Kante-auf*: in der Ekliptik, senkrecht zur Knotenlinie, zeigt die 5°-Neigung am deutlichsten
  - *Von der Sonne*: beide Körper voll beleuchtet, Mond vor oder neben der Erde
  - *Von der Erde zum Mond*: enges Blickfeld, zeigt Phase und Libration wie `Mond.html`
  - *Vom Mond zur Erde*: Erdphase und Erdschein
- Option „mitführen“: Die Kamera bewegt sich im Zeitraffer mit dem Ziel.

**Zeit**

- Datum/Uhrzeit wie auf den anderen Seiten (`ui.js`, Checkbox Lokalzeit), Knopf „Jetzt“.
- Abspielen/Pause, Geschwindigkeit in Stufen: 1 min/s, 1 h/s, 1 Tag/s, 1 Monat/s. Bei 1 Monat/s dauert ein
  Knotenumlauf (18,6 Jahre) etwa 4 Minuten. So sieht man die Knoten- und Apsidendrehung.
- Sprünge zum nächsten/vorigen: Neumond, Vollmond, aufsteigenden Knoten, Perigäum, Apogäum.

**Ebenen ein/aus**: Ekliptik, Mondbahnebene, wahre Bahn, mittlere Ellipse, Knoten, Apsiden, Sonnenrichtung,
Achsen, Äquatorebene, Standort, Beschriftungen, (Stufe 3) Schattenkegel.

**Infotabelle** (Seitenleiste, wie die Tabellen der anderen Seiten): Mondlänge/-breite, Entfernung,
Elongation, beleuchteter Anteil und Phasenname, Libration, Länge des mittleren Knotens Ω, **Winkel Sonne –
Knotenlinie** (unter etwa 17° → Finsternis möglich), Zeit bis zum nächsten Knoten, Perigäum und Apogäum mit
Entfernung.

**Erklärungen**: Glossar unter der Szene, kurz wie ein Lexikon-Eintrag (Ekliptik, Knoten, Apsiden,
Libration, Erdschein, Drachenmonat, anomalistischer Monat, Finsternis-Saison).

## Aufbau der Dateien

| Datei | Inhalt |
|---|---|
| `ErdeMond3D.html` | Seite: Szene, Shader (`<script type="x-shader/...">`), Bedienung, Infotabelle |
| `gl3d.js` | eigener WebGL2-Baustein: Matrizen, Kamera, Geometrie, Linien, Texturen, Shader-Hilfen |
| `orbit3d.js` | DOM-freie Rechnung wie `visibility.js` (Browser: global, Node: `require`), Ekliptik-Koordinaten, Matrizen als einfache Arrays |
| `testOrbit3d.js` | Tests mit Node für `orbit3d.js` und den Rechenteil von `gl3d.js` |
| `textures/` | fertige Texturen (Erde Tag/Nacht/Wasser, Mond Farbe/Normal) |
| `prepareTextures3d.py` | erzeugt `textures/` aus den Downloads in `textures/src/` |

Verwendet `astro.js` und `ui.js`. `render.js` bleibt unverändert: Es hat nur 3×3-Matrizen und
Canvas-2D-Linien. Die 4×4-Matrizen kommen deshalb nach `gl3d.js`.

### Schnittstelle `orbit3d.js`

```
sceneState(jd)            → { sun: { direction, distance },
                              moon: { position [Erdradien], distance [km], latitude, rotation 3×3 },
                              earth: { rotation 3×3 }, obliquity, meanNode }
moonPath(jd0, jd1, stepH) → [{ jd, position, latitude }]          wahre Bahn
meanOrbit(jd)             → { node Ω, inclination, eccentricity, semiMajorAxis, perigeeLongitude ϖ }
ellipsePoints(orbit, n)   → Punkte der mittleren Ellipse
nodePassages(jd)          → vorige/nächste ☊ und ☋ mit Zeit und Position
apsides(jd)               → vorige/nächste Perigäen und Apogäen mit Zeit, Position, Entfernung
nextPhase(jd, phase)      → Zeit von Neu-/Vollmond (Nullstelle der Elongation in Länge)
earthRotation(jd), moonRotation(jd, moon)
```

### Tests

- **Mond:** Aus `moonRotation` zurückgerechneter Unter-Erde-Punkt = Libration (l, b) aus
  `calculateMoonOrientation()`. Mondpol ≈ 1,54° vom Ekliptikpol, Mondpol, Ekliptikpol und Bahnpol in einer
  Ebene.
- **Erde:** Unter-Sonnen-Punkt hat die Breite = Deklination der Sonne. Zur Meridiandurchgangszeit aus
  `calculateSunRiseSet()` für Länge 0° liegt er auf dem Nullmeridian.
- **Knoten:** Zum Zeitpunkt aus `calculateNextMoonNode()` ist die Mondbreite ≈ 0, und das Vorzeichen wechselt
  in der richtigen Richtung.
- **Apsiden:** Die Entfernung zum Zeitpunkt aus `calculateNextMoonApsis()` ist das Minimum bzw. Maximum von
  `moonPath()` in der Umgebung.
- **Phasen:** `nextPhase()` stimmt mit veröffentlichten Neu-/Vollmondzeiten auf etwa 1 min überein.
- **Mittlere Bahn:** a(1 − e) und a(1 + e) liegen im Bereich der beobachteten Perigäums- und
  Apogäumsentfernungen.
- **`gl3d.js`:** `invert(M)·M = E`, `lookAt` und `perspective` bilden bekannte Punkte richtig ab,
  Strahl-Kugel-Schnitt, Kugelgeometrie (Normalen = Positionen, UV an der Naht 0 und 1).

Die Darstellung selbst wird im Headless-Browser geprüft (Chromium mit Software-WebGL, z. B.
`--use-angle=swiftshader`; Bildschirmfotos zu festen Daten, etwa zu einer bekannten Mondfinsternis).

## Genauigkeit

- Positionen aus `astro.js` (Meeus Kap. 45/25): Mond etwa 10″, Sonne etwa 0,01°. Im Modell nicht sichtbar.
- Orientierung: Erde ohne Nutation, Mond nach Kap. 51 ohne Nutation. Fehler weit unter 0,1°.
- Texturen: Blue Marble etwa 8 km/px bei 5400 px, auf 4096 px verkleinert etwa 10 km/px. LROC 2k etwa
  5 km/px.
- Licht: parallel, keine Lichtlaufzeit, keine Refraktion.

## Umsetzung in Stufen

**Stufe 1: Grundmodell**

- `gl3d.js`: Mathematik, Grundgerüst, Kugel, Scheibe, Linien-Shader, Bahnkamera, Tests
- `prepareTextures3d.py` mit vorhandener LROC-Textur und Blue-Marble-/Black-Marble-Downloads, `textures/`
- `orbit3d.js` mit `sceneState`, `moonPath`, `nodePassages`, `apsides`, Tests
- Seite: Erde (Tag/Nacht), Mond (Lommel-Seeliger, noch ohne Relief), Ekliptik, Mondbahnebene, wahre Bahn,
  Knoten, Apsiden, Sonnenrichtung, Maßstabsregler, Kamera mit Maus/Touch, Zeitsteuerung, Infotabelle

**Stufe 2: Aussehen und Ansichten**

- Mond-Normal-Map aus LOLA, Erdschein, Meeresglanz, Atmosphärensaum
- Ansichten-Knöpfe, mitführende Kamera, Sprünge zu Phasen/Knoten/Apsiden
- mittlere Bahnellipse, Standort-Nadel, Glossar

**Stufe 3: Schatten und Finsternisse**

- Kern-/Halbschatten im Shader, Schattenkegel
- Anzeige „Finsternis-Saison“ (Sonne nahe der Knotenlinie), Sprung zur nächsten Neu-/Vollmondnähe am Knoten
- optional: Blue Marble passend zum Monat, Relief-Überhöhung in der Nahansicht

## Entscheidungen

- **Ohne Internet = lokal gehostet.** Ein lokaler Webserver (Python, Node.js) ist in Ordnung. Deshalb
  bleiben die Texturen normale Dateien, statt als data-URLs eingebettet zu werden.
- **Eigenes WebGL2 statt three.js.** Die Shader, `orbit3d.js`, die Bedienung und die Tests sind auf beiden
  Wegen gleich viel Arbeit. Eigenes WebGL kostet zusätzlich etwa 700–800 Zeilen Grundgerüst (`gl3d.js`,
  siehe oben), fast alles in Stufe 1. Dafür gibt es keine Fremdbibliothek, jede Zeile ist nachvollziehbar,
  der Stil passt zu `render.js`, und es gilt durchgehend z oben.

- **Texturen:** Erde 4k (Tag) und 2k (Nacht, Wasser), Mond 2k, zusammen etwa 2 MB.
- **Blue Marble mit eingebranntem Relief** (`world.topo.bathy.200405`).
- **Name der Seite:** `ErdeMond3D.html`.
- **Wassermaske:** Die GEBCO-Meerestiefen sind im flachen Schelf gesättigt (Nordsee = Land), die Landhöhen
  im Meer und im Tiefland beide 0. Wasser ist deshalb „Landhöhe 0 und in Blue Marble deutlich blauer als rot“,
  dazu dunkle, blaue Seen über dem Meeresspiegel.
