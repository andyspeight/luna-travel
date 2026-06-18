/**
 * GET /api/admin/demo
 *
 * The demo launchpad's data: the pending demo invites (created_by = 'demo-seed'),
 * de-duplicated to one entry per booking, with the details needed to run the
 * end-to-end demo (QR target + the email/date a presenter types to redeem).
 * Admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('invites')
    .select('id, agency_id, booking_ref, email, departure_date, return_date, destination, lead_passenger_name, created_at')
    .eq('created_by', 'demo-seed')
    .eq('status', 'pending')
    .gt('expires_at', new Date().toISOString())
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[admin/demo]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  // One card per booking — keep the most recent pending invite for each ref.
  const seen = new Set<string>();
  const bookings = [];
  for (const r of (data || []) as Array<Record<string, unknown>>) {
    const ref = String(r.booking_ref || '');
    if (!ref || seen.has(ref)) continue;
    seen.add(ref);
    bookings.push({
      inviteId: r.id,
      agencyId: r.agency_id,
      bookingRef: r.booking_ref,
      email: r.email,
      departureDate: r.departure_date,
      returnDate: r.return_date,
      destination: r.destination,
      leadName: r.lead_passenger_name,
    });
  }

  return NextResponse.json({ bookings });
}
