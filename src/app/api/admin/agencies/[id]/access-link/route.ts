/**
 * POST /api/admin/agencies/[id]/access-link
 *
 * Operator action (SSO admin): mint a magic-link for a Luna-native agency so it
 * can sign in to its own portal without Travelgenix SSO. Returns the full URL to
 * copy or email to the agency's contact. There is no server email yet, so
 * delivery is manual — hence the generous token TTL.
 *
 * Only Luna-native agencies (`lt…`) use this. Control agencies (`rec…`) sign in
 * via Travelgenix ID, so this returns 400 for them.
 *
 * Gate: requireAdmin.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { isLunaAgency } from '@/lib/agency-id';
import { getLunaAgency } from '@/lib/agencies';
import { createLoginToken } from '@/lib/agency-login';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const id = (params?.id || '').trim();
  if (!isLunaAgency(id)) {
    return NextResponse.json({ error: 'not_a_luna_agency' }, { status: 400 });
  }

  const agency = await getLunaAgency(id);
  if (!agency) {
    return NextResponse.json({ error: 'agency_not_found' }, { status: 404 });
  }
  if (!agency.contact_email) {
    return NextResponse.json({ error: 'no_contact_email' }, { status: 400 });
  }

  let created;
  try {
    created = await createLoginToken(id, agency.contact_email, { createdBy: claims.email });
  } catch (err) {
    console.error('[access-link] mint failed:', (err as Error).message);
    return NextResponse.json({ error: 'mint_failed' }, { status: 500 });
  }

  const url = `${req.nextUrl.origin}/agency/login?token=${encodeURIComponent(created.token)}`;
  return NextResponse.json({
    ok: true,
    url,
    email: agency.contact_email,
    expiresAt: created.expiresAt,
  });
}
