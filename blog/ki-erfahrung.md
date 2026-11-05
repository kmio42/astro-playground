# Erfahrungen mit Claude Code

<!-- Eigener Beitrag neben der Reihe; alle Teile verweisen am Ende darauf. Ich-Form, weil Erlebtes.
     Die Erfahrungen und Urteile sind die des Autors; nichts davon erfinden. Vorgeschichte und
     Arbeitsweise vom Autor (Notizen unten), „Was gut klappte“, „Wo es hakte“ und „Fazit“ am 2026-11-05
     aus Stoff, Git-Historie und Sitzungsverlauf zusammengestellt – vom Autor zu prüfen. -->

*Ein Beitrag neben der Reihe „Sonne, Erde, Mond“: wie sie entstanden ist.*

Die Modelle und Texte der Reihe „Sonne, Erde, Mond“ sind mit großer Unterstützung von Claude Code
entstanden, einem KI-Werkzeug zum Programmieren. Am Ende jedes Teils steht dazu ein kurzer Hinweis.
Hier steht der Rest: wie es dazu kam, wie die Arbeit mit der KI aussieht, was gut klappte und wo es
hakte.

## Vorgeschichte: Formeln von Hand

<!-- Websuche in ChatGPT (geprüft 2026-11-03): „Browse with Bing“ ab Mai 2023 für Plus, Juli–September
     2023 pausiert; für kostenlose Nutzer mit GPT-4o angekündigt 13.5.2024, verfügbar ab Ende Mai 2024
     (begrenzt); „ChatGPT Search“ mit Quellenlinks ab 31.10.2024 für Plus/Team, ab 16.12.2024 für alle
     Angemeldeten. Ob gesucht wurde, entschied meist das Modell. -->

KI beim Programmieren nutze ich privat wie in der Firma seit etwa 2024. Als mir im Herbst 2024 der
frühe Sonnenuntergang bewusst wurde, interessierte mich der Zusammenhang – dabei hatte ich mich für
Astronomie vorher nie besonders interessiert. Es begann mit einigen Fragen an ChatGPT. Die Antworten
kamen damals überwiegend aus dem gelernten Wissen des Modells, eine Websuche gab es erst in Ansätzen –
und so waren sie noch häufiger fehlerhaft. Auch die kleinen Skripte, die ich mir schreiben ließ, etwa
um die Zeitgleichung oder Sonnenauf- und -untergang darzustellen, enthielten Fehler.

ChatGPT half bei der Einarbeitung in das neue Thema, ein ganzer Teil war aber noch gewöhnliche
Recherche. Dabei war ich überladen von Koordinatensystemen und Fachbegriffen und hatte Mühe, Skizzen
und Zeichnungen zu verstehen. Am Schluss landete ich bei Jean Meeus' *Astronomische Algorithmen* und
begann eine eigene Umsetzung in JavaScript – vor allem, um die Zusammenhänge sichtbar zu machen und
so besser zu begreifen. Die ersten Formeln kamen direkt aus dem Buch, per Hand abgeschrieben. Sie
richtig umzusetzen und lauffähig zu bekommen, war nicht leicht. Manchmal war es nur ein übersehenes
Vorzeichen oder eine fehlerhafte Umwandlung der Winkel, denn viele Angaben stehen traditionell in
Grad oder Stunden. Manchmal lag es auch am Verständnis: Eine zweidimensionale Zeichnung von Sonne und
Erde etwa kann nicht alle Aspekte von Sonnenauf- und -untergang im Lauf der Jahreszeiten zeigen, weil
sich die Neigung der Erdachse gegenüber der Linie Sonne–Erde verschiebt: Im Sommer neigt sich der
Nordpol zur Sonne hin, im Winter von ihr weg, im Frühling und Herbst zur Seite.

