/**
 * GET /api/invites/[id]
 *
 * Fetches invite details for the install page to pre-fill the redemption
 * form. Returns ONLY safe public-ish fields:
 *   - status (pending / redeemed / expired)
 *   - expiresAt
 *   - agencyId (used only to look up the display name client-side from the
 *     bundled AGENCIES list — we don't expose any other agency metadata)
 *   - prefill.bookingRef / email / departureDate — only present if the
 *     agency set them when creating the invite
 *
 * NOT returned: created_by, redeemed_at, redeemed_traveller_id, internal IDs.
 *
 * Errors return 404 generically (anti-enumeration, even though invite IDs
 * are UUIDs and not enumerable). The redemption endpoint follows the same
 * pattern so the install page never sees a 500 — it always knows "either
 * I can pre-fill, or I can't, but the form still works".
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

function notFound() {
  return NextResponse.json({ error: 'not_found' }, { status: 404 });
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const inviteId = params.id;
  if (!inviteId || typeof inviteId !== 'string' || inviteId.length < 8 || inviteId.length > 64) {
    return notFound();
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[invite-get] supabase init failed:', (e as Error).message);
    return notFound();
  }

  const { data: invite, error } = await supabase
    .from('invites')
    .select('id, agency_id, status, expires_at, booking_ref, email, departure_date')
    .eq('id', inviteId)
    .single();

  if (error || !invite) {
    return notFound();
  }

  // Compute a derived status so the client can show the right state without
  // doing date math itself.
  const expiresAt = new Date(invite.expires_at as string);
  let derivedStatus: 'pending' | 'redeemed' | 'expired' = invite.status as 'pending' | 'redeemed';
  if (invite.status === 'pending' && expiresAt.getTime() < Date.now()) {
    derivedStatus = 'expired';
  }

  return NextResponse.json({
    inviteId: invite.id,
    agencyId: invite.agency_id,
    status: derivedStatus,
    expiresAt: invite.expires_at,
    prefill: {
      bookingRef: invite.booking_ref || null,
      email: invite.email || null,
      departureDate: invite.departure_date || null,
    },
  });
}
