# Die Sonnenbahn im Jahreslauf – und die Bahn der Erde um die Sonne

Diese Erklärung beginnt mit dem, was man selbst beobachten kann (wann und wo geht die Sonne auf,
wie hoch steht sie mittags), erklärt dann die Ursachen (geneigte Erdachse, elliptische Erdbahn) und
endet mit dem, was sich über Jahrhunderte und Jahrtausende verändert. Zu jedem Abschnitt steht unter
**Ausprobieren**, welche Seite dieses Projekts das Thema zeigt.

Alle Zahlen sind mit `astro.js` berechnet, für einen Ort in der Mitte Deutschlands
(**50° N, 10° O**), Uhrzeiten in **MEZ** (also ohne Sommerzeit), Jahr 2026.

---

## 1. Was wir beobachten: der Tagbogen der Sonne

An jedem Tag zieht die Sonne einen Bogen über den Himmel: Sie geht irgendwo im Osten auf, steht
mittags genau im Süden am höchsten und geht irgendwo im Westen unter. Wie dieser **Tagbogen** als Teil
eines Kreises um die Himmelsachse entsteht und wie er im Lauf des Jahres wandert, erklärt das Modell
`Tagbogen3D.html` mit dem Knopf „Schritt für Schritt erklären“: Horizont, Zenit und Himmelsachse,
Auf- und Untergang, Mittagshöhe, die Kreise am 21. Juni und 21. Dezember, ihre Größe und die Ansicht
von der Seite.

Die Werte für 50° N:

| Tag (2026)             | Aufgang | Mittag | Untergang | Tageslänge | Mittagshöhe | Aufgang / Untergang (Richtung) |
|------------------------|--------:|-------:|----------:|-----------:|------------:|--------------------------------|
| 20. März (Frühlingsanfang) | 6:23 | 12:27 | 18:33 | 12 h 10 min | 40° | Osten / Westen (89° / 271°) |
| 21. Juni (Sommeranfang)    | 4:11 | 12:22 | 20:33 | 16 h 22 min | 63° | Nordosten / Nordwesten (51° / 310°) |
| 23. September (Herbstanfang) | 6:08 | 12:12 | 18:16 | 12 h 08 min | 40° | Osten / Westen (89° / 271°) |
| 21. Dezember (Winteranfang) | 8:16 | 12:18 | 16:20 | 8 h 04 min | 17° | Südosten / Südwesten (127° / 233°) |

Richtungen von Norden über Osten gezählt (90° = Osten, 180° = Süden). Mit Sommerzeit ist im Juni
eine Stunde dazuzurechnen (Mittag dann 13:22).

Im Sommer überstreicht die Sonne zwischen Auf- und Untergang rund 260° des Horizonts, im Winter nur
gut 100°. Mittag ist nicht um 12 Uhr und nicht jeden Tag zur gleichen Zeit (→ Abschnitt 3).

**Wie schnell wandert der Schatten?** Das hängt vor allem von der Sonnenhöhe ab. Mittags ändert sich
die Himmelsrichtung der Sonne bei 50° N im Juni um etwa 30° pro Stunde, im März um 20° und im Dezember
um 14°. Im Sommer wandert der Schatten mittags also doppelt so schnell herum wie im Winter – je näher
die Sonne dem Zenit kommt, desto stärker ändert schon ein kleines Stück Weg ihre Richtung.

> **Ausprobieren:** In `Sichtbarkeit.html` zeigt der **Rundumblick** (Ergebnis-Ansicht, Häkchen
> „Sonnenbahnen“) die Tagbögen am 21. jedes Monats als abgerollten Horizont – genau das Bild von
> oben. Unter „Mehr“ blenden die **Stundenlinien** ein, wo die Sonne zur selben Uhrzeit über das Jahr
> steht (Analemma, eine Acht). Die Karte zeigt die Auf- und Untergangsrichtungen am 21.6. und 21.12.

---

## 2. Die Ursache: die geneigte Erdachse

Die Erdachse ist um **23,44°** gegen die Senkrechte auf der Erdbahn geneigt und zeigt dabei
(fast) immer in dieselbe Richtung im Raum – zum Polarstern. Während die Erde einmal um die Sonne
läuft, ist daher mal die Nordhalbkugel zur Sonne hin geneigt (Juni), mal die Südhalbkugel
(Dezember).

