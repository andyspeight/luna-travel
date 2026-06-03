/**
 * Luna Travel — lightweight i18n.
 *
 * Pure, dependency-free. A flat key → per-locale string table plus a
 * `translate()` with {var} interpolation, and `detectLocale()` for first-run
 * auto-detection (mirrors how the Luna Chat widget localises per visitor).
 *
 * Scope of v1: the global chrome (tab bar), the home dashboard, the Trip Map,
 * Storyboard, Inspirations surfaces, and the Me/settings screen. Supplier text
 * (hotel/room names), the customer reference, dates/times and destination-guide
 * prose are NOT translated — they stay as the source data (Rule 8). To extend
 * coverage to a detail page, add keys here and swap its literals for t('...').
 *
 * Translations are for short UI labels; longer marketing lines are kept natural
 * rather than literal. English is the source and the guaranteed fallback.
 */

export type Locale = 'en' | 'ro' | 'fr' | 'de' | 'es' | 'it';

export const DEFAULT_LOCALE: Locale = 'en';

export interface LocaleMeta {
  code: Locale;
  label: string; // native name
  flag: string; // emoji
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'ro', label: 'Română', flag: '🇷🇴' },
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
];

const SUPPORTED = new Set<Locale>(LOCALES.map((l) => l.code));

type Dict = Record<Locale, string>;

