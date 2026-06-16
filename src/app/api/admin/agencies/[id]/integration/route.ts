/**
 * POST /api/admin/agencies/[id]/integration
 *
 * Saves the Travelify integration (App ID, Site ID, API key) for an agency.
 * An agency IS a Control client, so this forwards to Control's
 * /api/admin/clients/update-integration — the same server-to-server
 * cookie-forward pattern as the branding save (Path B: no CORS, Control
 * stays the gateway).
 *
 * Gate: requireAdmin (caller must hold the luna_travel permission).
 * Body: { travelifyAppId?, travelifySiteId?, apiKey? }
 *   - omitted field  => left unchanged in Control
 *   - empty string   => clears the field
 * [id] is the Control client record id (recXXX).
 *
 * The API key is write-only from the browser's point of view: it is sent
 * here only when the admin enters a new one, and is never read back to the
 * client (the agencies read surfaces only whether a key is set, plus last 4).
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin, ADMIN_COOKIE_NAME } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CONTROL_HOST = 'https://id.travelify.io';
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

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

  // Only forward the integration fields we own. id comes from the path.
  const payload: Record<string, unknown> = { id };
  for (const key of ['travelifyAppId', 'travelifySiteId', 'apiKey']) {
    if (body[key] !== undefined) payload[key] = body[key];
  }

  try {
    const res = await fetch(`${CONTROL_HOST}/api/admin/clients/update-integration`, {
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
      // Surface Control's validation / conflict message if present
      // (e.g. the 409 when an App ID is already used by another client).
      return NextResponse.json(
        { error: data?.error || 'control_error', detail: data?.message || data?.detail || '' },
        { status: res.status },
      );
    }
    return NextResponse.json({ ok: true, client: data.client ?? null }, { status: 200 });
  } catch (err) {
    console.error('[agencies/[id]/integration] forward failed:', (err as Error).message);
    return NextResponse.json(
      { error: 'control_unavailable', detail: 'Could not save integration to Control' },
      { status: 502 },
    );
  }
}
