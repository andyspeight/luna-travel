/**
 * GET /api/spike-invite   ⚠️ TEMPORARY — remove before production (with the spike)
 *
 * Creates a redeemable invite WITHOUT the admin cookie gate, so we can test the
 * full redemption→render flow on the *.vercel.app preview URL (where the
 * .travelify.io admin cookie never arrives). Secret-gated like the other spikes.
 *
 * Two modes:
 *   - List real agencies (so we use a genuine agency_id, not a hardcoded one):
 *       /api/spike-invite?secret=SECRET&list=1
 *   - Create an invite:
 *       /api/spike-invite?secret=SECRET&agencyId=AGC&ref=DEMO61807
 *         agencyId  required — a real agencies.id (get one via list=1)
 *         ref       optional — booking ref to pre-fill
 *
 * On create, returns { inviteId, redeemUrl, expiresAt } — open redeemUrl to
 * land on the /install redemption form.
 *
 * Lives on the `live-wiring` branch only.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export async function GET(req: NextRequest) {
  const { searchParams, origin } = new URL(req.url);

  const secret = searchParams.get('secret') ?? '';
  const expected = process.env.SPIKE_SECRET ?? '';
  if (!expected) {
    return NextResponse.json({ error: 'spike_disabled' }, { status: 503 });
  }
  if (!secret || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const envErr = checkSupabaseEnv();
  if (envErr) return NextResponse.json({ error: `Server misconfigured: ${envErr}` }, { status: 500 });

  const supabase = getSupabaseAdmin();

  // ── Mode 1: list real agencies ──
  if (searchParams.get('list')) {
    const { data, error } = await supabase
      .from('agencies')
      .select('id, name, status')
      .order('name', { ascending: true })
      .limit(50);
    if (error) return NextResponse.json({ stage: 'list', error: error.message }, { status: 500 });
    return NextResponse.json({ stage: 'list', agencies: data ?? [] }, { status: 200 });
  }

  // ── Mode 2: create an invite ──
  const agencyId = searchParams.get('agencyId')?.trim();
  if (!agencyId) {
    return NextResponse.json(
      { error: 'agencyId required', hint: 'Call with &list=1 first to get a real agency id.' },
      { status: 400 },
    );
  }
  const bookingRef = searchParams.get('ref')?.trim()?.toUpperCase() || null;
  const email = searchParams.get('email')?.trim()?.toLowerCase() || null;
  const departureDate = searchParams.get('depart')?.trim() || null;

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabase
    .from('invites')
    .insert({
      agency_id: agencyId,
      booking_ref: bookingRef,
      email,
      departure_date: departureDate,
      expires_at: expiresAt,
      status: 'pending',
    } as Record<string, unknown>)
    .select('id, expires_at')
    .single();

  if (error) {
    return NextResponse.json(
      { stage: 'create', error: error.message, hint: 'If this mentions a foreign key, the agencyId is not real — use &list=1.' },
      { status: 500 },
    );
  }

  const inviteId = data?.id as string;
  return NextResponse.json(
    {
      stage: 'created',
      inviteId,
      redeemUrl: `${origin}/install?invite=${inviteId}`,
      expiresAt: data?.expires_at,
    },
    { status: 200 },
  );
}
