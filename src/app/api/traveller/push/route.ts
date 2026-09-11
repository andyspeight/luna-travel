/**
 * /api/traveller/push — the signed-in traveller's push subscriptions.
 *
 *   POST   — register this device (idempotent on endpoint).
 *   DELETE — deregister this device, e.g. they turned notifications off.
 *
 * Identity comes from the lt_session cookie: a subscription is only ever
 * attached to the traveller currently signed in on that device, never to an id
 * supplied by the caller.
 *
 * One row per device, so a traveller with a phone and a tablet gets both.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

/** Push endpoints are https URLs issued by the browser's push service. */
function isValidEndpoint(v: unknown): v is string {
  if (typeof v !== 'string' || v.length < 20 || v.length > 1000) return false;
  try {
    return new URL(v).protocol === 'https:';
  } catch {
    return false;
  }
}

const isKey = (v: unknown, max: number): v is string =>
  typeof v === 'string' && v.length > 0 && v.length <= max;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 });
  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'invalid_session' }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const endpoint = body.endpoint;
  const keys = (body.keys ?? {}) as Record<string, unknown>;
  if (!isValidEndpoint(endpoint) || !isKey(keys.p256dh, 300) || !isKey(keys.auth, 300)) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }

  // Trimmed: the full UA is long and only useful for telling a traveller's
  // devices apart in support.
  const userAgent = (req.headers.get('user-agent') || '').slice(0, 300);

  const { error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .upsert(
      {
        traveller_id: claims.travellerId,
        endpoint,
        p256dh: keys.p256dh,
        auth: keys.auth,
        user_agent: userAgent,
        last_seen_at: new Date().toISOString(),
      },
      // The push service returns the same endpoint when a device re-subscribes,
      // so conflicting on it makes repeat calls harmless — and re-points the
      // row if a different traveller signs in on the same device.
      { onConflict: 'endpoint' },
    );

  if (error) {
    console.error('[push.subscribe]', error.message);
    return NextResponse.json({ error: 'save_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function DELETE(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 });
  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'invalid_session' }, { status: 401 });

  const endpoint = req.nextUrl.searchParams.get('endpoint') || '';
  if (!isValidEndpoint(endpoint)) {
    return NextResponse.json({ error: 'invalid_endpoint' }, { status: 400 });
  }

  // Scoped to this traveller so a known endpoint can't be used to unsubscribe
  // somebody else's device.
  const { error } = await getSupabaseAdmin()
    .from('push_subscriptions')
    .delete()
    .eq('endpoint', endpoint)
    .eq('traveller_id', claims.travellerId);

  if (error) {
    console.error('[push.unsubscribe]', error.message);
    return NextResponse.json({ error: 'delete_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
