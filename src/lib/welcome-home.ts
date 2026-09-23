/**
 * "Welcome home" — the one notification a traveller gets once the trip is over.
 *
 * A comment in the review screen once said a Welcome-home push sent travellers
 * there. None was ever built, so the portal's Reviews page could only fill from
 * someone who happened to open the app after their holiday. The home screen now
 * asks too (components/post-trip), but only a traveller who opens the app sees
 * that; this is what reminds them it is there.
 *
 * The rules, in the order they bite:
 *
 *   ONCE. welcome_home_sent_at is claimed before the send, so a second run the
 *   same day — the scheduler and a manual trigger together — cannot notify
 *   twice.
 *
 *   AFTER THEY ARE HOME. From the day after the return date, not on it: a
 *   return date is the day they travel, and "welcome home" while somebody is
 *   still in the departure lounge is worse than saying nothing.
 *
 *   NOT MONTHS LATER. Only within a week of the return. Without a cap, the
 *   first run would greet everyone who had ever come back from anything,
 *   however long ago.
 *
 *   NOT TO SOMEONE WHO HAS ALREADY SAID. A traveller who left a review from the
 *   home screen has answered the question this notification asks.
 *
 * It names neither the agency nor the place, and says nothing it cannot stand
 * behind. A Travelify agency's name lives in Control and comes back only with
 * a full order fetch, which a daily job has no business making for a greeting;
 * "your travel agent" is never wrong, and the screen it opens names the agency
 * and says the answer goes to them alone. The place is left out because
 * travellers.destination holds whatever the booking carried — often an airport
 * ("Cairo Intl. (CAI)"), not somewhere you would ask anybody about.
 */

import type { PushPayload } from '@/lib/push';

/** The first day it may go: the day after the return date. */
export const SEND_FROM_DAYS = 1;
/** The last day it may go. After this the moment has passed. */
export const SEND_UNTIL_DAYS = 7;

const DAY = 86_400_000;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Whole calendar days from the return date to today, in UTC.
 *
 * The job runs at 09:00 UTC, which is the same calendar day in the UK all year,
 * so there is no evening-before edge to reason about. Returns null for anything
 * that is not a plain date, rather than guessing.
 */
export function daysSinceReturn(returnDate: string | null | undefined, now: number): number | null {
  if (typeof returnDate !== 'string' || !ISO_DATE.test(returnDate)) return null;
  const back = Date.parse(`${returnDate}T00:00:00Z`);
  if (!Number.isFinite(back)) return null;
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  return Math.round((today - back) / DAY);
}

export interface WelcomeHomeCandidate {
  returnDate: string | null;
  sentAt: string | null;
  status: string | null;
  /** Whether this traveller has already left a review for the booking. */
  reviewed: boolean;
}

/** Send, or not. Pure, so every rule above can be argued with in a test. */
export function dueForWelcomeHome(t: WelcomeHomeCandidate, now: number = Date.now()): boolean {
  if (t.sentAt) return false;
  if (t.status !== 'active') return false;
  if (t.reviewed) return false;
  const d = daysSinceReturn(t.returnDate, now);
  if (d === null) return false;
  return d >= SEND_FROM_DAYS && d <= SEND_UNTIL_DAYS;
}

/**
 * The return dates that can be due today, oldest first — so the database is
 * asked for a week of travellers rather than every one it holds.
 */
export function returnDateWindow(now: number = Date.now()): { from: string; to: string } {
  const today = Date.parse(`${new Date(now).toISOString().slice(0, 10)}T00:00:00Z`);
  const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10);
  return { from: iso(today - SEND_UNTIL_DAYS * DAY), to: iso(today - SEND_FROM_DAYS * DAY) };
}

/**
 * What it says. English only: the server does not know a traveller's language,
 * and the screen it opens is translated.
 */
export const WELCOME_HOME: PushPayload = {
  title: 'Welcome home',
  body: 'Hope it was a good trip. Tell your travel agent how it went — it only takes a minute.',
  url: '/review',
  tag: 'welcome-home',
};