Vom Erdboden aus gesehen bedeutet das: Die Sonne steht im Juni bis zu 23,44° nördlich des
Himmelsäquators, im Dezember bis zu 23,44° südlich. Diesen Winkel nennt man **Deklination** δ.

Daraus folgt eine einfache Formel für die **Mittagshöhe**:

```
Mittagshöhe = 90° − geografische Breite + Deklination
```

Für 50° N: im Sommer 90° − 50° + 23,44° ≈ 63°, im Winter 90° − 50° − 23,44° ≈ 17°,
an den Tagundnachtgleichen 40°. Der Unterschied zwischen Sommer und Winter ist überall auf der
Erde gleich: zweimal 23,44° ≈ 47°.

Die geografische Breite bestimmt, wie stark sich das auf die Tageslänge auswirkt – je weiter
nördlich, desto größer die Unterschiede:

| Breite (Beispiel)  | Tageslänge Juni | Tageslänge Dezember | Mittagshöhe Juni / Dezember |
|--------------------|----------------:|--------------------:|----------------------------:|
| 48° N (München)    | 16 h 03 min | 8 h 22 min | 65° / 19° |
| 50° N (Mitte)      | 16 h 22 min | 8 h 04 min | 63° / 17° |
| 54° N (Kiel)       | 17 h 09 min | 7 h 22 min | 59° / 13° |

**Wichtig:** Die Jahreszeiten entstehen durch diese Neigung, nicht durch den Abstand zur Sonne.
Im Sommer steht die Sonne höher (die Strahlung trifft steiler auf) und scheint länger. Am
sonnennächsten ist die Erde sogar Anfang Januar (→ Abschnitt 6).

> **Ausprobieren:** `Erdposition.html` zeigt die Erde von außen mit geneigter Achse und beleuchteter
> Hälfte – man sieht direkt, warum der Tagbogen eines Ortes im Juni länger ist als im Dezember.
> In `ErdeMond3D.html` macht die Ebene „Äquatorebene“ den Winkel zwischen Erdäquator und Ekliptik
> sichtbar; die Ansicht „von der Sonne“ zeigt, welche Halbkugel gerade zur Sonne geneigt ist.

---

## 3. Wann ist Mittag? Längengrad, Zeitgleichung, Sommerzeit

„Mittag“ heißt hier: Die Sonne steht genau im Süden und hat ihren höchsten Stand. Dass das bei uns
nicht um 12:00 Uhr passiert, hat drei Gründe:

1. **Der Längengrad.** Die MEZ ist für 15° O gemacht. Pro Grad weiter westlich kommt der Mittag
   4 Minuten später. Bei 10° O also im Mittel um 12:20 Uhr, in Aachen (6° O) um 12:36 Uhr,
   in Görlitz (15° O) um 12:00 Uhr.
2. **Die Zeitgleichung.** Selbst am selben Ort verschiebt sich der Mittag im Lauf des Jahres um
   bis zu eine halbe Stunde: am spätesten Mitte Februar (2026: 12:34 Uhr am 11. Februar), am
   frühesten Anfang November (12:04 Uhr am 3. November). Eine Sonnenuhr geht also mal 14 Minuten
   nach, mal 16 Minuten vor. Ursachen sind die elliptische Erdbahn (die Erde ist nicht immer gleich
   schnell, → Abschnitt 6) und die Achsneigung (die Sonne läuft schräg zum Äquator über den Himmel).
3. **Die Sommerzeit** schiebt alles um eine Stunde später.

Eine überraschende Folge der Zeitgleichung: Rund um den 21. Dezember wandert der Mittag jeden Tag
etwa eine halbe Minute später. Deshalb liegen die Extreme nicht am kürzesten Tag:

- **frühester Sonnenuntergang:** um den 12. Dezember (16:18 Uhr),
- **spätester Sonnenaufgang:** um den 31. Dezember (8:19 Uhr),
- im Sommer entsprechend: frühester Aufgang um den 17. Juni, spätester Untergang um den 25. Juni.

Die Abende werden also schon vor Weihnachten wieder länger, die Morgen erst nach Neujahr.

