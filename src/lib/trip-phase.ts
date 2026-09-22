/**
 * Where the traveller is in their journey.
 *
 * The home screen had two states: a countdown, and "the trip is over". Between
 * those two it showed the same screen on the sofa six weeks out as it did in
 * the departures hall with a gate about to close — the moment the app is most
 * useful and has the least time to be read.
 *
 * So the screen gets a phase, and each phase gets one dominant job:
 *
 *   before      anticipation and preparation
 *   travel-day  the flight: terminal, gate, status, documents
 *   in-trip     what is on today, where things are
 *   returning   the flight home
 *   after       feedback, past documents, the next trip
 *
 * Pure, and tested without a network or a clock — `now` is always passed in,
 * because a phase that only reveals itself at 3am on a Tuesday in November is
 * a phase nobody can test.
 */

import type { Booking, FlightLeg } from '@/types/booking';

export type TripPhase = 'before' | 'travel-day' | 'in-trip' | 'returning' | 'after';

/**
 * How long before departure the app switches into travel-day mode.
 *
 * Not only the calendar date: a 00:40 departure means leaving home the evening
 * before, and somebody packing at 9pm for a flight in four hours is already
 * travelling whatever the date says. Eight hours covers the trip to the airport
 * and the usual three-hour check-in without reaching back into the day before a
 * mid-afternoon flight.
 */
export const TRAVEL_DAY_LEAD_HOURS = 8;

function ms(iso: string | undefined | null): number {
  if (!iso) return NaN;
  return new Date(iso).getTime();
}

/** Calendar date in the traveller's own timezone, as YYYY-MM-DD. */
function localDay(t: number): string {
  const d = new Date(t);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

/** The first flight out, by departure time — not merely the first in the array. */
export function outboundFlight(booking: Booking): FlightLeg | null {
  const withTimes = (booking.flights || []).filter((f) => Number.isFinite(ms(f.depTime)));
  if (!withTimes.length) return null;
  return withTimes.reduce((a, b) => (ms(a.depTime) <= ms(b.depTime) ? a : b));
}

/** The last flight, which for a return trip is the one home. */
export function returnFlight(booking: Booking): FlightLeg | null {
  const withTimes = (booking.flights || []).filter((f) => Number.isFinite(ms(f.depTime)));
  if (withTimes.length < 2) return null;
  return withTimes.reduce((a, b) => (ms(a.depTime) >= ms(b.depTime) ? a : b));
}

/**
 * Which flight, if any, the traveller is taking around now.
 *
 * Used by the screen to decide what to put at the top, so it answers for the
 * whole travel day rather than only while airborne.
 */
export function flightOfTheDay(booking: Booking, now: number): FlightLeg | null {
  const soon = (f: FlightLeg | null) => {
    if (!f) return false;
    const dep = ms(f.depTime);
    if (!Number.isFinite(dep)) return false;
    const lead = TRAVEL_DAY_LEAD_HOURS * 3600_000;
    // The whole calendar day of departure, plus the hours leading into it.
    if (localDay(dep) === localDay(now)) return true;
    return now >= dep - lead && now <= ms(f.arrTime || f.depTime);
  };

  const out = outboundFlight(booking);
  if (soon(out)) return out;
  const back = returnFlight(booking);
  if (soon(back)) return back;
  return null;
}

/**
 * The phase.
 *
 * Order matters. "After" is checked first because a finished trip is finished
 * whatever its flights say, and travel-day before in-trip because the day you
 * fly home is a travel day, not another day by the pool.
 */
export function tripPhase(booking: Booking, now: number = Date.now()): TripPhase {
  const end = ms(booking.tripEnd);
  const start = ms(booking.tripStart);

  if (Number.isFinite(end) && now > end) return 'after';

  const flight = flightOfTheDay(booking, now);
  if (flight) {
    const back = returnFlight(booking);
    return back && flight.id === back.id ? 'returning' : 'travel-day';
  }

  if (Number.isFinite(start) && now >= start) return 'in-trip';
  return 'before';
}

/**
 * Whole days until departure, for the countdown.
 *
 * Rounded UP, because "1 day to go" on the evening before reads better than
 * the zero a floor would give while the traveller is still at home.
 */
export function daysUntil(iso: string, now: number = Date.now()): number {
  const t = ms(iso);
  if (!Number.isFinite(t) || t <= now) return 0;
  return Math.ceil((t - now) / 86_400_000);
}

/** Is this flight's data fresh enough to present as current? */
export type FreshnessState = 'live' | 'stale' | 'none';

/**
 * How much to trust a live status.
 *
 * A status with no timestamp is worse than no status: it looks current and
 * cannot be checked. The review put it well — an offline traveller should see
 * "Offline · Last updated 09:12", not a reassuring word with no age on it.
 */
export function freshness(
  reportedAt: string | null | undefined,
  now: number = Date.now(),
  staleAfterMinutes = 45,
): FreshnessState {
  const t = ms(reportedAt);
  if (!Number.isFinite(t)) return 'none';
  return now - t <= staleAfterMinutes * 60_000 ? 'live' : 'stale';
}
