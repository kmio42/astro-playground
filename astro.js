/*
 * Astronomische Berechnungen nach Jean Meeus, "Astronomische Algorithmen",
 * 2. Auflage, Barth 1994. JavaScript-Fassung der C++-Bibliothek cpp/astro.cpp mit denselben
 * Funktionsnamen, Parametern und Ergebnisobjekten; Beschreibung in cpp/README.md.
 *
 * Konventionen:
 *  - Winkel als Zahlen in Radiant (Umrechnung mit DEG2RAD / RAD2DEG).
 *  - Zeitpunkte als Julianischer Tag (Zahl) in UT, ab 1961 identisch mit UTC wie bei Date.
 *    Wo die Formeln die Dynamische Zeit TD verlangen, wird intern mit ΔT = TD − UT umgerechnet;
 *    Zeitpunkte, die die Formeln in TD liefern (Apsiden, Knoten, Äquinoktien), kommen in UT zurück.
 *  - Beobachtungsort als Objekt { longitude, latitude, elevation }: Länge Ost positiv [rad],
 *    Breite [rad], Höhe über dem Meer [m].
 *  - Azimut von Süden über Westen gezählt (wie im Buch).
 *  - Entfernungen in km.
 *
 * Im Browser stehen alle Namen global zur Verfügung, in Node.js über require('./astro.js').
 */
