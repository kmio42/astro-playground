/*
 * Testbench für die Genauigkeit der Mondberechnungen in astro.cpp.
 *
 * Verglichen werden
 *  - calculateMoonPosition ("normal") und calculateMoonPositionSimple ("simple"), direkt berechnet,
 *  - die Parabelnäherung wie in calculateMoonRiseSet: Stützstellen im Abstand h ab 0h UT, für das
 *    Intervall [k·h, (k+1)·h] die Parabel durch k, k+1, k+2. Interpoliert wird
 *      a) die Höhe über h0 (wie calculateMoonRiseSet),
 *      b) zum Vergleich Rektaszension, Deklination und Entfernung, die Höhe daraus berechnet,
 *    jeweils mit normal und simple und den Schrittweiten 1, 2, 4, 6, 12, 24, 36, 48 h,
 *  - eine stündliche RA/Dec-Tabelle über den ganzen Zeitraum (wie die mooninfo-Dateien), interpoliert aus
 *    calculateMoonPosition an Stützstellen im festen Raster: Parabel vorwärts (wie calculateMoonRiseSet),
 *    Parabel zentriert (interpolate, Formel 3.3) und Polynom dritten Grades.
 *
 * Referenz sind die stündlichen Ephemeriden der NASA (Dial-a-Moon, mooninfo_YYYY.txt). Deren RA/Dec
 * beziehen sich auf J2000 und werden mit der strengen Präzession (Meeus, Kapitel 21, Formeln 21.2–21.4)
 * auf das mittlere Äquinoktium des Datums gebracht. Zwischen den vollen Stunden wird die Referenz mit
 * einem Polynom dritten Grades (4 Stützstellen) interpoliert; der Fehler dieser Interpolation liegt
 * weit unter 0.01″.
 * Ausgewertet wird alle 10 Minuten. Zusätzlich wird gegen calculateMoonPosition direkt verglichen,
 * damit der reine Interpolationsfehler sichtbar wird.
 *
 * Übersetzen und aufrufen:
 *   g++ -std=c++11 -O2 -Wall -Wextra moon_testbench.cpp astro.cpp -o moon_testbench
 *   ./moon_testbench [--lat 50] [--lon 10] [--deltat 0] [mooninfo_2025.txt mooninfo_2026.txt]
 *
 * --deltat: ΔT = TD − UT [s] fest vorgeben. Ohne Angabe gilt ΔT aus astro.cpp (JulianDay::deltaT);
 * --deltat 0 entspricht dem früheren Stand von astro.cpp mit TD = UT.
 */

#include "astro.h"

#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <functional>
#include <iostream>
#include <memory>
#include <sstream>
#include <string>
#include <vector>

using namespace astro;

