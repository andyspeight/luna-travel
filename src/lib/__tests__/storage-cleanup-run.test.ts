import { describe, it, expect, vi, beforeEach } from 'vitest';

/**
 * The planner is tested next door, in storage-cleanup.test.ts. This tests the
 * half that actually deletes — specifically, that nothing reaches `remove()`
 * that should not.
 *
 * A correct plan is worthless if the runner acts on a preview, or plans from a
 * failed query. Those are the two ways this becomes a data-loss incident, and
 * neither is visible from the pure logic.
 */

const remove = vi.fn(async (_paths: string[]) => ({ error: null as { message: string } | null }));
let docsResponse: { data: unknown[] | null; error: { message: string } | null };
let listResponse: { data: unknown[] | null; error: { message: string } | null };

vi.mock('@/lib/supabase', () => ({
  getSupabaseAdmin: () => ({
    from: () => ({ select: async () => docsResponse }),
    storage: {
      from: () => ({
        // One flat folder is enough; the recursion is not what is under test.
        list: async (prefix: string) => (prefix === '' ? listResponse : { data: [], error: null }),
        remove,
      }),
    },
  }),
}));

const { runStorageCleanup } = await import('@/lib/storage-cleanup-run');

const OLD = new Date(Date.now() - 100 * 86_400_000).toISOString();

const file = (name: string, created = OLD, size = 1000) => ({
  name,
  id: `id-${name}`,
  created_at: created,
  metadata: { size },
});

beforeEach(() => {
  remove.mockClear();
  remove.mockResolvedValue({ error: null });
  docsResponse = { data: [], error: null };
  listResponse = { data: [file('orphan.pdf')], error: null };
});

describe('a preview never removes anything', () => {
  it('reports what would go without touching it', async () => {
    const r = await runStorageCleanup({ dryRun: true });

    expect(remove).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.dryRun).toBe(true);
    expect(r.purge).toHaveLength(1);
    expect(r.summary).toMatch(/^Would remove/);
  });
});

describe('a failed read aborts rather than plans', () => {
  // The catastrophic case: the documents query errors, every file looks
  // orphaned, and a naive runner clears the bucket.
  it('refuses when the documents table cannot be read', async () => {
    docsResponse = { data: null, error: { message: 'connection reset' } };

    const r = await runStorageCleanup({ dryRun: false });

    expect(remove).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.error).toBe('documents_unreadable');
    expect(r.summary).toMatch(/Nothing was removed/i);
  });

  it('refuses when the bucket cannot be listed', async () => {
    listResponse = { data: null, error: { message: 'timeout' } };

    const r = await runStorageCleanup({ dryRun: false });

    expect(remove).not.toHaveBeenCalled();
    expect(r.ok).toBe(false);
    expect(r.error).toBe('bucket_unreadable');
  });
});

describe('a live run', () => {
  it('removes exactly the planned paths and nothing else', async () => {
    listResponse = {
      data: [file('orphan.pdf'), file('keep.pdf'), file('fresh.pdf', new Date().toISOString())],
      error: null,
    };
    docsResponse = { data: [{ storage_path: 'keep.pdf', deleted_at: null }], error: null };

    const r = await runStorageCleanup({ dryRun: false });

    expect(remove).toHaveBeenCalledTimes(1);
    // keep.pdf is live; fresh.pdf has no row but arrived moments ago.
    expect(remove.mock.calls[0][0]).toEqual(['orphan.pdf']);
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/^Removed/);
  });

  it('does not call remove at all when there is nothing to remove', async () => {
    docsResponse = { data: [{ storage_path: 'orphan.pdf', deleted_at: null }], error: null };

    const r = await runStorageCleanup({ dryRun: false });

    expect(remove).not.toHaveBeenCalled();
    expect(r.ok).toBe(true);
    expect(r.summary).toMatch(/Nothing to remove/);
  });

  it('reports a failed removal rather than claiming success', async () => {
    remove.mockResolvedValue({ error: { message: 'storage unavailable' } });

    const r = await runStorageCleanup({ dryRun: false });

    expect(r.ok).toBe(false);
    expect(r.error).toBe('remove_failed');
  });
});

describe('the grace period reaches the planner', () => {
  it('spares a soft-deleted file inside the window and takes it outside', async () => {
    listResponse = { data: [file('x.pdf')], error: null };
    docsResponse = {
      data: [{ storage_path: 'x.pdf', deleted_at: new Date(Date.now() - 10 * 86_400_000).toISOString() }],
      error: null,
    };

    expect((await runStorageCleanup({ dryRun: true, graceDays: 30 })).purge).toHaveLength(0);
    expect((await runStorageCleanup({ dryRun: true, graceDays: 7 })).purge).toHaveLength(1);
    expect(remove).not.toHaveBeenCalled();
  });
});

/**
 * The audit trail is part of this operation's deliverable, not a side effect.
 * It used to fail silently; three event types went unrecorded for months and
 * nobody could have noticed.
 */
describe('logAuditEvent reports whether it wrote', () => {
  it('returns false rather than throwing when the insert is rejected', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseAdmin: () => ({
        from: () => ({ insert: async () => ({ error: { message: 'invalid input value for enum' } }) }),
      }),
    }));
    const { logAuditEvent } = await import('@/lib/audit');

    await expect(
      logAuditEvent({ eventType: 'storage.purged', actor: 'test' }),
    ).resolves.toBe(false);
  });

  it('returns true on a clean write', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseAdmin: () => ({ from: () => ({ insert: async () => ({ error: null }) }) }),
    }));
    const { logAuditEvent } = await import('@/lib/audit');

    await expect(
      logAuditEvent({ eventType: 'storage.purged', actor: 'test' }),
    ).resolves.toBe(true);
  });

  it('returns false rather than throwing when the client itself blows up', async () => {
    vi.resetModules();
    vi.doMock('@/lib/supabase', () => ({
      getSupabaseAdmin: () => { throw new Error('SUPABASE_URL is not set'); },
    }));
    const { logAuditEvent } = await import('@/lib/audit');

    await expect(
      logAuditEvent({ eventType: 'storage.purged', actor: 'test' }),
    ).resolves.toBe(false);
  });
});
