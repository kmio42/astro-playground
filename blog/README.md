# Beitragsreihe: Sonne, Erde, Mond

Entwürfe für die WordPress-Beiträge. Erst wenn ein Entwurf hier fertig ist, kommt er in den Blog.

## Ziel

Neben der Spielwiese (die HTML-Seiten zum Ausprobieren) entsteht ein didaktisch sinnvoller Weg in
mehreren Beiträgen: vom Beobachten zum Erklären, vom Horizont über den Himmelsäquator zur Erdbahn,
danach der Mond.

- **Leser:** Laien, auch mit Schulwissen soll es sich lohnen. Formeln stehen nur in Kästen, die man
  überspringen kann.
- **Lernziel:** verstehen und ungefähr vorhersagen, wo die Sonne steht und wie lang der Tag ist, und
  warum. Rechnen muss man nichts.
- **Das Modell ist der Kern** und der Mehrwert gegenüber Büchern und statischen Seiten. Der Rundgang
  trägt den Inhalt. Der Beitrag liefert Einstieg, Überleitungen, einen Impuls zum Beobachten (keine
  Aufgabe) und den Schluss.

## Die Reihe

| Teil | Beitrag | Leitfrage (Arbeitstitel) | Modell, Rundgang | Stand |
|-----:|---------|--------------------------|------------------|-------|
| 1a | [Tageslänge](01a-tageslaenge.md) | Warum werden die Tage im Herbst so schnell kürzer? | `tageslaenge`, Rundgang `tageslaenge` | Entwurf |
| 1b | [Mittag](01b-mittag.md) | Warum geht die Sonne am 12. Dezember am frühesten unter? | `tageslaenge`, Rundgang `mittag` | Entwurf |
| 2 | [Tagbogen](02-tagbogen.md) | Läuft die Sonne im Winter auf einer kleineren Bahn? | `tagbogen`, Rundgang (9 Schritte, wird überarbeitet) | Entwurf (aus dem Pilotbeitrag) |
| 3 | [Himmelsachse](03-himmelsachse.md) | Warum steht der Polarstern immer an derselben Stelle? | `himmelsachse`, Rundgang (11 Schritte, wird überarbeitet) | Gliederung |
| 4 | [Erdbahn](04-erdbahn.md) | Warum ist es im Winter kalt, obwohl die Erde der Sonne näher ist? | `Erdbahn3D.html` (neu), Rundgang `erdbahn`; `tageslaenge`, Rundgang `zeitgleichung` | Gliederung |
| 5 | [Jahrhunderte](05-jahrhunderte.md) | Was sich über Jahrhunderte ändert | `Erdbahn3D.html`, Rundgang `jahrhunderte` | Gliederung |
| 6 ff. | [Mond](06-mond.md) | (später festlegen) | `erdemond`, `mond`, `mondbahn` | Ideen |
| – | [Erfahrungen mit Claude Code](ki-erfahrung.md) | Wie entsteht so eine Reihe mit einem KI-Werkzeug? | – | Stoff sammeln |

- Teil 1 bleibt bei Alltagsbeobachtungen. 1b löst das Rätsel vom 12. Dezember mit dem wandernden
  Mittag; die Ursachen der Zeitgleichung kommen in Teil 4.
- Teil 2 nimmt aus der früheren Langfassung auch Winkel und Dauer des Untergangs auf. Die
  Lichtbrechung entfällt. `Sichtbarkeit.html` gehört nicht zur Reihe.
- `Erklaerung-Sonnenbahn.md` geht in diesen Entwürfen auf und wird danach gelöscht. Ihre Übersicht
  „welche Seite zeigt was“ kommt auf `index.html`.

## Stil

Wie der bestehende Blog:
- **Keine Anrede.** Statt „du“ oder „Sie“ steht „man“ („Klickt man auf …“). Ich-Form nur für Erlebtes
  und Motivation.
- **Sätze** mittellang bis lang, dazwischen kurze Akzentsätze. Trockener, beiläufiger Humor,
  gelegentlich 😉.
- **Einstieg** mit einer Beobachtung, Anekdote oder einem Zitat, das zur Leitfrage führt.
- **Überschriften** sachlich, gelegentlich als Frage.
- **Schluss** ohne Appell: Ausblick, Frage zum nächsten Teil, Glossar, dann der feste Hinweis auf
  Claude Code (siehe Bausteine).
- **Nicht flapsig:** lebhaft ja, aber keine saloppen Zuspitzungen. „Ich“ möglichst vermeiden, lieber
  „fällt mir auf“ als „merke ich“; keine erfundenen Erlebnisse.
- **Kein Vorgriff** auf spätere Teile im Impuls (etwa auf die Richtung des Sonnenuntergangs vor dem
  Tagbogen).

