/**
 * The daily Welcome-home run: find who came home this week, and tell each of
 * them once.
 *
 * The rules live in lib/welcome-home; this is the plumbing around them, kept
 * apart from the route so it can be tested without a scheduler or a push
 * service. The database and the sender are passed in, and the defaults are the
 * real ones.
 *
 * Order matters, because the failure to avoid is a double send:
 *
 *   1. Load the week's returns, then drop anyone who has reviewed or has no
 *      device registered — there is nothing to wake.
 *   2. CLAIM the traveller (set welcome_home_sent_at where it is still null).
 *      Only the run that wins the claim sends, so the scheduler and a manual
 *      trigger overlapping cannot both notify.
 *   3. Send. If no device accepted it, give the claim back, so tomorrow's run
 *      tries again while the week lasts. A phone that is merely off still
 *      counts as accepted: the push service holds it for a day.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { isPushConfigured, sendPushToTraveller, type PushPayload } from '@/lib/push';
import { dueForWelcomeHome, returnDateWindow, WELCOME_HOME } from '@/lib/welcome-home';

export interface TravellerRow {
  id: string;
  booking_ref: string | null;
  return_date: string | null;
  status: string | null;
  welcome_home_sent_at: string | null;
}

export interface WelcomeHomeDeps {
  pushConfigured(): boolean;
  /** Active travellers whose return date falls in the window, not yet greeted. */
  loadReturns(window: { from: string; to: string }): Promise<TravellerRow[]>;
  /** Of these travellers, the ones who have left a review. */
  reviewed(ids: string[]): Promise<Set<string>>;
  /** Of these travellers, the ones with at least one device registered. */
  withDevice(ids: string[]): Promise<Set<string>>;
  /** Mark as sent if nobody else has. True if this run won. */
  claim(id: string, at: string): Promise<boolean>;
  /** Undo a claim that turned out to reach nobody. */
  release(id: string, at: string): Promise<void>;
  send(id: string, payload: PushPayload): Promise<{ sent: number; removed: number }>;
}

export interface WelcomeHomeResult {
  ok: boolean;
  dryRun: boolean;
  window: { from: string; to: string };
  /** Came home in the window and not yet greeted. */
  considered: number;
  /** Would have been asked, but have already left a review. */
  alreadyReviewed: number;
  /** Due, but with no device to send to. Tried again tomorrow. */
  noDevice: number;
  /** Booking refs this run sent to — or, on a dry run, would send to. */
  greeted: string[];
  /** Claimed, sent, and no device accepted it. Released for tomorrow. */
  undelivered: number;
  /** Lost the claim to an overlapping run. */
  skippedClaimed: number;
  error?: string;
  summary: string;
}

const CONCURRENCY = 10;

const DEFAULT_DEPS: WelcomeHomeDeps = {
  pushConfigured: isPushConfigured,

  async loadReturns({ from, to }) {
    const { data, error } = await getSupabaseAdmin()
      .from('travellers')
      .select('id, booking_ref, return_date, status, welcome_home_sent_at')
      .eq('status', 'active')
      .is('welcome_home_sent_at', null)
      .gte('return_date', from)
      .lte('return_date', to)
      .limit(2000);
    if (error) throw new Error(error.message);
    return (data ?? []) as TravellerRow[];
  },

  async reviewed(ids) {
    if (!ids.length) return new Set();
    const { data, error } = await getSupabaseAdmin()
      .from('reviews')
      .select('traveller_id')
      .in('traveller_id', ids);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => (r as { traveller_id: string }).traveller_id));
  },

  async withDevice(ids) {
    if (!ids.length) return new Set();
    const { data, error } = await getSupabaseAdmin()
      .from('push_subscriptions')
      .select('traveller_id')
      .in('traveller_id', ids);
    if (error) throw new Error(error.message);
    return new Set((data ?? []).map((r) => (r as { traveller_id: string }).traveller_id));
  },

  async claim(id, at) {
    const { data, error } = await getSupabaseAdmin()
      .from('travellers')
      .update({ welcome_home_sent_at: at })
      .eq('id', id)
      .is('welcome_home_sent_at', null)
      .select('id');
    if (error) {
      console.error('[welcome-home] claim failed', error.message);
      return false;
    }
    return (data ?? []).length === 1;
  },

  async release(id, at) {
    const { error } = await getSupabaseAdmin()
      .from('travellers')
      .update({ welcome_home_sent_at: null })
      .eq('id', id)
      .eq('welcome_home_sent_at', at);
    if (error) console.error('[welcome-home] release failed', error.message);
  },

  send: sendPushToTraveller,
};

