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

  // Agent→traveller messages carry a recipient row (read/delivery state lives
  // there); the traveller's own replies carry sent_by = travellerId and NO
  // recipient row (so the mark-all-read below never touches them). Fetch both
  // and merge into one oldest→newest thread.
  const { data: recips, error: recErr } = await supabase
    .from('message_recipients')
    .select('message_id, read_at, delivered_at')
    .eq('traveller_id', travellerId);
  if (recErr) {
    console.error('[traveller.messages] recipients', recErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const recRows = (recips || []) as Array<Record<string, unknown>>;
  const recById = new Map<string, Record<string, unknown>>();
  recRows.forEach((r) => recById.set(r.message_id as string, r));
  const inboundIds = recRows.map((r) => r.message_id as string);

  const [inbound, outbound] = await Promise.all([
    inboundIds.length
      ? supabase
          .from('messages')
          .select('id, direction, subject, body, attachments, priority, sent_at')
          .in('id', inboundIds)
          .eq('direction', 'agency_to_traveller')
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    supabase
      .from('messages')
      .select('id, direction, subject, body, attachments, priority, sent_at')
      .eq('direction', 'traveller_to_agency')
      .eq('sent_by', travellerId),
  ]);
  if (inbound.error || outbound.error) {
    console.error('[traveller.messages] thread', inbound.error?.message || outbound.error?.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const all = [...(inbound.data || []), ...(outbound.data || [])] as Array<Record<string, unknown>>;
  const messages = all
    .map((m) => {
      const rec = recById.get(m.id as string);
      return {
        id: m.id as string,
        direction: m.direction as string,
        mine: m.direction === 'traveller_to_agency',
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        attachments: (m.attachments as unknown[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        readAt: (rec?.read_at as string | null) ?? null,
        deliveredAt: (rec?.delivered_at as string | null) ?? null,
      };
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0));

  // Mark agent messages read (recipient rows only — never touches replies).
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

/**
 * POST /api/traveller/messages — the traveller replies to their agent.
 * Body: { body }. Writes one traveller_to_agency message linked by
 * sent_by = travellerId (no recipient row). The agency reads it in its portal.
 */
const MAX_REPLY = 4000;

export async function POST(req: NextRequest) {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return NextResponse.json({ error: 'no_session' }, { status: 401 });
  const claims = await verifySession(token);
  if (!claims) return NextResponse.json({ error: 'invalid_session' }, { status: 401 });
  const travellerId = claims.travellerId;

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = (raw || {}) as Record<string, unknown>;
  const body = typeof b.body === 'string' ? b.body.trim() : '';
  if (!body) return NextResponse.json({ error: 'body_required' }, { status: 400 });
  if (body.length > MAX_REPLY) return NextResponse.json({ error: 'body_too_long' }, { status: 400 });

  const supabase = getSupabaseAdmin();

  // The reply belongs to the traveller's own agency.
  const { data: trav, error: travErr } = await supabase
    .from('travellers')
    .select('agency_id')
    .eq('id', travellerId)
    .maybeSingle();
  const agencyId = (trav as { agency_id: string | null } | null)?.agency_id ?? null;
  if (travErr || !agencyId) {
    return NextResponse.json({ error: 'no_agency' }, { status: 400 });
  }

  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      agency_id: agencyId,
      direction: 'traveller_to_agency',
      category: 'agent',
      body,
      attachments: [],
      priority: 'info',
      targeting: { type: 'reply', travellerId },
      sent_by: travellerId,
    })
    .select('id, body, sent_at')
    .single();
  if (msgErr || !msg) {
    console.error('[traveller.messages] reply insert', msgErr?.message);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
  const m = msg as Record<string, unknown>;

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: m.id as string,
        direction: 'traveller_to_agency',
        mine: true,
        subject: null,
        body: m.body as string,
        attachments: [] as unknown[],
        priority: 'info',
        sentAt: m.sent_at as string,
        readAt: null,
      },
    },
    { status: 201 },
  );
}
