# Der Mond

<!-- Beitrag 6, vermutlich mehrere Beiträge. Gliederung, noch kein Text. -->

## Mögliche Beiträge

1. **Warum steht der Vollmond im Winter hoch und im Sommer tief?**
   Der Vollmond steht der Sonne gegenüber – im Winter also dort, wo die Sonne im Sommer steht.
   Modell: `erdemond` mit `data-tour="height"` („Wie hoch steht der Mond?“).
2. **Warum gibt es nicht bei jedem Vollmond eine Mondfinsternis?**
   Die Mondbahn ist um 5° gegen die Ekliptik geneigt; Finsternisse nur nahe den Knoten.
   Modell: `erdemond` mit `data-tour="nodes"` („Knoten und Finsternisse“), z. B. Schritt 4:
   Mondfinsternis am 3. März 2026.
3. **Supermond: Wie viel größer ist der Mond in Erdnähe?**
   Modell: `erdemond` mit `data-tour="apsides"` („Apsiden: erdnah und erdfern“).
4. **Mondphasen und Libration:** Warum sehen wir immer dieselbe Seite – und doch etwas mehr als die Hälfte?
   Modell: `mond` (Phase mit Libration und Neigung), eventuell `erdemond` mit Ansicht `earthToMoon`.
5. **Die Mondbahn um die Sonne:** Macht der Mond Schleifen? (Nein, seine Bahn ist immer zur Sonne hin
   gekrümmt.) Modell: `mondbahn` mit `data-ansicht="earth"`.

## Notizen

- Reihenfolge offen; 1 schließt gut an Beitrag 3 bis 5 an (Deklination, Ekliptik).
- `erdemond` lädt 3,6 MB (mobil 1,7 MB) und zeigt erst ein Vorschaubild; pro Beitrag möglichst nur ein
  solches Modell.