namespace {

// Polynom c0 + x·(c1 + x·(c2 + x·c3)), wie horner in astro.cpp
double horner(const double x, const double c0, const double c1, const double c2, const double c3) {
    return c0 + x * (c1 + x * (c2 + x * c3));
}

// ---------------------------------------------------------------
//  Referenzdaten der NASA
// ---------------------------------------------------------------

struct ReferenceRow {
    double ra;          // Rektaszension J2000 [rad], stetig fortgesetzt (ohne Sprung bei 2π)
    double dec;         // Deklination J2000 [rad]
    double distance;    // Entfernung [km]
};

struct ReferenceTable {
    JulianDay start;                    // Zeitpunkt der ersten Zeile (UT)
    std::vector<ReferenceRow> rows;     // stündlich
};

int monthFromName(const std::string& name) {
    static const char* const NAMES[] = { "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                         "Jul", "Aug", "Sep", "Oct", "Nov", "Dec" };
    for (int i = 0; i < 12; i++) {
        if (name == NAMES[i]) return i + 1;
    }
    return 0;
}

// Liest die Dateien nacheinander ein; die Zeilen müssen lückenlos stündlich aufeinander folgen
bool readReference(const std::vector<std::string>& paths, ReferenceTable& table) {
    for (const std::string& path : paths) {
        std::ifstream in(path);
        if (!in) {
            std::cerr << "Datei nicht lesbar: " << path << "\n";
            return false;
        }
        std::string line;
        while (std::getline(in, line)) {
            std::istringstream s(line);
            int day, hh, mm, year;
            std::string monthName, ut;
            char colon;
            double phase, age, diam, dist, raHours, decDeg;
            if (!(s >> day >> monthName >> year >> hh >> colon >> mm >> ut
                    >> phase >> age >> diam >> dist >> raHours >> decDeg)) {
                continue;   // Kopfzeile
            }
            const JulianDay jd = JulianDay::fromCalendar(year, monthFromName(monthName), day, hh + mm / 60.0);
            if (table.rows.empty()) {
                table.start = jd;
            } else if (std::fabs((jd - table.start) * 24.0 - table.rows.size()) > 1e-6) {
                std::cerr << path << ": Zeitpunkt nicht im Stundenraster: " << line << "\n";
                return false;
            }
            double ra = Angle::fromHours(raHours).rad();
            if (!table.rows.empty()) {
                ra = table.rows.back().ra + Angle::fromRad(ra - table.rows.back().ra).normalizedSigned().rad();
            }
            table.rows.push_back({ ra, Angle::fromDeg(decDeg).rad(), dist });
        }
    }
    if (table.rows.size() < 72) {
        std::cerr << "Zu wenige Referenzdaten\n";
        return false;
    }
    return true;
}

// Strenge Präzession vom Äquinoktium J2000 auf das mittlere Äquinoktium von jd, Formeln 21.2–21.4
Equatorial precessFromJ2000(const double ra0, const double dec0, const JulianDay jd) {
    const double t = jd.centuries();
    const Angle zeta  = Angle::fromArcsec(horner(t, 0.0, 2306.2181, 0.30188, 0.017998));
    const Angle z     = Angle::fromArcsec(horner(t, 0.0, 2306.2181, 1.09468, 0.018203));
    const Angle theta = Angle::fromArcsec(horner(t, 0.0, 2004.3109, -0.42665, -0.041833));

    const Angle a = Angle::fromRad(ra0) + zeta;
    const double A = std::cos(dec0) * sin(a);
    const double B = cos(theta) * std::cos(dec0) * cos(a) - sin(theta) * std::sin(dec0);
    const double C = sin(theta) * std::cos(dec0) * cos(a) + cos(theta) * std::sin(dec0);
    return { (Angle::atan2(A, B) + z).normalized(), Angle::asin(C) };
}

// ---------------------------------------------------------------
//  Mondposition zu einem Zeitpunkt
// ---------------------------------------------------------------

// Geozentrische Position, bezogen auf das mittlere Äquinoktium des Datums
struct MoonState {
    Equatorial equ;
    double distance;    // [km]
};

// Referenz zum Zeitpunkt jd (UT): Polynom dritten Grades durch die vier umgebenden Stunden
MoonState referenceAt(const ReferenceTable& table, const JulianDay jd) {
    const double x = (jd - table.start) * 24.0;
    const long i = std::min(std::max(static_cast<long>(std::floor(x)) - 1, 0L), static_cast<long>(table.rows.size()) - 4);
    const double u = x - i;     // Stützstellen bei u = 0, 1, 2, 3

    double w[4];
    for (int j = 0; j < 4; j++) {
        w[j] = 1.0;
        for (int m = 0; m < 4; m++) {
            if (m != j) w[j] *= (u - m) / (j - m);
        }
    }
    ReferenceRow r = { 0, 0, 0 };
    for (int j = 0; j < 4; j++) {
        r.ra += w[j] * table.rows[i + j].ra;
        r.dec += w[j] * table.rows[i + j].dec;
        r.distance += w[j] * table.rows[i + j].distance;
    }
    return { precessFromJ2000(r.ra, r.dec, jd), r.distance };
}

using PositionFunction = Ecliptic (*)(JulianDay);

bool fixedDeltaT = false;   // true: ΔT nach --deltat statt aus astro.cpp
double deltaT = 0.0;        // fest vorgegebenes ΔT = TD − UT [d]

// Position nach astro.cpp zum Zeitpunkt jd (UT)
MoonState modelAt(const PositionFunction position, const JulianDay jd) {
    // Mit --deltat den Zeitpunkt so wählen, dass astro.cpp in TD bei jd + ΔT rechnet
    const JulianDay t = fixedDeltaT ? JulianDay::fromDynamicalTime(jd.value() + deltaT) : jd;
    const Ecliptic moon = position(t);
    return { calculateEquatorial(moon, calculateObliquity(t)), moon.distance };
}

// Höhe über der Standardhöhe h0 wie in calculateMoonRiseSet [rad]
double altitudeAboveH0(const MoonState& moon, const JulianDay jd, const GeoLocation& location) {
    const Horizontal hor = calculateHorizontal(moon.equ, calculateLocalSiderealTime(jd, location), location);
    const Angle parallax = Angle::asin(EARTH_RADIUS / moon.distance);
    const Angle h0 = 0.7275 * parallax - 0.5667_deg;
    return (hor.altitude - h0).rad();
}

// Parabel durch (0, y0), (1, y1), (2, y2) an der Stelle u, wie in calculateMoonRiseSet
double parabola(const double y0, const double y1, const double y2, const double u) {
    const double A = 0.5 * (y0 - 2.0 * y1 + y2);
    const double B = 0.5 * (-3.0 * y0 + 4.0 * y1 - y2);
    return y0 + u * (B + u * A);
}

// ---------------------------------------------------------------
//  Fehlerstatistik
// ---------------------------------------------------------------

struct ErrorStats {
    double sumSquares = 0.0;
    double maxAbs = 0.0;
    long count = 0;

    void add(const double error) {
        sumSquares += error * error;
        maxAbs = std::max(maxAbs, std::fabs(error));
        count++;
    }
    double rms() const { return count ? std::sqrt(sumSquares / count) : 0.0; }
};

// Fehler eines Verfahrens gegen eine Referenz; Winkel in Bogenminuten, Entfernung in km
struct MethodStats {
    std::string name;
    bool hasPosition = true;    // false: nur die Höhe wird interpoliert
    bool hasDistance = true;    // false: Entfernung ist konstant (simple)
    bool hasAltitude = true;    // false: Höhe nicht ausgewertet (Stundentabelle)
    ErrorStats separation, ra, dec, altitude, distance;

    void add(const MoonState& m, const double alt, const MoonState& ref, const double refAlt) {
        if (hasPosition) {
            const double cosSep = std::sin(ref.equ.dec.rad()) * std::sin(m.equ.dec.rad())
                                + std::cos(ref.equ.dec.rad()) * std::cos(m.equ.dec.rad()) * cos(m.equ.ra - ref.equ.ra);
            separation.add(Angle::acos(std::min(1.0, cosSep)).deg() * 60.0);
            ra.add((m.equ.ra - ref.equ.ra).normalizedSigned().deg() * 60.0 * cos(ref.equ.dec));
            dec.add((m.equ.dec - ref.equ.dec).deg() * 60.0);
        }
        if (hasPosition && hasDistance) {
            distance.add(m.distance - ref.distance);
        }
        if (hasAltitude) {
            altitude.add(Angle::fromRad(alt - refAlt).deg() * 60.0);
        }
    }
};

// Ein zu prüfendes Verfahren: liefert Position (falls vorhanden) und Höhe über h0 für einen Zeitpunkt.
// hours: Stunden seit 0h UT des Tages day.
struct Method {
    MethodStats stats;          // gegen NASA
    MethodStats statsMeeus;     // gegen calculateMoonPosition direkt
    std::function<void(JulianDay day, double hours, MoonState& state, double& altitude)> evaluate;
    std::function<void(JulianDay day)> beginDay;    // Stützstellen für den Tag berechnen
};

// ---------------------------------------------------------------
//  Ausgabe
// ---------------------------------------------------------------

void printCell(const ErrorStats& e, const bool present, const int precision) {
    if (present) {
        std::printf(" %8.*f %8.*f", precision, e.rms(), precision, e.maxAbs);
    } else {
        std::printf(" %8s %8s", "–", "–");
    }
}

void printStats(const MethodStats& s) {
    std::printf("%-30s", s.name.c_str());
    printCell(s.separation, s.hasPosition, 3);
    printCell(s.ra, s.hasPosition, 3);
    printCell(s.dec, s.hasPosition, 3);
    printCell(s.altitude, s.hasAltitude, 3);
    printCell(s.distance, s.hasPosition && s.hasDistance, 1);
    std::printf("\n");
}

void printHeader(const char* title) {
    std::printf("\n%s\n", title);
    std::printf("%-30s %17s %17s %17s %17s %17s\n", "",
                "Winkelabstand [′]", "ΔRA·cosδ [′]", "ΔDec [′]", "Δ(h−h0) [′]", "ΔEntfernung [km]");
    std::printf("%-30s", "Verfahren");
    for (int i = 0; i < 5; i++) std::printf(" %8s %8s", "RMS", "max");
    std::printf("\n");
}

void printTable(const char* title, const std::vector<Method>& methods, MethodStats Method::* which) {
    printHeader(title);
    for (const Method& m : methods) {
        printStats(m.*which);
    }
}

// ---------------------------------------------------------------
//  Stundentabelle: RA/Dec für jede volle Stunde aus Stützstellen im festen Raster
// ---------------------------------------------------------------

enum class Scheme {
    Forward,    // Parabel durch k, k+1, k+2 für [k, k+1], wie calculateMoonRiseSet
    Central,    // Parabel durch die nächste Stützstelle und ihre Nachbarn, interpolate (Formel 3.3)
    Cubic,      // Polynom dritten Grades durch k−1 … k+2 für [k, k+1]
};

const char* schemeName(const Scheme scheme) {
    switch (scheme) {
        case Scheme::Forward: return "vorwärts";
        case Scheme::Central: return "zentriert";
        case Scheme::Cubic:   return "kubisch";
    }
    return "";
}

// Stützstellenwerte y im Abstand 1, Wert an der Stelle x (in Schritten)
double interpolateNodes(const std::vector<double>& y, const Scheme scheme, const double x) {
    switch (scheme) {
        case Scheme::Forward: {
            const long k = static_cast<long>(std::floor(x));
            return parabola(y[k], y[k + 1], y[k + 2], x - k);
        }
        case Scheme::Central: {
            const long k = std::lround(x);
            return interpolate(y[k - 1], y[k], y[k + 1], x - k);
        }
        case Scheme::Cubic: {
            const long k = static_cast<long>(std::floor(x));
            const double u = x - k;
            // Lagrange-Gewichte für die Stützstellen bei −1, 0, 1, 2
            return y[k - 1] * (-u * (u - 1) * (u - 2) / 6)
                 + y[k]     * ((u + 1) * (u - 1) * (u - 2) / 2)
                 + y[k + 1] * (-(u + 1) * u * (u - 2) / 2)
                 + y[k + 2] * ((u + 1) * u * (u - 1) / 6);
        }
    }
    return 0.0;
}

// Stündliche RA/Dec-Tabelle über den ganzen Zeitraum der Referenzdaten, verglichen an den vollen Stunden
void evaluateHourlyTable(const ReferenceTable& table, const std::vector<int>& steps) {
    const long hours = static_cast<long>(table.rows.size());
    const int maxStep = *std::max_element(steps.begin(), steps.end());
    const long first = maxStep;                 // Stützstelle k−1 vorhanden
    const long last = hours - 1 - 2 * maxStep;  // Stützstelle k+2 vorhanden

    // Referenz und direkte Rechnung zu jeder vollen Stunde
    std::vector<MoonState> reference(hours), meeus(hours);
    for (long i = 0; i < hours; i++) {
        const JulianDay jd = table.start + i / 24.0;
        reference[i] = { precessFromJ2000(table.rows[i].ra, table.rows[i].dec, jd),
                         table.rows[i].distance };
        meeus[i] = modelAt(calculateMoonPosition, jd);
    }

    // Laufzeit je Aufruf [µs], Mittel über alle Stunden; die Prüfsumme verhindert, dass der Compiler
    // die Aufrufe weglässt
    double checksum = 0.0;
    auto microsPerCall = [&](const PositionFunction position) {
        const auto t0 = std::chrono::steady_clock::now();
        for (long i = 0; i < hours; i++) {
            checksum += position(table.start + i / 24.0).longitude.rad();
        }
        return std::chrono::duration<double, std::micro>(std::chrono::steady_clock::now() - t0).count() / hours;
    };
    // Erwärmen (Cache, Taktfrequenz), dann messen
    microsPerCall(calculateMoonPosition);
    const double microsNormal = microsPerCall(calculateMoonPosition);
    const double microsSimple = microsPerCall(calculateMoonPositionSimple);

    std::printf("\nStündliche RA/Dec-Tabelle aus Stützstellen im festen Raster, %ld volle Stunden.\n",
                last - first + 1);
    std::printf("Laufzeit je Aufruf auf diesem Rechner: calculateMoonPosition %.2f µs, "
                "calculateMoonPositionSimple %.2f µs (Prüfsumme %.3f)\n",
                microsNormal, microsSimple, checksum / hours);
    std::printf("Aufrufe je Jahr: 8760 / Schrittweite\n");

    std::vector<std::pair<MethodStats, MethodStats>> results;   // gegen NASA, gegen Meeus direkt
    {
        MethodStats direct;
        direct.name = "normal direkt";
        direct.hasAltitude = false;
        MethodStats directMeeus = direct;
        for (long i = first; i <= last; i++) {
            direct.add(meeus[i], 0, reference[i], 0);
            directMeeus.add(meeus[i], 0, meeus[i], 0);
        }
        results.push_back({ direct, directMeeus });

        MethodStats simple;
        simple.name = "simple direkt";
        simple.hasAltitude = false;
        simple.hasDistance = false;
        MethodStats simpleMeeus = simple;
        for (long i = first; i <= last; i++) {
            const MoonState state = modelAt(calculateMoonPositionSimple, table.start + i / 24.0);
            simple.add(state, 0, reference[i], 0);
            simpleMeeus.add(state, 0, meeus[i], 0);
        }
        results.push_back({ simple, simpleMeeus });
    }
    for (const Scheme scheme : { Scheme::Forward, Scheme::Central, Scheme::Cubic }) {
        for (const int step : steps) {
            // Stützstellen bei 0, step, 2·step, … Stunden; RA stetig fortgesetzt
            std::vector<double> ra, dec, distance;
            for (long i = 0; i < hours; i += step) {
                const MoonState& s = meeus[i];
                ra.push_back(ra.empty() ? s.equ.ra.rad()
                                        : ra.back() + Angle::fromRad(s.equ.ra.rad() - ra.back()).normalizedSigned().rad());
                dec.push_back(s.equ.dec.rad());
                distance.push_back(s.distance);
            }

            MethodStats stats;
            char name[64];
            std::snprintf(name, sizeof name, "normal %-9s %2d h", schemeName(scheme), step);
            stats.name = name;
            stats.hasAltitude = false;
            MethodStats statsMeeus = stats;
            for (long i = first; i <= last; i++) {
                const double x = static_cast<double>(i) / step;
                const MoonState state = {
                    { Angle::fromRad(interpolateNodes(ra, scheme, x)).normalized(),
                             Angle::fromRad(interpolateNodes(dec, scheme, x)) },
                    interpolateNodes(distance, scheme, x),
                };
                stats.add(state, 0, reference[i], 0);
                statsMeeus.add(state, 0, meeus[i], 0);
            }
            results.push_back({ stats, statsMeeus });
        }
    }

    printHeader("Stundentabelle gegen NASA-Ephemeride (mooninfo):");
    for (const auto& r : results) printStats(r.first);
    printHeader("Stundentabelle gegen calculateMoonPosition direkt (reiner Interpolationsfehler):");
    for (const auto& r : results) printStats(r.second);
}

} // namespace

int main(int argc, char** argv) {
    GeoLocation location = { 10.0_deg, 50.0_deg, 0.0, "UTC0" };
    std::vector<std::string> files;
    for (int i = 1; i < argc; i++) {
        const bool hasValue = i + 1 < argc;
        if (!std::strcmp(argv[i], "--lat") && hasValue) {
            location.latitude = Angle::fromDeg(std::atof(argv[++i]));
        } else if (!std::strcmp(argv[i], "--lon") && hasValue) {
            location.longitude = Angle::fromDeg(std::atof(argv[++i]));
        } else if (!std::strcmp(argv[i], "--deltat") && hasValue) {
            deltaT = std::atof(argv[++i]) / 86400.0;
            fixedDeltaT = true;
        } else if (argv[i][0] == '-') {
            std::cerr << "Aufruf: " << argv[0] << " [--lat Grad] [--lon Grad Ost] [--deltat s] [mooninfo...]\n";
            return 1;
        } else {
            files.push_back(argv[i]);
        }
    }
    if (files.empty()) {
        files = { "mooninfo_2025.txt", "mooninfo_2026.txt" };
    }

    ReferenceTable table;
    if (!readReference(files, table)) {
        return 1;
    }

    constexpr int STEPS[] = { 1, 2, 4, 6, 12, 24, 36, 48 };   // Schrittweiten der Parabelnäherung [h]
    constexpr double EVALUATION_STEP = 10.0 / 60.0;   // Abstand der Prüfzeitpunkte [h]

    struct Variant {
        const char* name;
        PositionFunction position;
    };
    const Variant variants[] = { { "normal", calculateMoonPosition }, { "simple", calculateMoonPositionSimple } };

    std::vector<Method> methods;

    // Direkte Berechnung
    for (const Variant& v : variants) {
        Method m;
        m.stats.name = std::string(v.name) + " direkt";
        m.stats.hasDistance = v.position == calculateMoonPosition;
        m.beginDay = [](JulianDay) {};
        m.evaluate = [v, &location](const JulianDay day, const double hours, MoonState& state, double& altitude) {
            const JulianDay jd = day + hours / 24.0;
            state = modelAt(v.position, jd);
            altitude = altitudeAboveH0(state, jd, location);
        };
        methods.push_back(m);
    }

    // Parabelnäherung. Die Stützstellen eines Tages liegen bei 0, h, 2h, …; die letzte Parabel
    // beginnt im Intervall, das 24h enthält, und reicht zwei Schritte weiter.
    auto lastNode = [](const int step) { return (24 + step - 1) / step + 1; };
    struct Nodes {
        std::vector<MoonState> states;
        std::vector<double> altitudes;
    };
    for (const bool interpolatePosition : { false, true }) {
        for (const Variant& v : variants) {
            for (const int step : STEPS) {
                auto nodes = std::make_shared<Nodes>();

                Method m;
                char name[64];
                std::snprintf(name, sizeof name, "%s %s %2d h", v.name,
                              interpolatePosition ? "RA/Dec-Parabel" : "Höhen-Parabel ", step);
                m.stats.name = name;
                m.stats.hasPosition = interpolatePosition;
                m.stats.hasDistance = v.position == calculateMoonPosition;
                m.beginDay = [v, step, nodes, &location, lastNode](const JulianDay day) {
                    nodes->states.clear();
                    nodes->altitudes.clear();
                    for (int k = 0; k <= lastNode(step); k++) {
                        const JulianDay jd = day + k * step / 24.0;
                        const MoonState s = modelAt(v.position, jd);
                        nodes->states.push_back(s);
                        nodes->altitudes.push_back(altitudeAboveH0(s, jd, location));
                    }
                };
                m.evaluate = [step, nodes, interpolatePosition, &location](const JulianDay day, const double hours,
                                                                           MoonState& state, double& altitude) {
                    const int k = static_cast<int>(hours / step);
                    const double u = hours / step - k;
                    if (!interpolatePosition) {
                        const std::vector<double>& a = nodes->altitudes;
                        altitude = parabola(a[k], a[k + 1], a[k + 2], u);
                        return;
                    }
                    const MoonState& s0 = nodes->states[k];
                    const MoonState& s1 = nodes->states[k + 1];
                    const MoonState& s2 = nodes->states[k + 2];
                    // RA relativ zur ersten Stützstelle stetig fortsetzen
                    const double ra0 = s0.equ.ra.rad();
                    const double ra1 = ra0 + (s1.equ.ra - s0.equ.ra).normalizedSigned().rad();
                    const double ra2 = ra1 + (s2.equ.ra - s1.equ.ra).normalizedSigned().rad();
                    state.equ.ra = Angle::fromRad(parabola(ra0, ra1, ra2, u)).normalized();
                    state.equ.dec = Angle::fromRad(parabola(s0.equ.dec.rad(), s1.equ.dec.rad(), s2.equ.dec.rad(), u));
                    state.distance = parabola(s0.distance, s1.distance, s2.distance, u);
                    altitude = altitudeAboveH0(state, day + hours / 24.0, location);
                };
                methods.push_back(m);
            }
        }
    }
    for (Method& m : methods) {
        m.statsMeeus = m.stats;
    }

    // Ausgewertet werden ganze UT-Tage, deren Stützstellen in den Referenzdaten liegen
    int lastNodeHours = 0;
    for (const int step : STEPS) {
        lastNodeHours = std::max(lastNodeHours, lastNode(step) * step);
    }
    const JulianDay firstDay = (table.start + 1.0).midnight();
    const JulianDay end = table.start + (table.rows.size() - 1) / 24.0;
    long days = 0;
    for (JulianDay day = firstDay; day + lastNodeHours / 24.0 <= end; day = day + 1.0, days++) {
        for (Method& m : methods) {
            m.beginDay(day);
        }
        for (double hours = 0.0; hours < 24.0 - 1e-9; hours += EVALUATION_STEP) {
            const JulianDay jd = day + hours / 24.0;
            const MoonState ref = referenceAt(table, jd);
            const double refAlt = altitudeAboveH0(ref, jd, location);
            const MoonState meeus = modelAt(calculateMoonPosition, jd);
            const double meeusAlt = altitudeAboveH0(meeus, jd, location);

            for (Method& m : methods) {
                MoonState state = {};
                double altitude = 0.0;
                m.evaluate(day, hours, state, altitude);
                m.stats.add(state, altitude, ref, refAlt);
                m.statsMeeus.add(state, altitude, meeus, meeusAlt);
            }
        }
    }

    std::printf("Mondberechnungen in astro.cpp: RMS (Wurzel aus dem mittleren quadratischen Fehler) und maximaler Fehler\n");
    std::printf("Zeitraum: %ld Tage ab JD %.1f, Prüfzeitpunkte alle %.0f min\n", days, firstDay.value(), EVALUATION_STEP * 60);
    std::printf("Ort: Breite %.4f°, Länge %.4f° Ost; ", location.latitude.deg(), location.longitude.deg());
    if (fixedDeltaT) {
        std::printf("ΔT = %.1f s (fest)\n", deltaT * 86400.0);
    } else {
        std::printf("ΔT aus astro.cpp (%.3f s zu Beginn)\n", firstDay.deltaT());
    }
    std::printf("Positionen geozentrisch, mittleres Äquinoktium des Datums; h−h0: geozentrische Höhe über der\n"
                "Standardhöhe h0 = 0.7275·π − 0°34′ wie in calculateMoonRiseSet\n");

    printTable("Gegen NASA-Ephemeride (mooninfo):", methods, &Method::stats);
    printTable("Gegen calculateMoonPosition direkt (reiner Modell- bzw. Interpolationsfehler):",
               methods, &Method::statsMeeus);

    evaluateHourlyTable(table, { 2, 4, 6, 12, 24, 36, 48 });
    return 0;
}
