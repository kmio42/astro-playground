/*
 * Beispiel: Stand und Phase des Mondes, Libration, Mondauf- und -untergang.
 *
 * Übersetzen und aufrufen (im Ordner cpp/beispiele):
 *   g++ -std=c++11 -I.. mond.cpp ../astro.cpp -o mond && ./mond
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
    std::printf("%s: %02d.%02d. %02d:%02d\n", label, local.tm_mday, local.tm_mon + 1, local.tm_hour, local.tm_min);
}

int main() {
    const GeoLocation berlin = { 13.405_deg, 52.52_deg, 34.0, "CET-1CEST,M3.5.0,M10.5.0/3" };
    setenv("TZ", berlin.timezone, 1);
    tzset();

    const JulianDay jd = JulianDay::fromCalendar(2026, 10, 25, 20.0);     // 21:00 MEZ
    const Angle eps = calculateObliquity(jd);
    const SiderealTime theta = calculateLocalSiderealTime(jd, berlin);

    // Geozentrische Position
    const Ecliptic moon = calculateMoonPosition(jd);
    const Equatorial moonEqu = calculateEquatorial(moon, eps);

    // Für den Anblick vom Beobachtungsort die Parallaxe berücksichtigen (beim Mond bis zu 1°)
    const Angle parallax = Angle::asin(EARTH_RADIUS / moon.distance);
    const Equatorial topo = calculateTopocentric(moonEqu, parallax, theta, berlin);
    const Horizontal hor = calculateHorizontal(topo, theta, berlin);
    std::printf("Höhe: %.2f°\n", hor.altitude.deg());
    std::printf("Azimut: %.2f° (von Nord)\n", (hor.azimuth + 180_deg).normalized().deg());
    std::printf("Entfernung: %.0f km\n", moon.distance);

    // Phase: beleuchteter Teil der Scheibe; zunehmend, solange der Mond der Sonne
    // in ekliptikaler Länge um weniger als 180° voraus ist
    const Ecliptic sun = calculateSunPosition(jd);
    const double k = calculateMoonIlluminatedFraction(calculateEquatorial(sun, eps), sun.distance,
                                                      moonEqu, moon.distance);
    const bool waxing = (moon.longitude - sun.longitude).normalized() < 180_deg;
    std::printf("Beleuchtet: %.1f %% (%s)\n", k * 100.0, waxing ? "zunehmend" : "abnehmend");

    // Libration und Positionswinkel der Mondachse
    const MoonOrientation o = calculateMoonOrientation(jd, moon);
    std::printf("Libration: Länge %+.2f°, Breite %+.2f°\n", o.libration.longitude.deg(), o.libration.latitude.deg());
    std::printf("Positionswinkel: %.2f°\n", o.positionAngle.normalized().deg());

    // Auf- und Untergang am UT-Tag von jd. Der UT-Tag beginnt in Berlin um 1:00 (MEZ) bzw. 2:00 (MESZ);
    // ein Ereignis kurz nach Mitternacht Ortszeit gehört also zum vorigen UT-Tag.
    const RiseTransitSet rts = calculateMoonRiseSet(jd, berlin);
    if (rts.hasRise) printLocalTime("Mondaufgang", jd, rts.rise);
    if (rts.hasTransit) printLocalTime("Meridian", jd, rts.transit);
    if (rts.hasSet) printLocalTime("Monduntergang", jd, rts.set);
    if (!rts.hasRise && !rts.hasSet) std::printf("Kein Auf- oder Untergang an diesem UT-Tag\n");
    return 0;
}
