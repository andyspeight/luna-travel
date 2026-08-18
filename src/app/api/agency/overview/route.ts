/**
 * GET /api/agency/overview — the portal home "pulse": headline counts for the
 * signed-in agency. All scoped to the session's agency.
 *
 *   travellers         — total travellers who have access
 *   opened             — how many have opened the app
 *   upcomingDepartures — travellers departing in the next 30 days
 *   pendingInvites     — access links sent but not yet redeemed (unexpired)
 *   unreadReplies      — traveller replies the agency hasn't read
 *   nextDepartures     — the soonest few upcoming trips (name, destination, date)
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface TravRow {
  lead_passenger_name: string | null;
  destination: string | null;
  departure_date: string | null;
  first_opened_at: string | null;
}

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const agencyId = claims.agencyId;
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const in30 = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

  const [travellers, invites, unread] = await Promise.all([
    supabase
      .from('travellers')
      .select('lead_passenger_name, destination, departure_date, first_opened_at')
      .eq('agency_id', agencyId),
    supabase
      .from('invites')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('status', 'pending')
      .gte('expires_at', now.toISOString()),
    supabase
      .from('messages')
      .select('id', { count: 'exact', head: true })
      .eq('agency_id', agencyId)
      .eq('direction', 'traveller_to_agency')
      .is('agency_read_at', null),
  ]);

  const rows = ((travellers.data ?? []) as TravRow[]);
  const opened = rows.filter((t) => t.first_opened_at).length;
  const upcoming = rows.filter((t) => t.departure_date && t.departure_date >= today && t.departure_date <= in30);

  const nextDepartures = rows
    .filter((t) => t.departure_date && t.departure_date >= today)
    .sort((a, b) => (a.departure_date! < b.departure_date! ? -1 : 1))
    .slice(0, 4)
    .map((t) => ({ name: t.lead_passenger_name || 'Traveller', destination: t.destination, departureDate: t.departure_date }));

  return NextResponse.json({
    ok: true,
    stats: {
      travellers: rows.length,
      opened,
      upcomingDepartures: upcoming.length,
      pendingInvites: invites.count ?? 0,
      unreadReplies: unread.count ?? 0,
    },
    nextDepartures,
  });
}
