/**
 * /api/admin/agencies/[id]/messages
 *
 * POST  — send one message to one traveller.
 *         Body: { travellerId, body, subject?, imageUrl?, link?:{url,label?},
 *                 priority?:'info'|'important'|'urgent' }
 *         Writes one row to `messages` (the content) and one row to
 *         `message_recipients` (the per-traveller delivery + read record). This
 *         is the same shape a broadcast will use later — a broadcast is just one
 *         message with many recipient rows — so phase two slots straight in.
 *         Gated by requireAdmin (it's a write).
 *
 * GET    — list messages sent to a traveller: ?travellerId=...
 *         Returns each message with its read/delivered state for that traveller.
 *         With no travellerId, returns the agency's recent messages (used later
 *         by the Messages tab). Admin-gated by middleware, like the travellers
 *         endpoint alongside it.
 *
 * Built on the pre-existing luna_travel.messages + message_recipients schema.
 * Two-query + in-JS join rather than PostgREST embedding, for predictability in
 * this custom (non-public) schema.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

type Attachment =
  | { type: 'image'; url: string }
  | { type: 'link'; url: string; label?: string };

const PRIORITIES = ['info', 'important', 'urgent'] as const;
type Priority = (typeof PRIORITIES)[number];

const MAX_BODY = 4000;
const MAX_SUBJECT = 200;
const MAX_URL = 2048;
const MAX_LABEL = 80;

function isHttpUrl(value: string): boolean {
  try {
    const u = new URL(value);
    return u.protocol === 'http:' || u.protocol === 'https:';
  } catch {
    return false;
  }
}

function str(v: unknown): string {
  return typeof v === 'string' ? v : '';
}

// ---------------------------------------------------------------- POST (send)

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const agencyId = (params?.id || '').trim();
  if (!agencyId) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
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

  if (!travellerId) {
    return NextResponse.json({ error: 'traveller_required' }, { status: 400 });
  }
  if (!bodyText) {
    return NextResponse.json({ error: 'body_required' }, { status: 400 });
  }
  if (bodyText.length > MAX_BODY) {
    return NextResponse.json({ error: 'body_too_long' }, { status: 400 });
  }
  if (subjectIn.length > MAX_SUBJECT) {
    return NextResponse.json({ error: 'subject_too_long' }, { status: 400 });
  }

  // priority
  let priority: Priority = 'info';
  const pIn = str(b.priority).trim();
  if (pIn) {
    if (!(PRIORITIES as readonly string[]).includes(pIn)) {
      return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
    }
    priority = pIn as Priority;
  }

  // attachments: optional image + optional link
  const attachments: Attachment[] = [];

  const imageUrl = str(b.imageUrl).trim();
  if (imageUrl) {
    if (imageUrl.length > MAX_URL || !isHttpUrl(imageUrl)) {
      return NextResponse.json({ error: 'invalid_image_url' }, { status: 400 });
    }
    attachments.push({ type: 'image', url: imageUrl });
  }

  const link = (b.link || null) as { url?: unknown; label?: unknown } | null;
  if (link && str(link.url).trim()) {
    const linkUrl = str(link.url).trim();
    const linkLabel = str(link.label).trim();
    if (linkUrl.length > MAX_URL || !isHttpUrl(linkUrl)) {
      return NextResponse.json({ error: 'invalid_link_url' }, { status: 400 });
    }
    if (linkLabel.length > MAX_LABEL) {
      return NextResponse.json({ error: 'link_label_too_long' }, { status: 400 });
    }
    attachments.push(
      linkLabel
        ? { type: 'link', url: linkUrl, label: linkLabel }
        : { type: 'link', url: linkUrl },
    );
  }

  const supabase = getSupabaseAdmin();

  // The traveller must belong to this agency.
  const { data: trav, error: travErr } = await supabase
    .from('travellers')
    .select('id')
    .eq('id', travellerId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (travErr) {
    console.error('[messages.POST] traveller lookup', travErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (!trav) {
    return NextResponse.json({ error: 'traveller_not_found' }, { status: 404 });
  }

  // 1) the message content
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      agency_id: agencyId,
      direction: 'agency_to_traveller',
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
    console.error('[messages.POST] insert message', msgErr?.message);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
  const m = msg as Record<string, unknown>;
  const messageId = m.id as string;

  // 2) the per-traveller delivery record
  const nowIso = new Date().toISOString();
  const { error: recErr } = await supabase
    .from('message_recipients')
    .insert({
      message_id: messageId,
      traveller_id: travellerId,
      delivery_status: 'delivered',
      delivered_at: nowIso,
    });
  if (recErr) {
    // Don't leave an orphan message the traveller can never see.
    console.error('[messages.POST] insert recipient', recErr.message);
    await supabase.from('messages').delete().eq('id', messageId);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  return NextResponse.json(
    {
      message: {
        id: messageId,
        subject: (m.subject as string | null) ?? null,
        body: m.body as string,
        attachments: (m.attachments as Attachment[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        deliveredAt: nowIso,
        readAt: null,
      },
    },
    { status: 201 },
  );
}

// ---------------------------------------------------------------- GET (list)

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } },
) {
  const agencyId = (params?.id || '').trim();
  if (!agencyId) {
    return NextResponse.json({ error: 'invalid_agency' }, { status: 400 });
  }

  const url = new URL(req.url);
  const travellerId = (url.searchParams.get('travellerId') || '').trim();
  const supabase = getSupabaseAdmin();

  // Agency-wide recent list (used later by the Messages tab).
  if (!travellerId) {
    const { data, error } = await supabase
      .from('messages')
      .select('id, subject, body, attachments, priority, sent_at')
      .eq('agency_id', agencyId)
      .order('sent_at', { ascending: false })
      .limit(50);
    if (error) {
      console.error('[messages.GET] agency list', error.message);
      return NextResponse.json({ error: 'query_failed' }, { status: 500 });
    }
    const messages = ((data || []) as Array<Record<string, unknown>>).map((m) => ({
      id: m.id as string,
      subject: (m.subject as string | null) ?? null,
      body: m.body as string,
      attachments: (m.attachments as Attachment[]) ?? [],
      priority: m.priority as string,
      sentAt: m.sent_at as string,
    }));
    return NextResponse.json({ messages });
  }

  // Per-traveller thread.
  const { data: trav, error: travErr } = await supabase
    .from('travellers')
    .select('id')
    .eq('id', travellerId)
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (travErr) {
    console.error('[messages.GET] traveller lookup', travErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  if (!trav) {
    return NextResponse.json({ error: 'traveller_not_found' }, { status: 404 });
  }

  const { data: recips, error: recErr } = await supabase
    .from('message_recipients')
    .select('message_id, read_at, delivered_at, delivery_status')
    .eq('traveller_id', travellerId);
  if (recErr) {
    console.error('[messages.GET] recipients', recErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const recRows = (recips || []) as Array<Record<string, unknown>>;
  if (recRows.length === 0) {
    return NextResponse.json({ messages: [] });
  }
  const messageIds = recRows.map((r) => r.message_id as string);

  const { data: msgs, error: msgErr } = await supabase
    .from('messages')
    .select('id, subject, body, attachments, priority, sent_at')
    .in('id', messageIds)
    .eq('agency_id', agencyId);
  if (msgErr) {
    console.error('[messages.GET] messages', msgErr.message);
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
        attachments: (m.attachments as Attachment[]) ?? [],
        priority: m.priority as string,
        sentAt: m.sent_at as string,
        deliveredAt: (rec?.delivered_at as string | null) ?? null,
        readAt: (rec?.read_at as string | null) ?? null,
        deliveryStatus: (rec?.delivery_status as string) ?? 'pending',
      };
    })
    .sort((a, b) => (a.sentAt < b.sentAt ? 1 : a.sentAt > b.sentAt ? -1 : 0));

  return NextResponse.json({ messages });
}
