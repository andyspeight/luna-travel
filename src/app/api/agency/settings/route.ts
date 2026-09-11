/**
 * /api/agency/settings — operational settings for the signed-in agency. The
 * agencyId comes from the session, never the body, so an agency can only ever
 * edit its own.
 *
 *   POST — save. Body: { replyNotifyEmail?: string | null }.
 *
 * There is no GET: the current values ship with /api/agency/me, which the portal
 * already loads on every page, so a second round trip would buy nothing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';
import { setAgencySettings, isEmail } from '@/lib/agency-settings';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const MAX_EMAIL = 254;

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  // The session lasts 30 days, so re-check the agency is still live before
  // letting it change where its notifications go.
  const agency = await resolvePortalAgency(claims);
  if (!agency || agency.status !== 'live') {
    return NextResponse.json({ error: 'agency_inactive' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const raw = typeof body.replyNotifyEmail === 'string' ? body.replyNotifyEmail.trim() : '';

  // Empty is a valid choice — it means "go back to working it out automatically".
  if (raw && (!isEmail(raw) || raw.length > MAX_EMAIL)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  const settings = { replyNotifyEmail: raw || undefined };

  try {
    await setAgencySettings(claims.agencyId, settings);
  } catch (err) {
    console.error('[agency/settings] save failed:', (err as Error).message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, settings });
}
