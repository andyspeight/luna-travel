/**
 * GET /api/cron/storage-cleanup — the weekly retention run.
 *
 * Removing a document sets deleted_at and leaves the file in the bucket. The
 * delete route has always said a scheduled job would come along and finish the
 * work; it never existed, so nothing had ever left storage.
 *
 * Deliberately NOT under /api/admin, so the edge middleware (which wants a
 * tg_session) does not block the scheduler. Gated by CRON_SECRET, same as
 * /api/cron/sync and /api/cron/refresh-routes.
 *
 * ?dryRun=1 reports the plan without acting. ?graceDays=N overrides the window.
 * Both still need the secret.
 *
 * The work itself lives in lib/storage-cleanup-run.ts, shared with the admin
 * button at /api/admin/storage-cleanup — one implementation, because a button
 * that says one thing while the schedule does another is how a file goes
 * missing with nobody expecting it.
 */

import { NextRequest, NextResponse } from 'next/server';
import { safeEqual } from '@/lib/constant-time';
import { logAuditEvent } from '@/lib/audit';
import { DEFAULTS } from '@/lib/storage-cleanup';
import { runStorageCleanup, auditMetadata, BUCKET } from '@/lib/storage-cleanup-run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  const auth = req.headers.get('authorization') || '';
  if (!secret || !safeEqual(auth, `Bearer ${secret}`)) {
    return NextResponse.json({ error: 'unauthorised' }, { status: 401 });
  }

  const url = new URL(req.url);
  const dryRun = url.searchParams.get('dryRun') === '1';
  const graceRaw = url.searchParams.get('graceDays');
  const graceDays = graceRaw === null ? DEFAULTS.graceDays : Number(graceRaw);
  if (!Number.isFinite(graceDays) || graceDays < 0) {
    return NextResponse.json({ error: 'invalid_graceDays' }, { status: 400 });
  }

  const result = await runStorageCleanup({ dryRun, graceDays });
  console.log('[cron.storage-cleanup]', dryRun ? 'DRY RUN' : 'live', result.summary);

  if (!result.ok) {
    return NextResponse.json(result, { status: 500 });
  }

  // Worth an audit row: this is the only process that destroys a customer's
  // file, and "when did that go" should have an answer.
  if (!dryRun && result.purge.length > 0) {
    void logAuditEvent({
      eventType: 'storage.purged',
      actor: 'cron',
      targetId: BUCKET,
      targetLabel: result.summary,
      metadata: auditMetadata(result),
    });
  }

  return NextResponse.json(result);
}