const S: Record<string, Dict> = {
  // ── Common ──
  'common.seeAll': { en: 'See all', ro: 'Vezi tot', fr: 'Tout voir', de: 'Alle', es: 'Ver todo', it: 'Vedi tutto' },

  // ── Tab bar ──
  'tab.trip': { en: 'Trip', ro: 'Călătorie', fr: 'Voyage', de: 'Reise', es: 'Viaje', it: 'Viaggio' },
  'tab.itinerary': { en: 'Itinerary', ro: 'Itinerar', fr: 'Itinéraire', de: 'Reiseplan', es: 'Itinerario', it: 'Itinerario' },
  'tab.docs': { en: 'Docs', ro: 'Docs', fr: 'Docs', de: 'Docs', es: 'Docs', it: 'Docs' },
  'tab.luna': { en: 'Luna', ro: 'Luna', fr: 'Luna', de: 'Luna', es: 'Luna', it: 'Luna' },
  'tab.me': { en: 'Me', ro: 'Eu', fr: 'Moi', de: 'Ich', es: 'Yo', it: 'Io' },

  // ── Home greetings ──
  'home.morning': { en: 'Good morning', ro: 'Bună dimineața', fr: 'Bonjour', de: 'Guten Morgen', es: 'Buenos días', it: 'Buongiorno' },
  'home.afternoon': { en: 'Good afternoon', ro: 'Bună ziua', fr: 'Bon après-midi', de: 'Guten Tag', es: 'Buenas tardes', it: 'Buon pomeriggio' },
  'home.evening': { en: 'Good evening', ro: 'Bună seara', fr: 'Bonsoir', de: 'Guten Abend', es: 'Buenas noches', it: 'Buonasera' },
  'home.hello': { en: 'Hello', ro: 'Salut', fr: 'Bonjour', de: 'Hallo', es: 'Hola', it: 'Ciao' },
  'home.upcoming': { en: 'Upcoming', ro: 'Urmează', fr: 'À venir', de: 'Bevorstehend', es: 'Próximo', it: 'In arrivo' },

  // ── Home quick tiles ──
  'tile.flights': { en: 'Flights', ro: 'Zboruri', fr: 'Vols', de: 'Flüge', es: 'Vuelos', it: 'Voli' },
  'tile.plan': { en: 'Plan', ro: 'Plan', fr: 'Plan', de: 'Plan', es: 'Plan', it: 'Piano' },
  'tile.hotel': { en: 'Hotel', ro: 'Hotel', fr: 'Hôtel', de: 'Hotel', es: 'Hotel', it: 'Hotel' },
  'tile.map': { en: 'Map', ro: 'Hartă', fr: 'Carte', de: 'Karte', es: 'Mapa', it: 'Mappa' },
  'tile.docs': { en: 'Docs', ro: 'Docs', fr: 'Docs', de: 'Docs', es: 'Docs', it: 'Docs' },
  'tile.luna': { en: 'Luna', ro: 'Luna', fr: 'Luna', de: 'Luna', es: 'Luna', it: 'Luna' },

  // ── Home sections ──
  'home.upNext': { en: 'Up next', ro: 'Urmează', fr: 'À suivre', de: 'Als Nächstes', es: 'A continuación', it: 'Prossimo' },
  'home.comingUp': { en: 'Coming up', ro: 'În curând', fr: 'À venir', de: 'Demnächst', es: 'Próximamente', it: 'Prossimamente' },
  'home.getToKnow': { en: 'Get to know it', ro: 'Cunoaște-l', fr: 'À découvrir', de: 'Kennenlernen', es: 'Conócelo', it: 'Da scoprire' },
  'home.destGuide': { en: 'Destination guide', ro: 'Ghid destinație', fr: 'Guide destination', de: 'Reiseführer', es: 'Guía del destino', it: 'Guida destinazione' },
  'home.destBlurb': {
    en: 'Visa, weather, currency, insider tips — everything we’d tell a friend.',
    ro: 'Viză, vreme, monedă, sfaturi locale — tot ce i-am spune unui prieten.',
    fr: 'Visa, météo, monnaie, bons plans — tout ce qu’on dirait à un ami.',
    de: 'Visum, Wetter, Währung, Insidertipps — alles, was man einem Freund sagt.',
    es: 'Visado, tiempo, moneda, consejos locales — todo lo que le dirías a un amigo.',
    it: 'Visto, meteo, valuta, consigli locali — tutto ciò che diresti a un amico.',
  },
  'home.airportExtras': { en: 'Airport extras', ro: 'Extra aeroport', fr: 'Services aéroport', de: 'Flughafen-Extras', es: 'Extras aeropuerto', it: 'Extra aeroporto' },
  'home.teaserPre': { en: 'Need your next fix?', ro: 'Visezi la următoarea?', fr: 'Envie d’une autre escapade ?', de: 'Schon wieder Fernweh?', es: '¿Listo para el próximo?', it: 'Già voglia di ripartire?' },

  // ── Countdown ──
  'cd.days': { en: 'Days', ro: 'Zile', fr: 'Jours', de: 'Tage', es: 'Días', it: 'Giorni' },
  'cd.hours': { en: 'Hours', ro: 'Ore', fr: 'Heures', de: 'Std.', es: 'Horas', it: 'Ore' },
  'cd.mins': { en: 'Mins', ro: 'Min', fr: 'Min', de: 'Min', es: 'Min', it: 'Min' },
  'cd.secs': { en: 'Secs', ro: 'Sec', fr: 'Sec', de: 'Sek', es: 'Seg', it: 'Sec' },
  'cd.fly': { en: 'until you fly', ro: 'până la zbor', fr: 'avant le départ', de: 'bis zum Abflug', es: 'hasta tu vuelo', it: 'al decollo' },
  'cd.checkin': { en: 'until you check in', ro: 'până la cazare', fr: 'avant l’arrivée', de: 'bis zum Check-in', es: 'hasta el check-in', it: 'al check-in' },
  'cd.travel': { en: 'until you travel', ro: 'până la plecare', fr: 'avant le voyage', de: 'bis zur Reise', es: 'hasta el viaje', it: 'alla partenza' },

  // ── Where next? / Inspirations ──
  'next.whereNext': { en: 'Where next?', ro: 'Unde mergem?', fr: 'Et après ?', de: 'Wohin als Nächstes?', es: '¿A dónde ahora?', it: 'E adesso?' },
  'next.welcomeHome': { en: 'Welcome home', ro: 'Bun venit acasă', fr: 'Bon retour', de: 'Willkommen zurück', es: 'Bienvenido a casa', it: 'Bentornato' },
  'next.lovedX': {
    en: 'Loved {dest}? {agency} has more.',
    ro: 'Ți-a plăcut {dest}? {agency} are mai multe.',
    fr: 'Vous avez aimé {dest} ? {agency} en a d’autres.',
    de: '{dest} gefallen? {agency} hat mehr.',
    es: '¿Te encantó {dest}? {agency} tiene más.',
    it: 'Ti è piaciuta {dest}? {agency} ha molto altro.',
  },
  'next.introPost': {
    en: 'Loved {dest}? Here’s where {agency} would send you next.',
    ro: 'Ți-a plăcut {dest}? Iată unde te-ar trimite {agency} data viitoare.',
    fr: 'Vous avez aimé {dest} ? Voici où {agency} vous emmènerait ensuite.',
    de: '{dest} gefallen? Hierhin würde {agency} Sie als Nächstes schicken.',
    es: '¿Te encantó {dest}? Aquí es donde {agency} te llevaría después.',
    it: 'Ti è piaciuta {dest}? Ecco dove ti porterebbe {agency} la prossima volta.',
  },
  'next.introPre': {
    en: 'Already dreaming about the next one? A few ideas from {agency} for when you’re back.',
    ro: 'Deja visezi la următoarea? Câteva idei de la {agency} pentru când te întorci.',
    fr: 'Vous rêvez déjà du prochain ? Quelques idées de {agency} pour votre retour.',
    de: 'Träumen Sie schon vom nächsten Mal? Ein paar Ideen von {agency} für danach.',
    es: '¿Ya soñando con el próximo? Algunas ideas de {agency} para cuando vuelvas.',
    it: 'Già sogni il prossimo? Qualche idea di {agency} per quando torni.',
  },
  'next.enquire': { en: 'Enquire', ro: 'Cere ofertă', fr: 'Demander', de: 'Anfragen', es: 'Consultar', it: 'Richiedi' },
  'next.from': { en: 'from', ro: 'de la', fr: 'dès', de: 'ab', es: 'desde', it: 'da' },
  'next.nights': { en: 'nts', ro: 'nopți', fr: 'nuits', de: 'Nächte', es: 'noches', it: 'notti' },
  'next.noObligation': {
    en: 'Enquire with {agency} — no obligation.',
    ro: 'Cere o ofertă de la {agency} — fără obligații.',
    fr: 'Renseignez-vous auprès de {agency} — sans engagement.',
    de: 'Bei {agency} anfragen — unverbindlich.',
    es: 'Consulta con {agency} — sin compromiso.',
    it: 'Richiedi a {agency} — senza impegno.',
  },
  'next.emailAgency': { en: 'Email {agency}', ro: 'Scrie la {agency}', fr: 'Écrire à {agency}', de: '{agency} mailen', es: 'Escribir a {agency}', it: 'Scrivi a {agency}' },
  'next.call': { en: 'Call {phone}', ro: 'Sună {phone}', fr: 'Appeler {phone}', de: '{phone} anrufen', es: 'Llamar {phone}', it: 'Chiama {phone}' },
  'next.askLuna': { en: 'Ask Luna about it', ro: 'Întreabă Luna', fr: 'Demander à Luna', de: 'Luna fragen', es: 'Pregúntale a Luna', it: 'Chiedi a Luna' },
  'next.browseMore': { en: 'Browse more at {site}', ro: 'Vezi mai multe pe {site}', fr: 'Plus sur {site}', de: 'Mehr auf {site}', es: 'Más en {site}', it: 'Altro su {site}' },
  'next.footer': {
    en: 'Handpicked by {agency}. Tap any trip to enquire — no obligation, and your dedicated team will tailor it to you.',
    ro: 'Alese de {agency}. Atinge orice călătorie pentru o ofertă — fără obligații, echipa ta o va personaliza pentru tine.',
    fr: 'Sélectionnés par {agency}. Touchez un voyage pour vous renseigner — sans engagement, votre équipe le personnalisera.',
    de: 'Ausgewählt von {agency}. Tippen Sie auf eine Reise für eine Anfrage — unverbindlich, Ihr Team passt sie für Sie an.',
    es: 'Elegidos por {agency}. Toca cualquier viaje para consultar — sin compromiso, tu equipo lo adaptará a ti.',
    it: 'Scelti da {agency}. Tocca un viaggio per richiedere — senza impegno, il tuo team lo personalizzerà.',
  },

  // ── Itinerary ──
  'itin.timeline': { en: 'Timeline', ro: 'Cronologie', fr: 'Chronologie', de: 'Zeitachse', es: 'Cronología', it: 'Cronologia' },
  'itin.storyboard': { en: 'Storyboard', ro: 'Storyboard', fr: 'Storyboard', de: 'Storyboard', es: 'Storyboard', it: 'Storyboard' },
  'itin.map': { en: 'Map', ro: 'Hartă', fr: 'Carte', de: 'Karte', es: 'Mapa', it: 'Mappa' },
  'itin.noEvents': { en: 'No events on this trip yet.', ro: 'Încă niciun eveniment pentru această călătorie.', fr: 'Aucun événement pour ce voyage pour l’instant.', de: 'Noch keine Ereignisse für diese Reise.', es: 'Aún no hay eventos en este viaje.', it: 'Ancora nessun evento per questo viaggio.' },
  'itin.day': { en: 'Day', ro: 'Ziua', fr: 'Jour', de: 'Tag', es: 'Día', it: 'Giorno' },

  // ── Trip map ──
  'map.title': { en: 'Trip map', ro: 'Harta călătoriei', fr: 'Carte du voyage', de: 'Reisekarte', es: 'Mapa del viaje', it: 'Mappa del viaggio' },
  'map.subtitle': {
    en: 'Your journey, mapped — airports, hotels and the route between them.',
    ro: 'Călătoria ta pe hartă — aeroporturi, hoteluri și ruta dintre ele.',
    fr: 'Votre voyage cartographié — aéroports, hôtels et l’itinéraire entre eux.',
    de: 'Ihre Reise auf der Karte — Flughäfen, Hotels und die Route dazwischen.',
    es: 'Tu viaje en el mapa — aeropuertos, hoteles y la ruta entre ellos.',
    it: 'Il tuo viaggio sulla mappa — aeroporti, hotel e il percorso tra loro.',
  },
  'map.airports': { en: 'Airports', ro: 'Aeroporturi', fr: 'Aéroports', de: 'Flughäfen', es: 'Aeropuertos', it: 'Aeroporti' },
  'map.airport': { en: 'Airport', ro: 'Aeroport', fr: 'Aéroport', de: 'Flughafen', es: 'Aeropuerto', it: 'Aeroporto' },
  'map.hotels': { en: 'Hotels', ro: 'Hoteluri', fr: 'Hôtels', de: 'Hotels', es: 'Hoteles', it: 'Hotel' },
  'map.hotel': { en: 'Hotel', ro: 'Hotel', fr: 'Hôtel', de: 'Hotel', es: 'Hotel', it: 'Hotel' },
  'map.flown': { en: 'Flown', ro: 'Parcurs', fr: 'Parcouru', de: 'Geflogen', es: 'Volado', it: 'Volato' },
  'map.flight': { en: 'Flight', ro: 'Zbor', fr: 'Vol', de: 'Flug', es: 'Vuelo', it: 'Volo' },
  'map.transfer': { en: 'Transfer', ro: 'Transfer', fr: 'Transfert', de: 'Transfer', es: 'Traslado', it: 'Transfer' },
  'map.tapHint': { en: 'Tap a point for details', ro: 'Atinge un punct pentru detalii', fr: 'Touchez un point pour les détails', de: 'Punkt antippen für Details', es: 'Toca un punto para ver detalles', it: 'Tocca un punto per i dettagli' },
  'map.stop': { en: 'Stop', ro: 'Oprire', fr: 'Étape', de: 'Stopp', es: 'Parada', it: 'Tappa' },
  'map.getDirections': { en: 'Get directions', ro: 'Indicații', fr: 'Itinéraire', de: 'Route planen', es: 'Cómo llegar', it: 'Indicazioni' },
  'map.viewDetails': { en: 'View details', ro: 'Vezi detalii', fr: 'Voir les détails', de: 'Details ansehen', es: 'Ver detalles', it: 'Vedi dettagli' },
  'map.noLocations': {
    en: 'We don’t have map locations for this trip yet. Once your hotels and flights are confirmed, your route will appear here.',
    ro: 'Încă nu avem locații pe hartă pentru această călătorie. După confirmarea hotelurilor și zborurilor, ruta va apărea aici.',
    fr: 'Nous n’avons pas encore de lieux pour ce voyage. Une fois vos hôtels et vols confirmés, votre itinéraire apparaîtra ici.',
    de: 'Für diese Reise liegen noch keine Kartenorte vor. Sobald Hotels und Flüge bestätigt sind, erscheint Ihre Route hier.',
    es: 'Aún no tenemos ubicaciones para este viaje. Cuando se confirmen tus hoteles y vuelos, tu ruta aparecerá aquí.',
    it: 'Non abbiamo ancora luoghi per questo viaggio. Una volta confermati hotel e voli, il percorso apparirà qui.',
  },
  'map.attrib': {
    en: 'Map data © Natural Earth (public domain). Distances are great-circle estimates between airports. Tap any point for directions in your maps app. Works offline once loaded.',
    ro: 'Date hartă © Natural Earth (domeniu public). Distanțele sunt estimări pe cerc mare între aeroporturi. Atinge un punct pentru indicații în aplicația ta de hărți. Funcționează offline după prima încărcare.',
    fr: 'Données © Natural Earth (domaine public). Les distances sont des estimations orthodromiques entre aéroports. Touchez un point pour l’itinéraire dans votre app de cartes. Fonctionne hors ligne une fois chargé.',
    de: 'Kartendaten © Natural Earth (gemeinfrei). Entfernungen sind Großkreis-Schätzungen zwischen Flughäfen. Punkt antippen für die Route in Ihrer Karten-App. Funktioniert nach dem Laden offline.',
    es: 'Datos © Natural Earth (dominio público). Las distancias son estimaciones de círculo máximo entre aeropuertos. Toca un punto para la ruta en tu app de mapas. Funciona sin conexión una vez cargado.',
    it: 'Dati © Natural Earth (dominio pubblico). Le distanze sono stime ortodromiche tra aeroporti. Tocca un punto per le indicazioni nella tua app mappe. Funziona offline dopo il primo caricamento.',
  },

  // ── Me / settings ──
  'me.title': { en: 'Me', ro: 'Eu', fr: 'Moi', de: 'Ich', es: 'Yo', it: 'Io' },
  'me.leadTraveller': { en: 'Lead traveller', ro: 'Călător principal', fr: 'Voyageur principal', de: 'Hauptreisender', es: 'Viajero principal', it: 'Viaggiatore principale' },
  'me.travellers': { en: 'Travellers', ro: 'Călători', fr: 'Voyageurs', de: 'Reisende', es: 'Viajeros', it: 'Viaggiatori' },
  'me.travellersSub': { en: '{n} on this booking', ro: '{n} pe această rezervare', fr: '{n} sur cette réservation', de: '{n} in dieser Buchung', es: '{n} en esta reserva', it: '{n} su questa prenotazione' },
  'me.yourAgent': { en: 'Your agent', ro: 'Agentul tău', fr: 'Votre agence', de: 'Ihr Reisebüro', es: 'Tu agencia', it: 'La tua agenzia' },
  'me.call': { en: 'Call', ro: 'Sună', fr: 'Appeler', de: 'Anrufen', es: 'Llamar', it: 'Chiama' },
  'me.email': { en: 'Email', ro: 'Email', fr: 'Email', de: 'E-Mail', es: 'Email', it: 'Email' },
  'me.emergency': { en: '24h emergency', ro: 'Urgență 24h', fr: 'Urgence 24h', de: '24h-Notfall', es: 'Emergencia 24h', it: 'Emergenza 24h' },
  'me.settings': { en: 'Settings', ro: 'Setări', fr: 'Réglages', de: 'Einstellungen', es: 'Ajustes', it: 'Impostazioni' },
  'me.coverMode': { en: 'Cover mode', ro: 'Mod copertă', fr: 'Mode couverture', de: 'Cover-Modus', es: 'Modo portada', it: 'Modalità copertina' },
  'me.coverSub': { en: 'Open the app on a destination splash', ro: 'Deschide aplicația cu o imagine a destinației', fr: 'Ouvrir l’app sur une image de destination', de: 'App mit Ziel-Startbild öffnen', es: 'Abrir la app con una portada del destino', it: 'Apri l’app con un’immagine della destinazione' },
  'me.appearance': { en: 'Appearance', ro: 'Aspect', fr: 'Apparence', de: 'Darstellung', es: 'Apariencia', it: 'Aspetto' },
  'me.dark': { en: 'Dark mode', ro: 'Mod întunecat', fr: 'Mode sombre', de: 'Dunkelmodus', es: 'Modo oscuro', it: 'Tema scuro' },
  'me.light': { en: 'Light mode', ro: 'Mod luminos', fr: 'Mode clair', de: 'Hellmodus', es: 'Modo claro', it: 'Tema chiaro' },
  'me.language': { en: 'Language', ro: 'Limbă', fr: 'Langue', de: 'Sprache', es: 'Idioma', it: 'Lingua' },
  'me.notifications': { en: 'Notifications', ro: 'Notificări', fr: 'Notifications', de: 'Benachrichtigungen', es: 'Notificaciones', it: 'Notifiche' },
  'me.notificationsSub': { en: 'Trip updates, check-in reminders, weather', ro: 'Noutăți călătorie, mementouri cazare, vreme', fr: 'Mises à jour, rappels d’enregistrement, météo', de: 'Reise-Updates, Check-in-Erinnerungen, Wetter', es: 'Novedades del viaje, recordatorios de check-in, tiempo', it: 'Aggiornamenti viaggio, promemoria check-in, meteo' },
  'me.help': { en: 'Help & FAQ', ro: 'Ajutor & întrebări', fr: 'Aide & FAQ', de: 'Hilfe & FAQ', es: 'Ayuda y FAQ', it: 'Aiuto e FAQ' },
  'me.helpSub': { en: 'Ask Luna, or contact your agent', ro: 'Întreabă Luna sau contactează agentul', fr: 'Demandez à Luna ou contactez votre agence', de: 'Fragen Sie Luna oder Ihr Reisebüro', es: 'Pregunta a Luna o contacta tu agencia', it: 'Chiedi a Luna o contatta la tua agenzia' },
  'me.signOut': { en: 'Sign out', ro: 'Deconectare', fr: 'Déconnexion', de: 'Abmelden', es: 'Cerrar sesión', it: 'Esci' },
  'me.chooseLanguage': { en: 'Choose language', ro: 'Alege limba', fr: 'Choisir la langue', de: 'Sprache wählen', es: 'Elegir idioma', it: 'Scegli la lingua' },
};

/** Interpolate {var} tokens. */
function interpolate(s: string, vars?: Record<string, string | number>): string {
  if (!vars) return s;
  return s.replace(/\{(\w+)\}/g, (_, k) => (k in vars ? String(vars[k]) : `{${k}}`));
}

/** Translate a key for a locale, falling back to English then the key itself. */
export function translate(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number>,
): string {
  const row = S[key];
  if (!row) return key;
  const val = row[locale] ?? row.en ?? key;
  return interpolate(val, vars);
}

/** Map a browser language tag (e.g. "ro-RO", "fr") to a supported locale. */
export function detectLocale(navLang?: string): Locale {
  const tag = (navLang ?? '').toLowerCase().split('-')[0];
  return SUPPORTED.has(tag as Locale) ? (tag as Locale) : DEFAULT_LOCALE;
}

export function isLocale(v: unknown): v is Locale {
  return typeof v === 'string' && SUPPORTED.has(v as Locale);
}
