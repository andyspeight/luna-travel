/**
 * When a booking may be drawn, and on which screens.
 *
 * The booking provider has to hold *a* booking from its first render, and
 * until the check for the traveller's real one comes back the only one it has
 * is the built-in sample: the Swan family's Maldives trip. The home screen
 * waited for that check. Nothing else did, so for the few seconds a Travelify
 * lookup takes, every other screen showed a real traveller the sample family's
 * names, flights and hotel, and Documents let them open and download the
 * sample's tickets (24 Sep 2026, reported by us and then by a client).
 *
 * The rule is that a traveller's app shows their booking and nothing else. So
 * it is decided once, here, and enforced once, around every screen in the
 * layout (components/booking-gate.tsx), rather than trusted to each screen to
 * remember.
 *
 * Pure, so it can be tested without a browser.
 */

export interface BookingState {
  /** 'live' once the traveller's own booking has arrived. */
  source: 'mock' | 'live';
  /** The check for a real booking is still running. */
  liveLoading: boolean;
  /** A demo trip was asked for by name (a demo link, a saved choice, the picker). */
  demoSelected: boolean;
}

/**
 * May the provider's booking be shown? Only when it is the traveller's own, or
 * a demo somebody asked for and the check has found no real booking to replace
 * it. A demo waits for that check too: a traveller who once looked at a demo on
 * this phone must not glimpse it on the way to their own trip.
 */
export function bookingReady(s: BookingState): boolean {
  if (s.source === 'live') return true;
  return s.demoSelected && !s.liveLoading;
}

/**
 * Screens that draw no booking, so never wait for one: the agency portal and
 * admin, the demo landing page, the way in (install and welcome) and the
 * offline fallback. Everything else is a traveller screen and waits, so a new
 * screen is covered without anybody having to remember to add it.
 */
const NO_BOOKING = ['/agency', '/admin', '/demo', '/install', '/welcome', '/offline'] as const;

export function needsBooking(pathname: string | null | undefined): boolean {
  const p = pathname || '/';
  return !NO_BOOKING.some((prefix) => p === prefix || p.startsWith(`${prefix}/`));
}
