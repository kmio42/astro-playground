
const double deg2rad = M_PI/180;
const double epsilon = 23.439292; // Mittlere Neigung Erdachse





double normalizeAngleDegree(double angle) {
    angle = fmod(angle, 360.0); // Modulo mit 360
    if (angle < 0) {
        angle += 360.0; // In den positiven Bereich verschieben
    }
    return angle;
}

double calculateJulianEpoch(double jd) {
    return (jd - 2451545.0) / 36525.0;
}

double calculateEquationOfTime(double jd) {
    double T = calculateJulianEpoch(jd);

    // Mittlere Anomalie der Sonne (Formel 24.3)
    double M = (357.52910 + T * (35999.05030 - T * (0.0001559 - T*0.00000048)))*deg2rad;

    // Mittlere Länge der Sonne bezogen auf mittleres Äquinoktium des Datums (Formel 24.3)
    double L0 = normalizeAngleDegree((280.46644567 + T * (36000.76982779 + T * 0.0003032028)));

    // Mittelpunktsgleichung
    double C = ((1.914600 - T * (0.004817 + 0.000014 * T)) * sin(M)
                    + (0.019993 - 0.000101 * T) * sin(2 * M)
                    + 0.000290 * sin(3 * M));

    // Wahre Länge der Sonne bezogen auf mittleres Äquinoktium des Datums
    double L =  (L0 + C);

    // Rektaszension der Sonne berechnen
    double alpha = atan2(cos(epsilon * deg2rad) * sin(L* deg2rad), cos(L* deg2rad))*rad2deg;
    alpha = normalizeAngleDegree(alpha);

    // Zeitgleichung (Formel 27.1) ohne Nutation mit Umrechnung in Minuten
    double E = (L0 - 0.0057183 - alpha) * 4; // Umrechnung in Minuten

    /*
    * Der Bereich E muss zwischen -20 Minuten und 20 Minuten liegen
    * Vielfache von 24 Stunden können addiert oder subtrahiert werden
    */
    if(E > 60*12) {
        E-=24*60;
    } else if(E < -60*12) {
        E+=24*60;
    }

            return E;
}
