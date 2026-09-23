import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { buildTimeline, groupByDay } from '@/lib/booking-helpers';
import { formatTime } from '@/lib/format';
import { BOOKINGS } from '@/data/mock-bookings';
import type { Booking, FlightLeg, Hotel } from '@/types/booking';

/**
 * The order of a day on the itinerary.
 *
 * Travelify dates a hotel check-in with no time of day. Read as an instant that
 * is midnight, so WCS96420 (Rome, 12–15 Feb 2027) listed the hotel ABOVE the
 * flight that takes you there, and printed "00:00" as its check-in time. These
 * are written in the shape Travelify actually sends: bare dates for the hotel,
 * airport-local times dressed as UTC for the flights.
 */

const flight = (id: string, dep: string, arr: string, over: Partial<FlightLeg> = {}): FlightLeg => ({
  id,
  carrierCode: 'BA',
  carrierName: 'British Airways',
  flightNumber: 'BA' + id,
  cabin: 'Economy',
  depAirport: 'LHR',
  depAirportName: 'Heathrow',
  depCity: 'London',
  depTime: dep,
  arrAirport: 'FCO',
  arrAirportName: 'Fiumicino',
  arrCity: 'Rome',
  arrTime: arr,
  durationMinutes: 150,
  ...over,
});

const hotel = (over: Partial<Hotel> = {}): Hotel => ({
  id: 'h1',
  name: 'Hotel Artemide',
  city: 'Rome',
  country: 'Italy',
  countryCode: 'IT',
  checkIn: '2027-02-12',
  checkOut: '2027-02-15',
  nights: 3,
  roomName: 'Double',
  ...over,
});

const rome = (over: Partial<Booking> = {}): Booking => ({
  ...BOOKINGS[0],
  flights: [
    flight('1', '2027-02-12T09:05:00Z', '2027-02-12T12:40:00Z'),
    flight('2', '2027-02-15T17:20:00Z', '2027-02-15T19:15:00Z', {
      depAirport: 'FCO', arrAirport: 'LHR', depCity: 'Rome', arrCity: 'London',
    }),
  ],
  hotels: [hotel()],
  airportExtras: [],
  experiences: [],
  ...over,
});

const kinds = (b: Booking) => buildTimeline(b).map((e) => `${e.kind}:${e.date.slice(0, 10)}`);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date('2026-09-23T12:00:00Z'));
});
afterEach(() => vi.useRealTimers());

describe('the order of a travel day', () => {
  it('puts the outbound flight before the hotel it takes you to', () => {
    expect(kinds(rome())).toEqual([
      'flight:2027-02-12',
      'hotel-checkin:2027-02-12',
      'hotel-checkout:2027-02-15',
      'flight:2027-02-15',
    ]);
  });

  it('keeps them on the same day', () => {
    const days = groupByDay(buildTimeline(rome()));
    expect(days[0]).toMatchObject({ day: '2027-02-12' });
    expect(days[0].events.map((e) => e.kind)).toEqual(['flight', 'hotel-checkin']);
  });

  // Checking out is how the last day starts, before the flight home.
  it('checks out before the flight home', () => {
    const last = groupByDay(buildTimeline(rome())).at(-1)!;
    expect(last.events.map((e) => e.kind)).toEqual(['hotel-checkout', 'flight']);
  });

  it('goes after the LAST flight to land that day, not the first', () => {
    const b = rome({
      flights: [
        flight('1', '2027-02-12T06:00:00Z', '2027-02-12T07:10:00Z', { arrAirport: 'MXP', arrCity: 'Milan' }),
        flight('3', '2027-02-12T09:30:00Z', '2027-02-12T10:40:00Z', { depAirport: 'MXP', depCity: 'Milan' }),
      ],
    });
    expect(buildTimeline(b).map((e) => e.id)).toEqual(['flight-1', 'flight-3', 'hotel-checkin-h1', 'hotel-checkout-h1']);
  });

  // An overnight flight lands the day after it leaves; the hotel is dated
  // the day you arrive, and follows the landing.
  it('follows an overnight flight that lands on the check-in date', () => {
    const b = rome({
      flights: [flight('1', '2027-02-11T22:30:00Z', '2027-02-12T06:15:00Z')],
    });
    expect(buildTimeline(b).map((e) => e.kind)).toEqual(['flight', 'hotel-checkin', 'hotel-checkout']);
  });

  it('checks in after an untimed transfer from the airport', () => {
    const b = rome({
      experiences: [
        { id: 't1', kind: 'transfer', title: 'Airport transfer', startDate: '2027-02-12' } as NonNullable<Booking['experiences']>[number],
      ],
    });
    const day1 = groupByDay(buildTimeline(b))[0].events.map((e) => e.kind);
    expect(day1).toEqual(['flight', 'transfer', 'hotel-checkin']);
  });

  // A check-in with a real time (a manual booking can carry one) is left
  // exactly where its time puts it.
  it('leaves a timed check-in where its time says', () => {
    const b = rome({ hotels: [hotel({ checkIn: '2027-02-12T08:00:00Z', checkOut: '2027-02-15T10:00:00Z' })] });
    expect(kinds(b)[0]).toBe('hotel-checkin:2027-02-12');
  });

  // A day with no flight: moving between two hotels.
  it('checks out of one hotel before checking in to the next', () => {
    const b = rome({
      flights: [],
      hotels: [hotel(), hotel({ id: 'h2', name: 'Villa Sorrento', checkIn: '2027-02-15', checkOut: '2027-02-18' })],
    });
    const moving = groupByDay(buildTimeline(b)).find((d) => d.day === '2027-02-15')!;
    expect(moving.events.map((e) => e.id)).toEqual(['hotel-checkout-h1', 'hotel-checkin-h2']);
  });
});

describe('an event with no time of day', () => {
  it('prints no time at all, rather than midnight', () => {
    expect(formatTime('2027-02-12')).toBe('');
    expect(formatTime('2027-02-12T00:00:00Z')).toBe('00:00'); // a real midnight is still a time
    expect(formatTime('2027-02-12T09:05:00Z')).toBe('09:05');
  });

  it('is not over until its day is', () => {
    vi.setSystemTime(new Date('2027-02-12T10:00:00Z')); // at the airport, not yet landed
    const checkIn = buildTimeline(rome()).find((e) => e.kind === 'hotel-checkin')!;
    expect(checkIn.past).toBe(false);
    vi.setSystemTime(new Date('2027-02-13T00:30:00Z'));
    expect(buildTimeline(rome()).find((e) => e.kind === 'hotel-checkin')!.past).toBe(true);
  });
});
