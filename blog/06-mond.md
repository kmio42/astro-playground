# Der Mond

<!-- Teil 6–9. Gliederung abgestimmt am 2026-11-05 (Grilling). Noch kein Text. Sobald ein Teil
     geschrieben wird, bekommt er eine eigene Datei (06-mondbahn.md, 07-knoten.md, …); bis dahin ist
     dies die Übersicht. -->

## Überblick

Alles Nötige ist aus den Teilen 1–5 bekannt, die Reihenfolge ist deshalb frei. Sie beginnt mit der Bahn
um die Sonne, geht über die Neigung zu den Finsternissen und kommt am Ende an den Horizont zurück.
Mondphase und Sichel bekommen keinen eigenen Teil.

| Teil | Thema | Leitfrage | Modell, Rundgang |
|---:|---|---|---|
| 6 | Bahn um die Sonne ([Entwurf](06-mondbahn.md)) | Umkreist der Mond die Erde oder die Sonne? | `mondbahn`, Ansicht `geo`, Rundgang `schleifen` (umgesetzt) |
| 7 | Neigung und Knoten | Warum gibt es nicht bei jedem Vollmond eine Finsternis? | neu: `mondbahn3d` mit Rundgang |
| 8 | Finsternisse | Wie lassen sich Finsternisse vorhersagen? | `erdemond`, Rundgang `nodes`; evtl. zweiter Platzhalter `apsides` |
| 9 | Mondbahn im Horizontsystem | Warum steht der Vollmond im Winter hoch? | neu: `mondbogen3d` mit Rundgang |

Bausteine wie in der Reihe: Rundgänge für 50° N, 10° O, Bezugsjahr 2026, deutsche Zeit; einzelne
Schritte dürfen in andere Jahre springen. Neue Seiten werden einbettbar (`embed.js`, `MODELS` in
`modelle.js`, Eintrag in `index.html`). Keine wörtlichen Zitate aus Büchern, nur sinngemäß mit Quelle.

## Teil 6: Bahn um die Sonne

Erst das vertraute Bild, dann das verbreitete, dann das echte. Die Überhöhung des Abstands Erde–Mond wird
Schritt für Schritt zurückgedreht; an jeder Schwelle ändert sich die Form. Das bekannte Bild ist nicht
falsch, es gilt nur für einen anderen Maßstab.

- Einstieg: das verbreitete Schulbild mit Schleifen. Dagegen sinngemäß Montenbruck/Pfleger: Nicht die
  nahe Erde, sondern die Sonne beeinflusst die Mondbahn am stärksten, weil ihre große Masse die größere
  Entfernung mehr als ausgleicht.
- Quelle: O. Montenbruck, T. Pfleger, *Astronomie mit dem Personal Computer*, 2. Aufl., Springer 1994,
  Kap. 8 „Die Mondbahn“.

Rundgang „Schleifen“ in `mondbahn.html`:

1. **Der Mond um die Erde:** Erde fest (Ansicht `geo`), Mond läuft in 27,3 Tagen um, Pfeil zur Sonne.
2. **Beide um die Sonne, stark überhöht (etwa ×100):** Schleifen wie in vielen Diagrammen und im
   **Tellurium**.
3. **×30, Spitzen:** In der Darstellung läuft der Mond so schnell um die Erde (×30 · 1 km/s) wie die
   Erde um die Sonne (30 km/s); bei Neumond steht er kurz still.
4. **×10, Welle mit Dellen:** keine Schleifen, aber bei Neumond biegt die Bahn von der Sonne weg.
5. **×2,2, zweite Schwelle:** darunter überall zur Sonne hin gekrümmt – dasselbe Verhältnis wie „die
   Sonne zieht 2,2-mal stärker am Mond als die Erde“.
6. **×1, die echte Bahn:** hineinzoomen; fast ein Vieleck mit 12–13 runden Ecken; Krümmung immer
   positiv. Der Mond bleibt trotzdem bei der Erde, weil beide gemeinsam um die Sonne fallen.
7. **Die Erde schwankt auch:** um den gemeinsamen Schwerpunkt, etwa 4700 km vom Erdmittelpunkt, also
   noch in der Erde.
8. **Frei.**

Begriff: **Welle in der Ebene** – bei Vollmond außen, bei Neumond innen, Takt 29,5 Tage (synodischer
Monat).

## Teil 7: Neigung und Knoten

- Die Mondbahn ist 5,1° gegen die Ekliptik geneigt: bis etwa 34 000 km über und unter der Ebene. Von
  der Kante gesehen eine **Welle senkrecht zur Ebene**, Takt 27,2 Tage (drakonitischer Monat); durch die
  Ebene geht der Mond an den **Knoten**.
- **Zwei Wellen, zwei Takte:** Finsternis nur, wenn Neu- oder Vollmond mit einem Knotendurchgang
  zusammenfällt; das passt etwa alle 173 Tage: **Finsternis-Saisons**.
- **Knotenlinie fest im Raum:** zeigt zweimal im Jahr zur Sonne (2026: Februar/März und August); sie
  wandert in 18,6 Jahren rückwärts, die Saisons kommen jedes Jahr etwa 19 Tage früher.

Modell `mondbahn3d.html` (Canvas 2D auf `canvas3d.js`, läuft von `file://`):
- Sonne, Erdbahn, wahre Mondbahn über ein Jahr; Mondbahnebene als Scheibe um die Erde mit Knotenlinie;
  Marken für Neu- und Vollmond und für Finsternisse (`orbit3d.findEclipse()`); keine Schatten (die
  zeigt `erdemond3d.html`).
