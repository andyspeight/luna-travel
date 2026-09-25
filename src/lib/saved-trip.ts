/**
 * The traveller's own trip, kept on their phone for when there is no signal.
 *
 * The app's promise on a travel day is that it works in a terminal with no
 * signal. The documents were stored on the phone, but the booking that lists
 * them was not: with no network the check for it failed, and the traveller got
 * the sample trip (until 24 Sep 2026) or, after that was fixed, the way in
 * rather than their holiday.
 *
 * What is kept, and when it may be used:
 *
 * - Only a booking the server returned for this phone's own session, never a
 *   demo. It is replaced every time the server answers with the booking.
 * - Only when the server cannot answer: no signal, a connection that never
 *   replies, or an error on our side. Online, the fresh booking always wins.
 * - Never past the session it came from (the server says when that ends),
 *   and never more than 30 days after it was last refreshed.
 * - Forgotten the moment the server says there is no booking for this phone
 *   (signed out, session over, traveller removed), and on sign-out.
 *
 * The agency's own uploaded documents are listed separately
 * (/api/traveller/documents), so their list is kept too, tagged with the
 * booking it belongs to and dropped whenever the booking changes: a phone that
 * moves to another booking must never list the previous one's documents.
 *
 * This is the traveller's own data on the traveller's own phone, in this
 * site's storage only. It holds nothing a script on this site could not
 * already fetch with the session cookie.
 */

import type { Booking } from '@/types/booking';

const KEY = 'luna-travel.savedTrip.v1';
const MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

interface Stored {
  v: 1;
  booking: Booking;
  savedAt: number;
  /** When this copy stops being usable: the session's end, or 30 days. */
  until: number;
  /** The agency's uploaded documents for this booking, when last listed. */
  docs?: { reference: string; list: unknown[] };
}

/** The bits of Storage this uses, so tests can hand in their own. */
export type TripStore = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;

function defaultStore(): TripStore | null {
  try {
    return typeof window !== 'undefined' ? window.localStorage : null;
  } catch {
    // Private mode on some browsers throws on access.
    return null;
  }
}

/** Enough of a booking for every screen to draw it without falling over. */
function looksLikeBooking(b: unknown): b is Booking {
  if (!b || typeof b !== 'object') return false;
  const o = b as Record<string, unknown>;
  return (
    typeof o.reference === 'string' &&
    o.reference.length > 0 &&
    Array.isArray(o.travellers) &&
    Array.isArray(o.flights) &&
    Array.isArray(o.hotels) &&
    Array.isArray(o.airportExtras) &&
    Array.isArray(o.documents) &&
    !!o.agency &&
    typeof o.agency === 'object'
  );
}

function read(store: TripStore): Stored | null {
  try {
    const raw = store.getItem(KEY);
    if (!raw) return null;
    const s = JSON.parse(raw) as Stored;
    if (s?.v !== 1 || !looksLikeBooking(s.booking)) return null;
    if (typeof s.savedAt !== 'number' || typeof s.until !== 'number') return null;
    return s;
  } catch {
    return null;
  }
}

function write(store: TripStore, s: Stored): void {
  try {
    store.setItem(KEY, JSON.stringify(s));
  } catch {
    // Full or blocked storage: the app still works online, just not offline.
  }
}

/**
 * Keep the booking the server has just returned. `sessionEndsAt` is the
 * session's expiry (ms) as the server reported it.
 */
export function saveTrip(
  booking: Booking,
  sessionEndsAt: number | null | undefined,
  now = Date.now(),
  store: TripStore | null = defaultStore(),
): void {
  if (!store || !looksLikeBooking(booking)) return;
  const cap = now + MAX_AGE_MS;
  const until = typeof sessionEndsAt === 'number' && sessionEndsAt > now ? Math.min(sessionEndsAt, cap) : cap;
  const prev = read(store);
  // The documents list stays only while it is for this same booking.
  const docs = prev?.docs && prev.docs.reference === booking.reference ? prev.docs : undefined;
  write(store, { v: 1, booking, savedAt: now, until, ...(docs ? { docs } : {}) });
}

/** The saved trip, if there is one this phone may still use. */
export function loadTrip(
  now = Date.now(),
  store: TripStore | null = defaultStore(),
): { booking: Booking; savedAt: number } | null {
  if (!store) return null;
  const s = read(store);
  if (!s) {
    forgetTrip(store);
    return null;
  }
  if (s.until <= now) {
    forgetTrip(store);
    return null;
  }
  return { booking: s.booking, savedAt: s.savedAt };
}

/** Remove the saved trip and its documents list from this phone. */
export function forgetTrip(store: TripStore | null = defaultStore()): void {
  try {
    store?.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}

/** Keep the agency documents list, but only against the trip it belongs to. */
export function saveTripDocs(
  reference: string,
  list: unknown[],
  store: TripStore | null = defaultStore(),
): void {
  if (!store) return;
  const s = read(store);
  if (!s || s.booking.reference !== reference) return;
  write(store, { ...s, docs: { reference, list } });
}

/** The saved agency documents list for this booking, or null. */
export function loadTripDocs(
  reference: string,
  now = Date.now(),
  store: TripStore | null = defaultStore(),
): unknown[] | null {
  if (!store) return null;
  const s = read(store);
  if (!s || s.until <= now || s.booking.reference !== reference) return null;
  return s.docs && s.docs.reference === reference && Array.isArray(s.docs.list) ? s.docs.list : null;
}
