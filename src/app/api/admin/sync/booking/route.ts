/**
 * POST /api/admin/sync/booking { travellerId } — re-pull one booking from
 * Travelify and record the outcome. Powers the drawer's "Re-sync booking"
 * button. Admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { getTraveller, syncBooking } from '@/lib/sync';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let body: { travellerId?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'bad_json' }, { status: 400 });
  }
  const travellerId = (body.travellerId || '').trim();
  if (!travellerId) {
    return NextResponse.json({ error: 'traveller_required' }, { status: 400 });
  }

  const t = await getTraveller(travellerId);
  if (!t) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const event = await syncBooking(
    {
      travellerId: t.id,
      agencyId: t.agency_id,
      bookingRef: t.booking_ref,
      email: t.email,
      departureDate: t.departure_date,
    },
    'manual',
  );
  if (!event) {
    return NextResponse.json({ error: 'sync_failed' }, { status: 500 });
  }
  return NextResponse.json({ ok: true, event });
}
