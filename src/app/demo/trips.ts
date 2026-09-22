/**
 * The four demo trips, as a sales asset rather than as data.
 *
 * Deliberately NOT derived from mock-bookings.ts. That file is the fixture the
 * app renders and the smoke tests drive; this is the pitch, and the two want
 * different things. Pulling the headline copy out of the fixture would mean a
 * test-data tweak silently rewriting the page somebody is showing a prospect.
 *
 * The references must match, though, and the tests assert exactly that.
 */

export interface DemoTrip {
  reference: string;
  destination: string;
  /** Where the trip actually is — one line under the name. */
  place: string;
  duration: string;
  /** Country code, for the cover image. */
  cc: 'mv' | 'es' | 'ae' | 'gr';
  /** The one thing worth opening this trip to see. */
  highlight: string;
}

export const DEMO_TRIPS: DemoTrip[] = [
  {
    reference: 'DEMO81297',
    destination: 'Maldives',
    place: 'Gulhi Island, South Malé Atoll',
    duration: '7 nights',
    cc: 'mv',
    highlight: 'The fullest trip — long-haul flights, transfers, documents and a balance to pay.',
  },
  {
    reference: 'DEMO52188',
    destination: 'Athens',
    place: 'Plaka',
    duration: '3 nights',
    cc: 'gr',
    highlight: 'Open this one for Trip essentials — the phrase book and the allergy card, in Greek.',
  },
  {
    reference: 'DEMO66541',
    destination: 'Dubai',
    place: 'Palm Jumeirah',
    duration: '5 nights',
    cc: 'ae',
    highlight: 'Two hotels on one trip, with airport extras and a lounge pass.',
  },
  {
    reference: 'DEMO74002',
    destination: 'Mallorca',
    place: 'Playa de Muro, Alcúdia',
    duration: '10 nights',
    cc: 'es',
    highlight: 'A family booking — see how the party, rooms and seats are laid out.',
  },
];

/** The live traveller app. Absolute, because a QR code has no origin. */
export function tripUrl(origin: string, reference: string): string {
  return `${origin.replace(/\/+$/, '')}/?demo=${reference}`;
}

export function coverUrl(cc: DemoTrip['cc'], variant: 'landscape' | 'portrait'): string {
  return `/images/destinations/cover-${cc}-${variant}.webp`;
}

/**
 * What the app does, in the order an agent cares about.
 *
 * Every one of these is live in the demo trips — nothing here is a roadmap
 * item. A prospect who taps through and cannot find a claimed feature has been
 * told a small lie, and that is the one thing a demo page must never do.
 */
export const CAPABILITIES: Array<{ title: string; body: string }> = [
  {
    title: 'Live flight alerts',
    body: 'Gate, terminal and delay changes pushed to the phone as the airline files them — not when the traveller remembers to check.',
  },
  {
    title: 'Documents that work offline',
    body: 'Tickets, vouchers and ATOL certificates cached on the device. They open in a terminal with no signal and no roaming.',
  },
  {
    title: 'Ask Luna',
    body: 'Answers read straight off the booking — baggage, check-out, what is still owed. Facts come from your data, never invented.',
  },
  {
    title: 'Trip essentials',
    body: 'Currency, plugs, emergency numbers, a phrase book and an allergy card in twelve languages. Built from the destination, not written per trip.',
  },
  {
    title: 'Your brand, not ours',
    body: 'Your name, logo and colours throughout. The traveller never sees a third party between you and them.',
  },
  {
    title: 'Nothing to install',
    body: 'It opens in the browser and adds to the home screen like an app. No app store, no download, no approval queue.',
  },
];

/** Real screens, shot from the running app. */
export const SCREENS: Array<{ src: string; alt: string; caption: string }> = [
  { src: '/guide/traveller-home.png', alt: 'The trip home screen', caption: 'Home' },
  { src: '/guide/traveller-itinerary.png', alt: 'The day-by-day itinerary', caption: 'Itinerary' },
  { src: '/guide/traveller-documents.png', alt: 'Travel documents', caption: 'Documents' },
  { src: '/guide/traveller-destination.png', alt: 'The destination guide', caption: 'Destination' },
];
