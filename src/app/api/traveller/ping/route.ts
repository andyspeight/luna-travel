/**
 * POST /api/traveller/ping
 *
 * Records that the traveller identified by the lt_session cookie opened the
 * app. Fire-and-forget from the client (booking-context). Updates three
 * engagement columns on the traveller row:
 *   - first_opened_at : set once, on the first ever open
 *   - last_opened_at  : set every ping
 *   - open_count      : bumped only when the previous open was more than the
 *                       session window ago, so flicking back to the app does
 *                       not inflate the count
 *
 * Auth: the lt_session cookie (same HS256 JWT used by the booking endpoint).
 * No session => 401, which is a harmless no-op for the mock/demo path.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';
const SESSION_WINDOW_MS = 30 * 60 * 1000; // 30 minutes

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[traveller.ping] supabase init failed:', (e as Error).message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  // Read the current engagement state for this traveller.
  const { data: row, error: readErr } = await supabase
    .from('travellers')
    .select('id, first_opened_at, last_opened_at, open_count')
    .eq('id', claims.travellerId)
    .maybeSingle();

  if (readErr) {
    console.error('[traveller.ping] read failed:', readErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (!row) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }

  const now = new Date();
  const lastRaw = row.last_opened_at as string | null;
  const last = lastRaw ? new Date(lastRaw) : null;
  const isNewOpen = !last || (now.getTime() - last.getTime()) > SESSION_WINDOW_MS;
  const currentCount = typeof row.open_count === 'number' ? row.open_count : 0;

  const update: Record<string, unknown> = { last_opened_at: now.toISOString() };
  if (!row.first_opened_at) {
    update.first_opened_at = now.toISOString();
  }
  if (isNewOpen) {
    update.open_count = currentCount + 1;
  }

  const { error: writeErr } = await supabase
    .from('travellers')
    .update(update)
    .eq('id', claims.travellerId);

  if (writeErr) {
    console.error('[traveller.ping] update failed:', writeErr.message);
    return NextResponse.json({ error: 'update_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, counted: isNewOpen });
}