Für alle verständlich:
- **Fachbegriffe** nicht erzwingen. Ein Schlüsselwort steht **fett** beim ersten Auftreten, kurz in
  Klammern oder im Nebensatz erklärt.
- **Glossar:** Am Ende jedes Beitrags stehen die Schlüsselwörter, je ein Satz, ohne Links.

Umfang und Aufbau:
- **Eine Leitfrage pro Beitrag**, etwa 800–1200 Wörter, höchstens zwei Modelle.
- **Jeder Beitrag einzeln lesbar:** Wegweiser „Teil n der Reihe“, kurzer Rückblick, am Ende die
  Frage zum nächsten Teil.

**Rundgänge** dürfen lebhaft sein und Neugier wecken, ebenfalls ohne „du“. Seite und Beitrag nutzen
denselben Rundgang. Die übrigen Texte auf den HTML-Seiten bleiben sachlich.

## Bausteine

**Ort:**
- Rundgänge setzen ihren Ort fest (**50° N, 10° O**, Mitte Deutschlands) und sagen das. Nach dem
  Rundgang gilt wieder der Ort des Lesers.
- Zahlen im Beitrag gelten für denselben Ort, Jahr 2026, Uhrzeit wie auf der Uhr (mit Sommerzeit),
  wo „MEZ“ steht ohne.
- Modelle zum freien Ausprobieren zeigen den gemerkten Ort des Lesers. Mit `data-ort-fest="ja"`
  zeigen sie den Ort aus `data-ort`.

**Modell im Beitrag:** ein Platzhalter (in WordPress ein Block „Individuelles HTML“). Sein Inhalt ist
der Ersatz, wenn das Modell nicht lädt: eine Zusammenfassung des Rundgangs in Stichpunkten, von Hand
geschrieben, dazu der Link zur eigenen Seite.

```html
<div class="km-modell" id="…" data-modell="tageslaenge" data-tour="tageslaenge">
<ul><li>…</li></ul>
<p><a href="Tageslaenge.html">Diagramm: Tageslänge im Jahr (eigene Seite öffnen)</a></p>
</div>
```

- Der Link nennt nur den Dateinamen; beim Übertragen in den Blog den Pfad zu den Modellen davorsetzen.
- `data-tour="<name>"` zeigt im Modell den Knopf für diesen Rundgang. Der Rundgang startet erst per
  Knopf und lässt sich wiederholen. Mit `data-schritt` startet er sofort bei diesem Schritt.
- Weitere Attribute: `data-datum`, `data-ort`, `data-ort-fest`, `data-ansicht`, `data-ebenen`,
  `data-abspielen`, `data-bedienung="voll|min|keine"`, `data-poster`, `data-hoehe` (Liste in
  `CLAUDE.md` unter `modelle.js`).

**Schluss jedes Beitrags**, kursiv nach dem Glossar:

> *Die Modelle und Texte dieser Reihe sind mit großer Unterstützung von Claude Code entstanden, einem
> KI-Werkzeug zum Programmieren. Wie diese Zusammenarbeit lief, was gut klappte und wo es hakte,
> beschreibt ein eigener Beitrag.*

Sobald der Erfahrungsbericht erschienen ist, wird „ein eigener Beitrag“ zum Link.

## Arbeitsplan

1. Stilprobe: die Rundgänge `tageslaenge` und `mittag` in `Tageslaenge.html` mit Startknopf, dazu
   die Entwürfe 1a und 1b.
2. Prüfen des Stils (erledigt, Stil freigegeben).
3. Die vorhandenen Rundgänge (Tagbogen, Himmelsachse, Erde-Mond) im neuen Stil, mit Startknopf (erledigt; Texte von Erde-Mond folgen mit den Mond-Beiträgen).
4. Diagramm der Zeitgleichung mit den Anteilen Ellipse und Neigung (Formel nach Smart, Meeus 27.3)
   in `Tageslaenge.html`, dazu der Rundgang `zeitgleichung` (erledigt).
5. `Erdbahn3D.html`:
   - Canvas 2D, schematisch, gemeinsamer Code in `canvas3d.js`;
   - Küstenlinien von Natural Earth 1:110 Mio. (gemeinfrei);
   - Rundgang `erdbahn`.
6. Formeln für lange Zeiträume nach Meeus und der Rundgang `jahrhunderte`:
   - In `astro.js` und `cpp/astro.cpp` gemeinsam: allgemeine Verbesserungen wie die Schiefe nach
     Laskar 22.3 und der Kalender vor 1582.
   - In einem eigenen JS-Modul: was nur der Zeitraffer braucht (Kap. 21, 31).
   - Zeitraffer von −8000 bis +12 000.
7. Den Inhalt von `Erklaerung-Sonnenbahn.md` vollständig übernehmen, dann die Datei löschen.
