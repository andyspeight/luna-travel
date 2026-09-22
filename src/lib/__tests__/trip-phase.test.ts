import { describe, it, expect } from 'vitest';
import {
  tripPhase,
  flightOfTheDay,
  outboundFlight,
  returnFlight,
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

const leg = (id: string, dep: string, arr: string): FlightLeg =>
  ({
    id,
    carrierCode: 'EY',
    carrierName: 'Etihad',
    flightNumber: 'EY20',
    cabin: 'Economy',
    depAirport: 'LHR',
    depAirportName: 'London Heathrow',
    depCity: 'London',
    depTime: dep,
    arrAirport: 'AUH',
    arrAirportName: 'Abu Dhabi',
    arrCity: 'Abu Dhabi',
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

const OUT = leg('out', '2026-10-17T21:35:00Z', '2026-10-18T08:10:00Z');
const BACK = leg('back', '2026-10-24T10:00:00Z', '2026-10-24T14:30:00Z');
const TRIP = booking([OUT, BACK], '2026-10-17T21:35:00Z', '2026-10-24T14:30:00Z');

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
      [leg('out', '2026-11-02T00:40:00Z', '2026-11-02T09:00:00Z')],
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
    const broken = booking([leg('x', 'not-a-date', 'nope')], 'rubbish', 'also-rubbish');
    expect(() => tripPhase(broken, at('2026-10-17T09:00:00Z'))).not.toThrow();
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
