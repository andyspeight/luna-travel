/**
 * Whether to ask a traveller how their trip went.
 *
 * The review screen existed and the agency portal had a page to read reviews
 * on, but nothing ever sent a traveller there: no link, no push, no scheduled
 * job. A comment claimed a "Welcome home" notification did it; none was ever
 * built. So the portal's Reviews page could only fill from somebody who typed
 * /review into their browser by hand.
 *
 * The request now sits on the home screen once the trip is over, and the
 * review's other ask is honoured with it: it can be dismissed, and it stops
 * asking once answered.
 */

/** How the traveller has responded to being asked, on this device. */
export type FeedbackState = 'open' | 'dismissed' | 'sent';

/**
 * How long after the trip it is still worth asking.
 *
 * Long enough for somebody who comes home to a week of catching up, short
 * enough that nobody opens the app for next summer's trip and is asked about
 * last year's.
 */
export const ASK_FOR_DAYS = 60;

const DAY = 86_400_000;

/**
 * Ask, or not. Pure, so the rule can be argued with in a test.
 *
 * Only once the trip has ended, only within the window, and never again once
 * the traveller has either answered or said not now — asking twice after "not
 * now" is how a helpful prompt becomes a nag.
 */
export function shouldAskForFeedback(input: {
  tripEnd: string | undefined | null;
  state: FeedbackState;
  now?: number;
}): boolean {
  const { tripEnd, state, now = Date.now() } = input;
  if (state !== 'open') return false;
  const end = tripEnd ? new Date(tripEnd).getTime() : NaN;
  if (!Number.isFinite(end)) return false;
  if (now <= end) return false;
  return now - end <= ASK_FOR_DAYS * DAY;
}

const key = (ref: string) => `lt.feedback.${ref}`;

/**
 * What this device remembers about the request for one booking.
 *
 * Browser storage is right for this and only this: it is a per-device
 * courtesy — not asking again once somebody said no — and losing it merely
 * means the card reappears. The review itself is stored server-side. Private
 * windows and blocked storage throw on access, which reads as "open".
 */
export function readFeedback(ref: string): FeedbackState {
  if (!ref) return 'open';
  try {
    const v = window.localStorage.getItem(key(ref));
    return v === 'dismissed' || v === 'sent' ? v : 'open';
  } catch {
    return 'open';
  }
}

export function writeFeedback(ref: string, state: Exclude<FeedbackState, 'open'>): void {
  if (!ref) return;
  try {
    window.localStorage.setItem(key(ref), state);
  } catch {
    /* storage unavailable — the card simply comes back next time */
  }
}
