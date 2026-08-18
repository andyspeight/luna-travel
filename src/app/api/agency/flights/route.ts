/**
 * GET /api/agency/flights — live status of the agency's travellers' upcoming
 * flights, read-only. agencyId comes from the session; trip_flights is already
 * agency-scoped, so an agency only ever sees its own flights.
 *
 * Returns each watched flight leg (carrier + number, route, date) with its live
 * overlay: status, gate/terminal, revised times, check-in/boarding, and whether
 * it has live coverage. Newest-departing first, upcoming only.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Row {
  booking_ref: string | null;
  carrier_code: string | null;
  flight_number: string | null;
  dep_date_local: string | null;
  status_code: string | null;
  est_dep_time: string | null;
  actual_dep_time: string | null;
  est_arr_time: string | null;
  dep_airport_icao: string | null;
  arr_airport_icao: string | null;
  dep_terminal_live: string | null;
  dep_gate: string | null;
  check_in_desk: string | null;
  boarding_at: string | null;
  has_live_coverage: boolean | null;
  last_updated: string | null;
}

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const today = new Date().toISOString().slice(0, 10);

  const [flightsRes, travsRes] = await Promise.all([
    supabase
      .from('trip_flights')
      .select('booking_ref, carrier_code, flight_number, dep_date_local, status_code, est_dep_time, actual_dep_time, est_arr_time, dep_airport_icao, arr_airport_icao, dep_terminal_live, dep_gate, check_in_desk, boarding_at, has_live_coverage, last_updated')
      .eq('agency_id', claims.agencyId)
      .gte('dep_date_local', today)
      .order('dep_date_local', { ascending: true })
      .limit(300),
    supabase
      .from('travellers')
      .select('booking_ref, lead_passenger_name, destination')
      .eq('agency_id', claims.agencyId),
  ]);

  if (flightsRes.error) {
    console.error('[agency/flights] query', flightsRes.error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  // booking_ref → traveller name / destination (first match).
  const byRef = new Map<string, { name: string; destination: string | null }>();
  ((travsRes.data ?? []) as Array<{ booking_ref: string | null; lead_passenger_name: string | null; destination: string | null }>).forEach((t) => {
    if (t.booking_ref && !byRef.has(t.booking_ref)) {
      byRef.set(t.booking_ref, { name: t.lead_passenger_name || 'Traveller', destination: t.destination });
    }
  });

  const flights = ((flightsRes.data ?? []) as Row[]).map((r) => {
    const trav = r.booking_ref ? byRef.get(r.booking_ref) : undefined;
    return {
      bookingRef: r.booking_ref,
      travellerName: trav?.name ?? null,
      destination: trav?.destination ?? null,
      carrier: r.carrier_code,
      flightNumber: r.flight_number ? `${r.carrier_code ?? ''}${r.flight_number}` : null,
      depIcao: r.dep_airport_icao,
      arrIcao: r.arr_airport_icao,
      depDate: r.dep_date_local,
      statusCode: r.status_code || 'Unknown',
      estDepTime: r.est_dep_time,
      actualDepTime: r.actual_dep_time,
      estArrTime: r.est_arr_time,
      depTerminal: r.dep_terminal_live,
      depGate: r.dep_gate,
      checkInDesk: r.check_in_desk,
      boardingAt: r.boarding_at,
      hasLiveCoverage: !!r.has_live_coverage,
      lastUpdated: r.last_updated,
    };
  });

  return NextResponse.json({ ok: true, flights });
}
