/**
 * Running the retention job.
 *
 * Split from storage-cleanup.ts so that file can stay pure and testable — the
 * judgements about what may be removed are worth pinning down without a
 * network anywhere near them. This half does the I/O: read the rows, walk the
 * bucket, then apply the plan or report it.
 *
 * Shared by two entry points that must never drift apart:
 *
 *   /api/cron/storage-cleanup   the weekly run, gated by CRON_SECRET
 *   /api/admin/storage-cleanup  the button, gated by an admin session
 *
 * One implementation because the alternative is a button that says one thing
 * and a schedule that does another, and the first anyone would know is a file
 * that went when nobody expected it.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import {
  planCleanup,
  describePlan,
  DEFAULTS,
  type StoredObject,
  type DocumentRow,
  type PurgeItem,
} from '@/lib/storage-cleanup';

export const BUCKET = 'luna-travel-documents';

const PAGE = 100;
/** agency / traveller / file. One more than needed, so a stray level is still seen. */
const MAX_DEPTH = 4;

export type RunError = 'documents_unreadable' | 'bucket_unreadable' | 'remove_failed';

export interface RunResult {
  ok: boolean;
  dryRun: boolean;
  summary: string;
  graceDays: number;
  /** Files found in the bucket. */
  scanned: number;
  /** Rows in the documents table, live and soft-deleted together. */
  documents: number;
  purge: PurgeItem[];
  kept: number;
  bytes: number;
  capped: boolean;
  notes: string[];
  error?: RunError;
  detail?: string;
}

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
    // the difference between skipping a folder and removing everything else.
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

function failure(error: RunError, detail: string, dryRun: boolean, graceDays: number): RunResult {
  return {
    ok: false,
    dryRun,
    summary: 'Could not run. Nothing was removed.',
    graceDays,
    scanned: 0,
    documents: 0,
    purge: [],
    kept: 0,
    bytes: 0,
    capped: false,
    notes: [],
    error,
    detail,
  };
}

export interface RunOptions {
  /** True reports the plan and touches nothing. */
  dryRun: boolean;
  graceDays?: number;
}

export async function runStorageCleanup(opts: RunOptions): Promise<RunResult> {
  const dryRun = opts.dryRun;
  const graceDays = opts.graceDays ?? DEFAULTS.graceDays;
  const supabase = getSupabaseAdmin();

  // EVERY row, live and soft-deleted alike. Filtering to the deleted ones here
  // would make every live document look like an orphan.
  const { data: docs, error: docErr } = await supabase
    .from('documents')
    .select('storage_path, deleted_at');

  // Abort rather than plan. A query error is not "there are no documents", and
  // the two are indistinguishable by the time the planner sees an empty array.
  if (docErr) {
    console.error('[storage-cleanup] could not read documents:', docErr.message);
    return failure(
      'documents_unreadable',
      'Refusing to plan from an incomplete picture of the documents table.',
      dryRun,
      graceDays,
    );
  }

  const documents: DocumentRow[] = (docs || []).map(
    (d: { storage_path: string; deleted_at: string | null }) => ({
      storagePath: d.storage_path,
      deletedAt: d.deleted_at,
    }),
  );

  let objects: StoredObject[];
  try {
    objects = await listAll(supabase);
  } catch (e) {
    console.error('[storage-cleanup]', e instanceof Error ? e.message : e);
    return failure(
      'bucket_unreadable',
      'Refusing to plan from a partial listing of the bucket.',
      dryRun,
      graceDays,
    );
  }

  const plan = planCleanup(objects, documents, { graceDays });
  const base = {
    graceDays,
    scanned: objects.length,
    documents: documents.length,
    ...plan,
  };

  if (dryRun || plan.purge.length === 0) {
    return { ok: true, dryRun, summary: describePlan(plan, true), ...base };
  }

  // Remove in one batch. Supabase treats a path that is already gone as a
  // success, so a half-finished previous run costs nothing to repeat.
  const { error: rmErr } = await supabase.storage
    .from(BUCKET)
    .remove(plan.purge.map((p) => p.path));

  if (rmErr) {
    console.error('[storage-cleanup] remove failed:', rmErr.message);
    return { ...failure('remove_failed', rmErr.message, dryRun, graceDays), ...base, ok: false };
  }

  return { ok: true, dryRun: false, summary: describePlan(plan, false), ...base };
}

/** The metadata an audit row should carry for a run that removed something. */
export function auditMetadata(result: RunResult) {
  return {
    graceDays: result.graceDays,
    removed: result.purge.length,
    bytes: result.bytes,
    softDeleted: result.purge.filter((p) => p.reason === 'soft-deleted').length,
    orphaned: result.purge.filter((p) => p.reason === 'orphaned').length,
  };
}
