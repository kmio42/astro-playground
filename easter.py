#!/usr/bin/env python3
import matplotlib.pyplot as plt

def berechne_ostern(y):
    a = y % 19
    b = y // 100
    c = y % 100
    d = b // 4
    e = b % 4
    f = (b + 8) // 25
    g = (b - f + 1) // 3
    h = (19 * a + b - d - g + 15) % 30
    i = c // 4
    k = c % 4
    l = (32 + 2 * e + 2 * i - h - k) % 7
    m = (a + 11 * h + 22 * l) // 451
    n = h + l - 7 * m + 114
    monat = n // 31
    tag = (n % 31) + 1

    return monat, tag

# Tag seit dem 1. März berechnen
def tag_seit_1_maerz(monat, tag):
    if monat == 3:
        return tag
    elif monat == 4:
        return 31 + tag  # März hat 31 Tage
    else:
        raise ValueError("Ostern liegt nicht in diesem Monat!")

# Daten berechnen
jahre = list(range(1600, 2201))
tage = []

for y in jahre:
    monat, tag = berechne_ostern(y)
    tage.append(tag_seit_1_maerz(monat, tag))

# Histogramm
plt.figure()
plt.hist(tage, bins=range(min(tage), max(tage) + 2))
plt.xlabel("Tag seit 1. März")
plt.ylabel("Häufigkeit")
plt.title("Histogramm der Osterdaten (1600–2200)")
plt.grid()

# Zeitreihe (Jahr vs. Tag seit 1. März)
plt.figure()
plt.plot(jahre, tage)
plt.xlabel("Jahr")
plt.ylabel("Tag seit 1. März")
plt.title("Osterdatum als Funktion des Jahres (1600–2200)")
plt.grid()

plt.show()
