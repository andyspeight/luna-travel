/**
 * POST /api/flights/subscribe-booking
 *
 * Auto-population trigger. Given a booking (agencyId + bookingRef + its flight
 * legs), subscribes any leg that isn't already being watched. Called fire-and-
 * forget by /api/traveller/booking when a live booking is served, so the
 * traveller's flights start being watched with zero agent effort.
 *
 * Dedupe is the whole point:
 *   - One subscription PER LEG (a booking may have several flights).
 *   - NEVER re-subscribe a leg that already has a trip_flights row, so repeated
 *     app opens don't burn lookups or register duplicate webhooks.
 *
 * Internal-only (x-tg-internal-key). It reuses the existing /api/flights/
 * subscribe route for the actual per-leg work, passing only the not-yet-watched
 * legs. This keeps one code path for resolving + webhook registration.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const INTERNAL_KEY = process.env.TG_INTERNAL_KEY || '';
const SELF_BASE = process.env.LUNA_TRAVEL_PUBLIC_URL || '';

interface IncomingLeg {
  flightLegId: string;
  carrierCode: string;
  flightNumber: string;
  depDateLocal: string; // YYYY-MM-DD
}

export async function POST(req: NextRequest) {
  if (!INTERNAL_KEY || req.headers.get('x-tg-internal-key') !== INTERNAL_KEY) {
    return NextResponse.json({ ok: false, error: 'unauthorized' }, { status: 401 });
  }

  let body: { agencyId?: string; bookingRef?: string; legs?: IncomingLeg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: 'bad_json' }, { status: 400 });
  }

  const { agencyId, bookingRef, legs } = body;
  if (!agencyId || !bookingRef || !Array.isArray(legs) || legs.length === 0) {
    return NextResponse.json({ ok: false, error: 'missing_fields' }, { status: 400 });
  }

  const supabase = getSupabaseAdmin();

  // Which legs of this booking are already watched?
  const { data: existing, error } = await supabase
    .from('trip_flights')
    .select('flight_leg_id')
    .eq('booking_ref', bookingRef);
  if (error) {
    console.error('[subscribe-booking] existing lookup', error.message);
    return NextResponse.json({ ok: false, error: 'query_failed' }, { status: 500 });
  }

  const watched = new Set(
    ((existing || []) as Array<Record<string, unknown>>).map((r) => r.flight_leg_id as string),
  );

  const missing = legs.filter((l) => l.flightLegId && !watched.has(l.flightLegId));
  if (missing.length === 0) {
    return NextResponse.json({ ok: true, subscribed: 0, note: 'all legs already watched' });
  }

  if (!SELF_BASE) {
    console.error('[subscribe-booking] LUNA_TRAVEL_PUBLIC_URL not set');
    return NextResponse.json({ ok: false, error: 'config' }, { status: 500 });
  }

  // Reuse the existing subscribe route for the actual resolve + webhook work.
  try {
    const res = await fetch(`${SELF_BASE}/api/flights/subscribe`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-tg-internal-key': INTERNAL_KEY,
      },
      body: JSON.stringify({ agencyId, bookingRef, legs: missing }),
      cache: 'no-store',
    });
    const out = await res.json().catch(() => ({}));
    return NextResponse.json({ ok: true, subscribed: missing.length, detail: out });
  } catch (e) {
    console.error('[subscribe-booking] subscribe call failed', (e as Error).message);
    return NextResponse.json({ ok: false, error: 'subscribe_failed' }, { status: 502 });
  }
}
