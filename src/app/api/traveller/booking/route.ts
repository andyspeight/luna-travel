/**
 * GET /api/traveller/booking
 *
 * Returns the live, mapped Booking for the traveller identified by the
 * lt_session cookie. This is the PWA's live data source.
 *
 * Flow:
 *   1. Read lt_session cookie → verify → get bookingRef + agencyId.
 *   2. Look the order up in Travelify (demo integration for now).
 *   3. Map it to the PWA Booking shape via mapTravelifyBooking().
 *   4. Return { booking }.
 *
 * Responses:
 *   200 { booking }      — live booking found and mapped
 *   204 (no body)        — no session: the PWA falls back to the mock picker.
 *                          This is the NORMAL state for the show demo path.
 *   502 { error }        — session valid but the lookup/map failed. The PWA
 *                          should fall back to mock rather than show an error,
 *                          so the demo is never broken by a backend hiccup.
 *
 * Public route (not admin-gated). Auth is the traveller's own lt_session.
 *
 * NOTE: this calls Travelify with the demo integration. The lookup needs the
 * lead email + departure date, which we don't carry in the JWT yet. For the
 * redemption demo the session is minted right after a successful lookup, so
 * for now we re-look-up using the email/departure stored against the invite.
 * (Wired to read those from the invite/traveller row — see lookupForSession.)
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/jwt';
import { mapTravelifyBooking } from '@/lib/map-travelify-booking';
import { fetchTravelifyRaw, lookupKeysForSession } from '@/lib/travelify-live';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  // No session → normal fallback-to-mock path. 204 = "nothing here, carry on".
  if (!token) return new NextResponse(null, { status: 204 });

  const claims = await verifySession(token);
  if (!claims) return new NextResponse(null, { status: 204 });

  // Resolve the email + departure date needed for the Travelify lookup.
  let keys: { email: string; departureDate: string } | null;
  try {
    keys = await lookupKeysForSession(claims);
  } catch (e) {
    console.error('[traveller/booking] key lookup failed:', (e as Error).message);
    return NextResponse.json({ error: 'lookup_failed' }, { status: 502 });
  }
  if (!keys) {
    // Session valid but we can't find the lookup keys — fall back to mock.
    return new NextResponse(null, { status: 204 });
  }

  // Fetch + map.
  let raw: Record<string, unknown> | null;
  try {
    raw = await fetchTravelifyRaw({
      bookingRef: claims.bookingRef,
      email: keys.email,
      departureDate: keys.departureDate,
    });
  } catch (e) {
    console.error('[traveller/booking] travelify fetch failed:', (e as Error).message);
    return NextResponse.json({ error: 'travelify_failed' }, { status: 502 });
  }
  if (!raw) return NextResponse.json({ error: 'not_found' }, { status: 502 });

  let booking;
  try {
    booking = mapTravelifyBooking(raw, { reference: claims.bookingRef }).booking;
  } catch (e) {
    console.error('[traveller/booking] mapper threw:', (e as Error).message);
    return NextResponse.json({ error: 'map_failed' }, { status: 502 });
  }

  return NextResponse.json({ booking }, { status: 200 });
}
