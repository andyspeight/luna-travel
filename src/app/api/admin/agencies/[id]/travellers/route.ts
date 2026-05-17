/**
 * GET /api/admin/agencies/[id]/travellers
 *
 * Returns travellers for an agency — id, lead passenger name, booking ref.
 * Used by the document-upload form to populate the traveller picker.
 *
 * Admin-gated (middleware).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agencyId = params.id;
  if (!agencyId) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('travellers')
    .select('id, lead_passenger_name, booking_ref, departure_date, created_at')
    .eq('agency_id', agencyId)
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[travellers.GET]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  return NextResponse.json({
    travellers: (data || []).map((t) => ({
      id: t.id,
      name: t.lead_passenger_name,
      bookingRef: t.booking_ref,
      departureDate: t.departure_date,
      redeemedAt: t.created_at,  // surface as redeemedAt — that's what it effectively means
    })),
  });
}
