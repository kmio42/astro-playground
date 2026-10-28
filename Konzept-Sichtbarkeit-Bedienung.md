# Konzept: Bedienung von `Sichtbarkeit.html` neu ordnen

Ergänzt [Konzept-Sichtbarkeit.md](Konzept-Sichtbarkeit.md). Rechnung und Datenmodell bleiben gleich, es geht
nur um Reihenfolge, Führung und Ausblenden. Alle Funktionen bleiben erhalten (Inventar am Ende).

**Stand 28.10.2026:** umgesetzt, Stufen 1–4. Entscheidungen zu den offenen Fragen: zwei Ansichten, Umgebung vom
Auge aus, Laden weiter per Knopf. Abweichungen vom ersten Entwurf sind unten vermerkt.

## Was heute stört

Die Seite ist in der Reihenfolge entstanden, in der die Stufen gebaut wurden (Maske → Karte → Wohnung →
Ergebnisse), nicht in der Reihenfolge, in der man arbeitet. Wer die Ergebnisse für ein Zimmer haben will, muss so
oft hin und her:

| Schritt | Wo heute | Richtung |
|---|---|---|
| 1. Ort eintippen oder Marker ziehen | ganz oben bzw. Karte (Mitte) | ↓ |
| 2. Standpunkt anlegen, Stockwerk, Augenhöhe | oben | ↑ |
| 3. Umgebung laden, eigenes Haus anklicken | Karte (Mitte) | ↓ |
| 4. „Raum anlegen“ | Wohnung (unten) | ↓ |
| 5. Fassade anklicken → „Wohnung hier“ | Karte (Mitte) | ↑ |
| 6. Maße und Fenster eintragen | Wohnung (unten) | ↓ |
| 7. „Standort aufs Auge setzen“ | Wohnung (unten) | – |
| 8. Prüfen im Horizontdiagramm, Beobachtungen | ganz oben | ↑ |
| 9. Ergebnisse ablesen | ganz unten | ↓ |

Dazu kommen:

- **Einrichten und Ablesen sind gemischt.** Hat man einmal alles eingerichtet, braucht man fast nur noch Datum,
  Jahresübersicht, Tag und Mond. Trotzdem scrollt man jedes Mal an Bearbeitungstabellen, Karteneinstellungen und
  dem Raumformular vorbei.
- **Alles ist gleich laut.** Mit angelegtem Raum sind ungefähr 60 Bedienelemente gleichzeitig sichtbar. Viele davon braucht man nur
  in Spezialfällen (Wandstärke, Trennwände, Glasbrüstung, Radien, Gebäudehöhe korrigieren, Stundenlinien,
  Mondfilter, Import). Lange Hinweistexte und mehrere Legenden kommen noch dazu.
- **Die Hilfe ersetzt die Führung.** „So geht's“ und „Bedienung“ erklären einen Ablauf, den die Seite selbst nicht
  abbildet.
- **„Raum anlegen“ ist überflüssig.** „Wohnung hier“ legt den Raum schon selbst an (`snapScene`). Trotzdem
  verlangt die Hilfe ihn als ersten Schritt.
- **Standort und Auge.** Gebäude und Gelände werden für *alle* Standpunkte vom einen Kartenmarker aus gerechnet.
  „Standort aufs Auge setzen“ verschiebt diesen Marker. Bei zwei Standpunkten an verschiedenen Fassaden stimmt dann
  immer nur einer.

## Leitideen

1. **Zwei Ansichten: „Einrichten“ und „Ergebnis“.** Die Ergebnisse sind das, wofür man kommt. Das Einrichten
   macht man einmal pro Standpunkt.
2. **Einrichten als Schritte in Arbeitsreihenfolge.** Jeder Schritt ist ein Kasten mit „Weiter“. Ein erledigter
   Schritt klappt zu einer Zeile mit dem Ergebnis zusammen („✓ Haus: Musterstraße 3, 18 m“). Man muss die Schritte
   nicht der Reihe nach machen, alle bleiben anklickbar.
