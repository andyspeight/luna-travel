/**
 * GET /api/traveller/messages
 *
 * Returns the messages an agent has sent to the signed-in traveller, newest
 * first, for the app's Notifications screen. Reads the lt_session cookie to
 * identify the traveller — no agency id is trusted from the client.
 *
 * Side effect: any unread messages are stamped read_at = now() as the traveller
 * loads the screen, which is what surfaces "read" back to the agent in admin.
 * The readAt value returned in the payload is the one from BEFORE this stamp, so
 * the app can still highlight the just-arrived (previously unread) ones for this
 * view.
 *
 * Built on the pre-existing luna_travel.messages + message_recipients schema.
 * Two-query + in-JS join for predictability in the custom schema.
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

  // 1) this traveller's recipient rows (read/delivery state lives here)
  const { data: recips, error: recErr } = await supabase
    .from('message_recipients')
    .select('message_id, read_at, delivered_at, delivery_status')
    .eq('traveller_id', travellerId);
  if (recErr) {
    console.error('[traveller.messages] recipients', recErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const recRows = (recips || []) as Array<Record<string, unknown>>;
  if (recRows.length === 0) {
    return NextResponse.json({ messages: [] });
  }
  const messageIds = recRows.map((r) => r.message_id as string);

  // 2) the message content (agent-to-traveller only)
  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, subject, body, attachments, priority, sent_at')
    .in('id', messageIds)
    .eq('direction', 'agency_to_traveller');
  if (msgErr) {
    console.error('[traveller.messages] messages', msgErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const recById = new Map<string, Record<string, unknown>>();
  recRows.forEach((r) => recById.set(r.message_id as string, r));

  const messages = ((msgs || []) as Array<Record<string, unknown>>)
    .map((m) => {
      const rec = recById.get(m.id as string);
      return {
        id: m.id as string,
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        attachments: (m.attachments as unknown[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        readAt: (rec?.read_at as string | null) ?? null,
        deliveredAt: (rec?.delivered_at as string | null) ?? null,
      };
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));

  // 3) mark anything still unread as read (best-effort)
  const { error: updErr } = await supabase
    .from('message_recipients')
    .update({ read_at: new Date().toISOString() })
    .eq('traveller_id', travellerId)
    .is('read_at', null);
  if (updErr) {
    console.error('[traveller.messages] mark-read', updErr.message);
  }

  return NextResponse.json({ messages });
}
