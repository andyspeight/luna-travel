/**
 * GET /api/admin/audit
 *
 * Returns audit events for the audit log page. Supports filtering and
 * keyset pagination via 'before' (timestamp cursor).
 *
 * Query params:
 *   eventType  — comma-separated list to filter by (e.g. "invite.created,invite.redeemed")
 *   actor      — substring match on the actor field
 *   limit      — max events per page (default 50, max 200)
 *   before     — ISO timestamp; only events strictly before this
 *
 * Response:
 *   { events: [...], nextBefore: string | null }
 *
 * Auth: gated by middleware (admin cookie required).
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';

const ALLOWED_EVENT_TYPES = [
  'admin.signin',
  'admin.signin_failed',
  'admin.signout',
  'invite.created',
  'invite.redeemed',
  'document.uploaded',
  'document.deleted',
];

export async function GET(req: NextRequest) {
  const url = req.nextUrl;
  const eventTypeRaw = url.searchParams.get('eventType') || '';
  const actor = (url.searchParams.get('actor') || '').trim().toLowerCase();
  const limitRaw = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limitRaw) ? limitRaw : 50, 1), 200);
  const before = url.searchParams.get('before');

  // Validate eventType filter — drop anything not in the allow-list
  const eventTypes = eventTypeRaw
    .split(',')
    .map((s) => s.trim())
    .filter((s) => ALLOWED_EVENT_TYPES.includes(s));

  let supabase;
  try {
    supabase = getSupabaseAdmin();
  } catch (e) {
    console.error('[audit-feed] supabase init failed:', (e as Error).message);
    return NextResponse.json({ error: 'server_error' }, { status: 500 });
  }

  let query = supabase
    .from('audit_events')
    .select('id, event_type, actor, target_id, target_label, metadata, created_at')
    .order('created_at', { ascending: false })
    .limit(limit + 1); // +1 to know if there's a next page

  if (eventTypes.length > 0) {
    query = query.in('event_type', eventTypes);
  }
  if (actor) {
    query = query.ilike('actor', `%${actor}%`);
  }
  if (before) {
    query = query.lt('created_at', before);
  }

  const { data, error } = await query;
  if (error) {
    console.error('[audit-feed] query failed:', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }

  const rows = (data || []) as Array<{
    id: string;
    event_type: string;
    actor: string;
    target_id: string | null;
    target_label: string | null;
    metadata: Record<string, unknown> | null;
    created_at: string;
  }>;

  const hasMore = rows.length > limit;
  const events = hasMore ? rows.slice(0, limit) : rows;
  const nextBefore = hasMore ? events[events.length - 1].created_at : null;

  return NextResponse.json({
    events: events.map((e) => ({
      id: e.id,
      eventType: e.event_type,
      actor: e.actor,
      targetId: e.target_id,
      targetLabel: e.target_label,
      metadata: e.metadata,
      createdAt: e.created_at,
    })),
    nextBefore,
  });
}
