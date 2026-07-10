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
import { getLunaAgency } from '@/lib/agencies';
import { logAuditEvent } from '@/lib/audit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const isEmailLike = (s: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
const isDateLike = (s: string) => /^\d{4}-\d{2}-\d{2}$/.test(s) && !Number.isNaN(Date.parse(s));

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  // Re-check the agency is still live before minting live invites on its behalf.
  const agency = await getLunaAgency(claims.agencyId);
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

  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

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
