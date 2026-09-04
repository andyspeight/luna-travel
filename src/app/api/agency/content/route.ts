/**
 * /api/agency/content — the signed-in agency's trip content pages.
 *
 *   GET ?bookingRef=REF   — the three pages stored for that booking, plus the
 *                           agency-default before-you-travel (so the editor
 *                           can show what travellers will fall back to).
 *   GET (no bookingRef)   — the agency-default scope ('').
 *   PUT { bookingRef?, page, items } — upsert one page. bookingRef omitted or
 *                           '' targets the agency-default scope, which is only
 *                           meaningful for before-you-travel.
 *
 * agencyId always comes from the session; items are validated by
 * sanitizeItems before touching the database.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { logAuditEvent } from '@/lib/audit';
import {
  EMPTY_TRIP_CONTENT,
  isTripContentPage,
  isValidBookingRef,
  sanitizeItems,
  type TripContentItem,
  type TripContentPages,
} from '@/lib/trip-content';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const bookingRef = (req.nextUrl.searchParams.get('bookingRef') || '').trim();
  if (bookingRef && !isValidBookingRef(bookingRef)) {
    return NextResponse.json({ error: 'invalid_booking_ref' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const scopes = bookingRef ? [bookingRef, ''] : [''];
  const { data, error } = await supabase
    .from('trip_content')
    .select('booking_ref, page, items, updated_at')
    .eq('agency_id', claims.agencyId)
    .in('booking_ref', scopes);
  if (error) {
    console.error('[agency.content.GET]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const pages: TripContentPages = structuredClone(EMPTY_TRIP_CONTENT);
  const defaults: TripContentPages = structuredClone(EMPTY_TRIP_CONTENT);
  for (const row of data ?? []) {
    if (!isTripContentPage(row.page)) continue;
    const items = sanitizeItems(row.page, row.items) ?? [];
    const target = row.booking_ref === (bookingRef || '') ? pages : defaults;
    (target[row.page] as TripContentItem[]) = items;
  }

  return NextResponse.json({
    scope: bookingRef || 'default',
    pages,
    // Only meaningful when editing a booking: what travellers fall back to.
    defaultBeforeYouTravel: bookingRef ? defaults['before-you-travel'] : pages['before-you-travel'],
  });
}

export async function PUT(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const bookingRef = typeof body.bookingRef === 'string' ? body.bookingRef.trim() : '';
  if (bookingRef && !isValidBookingRef(bookingRef)) {
    return NextResponse.json({ error: 'invalid_booking_ref' }, { status: 400 });
  }
  const page = body.page;
  if (!isTripContentPage(page)) {
    return NextResponse.json({ error: 'invalid_page' }, { status: 400 });
  }
  // Agency-default content only exists for before-you-travel by design — a
  // default "itinerary" would show the wrong trip to every traveller.
  if (!bookingRef && page !== 'before-you-travel') {
    return NextResponse.json({ error: 'default_scope_unsupported', message: 'Agency defaults apply to Before you travel only' }, { status: 400 });
  }
  const items = sanitizeItems(page, body.items);
  if (items === null) {
    return NextResponse.json({ error: 'invalid_items' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('trip_content')
    .upsert(
      {
        agency_id: claims.agencyId,
        booking_ref: bookingRef,
        page,
        items,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'agency_id,booking_ref,page' },
    );
  if (error) {
    console.error('[agency.content.PUT]', error.message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  void logAuditEvent({
    eventType: 'content.updated',
    actor: claims.agencyId,
    targetId: `${bookingRef || 'default'}/${page}`,
    targetLabel: `${bookingRef || 'Agency default'} — ${page}`,
    metadata: { bookingRef: bookingRef || null, page, itemCount: items.length },
  });

  return NextResponse.json({ ok: true, page, itemCount: items.length });
}
