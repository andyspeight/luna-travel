import { describe, it, expect } from 'vitest';
import {
  tripPhase,
  flightOfTheDay,
  outboundFlight,
  returnFlight,
  journeys,
  daysUntil,
  freshness,
  TRAVEL_DAY_LEAD_HOURS,
} from '@/lib/trip-phase';
import type { Booking, FlightLeg } from '@/types/booking';

/**
 * The phase decides what the home screen leads with, so getting it wrong is
 * not cosmetic: it is the difference between a gate number and a countdown in
 * the departures hall.
 */

const leg = (
  id: string,
  from: string,
  dep: string,
  to: string,
  arr: string,
): FlightLeg =>
  ({
    id,
    carrierCode: 'EY',
    carrierName: 'Etihad',
    flightNumber: 'EY20',
    cabin: 'Economy',
    depAirport: from,
    depAirportName: from,
    depCity: from,
    depTime: dep,
    arrAirport: to,
    arrAirportName: to,
    arrCity: to,
    arrTime: arr,
    durationMinutes: 420,
  }) as FlightLeg;

const booking = (flights: FlightLeg[], start: string, end: string): Booking =>
  ({
    reference: 'TEST1',
    tripStart: start,
    tripEnd: end,
    flights,
    hotels: [],
    travellers: [],
    airportExtras: [],
    documents: [],
  }) as unknown as Booking;

const OUT = leg('out', 'LHR', '2026-10-17T21:35:00Z', 'AUH', '2026-10-18T08:10:00Z');
const BACK = leg('back', 'AUH', '2026-10-24T10:00:00Z', 'LHR', '2026-10-24T14:30:00Z');
const TRIP = booking([OUT, BACK], '2026-10-17T21:35:00Z', '2026-10-24T14:30:00Z');

/**
 * The real shape of a long-haul holiday, and the one that caught three bugs:
 * four legs, two of them connections. Modelled on the Maldives demo.
 */
const L1 = leg('l1', 'LGW', '2026-11-27T20:15:00Z', 'AUH', '2026-11-28T07:25:00Z');
const L2 = leg('l2', 'AUH', '2026-11-28T10:00:00Z', 'MLE', '2026-11-28T12:55:00Z');
const L3 = leg('l3', 'MLE', '2026-12-04T14:30:00Z', 'AUH', '2026-12-04T18:05:00Z');
const L4 = leg('l4', 'AUH', '2026-12-04T21:15:00Z', 'LGW', '2026-12-05T02:25:00Z');
// tripEnd is the hotel checkout, which falls BEFORE the flights home.
const LONGHAUL = booking([L1, L2, L3, L4], '2026-11-27T20:15:00Z', '2026-12-04T11:00:00Z');

const at = (iso: string) => new Date(iso).getTime();

describe('tripPhase', () => {
  it('counts down before the trip', () => {
    expect(tripPhase(TRIP, at('2026-10-05T09:00:00Z'))).toBe('before');
  });

  // THE one the review asked for: the departures hall, not the sofa.
  it('switches to travel day on the day of the outbound flight', () => {
    expect(tripPhase(TRIP, at('2026-10-17T07:00:00Z'))).toBe('travel-day');
    expect(tripPhase(TRIP, at('2026-10-17T20:50:00Z'))).toBe('travel-day');
  });

  it('is already travel day in the hours before a flight that leaves after midnight', () => {
    // A 00:40 departure means leaving home the evening before, and the
    // calendar date alone would still be saying "1 day to go".
    const redEye = booking(
      [leg('out', 'LHR', '2026-11-02T00:40:00Z', 'AUH', '2026-11-02T09:00:00Z')],
      '2026-11-02T00:40:00Z',
      '2026-11-09T00:00:00Z',
    );
    expect(tripPhase(redEye, at('2026-11-01T19:00:00Z'))).toBe('travel-day');
    expect(tripPhase(redEye, at('2026-11-01T09:00:00Z'))).toBe('before');
  });

  it('is in-trip between the flights', () => {
    expect(tripPhase(TRIP, at('2026-10-20T11:00:00Z'))).toBe('in-trip');
  });

  // The day you fly home is a travel day, not another day by the pool.
  it('calls the day of the return flight "returning"', () => {
    expect(tripPhase(TRIP, at('2026-10-24T06:00:00Z'))).toBe('returning');
  });

  it('is after once the trip has ended', () => {
    expect(tripPhase(TRIP, at('2026-10-25T09:00:00Z'))).toBe('after');
  });

  // A finished trip is finished whatever its flights say.
  it('prefers "after" over a flight still sitting in the data', () => {
    const ended = booking([OUT], '2026-10-17T21:35:00Z', '2026-10-18T08:10:00Z');
    expect(tripPhase(ended, at('2026-10-19T00:00:00Z'))).toBe('after');
  });

  it('does not fall over on a booking with no flights', () => {
    const hotelOnly = booking([], '2026-10-17T00:00:00Z', '2026-10-24T00:00:00Z');
    expect(tripPhase(hotelOnly, at('2026-10-10T00:00:00Z'))).toBe('before');
    expect(tripPhase(hotelOnly, at('2026-10-20T00:00:00Z'))).toBe('in-trip');
    expect(tripPhase(hotelOnly, at('2026-10-30T00:00:00Z'))).toBe('after');
  });

  it('survives unparseable dates rather than throwing', () => {
    const broken = booking([leg('x', 'LHR', 'not-a-date', 'AUH', 'nope')], 'rubbish', 'also-rubbish');
    expect(() => tripPhase(broken, at('2026-10-17T09:00:00Z'))).not.toThrow();
  });
});

