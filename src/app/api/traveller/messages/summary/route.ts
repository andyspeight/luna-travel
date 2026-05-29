/**
 * GET /api/traveller/messages/summary
 *
 * Lightweight, side-effect-free companion to /api/traveller/messages. Returns
 * the unread agent-message count and a preview of the newest unread one, for
 * the bottom-bar badge and the home-screen card. Crucially it does NOT mark
 * anything read — only opening the Notifications screen does that — so the badge
 * survives until the traveller actually looks.
 *
 * Reads the lt_session cookie to identify the traveller; no agency id is trusted
 * from the client.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { verifySession } from '@/lib/jwt';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SESSION_COOKIE = 'lt_session';

export async function GET(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) {
    return NextResponse.json({ error: 'no_session' }, { status: 401 });
  }
  const claims = await verifySession(token);
  if (!claims) {
    return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  }
  const travellerId = claims.travellerId;

  const supabase = getSupabaseAdmin();

  // Unread recipient rows for this traveller. No write — read state is left alone.
  const { data: recips, error: recErr } = await supabase
    .from('message_recipients')
    .select('message_id')
    .eq('traveller_id', travellerId)
    .is('read_at', null);
  if (recErr) {
    console.error('[traveller.messages.summary] recipients', recErr.message);
    return NextResponse.json({ unreadCount: 0, latest: null });
  }
  const ids = ((recips || []) as Array<Record<string, unknown>>).map((r) => r.message_id as string);
  if (ids.length === 0) {
    return NextResponse.json({ unreadCount: 0, latest: null });
  }

  // Newest unread agent message, for the home-screen preview.
  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, subject, body, priority, sent_at')
    .in('id', ids)
    .eq('direction', 'agency_to_traveller')
    .order('sent_at', { ascending: false })
    .limit(1);
  if (msgErr) {
    console.error('[traveller.messages.summary] messages', msgErr.message);
    return NextResponse.json({ unreadCount: ids.length, latest: null });
  }

  const rows = (msgs || []) as Array<Record<string, unknown>>;
  const m = rows[0];
  const latest = m
    ? {
        id: m.id as string,
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        priority: m.priority as string,
        sentAt: m.sent_at as string,
      }
    : null;

  return NextResponse.json({ unreadCount: ids.length, latest });
}
