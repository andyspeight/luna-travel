import { describe, it, expect } from 'vitest';
import {
  planCleanup,
  describePlan,
  humanBytes,
  DEFAULTS,
  type StoredObject,
  type DocumentRow,
} from '@/lib/storage-cleanup';

/**
 * This cron deletes customers' files. The tests that matter are the ones about
 * what it must NOT delete.
 */

const NOW = new Date('2026-09-20T12:00:00Z');
const daysAgo = (n: number) => new Date(NOW.getTime() - n * 86_400_000).toISOString();
const hoursAgo = (n: number) => new Date(NOW.getTime() - n * 3_600_000).toISOString();

const obj = (path: string, createdAt = daysAgo(100), sizeBytes = 1000): StoredObject => ({
  path,
  createdAt,
  sizeBytes,
});
const live = (storagePath: string): DocumentRow => ({ storagePath, deletedAt: null });
const deleted = (storagePath: string, when: string): DocumentRow => ({ storagePath, deletedAt: when });

const plan = (objects: StoredObject[], docs: DocumentRow[]) =>
  planCleanup(objects, docs, { now: NOW });

describe('what it must never touch', () => {
  it('never purges a file a live document points at', () => {
    const p = plan([obj('a/b/insurance.pdf')], [live('a/b/insurance.pdf')]);
    expect(p.purge).toEqual([]);
    expect(p.kept).toBe(1);
  });

  it('keeps a live document however old the file is', () => {
    const p = plan([obj('a/b/old.pdf', daysAgo(3000))], [live('a/b/old.pdf')]);
    expect(p.purge).toEqual([]);
  });

  // Soft delete promises an agency can undo a mistake. Purging on day one
  // would make that promise a lie.
  it('leaves a recently deleted document alone', () => {
    const p = plan([obj('a/b/x.pdf')], [deleted('a/b/x.pdf', daysAgo(1))]);
    expect(p.purge).toEqual([]);
  });

  it('still leaves it alone on the day before the grace period ends', () => {
    const p = plan([obj('a/b/x.pdf')], [deleted('a/b/x.pdf', daysAgo(DEFAULTS.graceDays - 1))]);
    expect(p.purge).toEqual([]);
  });

  // Upload writes the object first and the row second. A file with no row may
  // be a document that arrived seconds ago.
  it('does not mistake an upload in flight for an abandoned file', () => {
    const p = plan([obj('a/b/just-arrived.pdf', hoursAgo(1))], []);
    expect(p.purge).toEqual([]);
    expect(p.kept).toBe(1);
  });

  it('keeps a file whose timestamp it cannot read, rather than guessing', () => {
    const p = plan([obj('a/b/x.pdf', 'not-a-date')], []);
    expect(p.purge).toEqual([]);
  });

  // The rule that would be easiest to get backwards, and worst to get wrong:
  // one deleted document must not take its neighbours with it.
  it('purges only the matching path, never the folder', () => {
    const p = plan(
      [obj('a/b/gone.pdf'), obj('a/b/kept.pdf'), obj('a/c/kept.pdf')],
      [deleted('a/b/gone.pdf', daysAgo(90)), live('a/b/kept.pdf'), live('a/c/kept.pdf')],
    );
    expect(p.purge.map((x) => x.path)).toEqual(['a/b/gone.pdf']);
    expect(p.kept).toBe(2);
  });
});

describe('what it does remove', () => {
  it('purges a document deleted longer ago than the grace period', () => {
    const p = plan([obj('a/b/x.pdf')], [deleted('a/b/x.pdf', daysAgo(DEFAULTS.graceDays + 1))]);
    expect(p.purge).toEqual([{ path: 'a/b/x.pdf', reason: 'soft-deleted', sizeBytes: 1000 }]);
  });

  it('purges a file with no row once it is old enough to be abandoned', () => {
    const p = plan([obj('a/b/orphan.pdf', daysAgo(5))], []);
    expect(p.purge).toEqual([{ path: 'a/b/orphan.pdf', reason: 'orphaned', sizeBytes: 1000 }]);
  });

  it('adds up what it frees', () => {
    const p = plan(
      [obj('a/b/1.pdf', daysAgo(5), 2048), obj('a/b/2.pdf', daysAgo(5), 1024)],
      [],
    );
    expect(p.bytes).toBe(3072);
  });

  it('honours a grace period the caller chooses', () => {
    const objects = [obj('a/b/x.pdf')];
    const docs = [deleted('a/b/x.pdf', daysAgo(10))];
    expect(planCleanup(objects, docs, { now: NOW, graceDays: 30 }).purge).toHaveLength(0);
    expect(planCleanup(objects, docs, { now: NOW, graceDays: 7 }).purge).toHaveLength(1);
  });
});

describe('the blast radius', () => {
  const many = Array.from({ length: 250 }, (_, i) => obj(`a/b/${i}.pdf`, daysAgo(5)));

  it('caps how much one run can delete', () => {
    const p = planCleanup(many, [], { now: NOW });
    expect(p.purge).toHaveLength(DEFAULTS.maxPerRun);
    expect(p.capped).toBe(true);
  });

  // A capped run must not quietly look like a clean one.
  it('says so, loudly, when it capped', () => {
    const p = planCleanup(many, [], { now: NOW });
    expect(p.notes.join(' ')).toMatch(/something is wrong|check before/i);
    expect(p.notes.join(' ')).toContain('250');
  });

  it('counts the ones it skipped as kept, so the numbers still add up', () => {
    const p = planCleanup(many, [], { now: NOW });
    expect(p.purge.length + p.kept).toBe(250);
  });

  it('does not cap a run that is within the limit', () => {
    const p = planCleanup(many.slice(0, 10), [], { now: NOW });
    expect(p.capped).toBe(false);
    expect(p.notes).toEqual([]);
  });
});

describe('describePlan', () => {
  it('distinguishes what it would do from what it did', () => {
    const p = plan([obj('a/b/x.pdf', daysAgo(5))], []);
    expect(describePlan(p, true)).toMatch(/^Would remove/);
    expect(describePlan(p, false)).toMatch(/^Removed/);
  });

  it('separates the two reasons, because they mean different things', () => {
    const p = plan(
      [obj('a/b/x.pdf'), obj('a/b/y.pdf', daysAgo(5))],
      [deleted('a/b/x.pdf', daysAgo(90))],
    );
    const s = describePlan(p, true);
    expect(s).toMatch(/1 past the grace period/);
    expect(s).toMatch(/1 with no record at all/);
  });

  it('says plainly when there is nothing to do', () => {
    expect(describePlan(plan([obj('a/b/x.pdf')], [live('a/b/x.pdf')]), false)).toMatch(
      /Nothing to remove/,
    );
  });
});

describe('humanBytes', () => {
  it('reads like a size, not a number', () => {
    expect(humanBytes(500)).toBe('500 B');
    expect(humanBytes(2048)).toBe('2 KB');
    expect(humanBytes(2_000_000)).toBe('1.9 MB');
  });
});
