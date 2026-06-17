/**
 * GET /api/admin/sync-events?agencyId=&status=&before=&limit=
 *
 * The real feed behind the admin Sync monitor: rows from luna_travel.sync_events
 * (keyset-paginated on synced_at) plus headline stats (success rate, failed count,
 * failed-by-agency) computed over the recent slice. Admin-gated.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { requireAdmin } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const url = req.nextUrl;
  const agencyId = url.searchParams.get('agencyId')?.trim();
  const status = url.searchParams.get('status')?.trim();
  const before = url.searchParams.get('before');
  const limRaw = parseInt(url.searchParams.get('limit') || '50', 10);
  const limit = Math.min(Math.max(Number.isFinite(limRaw) ? limRaw : 50, 1), 200);

  const supabase = getSupabaseAdmin();

  let q = supabase
    .from('sync_events')
    .select('id, agency_id, booking_ref, traveller_id, status, detail, error_code, duration_ms, documents_added, source, synced_at')
    .order('synced_at', { ascending: false })
    .limit(limit + 1);
  if (agencyId) q = q.eq('agency_id', agencyId);
  if (status && ['success', 'partial', 'failed'].includes(status)) q = q.eq('status', status);
  if (before) q = q.lt('synced_at', before);

  const { data, error } = await q;
  if (error) {
    console.error('[sync-events]', error.message);
    return NextResponse.json({ error: 'query_failed' }, { status: 500 });
  }
  const rows = (data || []) as Array<Record<string, unknown>>;
  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;
  const nextBefore = hasMore ? (page[page.length - 1].synced_at as string) : null;

  // Headline stats over the recent slice.
  const { data: recent } = await supabase
    .from('sync_events')
    .select('agency_id, status')
    .order('synced_at', { ascending: false })
    .limit(500);
  const slice = (recent || []) as Array<{ agency_id: string; status: string }>;
  const total = slice.length;
  const success = slice.filter((r) => r.status === 'success').length;
  const failed = slice.filter((r) => r.status === 'failed').length;
  const partial = slice.filter((r) => r.status === 'partial').length;
  const failedByAgency: Record<string, number> = {};
  for (const r of slice) {
    if (r.status === 'failed') failedByAgency[r.agency_id] = (failedByAgency[r.agency_id] || 0) + 1;
  }

  return NextResponse.json({
    events: page.map((r) => ({
      id: r.id,
      agencyId: r.agency_id,
      travellerId: r.traveller_id,
      bookingRef: r.booking_ref,
      status: r.status,
      detail: r.detail,
      errorCode: r.error_code,
      durationMs: r.duration_ms,
      documentsAdded: r.documents_added,
      source: r.source,
      syncedAt: r.synced_at,
    })),
    nextBefore,
    stats: {
      total,
      success,
      partial,
      failed,
      successPct: total ? Math.round((success / total) * 100) : 100,
      failedByAgency,
    },
  });
}