> **Ausprobieren:** `Tageslaenge.html` zeigt Aufgang, Mittag und Untergang über das ganze Jahr.
> An der Mittagslinie sieht man die Zeitgleichung direkt (die Schlangenlinie), dazu getrennt die
> Zunahme am Morgen und am Abend. `Erdposition.html` gibt die Zeitgleichung für den gewählten Tag an
> und erklärt sie im Abschnitt „Hintergründe und Begriffe“.

---

## 4. Wie schnell werden die Tage länger?

Die Tageslänge folgt über das Jahr ungefähr einer Sinuskurve:

- An den **Sonnenwenden** ändert sie sich kaum („Sonnenstillstand“ = Solstitium).
- Um die **Tagundnachtgleichen** ändert sie sich am schnellsten: bei 50° N um bis zu
  **3,8 Minuten pro Tag**, in Kiel um über 4 Minuten.

Kleine Feinheit: An den „Tagundnachtgleichen“ ist der Tag gar nicht genau 12 Stunden lang, sondern
etwa 12 h 10 min. Das liegt an der Definition von Auf- und Untergang (der *obere Rand* der Sonne
berührt den Horizont) und an der Lichtbrechung der Luft (→ Abschnitt 5). Wirklich 12 Stunden
Tag hat man bei uns schon um den 17. März und erst wieder um den 26. September.

> **Ausprobieren:** `Tageslaenge.html`, Diagramm „Zunahme pro Tag“. Mit der Auswahl
> „0°“ statt „−0°50′“ rechnet die Seite mit dem geometrischen Horizontdurchgang des Sonnenmittelpunkts –
> dann rücken die 12-Stunden-Tage an die Tagundnachtgleichen heran.

---

## 5. Wie steil geht die Sonne unter – und wie schnell verschwindet sie?

### Der Winkel zum Horizont

Der Tagbogen schneidet den Horizont schräg. An den **Tagundnachtgleichen** ist der Winkel am
steilsten, nämlich 90° − Breite (bei 50° N: **40°**). Zu **beiden Sonnenwenden** ist er flacher
(bei 50° N: rund **33°**), weil die Sonne dann auf einem kleineren Kreis um den Himmelspol läuft
und den Horizont seitlicher trifft.

Zum Vergleich: Am Äquator geht die Sonne fast senkrecht unter, in Skandinavien im Sommer sehr
flach – bis sie nördlich des Polarkreises gar nicht mehr untergeht, sondern nur noch am Horizont
entlangstreift.

### Wie lange dauert der Untergang?

Die Sonnenscheibe ist etwa ein halbes Grad groß. Wie lange es dauert, bis sie vom ersten Berühren
des Horizonts bis zum letzten Lichtpunkt verschwunden ist, hängt vom Winkel ab:

| Breite | Tagundnachtgleiche | Sonnenwende Juni | Sonnenwende Dezember |
|--------|-------------------:|-----------------:|---------------------:|
| 0° (Äquator) | ca. 2 min | | |
| 48° N  | 3,2 min | 4,0 min | 3,9 min |
| 50° N  | 3,3 min | 4,3 min | 4,2 min |
| 54° N  | 3,6 min | 5,0 min | 4,9 min |

Faustregel: **Die Sonne verschwindet in drei bis fünf Minuten** – im Frühling und Herbst am
schnellsten, im Sommer und Winter langsamer, im Norden langsamer als im Süden.

Zu den Sonnenwenden kommen zwei Gründe zusammen: Die Sonne läuft auf dem kleineren Tagkreis etwas
langsamer (13,8° statt 15° pro Stunde, → `Tagbogen3D.html`, Schritt 6), und ihre Bahn trifft den Horizont flacher. Bei
50° N sinkt sie dadurch etwa 7,6° statt 9,6° pro Stunde – rund 8 % davon macht die Kreisgröße aus, den
größeren Rest der flachere Winkel.

### Dämmerung

Derselbe Winkel bestimmt die Länge der Dämmerung. Die **bürgerliche Dämmerung** (bis die Sonne 6°
unter dem Horizont steht, man kann noch ohne Licht lesen) dauert bei 50° N:

- im März/September etwa 32 Minuten,
- im Dezember etwa 38 Minuten,
- im Juni etwa 44 Minuten.