Zwischendurch stieß ich auf ein Git-Projekt in Go
([soniakeys/meeus](https://github.com/soniakeys/meeus)), in dem alle Formeln des Buchs schon umgesetzt
waren. Das machte die Arbeit etwas einfacher und weniger fehleranfällig, aber es blieb viel
Handarbeit und Testen.

Die KI half dabei am Rand. ChatGPT baute mir ein kleines, einfaches Beispiel für das
JavaScript-Canvas, das ich an meine Berechnungen anpasste, und kleine Hilfsfunktionen, die die
Eingabe des Standorts vernünftig auswerten. Im ersten Entwurf eines Gittermodells der Kugel waren
die Knotenpunkte falsch verbunden. Das ließ sich leicht beheben, würde heute aber gar nicht mehr
passieren. So entstand zuerst eine Sammlung von Funktionen für die Astro-Berechnungen und daraus eine
kleine JavaScript-Bibliothek. Auf ihr beruht das Modell aus dem Beitrag „Sternzeit und Erdposition“.

Im Frühjahr 2026 testete ich Claude Code über die API und hatte für ein paar Euro eine Entsprechung in
C++. Später drehte sich das um: Die JavaScript-Bibliothek wurde als Portierung der C++-Fassung neu
geschrieben, mit denselben Funktionen und Ergebnissen. Seither werden beide gemeinsam geändert und
stimmen bis auf winzige Rundungsreste überein.

## Ein Abend Ende Oktober

<!-- Fakten aus Git und Sitzungsverlauf (Sitzung 970e4733, Commits f7d63eb, 8309bfc, ea580a6),
     Uhrzeiten MEZ. „Beim zweiten Hinsehen“: Autor schrieb „stimmt nicht“, sechs Minuten später
     „Es scheint zu stimmen“. -->

Seit ein paar Wochen erlebe ich nun meinen persönlichen „KI-Schock“: Mit dem agentischen Modus (die
KI arbeitet selbstständig mehrere Schritte nacheinander ab) und den neuen Modellen ist unglaublich
viel möglich, und das Ergebnis ist im Verhältnis erstaunlich fehlerfrei. Es gehen Dinge, die vor
wenigen Monaten für mich noch unvorstellbar gewesen wären. Heute entstehen ganze interaktive
3D-Modelle wie mit einem Fingerschnippen.

An einem Abend Ende Oktober bat ich Claude Code um ein Konzept:

> Erstelle ein interaktives 3d-Modell von Erde und Mond, wo man die Ekliptik-Ebene und Mondbahn sieht, Knoten und Apsiden und die beleuchteten Seiten. Nutze für Mond das cgi-kit und suche wenn möglich für Erde eine Entsprechung. Die Implementierung soll ohne nachladen aus dem Internet funktionieren. Erstelle ein Konzept

Auf meine Frage nach dem Aufwand mit einer fertigen 3D-Bibliothek oder mit eigenem **WebGL** (der
3D-Grafik des Browsers) fiel die Wahl auf eigenes WebGL. Gut zwei Stunden später stand das Modell mit
Erde und Mond, Ekliptik, Mondbahn, Knoten und Apsiden, die Oberflächen aus Bilddaten der NASA. Eine
knappe halbe Stunde danach kamen Schatten und Finsternisse dazu, nach einer weiteren halben Stunde
eine Erklärung aller Einstellungen und geführte Rundgänge. Von mir kam dazwischen etwa ein Dutzend
kurzer Anweisungen, oft nur „mache weiter“ oder „committe“. Einmal meldete ich, die Ausrichtung der
Erde zur Sonne stimme nicht – beim zweiten Hinsehen stimmte sie doch. In gut drei Stunden entstanden
rund 3200 Zeilen Programmcode, ein Konzeptpapier mit gut 400 Zeilen und Tests für die Bahnberechnung.

Nach diesem Versuch kam die Idee zu der Reihe.

## Vibe-Coding mit Plan

<!-- Vom Autor geschrieben; Reihenfolge, Erklärungen in Klammern und Testbelege am 2026-11-05 ergänzt.
     Belege: JS/C++ etwa 1e-11 (cb87c68), NASA-Vergleich in cpp/Testbench-Mond.md. -->

Die Modelle sind durch **Vibe-Coding** entstanden: Programmieren nach Gefühl. Beschreiben, was man
sehen möchte, Ergebnis anschauen und sagen, was anders sein soll. Der Programmcode selbst tritt dabei
in den Hintergrund. Es geht um den Inhalt, nicht um das Wie. Die KI testet größtenteils selbst, macht
zum Beispiel virtuelle Bildschirmfotos und analysiert diese.

Allerdings setze ich auch beim Vibe-Coding auf eine starke Planung. Ich beginne Claude-Code-Projekte
mit einer Planungsphase, lasse mir Umsetzungsvorschläge machen und greife in die Planung ein. Bei
einem Plan in mehreren Schritten kontrolliere ich die Ergebnisse, bevor ich die KI wieder einige
Minuten programmieren und testen lasse.

Die Arbeit mit der KI ist für mich wie die Arbeit mit einem eifrigen Praktikanten. Er hat viel
Hintergrundwissen, aber ihm fehlt ein bisschen der Fokus auf das Wesentliche. Die eigene Aufgabe ist,
ihn zu führen: den Überblick über die Idee behalten, die man umsetzen möchte. Immer mal schauen, ob
sich das Projekt in die gewünschte Richtung bewegt. Manchmal den Praktikanten bremsen, manchmal seine
Ideen nutzen.

## Vom Prompt zur Reihe

Für diese Reihe habe ich Claude Code mit folgendem **Prompt** (der Anweisung an die KI) gestartet:

> Erstelle als Markdown eine didaktisch sinnvolle Erklärung zu den Themen: Die Sonnenbahn im Laufe des Jahres am Himmel (Aufgangszeit, Mittagszeit, Untergang, Höhe der Bahn, eventuell Steilheit bei Auf- und Untergang  wie schnell verschwindet die Sonne am Horizont) und damit verbunden die Bahn der Erde um die Sonne (Sommer länger als Winter wegen Elliptischer Bahn...) . Erkläre in einem eigenen Abschnitt dann auch, was sich im Laufe der Jahrhunderte geändert hat/ändert. Verweise auf die vorhanden Skripte zur Visualisierung.

Zwei Tage später, als aus dieser Erklärung schon die Modelle zum Tagbogen und zur Himmelsachse
entstanden waren, folgte ein konkreterer Plan:

> Grundplan für die Seite: Neben Ausprobieren/Experimentieren (Spielwiese) möchte ich einen didaktisch-sinnvollen Weg aus mehreren Wordpress-Beiträgen schaffen und dem Phänomen Tageslänge, Auf- und Untergang, Zeitgleichung, Tagesbogen (horizont-Koordinatensystem), Himmelsachse (Wechsel zu  Äquatorialen Koordinatensystem) zu Erdbahn um die Sonne (Ekliptikales Koordinatensystem) schaffen. Anschließend soll der Mond mit betrachtet werden und einige Aspekte des Mondes und der Mondbahn mit erklärt werden. In Wordpress darf ein persönlicher Ton mit spannenden Eingangsfragen sein. Die Seiten für sich sollen eher sachlich gehalten sein. Tutorials in den Plugins [gemeint: Modelle] sollen auch in den Wordpress-Seiten verfügbar sein. Merke dir das.

Diesen Plan verfeinerte ich mit dem sogenannten **Grilling-Skill**. Das sind Textanweisungen, die
der Anfrage unsichtbar hinzugefügt werden. Sie bringen die KI zu einem Frage-Antwort-Verfahren mit
kritischen Nachfragen: Sie stellt eine Frage nach der anderen, jeweils mit einem Vorschlag, und ich
entscheide. So wurden die Zielgruppe (Laien mit allgemeiner Schulbildung) und das
Alleinstellungsmerkmal (interaktive 3D-Modelle mit eingebauten Rundgängen) geklärt. Auch die
Reihenfolge der Beiträge stand danach fest.

Für den sprachlichen Stil ließ ich die KI unter anderem mehrere meiner älteren Artikel lesen. Danach
schrieb sie einen Musterbeitrag, den ich redigierte. Daraus wurden Regeln wie diese:

> - **Keine direkte Anrede**, weder „du“ noch „Sie“.
> - **„Ich“ möglichst vermeiden**, lieber „fällt mir auf“ als „merke ich“, sonst unpersönlich oder Passiv. Erlebnisse werden nie erfunden.
> - **Lebhaft, aber nicht flapsig**: neugierig, trockener und selbstironischer Humor, beiläufig. Keine saloppen Zuspitzungen.
> - **Sätze** mittellang bis lang, dazwischen kurze Akzentsätze.
> - **Sachlich-gehoben** mit vereinzelten Alltagswörtern wie „Bastellösung“ oder „Crashkurs“.
> - **Fachbegriffe** nicht erzwingen. Ein Schlüsselwort steht **fett** beim ersten Auftreten, kurz in Klammern oder im Nebensatz erklärt.

Nachdem die KI den Stil „gelernt“ hatte, entstanden die folgenden Texte zu 90 Prozent automatisch;
nur gelegentlich griff ich noch ein.

Ein anderes Herangehen nutze ich bei Programmteilen, die mir wichtig sind – wie beispielsweise die
eigentlichen astronomischen Berechnungen. Hier verfolge ich Programmierstil und Schnittstellen (wie
die Modelle die Rechenfunktionen aufrufen) und achte darauf, dass sie „menschenlesbar“ bleiben.
Konkret basieren sie noch auf den ursprünglichen Formeln aus dem Buch *Astronomische Algorithmen*
von Jean Meeus und sind sehr gut getestet.

## Was gut klappte

<!-- Stand 2026-11-05 (Git 25.10.–5.11.): 8 Modelle mit 13 Rundgängen – tageslaenge (3), tagbogen3d,
     himmelsachse3d, erdbahn3d (2), mondbahn, mondbahn3d, mondbogen3d, erdemond3d (3). Der Abend:
     3. November, 19:57–22:26, Commits c1192f6 bis ae97eb9. Keine Zeilenzahlen, keine Tage (Autor). -->

Vor allem das Tempo. In knapp zwei Wochen entstanden acht Modelle mit zusammen 13 Rundgängen, vom
Diagramm der Tageslänge bis zum 3D-Modell von Erde und Mond. Die Modelle lassen sich in den Blog
einbetten, passen sich an Handy und Dunkelmodus an und zeigen den Ort des Lesers. Ein Zeitraffer führt
über 20 000 Jahre, das Erde-Mond-Modell zeigt Schatten und Finsternisse. An einem einzigen Abend
entstanden in gut zwei Stunden die Rundgänge im Tageslängen-Modell, das Diagramm zur Zeitgleichung,
das 3D-Modell der Erdbahn mit seinem Rundgang und der Zeitraffer über Jahrtausende.

Die KI prüft ihre Arbeit zu einem großen Teil selbst. Sie öffnet die Modelle in einem Browser ohne
Bildschirm (**headless**), macht Bildschirmfotos in Computer- und Handybreite, hell und dunkel, und
schaut sie sich an. Die Zahlen in den Rundgangstexten schreibt sie nicht ab, sondern lässt sie im
Modell berechnen. So passen Text und Bild immer zusammen.

Die Rechenbibliothek in JavaScript und ihre C++-Fassung hält die KI gemeinsam auf demselben Stand.
Beide Ergebnisse stimmen bis auf winzige Rundungsreste überein, die Mondposition ist mit Daten der
NASA verglichen.

## Wo es hakte

<!-- Belege: Kürzung „So nennt man das Programmieren nach Gefühl …“ am 2026-11-04 (Sitzungsverlauf);
     Titel ohne Fragen: Commit 6d8067c. Technisch laut Autor wenig Probleme, normales Debugging.
     Eigene Beispiele zum fehlenden Fokus ergänzen, falls gewünscht. -->

Der Praktikant ist eifrig, aber ihm fehlt ein bisschen der Fokus auf das Wesentliche. Dann heißt es
bremsen.

An den Texten blieb am meisten zu tun. Die Entwürfe gerieten oft zu umständlich. Aus „So nennt man
das Programmieren nach Gefühl: Man beschreibt, was man sehen möchte …“ wurde nach meiner Korrektur
„Programmieren nach Gefühl. Beschreiben, was man sehen möchte …“. Lange Satzketten musste ich
aufbrechen lassen. Die ersten Titel der Beiträge waren Fragen, jetzt sind sie sachlich, und
die Frage steht im Text. Jede solche Korrektur wurde zu einer Regel, die bei den nächsten Texten
schon gilt.

Technisch gab es wenig Probleme, eher normales Debugging. Und nicht jeder Fehler lag bei der KI: Die falsch ausgerichtete Erde vom Abend Ende Oktober erwies sich dann doch als richtig ausgerichtet. 😉

## Fazit

<!-- Vom Autor geschrieben (2026-11-05). -->

Damals musste ich die Dinge wirklich zuerst verstehen, bevor sie mir ein Modell richtig zeigen
konnte. Würde ich heute mit dem Thema anfangen, müsste ich mich auf die Modelle verlassen, könnte
aber vielleicht schneller meine Fragen klären. Ob das tiefe Verständnis dabei auf der Strecke geblieben wären: Wer weiß.

## Stichwörter

- **Agentischer Modus:** Die KI arbeitet eine Aufgabe in mehreren Schritten selbstständig ab:
  Programm schreiben, testen, Fehler suchen, verbessern.
- **Prompt:** die Anweisung, die man der KI schreibt.
- **Vibe-Coding:** Programmieren nach Gefühl; man beschreibt das Ergebnis, die KI schreibt den Code.
- **Grilling:** ein Frage-Antwort-Verfahren, in dem die KI einen Plan mit kritischen Nachfragen
  verfeinert.
- **WebGL:** die 3D-Grafik des Browsers.
- **Headless:** ein Browser ohne Bildschirm, den ein Programm steuert, etwa zum Testen.

*Auch dieser Beitrag ist mit Unterstützung von Claude Code entstanden: aus meinen Notizen, mit Zahlen
aus der Versionsgeschichte des Projekts.*

---

## Notizen

- Den Beitrag „Sternzeit und Erdposition“ beim Übertragen verlinken.
- Nach dem Erscheinen in allen Teilen „ein eigener Beitrag“ zum Link machen (siehe `README.md`).
- Kein Titelbild bisher; in Frage kommt ein Bildschirmfoto von `erdemond3d.html`.
- Anzahl der Modelle und Rundgänge in „Was gut klappte“ vor dem Veröffentlichen auf den dann aktuellen Stand bringen.
- Eigene Eindrücke ergänzen, falls gewünscht: Zeitaufwand, Überraschungen, Grenzen.

## Material

### Stoff aus der Arbeit an der Reihe

- Die Berechnungen folgen weiter Meeus; die KI hat `astro.js` und die C++-Fassung parallel gehalten.
- Die Modelle wurden in einem Browser ohne Bildschirm (headless) getestet, mit Bildschirmfotos auf
  Computer- und Handybreite, hell und dunkel.
- Die Zahlen in den Rundgangstexten werden im Modell berechnet statt abgeschrieben.
- Das didaktische Konzept entstand in einem Frage-Antwort-Verfahren („Grilling“): Die KI stellt Fragen
  mit einem Vorschlag, der Autor entscheidet.
- Der Textstil wurde an älteren Blogbeiträgen ausgerichtet; Korrekturen des Autors (kein „Ich“, nicht
  flapsig, kein Vorgriff) flossen als Regeln ein.
- Abend des 3. November: nach dem Grilling ab 19:57 Uhr entstanden bis 22:26 Uhr die Rundgänge in
  Tageslänge, das Zeitgleichungsdiagramm, Erdbahn3D mit Rundgang und der Zeitraffer über Jahrtausende
  (Commits c1192f6 bis ae97eb9).
- Einbettung in den Blog: Der erste Ansatz lud die Modelle in der Vorschau nicht, der zweite
  funktionierte.

### Notiz des Autors vom 2026-11-03 (Original)

> KI-Erfahrung: Sowohl Privat, als auch in der Firma benutze ich jetzt KI schon aktiv seit ca. 2024 für
> das programmieren. Als mir im Herbst 2024 der frühe Sonnenuntergang bewusst wurde, interessierte mich
> der Zusammenhang. Für Astronomie habe ich mich vorher nie besonders interessiert. Es begann mit
> einigen Fragen in ChatGPT, damals waren die Antworten noch häufiger fehlerhaft. Auch, als ich mir
> kleine Skripte schreiben ließ, um z.B. Zeitgleichung oder Sonnenauf- und Untergang zu visualisieren,
> kam es zu Fehlern. Bei der Einarbeitung in das Thema war ich überladen von Koordinatensystemen und
> Fachbegriffen. Und ich hatte Probleme die Zeichnungen zu verstehen. Am Schluss landete ich bei dem
> Buch "Astronomische Algorithmen von J. Meuss" und begann in Javascript eigene Implementierung. Dabei
> stieß ich auf das Git-Projekt in Go, wo alle Formeln umgesetzt waren. Trotzdem war es nicht leicht,
> die Formeln richtig umzusetzen und lauffähig zu bekommen. Man musste die Dinge wirklich verstehen und
> manchmal waren es einfache Vorzeichen, die man übersah, oder eine Umwandlung der Winkel - mein Ziel
> war von Anfang an, die Berechnungen nur in Radiant zu machen. Mit ChatGPT ließ ich mir ein kleines,
> einfaches Beispiel für Javascript Canvas bauen und passte es dann mit meinen implementierten
> Berechnungen an. Außerdem ließ ich mir kleine Hilfsfunktionen bauen, um die Eingabe des Standorts
> vernünftig zu parsen. Es entstand zuerst eine Sammlung an Javascript-Funktionen für die
> Astro-Berechnungen, die dann eine kleine js-Bibliothek wurden. Dieses Jahr im Frühjahr, testete ich
> die API-Funktion von Claude Code und hatte mit ein paar Euro eine Entsprechung in C++. Seit ein paar
> Wochen erlebe ich meinen persönlichen "KI-Schock". Mit dem agentischen Modus und den neuen Modellen
> ist so unglaublich viel möglich. Und das Ergebnis ist im Verhältnis so fehlerfrei. Es gehen Dinge,
> die vor wenigen Monaten (für mich) noch unvorstellbar gewesen wären.
>
> Nachtrag: Das Go-Projekt kam erst etwas später – die ersten Formeln kamen wirklich direkt aus dem
> Buch, per Hand abgeschrieben. Das Go-Projekt machte es etwas einfacher, aber es war trotzdem noch
> viel Handarbeit und Testen.
>
> Nachtrag 2: Dass ich Schwierigkeiten mit manchen schematischen Zeichnungen hatte, brachte mich schon
> früh auf die Idee von interaktiven Hilfsmitteln. Auch dabei merkte ich, dass ich Sachen erst richtig
> verstehen musste. Zum Beispiel war eine zweidimensionale Zeichnung der Sonne und Erde nicht möglich,
> wenn man alle Aspekte von Sonnenauf- und Untergang im Laufe der Jahreszeiten darstellen wollte – weil
> sich die Neigung der Erde gegenüber der Achse Sonne–Erde verschiebt. Im ersten Entwurf des
> ChatGPT-Gittermodells einer Kugel waren die Knotenpunkte falsch verbunden. Das konnte leicht behoben
> werden, würde aber heute gar nicht mehr passieren. Heute werden mit einem Fingerschnipsen ganze
> interaktive 3D-Modelle gebaut.
>
> Nachtrag 3: Die Umsetzung in JavaScript war hauptsächlich zur Visualisierung, dass ich die
> Zusammenhänge besser begreife.

### Notiz des Autors vom 2026-11-05 (Original)

> KI-Erfahrung: Die Arbeit mit der KI ist für mich vergleichbar wie die Arbeit mit einem eifrigen
> Praktikanten, der viel Hintergrundwissen hat. Man selbst hat die Aufgabe, den Praktikanten zu führen.
> Man muss den Überblick behalten über die Idee, die man umsetzen möchte und immer mal schauen, dass sich
> das Projekt in die gewünschte Richtung bewegt (manchmal den Praktikanten bremsen und manchmal die Ideen
> nutzen)
