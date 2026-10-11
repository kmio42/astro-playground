# Genauigkeit der Mondberechnungen in astro.cpp

Ergebnisse von `moon_testbench.cpp`. Untersucht werden `calculateMoonPosition` („normal“, Meeus Kapitel 45),
`calculateMoonPositionSimple` („simple“, MINI_MOON nach Montenbruck/Pfleger) und verschiedene
Polynomnäherungen aus Stützstellen.

## Aufruf

```bash
g++ -std=c++20 -O2 -Wall -Wextra moon_testbench.cpp astro.cpp -o moon_testbench
./moon_testbench [--lat 50] [--lon 10] [--deltat 0] [mooninfo_2025.txt mooninfo_2026.txt]
```

- `--lat`, `--lon`: Beobachtungsort für die Höhe (Länge Ost positiv), Standard 50° N, 10° O
- `--deltat`: ΔT = TD − UT [s]. astro.cpp setzt TD = UT; mit `--deltat 69` wird die Mondposition zur
  Dynamischen Zeit berechnet.

## Verfahren

**Referenz:** stündliche Ephemeriden der NASA (Dial-a-Moon, `mooninfo_2025.txt`, `mooninfo_2026.txt`).
RA/Dec beziehen sich dort auf J2000 und werden mit der strengen Präzession (Meeus, Formeln 21.2–21.4) auf das
mittlere Äquinoktium des Datums gebracht. Zwischen den vollen Stunden wird die Referenz kubisch interpoliert.

**Prüfgrößen:** geozentrisch, mittleres Äquinoktium des Datums

- Winkelabstand zur Referenz, ΔRA·cosδ, ΔDec
- Δ(h−h0): Höhe über der Standardhöhe h0 = 0,7275·π − 0°34′, wie in `calculateMoonRiseSet`. Das ist die Größe,
  deren Nullstelle Auf- und Untergang bestimmt. Bei 50° Breite ändert sich die Höhe am Horizont um höchstens
  etwa 10′ pro Minute, 1′ Höhenfehler entspricht also mindestens etwa 6 s in der Aufgangszeit.
- Entfernung (simple liefert nur die konstante mittlere Entfernung)

Angegeben sind jeweils **RMS** (Wurzel aus dem mittleren quadratischen Fehler) und **Maximum**.
Zusätzlich wird gegen `calculateMoonPosition` direkt verglichen; das zeigt den reinen Interpolationsfehler.

**Getestete Näherungen:**

1. **Tageweise wie `calculateMoonRiseSet`:** Stützstellen im Abstand h ab 0h UT, für das Intervall [k, k+1]
   die Parabel durch k, k+1, k+2. Interpoliert wird entweder die Höhe über h0 (wie `calculateMoonRiseSet`) oder
   RA, Dec und Entfernung. Prüfzeitpunkte alle 10 min, 725 Tage.
2. **Stundentabelle über das ganze Jahr** (wie die mooninfo-Dateien): Stützstellen in festem Raster über den
   ganzen Zeitraum, ausgewertet an jeder vollen Stunde (17 376 Stunden). Drei Verfahren:
   - *vorwärts*: Parabel durch k, k+1, k+2 (wie `calculateMoonRiseSet`)
   - *zentriert*: Parabel um die nächste Stützstelle, `interpolate` (Formel 3.3)
   - *kubisch*: Polynom dritten Grades durch k−1 … k+2

Alle folgenden Werte mit ΔT = 69 s, sofern nicht anders angegeben.

## Ergebnisse

### Direkte Berechnung und Einfluss von ΔT

| Verfahren | ΔT | Winkelabstand RMS / max | Δ(h−h0) RMS / max | Entfernung RMS / max |
|---|---|---|---|---|
| normal direkt | 0 s | 0,64′ / 0,90′ | 0,37′ / 0,83′ | 28 / 52 km |
| normal direkt | 69 s | **3,2″ / 11,6″** | 1,9″ / 10,7″ | 27 / 47 km |
| simple direkt | 0 s | 1,49′ / 5,0′ | 1,85′ / 7,0′ | – |
| simple direkt | 69 s | 1,27′ / 4,3′ | 1,87′ / 6,4′ | – |

