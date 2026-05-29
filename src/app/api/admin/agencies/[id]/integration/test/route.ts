/**
 * POST /api/admin/agencies/[id]/integration/test
 *
 * Live "test connection" for an agency's Travelify credentials. Forwards to
 * Control's /api/admin/clients/test-integration, which resolves the saved
 * App ID + API key the same way the booking flow does and makes one real,
 * minimal Travelify call. The key never touches the browser.
 *
 * Gate: requireAdmin (caller must hold the luna_travel permission).
 * [id] is the Control client record id (recXXX).
 * Returns Control's result verbatim: { ok, status, detail }.
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

  try {
    const res = await fetch(`${CONTROL_HOST}/api/admin/clients/test-integration`, {
      method: 'POST',
      headers: {
        Cookie: cookieHeader,
        'Content-Type': 'application/json',
        Accept: 'application/json',
      },
      body: JSON.stringify({ id }),
      cache: 'no-store',
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data?.error || 'control_error', detail: data?.message || data?.detail || '' },
        { status: res.status },
      );
    }
    // Pass Control's { ok, status, detail } straight through.
    return NextResponse.json(data, { status: 200 });
  } catch (err) {
    console.error('[agencies/[id]/integration/test] forward failed:', (err as Error).message);
    return NextResponse.json(
      { status: 'unreachable', detail: 'Could not reach Control to run the test.' },
      { status: 502 },
    );
  }
}
