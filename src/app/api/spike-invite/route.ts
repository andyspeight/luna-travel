/**
 * GET /api/spike-invite   ⚠️ TEMPORARY — remove before production (with the spike)
 *
 * Creates a redeemable invite WITHOUT the admin cookie gate, so we can test the
 * full redemption→render flow on the *.vercel.app preview URL (where the
 * .travelify.io admin cookie never arrives). Secret-gated like the other spikes.
 *
 * Usage:
 *   /api/spike-invite?secret=SECRET&ref=DEMO61807
 *     ref       optional — booking ref to pre-fill on the invite
 *     agencyId  optional — defaults to the hardcoded admin-UI id agc_7k2n
 *                          ("Coast & Crown Travel"). There is no real agencies
 *                          table yet; agency_id on invites is a free-text
 *                          column, so any string works.
 *     email     optional — pre-fill (traveller still has to enter to redeem)
 *     depart    optional — pre-fill YYYY-MM-DD
 *
 * Returns { inviteId, redeemUrl, expiresAt }. Open redeemUrl to land on the
 * /install redemption form. Lives on the `live-wiring` branch only.
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'node:crypto';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DEFAULT_AGENCY_ID = 'agc_7k2n'; // matches the admin UI's hardcoded list

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
  if (!expected) return NextResponse.json({ error: 'spike_disabled' }, { status: 503 });
  if (!secret || !safeEqual(secret, expected)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const envErr = checkSupabaseEnv();
  if (envErr) return NextResponse.json({ error: `Server misconfigured: ${envErr}` }, { status: 500 });

  const agencyId = searchParams.get('agencyId')?.trim() || DEFAULT_AGENCY_ID;
  const bookingRef = searchParams.get('ref')?.trim()?.toUpperCase() || null;
  const email = searchParams.get('email')?.trim()?.toLowerCase() || null;
  const departureDate = searchParams.get('depart')?.trim() || null;

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

  const supabase = getSupabaseAdmin();
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
      { stage: 'create', error: error.message },
      { status: 500 },
    );
  }

  const inviteId = data?.id as string;
  return NextResponse.json(
    {
      stage: 'created',
      inviteId,
      agencyId,
      redeemUrl: `${origin}/install?invite=${inviteId}`,
      expiresAt: data?.expires_at,
    },
    { status: 200 },
  );
}
