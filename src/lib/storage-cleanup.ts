/**
 * Deciding which stored files are safe to delete.
 *
 * Deleting a document has always been a soft delete: the row gets a deleted_at
 * and the file stays in the bucket. The route that does it says so in its own
 * comment — "storage cleanup happens via a separate cron later (not built
 * yet)". It was never built, so nothing has ever been removed from storage.
 *
 * That is not a tidiness problem. An agency deletes a customer's insurance
 * certificate or passport scan, the app says done, and the file is still there
 * — indefinitely, for anyone holding the service key. A deletion that does not
 * delete is the kind of thing you want to find before a customer asks you to
 * erase their data, not after.
 *
 * So: a planner, separate from the deleting, because the interesting part is
 * the judgement and the judgement is what needs pinning down. Every rule below
 * exists to stop this cron destroying a document somebody still wants.
 */

export interface StoredObject {
  /** Full path within the bucket, e.g. "recABC/uuid/uuid_insurance.pdf". */
  path: string;
  createdAt: string;
  sizeBytes: number;
}

export interface DocumentRow {
  storagePath: string;
  /** null for a live document. */
  deletedAt: string | null;
}

export type PurgeReason = 'soft-deleted' | 'orphaned';

export interface PurgeItem {
  path: string;
  reason: PurgeReason;
  sizeBytes: number;
}

export interface CleanupPlan {
  purge: PurgeItem[];
  /** Objects deliberately left alone. */
  kept: number;
  bytes: number;
  /** True when the cap cut the list short, so the caller knows to run again. */
  capped: boolean;
  notes: string[];
}

export interface CleanupOptions {
  now?: Date;
  /**
   * How long a soft-deleted document keeps its file.
   *
   * Soft delete exists so an agency that deletes the wrong thing can get it
   * back. Purging immediately would make that promise a lie. Thirty days is
   * long enough to notice a mistake and short enough that "deleted" eventually
   * means deleted.
   */
  graceDays?: number;
  /**
   * How old a file with no row at all must be before it counts as abandoned.
   *
   * Upload writes the object first and the row second. A file with no row might
   * be rubbish from a crashed upload — or a document that arrived four seconds
   * ago and whose row is still in flight. Deleting the second kind would
   * destroy a customer's document at the exact moment it was given to us.
   */
  orphanGraceHours?: number;
  /** Blast radius per run. A runaway should be survivable and obvious. */
  maxPerRun?: number;
}

const DAY_MS = 24 * 60 * 60 * 1000;

export const DEFAULTS = {
  graceDays: 30,
  orphanGraceHours: 24,
  maxPerRun: 200,
} as const;

function ageMs(iso: string, now: Date): number {
  const t = new Date(iso).getTime();
  // An unparseable date is treated as brand new, so it is kept. Getting this
  // backwards would delete files whose timestamps we failed to read.
  if (Number.isNaN(t)) return 0;
  return now.getTime() - t;
}

/**
 * Work out what can go.
 *
 * `documents` must be EVERY row for the objects in question, live and
 * soft-deleted alike. Passing a filtered list — say, only the deleted ones —
 * would make every live document look orphaned. The caller must also never
 * pass an empty list because a query failed: to this function, "no rows" and
 * "could not read the rows" are indistinguishable, and one of them means
 * delete everything.
 */
export function planCleanup(
  objects: StoredObject[],
  documents: DocumentRow[],
  opts: CleanupOptions = {},
): CleanupPlan {
  const now = opts.now ?? new Date();
  const graceDays = opts.graceDays ?? DEFAULTS.graceDays;
  const orphanGraceHours = opts.orphanGraceHours ?? DEFAULTS.orphanGraceHours;
  const maxPerRun = opts.maxPerRun ?? DEFAULTS.maxPerRun;

  const byPath = new Map<string, DocumentRow>();
  for (const d of documents) byPath.set(d.storagePath, d);

  const purge: PurgeItem[] = [];
  let kept = 0;

  for (const obj of objects) {
    const row = byPath.get(obj.path);

    // A live document. Never, under any circumstances.
    if (row && !row.deletedAt) {
      kept++;
      continue;
    }

    if (row && row.deletedAt) {
      if (ageMs(row.deletedAt, now) >= graceDays * DAY_MS) {
        purge.push({ path: obj.path, reason: 'soft-deleted', sizeBytes: obj.sizeBytes });
      } else {
        kept++;
      }
      continue;
    }

    // No row at all.
    if (ageMs(obj.createdAt, now) >= orphanGraceHours * 60 * 60 * 1000) {
      purge.push({ path: obj.path, reason: 'orphaned', sizeBytes: obj.sizeBytes });
    } else {
      kept++;
    }
  }

  const notes: string[] = [];
  const capped = purge.length > maxPerRun;
  const finalPurge = capped ? purge.slice(0, maxPerRun) : purge;
  if (capped) {
    notes.push(
      `Capped at ${maxPerRun} of ${purge.length}. Either there is a genuine backlog, or something is wrong — check before running it again.`,
    );
  }

  return {
    purge: finalPurge,
    kept: kept + (capped ? purge.length - maxPerRun : 0),
    bytes: finalPurge.reduce((n, p) => n + p.sizeBytes, 0),
    capped,
    notes,
  };
}

/** Bytes as something a human reads without counting zeros. */
export function humanBytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${Math.round(n / 1024)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

/** One line an operator can read in a log or a dashboard. */
export function describePlan(plan: CleanupPlan, dryRun: boolean): string {
  if (plan.purge.length === 0) {
    return `Nothing to remove. ${plan.kept} file${plan.kept === 1 ? '' : 's'} kept.`;
  }
  const deleted = plan.purge.filter((p) => p.reason === 'soft-deleted').length;
  const orphans = plan.purge.filter((p) => p.reason === 'orphaned').length;
  const parts: string[] = [];
  if (deleted) parts.push(`${deleted} past the grace period`);
  if (orphans) parts.push(`${orphans} with no record at all`);
  return `${dryRun ? 'Would remove' : 'Removed'} ${plan.purge.length} file${
    plan.purge.length === 1 ? '' : 's'
  } (${parts.join(', ')}), freeing ${humanBytes(plan.bytes)}. ${plan.kept} kept.`;
}
