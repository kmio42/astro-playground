        // Gemeinsame Variablen
        var datetime = new Date();
        var intervalId;
        var addTimeOffset;
        var latitude = 0;  // Breitengrad Ort
        var longitude = 0; // Längengrad Ort

    /////////////////////////////////////////////////////////////////
    //              Formatierungsfunktionen                        //
    /////////////////////////////////////////////////////////////////

        /**
         * String-Ausgabe im Gradmaß von einem Winkel im Bogenmaß
         */
        function radToDegString(rad) {
            const normalizedDegree = normalizeAngleDegree(rad*rad2deg);
            const degInteger = Math.floor(normalizedDegree);
            const minutes = Math.floor((normalizedDegree-degInteger)*60);
            const seconds = Math.floor(((normalizedDegree-degInteger)*60-minutes)*60);
            let str = degInteger.toString().padStart(3,' ') + '°';
            str += minutes.toString().padStart(2, '0')+"'";
            str += seconds.toString().padStart(2, '0')+"''";
            return str;
        }

        /**
         * String-Ausgabe von einer Zeitangabe in Stunden mit Bruchteilen von Minuten
         * (oder von Minuten mit Bruchteilen von Sekunden)
         */
        function hoursToString(hours) {
            const t = Math.floor(Math.abs(hours));
            const m = Math.floor(Math.abs((hours - Math.sign(hours)*t)*60));
            return ((Math.sign(hours)<0)?'-':'') + t.toString().padStart(2, '0')+':'+m.toString().padStart(2,'0');
        }

        /**
         * String-Ausgabe von einem Date-Objekt
         */
        function gregorianDateToString(date) {
            let str = date.getUTCDate().toString().padStart(2,'0');
            str += '.' + (date.getUTCMonth()+1).toString().padStart(2,'0');
            str += '.' + date.getUTCFullYear().toString().padStart(4,'0');
            str += ' ' + date.getUTCHours().toString().padStart(2, '0');
            str += ':' + date.getUTCMinutes().toString().padStart(2, '0');
            str += ':' + date.getUTCSeconds().toString().padStart(2,'0');
            return str;
        }

    /////////////////////////////////////////////////////////////////
    //            Dynamische Tabellenausgabe                       //
    /////////////////////////////////////////////////////////////////

        /**
         * Ausgabetabelle dynamisch rendern.
         * rows ist ein Array von Objekten mit folgenden Feldern:
         *   { type: 'category', text: 'Kategorie', value: 'optional' }
         *   { type: 'row', key: 'Schlüssel (HTML erlaubt)', value: 'Wert' }
         */
        function renderOutputTable(containerId, rows) {
            const container = document.getElementById(containerId);
            const table = document.createElement('table');
            for (const row of rows) {
                const tr = document.createElement('tr');
                if (row.type === 'category') {
                    if (row.value !== undefined) {
                        // Kategoriezeile mit eigenem Wert (z.B. Gesamtzeigleichung)
                        const td1 = document.createElement('td');
                        td1.colSpan = 2;
                        td1.innerHTML = row.text;
                        const td2 = document.createElement('td');
                        td2.textContent = row.value;
                        tr.appendChild(td1);
                        tr.appendChild(td2);
                    } else {
                        // Reine Kategorieüberschrift
                        const td = document.createElement('td');
                        td.colSpan = 3;
                        td.innerHTML = row.text;
                        tr.appendChild(td);
                    }
                } else {
                    // Normale Zeile mit Einrückung, Schlüssel, Wert
                    const tdIndent = document.createElement('td');
                    tdIndent.innerHTML = '&nbsp;&nbsp;&nbsp;';
                    const tdKey = document.createElement('td');
                    tdKey.innerHTML = row.key;
                    const tdVal = document.createElement('td');
                    tdVal.textContent = row.value;
                    tr.appendChild(tdIndent);
                    tr.appendChild(tdKey);
                    tr.appendChild(tdVal);
                }
                table.appendChild(tr);
            }
            container.replaceChildren(table);
        }

    /////////////////////////////////////////////////////////////////
    //              Formulare befüllen                             //
    /////////////////////////////////////////////////////////////////

        function fillGregorianDate(date) {
            document.getElementById('date').value = date.toISOString().substring(0, 10);
            document.getElementById('time').value = date.getUTCHours().toString().padStart(2, '0')+':'+date.getUTCMinutes().toString().padStart(2, '0');
            document.getElementById('seconds').value = date.getUTCSeconds() + '.' + date.getUTCMilliseconds();
        }

        function fillJulianDate(jd) {
            document.getElementById('julianDate').value = jd.toFixed(8);
        }

        function fillSiderealTime(time) {
            document.getElementById('siderealTime').value = hoursToString(time);
            const remainingHours = time - Math.floor(time);
            const remainingMinutes = remainingHours * 60 - Math.floor(remainingHours * 60);
            const seconds = remainingMinutes * 60;
            document.getElementById('siderealSeconds').value = seconds.toFixed(3);

            const timeLocal = (time+longitude/15)%24;
            const remainingHoursLocal = timeLocal - Math.floor(timeLocal);
            const remainingMinutesLocal = remainingHoursLocal - Math.floor(remainingHoursLocal);
            const secondsLocal = remainingMinutesLocal * 60;

            document.getElementById('siderealTimeLocal').innerHTML = hoursToString(timeLocal);
            document.getElementById('siderealSecondsLocal').innerHTML = secondsLocal.toFixed(3);
        }

    /////////////////////////////////////////////////////////////////
    //              Koordinateneingabe                             //
    /////////////////////////////////////////////////////////////////

        function dmsToDecimal(dms) {
            const regex = /^(\d{1,3})°\s*(\d{1,2})'?\s*(\d{1,2}(\.\d+)?)"?\s*([NSEW])?$/i;
            const match = dms.match(regex);
            if (!match) throw new Error('Ungültiges DMS-Format');
            const degrees = parseFloat(match[1]);
            const minutes = parseFloat(match[2]);
            const secs = parseFloat(match[3]);
            const direction = match[5]?.toUpperCase();
            let decimal = degrees + minutes / 60 + secs / 3600;
            if (direction === 'S' || direction === 'W') decimal = -decimal;
            return decimal;
        }

        function validateCoordinate(input, type) {
            const decimalRegex = /^-?\d+(\.\d+)?$/;
            const dmsRegex = /^(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(\.\d+)?)"?\s*([NSWE])$/;
            const feedbackElement = document.getElementById(`${type}-feedback`);
            const inputElement = document.getElementById(`${type}`);
            let value = NaN;

            if (decimalRegex.test(input)) {
                feedbackElement.className = 'feedback valid';
                inputElement.style.borderColor = '';
                value = parseFloat(input);
            } else if (dmsRegex.test(input)) {
                feedbackElement.className = 'feedback valid';
                inputElement.style.borderColor = '';
                value = dmsToDecimal(input);
            } else {
                inputElement.style.borderColor = 'red';
                feedbackElement.className = 'feedback invalid';
            }

            if (type === 'longitude' && !isNaN(value)) {
                longitude = value;
                const julianDate = calculateJulianDate(datetime);
                fillSiderealTime(calculateSiderealTime(julianDate));
                berechneDaten();
            } else if (type === 'latitude' && !isNaN(value)) {
                latitude = value;
                berechneDaten();
            }
        }

    /////////////////////////////////////////////////////////////////
    //              Zeitsteuerung                                  //
    /////////////////////////////////////////////////////////////////

        function changeJD() {
            const jdInput = parseFloat(document.getElementById('julianDate').value);
            if (isNaN(jdInput)) return;
            datetime = calculateGregorianDateFromJulianDate(jdInput);
            fillGregorianDate(datetime);
            fillSiderealTime(calculateSiderealTime(jdInput));
            berechneDaten();
        }

        function changeGregorianDate() {
            const dateInput = document.getElementById('date').value;
            const timeInput = document.getElementById('time').value;
            const secondInput = document.getElementById('seconds').value;
            const datetime_new = new Date(`${dateInput}T${timeInput}Z`);
            if (isNaN(datetime_new.getTime())) return;
            const seconds = parseFloat(secondInput);
            if (isNaN(seconds)) return;
            datetime_new.setUTCSeconds(Math.floor(seconds));
            datetime_new.setUTCMilliseconds((seconds-Math.floor(seconds))*1000);
            datetime = datetime_new;
            const julianDate = calculateJulianDate(datetime);
            fillJulianDate(julianDate);
            fillSiderealTime(calculateSiderealTime(julianDate));
            berechneDaten();
        }

        function changeSiderealTime() {
            /*
             * Grundidee:
             * 1. Sternzeit von Mitternacht des angegebenen Datums berechnen
             * 2. Differenz in Millisekunden zu eingegebener Sternzeit berechnen
             * 3. Datum/Zeit-Objekt auf berechnete Zeit anpassen
             *
             * 1 Sterntag hat 86164100 Millisekunden und ist in 24 Sternzeitstunden geteilt
             */
            const julianDate = Math.round(calculateJulianDate(datetime))-0.5;
            const siderealTimeBase = calculateSiderealTime(julianDate);
            const timeInput = document.getElementById('siderealTime').value;
            const siderealTimeNew = timeInput.split(':');
            const timeInputSeconds = document.getElementById('siderealSeconds').value;
            const timediffInMs = ((parseInt(siderealTimeNew[0])+24+parseInt(siderealTimeNew[1])/60+parseFloat(timeInputSeconds)/3600-siderealTimeBase)%24)*86164100/24;
            datetime = calculateGregorianDateFromJulianDate(julianDate);
            datetime.setTime(datetime.getTime()+timediffInMs);
            fillGregorianDate(datetime);
            fillJulianDate(calculateJulianDate(datetime));
            berechneDaten();
        }

        function changeTime(offset) {
            datetime.setTime(datetime.getTime()+offset);
            fillGregorianDate(datetime);
            const julianDate = calculateJulianDate(datetime);
            fillJulianDate(julianDate);
            fillSiderealTime(calculateSiderealTime(julianDate));
            berechneDaten();
        }

        function changeTimeRepeat() {
            changeTime(addTimeOffset);
        }

        function addEvents(elem, timeoffset) {
            elem.addEventListener('click', () => { changeTime(timeoffset); });
            elem.addEventListener('mousedown', () => {
                clearInterval(intervalId);
                intervalId = setInterval(changeTimeRepeat, 200);
                addTimeOffset = timeoffset;
            });
            elem.addEventListener('mouseleave', () => { clearInterval(intervalId); });
        }

    /////////////////////////////////////////////////////////////////
    //              Lokale Datenspeicherung                        //
    /////////////////////////////////////////////////////////////////

        function saveData() {
            const lat = document.getElementById('latitude').value.trim();
            const lon = document.getElementById('longitude').value.trim();
            if (lat) localStorage.setItem('latitude', lat);
            if (lon) localStorage.setItem('longitude', lon);
        }

        function loadData() {
            const lat = localStorage.getItem('latitude');
            const lon = localStorage.getItem('longitude');
            if (lat) { document.getElementById('latitude').value = lat; validateCoordinate(lat, 'latitude'); }
            if (lon) { document.getElementById('longitude').value = lon; validateCoordinate(lon, 'longitude'); }
        }

    /////////////////////////////////////////////////////////////////
    //              Initialisierung (gemeinsamer Teil)             //
    /////////////////////////////////////////////////////////////////

        function initUI() {
            document.getElementById('latitude').addEventListener('input', function () {
                validateCoordinate(this.value.trim(), 'latitude');
            });
            document.getElementById('longitude').addEventListener('input', function () {
                validateCoordinate(this.value.trim(), 'longitude');
            });
            loadData();
            datetime = new Date();
            fillGregorianDate(datetime);
            changeGregorianDate();
            document.getElementById('date').addEventListener('input', changeGregorianDate);
            document.getElementById('time').addEventListener('input', changeGregorianDate);
            document.getElementById('seconds').addEventListener('input', changeGregorianDate);
            document.getElementById('julianDate').addEventListener('input', changeJD);
            document.getElementById('siderealTime').addEventListener('input', changeSiderealTime);
            document.getElementById('siderealSeconds').addEventListener('input', changeSiderealTime);
            document.addEventListener('mouseup', () => { clearInterval(intervalId); });
        }
