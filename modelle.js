/*
 * modelle.js – bindet Modellseiten als iframe in eine andere Seite ein (z. B. in einen Blogbeitrag)
 *
 * In der Seite:
 *   <div class="km-modell" id="sommer" data-modell="tagbogen" data-datum="2026-06-21 10:00" data-ansicht="east">
 *     <a href="…/tagbogen3d.html">Ersatz ohne JavaScript, z. B. ein Bild mit alt-Text oder ein Link</a>
 *   </div>
 *   <script src="…/modelle.js" defer></script>
 *
 * Angaben am Platzhalter:
 *   data-modell    Name des Modells (siehe MODELS)
 *   id             Name für Nachrichten und Links im Text
 *   data-datum     Zeitpunkt: „2026-06-21 10:00“ (Ortszeit des Lesers) oder ISO 8601 mit Zone „2026-06-21T10:00Z“
 *   data-ort       Breite, Länge in Grad: „50,10“ oder „50.5, 10.2“ oder „50,5; 10,2“; gilt, solange der Leser
 *                  keinen eigenen Ort gemerkt hat
 *   data-ort-fest  „ja“: data-ort gilt immer (Text hängt am Ort); der Leser kann im Modell zu seinem Ort wechseln
 *   data-ansicht   Ansicht, Namen wie in VIEWS der Modellseite (z. B. „east“)
 *   data-schritt   Tourschritt ab 1 als Startzustand (Ebenen, Zeit, Ansicht wie in der Tour der Modellseite)
 *   data-tour      „ja“: Startknopf des Rundgangs im Modell zeigen; bei Modellen mit mehreren Rundgängen deren Name
 *                  (nur dieser Knopf; erdemond: „height“, „nodes“, „apsides“; tageslaenge: „tageslaenge“, „mittag“;
 *                  mondbahn3d: „knoten“; mondbogen: „mondbogen“).
 *                  Mit data-schritt startet der Rundgang sofort bei diesem Schritt; data-schritt ohne data-tour
 *                  stellt nur den Zustand des Schritts ein
 *   data-ebenen    sichtbare Ebenen, Namen der Modellseite, z. B. „dome,zenith,axis,circle,sun“
 *   data-abspielen „tag“, „monat“ oder „jahr“
 *   data-bedienung „voll“ (Standard), „min“ (nur Datum und Uhrzeit) oder „keine“ (nur das Bild)
 *   data-farben    „hell“ (Standard), „dunkel“ oder „auto“ (nach dem System des Lesers)
 *   data-hoehe     Seitenverhältnis Breite/Höhe bis zur ersten Höhenmeldung, z. B. „3/4“
 *   data-poster    „ja“: erst ein Vorschaubild mit Knopf „Modell laden“, das Modell lädt nach dem Klick
 *                  (Standard bei großen Modellen wie erdemond); „nein“: gleich laden. Ein Bild im Platzhalter
 *                  ersetzt das mitgelieferte Vorschaubild.
 *
 * Die Modellseiten liegen im selben Ordner wie diese Datei und müssen dieselbe Herkunft haben wie die Seite:
 * Die Höhe kommt per postMessage nur von dort, und der gemerkte Ort im localStorage gilt für beide.
 * Das Skript darf mehrfach eingebunden sein; es läuft nur einmal.
 */
