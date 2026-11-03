# Erfahrungen mit Claude Code

<!-- Eigener Beitrag außerhalb der Reihe; alle Teile verweisen am Ende darauf. Noch kein Text: hier
     Stoff sammeln. Die Erfahrungen und Urteile sind die des Autors; nichts davon erfinden. -->

## Mögliche Gliederung

1. **Vorgeschichte:** das erste Projekt mit zaghafter KI-Hilfe („Sternzeit und Erdposition“), Resultate
   noch nicht durchgehend überzeugend.
2. **Diesmal:** Was Claude Code gemacht hat und was beim Autor blieb (Ideen, Entscheidungen, Prüfen,
   Stil).
3. **Was gut klappte**
4. **Wo es hakte**
5. **Fazit**

## 1. Vorgeschichte (Entwurf)

<!-- Aus der Notiz des Autors vom 2026-11-03, Formulierungen weitgehend übernommen. Ich-Form, weil
     Erlebtes. Original unten unter „Notizen“. -->

KI beim Programmieren nutze ich privat wie in der Firma seit etwa 2024. Als mir im Herbst 2024 der
frühe Sonnenuntergang bewusst wurde, interessierte mich der Zusammenhang – dabei hatte ich mich für
Astronomie vorher nie besonders interessiert. Es begann mit einigen Fragen an ChatGPT. Die Antworten
kamen damals überwiegend aus dem gelernten Wissen des Modells, eine Websuche gab es erst in Ansätzen –
und so waren sie noch häufiger fehlerhaft. Auch die kleinen Skripte, die ich mir schreiben ließ, etwa
um die Zeitgleichung oder Sonnenauf- und -untergang darzustellen, enthielten Fehler.

<!-- Websuche in ChatGPT (geprüft 2026-11-03): „Browse with Bing“ ab Mai 2023 für Plus, Juli–September
     2023 pausiert; für kostenlose Nutzer mit GPT-4o angekündigt 13.5.2024, verfügbar ab Ende Mai 2024
     (begrenzt); „ChatGPT Search“ mit Quellenlinks ab 31.10.2024 für Plus/Team, ab 16.12.2024 für alle
     Angemeldeten. Ob gesucht wurde, entschied meist das Modell. -->

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

Seit ein paar Wochen erlebe ich nun meinen persönlichen „KI-Schock“: Mit dem agentischen Modus und
den neuen Modellen ist unglaublich viel möglich, und das Ergebnis ist im Verhältnis erstaunlich
fehlerfrei. Es gehen Dinge, die vor wenigen Monaten für mich noch unvorstellbar gewesen wären. Heute
entstehen ganze interaktive 3D-Modelle wie mit einem Fingerschnippen.

<!-- Portierung JS ← C++: Commit cb87c68 vom 2026-10-26; Abweichung JS/C++ etwa 1e-11. -->

## Stoff (zum Auswählen)

Aus der Arbeit an der Reihe, als Gedächtnisstütze:
- Die Berechnungen folgen weiter Meeus; die KI hat `astro.js` und die C++-Fassung parallel gehalten.
- Die Modelle wurden in einem Browser ohne Bildschirm (headless) getestet, mit Bildschirmfotos auf
  Computer- und Handybreite, hell und dunkel.
- Die Zahlen in den Rundgangstexten werden im Modell berechnet statt abgeschrieben.
- Das didaktische Konzept entstand in einem Frage-Antwort-Verfahren („Grilling“): Die KI stellt Fragen
  mit einem Vorschlag, der Autor entscheidet.
- Der Textstil wurde an älteren Blogbeiträgen ausgerichtet; Korrekturen des Autors (kein „Ich“, nicht
  flapsig, kein Vorgriff) flossen als Regeln ein.
- Einbettung in den Blog: Der erste Ansatz lud die Modelle in der Vorschau nicht, der zweite
  funktionierte.

## Notizen

- Eigene Eindrücke des Autors ergänzen: Zeitaufwand, Überraschungen, Grenzen.

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