/**
 * Four legs, not two. Every one of these was wrong before the journey split:
 * a long-haul traveller is the one this screen is for, and the hero demo is
 * exactly this shape.
 */
describe('a long-haul trip with connections', () => {
  it('leads with the onward leg while connecting, not with nothing', () => {
    // Nine in the morning in Abu Dhabi, the Malé flight at ten. The screen
    // used to show the ordinary home screen at precisely this moment.
    expect(tripPhase(LONGHAUL, at('2026-11-28T09:00:00Z'))).toBe('travel-day');
    expect(flightOfTheDay(LONGHAUL, at('2026-11-28T09:00:00Z'))?.id).toBe('l2');
  });

  // THE worst of them. Showing the 21:15 connection out of Abu Dhabi to
  // somebody who has to be at Malé by half past two is worse than showing
  // nothing at all.
  it('leads with the flight they must get to, not the connection after it', () => {
    expect(flightOfTheDay(LONGHAUL, at('2026-12-04T06:00:00Z'))?.id).toBe('l3');
    expect(tripPhase(LONGHAUL, at('2026-12-04T06:00:00Z'))).toBe('returning');
  });

  it('rolls on to the connection once the first leg is down', () => {
    expect(flightOfTheDay(LONGHAUL, at('2026-12-04T19:00:00Z'))?.id).toBe('l4');
  });

  // tripEnd is the hotel checkout at 11:00, hours before they even leave.
  it('does not declare the trip over while they are still in the air', () => {
    expect(tripPhase(LONGHAUL, at('2026-12-04T15:00:00Z'))).toBe('returning');
    expect(tripPhase(LONGHAUL, at('2026-12-05T01:00:00Z'))).toBe('returning');
  });

  it('is over once the last leg has landed', () => {
    expect(tripPhase(LONGHAUL, at('2026-12-05T04:00:00Z'))).toBe('after');
  });

  it('goes back to the trip itself once the day’s flying is done', () => {
    // Landed in Malé at 12:55. Nothing left to catch, so the screen stops
    // being a flight screen.
    expect(flightOfTheDay(LONGHAUL, at('2026-11-28T14:00:00Z'))).toBeNull();
    expect(tripPhase(LONGHAUL, at('2026-11-28T14:00:00Z'))).toBe('in-trip');
  });

  it('splits the journey out from the journey home at the holiday', () => {
    const { out, home } = journeys(LONGHAUL);
    expect(out.map((f) => f.id)).toEqual(['l1', 'l2']);
    expect(home.map((f) => f.id)).toEqual(['l3', 'l4']);
    expect(outboundFlight(LONGHAUL)?.id).toBe('l1');
    expect(returnFlight(LONGHAUL)?.id).toBe('l3');
  });
});

