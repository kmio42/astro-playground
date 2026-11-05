# Mondauf-/-untergang mit interpolierten RA/Dec

Umgesetzt am 5.11.2026 in `astro.cpp` und `astro.js` (gleiche API, Ergebnisse gleich bis etwa 1e-13 h).
Geplant am 11.10.2026 auf Grundlage der Messungen in `Testbench-Mond.md` (`moon_testbench.cpp`).

## Ausgangslage

`calculateMoonRiseSet` rief bisher stündlich `calculateMoonPosition` auf (26 Aufrufe pro Tag) und legte eine
Parabel durch die **Höhe**. Die Höhe ändert sich durch die Erddrehung schnell und nicht parabelförmig. Im
Vergleich mit der direkten Rechnung (siehe unten) lagen Auf- und Untergang bei 50° Breite bis 12 s daneben,
bei 69° bis 38 s. Der Plan hatte aus dem Höhenfehler von bis zu 8,9′ etwa 1 min geschätzt; gemessen ist es
weniger, weil der größte Höhenfehler selten genau am Horizont auftritt.

## Verfahren

Die Höhe wird weiterhin berechnet, aber nicht mehr interpoliert. Interpoliert werden nur die langsam und
gleichmäßig veränderlichen Größen RA, Dec und Entfernung; die Erddrehung steckt in der Sternzeit, die zu jedem
Zeitpunkt exakt und billig berechnet wird:

```
h(t) = asin( sin φ · sin δ(t) + cos φ · cos δ(t) · cos(θ(t) − α(t)) ) − h0(Δ(t))
              └ interpoliert ┘                    └ exakt ┘└ interp. ┘     └ interp. ┘
```

1. **Stützstellen** (`moonNodesForDay`): `calculateMoonPosition` nur alle 12 h von Tagesbeginn −12 h bis
   +36 h, also 5 Aufrufe pro Tag statt 26. RA wird stetig fortgesetzt (kein Sprung bei 360°).
2. **Interpolation** (`cubicThroughNodes`): Polynom dritten Grades durch vier Stützstellen, und zwar das
   Fenster, in dessen mittlerem Intervall der Zeitpunkt liegt (0–12 h: Stützstellen −12 … 24 h, danach
   0 … 36 h). `moonSampleAt` liefert daraus Höhe über h0 und Stundenwinkel zu jedem Zeitpunkt.
3. **Grobsuche wie bisher:** stündlich abtasten, Parabel durch k, k+1, k+2. Sie erkennt Vorzeichenwechsel, den
   streifenden Mond (zwei Durchgänge in einer Stunde, Scheitel auf der anderen Seite des Horizonts; geprüft auch
   mit h(t) am Scheitel) und Tage ohne Auf- oder Untergang.
4. **Verfeinern durch Intervallhalbierung** (`bisectMoonSample`) im gefundenen Stundenintervall bis 0,1 s
   (16 Schritte). Für den Meridiandurchgang ebenso mit dem Stundenwinkel.
5. **Höchster Stand** wie bisher aus dem Scheitel der Stundenparabel, jetzt mit Werten aus h(t); ändert sich
   um höchstens etwa 1″.

Abweichungen vom ursprünglichen Plan:

- **Halbierung statt Korrektur Δm** (Newton-Schritt nach Meeus Kapitel 14): Die Halbierung bleibt sicher im
  Intervall der Grobsuche und braucht keinen Sonderfall für den streifenden Mond oder H nahe 0. Sie kostet nur
  Auswertungen von h(t), keine Mondpositionen.
- **0,1 s statt 1 s:** Mit 1 s wäre der Meridiandurchgang schlechter geworden als bisher (0,5 s statt 0,01 s,
  denn der Stundenwinkel lässt sich gut mit einer Parabel interpolieren). Vier Halbierungen mehr sind billig.

## Genauigkeit

`moon_riseset_check.cpp` vergleicht mit einer Referenz, die Höhe und Stundenwinkel zu jedem Zeitpunkt direkt
mit `calculateMoonPosition` berechnet (Raster 5 min, Halbierung bis 0,01 s). Gemessen wird also der Fehler des
Verfahrens, nicht der Mondtheorie. 730 Tage ab 1.1.2025:

```bash
g++ -std=c++11 -O2 -Wall -Wextra moon_riseset_check.cpp astro.cpp -o moon_riseset_check
./moon_riseset_check 50 10 730 1
```

| Ort | Verfahren | Aufgang RMS / max | Untergang RMS / max | Durchgang max |
|---|---|---|---|---|
| 50° N, 10° O | bisher (Höhenparabel 1 h) | 7,5 s / 11,9 s | 7,5 s / 11,7 s | 0,01 s |
| 50° N, 10° O | neu | 0,07 s / 0,31 s | 0,06 s / 0,27 s | 0,13 s |
| 69° N, 19° O | bisher | 9,9 s / 26 s | 10,0 s / 38 s | 0,01 s |
| 69° N, 19° O | neu | 0,09 s / 0,98 s | 0,07 s / 0,67 s | 0,13 s |
| 35° S, 150° O | neu | 0,05 s / 0,22 s | 0,05 s / 0,22 s | 0,13 s |

An keinem Tag gibt es ein Ereignis nur in einer der beiden Rechnungen. Rechenzeit pro Tag (g++ -O2):
etwa 44 µs statt 83 µs.

Die Refraktion am Horizont schwankt mit dem Wetter um mehrere Bogenminuten (10 s bis etwa 1 min in der Zeit);
genauer als die Mondtheorie (3″ RMS gegen NASA, `Testbench-Mond.md`) und das Wetter muss das Verfahren nicht
sein. Es ist jetzt kein nennenswerter Teil des Fehlers mehr.
