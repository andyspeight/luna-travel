/**
 * GET /api/agency/reviews — the reviews the agency's travellers have left, with
 * a rating summary. agencyId comes from the session; reviews is agency-scoped,
 * so an agency only ever sees its own reviews.
 *
 * share_consent marks the ones the traveller is happy to have shared publicly
 * (e.g. as a testimonial).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

interface Row {
  traveller_id: string | null;
  booking_ref: string | null;
  rating: number | null;
  comment: string | null;
  share_consent: boolean | null;
  created_at: string | null;
}

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const supabase = getSupabaseAdmin();

  const [reviewsRes, travsRes] = await Promise.all([
    supabase
      .from('reviews')
      .select('traveller_id, booking_ref, rating, comment, share_consent, created_at')
      .eq('agency_id', claims.agencyId)
      .order('created_at', { ascending: false })
      .limit(200),
    supabase
      .from('travellers')
      .select('id, lead_passenger_name, destination')
      .eq('agency_id', claims.agencyId),
  ]);

  if (reviewsRes.error) {
    console.error('[agency/reviews] query', reviewsRes.error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const byId = new Map<string, { name: string; destination: string | null }>();
  ((travsRes.data ?? []) as Array<{ id: string; lead_passenger_name: string | null; destination: string | null }>).forEach((t) => {
    byId.set(t.id, { name: t.lead_passenger_name || 'Traveller', destination: t.destination });
  });

  const rows = (reviewsRes.data ?? []) as Row[];
  const reviews = rows.map((r) => {
    const trav = r.traveller_id ? byId.get(r.traveller_id) : undefined;
    return {
      rating: r.rating ?? 0,
      comment: r.comment,
      travellerName: trav?.name ?? null,
      destination: trav?.destination ?? null,
      bookingRef: r.booking_ref,
      shareConsent: !!r.share_consent,
      createdAt: r.created_at,
    };
  });

  const rated = rows.filter((r) => typeof r.rating === 'number' && r.rating! > 0);
  const average = rated.length ? rated.reduce((a, r) => a + (r.rating || 0), 0) / rated.length : 0;

  return NextResponse.json({
    ok: true,
    summary: { count: rows.length, average: Math.round(average * 10) / 10 },
    reviews,
  });
}
