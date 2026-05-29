/**
 * GET /api/traveller/booking
 *
 * Returns the full booking for the traveller identified by the lt_session
 * cookie, ready for the PWA to render. This is the endpoint booking-context
 * calls on mount — until now it did not exist, which is why the app always
 * fell back to mock data.
 *
 * Auth: the lt_session cookie set at invite redemption (HS256 JWT).
 *
 * Data path (28 May architecture — Luna Travel reads from Control, never
 * Airtable directly):
 *   1. verifySession → claims { travellerId, agencyId, bookingRef }
 *   2. Read the traveller row from Supabase for the lookup fields. email and
 *      departure_date are NOT in the JWT, only ref + agency are, so the row
 *      read is required.
 *   3. Server-to-server POST to Control's internal endpoint, keyed by the
 *      agency's Control record id (== claims.agencyId). Control resolves the
 *      agency's own Travelify credentials, calls Travelify, trims/sanitises
 *      the order, and returns it plus the agency's white-label branding. The
 *      internal key never reaches the browser.
 *   4. Map the trimmed order + branding into the Booking type.
 *
 * Failure → non-200, which leaves booking-context on its mock booking. The
 * happy path returns { booking, source: 'live' }.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import { orderToBooking, type TrimmedOrder, type ControlAgency } from '@/lib/order-to-booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';
const CONTROL_HOST = 'https://id.travelify.io'; // same host the agencies route uses
const RECORD_ID_RE = /^rec[A-Za-z0-9]{14}$/;

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const internalKey = process.env.TG_INTERNAL_KEY;
  if (!internalKey) {
    console.error('[traveller.booking] TG_INTERNAL_KEY not set');
    return NextResponse.json({ error: 'config' }, { status: 500 });
  }

  // 1. Read the traveller row for the lookup fields.
  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[traveller.booking] supabase init failed:', (e as Error).message);
    return NextResponse.json({ error: 'config' }, { status: 500 });
  }

  const { data: traveller, error } = await supabase
    .from('travellers')
    .select('id, agency_id, booking_ref, email, departure_date')
    .eq('id', claims.travellerId)
    .single();

  if (error || !traveller) {
    console.warn('[traveller.booking] traveller row not found:', claims.travellerId, error?.message);
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const recordId = String(traveller.agency_id || claims.agencyId || '');
  const orderRef = String(traveller.booking_ref || claims.bookingRef || '');
  const email = String(traveller.email || '');
  const departDate = String(traveller.departure_date || '').slice(0, 10);

  if (!RECORD_ID_RE.test(recordId) || !orderRef || !email || !departDate) {
    console.warn('[traveller.booking] incomplete traveller row', {
      recordIdOk: RECORD_ID_RE.test(recordId),
      hasRef: !!orderRef,
      hasEmail: !!email,
      hasDate: !!departDate,
    });
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 2. Ask Control for the order + branding (server-to-server, key in env).
  let controlJson: { ok?: boolean; order?: TrimmedOrder; agency?: ControlAgency | null } | null = null;
  try {
    const res = await fetch(`${CONTROL_HOST}/api/internal/retrieve-order-by-client`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TG-Internal-Key': internalKey,
      },
      body: JSON.stringify({ recordId, orderRef, emailAddress: email, departDate }),
      cache: 'no-store',
      signal: AbortSignal.timeout(14_000),
    });

    if (res.status === 404) {
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }
    if (!res.ok) {
      console.error('[traveller.booking] Control returned', res.status);
      return NextResponse.json({ error: 'upstream' }, { status: 502 });
    }
    controlJson = await res.json();
  } catch (e) {
    console.error('[traveller.booking] Control call failed:', (e as Error).message);
    return NextResponse.json({ error: 'upstream' }, { status: 502 });
  }

  const order = controlJson?.order;
  const agency = controlJson?.agency ?? null;
  if (!order || !order.id) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  // 3. Map to the Booking type. typedRef is the customer-entered reference.
  const booking = orderToBooking(order, agency, orderRef);
  if (!booking) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  return NextResponse.json({ booking, source: 'live' }, { status: 200 });
}
