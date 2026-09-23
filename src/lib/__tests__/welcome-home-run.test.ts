import { describe, it, expect, vi } from 'vitest';

// The real deps import the database and web-push; neither is used here.
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => ({}) }));
vi.mock('@/lib/push', () => ({ isPushConfigured: () => true, sendPushToTraveller: vi.fn() }));

const { runWelcomeHome } = await import('@/lib/welcome-home-run');
type Deps = Parameters<typeof runWelcomeHome>[1] & object;
type Row = Awaited<ReturnType<Deps['loadReturns']>>[number];

/**
 * The run, with the database and the push service faked. What is asserted is
 * the order of things — claim before send, give the claim back if nothing
 * arrived — because that is what stops a traveller being told twice.
 */

const NOW = Date.parse('2026-09-23T09:00:00Z');

function row(id: string, over: Partial<Row> = {}): Row {
  return {
    id,
    booking_ref: `REF-${id}`,
    return_date: '2026-09-22',
    status: 'active',
    welcome_home_sent_at: null,
    ...over,
  };
}

function fakes(rows: Row[], over: Partial<Deps> = {}) {
  const claimed = new Map<string, string>();
  const calls: string[] = [];
  const deps: Deps = {
    pushConfigured: () => true,
    loadReturns: async () => rows,
    reviewed: async () => new Set(),
    withDevice: async (ids) => new Set(ids),
    claim: async (id, at) => {
      calls.push(`claim ${id}`);
      if (claimed.has(id)) return false;
      claimed.set(id, at);
      return true;
    },
    release: async (id) => {
      calls.push(`release ${id}`);
      claimed.delete(id);
    },
    send: async (id) => {
      calls.push(`send ${id}`);
      return { sent: 1, removed: 0 };
    },
    ...over,
  };
  return { deps, claimed, calls };
}

describe('runWelcomeHome', () => {
  it('greets everybody home this week, once each, claiming before it sends', async () => {
    const { deps, calls, claimed } = fakes([row('a'), row('b')]);
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.ok).toBe(true);
    expect(r.greeted.sort()).toEqual(['REF-a', 'REF-b']);
    expect(calls.indexOf('claim a')).toBeLessThan(calls.indexOf('send a'));
    expect([...claimed.keys()].sort()).toEqual(['a', 'b']);
  });

  it('sends nothing on a dry run, and claims nothing', async () => {
    const { deps, calls } = fakes([row('a')]);
    const r = await runWelcomeHome({ now: NOW, dryRun: true }, deps);
    expect(r.greeted).toEqual(['REF-a']);
    expect(calls).toEqual([]);
  });

  it('does not send twice when two runs overlap', async () => {
    const { deps, calls } = fakes([row('a')]);
    await Promise.all([runWelcomeHome({ now: NOW }, deps), runWelcomeHome({ now: NOW }, deps)]);
    expect(calls.filter((c) => c === 'send a')).toHaveLength(1);
  });

  it('gives the claim back when no device took it, so tomorrow can try', async () => {
    const { deps, claimed, calls } = fakes([row('a')], {
      send: async () => ({ sent: 0, removed: 1 }),
    });
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.greeted).toEqual([]);
    expect(r.undelivered).toBe(1);
    expect(calls).toContain('release a');
    expect(claimed.has('a')).toBe(false);
  });

  it('does not ask somebody who has already reviewed', async () => {
    const { deps, calls } = fakes([row('a'), row('b')], { reviewed: async () => new Set(['a']) });
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.greeted).toEqual(['REF-b']);
    expect(r.alreadyReviewed).toBe(1);
    expect(calls).not.toContain('claim a');
  });

  // Claiming somebody with nowhere to send would mark them greeted and lose
  // them for good if they installed the app tomorrow.
  it('leaves travellers with no device unclaimed', async () => {
    const { deps, calls } = fakes([row('a'), row('b')], { withDevice: async () => new Set(['b']) });
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.greeted).toEqual(['REF-b']);
    expect(r.noDevice).toBe(1);
    expect(calls).not.toContain('claim a');
  });

  // The database is asked for the window, but the tested rule has the last
  // word — a query that drifted wide would not start greeting last spring.
  it('applies the rule even to rows the query should not have returned', async () => {
    const { deps } = fakes([
      row('may', { return_date: '2026-05-23' }),
      row('today', { return_date: '2026-09-23' }),
      row('sent', { welcome_home_sent_at: '2026-09-22T09:00:00Z' }),
      row('archived', { status: 'archived' }),
      row('ok'),
    ]);
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.greeted).toEqual(['REF-ok']);
    expect(r.considered).toBe(1);
  });

  it('asks the database for the right week', async () => {
    const loadReturns = vi.fn(async () => [] as Row[]);
    const { deps } = fakes([], { loadReturns });
    await runWelcomeHome({ now: NOW }, deps);
    expect(loadReturns).toHaveBeenCalledWith({ from: '2026-09-16', to: '2026-09-22' });
  });

  it('refuses to run with no push keys rather than claiming and releasing everyone', async () => {
    const { deps, calls } = fakes([row('a')], { pushConfigured: () => false });
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('push_not_configured');
    expect(calls).toEqual([]);
  });

  it('reports a database failure instead of pretending nobody came home', async () => {
    const { deps } = fakes([], {
      loadReturns: async () => {
        throw new Error('connection reset');
      },
    });
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.ok).toBe(false);
    expect(r.error).toBe('connection reset');
    // The log line is what somebody reads; it must not look like a quiet day.
    expect(r.summary).toMatch(/^FAILED \(connection reset\)/);
  });

  it('keeps going past more than one batch', async () => {
    const rows = Array.from({ length: 23 }, (_, i) => row(String(i)));
    const { deps } = fakes(rows);
    const r = await runWelcomeHome({ now: NOW }, deps);
    expect(r.greeted).toHaveLength(23);
  });
});
