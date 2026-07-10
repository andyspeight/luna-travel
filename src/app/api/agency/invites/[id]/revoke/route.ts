/**
 * POST /api/agency/invites/[id]/revoke — the signed-in agency revokes one of
 * its own pending invites. The QR/link stops working (the redeem path checks
 * status). Scoped to the session's agency, and only a `pending` invite can be
 * revoked (a redeemed one has already onboarded the traveller).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const { id } = await props.params;
  if (!id || !UUID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  // Atomic + scoped: only this agency's own still-pending invite flips to revoked.
  const { data, error } = await getSupabaseAdmin()
    .from('invites')
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: 'revoked' } as any)
    .eq('id', id)
    .eq('agency_id', claims.agencyId)
    .eq('status', 'pending')
    .select('id')
    .maybeSingle();

  if (error) {
    console.error('[agency/invites/revoke] failed', error.message);
    return NextResponse.json({ error: 'revoke_failed' }, { status: 500 });
  }
  if (!data) {
    // Not found for this agency, or not pending (already redeemed/expired/revoked).
    return NextResponse.json({ error: 'not_revocable' }, { status: 409 });
  }

  return NextResponse.json({ ok: true, id });
}
