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

export async function GET(_req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
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
    .select('id, agency_id, status, expires_at, booking_ref')
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
      // ⚠️ Security: we only pre-fill the booking reference, never the
      // email or departure date.
      //
      // The invite URL travels through low-trust channels (email, SMS,
      // forwards, screenshots). If an attacker obtained the URL, pre-filling
      // all three credentials would let them tap "Load my trip" and access
      // the customer's booking without proving they know anything.
      //
      // Booking ref is on every confirmation email the agency sends so
      // it's mildly public anyway, but email + departure date together
      // are the knowledge check — the customer must supply them from
      // memory or their booking confirmation.
      //
      // Email and departure date are still stored on the invite row
      // (the redemption endpoint validates against Travelify, which has
      // its own copy) — they just aren't returned here.
      bookingRef: invite.booking_ref || null,
    },
  });
}