- Zwei Regler: Überhöhung der Höhe über der Ekliptik (Standard etwa ×20) und des Abstands in der Ebene
  (Standard ×1, also keine Schleifen).
- Ansichten schräg, von oben, von der Kante; Zeitraffer.
- Rundgang: (1) Welle in der Ebene wie Teil 6, (2) Höhe überhöht: Welle senkrecht zur Ebene, (3) Knoten
  und Knotenlinie, (4) Neu- und Vollmond liegen nur selten auf der Ebene, (5) Knotenlinie zeigt zur
  Sonne: Finsternis-Saison, (6) ein halbes Jahr später die zweite, (7) die Saisons wandern im Jahr nach
  vorn (18,6 Jahre), (8) frei.

## Teil 8: Finsternisse

- Einstieg: astronomische Uhren mit **Drachenzeiger** (Kopf ☊, Schwanz ☋), daher „drakonitischer
  Monat“. Nur im Text, kein eigenes Modell; eine konkrete Uhr nur mit Beleg oder Foto.
- Aufhänger: Sonnenfinsternis vom 12. August 2026 (Spanien); evtl. Bezug auf den älteren
  Finsternis-Beitrag im Blog.
- Kern- und Halbschatten, Saros (18 Jahre 11 Tage); Abschnitt total oder ringförmig je nach Entfernung
  (Perigäum/Apogäum, Supermond).
- Modell: `erdemond` mit `data-tour="nodes"` (z. B. Mondfinsternis am 3. März 2026). Zweiter Platzhalter
  mit `data-tour="apsides"` (Schritte 6/7) nur, wenn der Text ihn braucht – lädt erneut 3,6 MB.
- Texte der Rundgänge `nodes` und `apsides` im Stil der Reihe überarbeiten.

## Teil 9: Mondbahn im Horizontsystem

- Der Vollmond steht der Sonne gegenüber, im Winter also hoch, im Sommer tief.
- Deklination bis ±28,6° bei der großen Mondwende (5,1° + 23,4°), nur ±18,3° bei der kleinen; Wechsel in
  18,6 Jahren – nach Teil 7 leicht zu erklären. Aufhänger: große Mondwende 2024/25.
- **Spirale statt Kreis:** Die Deklination ändert sich um bis zu etwa 6–7° pro Tag; der Bogen schließt
  sich nicht, der Mond geht an einer anderen Stelle unter, als es zum Aufgang passt.
- Im Mittel 50 min später pro Tag, daher Tage mit nur einem Auf- oder Untergang; lange und kurze
  Mondtage; **Erntemond** im September.

Modell `mondbogen3d.html` (eigene Seite auf `canvas3d.js`, Bedienung wie `tagbogen3d.html`: Tag,
Uhrzeit, Breite, Ansichten, Abspielen):
- Horizontscheibe, Himmelsachse, Bahn des Mondes als Spirale über einen wählbaren Zeitraum (Standard
  ±1 Tag), Auf- und Untergangspunkte mit Uhrzeit und Azimut.
- Zum Vergleich der geschlossene Tagbogen der Sonne desselben Tages; als Ebene die Bögen fester
  Deklination ±28,6° und ±18,3°.
- Rundgang: (1) Rückblick Tagbogen der Sonne, (2) der Mond an einem Tag: Spirale, Untergang an anderer
  Stelle, (3) am nächsten Tag etwa 50 min später, ein Tag ohne Aufgang, (4) Vollmond Dezember 2026 hoch,
  (5) Vollmond Juni 2026 tief, (6) ein Monat im Zeitraffer, (7) große Mondwende 2025: bis etwa 68° Höhe,
  17–18 h am Himmel, (8) kleine Mondwende um 2034, (9) Erntemond im September, (10) frei. Zahlen im
  Modell prüfen.

Voraussetzung: Umbau von `calculateMoonRiseSet` in `astro.js` und `cpp/astro.cpp` gemeinsam, gleiche
API. RA, Dec und Entfernung kubisch an 12-h-Stützstellen interpolieren (reicht laut Testbench), Höhe mit
exakter Sternzeit; Durchgänge per stündlicher Grobsuche und Intervallhalbierung bis 1 s, ohne den
Newton-Schritt Δm nach Meeus. `cpp/Plan-Mondaufgang.md` entsprechend anpassen.

## Später

- Libration und Terminator (Libration in Länge und Breite, Relief am Terminator), Modell `mond`.
- Diagramm Mondzeiten (Tage × 0–24 h) wie die Zeiten-Grafik in `tageslaenge.html`.
- Diagramm „Höhe über der Ekliptik mit Neu- und Vollmond-Marken“ als Ergänzung zu Teil 7.
- Rundgang `height` in `erdemond3d.html` bleibt auf der Seite, bekommt nur neue Texte.

## Arbeitsreihenfolge

1. Ansicht `geo` und Rundgang „Schleifen“ in `mondbahn.html`, dann Textentwurf Teil 6 als Stilprobe;
   Freigabe durch den User.
2. `mondbahn3d.html` mit Rundgang.
3. Texte der Rundgänge in `erdemond3d.html`.
4. Umbau Mondaufgang in `astro.js`/`astro.cpp`.
5. `mondbogen3d.html` mit Rundgang.

## Notizen

- `erdemond` lädt 3,6 MB (mobil 1,7 MB) und zeigt erst ein Vorschaubild; pro Beitrag möglichst nur ein
  solches Modell.