export async function runWelcomeHome(
  opts: { dryRun?: boolean; now?: number } = {},
  deps: WelcomeHomeDeps = DEFAULT_DEPS,
): Promise<WelcomeHomeResult> {
  const dryRun = !!opts.dryRun;
  const now = opts.now ?? Date.now();
  const window = returnDateWindow(now);
  const result: WelcomeHomeResult = {
    ok: true,
    dryRun,
    window,
    considered: 0,
    alreadyReviewed: 0,
    noDevice: 0,
    greeted: [],
    undelivered: 0,
    skippedClaimed: 0,
    summary: '',
  };
  const finish = () => {
    result.summary =
      (result.error ? `FAILED (${result.error}) — ` : '') +
      `${dryRun ? 'would greet' : 'greeted'} ${result.greeted.length} of ${result.considered} ` +
      `home ${window.from}..${window.to}` +
      (result.alreadyReviewed ? `, ${result.alreadyReviewed} already reviewed` : '') +
      (result.noDevice ? `, ${result.noDevice} with no device` : '') +
      (result.undelivered ? `, ${result.undelivered} undelivered` : '') +
      (result.skippedClaimed ? `, ${result.skippedClaimed} claimed elsewhere` : '');
    return result;
  };

  // Without keys every send is a silent no-op, and every claim would be taken
  // and handed straight back. Say so instead.
  if (!dryRun && !deps.pushConfigured()) {
    result.ok = false;
    result.error = 'push_not_configured';
    return finish();
  }

  let rows: TravellerRow[];
  let reviewed: Set<string>;
  let reachable: Set<string>;
  try {
    rows = await deps.loadReturns(window);
    const ids = rows.map((r) => r.id);
    [reviewed, reachable] = await Promise.all([deps.reviewed(ids), deps.withDevice(ids)]);
  } catch (e) {
    result.ok = false;
    result.error = e instanceof Error ? e.message : 'load_failed';
    return finish();
  }

  // The query already narrows to the window; the rule is applied again so the
  // one tested definition of "due" is the one that decides. Asked twice so a
  // traveller who has already reviewed is counted rather than silently lost.
  const due: TravellerRow[] = [];
  for (const r of rows) {
    const base = { returnDate: r.return_date, sentAt: r.welcome_home_sent_at, status: r.status };
    if (!dueForWelcomeHome({ ...base, reviewed: false }, now)) continue;
    result.considered += 1;
    if (!dueForWelcomeHome({ ...base, reviewed: reviewed.has(r.id) }, now)) {
      result.alreadyReviewed += 1;
      continue;
    }
    if (!reachable.has(r.id)) {
      result.noDevice += 1;
      continue;
    }
    due.push(r);
  }

  if (dryRun) {
    result.greeted = due.map((r) => r.booking_ref || r.id);
    return finish();
  }

  const at = new Date(now).toISOString();
  const greet = async (r: TravellerRow) => {
    if (!(await deps.claim(r.id, at))) {
      result.skippedClaimed += 1;
      return;
    }
    const { sent } = await deps.send(r.id, WELCOME_HOME);
    if (sent > 0) {
      result.greeted.push(r.booking_ref || r.id);
    } else {
      result.undelivered += 1;
      await deps.release(r.id, at);
    }
  };

  // Ten at a time, as the agency broadcast does: one by one would run past the
  // function's time limit on a busy week, and all at once would open hundreds
  // of connections from a single invocation.
  for (let i = 0; i < due.length; i += CONCURRENCY) {
    await Promise.all(due.slice(i, i + CONCURRENCY).map(greet));
  }

  return finish();
}
