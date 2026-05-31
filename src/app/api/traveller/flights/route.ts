/**
 * GET /api/traveller/flights
 *
 * Returns the live flight status for the signed-in traveller's booking, for the
 * app's Flights screen. Reads the lt_session cookie to identify the traveller —
 * no agency id or booking ref is trusted from the client.
 *
 * The booking's FlightLeg (scheduled/booked data) comes from the existing
 * booking fetch. THIS endpoint returns only the live overlay rows from
 * trip_flights; the app merges them by flightLegId.
 *
 * Built on luna_travel.trip_flights. Same lt_session pattern as
 * /api/traveller/messages.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }

  // bookingRef is the join scope; it lives in the session claims.
  const bookingRef = claims.bookingRef;
  if (!bookingRef) {
    return NextResponse.json({ flights: [] });
  }

  const supabase = getSupabaseAdmin();

  const { data, error } = await supabase
    .from('trip_flights')
    .select(
      'flight_leg_id, status_code, est_dep_time, actual_dep_time, est_arr_time, actual_arr_time, dep_terminal_live, dep_gate, arr_terminal_live, baggage_belt, check_in_desk, check_in_opens_at, boarding_at, leave_by_at, has_live_coverage, last_updated, watch_state',
    )
    .eq('booking_ref', bookingRef);
  if (error) {
    console.error('[traveller.flights] query', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const flights = ((data || []) as Array<Record<string, unknown>>).map((r) => ({
    flightLegId: r.flight_leg_id as string,
    statusCode: r.status_code as string,
    estDepTime: (r.est_dep_time as string | null) ?? undefined,
    actualDepTime: (r.actual_dep_time as string | null) ?? undefined,
    estArrTime: (r.est_arr_time as string | null) ?? undefined,
    actualArrTime: (r.actual_arr_time as string | null) ?? undefined,
    depTerminalLive: (r.dep_terminal_live as string | null) ?? undefined,
    depGate: (r.dep_gate as string | null) ?? undefined,
    arrTerminalLive: (r.arr_terminal_live as string | null) ?? undefined,
    baggageBelt: (r.baggage_belt as string | null) ?? undefined,
    checkInDesk: (r.check_in_desk as string | null) ?? undefined,
    checkInOpensAt: (r.check_in_opens_at as string | null) ?? undefined,
    boardingAt: (r.boarding_at as string | null) ?? undefined,
    leaveByAt: (r.leave_by_at as string | null) ?? undefined,
    hasLiveCoverage: !!r.has_live_coverage,
    lastUpdated: r.last_updated as string,
    watchState: r.watch_state as string,
  }));

  return NextResponse.json({ flights });
}
