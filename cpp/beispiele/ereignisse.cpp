/*
 * Beispiel: Zeitskalen (UT, TD, ΔT) und Zeitpunkte von Ereignissen:
 * Jahreszeiten, Ostersonntag, Perihel der Erde, Perigäum und Apogäum des Mondes, Knotendurchgang.
 *
 * Übersetzen und aufrufen (im Ordner cpp/beispiele):
 *   g++ -std=c++11 -I.. ereignisse.cpp ../astro.cpp -o ereignisse && ./ereignisse
 */

#include "astro.h"

#include <cstdio>
#include <cstdlib>
#include <ctime>

using namespace astro;

// Zeitpunkt in Ortszeit ausgeben (Zeitzone aus TZ)
static void printLocal(const char* label, const JulianDay jd) {
    const time_t t = jd.toUnixTime();
    struct tm local;
    localtime_r(&t, &local);
    char text[40];
    strftime(text, sizeof text, "%d.%m.%Y %H:%M %Z", &local);
    std::printf("%s: %s\n", label, text);
}

int main() {
    setenv("TZ", "CET-1CEST,M3.5.0,M10.5.0/3", 1);
    tzset();

    // Zeitskalen: JulianDay speichert UT, ΔT kommt aus der Tabelle der Schaltsekunden
    const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 12.0);
    std::printf("JD (UT): %.6f\n", jd.value());
    std::printf("JDE (TD): %.6f\n", jd.dynamicalTime());
    std::printf("ΔT = TD − UT: %.3f s\n", jd.deltaT());
    std::printf("TAI − UTC: %.0f s\n", jd.taiMinusUtc());
    std::printf("ΔT am 1.1.1980: %.3f s\n\n", JulianDay::fromCalendar(1980, 1, 1, 0.0).deltaT());

    // Jahreszeiten; die Ergebnisse sind bereits von TD nach UT umgerechnet
    printLocal("Frühlingsanfang 2027", calculateEquinoxSolstice(2027, EquinoxType::Spring));
    printLocal("Sommeranfang 2027", calculateEquinoxSolstice(2027, EquinoxType::Summer));
    printLocal("Herbstanfang 2027", calculateEquinoxSolstice(2027, EquinoxType::Autumn));
    printLocal("Winteranfang 2027", calculateEquinoxSolstice(2027, EquinoxType::Winter));

    // Ostersonntag: ein Kalenderdatum ohne Uhrzeit
    const CalendarDate easter = calculateEaster(2027);
    std::printf("Ostersonntag 2027: %02d.%02d.%d\n", easter.day, easter.month, easter.year);

    // Nächste Ereignisse nach jd
    const Apsis perihelion = calculateNextEarthApsis(jd, ApsisType::Periapsis);
    printLocal("Perihel der Erde", perihelion.time);
    std::printf("  Entfernung: %.0f km\n", perihelion.distance);

    const Apsis perigee = calculateNextMoonApsis(jd, ApsisType::Periapsis);
    printLocal("Perigäum des Mondes", perigee.time);
    std::printf("  Entfernung: %.0f km\n", perigee.distance);

    const Apsis apogee = calculateNextMoonApsis(jd, ApsisType::Apoapsis);
    printLocal("Apogäum des Mondes", apogee.time);
    std::printf("  Entfernung: %.0f km\n", apogee.distance);

    const NodePassage node = calculateNextMoonNode(jd);
    printLocal(node.ascending ? "Aufsteigender Knoten" : "Absteigender Knoten", node.time);
    return 0;
}
