/**
 * POST /api/agency/invites — the signed-in agency sends app access for a
 * booking. Same invite/QR/redeem loop as the admin path, but the agency_id is
 * taken from the session (an agency can only invite for itself).
 *
 * Body: { bookingRef?, email?, departureDate? }
 * Response (201): { inviteId, qrUrl, expiresAt }
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin, checkSupabaseEnv } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';
import { logAuditEvent } from '@/lib/audit';
import { getPlatformSettings } from '@/lib/platform-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isEmailLike = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDateLike = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

interface InviteRow {
  id: string;
  booking_ref: string | null;
  email: string | null;
  departure_date: string | null;
  status: string;
  first_viewed_at: string | null;
  redeemed_at: string | null;
  expires_at: string;
  created_at: string;
}

/**
 * GET /api/agency/invites — list this agency's invites with status/stats.
 * Effective status folds an elapsed expiry into "expired" (there is no auto
 * -expiry job). Scoped to the session's agency only.
 */
export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { data, error } = await getSupabaseAdmin()
    .from('invites')
    .select('id, booking_ref, email, departure_date, status, first_viewed_at, redeemed_at, expires_at, created_at')
    .eq('agency_id', claims.agencyId)
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[agency/invites] list failed', error.message);
    return NextResponse.json({ error: 'list_failed' }, { status: 500 });
  }

  const now = Date.now();
  const invites = ((data ?? []) as InviteRow[]).map((r) => {
    let status = r.status;
    if (status === 'pending' && Date.parse(r.expires_at) < now) status = 'expired';
    return {
      id: r.id,
      bookingRef: r.booking_ref,
      email: r.email,
      departureDate: r.departure_date,
      status, // pending | redeemed | expired | revoked
      opened: !!r.first_viewed_at && status === 'pending',
      firstViewedAt: r.first_viewed_at,
      redeemedAt: r.redeemed_at,
      expiresAt: r.expires_at,
      createdAt: r.created_at,
      qrUrl: `${req.nextUrl.origin}/install?invite=${r.id}`,
    };
  });

  return NextResponse.json({ ok: true, invites });
}

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  // Re-check the agency is still live before minting live invites on its behalf.
  const agency = await resolvePortalAgency(claims);
  if (!agency || agency.status !== 'live') {
    return NextResponse.json({ error: 'agency_inactive' }, { status: 403 });
  }

  const envErr = checkSupabaseEnv();
  if (envErr) {
    return NextResponse.json({ error: `Server misconfigured: ${envErr}` }, { status: 500 });
  }

  let body: { bookingRef?: string; email?: string; departureDate?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const bookingRef = body.bookingRef?.trim() || null;
  const email = body.email?.trim()?.toLowerCase() || null;
  const departureDate = body.departureDate?.trim() || null;

  if (email && !isEmailLike(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }
  if (departureDate && !isDateLike(departureDate)) {
    return NextResponse.json({ error: 'invalid_departure_date' }, { status: 400 });
  }

  const expiryDays = (await getPlatformSettings()).inviteExpiryDays;
  const expiresAt = new Date(Date.now() + expiryDays * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await getSupabaseAdmin()
    .from('invites')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .insert({
      agency_id: claims.agencyId,
      booking_ref: bookingRef,
      email,
      departure_date: departureDate,
      expires_at: expiresAt,
      created_by: claims.email,
    } as any)
    .select('id, expires_at')
    .single();

  if (error || !data) {
    console.error('[agency/invites] insert failed', error);
    return NextResponse.json({ error: 'create_failed', detail: error?.message ?? 'unknown' }, { status: 500 });
  }

  const row = data as unknown as { id: string; expires_at: string };

  void logAuditEvent({
    eventType: 'invite.created',
    actor: claims.email,
    targetId: row.id,
    targetLabel: `${claims.agencyId}${bookingRef ? ' / ' + bookingRef : ''}`,
    metadata: { agencyId: claims.agencyId, bookingRef, hasEmail: !!email, via: 'agency_portal' },
  });

  const qrUrl = `${req.nextUrl.origin}/install?invite=${row.id}`;
  return NextResponse.json({ inviteId: row.id, qrUrl, expiresAt: row.expires_at }, { status: 201 });
}
