// Prüft calculateMoonRiseSet gegen eine direkte Referenz: Höhe und Stundenwinkel des Mondes mit
// calculateMoonPosition zu jedem Zeitpunkt, Raster 5 min, Nullstellen per Intervallhalbierung auf 0,01 s.
// Gemessen wird also nur der Fehler des Verfahrens (Interpolation, Suche), nicht der Mondtheorie.
//
//   g++ -std=c++11 -O2 -Wall -Wextra moon_riseset_check.cpp astro.cpp -o moon_riseset_check
//   ./moon_riseset_check [Breite] [Länge] [Tage] [Zeitzone]     (Standard: 50 10 730 1, ab 1.1.2025)

#include "astro.h"

#include <algorithm>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <vector>

using namespace astro;

namespace {

// Höhe über h0 [rad] wie in calculateMoonRiseSet, aber mit direkt berechneter Position
double altitudeAboveH0(const JulianDay jd, const GeoLocation& location, double* hourAngle) {
    const Ecliptic moon = calculateMoonPosition(jd);
    const Equatorial equ = calculateEquatorial(moon, calculateObliquity(jd));
    const SiderealTime theta = calculateLocalSiderealTime(jd, location);
    const Horizontal hor = calculateHorizontal(equ, theta, location);
    const Angle h0 = 0.7275 * Angle::asin(EARTH_RADIUS / moon.distance) - 0.5667_deg;
    if (hourAngle) *hourAngle = (theta - equ.ra).normalizedSigned().rad();
    return (hor.altitude - h0).rad();
}

struct Reference {
    double rise = -1, set = -1, transit = -1;   // [h seit Tagesbeginn], −1: kein Ereignis
};

Reference referenceDay(const JulianDay midnight, const GeoLocation& location) {
    Reference ref;
    const int steps = 288;
    const double tolerance = 0.01 / 3600.0;
    auto altitude = [&](const double h) { return altitudeAboveH0(midnight + h / 24.0, location, nullptr); };
    auto hourAngle = [&](const double h) { double H; altitudeAboveH0(midnight + h / 24.0, location, &H); return H; };

    double prevAlt = 0, prevH = 0;
    for (int i = 0; i <= steps; i++) {
        const double t = 24.0 * i / steps;
        double H;
        const double alt = altitudeAboveH0(midnight + t / 24.0, location, &H);
        if (i > 0) {
            if ((prevAlt < 0) != (alt < 0)) {
                const bool negativeAtA = prevAlt < 0;
                double a = t - 24.0 / steps, b = t;
                while (b - a > tolerance) {
                    const double m = 0.5 * (a + b);
                    ((altitude(m) < 0) == negativeAtA ? a : b) = m;
                }
                double& event = negativeAtA ? ref.rise : ref.set;
                if (event < 0) event = 0.5 * (a + b);
            }
            if (ref.transit < 0 && prevH < 0 && H >= 0 && std::fabs(prevH) < 1.5 && std::fabs(H) < 1.5) {
                double a = t - 24.0 / steps, b = t;
                while (b - a > tolerance) {
                    const double m = 0.5 * (a + b);
                    (hourAngle(m) < 0 ? a : b) = m;
                }
                ref.transit = 0.5 * (a + b);
            }
        }
        prevAlt = alt;
        prevH = H;
    }
    return ref;
}

struct Errors {
    std::vector<double> seconds;
    int mismatches = 0;     // Ereignis nur in einer der beiden Rechnungen

    void add(const bool has, const double value, const double reference) {
        if (has != (reference >= 0)) {
            mismatches++;
        } else if (has) {
            seconds.push_back(std::fabs(value - reference) * 3600.0);
        }
    }

    void print(const char* name) {
        std::sort(seconds.begin(), seconds.end());
        double sum = 0;
        for (const double s : seconds) sum += s * s;
        const size_t n = seconds.size();
        std::printf("%-10s %5zu   %6.2f s   %6.2f s   %6.2f s   %d\n", name, n,
                    n ? std::sqrt(sum / n) : 0.0, n ? seconds[n * 99 / 100] : 0.0, n ? seconds.back() : 0.0,
                    mismatches);
    }
};

} // namespace

int main(int argc, char** argv) {
    const double lat = argc > 1 ? std::atof(argv[1]) : 50.0;
    const double lon = argc > 2 ? std::atof(argv[2]) : 10.0;
    const int days = argc > 3 ? std::atoi(argv[3]) : 730;
    const double utcOffset = argc > 4 ? std::atof(argv[4]) : 1.0;
    const GeoLocation location = { Angle::fromDeg(lon), Angle::fromDeg(lat), 0.0, "" };
    const JulianDay start = JulianDay::fromCalendar(2025, 1, 1, 0.0, Calendar::Gregorian);

    Errors rise, set, transit;
    for (int d = 0; d < days; d++) {
        const JulianDay midnight = start + d - utcOffset / 24.0;
        const RiseTransitSet r = calculateMoonRiseSet(midnight + 0.5, location, utcOffset);
        const Reference ref = referenceDay(midnight, location);
        rise.add(r.hasRise, r.rise, ref.rise);
        set.add(r.hasSet, r.set, ref.set);
        transit.add(r.hasTransit, r.transit, ref.transit);
    }

    std::printf("Breite %.2f°, Länge %.2f°, Zeitzone %+.1f h, %d Tage ab 1.1.2025\n\n", lat, lon, utcOffset, days);
    std::printf("Ereignis   Anzahl   RMS        99 %%       Maximum    abweichend\n");
    rise.print("Aufgang");
    set.print("Untergang");
    transit.print("Durchgang");
    return 0;
}
