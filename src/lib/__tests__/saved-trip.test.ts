/**
 * The copy of a traveller's own trip kept on their phone for no signal.
 *
 * It exists so the trip opens in a terminal with no network. The rules that
 * matter are the ones about whose trip it is and when it must go: it must
 * never outlive the session it came from, and a phone that moves to another
 * booking must never list the previous one's documents.
 */

import { describe, it, expect } from 'vitest';
import { saveTrip, loadTrip, forgetTrip, saveTripDocs, loadTripDocs, type TripStore } from '../saved-trip';
import type { Booking } from '@/types/booking';

const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-09-25T09:00:00Z');

function memory(): TripStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (k) => data.get(k) ?? null,
    setItem: (k, v) => void data.set(k, v),
    removeItem: (k) => void data.delete(k),
  };
}

function trip(reference: string): Booking {
  return {
    reference,
    status: 'confirmed',
    leadEmail: 'lead@example.com',
    destinationLabel: 'Rome',
    primaryCountryCode: 'IT',
    tripStart: '2027-02-12',
    tripEnd: '2027-02-15',
    tripStartEvent: 'flight',
    durationLabel: '3 nights',
    travellers: [],
    flights: [],
    hotels: [],
    airportExtras: [],
    documents: [],
    agency: { name: 'Example Travel' },
  } as unknown as Booking;
}

describe('saved trip', () => {
  it('gives back the trip the server returned', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + 10 * DAY, NOW, s);
    expect(loadTrip(NOW + DAY, s)?.booking.reference).toBe('WCS1');
    expect(loadTrip(NOW + DAY, s)?.savedAt).toBe(NOW);
  });

  it('never outlives the session it came from', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + 2 * DAY, NOW, s);
    expect(loadTrip(NOW + 2 * DAY - 1, s)).not.toBeNull();
    expect(loadTrip(NOW + 2 * DAY, s)).toBeNull();
    // And once past it, it is gone rather than merely hidden.
    expect(s.data.size).toBe(0);
  });

  it('is kept for 30 days at most, however long the session', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + 365 * DAY, NOW, s);
    expect(loadTrip(NOW + 30 * DAY - 1, s)).not.toBeNull();
    expect(loadTrip(NOW + 30 * DAY, s)).toBeNull();
  });

  it('falls back to 30 days when the server gives no session end', () => {
    const s = memory();
    saveTrip(trip('WCS1'), null, NOW, s);
    expect(loadTrip(NOW + 29 * DAY, s)).not.toBeNull();
    expect(loadTrip(NOW + 31 * DAY, s)).toBeNull();
  });

  it('is forgotten on request', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    forgetTrip(s);
    expect(loadTrip(NOW, s)).toBeNull();
  });

  it('refuses anything that is not a whole booking', () => {
    const s = memory();
    saveTrip({ reference: 'X' } as unknown as Booking, NOW + DAY, NOW, s);
    expect(s.data.size).toBe(0);
    s.setItem('luna-travel.savedTrip.v1', '{"v":1,"booking":{"reference":"X"},"savedAt":1,"until":9e15}');
    expect(loadTrip(NOW, s)).toBeNull();
    s.setItem('luna-travel.savedTrip.v1', 'not json');
    expect(loadTrip(NOW, s)).toBeNull();
  });

  it('works without storage at all', () => {
    expect(() => saveTrip(trip('WCS1'), NOW + DAY, NOW, null)).not.toThrow();
    expect(loadTrip(NOW, null)).toBeNull();
  });

  it('survives storage that throws', () => {
    const broken: TripStore = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('full');
      },
      removeItem: () => {
        throw new Error('denied');
      },
    };
    expect(() => saveTrip(trip('WCS1'), NOW + DAY, NOW, broken)).not.toThrow();
    expect(loadTrip(NOW, broken)).toBeNull();
    expect(() => forgetTrip(broken)).not.toThrow();
  });
});

describe('saved documents list', () => {
  it('is kept with the trip it belongs to', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('WCS1', [{ id: 'a' }], s);
    expect(loadTripDocs('WCS1', NOW, s)).toEqual([{ id: 'a' }]);
  });

  it('is never given out for another booking', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('WCS1', [{ id: 'a' }], s);
    expect(loadTripDocs('OTHER', NOW, s)).toBeNull();
  });

  it('is not kept for a booking the phone does not hold', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('OTHER', [{ id: 'x' }], s);
    expect(loadTripDocs('OTHER', NOW, s)).toBeNull();
    expect(loadTripDocs('WCS1', NOW, s)).toBeNull();
  });

  it('survives a refresh of the same trip', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('WCS1', [{ id: 'a' }], s);
    saveTrip(trip('WCS1'), NOW + 2 * DAY, NOW + 1000, s);
    expect(loadTripDocs('WCS1', NOW + 2000, s)).toEqual([{ id: 'a' }]);
  });

  it('is dropped when the phone moves to another booking', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('WCS1', [{ id: 'a' }], s);
    saveTrip(trip('NEW2'), NOW + DAY, NOW + 1000, s);
    expect(loadTripDocs('NEW2', NOW + 2000, s)).toBeNull();
    expect(loadTripDocs('WCS1', NOW + 2000, s)).toBeNull();
  });

  it('goes with the trip', () => {
    const s = memory();
    saveTrip(trip('WCS1'), NOW + DAY, NOW, s);
    saveTripDocs('WCS1', [{ id: 'a' }], s);
    forgetTrip(s);
    expect(loadTripDocs('WCS1', NOW, s)).toBeNull();
  });
});