3. **Erst das Übliche, Spezialfälle unter „Mehr“.** Jeder Kasten zeigt nur, was fast jeder braucht. Der Rest liegt
   in einem eingeklappten „Mehr …“. Ein Schalter „Alle Optionen zeigen“ klappt alles auf einmal auf, für Kenner.
4. **Die Seite zeigt den Stand, statt ihn zu erklären.** Statt einer langen Anleitung sagt jeder Schritt, was
   fehlt („Noch kein eigenes Haus gewählt“). Die Begriffserklärungen kommen in einen eigenen Kasten „Begriffe“ am
   Seitenende.
5. **Die Karte erscheint dort, wo man sie gerade braucht.** Es gibt nur eine Leaflet-Karte. Sie wird in den Schritt
   gehängt, der gerade offen ist (`appendChild` + `invalidateSize()`), und das Gebäude-Popup bietet nur die
   Aktionen an, die zu diesem Schritt passen.

## Aufbau der Seite

```
┌──────────────────────────────────────────────────────────────────────┐
│ Sonne und Mond vom Balkon                                            │
│ Standpunkt [Wohnzimmer ▾]   28.10.2026 [14:30]  ◀ 1 Tag ▶  ☑ Lokalzeit│  ← Kopfleiste, bleibt oben stehen
│ ( Einrichten )  ( Ergebnis )                              ⋯ Menü      │
└──────────────────────────────────────────────────────────────────────┘
```

**Kopfleiste** (`position: sticky`; unter 700 px Breite scrollt sie mit, weil sie dort umbricht und sonst ein Fünftel des Bildschirms belegt):

- Standpunkt-Auswahl. „Alle Standpunkte“ gibt es nur in der Ansicht „Ergebnis“. Unter „Einrichten“ wird
  automatisch ein einzelner Standpunkt bearbeitet, die Meldung „Zum Bearbeiten einen einzelnen Standpunkt wählen“
  fällt weg.
- Datum und Uhrzeit kompakt in einer Zeile, Zeitknöpfe als ◀/▶ mit Schrittweite (10 min, 1 Std, 1 Tag,
  7 Tage), „Jetzt“, Lokalzeit – nur unter „Ergebnis“. Zum Einrichten ist der Zeitpunkt nicht nötig; dort zeigen
  Karte (Schritte 1–3), Draufsicht und Horizontdiagramm auch keine Sonne und keinen Mond zu einem Zeitpunkt (die
  Sonnenbahnen am 21. jedes Monats bleiben).
- Umschalter zwischen den Ansichten. Die gewählte Ansicht steht in der Adresse (`#ergebnis`, `#einrichten`),
  damit Zurück im Browser funktioniert und man Lesezeichen setzen kann.
- Menü ⋯: Neuer Standpunkt, Umbenennen, Löschen, Exportieren, Importieren, Alle Eingaben löschen (mit Rückfrage; der Ort
  bleibt, weil `ui.js` ihn für alle Seiten speichert), Alle Optionen zeigen, Hilfe.

**Beim Öffnen:** Gibt es noch keinen eingerichteten Standpunkt, öffnet sich „Einrichten“ bei Schritt 1, mit einem
Satz Einführung. Sonst öffnet sich „Ergebnis“.

## Ansicht „Einrichten“

```
① Haus                ✓ Musterstraße 3, Umgebung geladen (412 Gebäude, Gelände 50 km)      [ändern]
② Standpunkt          ✓ Wohnzimmer · 3. OG · Fenster hinter Balkon · Fassade 205° SSW      [ändern]
③ Maße                ┌──────────────────────────────────────────────────────────────────┐
                      │ Raum  Breite [4,2] Tiefe [5,0] Höhe [2,6]                        │
                      │ Fenster  [Fensterwand ▾] von [1,0] bis [2,4]  Brüstung … Sturz … │
                      │ Balkon …                                     [Draufsicht][Wand]  │
                      │ ▸ Mehr: Wandstärke, weitere Fenster, Trennwände, Glas, …         │
                      │                                                     [Weiter]     │
                      └──────────────────────────────────────────────────────────────────┘
④ Prüfen              offen
```

