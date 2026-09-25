/**
 * POST /api/traveller/signout: end this phone's traveller session.
 *
 * "Sign out" on the Me screen used to be a link to /welcome and nothing more.
 * The session cookie stayed, so the trip came straight back. Now that the phone
 * also keeps a copy of the trip for when there is no signal, signing out has to
 * be real, or a phone passed to somebody else keeps the last traveller's trip.
 *
 * It also removes this phone's push subscription (its endpoint comes in the
 * body), scoped to this traveller exactly as DELETE /api/traveller/push is, so
 * the next person to use the phone does not get the last traveller's alerts.
 * Both happen in one request so that a sign-out with no signal changes nothing
 * rather than half of it.
 *
 * The cookie is cleared whatever state the session is in: signing out is never
 * refused, except to another site.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';
import { isValidEndpoint } from '@/lib/push-endpoint';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function POST(req: NextRequest) {
  // Only from the app itself. Another site cannot read anything here, but it
  // should not be able to sign a traveller out either.
  const origin = req.headers.get('origin');
  if (origin) {
    let same = false;
    try {
      same = new URL(origin).host === req.headers.get('host');
    } catch {
      same = false;
    }
    if (!same) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const token = req.cookies.get(SESSION_COOKIE)?.value;
  const claims = token ? await verifySession(token) : null;

  if (claims) {
    let endpoint: unknown = null;
    try {
      const text = await req.text();
      if (text && text.length <= 2000) endpoint = (JSON.parse(text) as { endpoint?: unknown })?.endpoint ?? null;
    } catch {
      endpoint = null;
    }
    if (isValidEndpoint(endpoint)) {
      const { error } = await getSupabaseAdmin()
        .from('push_subscriptions')
        .delete()
        .eq('endpoint', endpoint)
        .eq('traveller_id', claims.travellerId);
      if (error) {
        // The session still ends. The subscription dies with the browser's own
        // unsubscribe, which the app does next, and the push sender drops
        // endpoints that stop answering.
        console.error('[traveller.signout] push delete failed:', error.message);
      }
    }
  }

  const res = NextResponse.json({ ok: true }, { status: 200 });
  res.cookies.set(SESSION_COOKIE, '', {
    httpOnly: true,
    secure: true,
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  res.headers.set('Cache-Control', 'no-store');
  return res;
}
