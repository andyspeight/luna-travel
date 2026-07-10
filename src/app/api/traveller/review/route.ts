/**
 * POST /api/traveller/review
 *
 * Post-trip review from the traveller. Stores a rating (1–5) and an optional
 * comment against the traveller's booking, in luna_travel.reviews.
 *
 * Auth: traveller session cookie (lt_session), same as the other /api/traveller
 * routes. The traveller_id, agency_id and booking_ref are taken from the signed
 * session claims — never trusted from the request body — so a review can only be
 * left for the caller's own booking. One row per (traveller_id, booking_ref):
 * re-submitting updates the existing review rather than piling up duplicates.
 *
 * Not behind the admin middleware. Returns 401 when there is no valid session
 * (e.g. the mock/demo booking, which has no lt_session — the client treats that
 * as "nothing to persist" and still shows the thank-you).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';
const MAX_COMMENT = 2000;

export async function POST(req: NextRequest) {
  if (checkSupabaseEnv()) {
    return NextResponse.json({ error: 'unavailable' }, { status: 503 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await req.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
  }

  const rating = Number(body?.rating);
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    return NextResponse.json({ error: 'invalid_rating' }, { status: 400 });
  }

  const rawComment = typeof body?.comment === 'string' ? body.comment.trim() : '';
  const comment = rawComment ? rawComment.slice(0, MAX_COMMENT) : null;
  const shareConsent = body?.shareConsent === true;

  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('reviews')
    .upsert(
      {
        traveller_id: claims.travellerId,
        agency_id: claims.agencyId,
        booking_ref: claims.bookingRef,
        rating,
        comment,
        share_consent: shareConsent,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'traveller_id,booking_ref' },
    );

  if (error) {
    console.error('[review] save failed:', error.message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}
