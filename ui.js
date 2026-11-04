        // Gemeinsame Variablen
        var datetime = new Date();
        var intervalId;
        var latitude = 0;  // Breitengrad Ort [°]
        var longitude = 0; // Längengrad Ort [°], Ost positiv
        var useLocalTime = false;
        var localZone = null;   // Zeitzone der Lokalzeit (IANA-Name), null = die des Browsers; Rundgänge setzen 'Europe/Berlin'

        /**
         * Beobachtungsort aus den Eingabefeldern als Objekt für astro.js (Winkel in Radiant, Höhe 0 m)
         */
        function getLocation() {
            return { longitude: longitude * DEG2RAD, latitude: latitude * DEG2RAD, elevation: 0 };
        }

        /**
         * Winkel in Grad auf [0, 360) bringen (für Anzeigen in Grad)
         */
        function normalizeDegrees(deg) {
            // direkt in Grad rechnen, damit ganze Gradzahlen ganz bleiben (Beschriftungen)
            return ((deg % 360) + 360) % 360;
        }

        /**
         * Abstand zu UT [h] in einer Zeitzone (IANA-Name wie 'Europe/Berlin') zum Zeitpunkt date;
         * ohne Namen die Zeitzone des Browsers
         */
        function zoneOffsetHours(date, zone) {
            if (!zone) return -date.getTimezoneOffset() / 60;
            const p = {};
            for (const part of new Intl.DateTimeFormat('en-US', {
                timeZone: zone, hourCycle: 'h23', era: 'short', year: 'numeric', month: 'numeric', day: 'numeric',
                hour: 'numeric', minute: 'numeric', second: 'numeric',
            }).formatToParts(date)) p[part.type] = part.value;
            // Jahre vor Christus kommen als positive Zahl mit Ära „BC“; astronomisch: 1 v. Chr. = Jahr 0
            const year = /^B/.test(p.era) ? 1 - Number(p.year) : Number(p.year);
            const wall = new Date(Date.UTC(2000, 0, 1, Number(p.hour), Number(p.minute), Number(p.second)));
            wall.setUTCFullYear(year, Number(p.month) - 1, Number(p.day));
            return (wall.getTime() - Math.floor(date.getTime() / 1000) * 1000) / 3600000;
        }

        /**
         * Zeitpunkt zu einer Uhrzeit in einer Zeitzone (Monat 0-basiert, Überlauf wie bei Date erlaubt).
         * Jahre 0–99 und negative Jahre werden wörtlich genommen (Date deutet 0–99 sonst als 1900–1999).
         */
        function zonedDate(year, month, day, hours = 0, minutes = 0, zone) {
            if (!zone) {
                const d = new Date(2000, 0, 1, hours, minutes);
                d.setFullYear(year, month, day);
                return d;
            }
            const u = new Date(Date.UTC(2000, 0, 1, hours, minutes));
            u.setUTCFullYear(year, month, day);
            const wall = u.getTime();
            let t = wall - zoneOffsetHours(new Date(wall), zone) * 3600000;
            t = wall - zoneOffsetHours(new Date(t), zone) * 3600000;     // zweiter Schritt um die Umstellung herum
            return new Date(t);
        }

        /** Kalendertag und Uhrzeit eines Zeitpunkts in einer Zeitzone: { year, month (0-basiert), day, hours, minutes } */
        function zonedParts(date, zone) {
            const shifted = new Date(date.getTime() + zoneOffsetHours(date, zone) * 3600000);
            return { year: shifted.getUTCFullYear(), month: shifted.getUTCMonth(), day: shifted.getUTCDate(),
                     hours: shifted.getUTCHours(), minutes: shifted.getUTCMinutes(),
                     seconds: shifted.getUTCSeconds() + shifted.getUTCMilliseconds() / 1000, weekday: shifted.getUTCDay() };
        }

        /**
         * Sternzeit in Greenwich in Stunden [0, 24)
         */
        function siderealTimeHours(jd) {
            return calculateGreenwichSiderealTime(jd) * 12 / Math.PI;
        }

        /**
         * Zeitzone der Tageswerte (Auf-/Untergang usw.): Abstand zu UT [h], 0 ohne Lokalzeit.
         * Gilt für den eingestellten Zeitpunkt; an Tagen mit Zeitumstellung ist der Tag deshalb nicht
         * exakt der Kalendertag der Lokalzeit.
         */
        function dayUtcOffset() {
            return useLocalTime ? zoneOffsetHours(datetime, localZone) : 0;
        }

        /**
         * Bezeichnung der Zeitzone für die Ausgabe, z. B. "UTC" oder "MESZ"
         */
        function timeZoneLabel() {
            if (!useLocalTime) return 'UTC';
            const part = new Intl.DateTimeFormat('de-DE', { timeZoneName: 'short', ...(localZone ? { timeZone: localZone } : {}) })
                .formatToParts(datetime).find(p => p.type === 'timeZoneName');
            return part ? part.value : 'Lokalzeit';
        }

    /////////////////////////////////////////////////////////////////
    //              Formatierungsfunktionen                        //
    /////////////////////////////////////////////////////////////////

        /**
         * String-Ausgabe im Gradmaß von einem Winkel im Bogenmaß
         */
        function radToDegString(rad) {
            const normalizedDegree = normalizeAngle(rad)*RAD2DEG;
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
         * Optional bei beiden: link: 'id' verlinkt den Text auf die Erklärung mit dieser id (#id).
         */
        function renderOutputTable(containerId, rows) {
            const linked = (html, id) => id ? '<a href="#' + id + '">' + html + '</a>' : html;
            const container = document.getElementById(containerId);
            const table = document.createElement('table');
            for (const row of rows) {
                const tr = document.createElement('tr');
                if (row.type === 'category') {
                    if (row.value !== undefined) {
                        // Kategoriezeile mit eigenem Wert (z.B. Gesamtzeigleichung)
                        const td1 = document.createElement('td');
                        td1.colSpan = 2;
                        td1.innerHTML = linked(row.text, row.link);
                        const td2 = document.createElement('td');
                        td2.textContent = row.value;
                        tr.appendChild(td1);
                        tr.appendChild(td2);
                    } else {
                        // Reine Kategorieüberschrift
                        const td = document.createElement('td');
                        td.colSpan = 3;
                        td.innerHTML = linked(row.text, row.link);
                        tr.appendChild(td);
                    }
                } else {
                    // Normale Zeile mit Einrückung, Schlüssel, Wert
                    const tdIndent = document.createElement('td');
                    tdIndent.innerHTML = '&nbsp;&nbsp;&nbsp;';
                    const tdKey = document.createElement('td');
                    tdKey.innerHTML = linked(row.key, row.link);
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
            if (useLocalTime) {
                const p = zonedParts(date, localZone);
                const mo = (p.month + 1).toString().padStart(2, '0');
                const d = p.day.toString().padStart(2, '0');
                document.getElementById('date').value = `${p.year}-${mo}-${d}`;
                document.getElementById('time').value = p.hours.toString().padStart(2, '0') + ':' + p.minutes.toString().padStart(2, '0');
                document.getElementById('seconds').value = p.seconds.toFixed(3);
            } else {
                document.getElementById('date').value = date.toISOString().substring(0, 10);
                document.getElementById('time').value = date.getUTCHours().toString().padStart(2, '0')+':'+date.getUTCMinutes().toString().padStart(2, '0');
                document.getElementById('seconds').value = (date.getUTCSeconds() + date.getUTCMilliseconds() / 1000).toFixed(3);
            }
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

            // Lokale Sternzeit auf [0, 24) bringen (westliche Länge sonst negativ)
            const timeLocal = (((time + longitude/15) % 24) + 24) % 24;
            const minutesLocal = timeLocal * 60;
            const secondsLocal = (minutesLocal - Math.floor(minutesLocal)) * 60;

            document.getElementById('siderealTimeLocal').textContent = hoursToString(timeLocal);
            document.getElementById('siderealSecondsLocal').textContent = secondsLocal.toFixed(3).padStart(6, '0');
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
            input = input.replace(',', '.');      // Dezimalkomma wie in deutschen Angaben üblich
            const decimalRegex = /^-?\d+(\.\d+)?$/;
            const dmsRegex = /^(\d{1,3})°\s*(\d{1,2})'\s*(\d{1,2}(\.\d+)?)"?\s*([NSWE])$/;
            const feedbackElement = document.getElementById(`${type}-feedback`);
            const inputElement = document.getElementById(`${type}`);
            let value = NaN;

            if (decimalRegex.test(input)) {
                value = parseFloat(input);
            } else if (dmsRegex.test(input)) {
                value = dmsToDecimal(input);
            }
            const valid = !isNaN(value);
            feedbackElement.className = valid ? 'feedback valid' : 'feedback invalid';
            inputElement.style.borderColor = valid ? '' : 'red';
            inputElement.setAttribute('aria-invalid', String(!valid));

            if (type === 'longitude' && !isNaN(value)) {
                longitude = value;
                const julianDate = julianDayFromDate(datetime);
                fillSiderealTime(siderealTimeHours(julianDate));
                update();
            } else if (type === 'latitude' && !isNaN(value)) {
                latitude = value;
                const slider = document.getElementById('latitudeSlider');
                if (slider) slider.value = value;
                update();
            }
        }

    /////////////////////////////////////////////////////////////////
    //              Zeitsteuerung                                  //
    /////////////////////////////////////////////////////////////////

        function changeJD() {
            const jdInput = parseFloat(document.getElementById('julianDate').value);
            if (isNaN(jdInput)) return;
            datetime = julianDayToDate(jdInput);
            fillGregorianDate(datetime);
            fillSiderealTime(siderealTimeHours(jdInput));
            update();
        }

        function changeGregorianDate() {
            const dateInput = document.getElementById('date').value;
            const timeInput = document.getElementById('time').value;
            const secondInput = document.getElementById('seconds').value;
            const [y, mo, d] = dateInput.split('-').map(Number), [h, mi] = timeInput.split(':').map(Number);
            const datetime_new = useLocalTime
                ? zonedDate(y, mo - 1, d, h, mi, localZone)  // Lokalzeit
                : new Date(`${dateInput}T${timeInput}Z`);    // UTC
            if (isNaN(datetime_new.getTime())) return;
            const seconds = parseFloat(secondInput);
            if (isNaN(seconds)) return;
            datetime_new.setUTCSeconds(Math.floor(seconds));
            datetime_new.setUTCMilliseconds((seconds-Math.floor(seconds))*1000);
            datetime = datetime_new;
            const julianDate = julianDayFromDate(datetime);
            fillJulianDate(julianDate);
            fillSiderealTime(siderealTimeHours(julianDate));
            update();
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
            const julianDate = julianDayMidnight(julianDayFromDate(datetime));
            const siderealTimeBase = siderealTimeHours(julianDate);
            const timeInput = document.getElementById('siderealTime').value;
            const siderealTimeNew = timeInput.split(':');
            const timeInputSeconds = document.getElementById('siderealSeconds').value;
            const timediffInMs = ((parseInt(siderealTimeNew[0])+24+parseInt(siderealTimeNew[1])/60+parseFloat(timeInputSeconds)/3600-siderealTimeBase)%24)*86164100/24;
            datetime = julianDayToDate(julianDate);
            datetime.setTime(datetime.getTime()+timediffInMs);
            fillGregorianDate(datetime);
            fillJulianDate(julianDayFromDate(datetime));
            update();
        }

        function changeTime(offset) {
            datetime.setTime(datetime.getTime()+offset);
            fillGregorianDate(datetime);
            const julianDate = julianDayFromDate(datetime);
            fillJulianDate(julianDate);
            fillSiderealTime(siderealTimeHours(julianDate));
            update();
        }

        function stopTimeRepeat() {
            clearInterval(intervalId);
            intervalId = undefined;
        }

        /** Auf die aktuelle Uhrzeit springen (Knopf „Jetzt“) */
        function setTimeNow() {
            datetime = new Date();
            changeTime(0);
        }

        /**
         * Zeitknopf: ein Klick (auch per Tastatur) verschiebt einmal, gedrückt halten wiederholt alle 200 ms.
         * Pointer-Events gelten für Maus, Finger und Stift; Wegziehen zum Scrollen bricht ab (pointercancel).
         */
        function addEvents(elem, timeoffset) {
            elem.addEventListener('click', () => { changeTime(timeoffset); });
            elem.addEventListener('pointerdown', (ev) => {
                if (ev.pointerType === 'mouse' && ev.button !== 0) return;
                stopTimeRepeat();
                intervalId = setInterval(() => changeTime(timeoffset), 200);
            });
            for (const type of ['pointerup', 'pointercancel', 'pointerleave']) {
                elem.addEventListener(type, stopTimeRepeat);
            }
            // Langes Drücken auf dem Touchscreen öffnet sonst das Kontextmenü
            elem.addEventListener('contextmenu', (ev) => ev.preventDefault());
        }

        /**
         * Erzeugt für jeden Schritt eine Gruppe „− Beschriftung +“ für die Zeitsteuerung im angegebenen Container.
         * buttons: Array von { label, step }
         *   label: Beschriftung, z. B. "1 Minute" (Knöpfe heißen für Screenreader "−1 Minute" und "+1 Minute")
         *   step:  Zeitversatz in Millisekunden (positiv)
         */
        function createTimeButtons(containerId, buttons) {
            injectUiStyles();
            const container = document.getElementById(containerId);
            container.classList.add('ui-time-buttons');
            buttons.forEach(({ label, step }) => {
                const group = document.createElement('div');
                group.className = 'ui-step';
                group.setAttribute('role', 'group');
                group.setAttribute('aria-label', label);
                const text = document.createElement('span');
                text.textContent = label;
                const make = (sign, offset) => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.textContent = sign === '-' ? '−' : '+';
                    btn.title = (sign === '-' ? '−' : '+') + label;
                    btn.setAttribute('aria-label', btn.title);
                    addEvents(btn, offset);
                    return btn;
                };
                group.append(make('-', -step), text, make('+', step));
                container.appendChild(group);
            });
        }

    /////////////////////////////////////////////////////////////////
    //              Formulargenerierung                           //
    /////////////////////////////////////////////////////////////////

        /**
         * Grundgestaltung der Bedienelemente, einmal pro Seite in den <head> eingefügt. Es steht vor den Stilen der
         * Seite, deshalb gewinnen deren Regeln bei gleicher Spezifität. Farben kommen aus den CSS-Variablen der Seite
         * (--surface, --surface-2, --text-2, --border, --accent); ohne Variablen gelten helle Standardfarben.
         * Die Felder ordnen sich nach der Breite des Panels (Container-Query), nicht nach der Fensterbreite.
         */
        function injectUiStyles() {
            if (document.getElementById('ui-js-styles')) return;
            const style = document.createElement('style');
            style.id = 'ui-js-styles';
            style.textContent = `
        .ui-panel {
            background-color: var(--surface-2, #eeeeee); color: inherit;
            padding: 8px 12px; border-radius: 8px; container-type: inline-size;
        }
        .ui-head { display: flex; flex-wrap: wrap; align-items: center; gap: 6px 12px; margin-bottom: 8px; }
        .ui-title { font-weight: bold; margin-right: auto; }
        .ui-fields { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 8px 12px; }
        .ui-field { display: flex; flex-direction: column; gap: 2px; font-size: 0.85em; color: var(--text-2, inherit); }
        .ui-field input { font-size: calc(1em / 0.85); width: 11em; color: var(--text, inherit); }
        .ui-field .ui-input { display: flex; align-items: center; gap: 4px; }
        .ui-slider { flex-basis: 100%; display: flex; }
        .ui-slider input { width: min(100%, 34em); margin: 0; accent-color: var(--accent, #2a78d6); }
        .ui-actions { display: flex; flex-wrap: wrap; gap: 6px; }
        .ui-hint { color: var(--text-2, #555555); font-size: 0.85em; margin-top: 6px; }
        .ui-grid { display: grid; grid-template-columns: max-content minmax(0, 1fr); gap: 6px 12px; align-items: center; }
        .ui-label, .ui-unit { color: var(--text-2, inherit); }
        .ui-inputs { display: flex; flex-wrap: wrap; align-items: center; gap: 4px 6px; }
        .ui-readout { font-variant-numeric: tabular-nums; }
        .ui-panel .ui-seconds { width: 5.5em; }
        .ui-panel .ui-jd { width: 13em; max-width: 100%; }
        @container (max-width: 430px) {
            .ui-grid { grid-template-columns: minmax(0, 1fr); gap: 2px 0; }
            .ui-grid .ui-label { font-size: 0.85em; margin-top: 6px; }
        }

        .ui-panel input:is([type="text"], [type="date"], [type="time"], :not([type])) {
            font: inherit; color: inherit; background: var(--surface, #ffffff);
            border: 1px solid var(--border, #b9b8b2); border-radius: 6px;
            padding: 3px 6px; min-height: 2em; box-sizing: border-box;
        }
        .ui-panel button, .ui-step {
            font: inherit; color: inherit; background: var(--surface, #ffffff);
            border: 1px solid var(--border, #b9b8b2); border-radius: 6px;
        }
        .ui-panel button { width: auto; margin: 0; padding: 3px 12px; min-height: 2em; cursor: pointer; }
        .ui-panel button:hover, .ui-step > button:hover {
            background: color-mix(in srgb, currentColor 8%, var(--surface, #ffffff));
        }
        .ui-panel :is(input, button):focus-visible, .ui-step > button:focus-visible {
            outline: 2px solid var(--accent, #2a78d6); outline-offset: 1px;
        }

        /* UTC | Lokalzeit: eine Checkbox (#localTime) als zweiteiliger Schalter */
        .ui-segmented { display: inline-flex; border: 1px solid var(--border, #b9b8b2); border-radius: 6px;
                        overflow: hidden; cursor: pointer; user-select: none; background: var(--surface, #ffffff); }
        .ui-segmented input { position: absolute; opacity: 0; width: 1px; height: 1px; margin: 0; pointer-events: none; }
        .ui-segmented span { padding: 3px 10px; }
        .ui-segmented input:not(:checked) + span,
        .ui-segmented input:checked + span + span { background: var(--accent, #2a78d6); color: #ffffff; }
        .ui-segmented:has(input:focus-visible) { outline: 2px solid var(--accent, #2a78d6); outline-offset: 1px; }

        /* Zeitknöpfe: Gruppen „− Minute +“ */
        .ui-time-buttons { display: grid; grid-template-columns: repeat(auto-fill, minmax(13em, 1fr)); gap: 6px; }
        .ui-step { display: inline-flex; align-items: stretch; overflow: hidden; }
        .ui-step > button {
            width: 2.4em; min-height: 2.2em; margin: 0; padding: 0; border: 0; border-radius: 0;
            background: transparent; color: inherit; font: inherit; font-size: 1.15em; line-height: 1; cursor: pointer;
            touch-action: manipulation;      /* kein Doppeltipp-Zoom, Halten bleibt ein Halten */
            user-select: none; -webkit-user-select: none; -webkit-touch-callout: none;
        }
        .ui-step > span {
            flex: 1; min-width: 7em; display: flex; align-items: center; justify-content: center; text-align: center;
            padding: 2px 6px; font-size: 0.9em; user-select: none;
            border-inline: 1px solid var(--border, #b9b8b2);
        }`;
            document.head.prepend(style);
        }

        function createLocationControls(containerId) {
            injectUiStyles();
            const container = document.getElementById(containerId);
            // Breiten-Regler, außer die Seite schaltet ihn ab (data-slider="none", z. B. Ort aus der Karte)
            const slider = container.dataset.slider === 'none' ? '' : `
            <div class="ui-slider"><input type="range" id="latitudeSlider" min="-90" max="90" step="0.5" aria-label="Breitengrad"></div>`;
            container.innerHTML = `
    <div class="ui-panel ui-location">
        <div class="ui-head"><span class="ui-title">Beobachtungsort auf Erde</span></div>
        <div class="ui-fields">
            <label class="ui-field">Breitengrad
                <span class="ui-input"><input type="text" id="latitude" value="0" autocomplete="off" spellcheck="false"
                    aria-describedby="ui-coord-hint"><span id="latitude-feedback" class="feedback"></span></span>
            </label>
            <label class="ui-field">Längengrad (Ost positiv)
                <span class="ui-input"><input type="text" id="longitude" value="0" autocomplete="off" spellcheck="false"
                    aria-describedby="ui-coord-hint"><span id="longitude-feedback" class="feedback"></span></span>
            </label>
            <div class="ui-actions">
                <button type="button" onclick="useGpsLocation()" title="Aktuelle GPS-Position verwenden">📍 GPS-Position</button>
                <button type="button" onclick="saveData()" title="Ort für nächsten Seitenaufruf lokal merken">Ort merken</button>
            </div>${slider}
        </div>
        <div class="ui-hint" id="ui-coord-hint">z. B. 48.8566 oder 48°51'22"N, Länge 2.3522 oder 2°20'15"E</div>
        <div id="gps-feedback" class="feedback ui-hint" aria-live="polite"></div>
    </div>`;
            container.querySelector('button[onclick="saveData()"]').addEventListener('click', () => {
                const feedback = document.getElementById('gps-feedback');
                feedback.className = 'feedback ui-hint valid';
                feedback.textContent = 'Ort gemerkt – wird beim nächsten Aufruf wieder eingesetzt';
            });
        }

        function createTimeControls(containerId) {
            injectUiStyles();
            const tzName = Intl.DateTimeFormat().resolvedOptions().timeZone;
            const container = document.getElementById(containerId);
            container.innerHTML = `
    <div class="ui-panel ui-time">
        <div class="ui-head">
            <span class="ui-title">Zeit</span>
            <label class="ui-segmented" title="Zeitzone für Datum, Uhrzeit und Tageswerte (Lokalzeit: Zeitzone des Browsers, mit Sommerzeit)">
                <input type="checkbox" id="localTime"><span data-local="0">UTC</span><span data-local="1">Lokalzeit (${tzName})</span>
            </label>
            <button type="button" class="ui-now" onclick="setTimeNow()">Jetzt</button>
        </div>
        <div class="ui-grid">
            <span class="ui-label">Datum und Uhrzeit</span>
            <span class="ui-inputs">
                <input type="date" id="date" aria-label="Datum">
                <input type="time" id="time" aria-label="Uhrzeit (Stunde:Minute)">
                <input id="seconds" class="ui-seconds" inputmode="decimal" autocomplete="off" aria-label="Sekunden"><span class="ui-unit">s</span>
            </span>
            <span class="ui-label">Sternzeit (Greenwich)</span>
            <span class="ui-inputs">
                <input id="siderealTime" type="time" aria-label="Sternzeit Greenwich (Stunde:Minute)">
                <input id="siderealSeconds" class="ui-seconds" inputmode="decimal" autocomplete="off" aria-label="Sekunden der Sternzeit"><span class="ui-unit">s</span>
            </span>
            <span class="ui-label">Sternzeit lokal</span>
            <span class="ui-inputs ui-readout"><span id="siderealTimeLocal"></span> <span id="siderealSecondsLocal"></span><span class="ui-unit">s</span></span>
            <label class="ui-label" for="julianDate">Julianisches Datum</label>
            <span class="ui-inputs"><input id="julianDate" class="ui-jd" inputmode="decimal" autocomplete="off"></span>
        </div>
    </div>`;
            // Klick auf den schon gewählten Teil des Schalters ändert nichts (eine Checkbox würde sonst umschalten)
            const toggle = container.querySelector('.ui-segmented');
            toggle.addEventListener('click', (ev) => {
                const part = ev.target.closest('[data-local]');
                if (part && (part.dataset.local === '1') === document.getElementById('localTime').checked) ev.preventDefault();
            });
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

        function useGpsLocation() {
            const feedbackElement = document.getElementById('gps-feedback');
            if (!navigator.geolocation) {
                feedbackElement.className = 'feedback invalid';
                feedbackElement.textContent = 'Geolokalisierung wird nicht unterstützt';
                return;
            }
            feedbackElement.className = 'feedback';
            feedbackElement.textContent = 'Position wird ermittelt...';
            navigator.geolocation.getCurrentPosition(
                function (position) {
                    const lat = position.coords.latitude.toString();
                    const lon = position.coords.longitude.toString();
                    document.getElementById('latitude').value = lat;
                    document.getElementById('longitude').value = lon;
                    validateCoordinate(lat, 'latitude');
                    validateCoordinate(lon, 'longitude');
                    feedbackElement.className = 'feedback valid';
                    feedbackElement.textContent = 'Position übernommen';
                },
                function (error) {
                    feedbackElement.className = 'feedback invalid';
                    feedbackElement.textContent = 'Position konnte nicht ermittelt werden: ' + error.message;
                }
            );
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
            createLocationControls('locationControls');
            createTimeControls('timeControls');
            document.getElementById('latitude').addEventListener('input', function () {
                validateCoordinate(this.value.trim(), 'latitude');
            });
            document.getElementById('longitude').addEventListener('input', function () {
                validateCoordinate(this.value.trim(), 'longitude');
            });
            // Breiten-Regler schreibt ins Textfeld; Neuberechnung höchstens einmal pro Bild
            const latSlider = document.getElementById('latitudeSlider');
            let latFrame = null;
            if (latSlider) latSlider.addEventListener('input', () => {
                if (latFrame !== null) return;
                latFrame = requestAnimationFrame(() => {
                    latFrame = null;
                    document.getElementById('latitude').value = String(Number(latSlider.value));
                    validateCoordinate(String(Number(latSlider.value)), 'latitude');
                });
            });
            document.getElementById('localTime').addEventListener('change', function () {
                useLocalTime = this.checked;
                fillGregorianDate(datetime);
                update();   // Tageswerte gelten jetzt für den Kalendertag der Lokalzeit
            });
            if (window.kmEmbed) {
                // Seiten mit embed.js: Ort mit Vorgabe aus der Adresse, Ortszeile im Einbettmodus, folgt einem
                // anderswo gemerkten Ort; Zeitpunkt aus der Adresse (t)
                kmEmbed.usePlace({ lat: 50, lon: 10 }, (lat, lon) => {
                    // Rundgang mit festem Ort: die Seite übernimmt den neuen Ort erst danach
                    if (window.kmPlaceHold) { window.kmPlaceHold(lat, lon); return; }
                    document.getElementById('latitude').value = String(lat);
                    document.getElementById('longitude').value = String(lon);
                    validateCoordinate(String(lat), 'latitude');
                    validateCoordinate(String(lon), 'longitude');
                });
            } else {
                loadData();
            }
            datetime = window.kmEmbed && kmEmbed.state.t ? new Date(kmEmbed.state.t) : new Date();
            fillGregorianDate(datetime);
            changeGregorianDate();
            document.getElementById('date').addEventListener('input', changeGregorianDate);
            document.getElementById('time').addEventListener('input', changeGregorianDate);
            document.getElementById('seconds').addEventListener('input', changeGregorianDate);
            document.getElementById('julianDate').addEventListener('input', changeJD);
            document.getElementById('siderealTime').addEventListener('input', changeSiderealTime);
            document.getElementById('siderealSeconds').addEventListener('input', changeSiderealTime);
            // Sicherheitsnetz: Wiederholung endet auch, wenn das Loslassen woanders passiert oder das Fenster wechselt
            document.addEventListener('pointerup', stopTimeRepeat);
            window.addEventListener('blur', stopTimeRepeat);
        }
