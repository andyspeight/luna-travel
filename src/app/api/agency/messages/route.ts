/**
 * /api/agency/messages — the signed-in agency's conversation with one of its
 * travellers. agencyId always comes from the session, and the traveller is
 * verified to belong to that agency, so an agency can only ever read or write
 * its OWN threads.
 *
 *   GET  ?travellerId=…  — the full thread (both directions), oldest→newest.
 *   POST                 — send one message to the traveller (agency→traveller).
 *                          Body: { travellerId, body, subject?, priority?, link? }
 *
 * Built on the shared luna_travel.messages + message_recipients schema — the
 * same store the admin console writes to. A message is linked to its traveller
 * thread by a message_recipients row (for BOTH directions), so the thread query
 * is uniform and a traveller's reply (Stage: traveller_to_agency) slots in.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Attachment = { type: 'link'; url: string; label?: string };
const PRIORITIES = ['info', 'important', 'urgent'] as const;
type Priority = (typeof PRIORITIES)[number];

const MAX_BODY = 4000;
const MAX_SUBJECT = 200;
const MAX_URL = 2048;
const MAX_LABEL = 80;

const str = (v: unknown): string => (typeof v === 'string' ? v : '');
function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

/** Verify a traveller belongs to the session's agency. Returns true/false. */
async function ownsTraveller(agencyId: string, travellerId: string): Promise<boolean> {
  const { data } = await getSupabaseAdmin()
    .from('travellers')
    .select('id')
    .eq('id', travellerId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  return !!data;
}

// ------------------------------------------------------------------ GET thread

export async function GET(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const travellerId = (req.nextUrl.searchParams.get('travellerId') || '').trim();
  if (!travellerId) return NextResponse.json({ error: 'traveller_required' }, { status: 400 });

  if (!(await ownsTraveller(claims.agencyId, travellerId))) {
    return NextResponse.json({ error: 'traveller_not_found' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();

  // A thread has two link paths:
  //   - agency→traveller messages carry a message_recipients row (which also
  //     holds read state — did the traveller read it).
  //   - traveller→agency replies carry NO recipient row (the traveller's own
  //     mark-all-read would falsely stamp it); they are linked by sent_by =
  //     travellerId instead.
  // Fetch both and merge into one time-ordered thread.
  const { data: recips, error: recErr } = await supabase
    .from('message_recipients')
    .select('message_id, read_at')
    .eq('traveller_id', travellerId);
  if (recErr) {
    console.error('[agency/messages] recipients', recErr.message);
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
          .eq('agency_id', claims.agencyId)
          .eq('direction', 'agency_to_traveller')
      : Promise.resolve({ data: [] as Array<Record<string, unknown>>, error: null }),
    supabase
      .from('messages')
      .select('id, direction, subject, body, attachments, priority, sent_at')
      .eq('agency_id', claims.agencyId)
      .eq('direction', 'traveller_to_agency')
      .eq('sent_by', travellerId),
  ]);
  if (inbound.error || outbound.error) {
    console.error('[agency/messages] thread', inbound.error?.message || outbound.error?.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const all = [...(inbound.data || []), ...(outbound.data || [])] as Array<Record<string, unknown>>;
  const messages = all
    .map((m) => {
      const rec = recById.get(m.id as string);
      return {
        id: m.id as string,
        direction: m.direction as string, // agency_to_traveller | traveller_to_agency
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        attachments: (m.attachments as Attachment[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        readAt: (rec?.read_at as string | null) ?? null,
      };
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? -1 : a.sentAt > b.sentAt ? 1 : 0));

  return NextResponse.json({ ok: true, messages });
}

// ------------------------------------------------------------------ POST send

export async function POST(req: NextRequest) {
  const claims = await requireAgency(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const agency = await resolvePortalAgency(claims);
  if (!agency || agency.status !== 'live') {
    return NextResponse.json({ error: 'agency_inactive' }, { status: 403 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }
  const b = (raw || {}) as Record<string, unknown>;

  const travellerId = str(b.travellerId).trim();
  const bodyText = str(b.body).trim();
  const subjectIn = str(b.subject).trim();

  if (!travellerId) return NextResponse.json({ error: 'traveller_required' }, { status: 400 });
  if (!bodyText) return NextResponse.json({ error: 'body_required' }, { status: 400 });
  if (bodyText.length > MAX_BODY) return NextResponse.json({ error: 'body_too_long' }, { status: 400 });
  if (subjectIn.length > MAX_SUBJECT) return NextResponse.json({ error: 'subject_too_long' }, { status: 400 });

  let priority: Priority = 'info';
  const pIn = str(b.priority).trim();
  if (pIn) {
    if (!(PRIORITIES as readonly string[]).includes(pIn)) {
      return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
    }
    priority = pIn as Priority;
  }

  const attachments: Attachment[] = [];
  const link = (b.link || null) as { url?: unknown; label?: unknown } | null;
  if (link && str(link.url).trim()) {
    const linkUrl = str(link.url).trim();
    const linkLabel = str(link.label).trim();
    if (linkUrl.length > MAX_URL || !isHttpUrl(linkUrl)) {
      return NextResponse.json({ error: 'invalid_link_url' }, { status: 400 });
    }
    if (linkLabel.length > MAX_LABEL) return NextResponse.json({ error: 'link_label_too_long' }, { status: 400 });
    attachments.push(linkLabel ? { type: 'link', url: linkUrl, label: linkLabel } : { type: 'link', url: linkUrl });
  }

  if (!(await ownsTraveller(claims.agencyId, travellerId))) {
    return NextResponse.json({ error: 'traveller_not_found' }, { status: 404 });
  }

  const supabase = getSupabaseAdmin();

  // 1) the message content
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      agency_id: claims.agencyId,
      direction: 'agency_to_traveller',
      category: 'agent',
      subject: subjectIn || null,
      body: bodyText,
      attachments,
      priority,
      targeting: { type: 'travellers', travellerIds: [travellerId] },
      sent_by: claims.email,
    })
    .select('id, subject, body, attachments, priority, sent_at')
    .single();
  if (msgErr || !msg) {
    console.error('[agency/messages] insert message', msgErr?.message);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
  const m = msg as Record<string, unknown>;
  const messageId = m.id as string;

  // 2) the per-traveller delivery record
  const nowIso = new Date().toISOString();
  const { error: recErr } = await supabase
    .from('message_recipients')
    .insert({ message_id: messageId, traveller_id: travellerId, delivery_status: 'delivered', delivered_at: nowIso });
  if (recErr) {
    console.error('[agency/messages] insert recipient', recErr.message);
    await supabase.from('messages').delete().eq('id', messageId);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      ok: true,
      message: {
        id: messageId,
        direction: 'agency_to_traveller',
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        attachments: (m.attachments as Attachment[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        readAt: null,
      },
    },
    { status: 201 },
  );
}
