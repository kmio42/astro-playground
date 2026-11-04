# Tageslänge im Jahreslauf

<!-- Teil 1a. Modell: tageslaenge.html, Rundgang „tageslaenge“ (7 Schritte). Zahlen: 50° N, 10° O, 2026,
     Uhrzeit mit Sommerzeit wie auf der Uhr. -->

*Teil 1 der Reihe „Sonne, Erde, Mond“: Blick auf die Uhr.*

Im Herbst fällt mir als Abentyp besonders auf, dass die Sonne innerhalb weniger Tage deutlich
früher untergeht. Um die Jahreswende scheint sich dann kaum noch etwas zu tun, und im Frühjahr kommt
die Zeit, in der die Tage plötzlich wieder spürbar länger werden. Täuscht das Gefühl? Und wenn nicht:
Wie stark ändert sich die Tageslänge von Tag zu Tag, und wann im Jahr am meisten?

Diese Frage war vor zwei Jahren der Auslöser, sich näher mit dem Lauf der Sonne zu beschäftigen.
Daraus entstand das Modell aus dem Beitrag „Sternzeit und Erdposition“, das erste Projekt, bei dem KI
zaghaft beim Programmieren half – mit Resultaten, die noch nicht durchgehend überzeugten. Bei dieser
Reihe war die KI ein wesentlich größerer Helfer; mehr dazu am Ende.

In dieser Reihe möchte ich den Weg zu dem, was ich dabei gelernt habe, geordnet aufbereiten. Sie
beginnt mit Erscheinungen, die man selbst beobachten kann, ganz ohne vertiefende Astronomie; die Erklärungen
folgen Schritt für Schritt in den nächsten Teilen. Gerechnet wird wieder mit den Formeln von Jean
Meeus, diesmal stecken sie aber vor allem in interaktiven 3D-Modellen, die man selbst erkunden kann.

## Ein Jahr in zwei Diagrammen

Das Modell zeigt Sonnenaufgang, Sonnenuntergang und **Tageslänge** für jeden Tag des Jahres. Ein
Rundgang führt in sieben Schritten durch die Stellen, an denen es spannend wird; er rechnet für die
Mitte Deutschlands. Danach gilt der eigene Ort, sofern man einen eingetragen hat.

<div class="km-modell" id="tageslaenge" data-modell="tageslaenge" data-tour="tageslaenge"
     data-ebenen="gain,times,table">
<ul>
<li>In der Mitte Deutschlands ist der Tag im Juni 16 h 22 min lang, im Dezember nur 8 h 04 min.</li>
<li>Im Oktober geht die Sonne am Monatsende gut zwei Stunden früher unter als am Anfang. Eine Stunde
davon kommt vom Ende der Sommerzeit, die andere von der Sonne selbst – rund zwei Minuten pro Abend.</li>
<li>Ende September wird der Tag um bis zu 3 min 43 s pro Tag kürzer, fast eine halbe Stunde pro Woche.
Vor allem die Abende verlieren.</li>
<li>Um den 21. Dezember steht die Tageslänge fast still: In der Woche davor schrumpft sie nur noch um
3 Minuten.</li>
<li>Im März kommen bis zu 3 min 46 s pro Tag hinzu, vor allem am Morgen. Ende März schiebt die
Sommerzeit dann eine Stunde vom Morgen auf den Abend.</li>
<li>Nach Sonnenuntergang folgt die Dämmerung: bürgerlich (bis 6° unter dem Horizont), nautisch (bis
12°), astronomisch (bis 18°). Im Juni wird es hier die ganze Nacht nicht richtig dunkel.</li>
</ul>
<p><a href="tageslaenge.html">Diagramm: Tageslänge im Jahr (eigene Seite öffnen)</a></p>
</div>

## Das Gefühl täuscht nicht

Die Tage werden nicht gleichmäßig kürzer und länger. Um die **Tagundnachtgleichen** (Äquinoktien) im
März und September ändert sich die Tageslänge am schnellsten, um die **Sonnenwenden** (Solstitien) im
Juni und Dezember kaum.