describe('picking the right flight', () => {
  it('takes the earliest departure as the outbound, not the array order', () => {
    const reversed = booking([BACK, OUT], TRIP.tripStart, TRIP.tripEnd);
    expect(outboundFlight(reversed)?.id).toBe('out');
    expect(returnFlight(reversed)?.id).toBe('back');
  });

  it('has no return flight on a one-way', () => {
    expect(returnFlight(booking([OUT], TRIP.tripStart, TRIP.tripEnd))).toBeNull();
  });

  // A one-way with a connection never comes back, so neither leg is "home".
  it('does not invent a flight home on a one-way with a connection', () => {
    const oneWay = booking([L1, L2], '2026-11-27T20:15:00Z', '2026-12-04T11:00:00Z');
    expect(journeys(oneWay).home).toEqual([]);
    expect(returnFlight(oneWay)).toBeNull();
    expect(tripPhase(oneWay, at('2026-11-27T09:00:00Z'))).toBe('travel-day');
  });

  // Out in the morning, back the same evening. The gap is hours, but the
  // evening flight is still the way home and must not be labelled outbound.
  it('still finds the way home on a day trip', () => {
    const dayTrip = booking(
      [
        leg('a', 'LCY', '2026-10-06T07:00:00Z', 'AMS', '2026-10-06T08:10:00Z'),
        leg('b', 'AMS', '2026-10-06T19:00:00Z', 'LCY', '2026-10-06T20:10:00Z'),
      ],
      '2026-10-06T07:00:00Z',
      '2026-10-06T20:10:00Z',
    );
    expect(outboundFlight(dayTrip)?.id).toBe('a');
    expect(returnFlight(dayTrip)?.id).toBe('b');
    expect(tripPhase(dayTrip, at('2026-10-06T12:00:00Z'))).toBe('returning');
  });

  // Fly into one city, home from another. Nothing chains, so the last leg is
  // the whole journey home.
  it('handles an open jaw without swallowing the outbound', () => {
    const openJaw = booking(
      [
        leg('a', 'LHR', '2026-10-06T07:00:00Z', 'CDG', '2026-10-06T09:10:00Z'),
        leg('b', 'FCO', '2026-10-12T19:00:00Z', 'LHR', '2026-10-12T21:10:00Z'),
      ],
      '2026-10-06T07:00:00Z',
      '2026-10-12T21:10:00Z',
    );
    expect(outboundFlight(openJaw)?.id).toBe('a');
    expect(returnFlight(openJaw)?.id).toBe('b');
  });

  it('names the flight of the day so the screen can lead with it', () => {
    expect(flightOfTheDay(TRIP, at('2026-10-17T12:00:00Z'))?.id).toBe('out');
    expect(flightOfTheDay(TRIP, at('2026-10-24T06:00:00Z'))?.id).toBe('back');
    expect(flightOfTheDay(TRIP, at('2026-10-20T12:00:00Z'))).toBeNull();
  });

  it('uses the documented lead time', () => {
    const dep = at('2026-10-17T21:35:00Z');
    const justInside = dep - (TRAVEL_DAY_LEAD_HOURS - 1) * 3600_000;
    expect(flightOfTheDay(TRIP, justInside)?.id).toBe('out');
  });
});

describe('daysUntil', () => {
  it('rounds up, so the evening before still says one day', () => {
    expect(daysUntil('2026-10-17T21:35:00Z', at('2026-10-16T22:00:00Z'))).toBe(1);
  });

  it('is zero once the moment has passed', () => {
    expect(daysUntil('2026-10-17T21:35:00Z', at('2026-10-18T00:00:00Z'))).toBe(0);
  });

  it('is zero rather than negative for nonsense', () => {
    expect(daysUntil('not-a-date', at('2026-10-17T00:00:00Z'))).toBe(0);
  });
});

describe('freshness', () => {
  const now = at('2026-10-17T20:10:00Z');

  it('calls a recent reading live', () => {
    expect(freshness('2026-10-17T20:05:00Z', now)).toBe('live');
  });

  it('calls an old one stale rather than letting it pass as current', () => {
    expect(freshness('2026-10-17T18:00:00Z', now)).toBe('stale');
  });

  // A status with no timestamp is worse than no status: it looks current and
  // cannot be checked.
  it('has nothing to say when there is no timestamp', () => {
    expect(freshness(null, now)).toBe('none');
    expect(freshness(undefined, now)).toBe('none');
    expect(freshness('not-a-date', now)).toBe('none');
  });
});
