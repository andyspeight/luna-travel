/**
 * GET /api/traveller/content
 *
 * The agency-authored content pages for the signed-in traveller's booking:
 * before-you-travel, itinerary, find-your-way. Identity comes from the
 * lt_session cookie — agency and booking are never trusted from the client.
 *
 * Fallback rule: before-you-travel uses the agency-default scope ('') when
 * the booking has no non-empty page of its own (that advice is destination-
 * generic). Itinerary and find-your-way are strictly per-booking.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import {
  EMPTY_TRIP_CONTENT,
  isTripContentPage,
  sanitizeItems,
  type TripContentItem,
  type TripContentPages,
} from '@/lib/trip-content';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 });
  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'invalid_session' }, { status: 401 });

  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('trip_content')
    .select('booking_ref, page, items')
    .eq('agency_id', claims.agencyId)
    .in('booking_ref', [claims.bookingRef, '']);
  if (error) {
    console.error('[traveller.content]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const booking: TripContentPages = structuredClone(EMPTY_TRIP_CONTENT);
  const defaults: TripContentPages = structuredClone(EMPTY_TRIP_CONTENT);
  for (const row of data ?? []) {
    if (!isTripContentPage(row.page)) continue;
    const items = sanitizeItems(row.page, row.items) ?? [];
    const target = row.booking_ref === claims.bookingRef ? booking : defaults;
    (target[row.page] as TripContentItem[]) = items;
  }

  const pages: TripContentPages = {
    'before-you-travel': booking['before-you-travel'].length
      ? booking['before-you-travel']
      : defaults['before-you-travel'],
    itinerary: booking.itinerary,
    'find-your-way': booking['find-your-way'],
  };

  return NextResponse.json({ pages });
}
