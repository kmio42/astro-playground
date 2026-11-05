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
| 7 | Neigung und Knoten ([Entwurf](07-knoten.md)) | Warum gibt es nicht bei jedem Vollmond eine Finsternis? | `mondbahn3d`, Rundgang `knoten` (umgesetzt) |
| 8 | Finsternisse | Wie lassen sich Finsternisse vorhersagen? | `erdemond`, Rundgang `nodes`; evtl. zweiter Platzhalter `apsides` |
| 9 | Mondbahn im Horizontsystem | Warum steht der Vollmond im Winter hoch? | `mondbogen`, Rundgang `mondbogen` (umgesetzt) |

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

Modell `mondbahn3d.html` (Canvas 2D auf `canvas3d.js`, läuft von `file://`), umgesetzt am 2026-11-05:
- Sonne, Erdbahn, wahre Mondbahn über ein Jahr (über der Ekliptik durchgezogen, darunter gestrichelt, wahlweise
  als Fläche bis zur Ebene); Marken für Neu- und Vollmond, Knoten und Finsternisse (`orbit3d.findEclipse()`);
  Finsternis-Saisons als Bögen auf der Erdbahn (Sonne weniger als 18° neben der Knotenlinie); Knotenlinie durch
  die Erde. Keine Schatten (die zeigt `erdemond3d.html`).
- Mondbahnebene als Scheibe um die Erde: Ebene „Mondbahn um die Erde“ (±14 Tage, Erde festgehalten); sichtbar
  erst mit vergrößertem Abstand, im Rundgang ×50.
- Zwei Regler: Überhöhung der Höhe über der Ekliptik und Vergrößerung des Abstands in der Ebene (Standard ×1,
  also keine Schleifen). Abweichung von der Planung: Standard der Höhe ×300 statt ×20; bei ×20 wäre die Welle
  in der Übersicht nur 1–2 Pixel hoch.
- Ansichten schräg, von oben, von der Kante, „Zur Erde“ (folgt der Erde, von außen Richtung Sonne) und „Zur Erde
  von oben“; Abspielen Monat und Jahr; Sprünge zu Vollmond, Neumond, Knoten, Finsternis.
- Rundgang `knoten` (9 Schritte): (1) Rückblick Welle in der Ebene (×10, von oben), (2) auf und ab (Höhe ×300),
  (3) Knoten, drakonitischer Monat, (4) zwei Takte: Vollmond 31. Mai 2026 rund 35 100 km unter der Ebene,
  Kernschatten nur rund 9300 km breit, (5) Knotenlinie mit Mondbahnebene (×50), fest im Raum, zeigt Ende
  Februar und im August zur Sonne, (6) Finsternis-Saison am 3. März 2026, (7) ein halbes Jahr später,
  12. August, beide Saisons des Jahres, (8) die Saisons wandern (2026–2045 im Zeitraffer), (9) frei.

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
- Umgesetzt am 2026-11-05 (Zahlen aus dem Modell, 50° N, 10° O, deutsche Zeit): (2) 17. Dezember 2026, Dekl.
  +5,9° in 24 h, Aufgang 12:15 bei 87°, Untergang 18.12. 1:11 bei 278° statt 273°; (3) 30. Dezember 2026 ohne
  Aufgang (29.12. 23:44, 31.12. 1:00); (4) Vollmond 24. Dezember 2026, Dekl. 27,3°, 67°, 17 h 48 min über dem
  Horizont; (5) Vollmond 30. Juni 2026, −27,2°, 13°, 7 h 10 min; (7) 7. März 2025, 28,7°, 69°, 18 h 05 min;
  (8) 26. März 2034, 18,1°, 58°, 15 h 36 min; (9) Erntemond 26. September 2026: Aufgang 14–18 min später je
  Abend, um den Vollmond am 3. März 2026 74–85 min. Abweichung: Standard-Zeitraum der Spirale ±1 Tag um den
  Zeitpunkt (Regler 0,5–7 Tage); der Weg ist geozentrisch gezeichnet (Parallaxe knapp 1°, im Text erwähnt).

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
2. `mondbahn3d.html` mit Rundgang (erledigt), Textentwurf Teil 7 (`07-knoten.md`).
3. Texte der Rundgänge in `erdemond3d.html` (erledigt: `nodes` überarbeitet, in `apsides` und `height` Daten und Begriffe).
4. Umbau Mondaufgang in `astro.js`/`astro.cpp` (erledigt, Halbierung bis 0,1 s statt 1 s; Ergebnis in `cpp/Plan-Mondaufgang.md`).
5. `mondbogen3d.html` mit Rundgang (erledigt am 2026-11-05; Ablauf in `CLAUDE.md`), danach Textentwurf Teil 9.

## Notizen

- `erdemond` lädt 3,6 MB (mobil 1,7 MB) und zeigt erst ein Vorschaubild; pro Beitrag möglichst nur ein
  solches Modell.