Im Juni sinkt die Sonne bei 50° N nicht einmal 18° unter den Horizont – es wird die ganze Nacht
nicht richtig dunkel (keine „astronomische Nacht“). Das gilt im Hochsommer für ganz Deutschland
nördlich von etwa 48,6° N.

### Die Lichtbrechung hebt die Sonne an

Die Luft bricht das Licht nahe am Horizont so stark, dass die Sonne um etwa 34′ (gut ein halbes Grad)
höher erscheint, als sie geometrisch steht – mehr als ihr eigener Durchmesser. **Wenn die Sonne
gerade den Horizont berührt, steht sie in Wirklichkeit schon ganz darunter.** Darum rechnet man
Auf- und Untergang mit einer Höhe des Sonnenmittelpunkts von −0°50′ (34′ Brechung + 16′ Sonnenradius).
Nahe am Horizont ist die Brechung unten stärker als oben – deshalb wirkt die untergehende Sonne
abgeplattet.

> **Ausprobieren:** `Tageslaenge.html` mit der Auswahl der Untergangshöhe (−0°50′ oder 0°).
> In `Sichtbarkeit.html` zeigt der Rundumblick die Steilheit der Bögen am Horizont im Vergleich der
> Monate; die Höhenachse ist die scheinbare Höhe mit Lichtbrechung.

---

## 6. Die Bahn der Erde um die Sonne

### Eine leichte Ellipse

Die Erde läuft auf einer Ellipse um die Sonne, die Sonne steht in einem ihrer Brennpunkte. Die
Ellipse ist fast ein Kreis (Exzentrizität 0,0167), aber der Unterschied ist messbar:

| | Datum (2026) | Entfernung |
|---|---|---:|
| **Perihel** (sonnennächster Punkt) | 3. Januar | 147,1 Mio. km |
| **Aphel** (sonnenfernster Punkt)   | 6. Juli   | 152,1 Mio. km |

Im Januar erhält die Erde dadurch knapp 7 % mehr Sonnenstrahlung als im Juli. Für die
Jahreszeiten spielt das eine Nebenrolle – sonst wäre auf der ganzen Erde im Januar Sommer.

### Schneller in Sonnennähe – kürzerer Winter

Nach dem **zweiten Keplerschen Gesetz** überstreicht die Verbindungslinie Sonne–Erde in gleichen
Zeiten gleiche Flächen. In Sonnennähe muss die Erde daher schneller laufen: im Perihel etwa
30,3 km/s, im Aphel etwa 29,3 km/s.

Die vier Jahreszeitpunkte teilen die Bahn in vier gleiche Winkel (je 90°). Weil die Erde im
Nordwinter schneller läuft, sind die Jahreszeiten unterschiedlich lang:

| Astronomische Jahreszeit (Nordhalbkugel) | Beginn 2026 (MEZ) | Dauer |
|------------------------------------------|-------------------|------:|
| Frühling | 20. März, 15:45 | 92,7 Tage |
| Sommer   | 21. Juni, 9:24  | 93,7 Tage |
| Herbst   | 23. September, 1:05 | 89,9 Tage |
| Winter   | 21. Dezember, 21:50 | 89,0 Tage |

Das **Sommerhalbjahr** (Frühling + Sommer, die Sonne steht nördlich des Äquators) dauert 186,4 Tage,
das **Winterhalbjahr** nur 178,9 Tage – **7,5 Tage weniger**. Auf der Südhalbkugel ist es umgekehrt:
Dort ist der Sommer die kürzere Jahreshälfte.

Die ungleiche Geschwindigkeit ist auch einer der beiden Gründe für die Zeitgleichung (Abschnitt 3):
Im Januar läuft die Erde ein Stück weiter um die Sonne als im Durchschnitt, die Erde muss sich
etwas länger drehen, bis die Sonne wieder im Süden steht – der Mittag wandert nach hinten.

