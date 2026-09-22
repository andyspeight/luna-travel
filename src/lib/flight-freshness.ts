/**
 * What to say about how current a flight status is.
 *
 * The review's fourth point, and the one worth being pedantic about: a status
 * word on its own looks current whatever its age. A traveller reading
 * "Departed" has no way of knowing whether that was true a minute ago or at
 * breakfast, and the app had no way of telling them — the flight screen
 * printed "Updated 09:12" when it happened to have a timestamp and said
 * nothing at all when it did not.
 *
 * Worse, the two screens disagreed. The travel-day card said "checking
 * again" while nothing was checking, because the live data is fetched once
 * when the screen mounts and never again. A sentence that describes work the
 * app is not doing is the same class of mistake as a gate nobody filed.
 *
 * So the sentence is decided here, once, for both screens, and the refresh is
 * a real button the traveller presses rather than a promise in prose.
 */

import { freshness } from '@/lib/trip-phase';

export type FreshnessTone = 'plain' | 'warn';

export interface FreshnessLine {
  /** The sentence. Always says how old, or why it cannot. */
  text: string;
  tone: FreshnessTone;
  /** Whether pressing refresh could actually change anything. */
  canRefresh: boolean;
}

export interface FreshnessInput {
  /** The live overlay for this leg, if the feed has one at all. */
  live?: { lastUpdated?: string | null } | null;
  online: boolean;
  /** A refresh is in flight right now. */
  checking?: boolean;
  /** The last attempt failed. */
  failed?: boolean;
  now?: number;
  staleAfterMinutes?: number;
}

/**
 * Order matters, and every branch names an age or a reason.
 *
 * Checking beats everything, because it is the one state the traveller has
 * just caused and expects to see. Offline comes next: with no signal the age
 * cannot change, so offering a refresh would be a button that cannot work.
 */
export function describeFreshness(input: FreshnessInput): FreshnessLine {
  const { live, online, checking = false, failed = false, now = Date.now() } = input;

  const stamp = live?.lastUpdated || undefined;
  const state = freshness(stamp, now, input.staleAfterMinutes);
  const at = state === 'none' ? null : formatStamp(stamp!);

  if (checking) {
    return { text: 'Checking now…', tone: 'plain', canRefresh: false };
  }

  if (!online) {
    return {
      text: at ? `Offline · last updated ${at}` : 'Offline · not updated yet',
      tone: 'warn',
      canRefresh: false,
    };
  }

  if (failed) {
    // Say which it is. "Couldn't check" with no age is the reassuring-word
    // problem all over again.
    return {
      text: at ? `Could not check just now · last updated ${at}` : 'Could not check just now',
      tone: 'warn',
      canRefresh: true,
    };
  }

  if (!live) {
    // No row in the feed for this leg. There is nothing to refresh, and a
    // button that cannot change anything is worse than no button.
    return {
      text: 'Live updates not available for this flight',
      tone: 'plain',
      canRefresh: false,
    };
  }

  if (state === 'none') {
    // The feed is watching this flight but has not reported yet. That is
    // worth saying plainly rather than implying the tracking is broken.
    return { text: 'Waiting for the first update', tone: 'plain', canRefresh: true };
  }

  if (state === 'stale') {
    return { text: `Last updated ${at}`, tone: 'warn', canRefresh: true };
  }

  return { text: `Updated ${at}`, tone: 'plain', canRefresh: true };
}

/**
 * The clock time, in the reader's own timezone.
 *
 * Deliberately not lib/format's formatTime: this stamp is when the app last
 * heard anything, which happened where the traveller is standing, not at the
 * airport being described.
 */
function formatStamp(iso: string): string | null {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return null;
  const d = new Date(t);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