- Mit ΔT = 69 s stimmt normal auf 3″ RMS mit NASA überein. Der Fehler von etwa 0,6′ ohne ΔT kommt fast ganz
  daher, dass astro.cpp TD = UT setzt. Das bestätigt zugleich Referenz und Präzession.
- Die Entfernung weicht unabhängig von ΔT um etwa 27 km ab. Die Ursache ist nicht untersucht; vermutlich ist
  die NASA-Entfernung anders definiert.
- simple: bis 4,3′ in der Position. In h−h0 bis 6,4′, weil h0 mit der konstanten Entfernung berechnet wird
  (Horizontalparallaxe 54′–61′, davon 0,7275·Δπ).

### Tageweise Parabel wie in calculateMoonRiseSet

**Höhe interpoliert** (wie `calculateMoonRiseSet`), Δ(h−h0) RMS / max:

| Schrittweite | normal | simple |
|---|---|---|
| 1 h | 1,9′ / 8,9′ | 2,7′ / 12,8′ |
| 2 h | 13,7′ / 61′ | 13,9′ / 60′ |
| 4 h | 90′ / 314′ | 90′ / 312′ |
| 6 h | 253′ / 733′ | 253′ / 732′ |
| 12 h und mehr | > 20° | > 20° |

Die Höhe ändert sich durch die Erddrehung schnell und nicht parabelförmig; nur 1 h ist brauchbar, und auch dann
sind bis zu 9′ (etwa eine Minute in der Aufgangszeit) möglich.

**RA/Dec interpoliert**, Höhe daraus berechnet, normal:

| Schrittweite | Winkelabstand max | Δ(h−h0) max | Entfernung max | Interpolationsfehler allein (max) | Aufgangszeit (grob) |
|---|---|---|---|---|---|
| direkt | 11,6″ | 10,7″ | 47 km | – | ≈ 1 s |
| 1 h | 11,6″ | 10,7″ | 47 km | 0″ | ≈ 1 s |
| 2 h | 11,6″ | 10,7″ | 47 km | 0,1″ | ≈ 1 s |
| 4 h | 11,8″ | 10,6″ | 47 km | 0,8″ | ≈ 1 s |
| 6 h | 12,2″ | 10,5″ | 47 km | 2,9″ | ≈ 1 s |
| 12 h | 24,8″ | 21,2″ | 47 km | 22,5″ | ≈ 2 s |
| 24 h | 2,9′ | 2,4′ | 65 km | 2,9′ | ≈ 15 s |
| 36 h | 9,6′ | 8,4′ | 142 km | 9,7′ | ≈ 1 min |
| 48 h | 21,6′ | 18,7′ | 297 km | 21,7′ | ≈ 2 min |

Bei simple ändert die Schrittweite bis 12 h nichts (Winkelabstand max 4,3′, Modellfehler überwiegt), bei 24 h
4,5′, bei 36 h 10,6′ und bei 48 h 22,5′.

Der Fehler wächst etwa mit der dritten Potenz der Schrittweite (Verdopplung → Faktor 8). Die Werte für 36 h
und 48 h sind etwas zu günstig, weil tageweise nur der Anfang der Parabel genutzt wird. Außerdem sparen diese
Schrittweiten nichts: Jeder Tag braucht trotzdem 3 Stützstellen, 12 h kommt mit 4 aus.

### Stündliche RA/Dec-Tabelle über ein Jahr

Maximaler Winkelabstand gegen NASA:

