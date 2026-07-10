/**
 * /api/admin/agencies/[id]/branding
 *
 * POST   — save white-label branding for an agency.
 *          Body: { appName?, brandPrimaryColour?, brandAccentColour?,
 *                  welcomeMessage?, logoUrl? }
 *          Writes to BOTH layers (they are kept in sync):
 *            1. Luna's own override store (luna_travel.agency_branding) — this is
 *               what the traveller app actually reads, and it wins on read.
 *            2. Control's client record (/api/admin/clients/update-branding),
 *               best-effort, so Control stays aligned.
 *          The Luna write is authoritative; a Control sync failure is reported
 *          but does not fail the save.
 *
 * DELETE — "Reset to Control": drop the Luna override so the agency reverts to
 *          inheriting branding from its Control record.
 *
 * Gate: requireAdmin (caller must hold the luna_travel permission).
 * [id] is the Control client record id (recXXX).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';
import {
  setBrandingOverride,
  clearBrandingOverride,
  type BrandingFields,
} from '@/lib/agency-branding';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() ? v.trim() : undefined;

/** Best-effort forward of the branding to Control so the two stay in sync. */
async function syncToControl(
  id: string,
  payload: Record<string, unknown>,
  cookieHeader: string,
): Promise<boolean> {
  try {
    const res = await fetch(`${CONTROL_HOST}/api/admin/clients/update-branding`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id, ...payload }),
      cache: 'no-store',
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function POST(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const cookieHeader = req.headers.get('cookie') ?? '';
  if (!cookieHeader.includes(ADMIN_COOKIE_NAME)) {
    return NextResponse.json({ error: 'no_session_cookie' }, { status: 401 });
  }

  const id = (params?.id || '').trim();
  if (!REC_ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const fields: BrandingFields = {
    appName: str(body.appName),
    logoUrl: str(body.logoUrl),
    brandPrimaryColour: str(body.brandPrimaryColour),
    brandAccentColour: str(body.brandAccentColour),
    welcomeMessage: str(body.welcomeMessage),
  };

  // 1. Luna override — authoritative for the traveller app. Must succeed.
  try {
    await setBrandingOverride(id, fields);
  } catch (err) {
    console.error('[agencies/[id]/branding] luna override save failed:', (err as Error).message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  // 2. Best-effort sync to Control (only the fields present in the request).
  const controlPayload: Record<string, unknown> = {};
  for (const key of ['appName', 'brandPrimaryColour', 'brandAccentColour', 'welcomeMessage', 'logoUrl']) {
    if (body[key] !== undefined) controlPayload[key] = body[key];
  }
  const controlSynced = await syncToControl(id, controlPayload, cookieHeader);

  return NextResponse.json({ ok: true, controlSynced }, { status: 200 });
}

export async function DELETE(req: NextRequest, props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const id = (params?.id || '').trim();
  if (!REC_ID_RE.test(id)) {
    return NextResponse.json({ error: 'invalid_id' }, { status: 400 });
  }

  try {
    await clearBrandingOverride(id);
  } catch (err) {
    console.error('[agencies/[id]/branding] reset failed:', (err as Error).message);
    return NextResponse.json({ error: 'clear_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 200 });
}