Gerecht verteilt ist das auch nicht: Im Herbst verlieren vor allem die Abende, im Frühjahr gewinnen
vor allem die Morgen. Dazu kommt die Uhr. Die Umstellung auf die Winterzeit Ende Oktober fällt genau in
die Zeit, in der die Abende ohnehin schnell kürzer werden, und verstärkt den Eindruck. Im Frühjahr
verschiebt sie eine Stunde vom Morgen auf den Abend, mitten in der Zeit der schnellsten Zunahme. Dass
sich der Frühling so plötzlich anfühlt, ist also kein Zufall – und warum Morgen und Abend so
unterschiedlich viel abbekommen, klärt sich im nächsten Teil.

Wer abends öfter draußen ist, kann das in den nächsten Wochen selbst verfolgen, am besten an einem
festen Ort und zu einer festen Uhrzeit, etwa auf dem Heimweg.

## Ausblick: der früheste Sonnenuntergang

Beim Herumklicken im Dezember fällt noch etwas auf: Am frühesten geht die Sonne schon um den
12. Dezember unter, nicht am kürzesten Tag. Wie das zusammenpasst, ist das Thema des nächsten Teils.

## Stichwörter

- **Sonnenaufgang, Sonnenuntergang:** der Moment, in dem der obere Rand der Sonne den Horizont berührt.
- **Tageslänge:** die Zeit zwischen Sonnenaufgang und Sonnenuntergang.
- **Sonnenwende** (Solstitium, von lat. *sol* „Sonne“ und *sistere* „stillstehen“): die Tage um den
  21. Juni und 21. Dezember mit dem längsten und dem kürzesten Tag; die Tageslänge ändert sich dort
  kaum.
- **Tagundnachtgleiche** (Äquinoktium, von lat. *aequus* „gleich“ und *nox* „Nacht“): die Tage um den
  20. März und 23. September, an denen Tag und Nacht fast gleich lang sind; die Tageslänge ändert sich
  dort am schnellsten.
- **Dämmerung:** die Zeit vor Sonnenaufgang und nach Sonnenuntergang, in der der Himmel noch hell ist;
  bürgerlich bis 6°, nautisch bis 12°, astronomisch bis 18° Sonnenstand unter dem Horizont.

*Die Modelle und Texte dieser Reihe sind mit großer Unterstützung von Claude Code entstanden, einem
KI-Werkzeug zum Programmieren. Wie diese Zusammenarbeit lief, was gut klappte und wo es hakte, beschreibt
ein eigener Beitrag.*

---

## Notizen

- Den Beitrag „Sternzeit und Erdposition“ beim Übertragen verlinken.
- Die Stichpunkte im Platzhalter erscheinen nur, wenn das Modell nicht lädt (Feed, E-Mail, ohne
  JavaScript).
- Ich-Form nur, wo es um eigenes Erleben geht; sonst vermeiden.

## Material aus der früheren Langfassung

**Wie schnell werden die Tage länger?** Die Tageslänge folgt über das Jahr ungefähr einer Sinuskurve: An
den Sonnenwenden ändert sie sich kaum („Sonnenstillstand“, Solstitium), um die Tagundnachtgleichen am
schnellsten – bei 50° N um bis zu 3,8 Minuten pro Tag, in Kiel um über 4 Minuten.

Feinheit: An den Tagundnachtgleichen ist der Tag nicht genau 12 Stunden lang, sondern etwa 12 h 10 min,
weil Auf- und Untergang am oberen Rand der Sonne gezählt werden und die Luft die Sonne am Horizont anhebt.
Genau 12 Stunden Tag hat man bei uns schon um den 17. März und erst wieder um den 26. September. (Die
Lichtbrechung ist aus der Reihe herausgenommen; nur als Hintergrund.)

**Dämmerung:** Die bürgerliche Dämmerung (bis 6° unter dem Horizont) dauert bei 50° N im März und
September etwa 32 Minuten, im Dezember etwa 38, im Juni etwa 44 Minuten – sie hängt vom Winkel ab, unter
dem die Sonnenbahn den Horizont schneidet. Im Juni sinkt die Sonne bei 50° N nicht einmal 18° unter den
Horizont; es gibt keine astronomische Nacht. Das gilt im Hochsommer für ganz Deutschland nördlich von etwa
48,6° N.
