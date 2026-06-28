const aeTokm = 149597870.7;
const e = 0.016708634; // Exzentrizität der Erdbahn
const a = 1.000001018;  // Halbe große Achse in AE
const epsilon = 23.439292; // Mittlere Neigung Erdachse
const earthRadius = 6378.137;
const moonRadius = 1738.1;
const moonOrbitRadius = 384400;

const rad2deg = 180 / Math.PI;
const deg2rad = Math.PI / 180;

/**
 * Winkel (in Grad) in Bereich 0-360 bringen
 */
function normalizeAngleDegree(angle) {
    return ((angle % 360) + 360) % 360;
}

/**
 * Winkel (im Bogenmaß) in Bereich von -pi bis pi bringen
 */
function normalizeAngleDifferenceRad(angle) {
    let normalized = ((angle % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    if (normalized > Math.PI) {
        normalized -= 2 * Math.PI;
    }
    return normalized;
}

/**
 * Julianisches Datum aus Date-Objekt berechnen
 */
function calculateJulianDate(date) {
    let year = date.getUTCFullYear();
    let month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const hour = date.getUTCHours();
    const minute = date.getUTCMinutes();
    const second = date.getUTCSeconds();
    const millisecond = date.getUTCMilliseconds();

    if (month <= 2) {
        year -= 1;
        month += 12;
    }

    const A = Math.floor(year / 100);

    //Gregorian calendar
    let B = 2 - A + Math.floor(A / 4);

    //Julian calendar
    if ((year < 1582) ||
        ((year == 1582) && (month < 10)) ||
        ((year == 1582) && (month == 10) && (day <= 4))) {
        B = 0;
    }


    const jd = Math.floor(365.25 * (year + 4716)) +
        Math.floor(30.6001 * (month + 1)) +
        day + B - 1524.5 +
        (hour + minute / 60 + second / 3600 + millisecond / 3600000) / 24;

    return jd;
}

/**
 * Date-Objekt aus Julianischen Datum erstellen
 */
function calculateGregorianDateFromJulianDate(jd) {
    // jd + 0.5 verschiebt auf den nächsten Tag, dann teilen in Ganzzahl und Bruchteil
    let z = Math.floor(jd + 0.5);
    let f = jd + 0.5 - z;

    let a;
    if (z < 2299161) {
        a = z; // Julianischer Kalender
    } else {
        const alpha = Math.floor((z - 1867216.25) / 36524.25);
        a = z + 1 + alpha - Math.floor(alpha / 4); // Gregorianischer Kalender
    }

    const b = a + 1524;
    const c = Math.floor((b - 122.1) / 365.25);
    const d = Math.floor(365.25 * c);
    const e = Math.floor((b - d) / 30.6001);

    // Tag, Monat und Jahr berechnen
    const day = b - d - Math.floor(30.6001 * e) + f;
    const month = (e < 14) ? e - 1 : e - 13;
    const year = (month > 2) ? c - 4716 : c - 4715;

    // Berechnung der Stunden, Minuten und Sekunden aus dem Bruchteil des Tages (f)
    const dayFraction = day % 1; // Nur der Bruchteil des Tags
    const hour = Math.floor(dayFraction * 24);
    const minutes = Math.floor((dayFraction * 24 - hour) * 60);
    const seconds = Math.floor((((dayFraction * 24 - hour) * 60) - minutes) * 60);
    const milliseconds = Math.round((((((dayFraction * 24 - hour) * 60) - minutes) * 60) - seconds) * 60);
    // Erzeugt ein Datum mit Jahr, Monat, Tag, Stunden, Minuten und Sekunden
    return new Date(Date.UTC(year, month - 1, Math.floor(day), hour, minutes, seconds, milliseconds));
}

/**
 * Berechnung von Solstitien und Äquinoktien als julianisches Datum
 * @param type - "spring" für Märzäquinoktium, "summer" für Junisolstitium, "autumn" für Herbstäquinoktium, "winter" für Dezembersolstitium
 */
function calculateJDOfPoint(jear, type) {

    const factors = [
        [485, 324.96, 1934.136],
        [203, 337.23, 32964.467],
        [199, 342.08, 20.186],
        [182, 27.85, 445267.112],
        [156, 73.14, 45036.886],
        [136, 171.52, 22518.443],
        [77, 222.54, 65928.934],
        [74, 296.72, 3034.906],
        [70, 243.58, 9037.513],
        [58, 119.81, 33718.147],
        [52, 297.17, 150.678],
        [50, 21.02, 2281.226],
        [45, 247.54, 29929.562],
        [44, 325.15, 31555.956],
        [29, 60.93, 4443.417],
        [18, 155.12, 67555.328],
        [17, 288.79, 4562.452],
        [16, 198.04, 62894.029],
        [14, 199.76, 31436.921],
        [12, 95.39, 14577.848],
        [12, 287.11, 31931.756],
        [12, 320.81, 34777.259],
        [9, 227.73, 1222.114],
        [8, 15.45, 16859.074],
    ];

    const parameters = {
        "spring": [2451623.80984, 365242.37404, 0.05169, 0.00411, 0.00057],
        "summer": [2451716.56767, 365241.62603, 0.00325, 0.00888, 0.00030],
        "autumn": [2451810.21715, 365242.01767, 0.11575, 0.00337, 0.00078],
        "winter": [2451900.05952, 365242.74049, 0.06223, 0.00823, 0.00032]
    }
    jear = (jear - 2000) / 1000;

    const JDE0 = parameters[type][0] + (parameters[type][1] * jear) + (parameters[type][2] * jear ** 2) - (parameters[type][3] * jear ** 3) - (parameters[type][4] * jear ** 4);

    const T = calculateJulianEpoch(JDE0);
    const W = 35999.373 * T - 2.47; //in Grad

    const lambda = 1 + 0.0334 * Math.cos(W * deg2rad) + 0.0007 * Math.cos(2 * W * deg2rad);

    var S = 0;
    for (const vals in factors) {
        S += factors[vals][0] * Math.cos((factors[vals][1] + factors[vals][2] * T) * deg2rad);
    }

    const JDE = JDE0 + 0.00001 * S / lambda;

    return JDE;
}


/**
 * Berechnung Exzentrität der Erde nach Formel 24.4 "Astronomische Algorithmen" von Jean Meuss
 */
function calculateCurrentExcentric(jd) {
    const T = calculateJulianEpoch(jd);
    //Formel 24.4
    const e_current = 0.016708617 - T * (0.000042037 + 0.0000001236 * T);
    return e_current;
}

/**
 * Berechnung Zeitgleichung nach "Astronomische Algorithmen" von Jean Meuss
 */
function calculateEquationOfTime(jd, withEarthTilt) {
    const T = calculateJulianEpoch(jd);

    // Mittlere Anomalie der Sonne (Formel 24.3)
    const M = (357.52910 + T * (35999.05030 - 0.0001559 * T) - (T ** 3) * 0.00000048) * deg2rad;

    // Mittlere Länge der Sonne bezogen auf mittleres Äquinoktium des Datums (Formel 24.3)
    const L0 = normalizeAngleDegree((280.46644567 + T * (36000.76982779 + T * 0.0003032028)));

    // Mittelpunktsgleichung
    const C = ((1.914600 - T * (0.004817 + 0.000014 * T)) * Math.sin(M)
        + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
        + 0.000290 * Math.sin(3 * M));

    // Wahre Länge der Sonne bezogen auf mittleres Äquinoktium des Datums
    const L = (L0 + C);

    let epsilon = 0;
    if (withEarthTilt) {
        // Schiefe der Ekliptik (Formel 21.2) - Achtung, nicht für zu große T ()
        epsilon = (23.439292 - 0.013004167 * T - 0.0000001639 * T ** 2 + 0.0000005036 * T ** 3);
    }
    // Rektaszension der Sonne berechnen
    let alpha = Math.atan2(Math.cos(epsilon * deg2rad) * Math.sin(L * deg2rad), Math.cos(L * deg2rad)) * rad2deg;
    alpha = normalizeAngleDegree(alpha);

    // Zeitgleichung (Formel 27.1) ohne Nutation mit Umrechnung in Minuten
    let E = (L0 - 0.0057183 - alpha) * 4; // Umrechnung in Minuten

    /*
     * Der Bereich E muss zwischen -20 Minuten und 20 Minuten liegen
     * Vielfache von 24 Stunden können addiert oder subtrahiert werden
     */
    if (E > 60 * 12) {
        E -= 24 * 60;
    } else if (E < -60 * 12) {
        E += 24 * 60;
    }

    return E;

    /* Alternative Berechnung (nach Smart) mit geringerer Genauigkeit:
     * e: Exzentrität der Erdbahn
     * const y = Math.tan(epsilon*deg2rad/2)**2;
     * E = (y*Math.sin(2*L0*deg2rad)
     *      - 2*e*Math.sin(M)
     *      + 4*e*y*Math.sin(M)*Math.cos(2*L0*deg2rad)
     *      - 0.5*y**2*Math.sin(4*L0*deg2rad)
     *      -1.25*e**2*Math.sin(2*M))*rad2deg*4;
     *
     * Weitere Alternative - ausgehend vom Tag des Jahres:
     *  // Bestimmen des Tages im Jahr
     *  const start = new Date(datum.getFullYear(), 0, 0); // 1. Januar
     *  const diff = datum - start; // Differenz in Millisekunden
     *  const oneDay = 1000 * 60 * 60 * 24; // Millisekunden in einem Tag
     *  const tagImJahr = Math.floor(diff / oneDay) + 1; // Tage zählen ab 1
     *
     *  // Berechnung von B
     *  const B = (360 / 365) * (tagImJahr - 81) * (Math.PI / 180); // in Radiant
     *
     *  // Berechnung der Zeitgleichung (TE)
     *  const E = 9.87 * Math.sin(2 * B) - 7.53 * Math.cos(B) - 1.5 * Math.sin(B);
     *
     *  // Tageslängenkorrektur (Hier als Näherung, kann je nach Jahreszeit variieren)
     *  const tageslaenge = 24; // Standard Tageslänge in Stunden
     *  const C = (tageslaenge - 24) / 15; // Korrektur in Minuten
     *
     *  // Zeitgleichung (TE) in Minuten
     *  const TE = E + C;
     * return TE; // Ergebnis in Minuten
     */
}

/**
 * Berechnung der julianischen Epoche (julianisches Jahrtausend in Bezug auf Jahr 2000)
 */
function calculateJulianEpoch(jd) {
    return (jd - 2451545.0) / 36525.0;
}

/**
 * Berechnung Sternzeit für Greenwich aus Julianischem Datum
 */
function calculateSiderealTime(jd) {
    const T = calculateJulianEpoch(jd);
    // Greenwich Mean Sidereal Time (GMST) in degrees (Formel 11.4)
    const gmstDeg = (280.46061837 + 360.98564736629 * (jd - 2451545.0) +
        T * T * (0.000387933 - T / 38710000.0));

    // In Stunden umwandeln und im Bereich 0-24 normalisieren
    const gmst = (((gmstDeg / 15) % 24) + 24) % 24;
    return gmst;
}

/**
 * Berechnung der Ekliptikalen Länge der Sonne
 */
function calculateEclipticalLength(jd) {
    const T = calculateJulianEpoch(jd);

    // Mittlere Anomalie der Sonne (Formel 24.3)
    const M = (357.52910 + T * (35999.05030 - 0.0001559 * T) - (T ** 3) * 0.00000048) * deg2rad;

    // Mittlere Länge der Sonne bezogen auf mittleres Äquinoktium des Datums (Formel 24.3)
    const L0 = normalizeAngleDegree((280.46644567 + T * (36000.76982779 + T * 0.0003032028)));

    // Mittelpunktsgleichung - Alternative zur Lösung der Kepplergleichung
    const C = ((1.914600 - T * (0.004817 + 0.000014 * T)) * Math.sin(M)
        + (0.019993 - 0.000101 * T) * Math.sin(2 * M)
        + 0.000290 * Math.sin(3 * M));

    // Wahre Länge der Sonne bezogen auf mittleres Äquinoktium des Datums
    const L = (L0 + C) * deg2rad;
    // Wahre Anomalie: const nu = (M + C*deg2rad);
    return L;
}

/**
 * Berechnung der wahren Anomalie mit Kepplergleichung
 */
function calculateTrueAnomaly(jd) {
    const T = calculateJulianEpoch(jd);

    // Mittlere Anomalie der Sonne (Formel 24.3)
    const M = (357.52910 + T * (35999.05030 - T * (0.0001559 + T * 0.00000048))) * deg2rad;

    // Exzentrische Anomalie (E) näherungsweise
    let E = M; // Erste Näherung

    const e_current = calculateCurrentExcentric(jd);
    //Iterative Verbesserung:
    for (let i = 0; i < 10; i++) {
        E = M + e_current * Math.sin(E);
    }

    // Berechnung der wahren Anomalie (ν) in Bogenmaß
    const nu = 2 * Math.atan2(Math.sqrt(1 + e_current) * Math.sin(E / 2), Math.sqrt(1 - e_current) * Math.cos(E / 2));

    return nu;
}

/**
 * Berechnung des aktuellen Abstands Erde-Sonne aus wahrer Anomalie
 */
function calculateOrbitRadiusEarth(nu) {
    const r = a * (1 - e * e) / (1 + e * Math.cos(nu));
    return r;
}

/**
 * Berechnung der äquatorialen Koordinaten aus Ekliptischen Koordinaten
 */
function calculateRaDec(eclipticalLongitude, eclipticalLatitude) {
    const ra = Math.atan2(Math.cos(epsilon * deg2rad) * Math.sin(eclipticalLongitude) - Math.tan(eclipticalLatitude) * Math.sin(epsilon * deg2rad), Math.cos(eclipticalLongitude));
    const dek = Math.asin(Math.sin(eclipticalLatitude) * Math.cos(epsilon * deg2rad) + Math.cos(eclipticalLatitude) * Math.sin(epsilon * deg2rad) * Math.sin(eclipticalLongitude));
    return {
        "ra": ra,
        "dec": dek
    };
}

/**
 * Berechnung der horizontalen Sonnenkoordinaten aus äquatorialen Koordinaten
 */
function calculateHAzFromRaDec(raDec, siderealTime) {
    const H = siderealTime - raDec.ra;
    const A = Math.atan2(Math.sin(H),
        Math.cos(H) * Math.sin(latitude * deg2rad)
        - Math.tan(raDec.dec) * Math.cos(latitude * deg2rad));
    const h = Math.asin(Math.sin(latitude * deg2rad) * Math.sin(raDec.dec)
        + Math.cos(latitude * deg2rad) * Math.cos(raDec.dec) * Math.cos(H));
    return {
        "azimuth": A,
        "altitude": h
    };
}

/**
 * Berechnung parallaktischer Winkel - wie ein Himmelskörper während einer bestimmten Zeit am Himmel gedreht erscheint
 */
function calculateParallacticAngle(raDec, siderealTime) {
    const q = Math.atan2(Math.sin(siderealTime - raDec.ra), Math.tan(latitude * deg2rad) * Math.cos(raDec.dec) - Math.sin(raDec.dec) * Math.cos(siderealTime - raDec.ra));
    return q;
}


/**
 * Interpolationsformel aus "Astronomische Algorithmen" von Jean Meuss
 */
function interpolate(y1, y2, y3, n) {

    const a = y2 - y1
    const b = y3 - y2
    const c = b - a
    //const n = x - x2
    const y = y2 + n / 2 * (a + b + n * c);
    return y;
}

/**
 * Berechnung von Sonnenauf- und Untergang aus "Astronomische Algorithmen" von Jean Meuss
 */
function calculateSunriseSunset(jd) {
    const h0 = -0.8333;

    //Mitternacht des aktuellen Datums finden
    jd = Math.round(jd) - 0.5;

    //const length1 = calculateEclipticalLength(jd-1);
    const length2 = calculateEclipticalLength(jd);
    //const length3 = calculateEclipticalLength(jd+1);

    //const radek1 = calculateRaDecSun(length1);
    const radek2 = calculateRaDec(length2, 0);
    //const radek3 = calculateRaDecSun(length3);

    const siderealTime = calculateSiderealTime(jd) * 180 / 12;

    //Abweichung Zenit zu Sonnenaufgang/Untergang
    const cH0 = (Math.sin(h0 * deg2rad) - Math.sin(latitude * deg2rad) * Math.sin(radek2.dec)) /
        (Math.cos(latitude * deg2rad) * Math.cos(radek2.dec));

    //cH0 > 1: Objekt immer sichtbar
    //cH0 < 1: Objekt ganzen Tag nicht sichtbar
    if (cH0 < -1 || cH0 > 1) {
        return false;
    }

    const H0 = Math.acos(cH0) * rad2deg;

    // Alternative Umsetzung
    //const timequation = calculateEquationOfTime(jd,true)/60;
    //const zenit = 12 - timequation - longitude/15;
    //const rising = zenit - H0/180*12;
    //const setting = zenit + H0/180*12;


    //Erhöhte Genauigkeit
    //const DT = 80;

    //Durchgang Näherung
    const m0 = (((radek2.ra * rad2deg - longitude - siderealTime) / 360) % 1 + 1) % 1;
    //const t0 = siderealTime + 360.985647*m0;
    //const n0 = m0 + DT/86400;
    //const ra0 = interpolate(radek1.ra,radek2.ra,radek3.ra,n0);
    //let DH0 = t0 + longitude - ra0*rad2deg;
    //while (DH0 > 180) DH0-=360;
    //while (DH0 < -180) DH0+=360;
    //const Dm0 = -DH0/360;

    //Aufgang Näherung
    let m1 = (((m0 - H0 / 360) % 1) + 1) % 1;
    // for(let i = 0; i < 0; i++) {
    //     const t1 = siderealTime + 360.985647*m1;
    //     const ra1 = radek2.ra;//interpolate(radek1.ra,radek2.ra,radek3.ra,m1 + DT/86400);
    //     const dek1 = radek2.dec;//interpolate(radek1.dec,radek2.dec,radek3.dec,m1 + DT/86400);
    //     const DH1 = t1 + longitude;
    //     const az_rise = calculateHAzFromRaDec({ra:ra1,dek:dek1},DH1/180*12);
    //     const Dm = (az_rise.height*rad2deg - h0)/(360*Math.cos(dek1)*Math.cos(latitude*deg2rad)*Math.sin(DH1*deg2rad-ra1));
    //     m1 += Dm;
    // }
    //Untergang Näherung
    const m2 = (((m0 + H0 / 360) % 1) + 1) % 1;
    // const t2 = siderealTime + 360.985647*m2;
    // const n2 = m2 + DT/86400;
    // const ra2 = interpolate(radek1.ra,radek2.ra,radek3.ra,n2);
    // const DH2 = t2 + longitude - ra0;
    // const Dm2 = -DH2/360;

    return {
        zenit: (m0) * 24,
        rising: (m1) * 24,
        setting: m2 * 24
    };
}

/**
 * Näherungsweise Berechnung von Perihel und Aphel eines Jahres aus "Astronomische Algorithmen" von Jean Meuss
 */
function calculatePerihelAphel(date, type) {

    let year = date.getUTCFullYear();
    year += (date.getUTCMonth() + 1) / 12;

    //Kapitel 37
    let k = 0.99997 * (year - 2000.01);


    const correctionFactorsA = [
        [328.41, 132.788585],
        [316.13, 584.903153],
        [346.20, 450.380738],
        [136.95, 659.306737],
        [249.52, 329.653368]
    ];

    const correctionFactors = {
        "perihel": [
            1.278,
            -0.055,
            -0.091,
            -0.056,
            -0.045],
        "aphel": [
            -1.352,
            0.061,
            0.062,
            0.029,
            0.031
        ]
    };

    if (k < 0) {
        k = Math.ceil(k);
    } else {
        k = Math.floor(k);
    }
    if (type == "aphel") {
        k += 0.5;
    }

    let correction = 0;
    for (let i = 0; i < 5; i++) {
        correction += correctionFactors[type][i] * Math.sin((correctionFactorsA[i][0] + correctionFactorsA[i][1] * k) * deg2rad);
    }

    const JDE = 2451547.507 + k * (365.2596358 + 0.0000000158 * k);
    return JDE + correction;
}

function calculateMoon(jd) {
    const T = calculateJulianEpoch(jd);

    //Mittlere Länge des Mondes mit kontanten Term Lichtzeit (45.1)
    const l = normalizeAngleDegree(218.3164591 + T * (481267.88134236 - 0.0013268 * T) + T ** 3 / 538841 - T ** 4 / 65194000) * deg2rad;

    //Mittlere Elongation = Differenz der Längen von Sonne und Mond (45.2)
    const D = normalizeAngleDegree(297.8502042 + T * (445267.1115168 - T * 0.0016300) + T ** 3 / 545868 - T ** 4 / 113065000) * deg2rad;

    // Mittlere Anomalie der Sonne (45.3)
    const M = normalizeAngleDegree(357.5291092 + T * (35999.0502909 + T * (-0.0001536 + T / 24490000))) * deg2rad;

    //Mittlere Anomalie des Mondes (45.4)
    const m = normalizeAngleDegree(134.9634114 + T * (477198.8676313 + 0.0089970 * T) + T ** 3 / 69699 - T ** 4 / 14712000) * deg2rad;

    // Mittlere Abstand des Mondes vom aufsteigenden Knoten (45.5)
    const F = normalizeAngleDegree(93.2720993 + T * (483202.0175273 - 0.0034029 * T) - T ** 3 / 3526000 + T ** 4 / 863310000) * deg2rad;

    const A1 = normalizeAngleDegree(119.75 + 131.849 * T) * deg2rad;
    const A2 = normalizeAngleDegree(53.09 + 479264.290 * T) * deg2rad;
    const A3 = normalizeAngleDegree(313.45 + 481266.484 * T) * deg2rad;

    //Änderung der Exzentrität der Erde (45.6)
    const E = 1 + T * (-0.002516 - 0.0000074 * T);

    //Tabelle 45.1
    // D, M, m, F, suml, sumr
    const ta = [
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
        [2, 0, -1, -2, 0, 8752]
    ];

    //Tabelle 45.2
    const tb = [
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
        [2, -2, 0, 1, 107]
    ];

    let suml = 0;
    let sumr = 0;

    for (const i in ta) {
        const sl = ta[i][4] * Math.sin(ta[i][0] * D + ta[i][1] * M + ta[i][2] * m + ta[i][3] * F);
        const sr = ta[i][5] * Math.cos(ta[i][0] * D + ta[i][1] * M + ta[i][2] * m + ta[i][3] * F);
        switch (ta[i][1]) {
            case 0:
                suml += sl;
                sumr += sr;
                break;
            case 1:
            case -1:
                suml += sl * E;
                sumr += sr * E;
                break;
            case 2:
            case -2:
                suml += sl * E * E;
                sumr += sr * E * E;
                break;
        }
    }


    suml += 3958 * Math.sin(A1); //Einfluss Venus
    suml += 1962 * Math.sin(l - F); //Einfluss Abplattung Erde
    suml += 318 * Math.sin(A2); //Einfluss Jupiter

    let sumb = 0;
    for (const i in tb) {
        const sb = tb[i][4] * Math.sin(tb[i][0] * D + tb[i][1] * M + tb[i][2] * m + tb[i][3] * F);
        switch (tb[i][1]) {
            case 0:
                sumb += sb;
                break;
            case 1:
            case -1:
                sumb += sb * E;
                break;
            case 2:
            case -2:
                sumb += sb * E * E;
                break;
        }
    }

    sumb += -2235 * Math.sin(l); //Einfluss Abplattung Erde
    sumb += 382 * Math.sin(A3);
    sumb += 175 * Math.sin(A1 - F);
    sumb += 175 * Math.sin(A1 + F);
    sumb += 127 * Math.sin(l - m);
    sumb += -115 * Math.sin(l + m);

    return {
        "longitude": l + (suml / 1000000) * deg2rad,
        "latitude": (sumb / 1000000) * deg2rad,
        "distance": 385000.56 + sumr / 1000
    }
}

/**
 * Vereinfachte Berechnung der Mondposition aus Montenbruck
 */
function calculateMoonSimple(jd) {
    const ARC = 206264.8062;
    const T = calculateJulianEpoch(jd);

    /* Mittlere Elemente der Mondbahn */
    const l0 = ((0.606433 + 1336.855225 * T) % 1 + 1) % 1;
    const l = 2 * Math.PI * ((((0.374897 + 1325.552410 * T) % 1) + 1) % 1);
    const ls = 2 * Math.PI * ((((0.993133 + 99.997361 * T) % 1) + 1) % 1);
    const d = 2 * Math.PI * ((((0.827361 + 1236.853086 * T) % 1) + 1) % 1);
    const f = 2 * Math.PI * ((((0.259086 + 1342.227825 * T) % 1) + 1) % 1);

    /* Laengenstoerungen in Bogensekunden */
    const dl = +22640 * Math.sin(l) - 4586 * Math.sin(l - 2 * d) + 2370 * Math.sin(2 * d)
        + 769 * Math.sin(2 * l) - 668 * Math.sin(ls) - 412 * Math.sin(2 * f)
        - 212 * Math.sin(2 * l - 2 * d) - 206 * Math.sin(l + ls - 2 * d) + 192 * Math.sin(l + 2 * d)
        - 165 * Math.sin(ls - 2 * d) - 125 * Math.sin(d) - 110 * Math.sin(l + ls)
        + 148 * Math.sin(l - ls) - 55 * Math.sin(2 * f - 2 * d);

    /* Breitenstoerungen */
    const s = f + (dl + 412 * Math.sin(2 * f) + 541 * Math.sin(ls)) / ARC;
    const h = f - 2 * d;
    const n = -526 * Math.sin(h) + 44 * Math.sin(l + h) - 31 * Math.sin(-l + h) - 23 * Math.sin(ls + h)
        + 11 * Math.sin(-ls + h) - 25 * Math.sin(-2 * l + f) + 21 * Math.sin(-l + f);

    const l_moon = 2 * Math.PI * ((((l0 + dl / 1296000.0) % 1) + 1) % 1); /* ekliptikale Laenge [rad] */
    const b_moon = (18520.0 * Math.sin(s) + n) / ARC;   /* ekliptikale Breite [rad] */

    const rd = calculateRaDec(l_moon, b_moon);
    return rd;
}

//Quadratische Interpolation aus Montenbruck
// y_minus, y_0, y_plus: Werte der Funktion an den drei Stützstellen x = -1, x = 0, x = +1
function calculateQuad(y_minus, y_0, y_plus) {
    // y_minus = a*(-1)**2 + b*(-1) + c = a - b + c
    // y_0     = a*0**2    + b*0    + c = c
    // y_plus  = a*1**2    + b*1    + c = a + b + c
    const a = 0.5 * (y_minus + y_plus) - y_0;
    const b = 0.5 * (y_plus - y_minus);
    const c = y_0;

    let q = {};
    q.a = a;
    q.b = b;
    q.c = c;


    q.nz = 0;
    // Scheitelpunkt: y' = 2*a*x + b = 0  =>  xe = -b/(2*a)
    //                ye = a*xe^2 + b*xe + c   (hier per Horner-Schema)
    q.vertex_x = -b / (2.0 * a);
    q.vertex_y = (a * q.vertex_x + b) * q.vertex_x + c;

    q.zero1 = q.zero2 = 0.0;
    const dis = b * b - 4.0 * a * c;
    if (dis >= 0.0) {
        const dx = 0.5 * Math.sqrt(dis) / Math.abs(a);
        q.zero1 = q.vertex_x - dx;
        q.zero2 = q.vertex_x + dx;
        if (Math.abs(q.zero1) <= 1.0) q.nz++;
        if (Math.abs(q.zero2) <= 1.0) q.nz++;
        if (q.zero1 < -1.0) q.zero1 = q.zero2;  /* nur zero2 liegt im Intervall */
    }
    return q;
}

//functioncalculateMoonSinAlt(jd, longitude, cos_lat, sin_lat)
//{
//    const moon  = calculateMoonSimple(jd);
//    const tau   = calculateSiderealTime(jd)*Math.PI/12 + longitude*deg2rad - moon.ra;  /* Stundenwinkel [Rad] */
//    return sin_lat * Math.sin(moon.dec) + cos_lat * Math.cos(moon.dec) * Math.cos(tau);
//}


function calculateMoonRiseSet(jd, longitude, latitude) {

    //const cos_lat = Math.cos(latitude * deg2rad);
    //const sin_lat = Math.sin(latitude * deg2rad);

    /* Horizonthoehe fuer Mondaufgang: h = +8' (Mondparallaxe minus Refraktion) */
    const sinh0 = 0.0023271; /* sin(+8/60 Grad) */

    //Mitternacht des aktuellen Datums finden
    jd = Math.round(jd) - 0.5;

    // Schleifenvariablen:
    //
    let hour = 1.0;
    let moon0 = calculateMoonSimple(jd);
    let t0 = calculateSiderealTime(jd) * Math.PI / 12 + longitude * deg2rad;
    let alt0 = calculateHAzFromRaDec(moon0, t0).altitude - sinh0;

    let result = {
        utrise: 0, utset: 0, above: (alt0 > 0.0), rise: false, sett: false,
        zenit: 0, maxalt: -Infinity, maxalt_time: 0
    };

    do {

        const moon1 = calculateMoonSimple(jd + hour / 24);
        const t1 = calculateSiderealTime(jd + hour / 24) * Math.PI / 12 + longitude * deg2rad;
        const alt1 = calculateHAzFromRaDec(moon1, t1).altitude - sinh0;

        const moon2 = calculateMoonSimple(jd + (hour + 1) / 24);
        const t2 = calculateSiderealTime(jd + (hour + 1) / 24) * Math.PI / 12 + longitude * deg2rad;
        const alt2 = calculateHAzFromRaDec(moon2, t2).altitude - sinh0;

        // Stundenwinkel t - ra: 2π-Sprünge relativ zur mittleren Stützstelle entfernen,
        // damit die quadratische Interpolation eine glatte Funktion sieht.
        const ha1 = normalizeAngleDifferenceRad(t1 - moon1.ra);
        const ha0 = ha1 + normalizeAngleDifferenceRad((t0 - moon0.ra) - ha1);
        const ha2 = ha1 + normalizeAngleDifferenceRad((t2 - moon2.ra) - ha1);
        const q_zenit = calculateQuad(ha0, ha1, ha2);
        if (result.zenit === 0 && q_zenit.nz > 0) {
            const z = (Math.abs(q_zenit.zero1) <= 1.0) ? q_zenit.zero1 : q_zenit.zero2;
            result.zenit = hour + z;
        }

        const q_alt = calculateQuad(alt0, alt1, alt2);

        // Scheitel ist nur dann ein Maximum, wenn a < 0; und er muss im Intervall liegen.
        if (q_alt.a < 0 && Math.abs(q_alt.vertex_x) <= 1.0 && q_alt.vertex_y > result.maxalt) {
            result.maxalt = q_alt.vertex_y;
            result.maxalt_time = hour + q_alt.vertex_x;
        }


        if (q_alt.nz == 1 && !(result.rise || result.sett)) {
            if (alt0 < 0.0) {
                result.utrise = hour + q_alt.zero1;
                result.rise = true;
            }
            else {
                result.utset = hour + q_alt.zero1;
                result.sett = true;
            }
        }
        else if (q_alt.nz == 2 && !(result.rise || result.sett)) {
            if (q_alt.vertex_y < 0.0) {
                result.utrise = hour + q_alt.zero2;
                result.utset = hour + q_alt.zero1;
            }
            else {
                result.utrise = hour + q_alt.zero1;
                result.utset = hour + q_alt.zero2;
            }
            result.rise = true;
            result.sett = true;
        }


        alt0 = alt2;
        t0 = t2;
        moon0 = moon2;
        hour += 2.0;

    } while (hour < 25.0);
    return result;
}

function calculateAscendingNodeMoon(jd) {
    const T = calculateJulianEpoch(jd);
    const ascendingNode = 125.0445550 - 1934.1361849 * T + 0.0020762 * T ** 2 + T ** 3 / 467410 - T ** 4 / 60616000;
    return normalizeAngleDegree(ascendingNode) * deg2rad;
}

function findNearestRisingNodeMoon(jd) {
    //year from julian date
    let year = 2000 + (jd - 2451545.0) / 365.25;

    let k = (year - 2000.05) * 13.4223;
    if (k < 0) {
        k = Math.ceil(k);
    } else {
        k = Math.floor(k);
    }

    //Maximal 10 Iterationen
    for (let i = 0; i < 10; i++) {
        const nodeTime = calculateTimeOfNodeMoon(k, true);
        if (Math.abs(nodeTime - jd) < 2 * 13.4223) {
            return nodeTime;
        }
        if (nodeTime > jd) {
            k--;
        } else {
            k++;
        }
    }

    return k;
}
function calculateTimeOfNodeMoon(k, risingNode) {
    const h = (risingNode) ? 0.0 : 0.5;
    k = Math.floor(k - h + .5) + h;   // snap to half orbit
    const T = k / 1342.23;
    const D = (183.638 + 331.73735682 * k + T * T * (.0014852 + T * (.00000209 + T * (-.00000001)))) * deg2rad;
    const M = (17.4006 + 26.8203725 * k + T * T * (.0001186 + T * (-.00000006))) * deg2rad;
    const Md = (38.3776 + 355.52747313 * k + T * T * (.0123499 + T * (.000014627 + T * (-.000000069)))) * deg2rad;
    const Omega = (123.9767 - 1.44098956 * k + T * T * (.0020608 + T * (.00000214 + T * (-.000000016)))) * deg2rad;
    const V = (299.75 + T * (132.85 + T * (-.009173))) * deg2rad;
    const P = Omega + (272.75 - 2.3 * T) * deg2rad;
    const E = 1 + T * (-.002516 + T * (-.0000074));

    const jd = 2451565.1619 + 27.212220817 * k +
        T * T * (.0002762 + T * (.000000021 - T * 0.000000000088)) +
        -.4721 * Math.sin(Md) +
        -.1649 * Math.sin(2 * D) +
        -.0868 * Math.sin(2 * D - Md) +
        .0084 * Math.sin(2 * D + Md) +
        -.0083 * Math.sin(2 * D - M) * E +
        -.0039 * Math.sin(2 * D - M - Md) * E +
        .0034 * Math.sin(2 * Md) +
        -.0031 * Math.sin(2 * (D - Md)) +
        .0030 * Math.sin(2 * D + M) * E +
        .0028 * Math.sin(M - Md) * E +
        .0026 * Math.sin(M) * E +
        .0025 * Math.sin(4 * D) +
        .0024 * Math.sin(D) +
        .0022 * Math.sin(M + Md) * E +
        .0017 * Math.sin(Omega) +
        .0014 * Math.sin(4 * D - Md) +
        .0005 * Math.sin(2 * D + M - Md) * E +
        .0004 * Math.sin(2 * D - M + Md) * E +
        -.0003 * Math.sin(2 * (D - M)) * E +
        .0003 * Math.sin(4 * D - M) * E +
        .0003 * Math.sin(V) +
        .0003 * Math.sin(P);
    return jd;
}

function calculateMoonPhase(sunRaDec, sunDistance, moonRaDec, moonDistance) {

    const cosPsi = Math.sin(sunRaDec.dec) * Math.sin(moonRaDec.dec) + Math.cos(sunRaDec.dec) * Math.cos(moonRaDec.dec) * Math.cos(sunRaDec.ra - moonRaDec.ra);

    const i = Math.atan2(sunDistance * Math.sin(Math.acos(cosPsi)), (moonDistance - sunDistance * cosPsi));
    const k = (1 + Math.cos(i)) / 2;

    //             //const chi = Math.atan2(Math.cos(sunRadek.dec)*Math.sin(sunRadek.ra - moonRaDec.ra),
    //             Math.sin(sunRadek.dec)*Math.cos(moonRaDec.dec) - Math.cos(sunRadek.dec)*Math.sin(moonRaDec.dec)*Math.cos(sunRadek.ra - moonRaDec.ra)
    //             )
    //             // k = 0: a = max, k = 0.5 => a = 0.5, k = 1: a = max
    //             const a = Math.abs(1-k*2);
    //             const dir = (k <= 0.5)?false:true;
    //
    //
    //             // Formel 46.1
    //             //const k = (1 + Math.cos(i))/2;
    //
    //             //Vereinfachung: cos(i) = -cos(psi)
    //             const k = (1 - Math.cos(moon.latitude)*Math.cos(moon.longitude-sunLongitude))/2;

    return k;
}

function calculateParallax(objRaDec, parallax, direction) {

    const ba = 0.99664719;
    const H = 0;
    const u = Math.atan(ba * Math.tan(latitude * deg2rad));
    const rhoSinPhi = ba * Math.sin(u) + H / 6378140 * Math.sin(latitude * deg2rad);
    const rhoCosPhi = Math.cos(u) + H / 6378140 * Math.cos(latitude * deg2rad);

    const alpha = Math.atan(-rhoCosPhi * Math.sin(parallax) * Math.sin(direction - objRaDec.ra) / (Math.cos(objRaDec.dec) - rhoCosPhi * Math.sin(parallax) * Math.cos(direction - objRaDec.ra)));

    const dek = Math.atan2(
        (Math.sin(objRaDec.dec) - rhoSinPhi * Math.sin(parallax)) * Math.cos(alpha), (Math.cos(objRaDec.dec) - rhoCosPhi * Math.sin(parallax) * Math.cos(direction - objRaDec.ra)));
    return {
        "ra": objRaDec.ra + alpha,
        "dec": dek
    };
}

function calculateMoonAxis(jd, moon) {
    const T = calculateJulianEpoch(jd);

    const ascendingNode = calculateAscendingNodeMoon(jd);
    const I = 1.54242 * deg2rad; //Winkel Mondäquator - Ekliptik 1,54242°
    const lambda = moon.longitude; //scheinbare geozentrische Länge Mond
    const beta = moon.latitude; //scheinbare geozentrische Breite Mond

    //Änderung der Exzentrität der Erde
    const E = 1 + T * (-0.002516 - 0.0000074 * T);

    //Mittlere Länge des Mondes mit kontanten Term Lichtzeit (45.1)
    const l = normalizeAngleDegree(218.3164591 + T * (481267.88134236 - 0.0013268 * T) + T ** 3 / 538841 - T ** 4 / 65194000) * deg2rad;

    //Mittlere Elongation = Differenz der Längen von Sonne und Mond (45.2)
    const D = normalizeAngleDegree(297.8502042 + T * (445267.1115168 - T * 0.0016300) + T ** 3 / 545868 - T ** 4 / 113065000) * deg2rad;

    // Mittlere Anomalie der Sonne (45.3)
    const M = normalizeAngleDegree(357.5291092 + T * (35999.0502909 + T * (-0.0001536 + T / 24490000))) * deg2rad;

    //Mittlere Anomalie des Mondes (45.4)
    const m = normalizeAngleDegree(134.9634114 + T * (477198.8676313 + 0.0089970 * T) + T ** 3 / 69699 - T ** 4 / 14712000) * deg2rad;

    // Mittlere Abstand des Mondes vom aufsteigenden Knoten (45.5)
    const F = normalizeAngleDegree(93.2720993 + T * (483202.0175273 - 0.0034029 * T) - T ** 3 / 3526000 + T ** 4 / 863310000) * deg2rad;

    const W = lambda - ascendingNode;

    //Formel 51.1
    const A = Math.atan2(Math.sin(W) * Math.cos(beta) * Math.cos(I) - Math.sin(beta) * Math.sin(I), Math.cos(W) * Math.cos(beta));

    //optische Liberation
    const l1 = A - F;
    const b1 = Math.asin(-Math.sin(W) * Math.cos(beta) * Math.sin(I) - Math.sin(beta) * Math.cos(I));

    const K1 = 119.75 + 131.849 * T;
    const K2 = 72.56 + 20.186 * T;

    const rho = (
        -.02752 * Math.cos(m) +
        -.02245 * Math.sin(F) +
        .00684 * Math.cos(m - 2 * F) +
        -.00293 * Math.cos(2 * F) +
        -.00085 * Math.cos(2 * (F - D)) +
        -.00054 * Math.cos(m - 2 * D) +
        -.0002 * Math.sin(m + F) +
        -.0002 * Math.cos(m + 2 * F) +
        -.0002 * Math.cos(m - F) +
        .00014 * Math.cos(m + 2 * (F - D))) * deg2rad;

    const sigma = (
        -.02816 * Math.sin(m) +
        .02244 * Math.cos(F) +
        -.00682 * Math.sin(m - 2 * F) +
        -.00279 * Math.sin(2 * F) +
        -.00083 * Math.sin(2 * (F - D)) +
        .00069 * Math.sin(m - 2 * D) +
        .0004 * Math.cos(m + F) +
        -.00025 * Math.sin(2 * m) +
        -.00023 * Math.sin(m + 2 * F) +
        .0002 * Math.cos(m - F) +
        .00019 * Math.sin(m - F) +
        .00013 * Math.sin(m + 2 * (F - D)) +
        -.0001 * Math.cos(m - 3 * F)) * deg2rad;

    const tau = (
        .0252 * Math.sin(M) * E +
        .00473 * Math.sin(2 * (m - F)) +
        -.00467 * Math.sin(m) +
        .00396 * Math.sin(K1) +
        .00276 * Math.sin(2 * (m - D)) +
        .00196 * Math.sin(ascendingNode) +
        -.00183 * Math.cos(m - F) +
        .00115 * Math.sin(m - 2 * D) +
        -.00096 * Math.sin(m - D) +
        .00046 * Math.sin(2 * (F - D)) +
        -.00039 * Math.sin(m - F) +
        -.00032 * Math.sin(m - M - D) +
        .00027 * Math.sin(2 * (m - D) - M) +
        .00023 * Math.sin(K2) +
        -.00014 * Math.sin(2 * D) +
        .00014 * Math.cos(2 * (m - F)) +
        -.00012 * Math.sin(m - 2 * F) +
        -.00012 * Math.sin(2 * m) +
        .00011 * Math.sin(2 * (m - M - D))) * deg2rad;

    const l2 = -tau + (rho * Math.cos(A) + sigma * Math.sin(A)) * Math.tan(b1);
    const b2 = sigma * Math.cos(A) - rho * Math.sin(A);

    const moonRaDec = calculateRaDec(moon.longitude, moon.latitude);

    const V = ascendingNode + sigma / Math.sin(I);
    const X = Math.sin(I + rho) * Math.sin(V);
    const Y = Math.sin(I + rho) * Math.cos(V) * Math.cos(epsilon * deg2rad) - Math.cos(I + rho) * Math.sin(epsilon * deg2rad);

    const w = Math.atan2(X, Y);
    const P = Math.asin(Math.sqrt(X ** 2 + Y ** 2) * Math.cos(moonRaDec.ra - w) / Math.cos(moon.latitude));

    return {
        libration: {
            longitude: (l1 + l2),
            latitude: (b1 + b2),
        },
        axle: P
    }
}

// Node.js (CommonJS): const astro = require('./astro.js')
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        aeTokm, e, a, epsilon, earthRadius, moonRadius, moonOrbitRadius, rad2deg, deg2rad,
        normalizeAngleDegree, normalizeAngleDifferenceRad,
        calculateJulianDate, calculateGregorianDateFromJulianDate, calculateJDOfPoint,
        calculateCurrentExcentric, calculateEquationOfTime, calculateJulianEpoch,
        calculateSiderealTime, calculateEclipticalLength, calculateTrueAnomaly,
        calculateOrbitRadiusEarth, calculateRaDec, calculateHAzFromRaDec,
        calculateParallacticAngle, interpolate, calculateSunriseSunset,
        calculatePerihelAphel, calculateMoon, calculateMoonSimple, calculateQuad,
        calculateMoonRiseSet, calculateAscendingNodeMoon, findNearestRisingNodeMoon,
        calculateTimeOfNodeMoon, calculateMoonPhase, calculateParallax, calculateMoonAxis,
    };
}
