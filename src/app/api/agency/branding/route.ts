/**
 * /api/agency/branding — self-serve white-label branding for the signed-in
 * agency. The agencyId is taken from the session, never the body, so an agency
 * can only ever edit its OWN branding.
 *
 *   GET  — the agency's current branding override.
 *   POST — save it. Body: { appName?, brandPrimaryColour?, brandAccentColour?,
 *          welcomeMessage?, logoUrl? }.
 *
 * Luna-native agencies have no Control record, so there is nothing to sync to
 * Control (unlike the admin branding route) — the Luna override IS the source.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAgency } from '@/lib/agency-session';
import { getLunaAgency } from '@/lib/agencies';
import {
  getBrandingOverride,
  setBrandingOverride,
  sanitizeHex,
  type BrandingFields,
} from '@/lib/agency-branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

const MAX = { appName: 60, welcomeMessage: 240, logoUrl: 2048 };

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  const branding = await getBrandingOverride(claims.agencyId);
  return NextResponse.json({ ok: true, branding });
}

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  // Re-check the agency still exists and is live — the session lasts 30 days, so
  // an offboarded/suspended agency must not keep writing branding travellers see.
  const agency = await getLunaAgency(claims.agencyId);
  if (!agency || agency.status !== 'live') {
    return NextResponse.json({ error: 'agency_inactive' }, { status: 403 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const appName = str(body.appName);
  const welcomeMessage = str(body.welcomeMessage);
  const logoUrl = str(body.logoUrl);

  if (appName && appName.length > MAX.appName) {
    return NextResponse.json({ error: 'appName_too_long' }, { status: 400 });
  }
  if (welcomeMessage && welcomeMessage.length > MAX.welcomeMessage) {
    return NextResponse.json({ error: 'welcomeMessage_too_long' }, { status: 400 });
  }
  // Only allow http(s) logo URLs — the value is rendered as an <img src>.
  if (logoUrl && (!/^https?:\/\//i.test(logoUrl) || logoUrl.length > MAX.logoUrl)) {
    return NextResponse.json({ error: 'invalid_logo_url' }, { status: 400 });
  }

  const fields: BrandingFields = {
    appName,
    welcomeMessage,
    logoUrl,
    brandPrimaryColour: sanitizeHex(body.brandPrimaryColour as string | undefined),
    brandAccentColour: sanitizeHex(body.brandAccentColour as string | undefined),
  };

  try {
    await setBrandingOverride(claims.agencyId, fields);
  } catch (err) {
    console.error('[agency/branding] save failed:', (err as Error).message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, branding: fields });
}
