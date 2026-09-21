/**
 * The retention job, from the admin panel instead of a terminal.
 *
 *   GET   preview — reports what would go, touches nothing
 *   POST  apply   — actually removes it
 *
 * Two verbs on purpose. A preview must be impossible to trigger destructively
 * by accident: a stray GET, a browser prefetch, a refresh, somebody pasting the
 * URL. Only an explicit POST removes anything.
 *
 * The work is shared with /api/cron/storage-cleanup via
 * lib/storage-cleanup-run.ts, so the button and the weekly schedule cannot
 * disagree about what is safe to remove.
 *
 * Admin-gated by src/middleware.ts, which covers /api/admin/*, and again here.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-session';
import { logAuditEvent } from '@/lib/audit';
import { DEFAULTS } from '@/lib/storage-cleanup';
import { runStorageCleanup, auditMetadata, BUCKET } from '@/lib/storage-cleanup-run';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

function graceFrom(req: NextRequest): number | null {
  const raw = new URL(req.url).searchParams.get('graceDays');
  if (raw === null) return DEFAULTS.graceDays;
  const n = Number(raw);
  return Number.isFinite(n) && n >= 0 ? n : null;
}

/** Preview. Never removes anything, whatever the query string says. */
export async function GET(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const graceDays = graceFrom(req);
  if (graceDays === null) return NextResponse.json({ error: 'invalid_graceDays' }, { status: 400 });

  const result = await runStorageCleanup({ dryRun: true, graceDays });
  return NextResponse.json(result, { status: result.ok ? 200 : 500 });
}

/** Apply. The only way anything is removed from this endpoint. */
export async function POST(req: NextRequest) {
  const claims = await requireAdmin(req as unknown as Request);
  if (!claims) return NextResponse.json({ error: 'unauthorised' }, { status: 401 });

  const graceDays = graceFrom(req);
  if (graceDays === null) return NextResponse.json({ error: 'invalid_graceDays' }, { status: 400 });

  const result = await runStorageCleanup({ dryRun: false, graceDays });
  if (!result.ok) return NextResponse.json(result, { status: 500 });

  // Awaited, not fire-and-forget. For this one operation the trail is part of
  // the deliverable: files are gone, and "we cannot tell you when" is worth
  // saying out loud rather than discovering months later.
  //
  // Named, unlike the scheduled run. If a person removed a customer's file by
  // hand, the audit trail should say which person.
  const audited =
    result.purge.length === 0 ||
    (await logAuditEvent({
      eventType: 'storage.purged',
      actor: claims.email || 'admin',
      targetId: BUCKET,
      targetLabel: result.summary,
      metadata: { ...auditMetadata(result), via: 'admin' },
    }));

  return NextResponse.json({ ...result, audited });
}