> **Ausprobieren:**
> - `Erdposition.html`: Erdbahn von oben mit Tagundnachtgleichen, Sonnenwenden, Perihel, Aphel und
>   den beiden Brennpunkten der Ellipse; Tabelle mit wahrer Anomalie und Entfernung.
> - `Mondbahn.html`: Bahn von Erde (und Mond) um die Sonne über ein Jahr, mit Diagramm der
>   Entfernung zur Sonne – Perihel und Aphel sieht man als Minimum und Maximum.
> - `Astrouhr.html`: Zifferblatt mit der Erde auf ihrer leicht exzentrischen Bahn, Perihel markiert.
> - `cpp/beispiele/sonne.cpp` und `cpp/beispiele/ereignisse.cpp` geben dieselben Werte auf der
>   Konsole aus.

---

## 7. Was sich über Jahrhunderte ändert

Die Sonnenbahn wirkt Jahr für Jahr gleich, aber fast alle Größen oben ändern sich langsam. Die
meisten Änderungen sind im Alltag nicht zu bemerken, über Jahrhunderte und Jahrtausende aber
deutlich.

### 7.1 Die Achsneigung nimmt ab

Die Neigung der Erdachse schwankt in rund 41 000 Jahren zwischen etwa 22,1° und 24,5°. Zurzeit
nimmt sie ab, um etwa 0,013° pro Jahrhundert:

| Jahr | 1000 | 1500 | 2000 | 2500 | 3000 |
|------|-----:|-----:|-----:|-----:|-----:|
| Achsneigung | 23,57° | 23,50° | 23,44° | 23,37° | 23,31° |

Folgen: Die Mittagssonne im Sommer steht in tausend Jahren gut 0,1° tiefer, im Winter 0,1° höher.
Die Polarkreise wandern dadurch jedes Jahr etwa 14 Meter Richtung Pol, die Wendekreise Richtung
Äquator.

### 7.2 Das Perihel wandert durch das Jahr

Die Ellipse der Erdbahn dreht sich langsam, und gleichzeitig verschiebt sich der Frühlingspunkt
(→ 7.4). Zusammen wandert das Perihel durch die Jahreszeiten, einmal ganz herum in rund
21 000 Jahren, im Kalender etwa **einen Tag alle 57 Jahre**:

- **um 1246** fiel das Perihel mit der Wintersonnenwende zusammen,
- **heute** liegt es am 3./4. Januar,
- **um 3000** liegt es um den 19. Januar,
- **um 6400** fällt es mit dem Frühlingsanfang zusammen.

Damit ändern sich die Längen der Jahreszeiten:

| Jahr | Frühling | Sommer | Herbst | Winter | Sommer- minus Winterhalbjahr |
|------|---------:|-------:|-------:|-------:|-----------------------------:|
| 1246 | 93,3 | 93,3 | 89,3 | 89,3 | 7,9 Tage |
| 1500 | 93,1 | 93,4 | 89,5 | 89,2 | 7,8 Tage |
| 2000 | 92,8 | 93,7 | 89,8 | 89,0 | 7,6 Tage |
| 2500 | 92,4 | 93,8 | 90,2 | 88,8 | 7,1 Tage |
| 3000 | 92,0 | 93,9 | 90,6 | 88,8 | 6,5 Tage |

1246 waren Frühling und Sommer gleich lang, ebenso Herbst und Winter, weil das Perihel genau
in der Mitte des Winters lag. Heute ist der Winter die kürzeste Jahreszeit. Um 6400 wird der
Frühling die kürzeste sein; in rund 10 000 Jahren liegt das Perihel im Juli, dann ist auf der
Nordhalbkugel das Winterhalbjahr das längere.

(Die Daten vor 1582 sind im rückwärts verlängerten gregorianischen Kalender angegeben, so wie
`astro.js` rechnet; im damals gültigen julianischen Kalender lag die Wintersonnenwende 1246 um den 14. Dezember.)

### 7.3 Die Ellipse wird runder

Die Exzentrizität der Erdbahn nimmt derzeit ab: 0,0171 im Jahr 1000, 0,0167 heute, 0,0163 im
Jahr 3000. Über 100 000 Jahre schwankt sie zwischen fast 0 (Kreis) und knapp 0,06. Je runder die
Bahn, desto kleiner der Unterschied zwischen Sommer- und Winterhalbjahr und desto kleiner der
Anteil der Ellipse an der Zeitgleichung.

Achsneigung, Perihel-Wanderung und Exzentrizität zusammen verändern über Zehntausende Jahre
die Verteilung der Sonnenstrahlung auf der Erde. Diese **Milanković-Zyklen** gelten als Taktgeber
der Eiszeiten.