### ① Haus

Wo steht das Haus, und was ist ringsum?

- **Sichtbar:** Karte mit Standortmarker („Marker auf das eigene Haus ziehen“), Knopf „Umgebung laden“ mit den
  Standardradien, beim Laden Ladebalken mit Sekundenzähler (Overpass meldet keinen Fortschritt, dort wächst der Balken
  mit der Wartezeit), Hinweis, dass es bis zu ein paar Minuten dauern kann, Status der Umgebung. Klick auf ein Gebäude → Popup mit **„Das ist mein Haus“**.
- **Unter „Mehr“:** Breite und Länge eintippen, GPS-Position, Gebäuderadius, Geländeradius, Gebäude und Gelände
  ein/aus, Schatten, Gebäudehöhe im Popup korrigieren bzw. auf den OSM-Wert zurücksetzen, Höhenlegende,
  Datenquellen.
- **Fertig, wenn** ein Ort gesetzt ist. Die Umgebung ist freiwillig, der Status sagt aber, wenn sie fehlt oder
  nach dem Verschieben des Markers veraltet ist („Umgebung neu laden“).

Der graue Ortsblock aus `ui.js` (`createLocationControls`) wird hier nicht direkt eingebunden. Die Eingabefelder
kommen eingeklappt unter „Mehr“. „Ort für nächsten Seitenaufruf merken“ entfällt, die Seite speichert ohnehin alles.

### ② Standpunkt

Von wo aus schaut man?

- **Sichtbar:** Name, Stockwerk, Augenhöhe (sitzend/stehend als Schnellwahl), und die Frage **„Wie beschreibst du
  die Sicht?“** mit vier Karten:

  | Wahl | Folge |
  |---|---|
  | **Fenster** (Zimmer) | Raum mit einem Fenster in der Fensterwand |
  | **Balkon** | Balkon ohne Raum, Auge auf dem Balkon |
  | **Zimmer hinter dem Balkon** | Raum und Balkon, Auge im Raum |
  | **Nur Himmelsrichtung / von Hand** | keine Szene, weiter mit Sichtbereich und Horizontlinie in ④ |

  Bei den ersten drei folgt sofort: **„Klicke in der Karte auf die Seite deines Hauses, an der das Fenster liegt.“**
  Die Karte steht dann hier, das eigene Haus ist hervorgehoben, und das Popup bietet nur **„Hier ist das
  Fenster“** an (= „Wohnung hier“). Für „von Hand“ bietet es **„Halbraum vor dieser Wand als Sichtbereich“** an
  (= „Als Sichtbereich“).
- **Unter „Mehr“:** Geschosshöhe.
- **Fertig, wenn** die Wahl getroffen ist und, bei einer Szene, die Fassade gewählt ist.

Die Wahl wird nicht gespeichert, sondern aus den Daten abgelesen (`scene.room`, `scene.balcony`, `eye.place`).
Wer später umschaltet, ändert die Szene über dieselben Funktionen wie heute die Häkchen „Raum“ und „Balkon“.

### ③ Maße

Nur bei Fenster/Balkon. Formular und Zeichnungen stehen nebeneinander (schmal: untereinander).

- **Sichtbar:** Raum Breite/Tiefe/Höhe; die Fenstertabelle (Wand, von, bis, Brüstung, Sturz) mit „+ Fenster“ –
  anders als im Entwurf ganz, weil versteckte Fenster mehr verwirren als eine zweite Zeile; Balkon von/bis/Tiefe/
  Brüstung; bei „Zimmer hinter dem Balkon“ die Wahl, ob das Auge im Raum oder auf dem Balkon ist; Draufsicht mit Sonnenfleck und Wandansicht; der kurze Text zu „links/rechts mit Blick nach draußen“
  direkt am Formular.
