/**
 * POST /api/agency/broadcast — send one message to many of the agency's
 * travellers at once. agencyId comes from the session; recipients are the
 * agency's OWN travellers, filtered by scope.
 *
 * Body: { scope: 'all' | 'upcoming', body, subject?, priority? }
 *   all      — every traveller with access
 *   upcoming — travellers departing today or later
 *
 * Writes ONE message (direction agency_to_traveller) + one message_recipients
 * row per targeted traveller — the exact shape a single send uses, so a
 * broadcast lands in each traveller's app and thread identically.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAgency } from '@/lib/agency-session';
import { resolvePortalAgency } from '@/lib/agencies';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const PRIORITIES = ['info', 'important', 'urgent'] as const;
const MAX_BODY = 4000;
const MAX_SUBJECT = 200;
const str = (v: unknown): string => (typeof v === 'string' ? v : '');

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

  const scope = str(b.scope).trim() || 'all';
  if (scope !== 'all' && scope !== 'upcoming') {
    return NextResponse.json({ error: 'invalid_scope' }, { status: 400 });
  }
  const bodyText = str(b.body).trim();
  const subjectIn = str(b.subject).trim();
  if (!bodyText) return NextResponse.json({ error: 'body_required' }, { status: 400 });
  if (bodyText.length > MAX_BODY) return NextResponse.json({ error: 'body_too_long' }, { status: 400 });
  if (subjectIn.length > MAX_SUBJECT) return NextResponse.json({ error: 'subject_too_long' }, { status: 400 });

  let priority = 'info';
  const pIn = str(b.priority).trim();
  if (pIn) {
    if (!(PRIORITIES as readonly string[]).includes(pIn)) {
      return NextResponse.json({ error: 'invalid_priority' }, { status: 400 });
    }
    priority = pIn;
  }

  const supabase = getSupabaseAdmin();

  // Resolve the recipient travellers for this agency + scope.
  let q = supabase.from('travellers').select('id').eq('agency_id', claims.agencyId);
  if (scope === 'upcoming') {
    q = q.gte('departure_date', new Date().toISOString().slice(0, 10));
  }
  const { data: travs, error: travErr } = await q.limit(1000);
  if (travErr) {
    console.error('[agency/broadcast] travellers', travErr.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const travellerIds = ((travs ?? []) as Array<{ id: string }>).map((t) => t.id);
  if (travellerIds.length === 0) {
    return NextResponse.json({ error: 'no_recipients', message: 'No travellers match that group yet.' }, { status: 400 });
  }

  // 1) one message
  const { data: msg, error: msgErr } = await supabase
    .from('messages')
    .insert({
      agency_id: claims.agencyId,
      direction: 'agency_to_traveller',
      category: 'agent',
      subject: subjectIn || null,
      body: bodyText,
      attachments: [],
      priority,
      targeting: { type: 'broadcast', scope, travellerIds },
      sent_by: claims.email,
    })
    .select('id')
    .single();
  if (msgErr || !msg) {
    console.error('[agency/broadcast] insert message', msgErr?.message);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }
  const messageId = (msg as { id: string }).id;

  // 2) one delivery row per traveller
  const nowIso = new Date().toISOString();
  const rows = travellerIds.map((tid) => ({
    message_id: messageId,
    traveller_id: tid,
    delivery_status: 'delivered',
    delivered_at: nowIso,
  }));
  const { error: recErr } = await supabase.from('message_recipients').insert(rows);
  if (recErr) {
    console.error('[agency/broadcast] insert recipients', recErr.message);
    await supabase.from('messages').delete().eq('id', messageId);
    return NextResponse.json({ error: 'send_failed' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, count: travellerIds.length }, { status: 201 });
}
