/*
 * Beispiel: Stand der Sonne, Zeitgleichung, Sonnenauf- und -untergang.
 *
 * Übersetzen und aufrufen (im Ordner cpp/beispiele):
 *   g++ -std=c++11 -I.. sonne.cpp ../astro.cpp -o sonne && ./sonne
 */

#include "astro.h"

#include <cstdio>
#include <cstdlib>
#include <ctime>

using namespace astro;

// Uhrzeit [h UT] am UT-Tag von day in Ortszeit ausgeben (Zeitzone aus TZ)
static void printLocalTime(const char* label, const JulianDay day, const double hoursUT) {
    const time_t t = (day.midnight() + hoursUT / 24.0).toUnixTime();
    struct tm local;
    localtime_r(&t, &local);
    std::printf("%s: %02d:%02d\n", label, local.tm_hour, local.tm_min);
}

int main() {
    // Beobachtungsort: Länge (Ost positiv), Breite, Höhe über dem Meer [m], Zeitzone als POSIX-TZ-String
    const GeoLocation berlin = { 13.405_deg, 52.52_deg, 34.0, "CET-1CEST,M3.5.0,M10.5.0/3" };
    setenv("TZ", berlin.timezone, 1);
    tzset();

    // Zeitpunkt in UT; für die aktuelle Zeit: JulianDay::fromUnixTime(time(nullptr))
    const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 12.0);

    // Ekliptikale → äquatoriale → horizontale Koordinaten
    const Ecliptic sun = calculateSunPosition(jd);
    const Equatorial equ = calculateEquatorial(sun, calculateObliquity(jd));
    const Horizontal hor = calculateHorizontal(equ, calculateLocalSiderealTime(jd, berlin), berlin);

    // Das Azimut zählt astro.h von Süden über Westen; + 180° ergibt die Zählung von Norden über Osten
    std::printf("Höhe: %.2f°\n", hor.altitude.deg());
    std::printf("Azimut: %.2f° (von Nord)\n", (hor.azimuth + 180_deg).normalized().deg());
    std::printf("Rektaszension: %.4f h\n", equ.ra.normalized().hours());
    std::printf("Deklination: %.4f°\n", equ.dec.deg());
    std::printf("Entfernung: %.0f km\n", sun.distance);
    std::printf("Zeitgleichung: %.2f min\n", calculateEquationOfTime(jd, true));

    // Auf-, Untergang und Meridiandurchgang am UT-Tag von jd, Zeiten in Stunden UT
    const RiseTransitSet rts = calculateSunRiseSet(jd, berlin);
    if (rts.hasRise) printLocalTime("Sonnenaufgang", jd, rts.rise);
    printLocalTime("Höchster Stand", jd, rts.transit);
    if (rts.hasSet) printLocalTime("Sonnenuntergang", jd, rts.set);
    return 0;
}