- **Unter „Mehr“:** Wandstärke, Fassadenrichtung als Zahl (kommt sonst aus der Karte), Glasbrüstung, Balkonplatte und ihre Höhe, Trennwände, Auge als Zahlen (x/y),
  „Raum und Balkon entfernen“, Legende der Zeichnungen.
- **Fertig, wenn** mindestens ein Fenster existiert bzw. ein Balkon da ist.

Das Auge lässt sich in der Draufsicht mit der Maus verschieben; x/y als Zahlen stehen unter „Mehr“.

### ④ Prüfen und ergänzen

Stimmt die Sichtmaske? Hier steht das Horizontdiagramm mit allen Bearbeitungswerkzeugen.

- **Sichtbar:** Horizontdiagramm mit Sonnenbahnen; Werkzeuge Ansehen / Sichtbereich aufziehen / Horizontpunkte
  setzen; Beobachtungen (der wichtigste Abgleich mit der Wirklichkeit); Hinweis „Bäume oder Dachformen fehlen?
  Horizontpunkte setzen“.
- **Karte „Blickwinkel in der Karte“:** vom Auge aus der Winkel, in den man hinaussieht (Sichtbereiche, Fenster
  und Balkon, in irgendeiner Höhe, ohne Umgebung), mit den Gradzahlen der Ränder; in der Mitte, was ihn begrenzt
  („Fenster 56°“, „Balkon …“, „Sichtbereich …“). Bewusst nicht „Sichtbereich“ genannt: Das Wort steht für die selbst
  gezogenen Rechtecke, ein Fenster begrenzt den Blick auch ohne sie. Ohne Raum, Balkon und Sichtbereich ein Kreis
  „Rundumblick“. Beim Öffnen des Schritts steht die Karte auf dem Auge.
- **Unter „Mehr“:** Tabellen Sichtbereiche und Horizontlinie zum Eintippen, Stundenlinien, Mond im Diagramm,
  „Auf Sichtbereich“ zoomen, ausführliche Legende und Bedienhinweise (Mausrad, Doppelklick, Rechtsklick).
- **Ende:** Knopf „Fertig – zum Ergebnis“.

Bei „von Hand“ (ohne Szene) sind die Tabellen Sichtbereiche/Horizontlinie sofort sichtbar, weil sie dann der
eigentliche Weg sind.

## Ansicht „Ergebnis“

Reihenfolge nach der Frage, die man hat:

1. **Auf einen Blick** (neu, zwei, drei Zeilen): „Heute scheint die Sonne von 14:20 bis 16:05 herein (1 h 45 min).
   Nächster Mond: Do 30.10., 21:10–22:40, 68 % beleuchtet.“ Die Zahlen gibt es schon (`findVisibilityIntervals`,
   Mondliste), sie werden nur zusammengefasst.