### 7.4 Präzession: der Frühlingspunkt wandert

Die Erdachse kreiselt wie ein schief stehender Kreisel einmal in rund **25 800 Jahren** um die
Senkrechte zur Erdbahn. Die Neigung bleibt dabei (fast) gleich, aber die Richtung ändert sich:

- Der **Frühlingspunkt** – die Richtung zur Sonne beim Frühlingsanfang – wandert etwa 1,4° pro
  Jahrhundert rückwärts durch die Sternbilder. Vor gut 2000 Jahren lag er im Widder, heute in
  den Fischen, in einigen Jahrhunderten im Wassermann. Darum stimmen die Sternzeichen der
  Astrologie nicht mehr mit den Sternbildern überein, in denen die Sonne tatsächlich steht.
- Der **Polarstern** kommt dem Himmelspol um das Jahr 2100 am nächsten und entfernt sich danach
  wieder. In etwa 12 000 Jahren ist die Wega „Polarstern“.

Für die Sonnenbahn selbst ändert die Präzession wenig, weil unser Kalender an den Jahreszeiten
hängt (tropisches Jahr) und nicht an den Sternen. Am Nachthimmel derselben Jahreszeit stehen aber
langsam andere Sterne.

### 7.5 Der Kalender: Frühlingsanfang auf Wanderschaft

Ein Jahr von Frühlingsanfang zu Frühlingsanfang dauert im Mittel 365,2422 Tage.

- Der **julianische Kalender** (ab 46 v. Chr.) rechnete mit 365,25 Tagen – 11 Minuten zu viel. Bis
  1582 war der Frühlingsanfang so auf den 11. März gerutscht. Mit der **gregorianischen Reform**
  folgte auf Donnerstag, den 4. Oktober 1582, direkt Freitag, der 15. Oktober.
- Der **gregorianische Kalender** (365,2425 Tage) lässt in 400 Jahren drei Schalttage aus. Er weicht
  nur noch um einen Tag in gut 3000 Jahren ab.
- Innerhalb des 400-Jahre-Zyklus pendelt der Frühlingsanfang trotzdem: Weil 2000 ein Schaltjahr war (zwischen 1900 und 2100 fällt kein Schalttag aus),
  rutscht er seit 1900 langsam früher. 2011 fiel er (MEZ) noch auf den 21. März, ab **2048** fällt er
  manchmal auf den **19. März** (2096 um 15 Uhr). Erst das ausgelassene Schaltjahr 2100
  schiebt ihn wieder auf den 20./21. März.

### 7.6 Die Erde dreht sich langsamer

Die Gezeitenreibung des Mondes bremst die Erdrotation. Ein Tag wird dadurch im Mittel um etwa
**1,8 Millisekunden pro Jahrhundert** länger. Das klingt nach wenig, summiert sich aber: Eine Uhr
mit konstantem Gang (die „Dynamische Zeit“ der Astronomen) ist der Erde heute um rund 69 Sekunden
voraus, gegenüber dem Jahr 1500 um gut 3 Minuten, gegenüber dem Jahr 1000 um rund 26 Minuten
(**ΔT**, berechnet mit `deltaT()` in `astro.js`).

Ohne diese Korrektur lägen berechnete Sonnenaufgänge oder Finsternisse im Mittelalter um viele
Minuten daneben. Für die Gegenwart wird die Differenz mit **Schaltsekunden** ausgeglichen: 27
seit 1972, die letzte am 31. Dezember 2016. Bis 2035 sollen Schaltsekunden abgeschafft werden.

### 7.7 Die Uhrzeit selbst hat sich geändert

Nicht astronomisch, aber für „Wann geht die Sonne auf?“ entscheidend: Bis 1893 hatte fast jede Stadt in
Deutschland ihre eigene **Ortszeit** – der Sonnenmittag war überall ungefähr 12 Uhr. Seit dem
1. April 1893 gilt die einheitliche **MEZ**; seitdem ist Mittag in Aachen eine gute halbe Stunde
später als in Görlitz (Abschnitt 3). Die **Sommerzeit** gab es in Deutschland zeitweise ab 1916 und
dauerhaft seit 1980.