| Schrittweite | Aufrufe/Jahr | vorwärts | zentriert | kubisch | Interpolationsfehler kubisch allein | Entfernung kubisch allein |
|---|---|---|---|---|---|---|
| direkt | 8760 | 11,6″ | | | | |
| 2 h | 4380 | 11,6″ | 11,6″ | 11,6″ | 0,0″ | 0,0 km |
| 4 h | 2190 | 11,8″ | 11,8″ | 11,7″ | 0,1″ | 0,0 km |
| 6 h | 1460 | 12,2″ | 11,9″ | 11,7″ | 0,2″ | 0,0 km |
| 12 h | 730 | 24,8″ | 27,5″ | **11,7″** | 2,4″ | 0,4 km |
| 24 h | 365 | 2,9′ | 2,9′ | **41″** | 37″ | 5,6 km |
| 36 h | 243 | 9,5′ | 9,2′ | 2,9′ | 2,9′ | 28 km |
| 48 h | 183 | 21,5′ | 21,2′ | 8,3′ | 8,3′ | 84 km |

- Kubisch ist klar am besten: bei 12 h liegt der Interpolationsfehler (2,4″) weit unter dem Modellfehler
  (12″), selbst 24 h bleibt unter 1′.
- Die zentrierte Parabel bringt gegenüber „vorwärts“ nur 10–15 % im RMS, die Fehlerordnung bleibt gleich.

### Vergleich mit simple

Laufzeit auf dem Entwicklungsrechner (nach Aufwärmen): `calculateMoonPosition` ≈ 1,1 µs,
`calculateMoonPositionSimple` ≈ 0,14 µs je Aufruf; simple ist etwa 8-mal schneller.

| Verfahren | Aufrufe/Jahr | Rechenzeit/Jahr* | Winkelabstand RMS / max | Entfernung |
|---|---|---|---|---|
| simple direkt | 8760 | ≈ 1,2 ms | 76″ / 257″ (4,3′) | keine (konstant) |
| normal direkt | 8760 | ≈ 9,9 ms | 3,3″ / 11,6″ | ± 47 km |
| normal kubisch 12 h | 730 | ≈ 0,8 ms | 3,3″ / 11,7″ | ± 47 km |
| normal kubisch 24 h | 365 | ≈ 0,4 ms | 10″ / 41″ | ± 48 km |
| normal kubisch 36 h | 243 | ≈ 0,3 ms | 50″ / 175″ | ± 57 km |

\* Nur die Aufrufe der Positionsfunktion. simple braucht pro Stunde zusätzlich `calculateEquatorial` und
`calculateObliquity`; bei der Interpolation fallen diese nur an den Stützstellen an. Die kubische Interpolation
selbst kostet pro Stunde und Größe nur etwa ein Dutzend Multiplikationen, ohne Winkelfunktionen.

Auf einem Mikrocontroller ohne Gleitkommaeinheit für `double` sind beide Funktionen viel langsamer; das
Verhältnis dürfte ähnlich bleiben, da beide vor allem Winkelfunktionen berechnen (nicht gemessen).

## Folgerungen

- **Jahrestabelle:** normal mit kubischer Interpolation und 12 h Schrittweite. Genauso genau wie die direkte
  Rechnung, 92 % weniger Aufrufe und schneller als simple bei 20-facher Genauigkeit. 24 h reicht, wenn 1′
  genügt.
- **Mondauf-/-untergang:** RA/Dec interpolieren statt der Höhe. Normal mit 6 h ist praktisch so genau wie die
  direkte Rechnung, 12 h ebenfalls sehr gut. Die stündliche Höhenparabel in `calculateMoonRiseSet` braucht 26
  Aufrufe pro Tag und ist trotzdem ungenauer (bis 9′).
- **simple** lohnt sich nur für eine einzelne Position ohne Tabelle, wenn Speicher oder Code-Größe knapp sind.
  Für Tabellen bietet simple keinen Vorteil; außerdem verfälscht die konstante Entfernung h0 um bis zu 6′.
- **ΔT:** Der größte einzelne Fehler von normal ist TD = UT (≈ 0,6′). Ein fester Wert von ΔT ≈ 69 s würde den Fehler
  für die nächsten Jahre im RMS etwa auf ein Zehntel senken (Maximum auf etwa ein Fünftel).