2. **Jahresübersicht Sonne** mit Sonnenstunden. Klick wählt Tag und Uhrzeit wie heute.
3. **Tag** mit Zeitleiste und Tabelle.
4. **Sonne im Raum** (bzw. „auf dem Balkon“), nur bei einem Standpunkt mit Raum oder Balkon. Wann Sonne auf den
   Boden fällt, ist etwas anderes als die Jahresübersicht (Sonne vom Auge aus): Der Sturz kann die Sonne fürs Auge
   verdecken, während auf dem Boden ein Fleck liegt.
   - Grobe Orientierung: ein Satz („Sonne fällt auf den Boden etwa vom 12.10. bis 28.2., je nach Tag zwischen 9:40
     und 14:10 Uhr, bis 7,4 m². Vom 1.3. bis 11.10. fällt keine Sonne herein.“) und eine kleine Jahres-Heatmap
     (Tag × Uhrzeit in 10-min-Schritten, Farbe = Fleckgröße). Klick wählt Tag und Uhrzeit.
   - Genauer Zeitpunkt: Tagesstreifen mit der Fleckgröße über den Tag und darunter ein Uhrzeit-Regler (5 min,
     Sonnenaufgang − 30 min bis Sonnenuntergang + 30 min), „Zum größten Fleck“. Beim Ziehen wandern Fleck und
     Markierung nur als Vorschau; beim Loslassen übernimmt die Kopfleiste die Zeit.
   - Darunter Draufsicht mit Sonnenfleck und Fensterwand, dieselben Zeichnungen wie in ③ (dort umgehängt), hier ohne
     Verschieben des Auges.
   - Die Fleckgröße hängt nur von der Richtung zur Sonne ab. Sie wird je Szene einmal im 2°-Raster vorgerechnet
     (`sunPatchTable`, ≈ 0,25 s), Jahr und Tag lesen nur noch aus der Tabelle.
   - Bei „Alle Standpunkte“ ein Hinweis, einen einzelnen zu wählen.
5. **Mond-Termine.** Die Filter (Zeitraum, Mindestdauer, Beleuchtung, nur bei Dunkelheit) liegen eingeklappt
   hinter „Filter“. Die Kopfzeile nennt die aktiven Filter („3 Monate · ab 10 min“).
6. **Rundumblick**: das Horizontdiagramm, nur zum Ansehen (Zoom, Tooltip mit Hindernis, Sonnenbahnen), ohne
   Bearbeitungswerkzeuge. Daneben ein Link „bearbeiten“, der zu ④ springt.

Am Ende steht ein eingeklappter Kasten „Karte mit der Richtung zu Sonne und Mond“; erst beim Aufklappen wird die
Karte dorthin gehängt.

## Ausblenden: einheitliche Regeln

- **„Mehr …“** ist immer ein `<details>` am Ende eines Kastens. Ob es offen ist, merkt sich die Seite pro Kasten
  in `state.settings.open`.
- **„Alle Optionen zeigen“** (`state.settings.expert`) öffnet alle „Mehr“-Bereiche und zeigt die Tabellen in ④.
  Damit kommt man in einem Klick an alles, was es heute gibt.
- **Hinweistexte:** höchstens ein Satz sichtbar. Längere Erklärungen liegen hinter einem ⓘ an der Überschrift.
  Datenquellen und Lizenzen stehen gesammelt am Seitenende. Leaflet zeigt außerdem die kurze Namensnennung in der
  Karte.
- **Legenden:** nur die Einträge, die gerade zu sehen sind (z. B. „Mond“ nur, wenn der Mond eingeblendet ist;
  Höhenfarben nur, wenn Gebäude geladen sind).
- **Gesperrte Knöpfe:** gibt es nicht mehr. Statt „Wohnung hier“ grau mit Tooltip „Erst einen einzelnen Standpunkt
  wählen“ sorgt der Schritt selbst dafür, dass ein Standpunkt gewählt ist.

### Gebäude-Popup je nach Schritt

| offener Schritt | Popup bietet an |
|---|---|
| ① Haus | „Das ist mein Haus“ / „Doch nicht mein Haus“; unter „Mehr“: Höhe ändern, OSM-Wert |
| ② Standpunkt, Szene | „Hier ist das Fenster“ bzw. „Hier ist der Balkon“ (Fassade markiert) |
| ② Standpunkt, von Hand | „Halbraum vor dieser Wand als Sichtbereich“ |
| sonst / Alle Optionen | alles wie heute |

## Zwei kleine Änderungen an der Logik

Beide sind nicht nötig für die neue Ordnung, machen sie aber einfacher. Sie lassen sich einzeln entscheiden.

