/**
 * POST /api/admin/agencies/[id]/branding
 *
 * Saves white-label branding for an agency. An agency IS a Control client, so
 * branding lives in Control — this route forwards to Control's
 * /api/admin/clients/update-branding, the same server-to-server cookie-forward
 * pattern as the agencies read (Path B: no CORS, Control stays the gateway).
 *
 * Gate: requireAdmin (caller must hold the luna_travel permission).
 * Body: { appName?, brandPrimaryColour?, brandAccentColour?, welcomeMessage? }
 * [id] is the Control client record id (recXXX).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
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

  // Only forward the branding fields we own. id comes from the path.
  const payload: Record<string, unknown> = { id };
  for (const key of ['appName', 'brandPrimaryColour', 'brandAccentColour', 'welcomeMessage', 'logoUrl']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  try {
    const res = await fetch(`${CONTROL_HOST}/api/admin/clients/update-branding`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify(payload),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      // Surface Control's validation message if present.
      return NextResponse.json(
        { error: data?.error || 'control_error', detail: data?.message || data?.detail || '' },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true, branding: data.branding ?? null }, { status: 200 });
  } catch (err) {
    console.error('[agencies/[id]/branding] forward failed:', (err as Error).message);
    return NextResponse.json(
      { error: 'control_unavailable', detail: 'Could not save branding to Control' },
      { status: 502 },
    );
  }
}
