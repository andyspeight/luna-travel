/**
 * GET /api/cron/storage-cleanup — the deletion that actually deletes.
 *
 * Deleting a document sets deleted_at and leaves the file in the bucket. The
 * delete route has always said a cron would come along and remove it; it never
 * did, so in two years nothing has ever left storage. An agency deletes a
 * customer's insurance certificate, the app says done, and the file is still
 * sitting there for anyone with the service key.
 *
 * This is that cron. It removes two things and nothing else:
 *   - files whose document was soft-deleted longer ago than the grace period
 *   - files with no document row at all, old enough not to be a live upload
 *
 * Deliberately NOT under /api/admin, so the edge middleware (which wants a
 * tg_session) does not block the cron. Gated by CRON_SECRET, same as
 * /api/cron/sync and /api/cron/refresh-routes.
 *
 * ?dryRun=1 plans without deleting — which is how you look before you leap, and
 * how the first run of this should always be done. ?graceDays=N overrides the
 * window. Both need the secret.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAdmin } from '@/lib/supabase';
import { safeEqual } from '@/lib/constant-time';
import { logAuditEvent } from '@/lib/audit';
import {
  planCleanup,
  describePlan,
  DEFAULTS,
  type StoredObject,
  type DocumentRow,
} from '@/lib/storage-cleanup';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 120;

const BUCKET = 'luna-travel-documents';
const PAGE = 100;
/** agency / traveller / file. One more than needed, so a stray level is still seen. */
const MAX_DEPTH = 4;

interface ListedEntry {
  name: string;
  id: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  metadata?: { size?: number } | null;
}

/**
 * Walk the bucket.
 *
 * Supabase's list() is one level at a time and paginated, and a folder comes
 * back with a null id. Anything that is not a folder is a file.
 */
async function listAll(
  supabase: ReturnType<typeof getSupabaseAdmin>,
  prefix = '',
  depth = 0,
): Promise<StoredObject[]> {
  if (depth >= MAX_DEPTH) return [];

  const found: StoredObject[] = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage
      .from(BUCKET)
      .list(prefix, { limit: PAGE, offset, sortBy: { column: 'name', order: 'asc' } });

    // A failed listing must never be read as "this folder is empty" — that is
    // the difference between skipping a folder and deleting everything else.
    if (error) throw new Error(`list ${prefix || '/'}: ${error.message}`);

    const entries = (data || []) as ListedEntry[];
    for (const e of entries) {
      const path = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) {
        found.push(...(await listAll(supabase, path, depth + 1)));
      } else {
        found.push({
          path,
          createdAt: e.created_at || e.updated_at || new Date().toISOString(),
          sizeBytes: e.metadata?.size ?? 0,
        });
      }
    }

    if (entries.length < PAGE) break;
  }
  return found;
}

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

  const supabase = getSupabaseAdmin();

  // EVERY row, live and deleted alike. Filtering to the deleted ones here would
  // make every live document look like an orphan.
  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select('storage_path, deleted_at');

  // Abort rather than plan. An error is not "there are no documents", and the
  // two are indistinguishable by the time the planner sees an empty array.
  if (docErr) {
    console.error('[cron.storage-cleanup] could not read documents:', docErr.message);
    return NextResponse.json(
      { error: 'documents_unreadable', detail: 'Refusing to plan a deletion from an incomplete picture.' },
      { status: 500 },
    );
  }

  const documents: DocumentRow[] = (docs || []).map((d: { storage_path: string; deleted_at: string | null }) => ({
    storagePath: d.storage_path,
    deletedAt: d.deleted_at,
  }));

  let objects: StoredObject[];
  try {
    objects = await listAll(supabase);
  } catch (e) {
    console.error('[cron.storage-cleanup]', e instanceof Error ? e.message : e);
    return NextResponse.json(
      { error: 'bucket_unreadable', detail: 'Refusing to plan a deletion from a partial listing.' },
      { status: 500 },
    );
  }

  const plan = planCleanup(objects, documents, { graceDays });

  if (dryRun || plan.purge.length === 0) {
    const summary = describePlan(plan, true);
    console.log('[cron.storage-cleanup]', dryRun ? 'DRY RUN' : 'nothing to do', summary);
    return NextResponse.json({
      ok: true,
      dryRun,
      summary,
      graceDays,
      scanned: objects.length,
      documents: documents.length,
      ...plan,
    });
  }

  // Remove in one batch. Supabase treats a path that is already gone as a
  // success, so a half-finished previous run costs nothing to repeat.
  const paths = plan.purge.map((p) => p.path);
  const { error: rmErr } = await supabase.storage.from(BUCKET).remove(paths);
  if (rmErr) {
    console.error('[cron.storage-cleanup] remove failed:', rmErr.message);
    return NextResponse.json({ error: 'remove_failed', detail: rmErr.message }, { status: 500 });
  }

  const summary = describePlan(plan, false);
  console.log('[cron.storage-cleanup]', summary);

  // Worth an audit row: this is the only process in the system that destroys a
  // customer's file, and "when did that go" should have an answer.
  void logAuditEvent({
    eventType: 'storage.purged',
    actor: 'cron',
    targetId: BUCKET,
    targetLabel: summary,
    metadata: {
      graceDays,
      removed: plan.purge.length,
      bytes: plan.bytes,
      softDeleted: plan.purge.filter((p) => p.reason === 'soft-deleted').length,
      orphaned: plan.purge.filter((p) => p.reason === 'orphaned').length,
    },
  });

  return NextResponse.json({
    ok: true,
    dryRun: false,
    summary,
    graceDays,
    scanned: objects.length,
    documents: documents.length,
    ...plan,
  });
}