1. **Umgebung je Standpunkt vom Auge aus rechnen.** `environmentProfile(vp)` nimmt heute immer den Kartenmarker.
   Neu: Ist die Szene an einer Fassade eingerastet (`scene.anchor`), rechnet die Seite Gebäude und Gelände von der
   Augenposition aus (`sceneLatLng(cs, eye)`), sonst vom Marker. Damit entfällt „Standort aufs Auge setzen“, und
   mehrere Standpunkte an verschiedenen Fassaden stimmen gleichzeitig. Die Gebäude werden weiter um den Marker
   geladen. Ein Auge wenige Meter daneben liegt weit innerhalb des Radius. Gespeicherte Daten bleiben gültig, die
   Ergebnisse verschieben sich nur um die paar Meter zwischen Marker und Auge.
2. **„Raum anlegen“ / „Balkon anlegen“ entfallen.** Die Wahl in ② legt die Szene an, die Fassade setzt sie fest.
   `createScene()` bleibt intern für die Wahl erhalten.

## Datenmodell

Nur Oberflächenzustand kommt dazu, die Standpunkte bleiben gleich (Export/Import kompatibel):

```js
state.ui = {
    view: 'result' | 'setup',   // zusätzlich in location.hash
    step: 1..4,                 // offener Schritt unter „Einrichten“
};
state.settings.expert = false;  // Alle Optionen zeigen
state.settings.open = {};       // { 'haus-mehr': true, … } offene „Mehr“-Bereiche
```

Ob ein Schritt erledigt ist, wird jedes Mal aus den Daten berechnet, nicht gespeichert:

| Schritt | erledigt, wenn |
|---|---|
| ① | Ort gesetzt (nicht 0/0); Zusatzzeile, ob die Umgebung geladen und aktuell ist und ob ein eigenes Haus gewählt ist |
| ② | Standpunkt hat eine Szene mit `anchor` oder mindestens einen Sichtbereich bzw. Horizontpunkt |
| ③ | Szene hat ein Fenster bzw. einen Balkon (bei „von Hand“ übersprungen) |
| ④ | nie Pflicht; Zusatzzeile mit Anzahl der Beobachtungen und wie gut sie passen |

## Inventar: wo jede Funktion hinkommt

S = sichtbar, M = unter „Mehr“, K = nur im passenden Kontext.

