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
}

export const LOCALES: LocaleMeta[] = [
  { code: 'en', label: 'English' },
  { code: 'ro', label: 'Română' },
  { code: 'fr', label: 'Français' },
  { code: 'de', label: 'Deutsch' },
  { code: 'es', label: 'Español' },
  { code: 'it', label: 'Italiano' },
];

const SUPPORTED = new Set<Locale>(LOCALES.map((l) => l.code));

type Dict = Record<Locale, string>;

const S: Record<string, Dict> = {
  // ── Common ──
  'common.seeAll': { en: 'See all', ro: 'Vezi tot', fr: 'Tout voir', de: 'Alle', es: 'Ver todo', it: 'Vedi tutto' },
  'common.back': { en: 'Back', ro: 'Înapoi', fr: 'Retour', de: 'Zurück', es: 'Atrás', it: 'Indietro' },
  'common.backToItinerary': { en: 'Back to itinerary', ro: 'Înapoi la itinerar', fr: 'Retour à l’itinéraire', de: 'Zurück zum Reiseplan', es: 'Volver al itinerario', it: 'Torna all’itinerario' },
  // Only ever rendered for a value the source actually states. A park row
  // whose Airtable cell is blank hides itself rather than printing 'No' —
  // missing data must never read as a definite negative fact.
  'common.yes': { en: 'Yes', ro: 'Da', fr: 'Oui', de: 'Ja', es: 'Sí', it: 'Sì' },
  'common.no': { en: 'No', ro: 'Nu', fr: 'Non', de: 'Nein', es: 'No', it: 'No' },

  // ── Tab bar ──
  'tab.trip': { en: 'Trip', ro: 'Călătorie', fr: 'Voyage', de: 'Reise', es: 'Viaje', it: 'Viaggio' },
  'tab.itinerary': { en: 'Itinerary', ro: 'Itinerar', fr: 'Itinéraire', de: 'Reiseplan', es: 'Itinerario', it: 'Itinerario' },
  'tab.docs': { en: 'Docs', ro: 'Docs', fr: 'Docs', de: 'Docs', es: 'Docs', it: 'Docs' },
  // {assistant} is the agency's name for the assistant, Luna when unset.
  'tab.luna': { en: '{assistant}', ro: '{assistant}', fr: '{assistant}', de: '{assistant}', es: '{assistant}', it: '{assistant}' },
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
  'tile.luna': { en: '{assistant}', ro: '{assistant}', fr: '{assistant}', de: '{assistant}', es: '{assistant}', it: '{assistant}' },

  // ── Home sections ──
  'home.upNext': { en: 'Up next', ro: 'Urmează', fr: 'À suivre', de: 'Als Nächstes', es: 'A continuación', it: 'Prossimo' },
  'home.comingUp': { en: 'Coming up', ro: 'În curând', fr: 'À venir', de: 'Demnächst', es: 'Próximamente', it: 'Prossimamente' },
  // Stands in for the destination on a booking that has no place attached,
  // such as attraction tickets with no hotel city and no arrival airport.
  'home.yourTrip': { en: 'Your trip', ro: 'Călătoria ta', fr: 'Votre voyage', de: 'Deine Reise', es: 'Tu viaje', it: 'Il tuo viaggio' },
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
  // ── After the trip ──
  // A trip that ended four days ago was still badged "Upcoming", with a
  // countdown frozen at 00:00:00:00 and a welcome message about "before or
  // during your trip". These are what it says instead.
  'post.tripComplete': { en: 'Trip complete', ro: 'Călătorie încheiată', fr: 'Voyage terminé', de: 'Reise beendet', es: 'Viaje completado', it: 'Viaggio concluso' },
  'post.stillHere': { en: 'Your documents and your {agency} team are still here if you need them.', ro: 'Documentele tale și echipa {agency} sunt în continuare aici, dacă ai nevoie.', fr: 'Vos documents et l’équipe {agency} restent là si vous en avez besoin.', de: 'Ihre Unterlagen und Ihr Team von {agency} sind weiterhin für Sie da.', es: 'Tus documentos y el equipo de {agency} siguen aquí si los necesitas.', it: 'I tuoi documenti e il team di {agency} sono ancora qui se ti servono.' },
  'post.feedbackTitle': { en: 'How was your {dest} trip?', ro: 'Cum a fost în {dest}?', fr: 'Comment était {dest} ?', de: 'Wie war {dest}?', es: '¿Qué tal {dest}?', it: 'Com’è andata a {dest}?' },
  // Says where it goes, because the review asked for exactly that and because
  // it is true: reviews are private to the agency unless the traveller ticks
  // the box on the next screen.
  'post.feedbackBody': { en: 'Tell {agency} how it went. It goes to them only.', ro: 'Spune-i lui {agency} cum a fost. Ajunge doar la ei.', fr: 'Dites à {agency} comment ça s’est passé. Cela ne va qu’à eux.', de: 'Erzählen Sie {agency}, wie es war. Nur sie sehen es.', es: 'Cuéntale a {agency} qué tal fue. Solo lo verán ellos.', it: 'Racconta a {agency} com’è andata. Lo vedranno solo loro.' },
  'post.feedbackCta': { en: 'Leave feedback', ro: 'Lasă o părere', fr: 'Donner mon avis', de: 'Feedback geben', es: 'Dejar mi opinión', it: 'Lascia un commento' },
  'post.notNow': { en: 'Not now', ro: 'Nu acum', fr: 'Pas maintenant', de: 'Nicht jetzt', es: 'Ahora no', it: 'Non ora' },
  'post.nextIdea': { en: 'An idea for next time', ro: 'O idee pentru data viitoare', fr: 'Une idée pour la prochaine fois', de: 'Eine Idee für das nächste Mal', es: 'Una idea para la próxima vez', it: 'Un’idea per la prossima volta' },
  // The review's own example. An enquiry to a person, not a claim about a
  // place: no price, no availability, no dates — the agent supplies those.
  'post.askAbout': { en: 'Ask {agency} about {place}', ro: 'Întreabă {agency} despre {place}', fr: 'Demander à {agency} pour {place}', de: '{agency} nach {place} fragen', es: 'Preguntar a {agency} por {place}', it: 'Chiedi a {agency} di {place}' },

  // Money still owed (components/balance-card). Only drawn when there is some.
  'pay.leftToPay': { en: '{amount} left to pay', ro: '{amount} rămas de plată', fr: 'Reste à payer : {amount}', de: 'Noch zu zahlen: {amount}', es: 'Pendiente de pago: {amount}', it: 'Da pagare: {amount}' },
  'pay.dueNow': { en: 'Due now', ro: 'Scadent acum', fr: 'À régler maintenant', de: 'Jetzt fällig', es: 'Vence ahora', it: 'Da saldare ora' },
  'pay.nextDue': { en: 'Next payment {amount} due {date}', ro: 'Următoarea plată, {amount}, scadentă pe {date}', fr: 'Prochain paiement de {amount} le {date}', de: 'Nächste Zahlung von {amount} fällig am {date}', es: 'Próximo pago de {amount} el {date}', it: 'Prossimo pagamento di {amount} entro il {date}' },
  'pay.dueBy': { en: 'Due by {date}', ro: 'Scadent până pe {date}', fr: 'À régler avant le {date}', de: 'Fällig bis {date}', es: 'Vence el {date}', it: 'Da saldare entro il {date}' },
  'pay.ask': { en: 'Ask {agency} how to pay', ro: 'Întreabă {agency} cum poți plăti', fr: 'Demandez à {agency} comment payer', de: 'Fragen Sie {agency}, wie Sie zahlen können', es: 'Pregunta a {agency} cómo pagar', it: 'Chiedi a {agency} come pagare' },
  'pay.payNow': { en: 'Pay {amount}', ro: 'Plătește {amount}', fr: 'Payer {amount}', de: '{amount} bezahlen', es: 'Pagar {amount}', it: 'Paga {amount}' },
  'pay.opening': { en: 'Opening the payment page…', ro: 'Se deschide pagina de plată…', fr: 'Ouverture de la page de paiement…', de: 'Zahlungsseite wird geöffnet…', es: 'Abriendo la página de pago…', it: 'Apertura della pagina di pagamento…' },
  'pay.securely': { en: 'You’ll pay on {agency}’s secure payment page.', ro: 'Vei plăti pe pagina de plată securizată a agenției {agency}.', fr: 'Vous paierez sur la page de paiement sécurisée de {agency}.', de: 'Sie bezahlen auf der sicheren Zahlungsseite von {agency}.', es: 'Pagarás en la página de pago segura de {agency}.', it: 'Pagherai sulla pagina di pagamento sicura di {agency}.' },
  'pay.demo': { en: 'In a real booking this opens {agency}’s secure payment page. Nothing is charged in the demo.', ro: 'Într-o rezervare reală, aici se deschide pagina de plată securizată a agenției {agency}. În demo nu se încasează nimic.', fr: 'Pour une vraie réservation, ce bouton ouvre la page de paiement sécurisée de {agency}. Rien n’est débité dans la démo.', de: 'Bei einer echten Buchung öffnet sich hier die sichere Zahlungsseite von {agency}. In der Demo wird nichts abgebucht.', es: 'En una reserva real, aquí se abre la página de pago segura de {agency}. En la demo no se cobra nada.', it: 'In una prenotazione reale qui si apre la pagina di pagamento sicura di {agency}. Nella demo non viene addebitato nulla.' },
  'pay.failed': { en: 'We couldn’t open the payment page. Please try again, or contact {agency}.', ro: 'Nu am putut deschide pagina de plată. Încearcă din nou sau contactează {agency}.', fr: 'Impossible d’ouvrir la page de paiement. Réessayez ou contactez {agency}.', de: 'Die Zahlungsseite konnte nicht geöffnet werden. Bitte versuchen Sie es erneut oder wenden Sie sich an {agency}.', es: 'No hemos podido abrir la página de pago. Inténtalo de nuevo o contacta con {agency}.', it: 'Non è stato possibile aprire la pagina di pagamento. Riprova o contatta {agency}.' },
  'pay.changed': { en: 'This balance has just changed. Close and reopen the app to see the latest figure.', ro: 'Soldul tocmai s-a schimbat. Închide și redeschide aplicația pentru a vedea suma actualizată.', fr: 'Ce solde vient de changer. Fermez puis rouvrez l’application pour voir le montant à jour.', de: 'Der Betrag hat sich gerade geändert. Schließen Sie die App und öffnen Sie sie erneut, um den aktuellen Stand zu sehen.', es: 'El saldo acaba de cambiar. Cierra y vuelve a abrir la app para ver la cifra actualizada.', it: 'Il saldo è appena cambiato. Chiudi e riapri l’app per vedere l’importo aggiornato.' },
  'pay.settled': { en: 'There’s nothing left to pay on this booking.', ro: 'Nu mai este nimic de plată pentru această rezervare.', fr: 'Il n’y a plus rien à payer sur cette réservation.', de: 'Für diese Buchung ist nichts mehr zu zahlen.', es: 'No queda nada por pagar en esta reserva.', it: 'Non c’è più nulla da pagare per questa prenotazione.' },

  'next.welcomeHome': { en: 'Welcome home', ro: 'Bun venit acasă', fr: 'Bon retour', de: 'Willkommen zurück', es: 'Bienvenido a casa', it: 'Bentornato' },
  // Used when the booking has no destination to name — "Loved ?" is worse than
  // dropping the place entirely.
  'next.lovedIt': {
    en: 'Loved it? {agency} has more.',
    ro: 'Ți-a plăcut? {agency} are mai multe.',
    fr: 'Vous avez aimé ? {agency} en a d’autres.',
    de: 'Gefallen? {agency} hat mehr.',
    es: '¿Te encantó? {agency} tiene más.',
    it: 'Ti è piaciuta? {agency} ha molto altro.',
  },
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
  // The label that stops a priced suggestion reading like something the
  // traveller has paid for. Short on purpose: it sits on the card itself,
  // beside the price, rather than as a footnote somebody scrolls past.
  'next.notBooked': { en: 'Not booked', ro: 'Nerezervat', fr: 'Non réservé', de: 'Nicht gebucht', es: 'No reservado', it: 'Non prenotato' },
  'next.ideaNote': { en: 'Ideas from {agency} — nothing here is part of your booking', ro: 'Idei de la {agency} — nimic de aici nu face parte din rezervare', fr: 'Idées de {agency} — rien ici ne fait partie de votre réservation', de: 'Ideen von {agency} — nichts davon gehört zu Ihrer Buchung', es: 'Ideas de {agency}: nada de esto forma parte de tu reserva', it: 'Idee da {agency} — nulla di questo fa parte della prenotazione' },
  'next.ideaNoteShort': { en: 'Nothing here is part of your booking', ro: 'Nimic de aici nu face parte din rezervare', fr: 'Rien ici ne fait partie de votre réservation', de: 'Nichts davon gehört zu Ihrer Buchung', es: 'Nada de esto forma parte de tu reserva', it: 'Nulla di questo fa parte della prenotazione' },
  'itin.allConfirmed': { en: 'Everything here is booked and confirmed.', ro: 'Totul de aici este rezervat și confirmat.', fr: 'Tout ce qui suit est réservé et confirmé.', de: 'Alles hier ist gebucht und bestätigt.', es: 'Todo lo que aparece aquí está reservado y confirmado.', it: 'Tutto quello che vedi qui è prenotato e confermato.' },
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
  'next.askLuna': { en: 'Ask {assistant} about it', ro: 'Întreabă {assistant}', fr: 'Demander à {assistant}', de: '{assistant} fragen', es: 'Pregúntale a {assistant}', it: 'Chiedi a {assistant}' },
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
  'me.helpSub': { en: 'Ask {assistant}, or contact your agent', ro: 'Întreabă {assistant} sau contactează agentul', fr: 'Demandez à {assistant} ou contactez votre agence', de: 'Fragen Sie {assistant} oder Ihr Reisebüro', es: 'Pregunta a {assistant} o contacta tu agencia', it: 'Chiedi a {assistant} o contatta la tua agenzia' },
  'me.signOut': { en: 'Sign out', ro: 'Deconectare', fr: 'Déconnexion', de: 'Abmelden', es: 'Cerrar sesión', it: 'Esci' },
  'me.chooseLanguage': { en: 'Choose language', ro: 'Alege limba', fr: 'Choisir la langue', de: 'Sprache wählen', es: 'Elegir idioma', it: 'Scegli la lingua' },

  // ── Agency-authored guide pages ──
  'guide.section': { en: 'From your travel agent', ro: 'De la agentul tău', fr: 'De votre agence', de: 'Von Ihrem Reisebüro', es: 'De tu agencia', it: 'Dalla tua agenzia' },
  'guide.from': { en: 'From {agency}', ro: 'De la {agency}', fr: 'De {agency}', de: 'Von {agency}', es: 'De {agency}', it: 'Da {agency}' },
  'guide.byt': { en: 'Before you travel', ro: 'Înainte de plecare', fr: 'Avant de partir', de: 'Vor der Reise', es: 'Antes de viajar', it: 'Prima di partire' },
  'guide.bytBlurb': { en: 'Everything to know before you go', ro: 'Tot ce trebuie să știi înainte', fr: 'Tout savoir avant le départ', de: 'Alles Wichtige vor der Abreise', es: 'Todo lo que debes saber antes', it: 'Tutto da sapere prima di partire' },
  'guide.itinerary': { en: 'Itinerary', ro: 'Itinerar', fr: 'Itinéraire', de: 'Reiseplan', es: 'Itinerario', it: 'Itinerario' },
  'guide.itinBlurb': { en: 'Your trip, day by day', ro: 'Călătoria ta, zi de zi', fr: 'Votre voyage, jour par jour', de: 'Ihre Reise, Tag für Tag', es: 'Tu viaje, día a día', it: 'Il tuo viaggio, giorno per giorno' },
  'guide.fyw': { en: 'Find your way around', ro: 'Orientează-te ușor', fr: 'Repérez-vous facilement', de: 'Finden Sie sich zurecht', es: 'Oriéntate fácilmente', it: 'Orientati facilmente' },
  'guide.fywBlurb': { en: 'Places to know, on the map', ro: 'Locuri de știut, pe hartă', fr: 'Les lieux à connaître, sur la carte', de: 'Wichtige Orte auf der Karte', es: 'Lugares clave, en el mapa', it: 'Luoghi da conoscere, sulla mappa' },
  'guide.empty': { en: 'Nothing here yet — check back soon.', ro: 'Nimic aici încă — revino curând.', fr: 'Rien ici pour l’instant — revenez bientôt.', de: 'Noch nichts hier — schauen Sie bald wieder vorbei.', es: 'Aún no hay nada — vuelve pronto.', it: 'Ancora niente qui — torna presto.' },
  'guide.directions': { en: 'Directions', ro: 'Direcții', fr: 'Itinéraire', de: 'Route', es: 'Cómo llegar', it: 'Indicazioni' },
  'guide.mapAttrib': { en: 'Map data © OpenStreetMap contributors.', ro: 'Date hartă © OpenStreetMap contributors.', fr: 'Données carte © OpenStreetMap contributors.', de: 'Kartendaten © OpenStreetMap-Mitwirkende.', es: 'Datos del mapa © OpenStreetMap contributors.', it: 'Dati mappa © OpenStreetMap contributors.' },
  'guide.cat.sight': { en: 'Sight', ro: 'Obiectiv', fr: 'À voir', de: 'Sehenswert', es: 'Lugar', it: 'Da vedere' },
  'guide.cat.food': { en: 'Food & drink', ro: 'Mâncare', fr: 'Restauration', de: 'Essen & Trinken', es: 'Comida', it: 'Cibo' },
  'guide.cat.beach': { en: 'Beach', ro: 'Plajă', fr: 'Plage', de: 'Strand', es: 'Playa', it: 'Spiaggia' },
  'guide.cat.shop': { en: 'Shopping', ro: 'Cumpărături', fr: 'Shopping', de: 'Einkaufen', es: 'Compras', it: 'Shopping' },
  'guide.cat.practical': { en: 'Practical', ro: 'Util', fr: 'Pratique', de: 'Praktisch', es: 'Práctico', it: 'Utile' },
  'guide.cat.other': { en: 'Place', ro: 'Loc', fr: 'Lieu', de: 'Ort', es: 'Sitio', it: 'Luogo' },

  // ── Destination content: what's on ──
  // Events carry a month token and no year, so the copy never promises a date.
  'whatson.section': { en: 'While you’re there', ro: 'Cât ești acolo', fr: 'Pendant votre séjour', de: 'Während Ihres Aufenthalts', es: 'Mientras estés allí', it: 'Durante il soggiorno' },
  'whatson.yearRound': { en: '{place} through the year', ro: '{place} de-a lungul anului', fr: '{place} au fil de l’année', de: '{place} im Jahresverlauf', es: '{place} durante el año', it: '{place} durante l’anno' },
  'whatson.note': { en: 'Local events, not part of your booking', ro: 'Evenimente locale, nu fac parte din rezervare', fr: 'Événements locaux, non inclus dans votre réservation', de: 'Lokale Veranstaltungen, nicht Teil Ihrer Buchung', es: 'Eventos locales, no incluidos en tu reserva', it: 'Eventi locali, non inclusi nella prenotazione' },
  // Events whose month token sits outside the trip window, or did not parse at
  // all. Deliberately NOT a year-round claim: the source never states that an
  // event runs all year, so the heading only says 'not while you are there'.
  'whatson.otherTimes': { en: 'Other times of year', ro: 'În alte perioade ale anului', fr: 'À d’autres moments de l’année', de: 'Zu anderen Zeiten im Jahr', es: 'En otras épocas del año', it: 'In altri periodi dell’anno' },
  // Events whose month token cannot be read ('Easter', 'Varies'). Claims no date
  // at all, because filing them under a month or a season would assert the one
  // fact the source is missing.
  'whatson.datesVary': { en: 'Dates vary', ro: 'Datele variază', fr: 'Dates variables', de: 'Termine variieren', es: 'Fechas variables', it: 'Date variabili' },

  // ── Destination content: place ──
  'place.highlights': { en: 'Highlights', ro: 'Puncte forte', fr: 'À ne pas manquer', de: 'Highlights', es: 'Lo mejor', it: 'Da non perdere' },
  'place.thingsToDo': { en: 'Things to do', ro: 'Ce poți face', fr: 'À faire', de: 'Aktivitäten', es: 'Qué hacer', it: 'Cosa fare' },
  'place.food': { en: 'Food & drink', ro: 'Mâncare & băutură', fr: 'Manger & boire', de: 'Essen & Trinken', es: 'Comer y beber', it: 'Mangiare e bere' },
  'place.gettingThere': { en: 'Getting there', ro: 'Cum ajungi', fr: 'Y aller', de: 'Anreise', es: 'Cómo llegar', it: 'Come arrivare' },
  'place.gettingAround': { en: 'Getting around', ro: 'Cum te deplasezi', fr: 'Se déplacer', de: 'Vor Ort unterwegs', es: 'Cómo moverse', it: 'Come spostarsi' },
  'place.bestTime': { en: 'Best time to visit', ro: 'Cea mai bună perioadă', fr: 'Quand y aller', de: 'Beste Reisezeit', es: 'Mejor época para ir', it: 'Quando andare' },
  'place.flightTime': { en: 'Flight time from the UK', ro: 'Durata zborului din Marea Britanie', fr: 'Temps de vol depuis le Royaume-Uni', de: 'Flugzeit ab Großbritannien', es: 'Duración del vuelo desde el Reino Unido', it: 'Durata del volo dal Regno Unito' },
  'place.power': { en: 'Power', ro: 'Curent electric', fr: 'Électricité', de: 'Strom', es: 'Electricidad', it: 'Corrente elettrica' },
  'place.climate': { en: 'Typical weather', ro: 'Vreme obișnuită', fr: 'Météo habituelle', de: 'Typisches Wetter', es: 'Tiempo habitual', it: 'Meteo tipico' },
  // Tier labels on stacked prose — the same section can appear for the resort
  // and again for the region, and the traveller has to be able to tell which.
  'place.inOrlando': { en: 'In {place}', ro: 'În {place}', fr: 'À {place}', de: 'In {place}', es: 'En {place}', it: 'A {place}' },
  'place.acrossX': { en: 'Across {place}', ro: 'În {place}', fr: 'Dans toute la région de {place}', de: 'In ganz {place}', es: 'Por todo {place}', it: 'In tutta {place}' },
  'place.credit': { en: 'Destination content by Travelgenix', ro: 'Conținut despre destinație de Travelgenix', fr: 'Contenu destination par Travelgenix', de: 'Reiseziel-Inhalte von Travelgenix', es: 'Contenido del destino por Travelgenix', it: 'Contenuti destinazione di Travelgenix' },

  // ── Destination content: theme parks ──
  'park.section': { en: 'Your park guide', ro: 'Ghidul parcului tău', fr: 'Votre guide du parc', de: 'Ihr Park-Guide', es: 'Tu guía del parque', it: 'La tua guida al parco' },
  'park.nearby': { en: 'Theme parks in the area', ro: 'Parcuri tematice în zonă', fr: 'Parcs à thème dans la région', de: 'Freizeitparks in der Umgebung', es: 'Parques temáticos en la zona', it: 'Parchi a tema in zona' },
  'park.full': { en: 'Full park guide', ro: 'Ghid complet', fr: 'Guide complet du parc', de: 'Vollständiger Park-Guide', es: 'Guía completa del parque', it: 'Guida completa al parco' },
  'park.days': { en: 'Days needed', ro: 'Zile necesare', fr: 'Jours nécessaires', de: 'Benötigte Tage', es: 'Días necesarios', it: 'Giorni necessari' },
  'park.heights': { en: 'Height restrictions', ro: 'Restricții de înălțime', fr: 'Restrictions de taille', de: 'Größenbeschränkungen', es: 'Restricciones de altura', it: 'Limiti di altezza' },
  'park.fastTrack': { en: 'Fast track', ro: 'Acces rapid', fr: 'Coupe-file', de: 'Fast Track', es: 'Acceso rápido', it: 'Accesso rapido' },
  'park.family': { en: 'With children', ro: 'Cu copiii', fr: 'Avec des enfants', de: 'Mit Kindern', es: 'Con niños', it: 'Con bambini' },
  'park.thrill': { en: 'For thrill-seekers', ro: 'Pentru amatorii de adrenalină', fr: 'Pour les amateurs de sensations', de: 'Für Adrenalinjunkies', es: 'Para los amantes de la adrenalina', it: 'Per chi ama il brivido' },
  'park.stars': { en: 'Don’t miss', ro: 'Nu rata', fr: 'À ne pas manquer', de: 'Nicht verpassen', es: 'No te pierdas', it: 'Da non perdere' },
  'park.tips': { en: 'Insider tips', ro: 'Sfaturi utile', fr: 'Bons plans', de: 'Insidertipps', es: 'Consejos locales', it: 'Consigli utili' },
  'park.access': { en: 'Accessibility', ro: 'Accesibilitate', fr: 'Accessibilité', de: 'Barrierefreiheit', es: 'Accesibilidad', it: 'Accessibilità' },
  'park.hotels': { en: 'On-site hotels', ro: 'Hoteluri în parc', fr: 'Hôtels sur place', de: 'Hotels vor Ort', es: 'Hoteles en el recinto', it: 'Hotel interni' },
  'park.official': { en: 'Official website', ro: 'Site oficial', fr: 'Site officiel', de: 'Offizielle Website', es: 'Web oficial', it: 'Sito ufficiale' },
  'park.overview': { en: 'Overview', ro: 'Prezentare generală', fr: 'Aperçu', de: 'Überblick', es: 'Resumen', it: 'Panoramica' },
  // Guidance copy from the content base, never a bookable rate — the label has
  // to keep saying so in every locale.
  'park.tickets': { en: 'Tickets and prices', ro: 'Bilete și prețuri', fr: 'Billets et tarifs', de: 'Tickets und Preise', es: 'Entradas y precios', it: 'Biglietti e prezzi' },
  'park.priceGuide': { en: 'Price guide', ro: 'Ghid de prețuri', fr: 'Indication de prix', de: 'Preisrahmen', es: 'Orientación de precios', it: 'Fascia di prezzo' },
  'park.airport': { en: 'Nearest airport', ro: 'Cel mai apropiat aeroport', fr: 'Aéroport le plus proche', de: 'Nächstgelegener Flughafen', es: 'Aeropuerto más cercano', it: 'Aeroporto più vicino' },
  'park.combine': { en: 'Combine with', ro: 'Combină cu', fr: 'À combiner avec', de: 'Kombinieren mit', es: 'Combínalo con', it: 'Da abbinare a' },
  // {date} is the park record's Verified Date — the only provenance the parks
  // base carries. Never rendered without a real date behind it.
  'park.verifiedOn': { en: 'Verified {date}', ro: 'Verificat {date}', fr: 'Vérifié le {date}', de: 'Geprüft am {date}', es: 'Verificado el {date}', it: 'Verificato il {date}' },
  'park.unavailable': { en: 'Guide not available.', ro: 'Ghidul nu este disponibil.', fr: 'Guide non disponible.', de: 'Guide nicht verfügbar.', es: 'Guía no disponible.', it: 'Guida non disponibile.' },

  // ── Where next? / Add a few days ──
  'next.addDays': { en: 'Add a few days', ro: 'Adaugă câteva zile', fr: 'Ajoutez quelques jours', de: 'Ein paar Tage dranhängen', es: 'Añade unos días', it: 'Aggiungi qualche giorno' },
  'next.addDaysIntro': { en: 'Easy to pair with {place}.', ro: 'Se combină ușor cu {place}.', fr: 'Se combine facilement avec {place}.', de: 'Lässt sich gut mit {place} verbinden.', es: 'Fácil de combinar con {place}.', it: 'Si abbina facilmente a {place}.' },
  'next.becauseTags': { en: 'Because you liked {tags}', ro: 'Pentru că ți-a plăcut {tags}', fr: 'Parce que vous avez aimé {tags}', de: 'Weil Ihnen {tags} gefallen hat', es: 'Porque te gustó {tags}', it: 'Perché ti è piaciuto {tags}' },
  // Attribution for an automatic suggestion. Phrased as the machine's own
  // statement, NOT in the traveller's voice: this text also goes into an
  // enquiry email sent from the traveller's address, and an agent must not
  // read the suggested destination's tags as the traveller describing the
  // place they actually visited. {place} is where they are booked, {tags} the
  // tags the two places share.
  'next.suggestedBecause': {
    en: 'Suggested because it shares {tags} with {place}.',
    ro: 'Sugerat pentru că are în comun {tags} cu {place}.',
    fr: 'Suggéré car cette destination partage {tags} avec {place}.',
    de: 'Vorgeschlagen, weil dieses Ziel {tags} mit {place} gemeinsam hat.',
    es: 'Sugerido porque comparte {tags} con {place}.',
    it: 'Suggerito perché condivide {tags} con {place}.',
  },
  'next.alsoGoodFor': { en: 'Also good for {tags}.', ro: 'Bun și pentru {tags}.', fr: 'Également apprécié pour {tags}.', de: 'Ebenfalls gut für {tags}.', es: 'También ideal para {tags}.', it: 'Ottimo anche per {tags}.' },

  // ── Home tiles / hero ──
  'tile.tickets': { en: 'Tickets', ro: 'Bilete', fr: 'Billets', de: 'Tickets', es: 'Entradas', it: 'Biglietti' },
  'tile.things': { en: 'Things to do', ro: 'Ce poți face', fr: 'À faire', de: 'Aktivitäten', es: 'Qué hacer', it: 'Cosa fare' },
  'home.tripCustom': { en: 'Your itinerary', ro: 'Itinerarul tău', fr: 'Votre itinéraire', de: 'Ihr Reiseplan', es: 'Tu itinerario', it: 'Il tuo itinerario' },
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
