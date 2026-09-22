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

/**
 * The longest gap still counted as changing planes rather than as the holiday
 * itself. Overnight layovers happen; six-day ones do not.
 */
const CONNECTION_MAX_HOURS = 24;

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

/** Every flight with a usable departure time, earliest first. */
function legs(booking: Booking): FlightLeg[] {
  return (booking.flights || [])
    .filter((f) => Number.isFinite(ms(f.depTime)))
    .slice()
    .sort((a, b) => ms(a.depTime) - ms(b.depTime));
}

/** When this leg is down. Falls back to departure rather than to nothing. */
function landsAt(f: FlightLeg): number {
  const arr = ms(f.arrTime);
  return Number.isFinite(arr) ? arr : ms(f.depTime);
}

function sameAirport(a: string | undefined, b: string | undefined): boolean {
  return !!a && !!b && a.trim().toUpperCase() === b.trim().toUpperCase();
}

/**
 * The journey out and the journey home.
 *
 * A long-haul trip is not two flights, it is four — and treating the first and
 * last as "out" and "back" is how the app came to tell somebody flying home
 * from Malé that their flight left Abu Dhabi at 21:15, while the plane they
 * actually had to catch left Malé at half past two.
 *
 * The rule: the journey home is the run of connecting legs at the end that
 * lands you back where you started. Walk backwards from the last leg for as
 * long as each leg continues from where the one before it landed, and as long
 * as the wait between them is a connection rather than a stay.
 *
 * It claims nothing it cannot see. A one-way, or an itinerary that never
 * returns to its origin, simply has no journey home, and the screen says
 * "outbound" — which is true — instead of guessing.
 */
export function journeys(booking: Booking): { out: FlightLeg[]; home: FlightLeg[] } {
  const all = legs(booking);
  if (all.length < 2) return { out: all, home: [] };

  const origin = all[0].depAirport;
  if (!sameAirport(all[all.length - 1].arrAirport, origin)) return { out: all, home: [] };

  // Never walk back past the first leg: a day trip out and back is still a
  // journey out followed by a journey home, however short the gap between.
  let start = all.length - 1;
  while (start > 1) {
    const prev = all[start - 1];
    const here = all[start];
    if (!sameAirport(prev.arrAirport, here.depAirport)) break;
    if (ms(here.depTime) - landsAt(prev) > CONNECTION_MAX_HOURS * 3600_000) break;
    start -= 1;
  }

  return { out: all.slice(0, start), home: all.slice(start) };
}

/** The first flight out — the one that starts the journey. */
export function outboundFlight(booking: Booking): FlightLeg | null {
  return journeys(booking).out[0] ?? null;
}

/**
 * The flight home: the first leg of the journey back, not the last.
 *
 * The leg that matters is the one you have to get to an airport for.
 */
export function returnFlight(booking: Booking): FlightLeg | null {
  return journeys(booking).home[0] ?? null;
}

/**
 * Which flight, if any, the traveller has still to take around now.
 *
 * The next one that has not yet landed, so a connection rolls over to the
 * onward leg the moment the first is down — standing in Abu Dhabi at nine in
 * the morning, the flight that matters is the ten o'clock one.
 *
 * Once everything today has landed there is nothing left to catch, so it
 * answers with nothing and the screen goes back to the trip itself.
 */
export function flightOfTheDay(booking: Booking, now: number): FlightLeg | null {
  const lead = TRAVEL_DAY_LEAD_HOURS * 3600_000;
  const today = localDay(now);

  for (const f of legs(booking)) {
    if (now > landsAt(f)) continue;
    const dep = ms(f.depTime);
    // The whole calendar day of departure, plus the hours leading into it.
    if (localDay(dep) === today || now >= dep - lead) return f;
  }
  return null;
}

/**
 * The phase.
 *
 * Order matters. "After" is checked first because a finished trip is finished
 * whatever its flights say — but a trip is not finished while the traveller is
 * still in the air, whatever the hotel checkout date says.
 */
export function tripPhase(booking: Booking, now: number = Date.now()): TripPhase {
  const all = legs(booking);
  const ends = [ms(booking.tripEnd), all.length ? landsAt(all[all.length - 1]) : NaN].filter(
    Number.isFinite,
  );
  if (ends.length && now > Math.max(...ends)) return 'after';

  const flight = flightOfTheDay(booking, now);
  if (flight) {
    const { home } = journeys(booking);
    return home.some((f) => f.id === flight.id) ? 'returning' : 'travel-day';
  }

  const start = ms(booking.tripStart);
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