(function () {
    'use strict';
    if (window.kmModelle) { window.kmModelle.scan(); return; }

    const VERSION = 'dev';          // setzt das Veröffentlichungsskript auf die Git-Version
    const BASE = new URL('.', document.currentScript ? document.currentScript.src : location.href);

    // Modelle mit Einbettmodus (embed.js); ratio = Breite/Höhe des Inhalts bei etwa 660 px Breite
    const MODELS = {
        tagbogen: { page: 'tagbogen3d.html', title: '3D-Modell: Tagbogen der Sonne', ratio: '660/1000' },
        himmelsachse: { page: 'himmelsachse3d.html', title: '3D-Modell: Erdachse und Himmelsachse', ratio: '660/1100' },
        erdposition: { page: 'erdposition.html', title: 'Modell: Erdposition und Sternzeit', ratio: '660/2800' },
        mond: { page: 'mond.html', title: 'Modell: Mondbahn, Mondphase und Mondlauf am Himmel', ratio: '660/3800' },
        tageslaenge: { page: 'tageslaenge.html', title: 'Diagramm: Tageslänge im Jahr', ratio: '660/2100' },
        erdbahn: { page: 'erdbahn3d.html', title: '3D-Modell: Die Bahn der Erde um die Sonne', ratio: '660/1250' },
        mondbahn: { page: 'mondbahn.html', title: 'Diagramm: Bahnen von Erde und Mond um die Sonne', ratio: '660/3200' },
        mondbahn3d: { page: 'mondbahn3d.html', title: '3D-Modell: Die geneigte Mondbahn', ratio: '660/1250' },
        mondbogen: { page: 'mondbogen3d.html', title: '3D-Modell: Der Mondbogen', ratio: '660/1150' },
        // WebGL mit 3,6 MB Texturen: erst nach Klick laden, auf schmalen Bildschirmen und mit „Daten sparen“ die
        // kleinen Texturen (Parameter klein, 1,7 MB)
        erdemond: { page: 'erdemond3d.html', title: '3D-Modell: Erde und Mond', ratio: '660/2300',
                    poster: 'posters/erdemond.jpg', posterRatio: '4/3', size: '3,6 MB', small: { param: 'klein', size: '1,7 MB' } },
    };

    const THEMES = { hell: 'light', dunkel: 'dark', auto: 'auto' };
    const PLAY = { tag: 'day', monat: 'month', jahr: 'year' };
    const CONTROLS = { voll: 'full', min: 'min', keine: 'none' };
    const YES = ['', 'ja', 'true', '1'];

    const style = document.createElement('style');
    style.id = 'km-modelle-styles';
    style.textContent = `
        .km-modell { margin: 1em 0; }
        .km-modell iframe { display: block; width: 100%; border: 0; aspect-ratio: var(--km-ratio, 3/4); }
        .km-modell iframe:fullscreen { background: #fff; }
        .km-modell .km-modell-link { margin: 2px 0 0; text-align: right; font-size: 0.85em; }
        .km-modell .km-modell-link button { padding: 0; border: 0; background: none; color: inherit; font: inherit;
            text-decoration: underline; cursor: pointer; }
        .km-modell-poster { position: relative; display: block; width: 100%; padding: 0; border: 0; margin: 0;
            aspect-ratio: var(--km-ratio, 4/3); background: #0e0e14 center / cover no-repeat; cursor: pointer;
            overflow: hidden; color: #fff; font: inherit; }
        .km-modell-poster img { display: block; width: 100%; height: 100%; object-fit: cover; }
        .km-modell-poster span { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%);
            padding: 10px 18px; border-radius: 8px; background: rgba(14, 14, 20, 0.82); white-space: nowrap;
            font-size: 1.05em; box-shadow: 0 2px 10px rgba(0, 0, 0, 0.4); }
        .km-modell-poster:hover span, .km-modell-poster:focus-visible span { background: rgba(40, 70, 140, 0.92); }`;
    document.head.appendChild(style);

    /** „50,10“, „50.5, 10.2“ oder „50,5; 10,2“ → [Breite, Länge] als Texte, sonst null */
    function parsePlace(text) {
        const s = text.trim();
        let parts;
        if (s.includes(';')) parts = s.split(';');                  // „50,5; 10,2“
        else if (/^[^,]*,[^,]*$/.test(s)) parts = s.split(',');     // „50,10“, „50.5, 10.2“
        else parts = s.split(/\s+/);                                // „50,5 10,2“
        parts = parts.map(p => p.trim().replace(',', '.'));
        if (parts.length !== 2 || parts.some(p => p === '')) return null;
        const [lat, lon] = parts.map(Number);
        if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
        return [String(lat), String(lon)];
    }

    /** Parameter des Startzustands aus den Angaben am Platzhalter */
    function stateParams(el) {
        const p = new URLSearchParams();
        const d = el.dataset;
        if (d.datum) p.set('t', d.datum.trim().replace(' ', 'T'));
        if (d.ort) {
            const place = parsePlace(d.ort);
            if (place) { p.set('lat', place[0]); p.set('lon', place[1]); }
            else console.warn('modelle.js: data-ort nicht lesbar:', d.ort);
        }
        if (d.ortFest !== undefined && YES.includes(d.ortFest.trim())) p.set('ortfest', '');
        if (d.ansicht) p.set('view', d.ansicht.trim());
        if (d.schritt) p.set('step', d.schritt.trim());
        if (d.tour !== undefined) {
            const tour = d.tour.trim();
            if (YES.includes(tour)) p.set('tour', '');
            else if (tour !== 'nein') p.set('tour', tour);
        }
        if (d.ebenen) p.set('layers', d.ebenen.replace(/\s+/g, ''));
        const play = PLAY[(d.abspielen || '').trim()];
        if (play) p.set('play', play);
        return p;
    }

    const frames = [];

    function mount(el) {
        if (el.dataset.kmMounted) return;
        const model = MODELS[el.dataset.modell];
        if (!model) {
            console.warn('modelle.js: unbekanntes Modell', el.dataset.modell);
            return;
        }
        el.dataset.kmMounted = '1';

        const state = stateParams(el);
        const pageUrl = new URL(model.page, BASE);
        const alt = el.querySelector('img[alt]');
        const title = alt && alt.alt ? alt.alt : model.title;

        const embed = new URLSearchParams(state);
        if (el.id) embed.set('id', el.id);
        const theme = THEMES[(el.dataset.farben || '').trim()];
        if (theme) embed.set('theme', theme);
        const controls = CONTROLS[(el.dataset.bedienung || '').trim()];
        if (controls) embed.set('controls', controls);
        const small = model.small && (matchMedia('(max-width: 700px)').matches
            || (navigator.connection && navigator.connection.saveData));
        if (small) embed.set(model.small.param, '');
        embed.set('v', VERSION);
        const frameUrl = new URL(pageUrl);
        frameUrl.search = 'embed&' + embed.toString().replace(/=(?=&|$)/g, '');

        const own = new URL(pageUrl);
        own.search = state.toString().replace(/=(?=&|$)/g, '');
        const link = document.createElement('p');
        link.className = 'km-modell-link';
        const a = document.createElement('a');
        a.href = own.href;
        a.target = '_blank';
        a.rel = 'noopener';
        a.textContent = 'Eigene Seite ↗';
        link.appendChild(a);

        function showFrame(lazy) {
            const iframe = document.createElement('iframe');
            iframe.src = frameUrl.href;
            iframe.title = title;
            if (lazy) iframe.loading = 'lazy';
            iframe.allow = 'fullscreen';
            iframe.style.setProperty('--km-ratio', (el.dataset.hoehe || model.ratio).trim());
            if (document.fullscreenEnabled && iframe.requestFullscreen) {
                const full = document.createElement('button');
                full.type = 'button';
                full.textContent = 'Vollbild';
                full.addEventListener('click', () => iframe.requestFullscreen().catch(() => {}));
                link.prepend(full, ' · ');
            }
            frames.push(iframe);
            return iframe;
        }

        const posterWanted = el.dataset.poster;      // fehlt: wie beim Modell vorgesehen
        const usePoster = posterWanted === undefined ? !!model.poster : YES.includes(posterWanted.trim());
        if (!usePoster) {
            el.replaceChildren(showFrame(true), link);
            return;
        }

        // Vorschaubild mit Knopf; erst der Klick lädt das Modell
        const poster = document.createElement('button');
        poster.type = 'button';
        poster.className = 'km-modell-poster';
        poster.style.setProperty('--km-ratio', model.posterRatio || model.ratio);
        const img = alt ? alt.cloneNode() : document.createElement('img');
        if (!alt) {
            img.src = model.poster ? new URL(model.poster, BASE).href + '?v=' + VERSION : '';
            img.alt = '';
        }
        if (img.src) poster.appendChild(img);
        const size = small ? model.small.size : model.size;
        const label = document.createElement('span');
        label.textContent = `▶ Modell laden${size ? ` (${size})` : ''}`;
        poster.appendChild(label);
        poster.setAttribute('aria-label', `${title} laden${size ? `, ${size}` : ''}`);
        poster.addEventListener('click', () => {
            const iframe = showFrame(false);
            el.replaceChildren(iframe, link);
            iframe.focus();
        });
        el.replaceChildren(poster, link);
    }

    window.addEventListener('message', ev => {
        if (ev.origin !== location.origin) return;
        const data = ev.data;
        if (!data || data.source !== 'km-model') return;
        const iframe = frames.find(f => f.contentWindow === ev.source);
        if (!iframe) return;
        if (data.type === 'height' && Number.isFinite(data.height) && data.height > 0) {
            iframe.style.aspectRatio = 'auto';
            iframe.style.height = Math.ceil(data.height) + 'px';
        }
    });

    // Vollbild an das betroffene Modell melden (es scrollt dann selbst und gibt Mausrad und Touch frei)
    let fullscreenFrame = null;
    document.addEventListener('fullscreenchange', () => {
        const now = frames.includes(document.fullscreenElement) ? document.fullscreenElement : null;
        if (fullscreenFrame && fullscreenFrame !== now && fullscreenFrame.contentWindow) {
            fullscreenFrame.contentWindow.postMessage({ source: 'km-host', type: 'fullscreen', on: false }, location.origin);
        }
        if (now && now.contentWindow) {
            now.contentWindow.postMessage({ source: 'km-host', type: 'fullscreen', on: true }, location.origin);
        }
        fullscreenFrame = now;
    });

    function scan() {
        document.querySelectorAll('.km-modell[data-modell]').forEach(mount);
    }

    window.kmModelle = { version: VERSION, scan };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', scan);
    else scan();
})();