(function (root) {
    'use strict';

    // ---------------------------------------------------------------
    //  Konstanten
    // ---------------------------------------------------------------

    const DEG2RAD = Math.PI / 180;                  // Umrechnung Grad → Radiant [rad/°]
    const RAD2DEG = 180 / Math.PI;                  // Umrechnung Radiant → Grad [°/rad]

    const AU_KM = 149597870.7;                      // Astronomische Einheit [km]
    const EARTH_SEMI_MAJOR_AXIS = 1.000001018;      // Große Halbachse der Erdbahn [AE], Formel 24.5
    const EARTH_RADIUS = 6378.14;                   // Äquatorradius der Erde [km], Kapitel 10 und 45
    const MOON_RADIUS = 1738.1;                     // Mondradius [km]
    const MOON_ORBIT_RADIUS = 384400.0;             // Mittlere Entfernung Erde–Mond [km]

    // Berechnung von ΔT = TD − UT (Kapitel 9):
    //  true:  ab 1961 aus der Tabelle TAI − UTC (Schaltsekunden), davor nach den Polynomen von Espenak und Meeus.
    //  false: fester Wert TT − UTC = 69,184 s, gültig vom 1.1.2017 bis mindestens 28.6.2027.
    const ASTRO_EXACT_DELTA_T = true;

    // ---------------------------------------------------------------
    //  Winkel und Hilfsfunktionen
    // ---------------------------------------------------------------

    /** Horner-Schema: c0 + x·(c1 + x·(c2 + …)), Koeffizienten in der Reihenfolge des Buches. */
    function horner(x, ...c) {
        let result = 0;
        for (let i = c.length - 1; i >= 0; i--) result = c[i] + x * result;
        return result;
    }

    /** Winkel auf [0, 2π) bringen [rad]. */
    function normalizeAngle(rad) {
        const r = rad % (2 * Math.PI);
        return r < 0 ? r + 2 * Math.PI : r;
    }

    /** Winkel auf (−π, π] bringen [rad]. */
    function normalizeAngleSigned(rad) {
        const r = normalizeAngle(rad);
        return r > Math.PI ? r - 2 * Math.PI : r;
    }

    /** Winkel aus Grad, Bogenminuten und Bogensekunden [rad]. */
    function angleFromDms(deg, min, sec) {
        return (deg + min / 60 + sec / 3600) * DEG2RAD;
    }

    // Mittlere Schiefe der Ekliptik zur Epoche J2000.0, konstantes Glied von Formel 21.2. Passt zu Koordinaten,
    // die auf J2000.0 bezogen sind; für das mittlere Äquinoktium des Datums calculateObliquity(jd) verwenden.
    const OBLIQUITY_J2000 = angleFromDms(23, 26, 21.448);

    // ---------------------------------------------------------------
    //  Julianischer Tag (Kapitel 7)
    // ---------------------------------------------------------------

    /**
     * Julianischer Tag für ein Datum des Gregorianischen bzw. (vor dem 15.10.1582) Julianischen Kalenders.
     * Formel 7.1.
     * @param year Jahr, astronomisch gezählt
     * @param month Monat [1..12]
     * @param day Tag [1..31]
     * @param hours Uhrzeit [h]
     */
    function julianDayFromCalendar(year, month, day, hours = 0) {
        // Januar und Februar zählen als 13. und 14. Monat des Vorjahres
        if (month <= 2) {
            year -= 1;
            month += 12;
        }
        const A = Math.trunc(year / 100);
        // Julianischer Kalender bis 4.10.1582: B = 0
        const julian = (year < 1582) || (year === 1582 && month < 10) || (year === 1582 && month === 10 && day <= 4);
        const B = julian ? 0 : 2 - A + Math.trunc(A / 4);

        // Formel 7.1
        return Math.trunc(365.25 * (year + 4716)) + Math.trunc(30.6001 * (month + 1)) + day + B - 1524.5 + hours / 24;
    }

    /** Julianischer Tag zu einem Date-Objekt (entspricht JulianDay::fromUnixTime). */
    function julianDayFromDate(date) {
        return date.getTime() / 86400000 + 2440587.5;
    }

    /** Date-Objekt zu einem Julianischen Tag (entspricht JulianDay::toUnixTime). */
    function julianDayToDate(jd) {
        return new Date(Math.round((jd - 2440587.5) * 86400000));
    }

    /** 0h UT desselben UT-Tags. */
    function julianDayMidnight(jd) {
        return Math.round(jd) - 0.5;
    }

    // ---------------------------------------------------------------
    //  Dynamische Zeit und Weltzeit (Kapitel 9)
    // ---------------------------------------------------------------

    const TT_MINUS_TAI = 32.184;            // TT = TAI + 32,184 s [s]
    const TAI_MINUS_UTC_2017 = 37.0;        // TAI − UTC seit 1.1.2017 [s]

    // UTC von 1961 bis 1971: ab 0h UTC des Tages mjd gilt TAI − UTC = offset + (MJD − mjdRef)·rate.
    // Die UTC-Sekunde war etwas länger als die SI-Sekunde (rate > 0), dazu kamen Sprünge um Bruchteile
    // einer Sekunde. Quelle: USNO tai-utc.dat. Spalten: mjd, offset [s], mjdRef, rate [s/d]
    const TAI_UTC_1961 = [
        [37300, 1.4228180, 37300, 0.001296],    // 1.1.1961
        [37512, 1.3728180, 37300, 0.001296],    // 1.8.1961
        [37665, 1.8458580, 37665, 0.0011232],    // 1.1.1962
        [38334, 1.9458580, 37665, 0.0011232],    // 1.11.1963
        [38395, 3.2401300, 38761, 0.001296],    // 1.1.1964
        [38486, 3.3401300, 38761, 0.001296],    // 1.4.1964
        [38639, 3.4401300, 38761, 0.001296],    // 1.9.1964
        [38761, 3.5401300, 38761, 0.001296],    // 1.1.1965
        [38820, 3.6401300, 38761, 0.001296],    // 1.3.1965
        [38942, 3.7401300, 38761, 0.001296],    // 1.7.1965
        [39004, 3.8401300, 38761, 0.001296],    // 1.9.1965
        [39126, 4.3131700, 39126, 0.002592],    // 1.1.1966
        [39887, 4.2131700, 39126, 0.002592],    // 1.2.1968
    ];

    // Seit 1972 ändert sich TAI − UTC nur noch um ganze Schaltsekunden: ab 0h UTC des Tages mjd gilt
    // TAI − UTC = seconds. Quelle: IERS Bulletin C (leap-seconds.list), gültig bis 28.6.2027.
    // Eine neue Schaltsekunde wird als weitere Zeile angehängt. Spalten: mjd, seconds
    const LEAP_SECONDS = [
        [41317, 10],    // 1.1.1972
        [41499, 11],    // 1.7.1972
        [41683, 12],    // 1.1.1973
        [42048, 13],    // 1.1.1974
        [42413, 14],    // 1.1.1975
        [42778, 15],    // 1.1.1976
        [43144, 16],    // 1.1.1977
        [43509, 17],    // 1.1.1978
        [43874, 18],    // 1.1.1979
        [44239, 19],    // 1.1.1980
        [44786, 20],    // 1.7.1981
        [45151, 21],    // 1.7.1982
        [45516, 22],    // 1.7.1983
        [46247, 23],    // 1.7.1985
        [47161, 24],    // 1.1.1988
        [47892, 25],    // 1.1.1990
        [48257, 26],    // 1.1.1991
        [48804, 27],    // 1.7.1992
        [49169, 28],    // 1.7.1993
        [49534, 29],    // 1.7.1994
        [50083, 30],    // 1.1.1996
        [50630, 31],    // 1.7.1997
        [51179, 32],    // 1.1.1999
        [53736, 33],    // 1.1.2006
        [54832, 34],    // 1.1.2009
        [56109, 35],    // 1.7.2012
        [57204, 36],    // 1.7.2015
        [57754, 37],    // 1.1.2017
    ];

    // TAI − UTC [s] zum Modifizierten Julianischen Datum (UTC); NaN vor dem 1.1.1961
    function lookupTaiMinusUtc(mjd) {
        // Von hinten suchen: die meisten Zeitpunkte liegen in der Gegenwart
        for (let i = LEAP_SECONDS.length - 1; i >= 0; i--) {
            if (mjd >= LEAP_SECONDS[i][0]) return LEAP_SECONDS[i][1];
        }
        for (let i = TAI_UTC_1961.length - 1; i >= 0; i--) {
            const [start, offset, mjdRef, rate] = TAI_UTC_1961[i];
            if (mjd >= start) return offset + (mjd - mjdRef) * rate;
        }
        return NaN;
    }

    // ΔT vor 1961 nach den Polynomen von Espenak und Meeus ("Five Millennium Canon of Solar Eclipses",
    // NASA/TP-2006-214141); y = Jahr mit Bruchteil, Ergebnis [s]
    function deltaTPolynomial(y) {
        if (y < -500) {
            const u = (y - 1820) / 100;
            return -20 + 32 * u * u;
        }
        if (y < 500) return horner(y / 100, 10583.6, -1014.41, 33.78311, -5.952053, -0.1798452, 0.022174192, 0.0090316521);
        if (y < 1600) return horner((y - 1000) / 100, 1574.2, -556.01, 71.23472, 0.319781, -0.8503463, -0.005050998, 0.0083572073);
        if (y < 1700) return horner(y - 1600, 120, -0.9808, -0.01532, 1 / 7129);
        if (y < 1800) return horner(y - 1700, 8.83, 0.1603, -0.0059285, 0.00013336, -1 / 1174000);
        if (y < 1860) return horner(y - 1800, 13.72, -0.332447, 0.0068612, 0.0041116, -0.00037436,
                                    0.0000121272, -0.0000001699, 0.000000000875);
        if (y < 1900) return horner(y - 1860, 7.62, 0.5737, -0.251754, 0.01680668, -0.0004473624, 1 / 233174);
        if (y < 1920) return horner(y - 1900, -2.79, 1.494119, -0.0598939, 0.0061966, -0.000197);
        if (y < 1941) return horner(y - 1920, 21.20, 0.84493, -0.076100, 0.0020936);
        return horner(y - 1950, 29.07, 0.407, -1 / 233, 1 / 2547);
    }

    /**
     * TAI − UTC, also die Summe der Schaltsekunden (ab 1972 einschließlich der Anfangsdifferenz von 10 s)
     * bzw. der Wert nach der Formel von 1961–1971.
     * @param jd Julianischer Tag (UTC)
     * @return TAI − UTC [s]; NaN vor dem 1.1.1961 (UTC noch nicht definiert)
     */
    function taiMinusUtc(jd) {
        return ASTRO_EXACT_DELTA_T ? lookupTaiMinusUtc(jd - 2400000.5) : TAI_MINUS_UTC_2017;
    }

    /**
     * ΔT = TD − UT. Ab 1961 aus der Tabelle der Schaltsekunden: TD = TT = UTC + (TAI − UTC) + 32,184 s,
     * bis auf UT1 − UTC (stets unter 0,9 s) exakt. Davor nach den Polynomen von Espenak und Meeus.
     * @param jd Julianischer Tag (UT)
     * @return ΔT [s]
     */
    function deltaT(jd) {
        const dAT = taiMinusUtc(jd);
        if (!Number.isNaN(dAT)) return TT_MINUS_TAI + dAT;
        // Jahr mit Bruchteil; 2451544.5 = 1.1.2000, 0h
        return deltaTPolynomial(2000 + (jd - 2451544.5) / 365.2425);
    }

    /** Julianischer Tag in Dynamischer Zeit: JDE = JD + ΔT [d]. */
    function dynamicalTime(jd) {
        return jd + deltaT(jd) / 86400;
    }

    /**
     * Weltzeit zu einem Zeitpunkt in Dynamischer Zeit: JD = JDE − ΔT, wobei ΔT zum Zeitpunkt in UT gehört.
     * Der zweite Schritt korrigiert den Fehler von 1 s, wenn zwischen UT und TD eine Schaltsekunde liegt.
     * @param jde Julianischer Tag (TD)
     * @return Julianischer Tag (UT)
     */
    function julianDayFromDynamicalTime(jde) {
        const estimate = jde - deltaT(jde) / 86400;
        return jde - deltaT(estimate) / 86400;
    }

    /** Julianische Jahrhunderte T seit J2000.0 in TD, wie sie die Formeln für Sonne und Mond verlangen. */
    function julianCenturies(jd) {
        return (dynamicalTime(jd) - 2451545.0) / 36525.0;
    }

    /** Julianische Jahrtausende τ seit J2000.0 in TD, Formel 27.2. */
    function julianMillennia(jd) {
        return (dynamicalTime(jd) - 2451545.0) / 365250.0;
    }

    // ---------------------------------------------------------------
    //  Osterdatum (Kapitel 8)
    // ---------------------------------------------------------------

    /**
     * Datum des Ostersonntags. Ab 1583 im Gregorianischen Kalender (Verfahren von Spencer Jones und Butcher),
     * davor im Julianischen Kalender. Die Grenze entspricht julianDayFromCalendar.
     * @param year Jahr, astronomisch gezählt
     * @return { year, month, day }
     */
    function calculateEaster(year) {
        let n;
        if (year >= 1583) {
            const a = year % 19;
            const b = Math.trunc(year / 100);
            const c = year % 100;
            const d = Math.trunc(b / 4);
            const e = b % 4;
            const f = Math.trunc((b + 8) / 25);
            const g = Math.trunc((b - f + 1) / 3);
            const h = (19 * a + b - d - g + 15) % 30;
            const i = Math.trunc(c / 4);
            const k = c % 4;
            const l = (32 + 2 * e + 2 * i - h - k) % 7;
            const m = Math.trunc((a + 11 * h + 22 * l) / 451);
            n = h + l - 7 * m + 114;
        } else {
            // Reste nicht negativ, damit das Verfahren auch für Jahre vor 1 gilt
            const a = ((year % 4) + 4) % 4;
            const b = ((year % 7) + 7) % 7;
            const c = ((year % 19) + 19) % 19;
            const d = (19 * c + 15) % 30;
            const e = (2 * a + 4 * b - d + 34) % 7;
            n = d + e + 114;
        }
        return { year: year, month: Math.trunc(n / 31), day: n % 31 + 1 };
    }

    // ---------------------------------------------------------------
    //  Sternzeit (Kapitel 11, 12)
    // ---------------------------------------------------------------

    /**
     * Mittlere Sternzeit in Greenwich, Formel 11.4.
     * @param jd Julianischer Tag (UT)
     * @return θ0 [rad], [0, 2π)
     */
    function calculateGreenwichSiderealTime(jd) {
        // Formel 11.1, hier mit JD in UT (julianCenturies rechnet in TD)
        const T = (jd - 2451545.0) / 36525.0;
        const theta0 = 280.46061837 + 360.98564736629 * (jd - 2451545.0) + T * T * horner(T, 0.000387933, -1 / 38710000);
        return normalizeAngle(theta0 * DEG2RAD);
    }

    /**
     * Lokale Sternzeit θ = θ0 − L (Kapitel 12; dort ist die Länge L West positiv).
     * @param jd Julianischer Tag (UT)
     * @param location Beobachtungsort (Länge Ost positiv)
     * @return θ [rad], [0, 2π)
     */
    function calculateLocalSiderealTime(jd, location) {
        return normalizeAngle(calculateGreenwichSiderealTime(jd) + location.longitude);
    }

    // ---------------------------------------------------------------
    //  Sonne (Kapitel 21, 24, 27, 29)
    // ---------------------------------------------------------------

    /**
     * Mittlere Schiefe der Ekliptik ε0, Formel 21.2.
     * @param jd Julianischer Tag
     * @return ε0 [rad]
     */
    function calculateObliquity(jd) {
        const T = julianCenturies(jd);
        // 23°26′21″.448 − 46″.8150 T − 0″.00059 T² + 0″.001813 T³
        return angleFromDms(23, 26, horner(T, 21.448, -46.8150, -0.00059, 0.001813));
    }

    // Mittlere Größen der Sonne bei niedriger Genauigkeit (Kapitel 24): L0, M, C [rad], e [1]
    function sunArguments(T) {
        const M = horner(T, 357.52910, 35999.05030, -0.0001559, -0.00000048) * DEG2RAD;    // Formel 24.3
        return {
            L0: normalizeAngle(horner(T, 280.46645, 36000.76983, 0.0003032) * DEG2RAD),     // Formel 24.2
            M: M,
            e: horner(T, 0.016708617, -0.000042037, -0.0000001236),                         // Formel 24.4
            C: (horner(T, 1.914600, -0.004817, -0.000014) * Math.sin(M)
                + horner(T, 0.019993, -0.000101) * Math.sin(2 * M)
                + 0.000290 * Math.sin(3 * M)) * DEG2RAD,
        };
    }

    /**
     * Exzentrizität der Erdbahn, Formel 24.4.
     * @param jd Julianischer Tag
     * @return e [1]
     */
    function calculateEarthEccentricity(jd) {
        return sunArguments(julianCenturies(jd)).e;
    }

    /**
     * Geozentrische Position der Sonne bei niedriger Genauigkeit (Kapitel 24): wahre geometrische Länge
     * ☉ = L0 + C, bezogen auf das mittlere Äquinoktium des Datums, Breite 0 und Radiusvektor
     * R = 1.000001018·(1 − e²)/(1 + e·cos ν) mit ν = M + C (Formel 24.5).
     * @param jd Julianischer Tag
     * @return { longitude, latitude } [rad], distance [km]
     */
    function calculateSunPosition(jd) {
        const sun = sunArguments(julianCenturies(jd));
        const nu = sun.M + sun.C;
        return {
            longitude: sun.L0 + sun.C,
            latitude: 0,
            distance: EARTH_SEMI_MAJOR_AXIS * (1 - sun.e * sun.e) / (1 + sun.e * Math.cos(nu)) * AU_KM,
        };
    }

    /**
     * Wahre Anomalie der Erde aus der Keplergleichung E = M + e·sin E (Formel 29.5), iterativ gelöst,
     * und tan(ν/2) = √((1+e)/(1−e))·tan(E/2) (Formel 29.1).
     * @param jd Julianischer Tag
     * @return ν [rad]
     */
    function calculateEarthTrueAnomaly(jd) {
        const sun = sunArguments(julianCenturies(jd));
        let E = sun.M;
        for (let i = 0; i < 10; i++) {
            E = sun.M + sun.e * Math.sin(E);
        }
        return 2 * Math.atan2(Math.sqrt(1 + sun.e) * Math.sin(E / 2), Math.sqrt(1 - sun.e) * Math.cos(E / 2));
    }

    /**
     * Zeitgleichung nach Formel 27.1 mit geometrischer statt scheinbarer Rektaszension.
     * @param jd Julianischer Tag
     * @param withEarthTilt false: Rektaszension ohne Schiefe der Ekliptik (nur Anteil der Bahnexzentrizität)
     * @return Zeitgleichung [min], wahre minus mittlere Sonnenzeit
     */
    function calculateEquationOfTime(jd, withEarthTilt) {
        const sun = sunArguments(julianCenturies(jd));

        // Mittlere Länge der Sonne L0, Formel 27.2 mit τ in Julianischen Jahrtausenden
        const tau = julianMillennia(jd);
        const L0 = normalizeAngle(horner(tau, 280.4664567, 360007.6982779, 0.03032028,
                                         1 / 49931, -1 / 15299, -1 / 1988000) * DEG2RAD);

        // Wahre Länge der Sonne, Kapitel 24
        const L = sun.L0 + sun.C;
        const eps = withEarthTilt ? calculateObliquity(jd) : 0;

        // Rektaszension der Sonne, Formel 12.3 mit β = 0
        const alpha = normalizeAngle(Math.atan2(Math.cos(eps) * Math.sin(L), Math.cos(L)));

        // Formel 27.1: E = L0 − 0°.0057183 − α + Δψ·cos ε. Die Konstante (Aberration und FK5) und
        // Δψ·cos ε (Nutation) bringen die scheinbare Rektaszension auf die geometrische; da α hier
        // bereits geometrisch ist, entfallen beide. 1° entspricht 4 Zeitminuten.
        let E = (L0 - alpha) * RAD2DEG * 4;

        // Vielfache von 24 h entfernen; |E| ist immer kleiner als 20 min
        if (E > 60 * 12) E -= 24 * 60;
        else if (E < -60 * 12) E += 24 * 60;
        return E;
    }

    // ---------------------------------------------------------------
    //  Koordinatentransformation (Kapitel 10, 12, 13, 39)
    // ---------------------------------------------------------------

    /**
     * Ekliptikale in äquatoriale Koordinaten, Formeln 12.3 und 12.4.
     * @param ecliptic { longitude λ, latitude β } [rad]; die Entfernung wird nicht benötigt
     * @param eps Schiefe der Ekliptik ε [rad]. Für Positionen aus calculateSunPosition und calculateMoonPosition
     *            (mittleres Äquinoktium des Datums) calculateObliquity(jd); ohne Angabe OBLIQUITY_J2000,
     *            das weicht 2026 um 12″ ab, im Jahr 1000 um 0,13°.
     * @return { ra α, dec δ } [rad]
     */
    function calculateEquatorial(ecliptic, eps = OBLIQUITY_J2000) {
        const lambda = ecliptic.longitude;
        const beta = ecliptic.latitude;
        return {
            ra: Math.atan2(Math.sin(lambda) * Math.cos(eps) - Math.tan(beta) * Math.sin(eps), Math.cos(lambda)),   // Formel 12.3
            dec: Math.asin(Math.sin(beta) * Math.cos(eps) + Math.cos(beta) * Math.sin(eps) * Math.sin(lambda)),   // Formel 12.4
        };
    }

    /**
     * Äquatoriale in horizontale Koordinaten, Formeln 12.5 und 12.6.
     * @param equ { ra, dec } [rad]
     * @param localSiderealTime Lokale Sternzeit θ [rad]
     * @param location Beobachtungsort; benötigt wird nur die Breite φ, die Länge steckt bereits in θ
     * @return { azimuth A (von Süden über Westen), altitude h } [rad]
     */
    function calculateHorizontal(equ, localSiderealTime, location) {
        const phi = location.latitude;
        // Lokaler Stundenwinkel H = θ − α
        const H = localSiderealTime - equ.ra;
        return {
            azimuth: Math.atan2(Math.sin(H), Math.cos(H) * Math.sin(phi) - Math.tan(equ.dec) * Math.cos(phi)),        // Formel 12.5
            altitude: Math.asin(Math.sin(phi) * Math.sin(equ.dec) + Math.cos(phi) * Math.cos(equ.dec) * Math.cos(H)), // Formel 12.6
        };
    }

    /**
     * Parallaktischer Winkel q, Formel 13.1.
     * @param equ { ra, dec } [rad]
     * @param localSiderealTime Lokale Sternzeit θ [rad]
     * @param location Beobachtungsort; benötigt wird nur die Breite φ
     * @return q [rad], vor dem Meridiandurchgang negativ
     */
    function calculateParallacticAngle(equ, localSiderealTime, location) {
        const phi = location.latitude;
        const H = localSiderealTime - equ.ra;
        return Math.atan2(Math.sin(H), Math.tan(phi) * Math.cos(equ.dec) - Math.sin(equ.dec) * Math.cos(H));
    }

    /**
     * Topozentrische aus geozentrischen äquatorialen Koordinaten, Formeln 39.2 und 39.3.
     * ρ sin φ′ und ρ cos φ′ nach Kapitel 10 mit der Höhe des Beobachters über dem Meeresspiegel.
     * @param equ Geozentrische { ra, dec } [rad]
     * @param parallax Äquatoriale Horizontalparallaxe π [rad]
     * @param localSiderealTime Lokale Sternzeit θ [rad]
     * @param location Beobachtungsort; benötigt werden Breite φ und Höhe (elevation, fehlt sie: 0 m)
     * @return Topozentrische { ra, dec } [rad]
     */
    function calculateTopocentric(equ, parallax, localSiderealTime, location) {
        const phi = location.latitude;
        // Kapitel 10: b/a des Erdellipsoids [1] und Höhe über dem Meeresspiegel [m]
        const ba = 0.99664719;
        const height = location.elevation || 0;

        const u = Math.atan(ba * Math.tan(phi));
        const rhoSinPhi = ba * Math.sin(u) + height / (EARTH_RADIUS * 1000) * Math.sin(phi);
        const rhoCosPhi = Math.cos(u) + height / (EARTH_RADIUS * 1000) * Math.cos(phi);

        // Geozentrischer Stundenwinkel H
        const H = localSiderealTime - equ.ra;

        // Formel 39.2: Δα
        const deltaAlpha = Math.atan(-rhoCosPhi * Math.sin(parallax) * Math.sin(H)
                                     / (Math.cos(equ.dec) - rhoCosPhi * Math.sin(parallax) * Math.cos(H)));
        // Formel 39.3: δ′
        const dec = Math.atan2((Math.sin(equ.dec) - rhoSinPhi * Math.sin(parallax)) * Math.cos(deltaAlpha),
                               Math.cos(equ.dec) - rhoCosPhi * Math.sin(parallax) * Math.cos(H));
        return { ra: equ.ra + deltaAlpha, dec: dec };
    }

    // ---------------------------------------------------------------
    //  Refraktion (Kapitel 15)
    // ---------------------------------------------------------------

    /**
     * Atmosphärische Refraktion aus der wahren Höhe, Formel 15.4 (Saemundsson), für 1010 mbar und 10 °C.
     * Scheinbare Höhe = wahre Höhe + R. Der Zusatz 0,0019279′ macht R bei h = 90° zu 0.
     * Die Formel hat bei h = −5,11° eine Polstelle; unter −1° (Blick von erhöhtem Standpunkt unter den
     * Horizont) wird der Wert bei −1° verwendet.
     * @param altitude Wahre Höhe h [rad]
     * @return Refraktion R ≥ 0 [rad]
     */
    function calculateRefraction(altitude) {
        const h = Math.max(altitude * RAD2DEG, -1);
        const R = 1.02 / Math.tan((h + 10.3 / (h + 5.11)) * DEG2RAD) + 0.0019279;  // [′]
        return Math.max(R, 0) / 60 * DEG2RAD;
    }

    // ---------------------------------------------------------------
    //  Interpolation (Kapitel 3)
    // ---------------------------------------------------------------

    /**
     * Interpolation aus drei äquidistanten Tabellenwerten, Formeln 3.1 und 3.3.
     * @param y1 Tabellenwert bei x2 − 1
     * @param y2 Tabellenwert bei x2 (zentraler Wert)
     * @param y3 Tabellenwert bei x2 + 1
     * @param n Interpolationsfaktor n = x − x2 [Tabellenintervalle]
     */
    function interpolate(y1, y2, y3, n) {
        const a = y2 - y1;
        const b = y3 - y2;
        const c = b - a;
        return y2 + n / 2 * (a + b + n * c);
    }

    // ---------------------------------------------------------------
    //  Sonnenauf-/-untergang (Kapitel 14)
    // ---------------------------------------------------------------

    /**
     * 0h des Kalendertags, der jd enthält, in der Zeitzone utcOffset.
     * @param jd Julianischer Tag (UT)
     * @param utcOffset Abstand der Zeitzone zu UT [h], z. B. +1 für MEZ
     * @return Julianischer Tag (UT) des Tagesbeginns
     */
    function localMidnight(jd, utcOffset) {
        return julianDayMidnight(jd + utcOffset / 24) - utcOffset / 24;
    }

    // Stundenwinkel H (−π, π], Deklination und Höhe der Sonne zum Zeitpunkt m [Tagesbruchteile ab Tagesbeginn];
    // α und δ aus den Stützstellen interpoliert (Formel 3.3), θ = θ0 + 360.985647°·m (Kapitel 14)
    function sunStateAt(nodes, m, location) {
        const ra = interpolate(nodes.ra[0], nodes.ra[1], nodes.ra[2], m);
        const dec = interpolate(nodes.dec[0], nodes.dec[1], nodes.dec[2], m);
        const theta = nodes.theta0 + 360.985647 * DEG2RAD * m + location.longitude;
        const H = normalizeAngleSigned(theta - ra);
        const phi = location.latitude;
        const altitude = Math.asin(Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(H));
        return { H, dec, altitude };
    }

    // Zeitpunkt m eines Ereignisses mit der Korrektur Δm verfeinern (Kapitel 14); null ohne Konvergenz.
    // type: 0 Durchgang, −1 Aufgang, +1 Untergang
    function refineSunEvent(nodes, m, location, h0, type) {
        for (let i = 0; i < 10; i++) {
            const s = sunStateAt(nodes, m, location);
            const dm = (type === 0)
                ? -s.H / (2 * Math.PI)
                : (s.altitude - h0) / (2 * Math.PI * Math.cos(s.dec) * Math.cos(location.latitude) * Math.sin(s.H));
            if (!isFinite(dm) || Math.abs(dm) > 0.5) return null;
            m += dm;
            if (Math.abs(dm) < 1e-7) {
                // Aufgang östlich (H < 0), Untergang westlich (H > 0) des Meridians
                const sideOk = type === 0 || (type < 0 ? s.H < 0 : s.H > 0);
                return sideOk ? m : null;
            }
        }
        return null;
    }

    // Ereignis innerhalb des Tages (0 ≤ m < 1) suchen; der Startwert gilt modulo 1, daher auch m ± 1 versuchen
    function sunEventInDay(nodes, mStart, location, h0, type) {
        for (const shift of [0, -1, 1]) {
            const m = refineSunEvent(nodes, mStart + shift, location, h0, type);
            if (m !== null && m >= 0 && m < 1) return m;
        }
        return null;
    }

    /**
     * Sonnenaufgang, Meridiandurchgang und Sonnenuntergang nach Kapitel 14: Startwerte nach Formeln 14.1
     * und 14.2, α und δ aus drei Stützstellen (Tagesbeginn −1, 0, +1 Tag) interpoliert und die Zeiten
     * mit der Korrektur Δm verfeinert. Ein Ereignis gilt nur, wenn es innerhalb des Tages liegt; liegt es
     * knapp davor oder danach, gehört es zum Vor- oder Folgetag.
     * @param jd Julianischer Tag eines Zeitpunkts des gewünschten Tages
     * @param location Beobachtungsort
     * @param utcOffset Zeitzone des Tages [h], ohne Angabe 0 (UT-Tag)
     * @return { hasRise, hasSet, hasTransit, rise, set, transit [h seit Tagesbeginn], maxAltitude [rad] über h0,
     *           maxAltitudeTime [h seit Tagesbeginn] }; bei Polartag oder Polarnacht weder Auf- noch Untergang
     */
    function calculateSunRiseSet(jd, location, utcOffset = 0) {
        const phi = location.latitude;

        // Standardhöhe der Sonne h0 = −0°50′
        const h0 = -0.8333 * DEG2RAD;

        // Stützstellen am Tagesbeginn sowie einen Tag davor und danach; α stetig fortgesetzt
        const start = localMidnight(jd, utcOffset);
        const equ = [-1, 0, 1].map(d => calculateEquatorial(calculateSunPosition(start + d), calculateObliquity(start + d)));
        const nodes = {
            ra: equ.map(e => equ[1].ra + normalizeAngleSigned(e.ra - equ[1].ra)),
            dec: equ.map(e => e.dec),
            theta0: calculateGreenwichSiderealTime(start),
        };

        // Formel 14.2, Durchgang m0 = (α + L − θ0)/360° in Tagesbruchteilen; die Länge L zählt im Buch West positiv
        const m0 = normalizeAngle(nodes.ra[1] - location.longitude - nodes.theta0) / (2 * Math.PI);

        const result = {
            hasRise: false, hasSet: false, hasTransit: false,
            rise: 0, set: 0, transit: 0, maxAltitude: 0, maxAltitudeTime: 0,
        };

        // Durchgang und höchster Stand; ohne Durchgang im Tag liegt der höchste Stand am Tagesrand
        const transit = sunEventInDay(nodes, m0, location, h0, 0);
        if (transit !== null) {
            result.hasTransit = true;
            result.transit = transit * 24;
            result.maxAltitude = sunStateAt(nodes, transit, location).altitude - h0;
            result.maxAltitudeTime = transit * 24;
        } else {
            const atStart = sunStateAt(nodes, 0, location).altitude;
            const atEnd = sunStateAt(nodes, 1, location).altitude;
            result.maxAltitude = Math.max(atStart, atEnd) - h0;
            result.maxAltitudeTime = atStart >= atEnd ? 0 : 24;
        }

        // Formel 14.1 mit δ beim Durchgang, zu Beginn und am Ende des Tages. δ ändert sich innerhalb eines
        // Tages monoton: Liegt cos H0 an allen drei Stellen außerhalb [−1, 1], ist Polartag oder Polarnacht.
        // Sonst liefert die erste Stelle innerhalb [−1, 1] den Startwert (am Übergang zum Polartag bzw.
        // zur Polarnacht nur der Tagesbeginn oder das Tagesende).
        const cosH0At = (m) => {
            const dec = interpolate(nodes.dec[0], nodes.dec[1], nodes.dec[2], m);
            return (Math.sin(h0) - Math.sin(phi) * Math.sin(dec)) / (Math.cos(phi) * Math.cos(dec));
        };
        const cosH0 = [cosH0At(m0), cosH0At(0), cosH0At(1)].find(c => c >= -1 && c <= 1);
        if (cosH0 === undefined) {
            return result;
        }
        const H0 = Math.acos(cosH0) / (2 * Math.PI);

        // Formel 14.2, Aufgang m1 und Untergang m2 in Tagesbruchteilen, dann verfeinert
        const m1 = m0 - H0, m2 = m0 + H0;
        const rise = sunEventInDay(nodes, m1 - Math.floor(m1), location, h0, -1);
        const set = sunEventInDay(nodes, m2 - Math.floor(m2), location, h0, 1);
        if (rise !== null) {
            result.hasRise = true;
            result.rise = rise * 24;
        }
        if (set !== null) {
            result.hasSet = true;
            result.set = set * 24;
        }
        return result;
    }

    // ---------------------------------------------------------------
    //  Solstitien und Äquinoktien (Kapitel 26)
    // ---------------------------------------------------------------

    const EquinoxType = Object.freeze({ Spring: 0, Summer: 1, Autumn: 2, Winter: 3 });

    // Tabelle 26.2: JDE0 = c0 + c1·Y + c2·Y² + c3·Y³ + c4·Y⁴, Y = (Jahr − 2000)/1000
    const EQUINOX_MEAN = [
        [2451623.80984, 365242.37404, 0.05169, -0.00411, -0.00057],    // Märzäquinoktium
        [2451716.56767, 365241.62603, 0.00325, 0.00888, -0.00030],     // Junisolstitium
        [2451810.21715, 365242.01767, -0.11575, 0.00337, 0.00078],     // Septemberäquinoktium
        [2451900.05952, 365242.74049, -0.06223, -0.00823, 0.00032],    // Dezembersolstitium
    ];

    // Tabelle 26.3: S = Σ A·cos(B + C·T), B und C in Grad
    const EQUINOX_PERIODIC = [
        [485, 324.96, 1934.136], [203, 337.23, 32964.467], [199, 342.08, 20.186],
        [182, 27.85, 445267.112], [156, 73.14, 45036.886], [136, 171.52, 22518.443],
        [77, 222.54, 65928.934], [74, 296.72, 3034.906], [70, 243.58, 9037.513],
        [58, 119.81, 33718.147], [52, 297.17, 150.678], [50, 21.02, 2281.226],
        [45, 247.54, 29929.562], [44, 325.15, 31555.956], [29, 60.93, 4443.417],
        [18, 155.12, 67555.328], [17, 288.79, 4562.452], [16, 198.04, 62894.029],
        [14, 199.76, 31436.921], [12, 95.39, 14577.848], [12, 287.11, 31931.756],
        [12, 320.81, 34777.259], [9, 227.73, 1222.114], [8, 15.45, 16859.074],
    ];

    /**
     * Zeitpunkt eines Äquinoktiums oder Solstitiums, Tabellen 26.2 und 26.3 (Jahre +1000 bis +3000).
     * @param year Jahr
     * @param type EquinoxType.Spring, .Summer, .Autumn oder .Winter
     * @return Julianischer Tag (UT); die Tabellen liefern ihn in TD
     */
    function calculateEquinoxSolstice(year, type) {
        const c = EQUINOX_MEAN[type];
        const Y = (year - 2000) / 1000;
        const JDE0 = horner(Y, c[0], c[1], c[2], c[3], c[4]);

        const T = (JDE0 - 2451545.0) / 36525.0;     // JDE0 ist bereits in TD
        const W = (35999.373 * T - 2.47) * DEG2RAD;
        const deltaLambda = 1 + 0.0334 * Math.cos(W) + 0.0007 * Math.cos(2 * W);

        let S = 0;
        for (const [A, B, C] of EQUINOX_PERIODIC) {
            S += A * Math.cos((B + C * T) * DEG2RAD);
        }
        return julianDayFromDynamicalTime(JDE0 + 0.00001 * S / deltaLambda);
    }

    // ---------------------------------------------------------------
    //  Perihel / Aphel der Erde (Kapitel 37)
    // ---------------------------------------------------------------

    const ApsisType = Object.freeze({ Periapsis: 0, Apoapsis: 1 });

    // Perihel (k ganzzahlig) oder Aphel (k + 0.5) der Erde nach Kapitel 37 [JDE], mit den Korrekturen
    // für den Mittelpunkt der Erde statt des Baryzentrums Erde–Mond.
    function earthApsisForK(k, type) {
        // Korrekturterme [d]: Koeffizient × sin(A0 + A1·k), A0, A1 in Grad
        const angles = [[328.41, 132.788585], [316.13, 584.903153], [346.20, 450.380738],
                        [136.95, 659.306737], [249.52, 329.653368]];
        const perihelion = [1.278, -0.055, -0.091, -0.056, -0.045];
        const aphelion = [-1.352, 0.061, 0.062, 0.029, 0.031];
        const coefficient = (type === ApsisType.Periapsis) ? perihelion : aphelion;

        let correction = 0;
        for (let i = 0; i < 5; i++) {
            correction += coefficient[i] * Math.sin((angles[i][0] + angles[i][1] * k) * DEG2RAD);
        }
        return horner(k, 2451547.507, 365.2596358, 0.0000000158) + correction;
    }

    /**
     * Erstes Perihel bzw. Aphel der Erde nach jd (Kapitel 37). Der mittlere Fehler beträgt drei Stunden.
     * @param jd Julianischer Tag
     * @param type ApsisType.Periapsis (Perihel) oder ApsisType.Apoapsis (Aphel)
     * @return { time: Julianischer Tag (UT), distance: Entfernung Erde–Sonne nach Formel 24.5 [km] }
     */
    function calculateNextEarthApsis(jd, type) {
        // k ≈ 0.99997·(Jahr − 2000.01), ganzzahlig für das Perihel, + 0.5 für das Aphel
        const year = 2000 + (jd - 2451545.0) / 365.25;
        let k = Math.floor(0.99997 * (year - 2000.01)) - 1;
        if (type === ApsisType.Apoapsis) k += 0.5;
        const jdeStart = dynamicalTime(jd);
        let jde = earthApsisForK(k, type);
        while (jde <= jdeStart) {
            k += 1;
            jde = earthApsisForK(k, type);
        }
        const time = julianDayFromDynamicalTime(jde);
        return { time: time, distance: calculateSunPosition(time).distance };
    }

    // ---------------------------------------------------------------
    //  Mondposition (Kapitel 45)
    // ---------------------------------------------------------------

    // Fundamentalargumente des Mondes [rad] und Faktor E [1], Formeln 45.1 bis 45.6
    function moonArguments(T) {
        return {
            Lp: normalizeAngle(horner(T, 218.3164591, 481267.88134236, -0.0013268, 1 / 538841, -1 / 65194000) * DEG2RAD),
            D: normalizeAngle(horner(T, 297.8502042, 445267.1115168, -0.0016300, 1 / 545868, -1 / 113065000) * DEG2RAD),
            M: normalizeAngle(horner(T, 357.5291092, 35999.0502909, -0.0001536, 1 / 24490000) * DEG2RAD),
            Mp: normalizeAngle(horner(T, 134.9634114, 477198.8676313, 0.0089970, 1 / 69699, -1 / 14712000) * DEG2RAD),
            F: normalizeAngle(horner(T, 93.2720993, 483202.0175273, -0.0034029, -1 / 3526000, 1 / 863310000) * DEG2RAD),
            E: horner(T, 1, -0.002516, -0.0000074),
        };
    }

    // Tabelle 45.1: D, M, M′, F, Σl-Koeffizient [0.000001°], Σr-Koeffizient [0.001 km]
    const MOON_TERMS_LR = [
        [0, 0, 1, 0, 6288774, -20905355],
        [2, 0, -1, 0, 1274027, -3699111],
        [2, 0, 0, 0, 658314, -2955968],
        [0, 0, 2, 0, 213618, -569925],
        [0, 1, 0, 0, -185116, 48888],
        [0, 0, 0, 2, -114332, -3149],
        [2, 0, -2, 0, 58793, 246158],
        [2, -1, -1, 0, 57066, -152138],
        [2, 0, 1, 0, 53322, -170733],
        [2, -1, 0, 0, 45758, -204586],
        [0, 1, -1, 0, -40923, -129620],
        [1, 0, 0, 0, -34720, 108743],
        [0, 1, 1, 0, -30383, 104755],
        [2, 0, 0, -2, 15327, 10321],
        [0, 0, 1, 2, -12528, 0],
        [0, 0, 1, -2, 10980, 79661],
        [4, 0, -1, 0, 10675, -34782],
        [0, 0, 3, 0, 10034, -23210],
        [4, 0, -2, 0, 8548, -21636],
        [2, 1, -1, 0, -7888, 24208],
        [2, 1, 0, 0, -6766, 30824],
        [1, 0, -1, 0, -5163, -8379],
        [1, 1, 0, 0, 4987, -16675],
        [2, -1, 1, 0, 4036, -12831],
        [2, 0, 2, 0, 3994, -10445],
        [4, 0, 0, 0, 3861, -11650],
        [2, 0, -3, 0, 3665, 14403],
        [0, 1, -2, 0, -2689, -7003],
        [2, 0, -1, 2, -2602, 0],
        [2, -1, -2, 0, 2390, 10056],
        [1, 0, 1, 0, -2348, 6322],
        [2, -2, 0, 0, 2236, -9884],
        [0, 1, 2, 0, -2120, 5751],
        [0, 2, 0, 0, -2069, 0],
        [2, -2, -1, 0, 2048, -4950],
        [2, 0, 1, -2, -1773, 4130],
        [2, 0, 0, 2, -1595, 0],
        [4, -1, -1, 0, 1215, -3958],
        [0, 0, 2, 2, -1110, 0],
        [3, 0, -1, 0, -892, 3258],
        [2, 1, 1, 0, -810, 2616],
        [4, -1, -2, 0, 759, -1897],
        [0, 2, -1, 0, -713, -2117],
        [2, 2, -1, 0, -700, 2354],
        [2, 1, -2, 0, 691, 0],
        [2, -1, 0, -2, 596, 0],
        [4, 0, 1, 0, 549, -1423],
        [0, 0, 4, 0, 537, -1117],
        [4, -1, 0, 0, 520, -1571],
        [1, 0, -2, 0, -487, -1739],
        [2, 1, 0, -2, -399, 0],
        [0, 0, 2, -2, -381, -4421],
        [1, 1, 1, 0, 351, 0],
        [3, 0, -2, 0, -340, 0],
        [4, 0, -3, 0, 330, 0],
        [2, -1, 2, 0, 327, 0],
        [0, 2, 1, 0, -323, 1165],
        [1, 1, -1, 0, 299, 0],
        [2, 0, 3, 0, 294, 0],
        [2, 0, -1, -2, 0, 8752],
    ];

    // Tabelle 45.2: D, M, M′, F, Σb-Koeffizient [0.000001°]
    const MOON_TERMS_B = [
        [0, 0, 0, 1, 5128122],
        [0, 0, 1, 1, 280602],
        [0, 0, 1, -1, 277693],
        [2, 0, 0, -1, 173237],
        [2, 0, -1, 1, 55413],
        [2, 0, -1, -1, 46271],
        [2, 0, 0, 1, 32573],
        [0, 0, 2, 1, 17198],
        [2, 0, 1, -1, 9266],
        [0, 0, 2, -1, 8822],
        [2, -1, 0, -1, 8216],
        [2, 0, -2, -1, 4324],
        [2, 0, 1, 1, 4200],
        [2, 1, 0, -1, -3359],
        [2, -1, -1, 1, 2463],
        [2, -1, 0, 1, 2211],
        [2, -1, -1, -1, 2065],
        [0, 1, -1, -1, -1870],
        [4, 0, -1, -1, 1828],
        [0, 1, 0, 1, -1794],
        [0, 0, 0, 3, -1749],
        [0, 1, -1, 1, -1565],
        [1, 0, 0, 1, -1491],
        [0, 1, 1, 1, -1475],
        [0, 1, 1, -1, -1410],
        [0, 1, 0, -1, -1344],
        [1, 0, 0, -1, -1335],
        [0, 0, 3, 1, 1107],
        [4, 0, 0, -1, 1021],
        [4, 0, -1, 1, 833],
        [0, 0, 1, -3, 777],
        [4, 0, -2, 1, 671],
        [2, 0, 0, -3, 607],
        [2, 0, 2, -1, 596],
        [2, -1, 1, -1, 491],
        [2, 0, -2, 1, -451],
        [0, 0, 3, -1, 439],
        [2, 0, 2, 1, 422],
        [2, 0, -3, -1, 421],
        [2, 1, -1, 1, -366],
        [2, 1, 0, 1, -351],
        [4, 0, 0, 1, 331],
        [2, -1, 1, 1, 315],
        [2, -2, 0, -1, 302],
        [0, 0, 1, 3, -283],
        [2, 1, 1, -1, -229],
        [1, 1, 0, -1, 223],
        [1, 1, 0, 1, 223],
        [0, 1, -2, -1, -220],
        [2, 1, -1, -1, -220],
        [1, 0, 1, 1, -185],
        [2, -1, -2, -1, 181],
        [0, 1, 2, 1, -177],
        [4, 0, -2, -1, 176],
        [4, -1, -1, -1, 166],
        [1, 0, 1, -1, -164],
        [4, 0, 1, -1, 132],
        [1, 0, -1, -1, -119],
        [4, -1, 0, -1, 115],
        [2, -2, 0, 1, 107],
    ];

    // Terme mit M bzw. 2M werden mit E bzw. E² multipliziert (Text zu Formel 45.6)
    function eccentricityFactor(multipleOfM, E) {
        switch (Math.abs(multipleOfM)) {
            case 1: return E;
            case 2: return E * E;
            default: return 1;
        }
    }

    /**
     * Geozentrische Position des Mondes, bezogen auf das mittlere Äquinoktium des Datums (Kapitel 45).
     * @param jd Julianischer Tag
     * @return { longitude λ, latitude β } [rad], distance Δ [km]
     */
    function calculateMoonPosition(jd) {
        const T = julianCenturies(jd);
        const a = moonArguments(T);

        // Zusätzliche Argumente A1 (Venus), A2 (Jupiter), A3
        const A1 = normalizeAngle(horner(T, 119.75, 131.849) * DEG2RAD);
        const A2 = normalizeAngle(horner(T, 53.09, 479264.290) * DEG2RAD);
        const A3 = normalizeAngle(horner(T, 313.45, 481266.484) * DEG2RAD);

        // Σl [0.000001°] und Σr [0.001 km], Tabelle 45.1
        let suml = 0, sumr = 0;
        for (const [nD, nM, nMp, nF, l, r] of MOON_TERMS_LR) {
            const arg = nD * a.D + nM * a.M + nMp * a.Mp + nF * a.F;
            const e = eccentricityFactor(nM, a.E);
            suml += l * e * Math.sin(arg);
            sumr += r * e * Math.cos(arg);
        }
        suml += 3958 * Math.sin(A1)             // Venus
              + 1962 * Math.sin(a.Lp - a.F)     // Abplattung der Erde
              + 318 * Math.sin(A2);             // Jupiter

        // Σb [0.000001°], Tabelle 45.2
        let sumb = 0;
        for (const [nD, nM, nMp, nF, b] of MOON_TERMS_B) {
            const arg = nD * a.D + nM * a.M + nMp * a.Mp + nF * a.F;
            sumb += b * eccentricityFactor(nM, a.E) * Math.sin(arg);
        }
        sumb += -2235 * Math.sin(a.Lp)
              + 382 * Math.sin(A3)
              + 175 * Math.sin(A1 - a.F)
              + 175 * Math.sin(A1 + a.F)
              + 127 * Math.sin(a.Lp - a.Mp)
              - 115 * Math.sin(a.Lp + a.Mp);

        return {
            longitude: a.Lp + suml / 1000000 * DEG2RAD,
            latitude: sumb / 1000000 * DEG2RAD,
            distance: 385000.56 + sumr / 1000,
        };
    }

    /**
     * Geozentrische Position des Mondes bei niedriger Genauigkeit, bezogen auf das mittlere Äquinoktium des
     * Datums. Nicht aus Meeus, sondern MINI_MOON aus O. Montenbruck, T. Pfleger, "Astronomie mit dem
     * Personal Computer". Abweichung von calculateMoonPosition in den Jahren 2025–2028 höchstens 4,7′ in
     * Länge und 0,8′ in Breite.
     * @param jd Julianischer Tag
     * @return { longitude λ, latitude β } [rad]; als Entfernung die mittlere Entfernung MOON_ORBIT_RADIUS [km]
     */
    function calculateMoonPositionSimple(jd) {
        const T = julianCenturies(jd);
        const ARCSEC = DEG2RAD / 3600;

        // Mittlere Elemente der Mondbahn (Koeffizienten in Umläufen)
        const revolutions = (r) => normalizeAngle(2 * Math.PI * r);
        const L0 = revolutions(horner(T, 0.606433, 1336.855225));     // Mittlere Länge des Mondes
        const l = revolutions(horner(T, 0.374897, 1325.552410));      // Mittlere Anomalie des Mondes
        const ls = revolutions(horner(T, 0.993133, 99.997361));       // Mittlere Anomalie der Sonne
        const D = revolutions(horner(T, 0.827361, 1236.853086));      // Mittlere Elongation Mond–Sonne
        const F = revolutions(horner(T, 0.259086, 1342.227825));      // Mittlerer Abstand vom aufsteigenden Knoten

        // Störungen der Länge [″]
        const dL = 22640 * Math.sin(l) - 4586 * Math.sin(l - 2 * D) + 2370 * Math.sin(2 * D)
                 + 769 * Math.sin(2 * l) - 668 * Math.sin(ls) - 412 * Math.sin(2 * F)
                 - 212 * Math.sin(2 * l - 2 * D) - 206 * Math.sin(l + ls - 2 * D) + 192 * Math.sin(l + 2 * D)
                 - 165 * Math.sin(ls - 2 * D) - 125 * Math.sin(D) - 110 * Math.sin(l + ls)
                 + 148 * Math.sin(l - ls) - 55 * Math.sin(2 * F - 2 * D);

        // Störungen der Breite [″]
        const S = F + (dL + 412 * Math.sin(2 * F) + 541 * Math.sin(ls)) * ARCSEC;
        const H = F - 2 * D;
        const N = -526 * Math.sin(H) + 44 * Math.sin(l + H) - 31 * Math.sin(-l + H) - 23 * Math.sin(ls + H)
                + 11 * Math.sin(-ls + H) - 25 * Math.sin(-2 * l + F) + 21 * Math.sin(-l + F);

        return {
            longitude: normalizeAngle(L0 + dL * ARCSEC),
            latitude: (18520 * Math.sin(S) + N) * ARCSEC,
            distance: MOON_ORBIT_RADIUS,
        };
    }

    /**
     * Länge des mittleren aufsteigenden Knotens der Mondbahn, Formel 45.7.
     * @param jd Julianischer Tag
     * @return Ω [rad]
     */
    function calculateMoonAscendingNode(jd) {
        const T = julianCenturies(jd);
        return normalizeAngle(horner(T, 125.0445550, -1934.1361849, 0.0020762, 1 / 467410, -1 / 60616000) * DEG2RAD);
    }

    // ---------------------------------------------------------------
    //  Beleuchteter Teil der Mondscheibe (Kapitel 46)
    // ---------------------------------------------------------------

    /**
     * Beleuchteter Teil der Mondscheibe, Formeln 46.1 bis 46.3.
     * @param sunEqu { ra, dec } der Sonne [rad]
     * @param sunDistance Entfernung Erde–Sonne R [km]
     * @param moonEqu { ra, dec } des Mondes [rad]
     * @param moonDistance Entfernung Erde–Mond Δ [km]
     * @return Beleuchteter Teil k [0..1], 0 = Neumond, 1 = Vollmond
     */
    function calculateMoonIlluminatedFraction(sunEqu, sunDistance, moonEqu, moonDistance) {
        // Geozentrische Elongation ψ, Formel 46.2
        const cosPsi = Math.sin(sunEqu.dec) * Math.sin(moonEqu.dec)
                     + Math.cos(sunEqu.dec) * Math.cos(moonEqu.dec) * Math.cos(sunEqu.ra - moonEqu.ra);
        const psi = Math.acos(Math.min(1, Math.max(-1, cosPsi)));

        // Phasenwinkel i, Formel 46.3
        const i = Math.atan2(sunDistance * Math.sin(psi), moonDistance - sunDistance * cosPsi);

        // Formel 46.1
        return (1 + Math.cos(i)) / 2;
    }

    // ---------------------------------------------------------------
    //  Libration und Positionswinkel der Achse (Kapitel 51)
    // ---------------------------------------------------------------

    /**
     * Optische und physische Libration sowie Positionswinkel der Mondachse (Kapitel 51, ohne Nutation).
     * @param jd Julianischer Tag
     * @param moon Geozentrische Position des Mondes aus calculateMoonPosition
     * @return { libration: { longitude l (−π, π], latitude b }, positionAngle P } [rad]
     */
    function calculateMoonOrientation(jd, moon) {
        const T = julianCenturies(jd);
        const a = moonArguments(T);
        const Omega = calculateMoonAscendingNode(jd);

        // Neigung des mittleren Mondäquators gegen die Ekliptik I = 1°32′32″.7
        const I = 1.54242 * DEG2RAD;
        const lambda = moon.longitude;
        const beta = moon.latitude;

        // Optische Libration l′, b′, Formel 51.1
        const W = lambda - Omega;
        const A = Math.atan2(Math.sin(W) * Math.cos(beta) * Math.cos(I) - Math.sin(beta) * Math.sin(I),
                             Math.cos(W) * Math.cos(beta));
        const l1 = A - a.F;
        const b1 = Math.asin(-Math.sin(W) * Math.cos(beta) * Math.sin(I) - Math.sin(beta) * Math.cos(I));

        // Physische Libration: ρ, σ, τ (Koeffizienten in Grad)
        const K1 = horner(T, 119.75, 131.849) * DEG2RAD;
        const K2 = horner(T, 72.56, 20.186) * DEG2RAD;
        const D = a.D, M = a.M, Mp = a.Mp, F = a.F;
        const sin = Math.sin, cos = Math.cos;

        const rho = (-0.02752 * cos(Mp)
                     - 0.02245 * sin(F)
                     + 0.00684 * cos(Mp - 2 * F)
                     - 0.00293 * cos(2 * F)
                     - 0.00085 * cos(2 * F - 2 * D)
                     - 0.00054 * cos(Mp - 2 * D)
                     - 0.00020 * sin(Mp + F)
                     - 0.00020 * cos(Mp + 2 * F)
                     - 0.00020 * cos(Mp - F)
                     + 0.00014 * cos(Mp + 2 * F - 2 * D)) * DEG2RAD;

        const sigma = (-0.02816 * sin(Mp)
                       + 0.02244 * cos(F)
                       - 0.00682 * sin(Mp - 2 * F)
                       - 0.00279 * sin(2 * F)
                       - 0.00083 * sin(2 * F - 2 * D)
                       + 0.00069 * sin(Mp - 2 * D)
                       + 0.00040 * cos(Mp + F)
                       - 0.00025 * sin(2 * Mp)
                       - 0.00023 * sin(Mp + 2 * F)
                       + 0.00020 * cos(Mp - F)
                       + 0.00019 * sin(Mp - F)
                       + 0.00013 * sin(Mp + 2 * F - 2 * D)
                       - 0.00010 * cos(Mp - 3 * F)) * DEG2RAD;

        const tau = (+0.02520 * a.E * sin(M)
                     + 0.00473 * sin(2 * Mp - 2 * F)
                     - 0.00467 * sin(Mp)
                     + 0.00396 * sin(K1)
                     + 0.00276 * sin(2 * Mp - 2 * D)
                     + 0.00196 * sin(Omega)
                     - 0.00183 * cos(Mp - F)
                     + 0.00115 * sin(Mp - 2 * D)
                     - 0.00096 * sin(Mp - D)
                     + 0.00046 * sin(2 * F - 2 * D)
                     - 0.00039 * sin(Mp - F)
                     - 0.00032 * sin(Mp - M - D)
                     + 0.00027 * sin(2 * Mp - M - 2 * D)
                     + 0.00023 * sin(K2)
                     - 0.00014 * sin(2 * D)
                     + 0.00014 * cos(2 * Mp - 2 * F)
                     - 0.00012 * sin(Mp - 2 * F)
                     - 0.00012 * sin(2 * Mp)
                     + 0.00011 * sin(2 * Mp - 2 * M - 2 * D)) * DEG2RAD;

        // Physische Libration l″, b″, Formel 51.2
        const l2 = -tau + (rho * cos(A) + sigma * sin(A)) * Math.tan(b1);
        const b2 = sigma * cos(A) - rho * sin(A);

        // Positionswinkel der Achse P
        const eps = calculateObliquity(jd);
        const moonEqu = calculateEquatorial(moon, eps);
        const V = Omega + sigma / sin(I);
        const X = sin(I + rho) * sin(V);
        const Y = sin(I + rho) * cos(V) * cos(eps) - cos(I + rho) * sin(eps);
        const omega = Math.atan2(X, Y);
        const b = b1 + b2;
        const P = Math.asin(Math.sqrt(X * X + Y * Y) * cos(moonEqu.ra - omega) / cos(b));

        return { libration: { longitude: normalizeAngleSigned(l1 + l2), latitude: b }, positionAngle: P };
    }

    // ---------------------------------------------------------------
    //  Perigäum / Apogäum (Kapitel 48) und Knotendurchgänge (Kapitel 49) des Mondes
    // ---------------------------------------------------------------

    // Periodische Terme (a0 + aT·T)·sin(arg) bzw. ·cos(arg), arg = nD·D + nM·M + nF·F.
    // Spalten: a0, aT, nD, nM, nF

    // Tabelle 48.1: Terme für die Zeit [d] (Sinus)
    const PERIGEE_TIME = [
        [-1.6769, 0, 2, 0, 0], [0.4589, 0, 4, 0, 0], [-0.1856, 0, 6, 0, 0], [0.0883, 0, 8, 0, 0],
        [-0.0773, 0.00019, 2, -1, 0], [0.0502, -0.00013, 0, 1, 0], [-0.0460, 0, 10, 0, 0],
        [0.0422, -0.00011, 4, -1, 0], [-0.0256, 0, 6, -1, 0], [0.0253, 0, 12, 0, 0], [0.0237, 0, 1, 0, 0],
        [0.0162, 0, 8, -1, 0], [-0.0145, 0, 14, 0, 0], [0.0129, 0, 0, 0, 2], [-0.0112, 0, 3, 0, 0],
        [-0.0104, 0, 10, -1, 0], [0.0086, 0, 16, 0, 0], [0.0069, 0, 12, -1, 0], [0.0066, 0, 5, 0, 0],
        [-0.0053, 0, 2, 0, 2], [-0.0052, 0, 18, 0, 0], [-0.0046, 0, 14, -1, 0], [-0.0041, 0, 7, 0, 0],
        [0.0040, 0, 2, 1, 0], [0.0032, 0, 20, 0, 0], [-0.0032, 0, 1, 1, 0], [0.0031, 0, 16, -1, 0],
        [-0.0029, 0, 4, 1, 0], [0.0027, 0, 9, 0, 0], [0.0027, 0, 4, 0, 2], [-0.0027, 0, 2, -2, 0],
        [0.0024, 0, 4, -2, 0], [-0.0021, 0, 6, -2, 0], [-0.0021, 0, 22, 0, 0], [-0.0021, 0, 18, -1, 0],
        [0.0019, 0, 6, 1, 0], [-0.0018, 0, 11, 0, 0], [-0.0014, 0, 8, 1, 0], [-0.0014, 0, 4, 0, -2],
        [-0.0014, 0, 6, 0, 2], [0.0014, 0, 3, 1, 0], [-0.0014, 0, 5, 1, 0], [0.0013, 0, 13, 0, 0],
        [0.0013, 0, 20, -1, 0], [0.0011, 0, 3, 2, 0], [-0.0011, 0, 4, -2, 2], [-0.0010, 0, 1, 2, 0],
        [-0.0009, 0, 22, -1, 0], [-0.0008, 0, 0, 0, 4], [0.0008, 0, 6, 0, -2], [0.0008, 0, 2, 1, -2],
        [0.0007, 0, 0, 2, 0], [0.0007, 0, 0, -1, 2], [0.0007, 0, 2, 0, 4], [-0.0006, 0, 0, -2, 2],
        [-0.0006, 0, 2, 2, -2], [0.0006, 0, 24, 0, 0], [0.0005, 0, 4, 0, -4], [0.0005, 0, 2, 2, 0],
        [-0.0004, 0, 1, -1, 0],
    ];

    const APOGEE_TIME = [
        [0.4392, 0, 2, 0, 0], [0.0684, 0, 4, 0, 0], [0.0456, -0.00011, 0, 1, 0],
        [0.0426, -0.00011, 2, -1, 0], [0.0212, 0, 0, 0, 2], [-0.0189, 0, 1, 0, 0], [0.0144, 0, 6, 0, 0],
        [0.0113, 0, 4, -1, 0], [0.0047, 0, 2, 0, 2], [0.0036, 0, 1, 1, 0], [0.0035, 0, 8, 0, 0],
        [0.0034, 0, 6, -1, 0], [-0.0034, 0, 2, 0, -2], [0.0022, 0, 2, -2, 0], [-0.0017, 0, 3, 0, 0],
        [0.0013, 0, 4, 0, 2], [0.0011, 0, 8, -1, 0], [0.0010, 0, 4, -2, 0], [0.0009, 0, 10, 0, 0],
        [0.0007, 0, 3, 1, 0], [0.0006, 0, 0, 2, 0], [0.0005, 0, 2, 1, 0], [0.0005, 0, 2, 2, 0],
        [0.0004, 0, 6, 0, 2], [0.0004, 0, 6, -2, 0], [0.0004, 0, 10, -1, 0], [-0.0004, 0, 5, 0, 0],
        [-0.0004, 0, 4, 0, -2], [0.0003, 0, 0, 1, 2], [0.0003, 0, 12, 0, 0], [0.0003, 0, 2, -1, 2],
        [-0.0003, 0, 1, -1, 0],
    ];

    // Tabelle 48.2: Terme für die Äquatorial-Horizontalparallaxe [″] (Kosinus)
    const PERIGEE_PARALLAX = [
        [3629.215, 0, 0, 0, 0], [63.224, 0, 2, 0, 0], [-6.990, 0, 4, 0, 0], [2.834, -0.0071, 2, -1, 0],
        [1.927, 0, 6, 0, 0], [-1.263, 0, 1, 0, 0], [-0.702, 0, 8, 0, 0], [0.696, -0.0017, 0, 1, 0],
        [-0.690, 0, 0, 0, 2], [-0.629, 0.0016, 4, -1, 0], [-0.392, 0, 2, 0, -2], [0.297, 0, 10, 0, 0],
        [0.260, 0, 6, -1, 0], [0.201, 0, 3, 0, 0], [-0.161, 0, 2, 1, 0], [0.157, 0, 1, 1, 0],
        [-0.138, 0, 12, 0, 0], [-0.127, 0, 8, -1, 0], [0.104, 0, 2, 0, 2], [0.104, 0, 2, -2, 0],
        [-0.079, 0, 5, 0, 0], [0.068, 0, 14, 0, 0], [0.067, 0, 10, -1, 0], [0.054, 0, 4, 1, 0],
        [-0.038, 0, 12, -1, 0], [-0.038, 0, 4, -2, 0], [0.037, 0, 7, 0, 0], [-0.037, 0, 4, 0, 2],
        [-0.035, 0, 16, 0, 0], [-0.030, 0, 3, 1, 0], [0.029, 0, 1, -1, 0], [-0.025, 0, 6, 1, 0],
        [0.023, 0, 0, 2, 0], [0.023, 0, 14, -1, 0], [-0.023, 0, 2, 2, 0], [0.022, 0, 6, -2, 0],
        [-0.021, 0, 2, -1, -2], [-0.020, 0, 9, 0, 0], [0.019, 0, 18, 0, 0], [0.017, 0, 6, 0, 2],
        [0.014, 0, 0, -1, 2], [-0.014, 0, 16, -1, 0], [0.013, 0, 4, 0, -2], [0.012, 0, 8, 1, 0],
        [0.011, 0, 11, 0, 0], [0.010, 0, 5, 1, 0], [-0.010, 0, 20, 0, 0],
    ];

    const APOGEE_PARALLAX = [
        [3245.251, 0, 0, 0, 0], [-9.147, 0, 2, 0, 0], [-0.841, 0, 1, 0, 0], [0.697, 0, 0, 0, 2],
        [-0.656, 0.0016, 0, 1, 0], [0.355, 0, 4, 0, 0], [0.159, 0, 2, -1, 0], [0.127, 0, 1, 1, 0],
        [0.065, 0, 4, -1, 0], [0.052, 0, 6, 0, 0], [0.043, 0, 2, 1, 0], [0.031, 0, 2, 0, 2],
        [-0.023, 0, 2, 0, -2], [0.022, 0, 2, -2, 0], [0.019, 0, 2, 2, 0], [-0.016, 0, 0, 2, 0],
        [0.014, 0, 6, -1, 0], [0.010, 0, 8, 0, 0],
    ];

    function sumApsisTerms(terms, T, D, M, F, useCos) {
        let sum = 0;
        for (const [a0, aT, nD, nM, nF] of terms) {
            const arg = nD * D + nM * M + nF * F;
            sum += (a0 + aT * T) * (useCos ? Math.cos(arg) : Math.sin(arg));
        }
        return sum;
    }

    // Perigäum (k ganzzahlig) oder Apogäum (k + 0.5) nach Kapitel 48; Zeitpunkt nach UT umgerechnet.
    function moonApsisForK(k, type) {
        // Formel 48.3 [Julianische Jahrhunderte]
        const T = k / 1325.55;

        // Formel 48.1: Zeit des mittleren Perigäums bzw. Apogäums [JDE]
        const jdeMean = 2451534.6698 + 27.55454988 * k + T * T * horner(T, -0.0006886, -0.000001098, 0.0000000052);

        // D, M, F (Koeffizienten in Grad)
        const D = (171.9179 + 335.9106046 * k + T * T * horner(T, -0.0100250, -0.00001156, 0.000000055)) * DEG2RAD;
        const M = (347.3477 + 27.1577721 * k + T * T * horner(T, -0.0008323, -0.0000010)) * DEG2RAD;
        const F = (316.6109 + 364.5287911 * k + T * T * horner(T, -0.0125131, -0.0000148)) * DEG2RAD;

        const perigee = type === ApsisType.Periapsis;
        const jde = jdeMean + sumApsisTerms(perigee ? PERIGEE_TIME : APOGEE_TIME, T, D, M, F, false);
        // Äquatoriale Horizontalparallaxe (Tabelle in Bogensekunden)
        const parallax = sumApsisTerms(perigee ? PERIGEE_PARALLAX : APOGEE_PARALLAX, T, D, M, F, true) / 3600 * DEG2RAD;
        return { time: julianDayFromDynamicalTime(jde), distance: EARTH_RADIUS / Math.sin(parallax) };
    }

    /**
     * Erstes Perigäum bzw. Apogäum des Mondes nach jd (Kapitel 48).
     * Meeus gibt die Genauigkeit des Zeitpunkts mit bis zu 31 min (Perigäum) bzw. 3 min (Apogäum) an.
     * @param jd Julianischer Tag
     * @param type ApsisType.Periapsis (Perigäum) oder ApsisType.Apoapsis (Apogäum)
     * @return { time: Julianischer Tag (UT), distance [km] }
     */
    function calculateNextMoonApsis(jd, type) {
        // k zählt die anomalistischen Monate ab dem Perigäum 1999 Dezember 22 (Formel 48.1 nach k umgestellt)
        let k = Math.floor((jd - 2451534.6698) / 27.55454988) - 1;
        if (type === ApsisType.Apoapsis) k += 0.5;
        let apsis = moonApsisForK(k, type);
        while (apsis.time <= jd) {
            k += 1;
            apsis = moonApsisForK(k, type);
        }
        return apsis;
    }

    // Knotendurchgang (k ganzzahlig: aufsteigend, k + 0.5: absteigend) nach Kapitel 49 [JDE].
    function moonNodeForK(k) {
        // [Julianische Jahrhunderte]
        const T = k / 1342.23;

        // D, M, M′, Ω, V, P (Koeffizienten in Grad)
        const D = (183.6380 + 331.73735691 * k + T * T * horner(T, 0.0015057, 0.00000209, -0.000000010)) * DEG2RAD;
        const M = (17.4006 + 26.82037250 * k + T * T * horner(T, 0.0000999, 0.00000006)) * DEG2RAD;
        const Mp = (38.3776 + 355.52747322 * k + T * T * horner(T, 0.0123577, 0.000014628, -0.000000069)) * DEG2RAD;
        const Omega = (123.9767 - 1.44098949 * k + T * T * horner(T, 0.0020625, 0.00000214, -0.000000016)) * DEG2RAD;
        const V = horner(T, 299.75, 132.85, -0.009173) * DEG2RAD;
        const P = Omega + horner(T, 272.75, -2.3) * DEG2RAD;
        // Formel 45.6 [1]
        const E = horner(T, 1.0, -0.002516, -0.0000074);
        const sin = Math.sin;

        return 2451565.1619 + 27.212220817 * k + T * T * horner(T, 0.0002572, 0.000000021, -0.000000000088)
             - 0.4721 * sin(Mp)
             - 0.1649 * sin(2 * D)
             - 0.0868 * sin(2 * D - Mp)
             + 0.0084 * sin(2 * D + Mp)
             - 0.0083 * sin(2 * D - M) * E
             - 0.0039 * sin(2 * D - M - Mp) * E
             + 0.0034 * sin(2 * Mp)
             - 0.0031 * sin(2 * D - 2 * Mp)
             + 0.0030 * sin(2 * D + M) * E
             + 0.0028 * sin(M - Mp) * E
             + 0.0026 * sin(M) * E
             + 0.0025 * sin(4 * D)
             + 0.0024 * sin(D)
             + 0.0022 * sin(M + Mp) * E
             + 0.0017 * sin(Omega)
             + 0.0014 * sin(4 * D - Mp)
             + 0.0005 * sin(2 * D + M - Mp) * E
             + 0.0004 * sin(2 * D - M + Mp) * E
             - 0.0003 * sin(2 * D - 2 * M) * E
             + 0.0003 * sin(4 * D - M) * E
             + 0.0003 * sin(V)
             + 0.0003 * sin(P);
    }

    /**
     * Erster Durchgang des Mondes durch einen Knoten seiner Bahn nach jd (Kapitel 49).
     * @param jd Julianischer Tag
     * @return { time: Julianischer Tag (UT), ascending: true für den aufsteigenden Knoten }
     */
    function calculateNextMoonNode(jd) {
        // k zählt die drakonitischen Monate ab dem aufsteigenden Knoten 2000 Januar 21
        let k = Math.floor((jd - 2451565.1619) / 27.212220817) - 1;
        const jdeStart = dynamicalTime(jd);
        let jde = moonNodeForK(k);
        while (jde <= jdeStart) {
            k += 0.5;
            jde = moonNodeForK(k);
        }
        return { time: julianDayFromDynamicalTime(jde), ascending: k === Math.floor(k) };
    }

    // ---------------------------------------------------------------
    //  Mondauf-/-untergang (nicht aus dem Buch)
    // ---------------------------------------------------------------

    // Parabel p(u) = A·u² + B·u + C durch (0, y0), (1, y1), (2, y2)
    function parabolaThrough(y0, y1, y2) {
        return { A: 0.5 * (y0 - 2 * y1 + y2), B: 0.5 * (-3 * y0 + 4 * y1 - y2), C: y0 };
    }

    function parabolaValue(p, u) {
        return horner(u, p.C, p.B, p.A);
    }

    // Reelle Nullstellen r1 ≤ r2 der Parabel (A ≠ 0); null, wenn es keine gibt
    function parabolaRoots(p) {
        const discriminant = p.B * p.B - 4 * p.A * p.C;
        if (discriminant < 0) return null;
        // Auslöschungsfreie Form der Lösungsformel
        const q = -0.5 * (p.B + (p.B >= 0 ? 1 : -1) * Math.sqrt(discriminant));
        let r1 = q / p.A;
        let r2 = (q !== 0) ? p.C / q : r1;
        if (r1 > r2) [r1, r2] = [r2, r1];
        return { r1: r1, r2: r2 };
    }

    // Nullstelle der Parabel im Intervall [0, 1]; Voraussetzung: p(0) und p(1) haben unterschiedliche Vorzeichen
    function parabolaRootInUnitInterval(p) {
        // Rückfall: lineare Interpolation zwischen den Intervallgrenzen
        const p1 = parabolaValue(p, 1);
        const linear = p.C / (p.C - p1);

        if (Math.abs(p.A) < 1e-12) {
            return (Math.abs(p.B) < 1e-12) ? linear : -p.C / p.B;
        }
        const roots = parabolaRoots(p);
        if (!roots) return linear;
        for (const r of [roots.r1, roots.r2]) {
            if (r >= -1e-9 && r <= 1 + 1e-9) return r;
        }
        return linear;
    }

    // Höhe über der Aufgangshöhe h0 und Stundenwinkel (−π, π] des Mondes zum Zeitpunkt jd [rad]
    function sampleMoon(jd, location) {
        const moon = calculateMoonPosition(jd);
        const equ = calculateEquatorial(moon, calculateObliquity(jd));
        const theta = calculateLocalSiderealTime(jd, location);
        const hor = calculateHorizontal(equ, theta, location);

        // Standardhöhe des Mondes h0 = 0.7275·π − 0°34′ (Kapitel 14) für die geozentrische Position;
        // berücksichtigt Horizontalparallaxe π, Halbmesser und Refraktion.
        const parallax = Math.asin(EARTH_RADIUS / moon.distance);
        const h0 = 0.7275 * parallax - 0.5667 * DEG2RAD;

        return { altitude: hor.altitude - h0, hourAngle: normalizeAngleSigned(theta - equ.ra) };
    }

    // Stetige Fortsetzung eines Stundenwinkels relativ zu einem Bezugswert [rad]
    function continueHourAngle(reference, hourAngle) {
        return reference + normalizeAngleSigned(hourAngle - reference);
    }

    /**
     * Mondauf- und -untergang, Meridiandurchgang und höchster Stand für den Tag (UT oder Zeitzone utcOffset),
     * der jd enthält.
     * Die Mondhöhe wird stündlich berechnet. Für jedes Stundenintervall [k, k+1] wird eine Parabel durch
     * die Stützstellen k, k+1, k+2 gelegt, mit der Horizont- und Meridiandurchgänge sowie der Scheitel
     * innerhalb des Intervalls bestimmt werden.
     * @param jd Julianischer Tag
     * @param location Beobachtungsort
     * @param utcOffset Zeitzone des Tages [h], ohne Angabe 0 (UT-Tag)
     * @return { hasRise, hasSet, hasTransit, rise, set, transit [h seit Tagesbeginn], maxAltitude [rad] über h0,
     *           maxAltitudeTime [h seit Tagesbeginn] }
     */
    function calculateMoonRiseSet(jd, location, utcOffset = 0) {
        const midnight = localMidnight(jd, utcOffset);
        const sampleAt = (hour) => sampleMoon(midnight + hour / 24, location);

        // Gleitendes Fenster aus drei aufeinanderfolgenden Stunden k, k+1, k+2
        let s0 = sampleAt(0);
        let s1 = sampleAt(1);

        const result = {
            hasRise: false, hasSet: false, hasTransit: false,
            rise: 0, set: 0, transit: 0, maxAltitude: 0, maxAltitudeTime: 0,
        };
        let maxAltitude = s0.altitude;

        for (let k = 0; k < 24; k++) {
            const s2 = sampleAt(k + 2);
            const altitude = parabolaThrough(s0.altitude, s1.altitude, s2.altitude);

            // Horizont in [k, k+1]. Die Anzahl der Durchgänge richtet sich nach den Vorzeichen der
            // Stützstellen, damit Nullstellen an der Intervallgrenze weder doppelt noch gar nicht zählen.
            const belowAtStart = s0.altitude < 0;
            if (belowAtStart !== (s1.altitude < 0)) {
                // Vorzeichenwechsel: genau ein Durchgang
                const hours = k + parabolaRootInUnitInterval(altitude);
                if (belowAtStart && !result.hasRise) {
                    result.hasRise = true;
                    result.rise = hours;
                } else if (!belowAtStart && !result.hasSet) {
                    result.hasSet = true;
                    result.set = hours;
                }
            } else if (Math.abs(altitude.A) > 1e-12) {
                // Gleiches Vorzeichen an beiden Enden: zwei Durchgänge, wenn der Scheitel im Intervall
                // auf der anderen Seite des Horizonts liegt (Mond streift den Horizont)
                const u = -altitude.B / (2 * altitude.A);
                const vertex = parabolaValue(altitude, u);
                if (u > 0 && u < 1 && (vertex < 0) !== belowAtStart) {
                    const roots = parabolaRoots(altitude);
                    if (roots) {
                        const riseHours = k + (belowAtStart ? roots.r1 : roots.r2);
                        const setHours = k + (belowAtStart ? roots.r2 : roots.r1);
                        if (!result.hasRise) {
                            result.hasRise = true;
                            result.rise = riseHours;
                        }
                        if (!result.hasSet) {
                            result.hasSet = true;
                            result.set = setHours;
                        }
                    }
                }
            }

            // Meridian: Stundenwinkel wechselt von negativ nach positiv (nicht der Sprung bei ±π)
            if (!result.hasTransit && s0.hourAngle < 0 && s1.hourAngle >= 0
                && Math.abs(s0.hourAngle) < Math.PI / 2 && Math.abs(s1.hourAngle) < Math.PI / 2) {
                // Stundenwinkel relativ zur mittleren Stützstelle stetig fortsetzen
                const w0 = continueHourAngle(s1.hourAngle, s0.hourAngle);
                const w2 = continueHourAngle(s1.hourAngle, s2.hourAngle);
                result.hasTransit = true;
                result.transit = k + parabolaRootInUnitInterval(parabolaThrough(w0, s1.hourAngle, w2));
            }

            // Höchster Stand: Stützstelle k+1 und Parabelscheitel innerhalb des Fensters (und des Tages)
            if (s1.altitude > maxAltitude) {
                maxAltitude = s1.altitude;
                result.maxAltitudeTime = k + 1;
            }
            if (altitude.A < 0) {
                const u = -altitude.B / (2 * altitude.A);
                const vertex = parabolaValue(altitude, u);
                if (u > 0 && u < 2 && k + u <= 24 && vertex > maxAltitude) {
                    maxAltitude = vertex;
                    result.maxAltitudeTime = k + u;
                }
            }

            s0 = s1;
            s1 = s2;
        }
        result.maxAltitude = maxAltitude;
        return result;
    }

    // ---------------------------------------------------------------
    //  Export: im Browser global, in Node.js über module.exports
    // ---------------------------------------------------------------

    const api = {
        // Konstanten
        DEG2RAD, RAD2DEG, AU_KM, EARTH_SEMI_MAJOR_AXIS, EARTH_RADIUS, MOON_RADIUS, MOON_ORBIT_RADIUS,
        OBLIQUITY_J2000, ASTRO_EXACT_DELTA_T, EquinoxType, ApsisType,
        // Winkel
        normalizeAngle, normalizeAngleSigned, angleFromDms,
        // Zeit
        julianDayFromCalendar, julianDayFromDate, julianDayToDate, julianDayMidnight,
        deltaT, taiMinusUtc, dynamicalTime, julianDayFromDynamicalTime, julianCenturies, julianMillennia,
        calculateEaster,
        // Sternzeit
        calculateGreenwichSiderealTime, calculateLocalSiderealTime,
        // Sonne und Erdbahn
        calculateObliquity, calculateSunPosition, calculateEarthTrueAnomaly, calculateEarthEccentricity,
        calculateEquationOfTime, calculateEquinoxSolstice, calculateNextEarthApsis,
        // Koordinaten
        calculateEquatorial, calculateHorizontal, calculateParallacticAngle, calculateTopocentric,
        calculateRefraction,
        // Interpolation, Auf-/Untergang
        interpolate, calculateSunRiseSet, calculateMoonRiseSet,
        // Mond
        calculateMoonPosition, calculateMoonPositionSimple, calculateMoonAscendingNode,
        calculateMoonIlluminatedFraction, calculateMoonOrientation, calculateNextMoonApsis, calculateNextMoonNode,
    };

    if (typeof module !== 'undefined' && module.exports) {
        module.exports = api;
    } else {
        Object.assign(root, api);
    }
})(typeof globalThis !== 'undefined' ? globalThis : this);