| Funktion heute | neu | |
|---|---|---|
| Breite/Länge eintippen, GPS, „Ort merken“ | ① | M („merken“ entfällt, wird automatisch gespeichert) |
| Datum, Uhrzeit, Lokalzeit, Zeitknöpfe | Kopfleiste | S |
| Standpunkt wählen, „Alle Standpunkte“ | Kopfleiste („Alle“ nur bei Ergebnis) | S |
| Neu, Umbenennen, Löschen, Export, Import | Menü ⋯ | S |
| Stockwerk, Augenhöhe | ② | S |
| Geschosshöhe | ② | M |
| Hilfe „So geht's“, Begriffe | Einführungssatz in ①, „Begriffe“ am Ende, Menü ⋯ → Hilfe | S/M |
| Horizontdiagramm ansehen, Zoom, Tooltip | ④ und Ergebnis „Rundumblick“ | S |
| Modi Sichtbereich aufziehen / Horizontpunkte setzen | ④ | S |
| Sonnenbahnen | ④, Ergebnis | S |
| Stundenlinien, Mond im Diagramm, „Auf Sichtbereich“ | ④, Ergebnis | M |
| Tabellen Sichtbereiche, Horizontlinie | ④ | M (bei „von Hand“ S) |
| Beobachtungen, als Horizontpunkt übernehmen | ④ | S |
| Kartenmarker ziehen | ① | S |
| Umgebung laden, Status | ① | S |
| Gebäude-/Geländeradius, Gebäude/Gelände ein/aus | ① | M |
| Schatten | ① | M |
| Popup: eigenes Gebäude | ① | K |
| Popup: Höhe ändern, OSM-Wert | ① | K + M |
| Popup: „Als Sichtbereich“ | ② bei „von Hand“ | K |
| Popup: „Wohnung hier“ | ② bei Szene | K |
| Höhenlegende, Kartenlegende, Datenquellen | ① bzw. Seitenende | M |
| „Raum anlegen“, „Balkon anlegen“ | Wahl in ② | S (ersetzt) |
| Häkchen Raum / Balkon, Auge im Raum/auf dem Balkon | Wahl in ② | S (ersetzt) |
| Raum Breite/Tiefe/Höhe, erstes Fenster | ③ | S |
| weitere Fenster, Seiten-/Rückwand | ③ | S |
| Balkon von/bis/Tiefe/Brüstung | ③ | S |
| Glas, Balkonplatte und Höhe, Trennwände | ③ | M |
| Fassadenrichtung als Zahl, Wandstärke | ③ | M |
| Auge x/y | ③ | M (sichtbar: in der Draufsicht ziehen) |
| „Standort aufs Auge setzen“ | entfällt (Logikänderung 1) | – |
| „Raum und Balkon entfernen“ | ③ | M |
| Draufsicht mit Sonnenfleck, Wandansicht | ③ und Ergebnis „Sonne im Raum“ | S |
| Jahresübersicht, Sonnenstunden, Klick wählt Tag | Ergebnis | S |
| Tag: Zeitleiste, Tabelle | Ergebnis | S |
| Mond-Termine, Klick öffnet Tag | Ergebnis | S |
| Mondfilter (Zeitraum, Dauer, Beleuchtung, dunkel) | Ergebnis | M (Zusammenfassung S) |
| Hell/Dunkel, Größenanpassung | unverändert | – |

## Umsetzung in Stufen

Jede Stufe ist für sich benutzbar.

1. **Umordnen.** Kopfleiste, zwei Ansichten, vier Schritt-Kästen, die Karte wird zwischen ① und ② umgehängt. Inhalt
   der Kästen zunächst wie heute, nur an der neuen Stelle. Reine Arbeit an HTML, CSS und Umschaltung.
   `visibility.js` bleibt unberührt.
2. **Ausblenden.** „Mehr“-Bereiche, „Alle Optionen zeigen“, kürzere Hinweise mit ⓘ, Legenden nach Inhalt,
   Gebäude-Popup je nach Schritt, die Wahl in ② ersetzt „Raum/Balkon anlegen“.
3. **Führung.** Schrittstatus und zugeklappte Zusammenfassungen, „Weiter“, Startansicht je nach Stand,
   „Auf einen Blick“.
4. **Logik (optional).** Umgebung vom Auge aus, Auge in der Draufsicht ziehen.

Prüfen: `node testVisibility.js` (unverändert grün) und ein Durchlauf im Headless-Browser, einmal mit leerem
Speicher (Ablauf ①–④ für ein Zimmer) und einmal mit einem exportierten Stand (öffnet „Ergebnis“, alle Werte wie
vorher).

## Offene Fragen

1. **Zwei Ansichten oder eine lange Seite?** Vorschlag: zwei Ansichten. Die Alternative wäre eine Seite, auf der
   oben die Schritte stehen und nach dem Einrichten zuklappen, darunter die Ergebnisse. Das ist einfacher zu
   bauen, aber die Ergebnisse rutschen wieder nach unten, sobald man einen Schritt aufklappt.
2. **Logikänderung 1 (Umgebung vom Auge aus)?** Vorschlag: ja. Sie löst das Problem mit mehreren Standpunkten und
   spart einen Knopf, den man leicht vergisst.
3. **Umgebung automatisch laden,** sobald der Marker steht? Vorschlag: nein, weiter per Knopf, weil Overpass
   langsam ist und manchmal ausfällt. Der Knopf wird aber hervorgehoben, solange keine Umgebung geladen ist.