### 7.8 Überblick

| Was ändert sich? | Wie schnell? | Spürbar? |
|------------------|--------------|----------|
| Achsneigung | −0,013° pro Jahrhundert, Zyklus 41 000 Jahre | Mittagshöhe: kaum (0,1° in 1000 Jahren) |
| Lage des Perihels | 1 Tag in 57 Jahren, Zyklus 21 000 Jahre | Jahreszeitenlängen: Stunden pro Jahrhundert |
| Exzentrizität | Zyklen von 100 000 und 400 000 Jahren | nein, langfristig Eiszeiten |
| Präzession der Erdachse | 1,4° pro Jahrhundert, Zyklus 25 800 Jahre | Sternbilder, Polarstern |
| Kalender (gregorianisch) | 1 Tag in gut 3000 Jahren; Pendeln ±1 Tag im 400-Jahre-Zyklus | Datum des Frühlingsanfangs |
| Erdrotation | Tag +1,8 ms pro Jahrhundert | Schaltsekunden, Zeitangaben in alten Quellen |

> **Ausprobieren:** In `Erdposition.html` ein Datum in einem anderen Jahrhundert eingeben und Perihel,
> Tagundnachtgleichen und Sonnenwenden vergleichen (die Formeln für die Jahreszeitpunkte gelten für
> die Jahre 1000 bis 3000). `Tageslaenge.html` mit einem fernen Jahr zeigt, dass sich Auf- und
> Untergangszeiten dabei kaum verändern. In `ErdeMond3D.html` lässt sich die Lage von Ekliptik und
> Äquatorebene (und damit die Achsneigung) von außen betrachten.

---

## 8. Übersicht: welche Seite zeigt was?

| Thema | Seite | Was man dort sieht |
|-------|-------|--------------------|
| Tagkreis im Jahreslauf, 3D | `Tagbogen3D.html` | Horizontscheibe mit Kompassrose, Tagkreis mit Stunden, Auf- und Untergang, Mittagshöhe; Regler für Tag und Uhrzeit, Vergleichskreise, Ansichten von schräg, Süden, Osten, oben |
| Tagbögen am Himmel, Analemma | `Sichtbarkeit.html` | Rundumblick mit Sonnenbahnen am 21. jedes Monats und Stundenlinien; Karte mit Auf- und Untergangsrichtungen am 21.6. und 21.12. (benötigt `python3 -m http.server 8000`) |
| Auf-, Untergang, Mittag, Tageslänge | `Tageslaenge.html` | Jahresdiagramme der Zeiten, Zunahme pro Tag am Morgen und Abend, Kennzahlen; Untergangshöhe −0°50′ oder 0° |
| Achsneigung, Erdbahn, Zeitgleichung | `Erdposition.html` | Erdbahn mit Jahrespunkten, Perihel und Aphel; Erde mit geneigter Achse und Tag-/Nachtseite; Tabelle mit Zeitgleichung, Sonnenstand, Auf- und Untergang; Begriffserklärungen |
| Entfernung zur Sonne im Jahr | `Mondbahn.html` | Bahn von Erde und Mond um die Sonne, Diagramm der Entfernung zur Sonne |
| Ekliptik und Äquator räumlich | `ErdeMond3D.html` | 3D-Modell mit Ekliptik- und Äquatorebene, Sonnenrichtung, Ansicht „von der Sonne“ (benötigt lokalen Webserver) |
| Erde auf der Bahn als Uhr | `Astrouhr.html` | Zifferblatt mit Erdbahn und Perihel, Astrolabium mit Horizont und Dämmerungsgrenzen |
| Werte auf der Konsole | `cpp/beispiele/sonne.cpp`, `ereignisse.cpp` | Sonnenstand, Zeitgleichung, Auf- und Untergang; Jahreszeitpunkte, Perihel, ΔT |

---

## Quelle

Die Berechnungen folgen Jean Meeus, *Astronomische Algorithmen* (Kapitel 15 Auf- und Untergang,
21 Präzession und Schiefe der Ekliptik, 24 Sonnenposition, 26 Äquinoktien und Solstitien,
27 Zeitgleichung, 37 Perihel und Aphel), umgesetzt in `astro.js` und `cpp/astro.cpp`.
