/**
 * GET /api/agency/travellers — the signed-in agency's own travellers, with
 * engagement (invited/installed/opened, opens, last seen). agencyId always
 * comes from the session, so an agency only ever sees its OWN travellers.
 *
 * Powers the portal Travellers view and the Messages recipient picker. Mirrors
 * the admin travellers route but session-scoped instead of agency-id-in-URL.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Row {
  id: string;
  lead_passenger_name: string | null;
  booking_ref: string | null;
  email: string | null;
  destination: string | null;
  departure_date: string | null;
  return_date: string | null;
  status: string | null;
  device_install_status: string | null;
  created_at: string | null;
  first_opened_at: string | null;
  last_opened_at: string | null;
  open_count: number | null;
}

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('travellers')
    .select('id, lead_passenger_name, booking_ref, email, destination, departure_date, return_date, status, device_install_status, created_at, first_opened_at, last_opened_at, open_count')
    .eq('agency_id', claims.agencyId)
    .order('created_at', { ascending: false })
    .limit(200);

  if (error) {
    console.error('[agency/travellers] list failed', error.message);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }

  const travellers = ((data ?? []) as Row[]).map((t) => ({
    id: t.id,
    name: t.lead_passenger_name || 'Traveller',
    bookingRef: t.booking_ref,
    email: t.email,
    destination: t.destination,
    departureDate: t.departure_date,
    returnDate: t.return_date,
    status: t.status,
    installStatus: t.device_install_status,
    opened: !!t.first_opened_at,
    openCount: t.open_count ?? 0,
    firstOpenedAt: t.first_opened_at,
    lastOpenedAt: t.last_opened_at,
    createdAt: t.created_at,
  }));

  return NextResponse.json({ ok: true, travellers });
}
