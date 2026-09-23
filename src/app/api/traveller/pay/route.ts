/**
 * POST /api/traveller/pay
 *
 * Opens a payment page for what the signed-in traveller's booking still owes.
 * Returns { url } — the agency's own secure Travelify payment page — and the
 * app sends the traveller there. The same payment the My Booking widget takes;
 * see lib/balance-payment for how it is raised and who decides the amount.
 *
 * Auth: the lt_session cookie, as for every /api/traveller route. The booking
 * is read from the traveller's own row, never from the body, so a traveller can
 * only ever open a payment page for their own booking. The body carries at most
 * the amount on their button, which Control re-checks against the real balance.
 *
 * The demo has no session, so it gets a 401 and never reaches Control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import { isControlAgency } from '@/lib/agency-id';
import { parseAmount, requestBalancePayment } from '@/lib/balance-payment';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const SESSION_COOKIE = 'lt_session';

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  if (checkSupabaseEnv()) return NextResponse.json({ error: 'unavailable' }, { status: 503 });

  let body: Record<string, unknown> = {};
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    /* no body is fine: Control then decides the amount */
  }
  const amount = parseAmount(body?.amount);
  if (amount === 'invalid') return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });

  const { data: traveller, error } = await getSupabaseAdmin()
    .from('travellers')
    .select('agency_id, booking_ref, email, departure_date')
    .eq('id', claims.travellerId)
    .maybeSingle();
  if (error || !traveller) {
    console.warn('[traveller.pay] traveller row not found', claims.travellerId, error?.message);
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const recordId = String(traveller.agency_id || '');
  const orderRef = String(traveller.booking_ref || '');
  const email = String(traveller.email || '');
  const departDate = String(traveller.departure_date || '').slice(0, 10);

  // Only a Travelify booking has a balance to pay; a Luna-native agency's
  // bookings are entered by hand and carry none.
  if (!isControlAgency(recordId) || !orderRef || !email || !departDate) {
    return NextResponse.json({ error: 'not_payable' }, { status: 404 });
  }

  const result = await requestBalancePayment({ recordId, orderRef, email, departDate, amount });
  console.log('[traveller.pay]', { orderRef, outcome: result.kind });

  switch (result.kind) {
    case 'ok':
      return NextResponse.json({ ok: true, url: result.url, amount: result.amount, currency: result.currency });
    case 'no_balance':
      return NextResponse.json({ error: 'no_balance' }, { status: 409 });
    case 'invalid_amount':
      return NextResponse.json({ error: 'balance_changed' }, { status: 409 });
    case 'not_found':
      return NextResponse.json({ error: 'not_payable' }, { status: 404 });
    default:
      return NextResponse.json({ error: 'unavailable' }, { status: 502 });
  }
}
