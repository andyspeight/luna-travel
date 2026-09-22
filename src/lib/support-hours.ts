/**
 * When the agency is actually there.
 *
 * The review's sixth point: a traveller needs to know when somebody will
 * answer, not just a phone number. The app had the number and nothing else, so
 * a family standing in an airport at 6am had no way to tell whether they were
 * about to be helped in two minutes or three hours.
 *
 * Two rules run through all of this.
 *
 * SAY NOTHING RATHER THAN GUESS. An agency that has not set its hours gets no
 * hours shown — not "9 to 5", not "closed". An invented opening time is worse
 * than none, because somebody plans around it.
 *
 * THE HOURS ARE THE AGENCY'S, THE TRAVELLER IS SOMEWHERE ELSE. A Maldives
 * traveller reading "opens at 9:00" will assume their own morning. So the
 * agency's timezone is carried through and named, the same way the flight
 * screen says which airport a time belongs to.
 */

/** One day's opening. `day` is 0 = Sunday, matching Date#getDay. */
export interface OpeningDay {
  day: number;
  /** "HH:MM", 24-hour, in the agency's own timezone. */
  open: string;
  close: string;
}

export interface SupportHours {
  /** IANA zone the hours are stated in, e.g. "Europe/London". */
  timezone: string;
  /** Days the agency is open. A day that is absent is a day they are closed. */
  days: OpeningDay[];
}

export type SupportState =
  /** No hours set. The screen shows contact details and no claim about timing. */
  | { kind: 'unknown' }
  | { kind: 'open'; closesAt: string; zoneLabel: string }
  | { kind: 'closed'; opensAt: string; opensWhen: string; zoneLabel: string };

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const SHORT_TO_INDEX: Record<string, number> = {
  Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6,
};

/** "HH:MM" to minutes past midnight, or NaN. */
export function toMinutes(hhmm: string): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(hhmm || '').trim());
  if (!m) return NaN;
  const h = Number(m[1]);
  const min = Number(m[2]);
  if (h > 23 || min > 59) return NaN;
  return h * 60 + min;
}

const pad = (n: number) => String(n).padStart(2, '0');
const fromMinutes = (mins: number) => `${pad(Math.floor(mins / 60) % 24)}:${pad(mins % 60)}`;

/** Where the clock stands in the agency's own timezone. */
function zoned(now: Date, timezone: string): { day: number; minutes: number } | null {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).formatToParts(now);
    const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
    const day = SHORT_TO_INDEX[get('weekday')];
    const hour = Number(get('hour'));
    const minute = Number(get('minute'));
    if (day === undefined || !Number.isFinite(hour) || !Number.isFinite(minute)) return null;
    // Some locales render midnight as 24.
    return { day, minutes: (hour % 24) * 60 + minute };
  } catch {
    // An unusable timezone is a reason to say nothing, not to assume London.
    return null;
  }
}

/** "GMT", "BST", "GMT+4" — whatever the zone calls itself right now. */
function zoneLabelFor(now: Date, timezone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      timeZoneName: 'short',
    }).formatToParts(now);
    return parts.find((p) => p.type === 'timeZoneName')?.value ?? '';
  } catch {
    return '';
  }
}

/** Valid, de-duplicated opening days, keyed by weekday. */
function byDay(hours: SupportHours): Map<number, { open: number; close: number }> {
  const out = new Map<number, { open: number; close: number }>();
  for (const d of hours.days || []) {
    if (!Number.isInteger(d.day) || d.day < 0 || d.day > 6) continue;
    const open = toMinutes(d.open);
    const close = toMinutes(d.close);
    if (!Number.isFinite(open) || !Number.isFinite(close) || open === close) continue;
    out.set(d.day, { open, close });
  }
  return out;
}

/**
 * Open or closed, and when that changes.
 *
 * A closing time earlier than its opening time means the desk runs past
 * midnight, which is how an out-of-hours line is usually written.
 */
export function supportState(hours: SupportHours | undefined | null, now: Date = new Date()): SupportState {
  if (!hours || !hours.timezone || !Array.isArray(hours.days) || hours.days.length === 0) {
    return { kind: 'unknown' };
  }

  const days = byDay(hours);
  if (days.size === 0) return { kind: 'unknown' };

  const here = zoned(now, hours.timezone);
  if (!here) return { kind: 'unknown' };

  const zoneLabel = zoneLabelFor(now, hours.timezone);

  // Open right now? Check today, and yesterday for a session running past
  // midnight.
  const today = days.get(here.day);
  if (today) {
    const overnight = today.close < today.open;
    const openNow = overnight
      ? here.minutes >= today.open || here.minutes < today.close
      : here.minutes >= today.open && here.minutes < today.close;
    if (openNow) {
      return { kind: 'open', closesAt: fromMinutes(today.close), zoneLabel };
    }
  }
  const yesterday = days.get((here.day + 6) % 7);
  if (yesterday && yesterday.close < yesterday.open && here.minutes < yesterday.close) {
    return { kind: 'open', closesAt: fromMinutes(yesterday.close), zoneLabel };
  }

  // Closed. Find the next opening, starting with later today.
  if (today && here.minutes < today.open) {
    return { kind: 'closed', opensAt: fromMinutes(today.open), opensWhen: 'today', zoneLabel };
  }
  for (let ahead = 1; ahead <= 7; ahead++) {
    const idx = (here.day + ahead) % 7;
    const d = days.get(idx);
    if (!d) continue;
    return {
      kind: 'closed',
      opensAt: fromMinutes(d.open),
      opensWhen: ahead === 1 ? 'tomorrow' : DAY_NAMES[idx],
      zoneLabel,
    };
  }

  return { kind: 'unknown' };
}

/**
 * The one line a traveller reads.
 *
 * Always carries the timezone when it names a time, because the reader is
 * usually in a different one and "opens at 9:00" otherwise means their 9:00.
 */
export function supportLabel(state: SupportState): string | null {
  const zone = (s: string) => (s ? ` ${s}` : '');
  switch (state.kind) {
    case 'open':
      return `Open now · until ${state.closesAt}${zone(state.zoneLabel)}`;
    case 'closed':
      return state.opensWhen === 'today'
        ? `Closed · opens at ${state.opensAt}${zone(state.zoneLabel)}`
        : `Closed · opens ${state.opensWhen} at ${state.opensAt}${zone(state.zoneLabel)}`;
    default:
      return null;
  }
}

/** Weekday-name ordering for an editor, Monday first as the UK reads it. */
export const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
export const DAY_LABEL = DAY_NAMES;
