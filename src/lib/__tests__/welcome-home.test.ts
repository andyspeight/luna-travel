import { describe, it, expect } from 'vitest';
import {
  dueForWelcomeHome,
  daysSinceReturn,
  returnDateWindow,
  SEND_FROM_DAYS,
  SEND_UNTIL_DAYS,
  WELCOME_HOME,
} from '@/lib/welcome-home';

/**
 * When "Welcome home" goes. The ways to get it wrong are all ways to annoy a
 * traveller: too early, too late, twice, or asking somebody who already said.
 */

// The job runs at 09:00 UTC.
const at = (date: string) => Date.parse(`${date}T09:00:00Z`);
const active = { sentAt: null, status: 'active', reviewed: false };

describe('dueForWelcomeHome', () => {
  it('does not greet anyone on the day they travel home', () => {
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-09-22' }, at('2026-09-22'))).toBe(false);
  });

  it('does not greet anyone before the trip is over', () => {
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-12-19' }, at('2026-09-23'))).toBe(false);
  });

  it('greets them the day after, and through the week', () => {
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-09-22' }, at('2026-09-23'))).toBe(true);
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-09-22' }, at('2026-09-29'))).toBe(true);
  });

  // The first run would otherwise greet everybody who ever came home.
  it('stops once the week is over', () => {
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-09-22' }, at('2026-09-30'))).toBe(false);
    expect(dueForWelcomeHome({ ...active, returnDate: '2026-05-23' }, at('2026-09-23'))).toBe(false);
  });

  it('goes once', () => {
    expect(
      dueForWelcomeHome({ ...active, sentAt: '2026-09-23T09:00:00Z', returnDate: '2026-09-22' }, at('2026-09-24')),
    ).toBe(false);
  });

  it('does not ask somebody who has already left a review', () => {
    expect(dueForWelcomeHome({ ...active, reviewed: true, returnDate: '2026-09-22' }, at('2026-09-23'))).toBe(false);
  });

  it('leaves archived travellers alone', () => {
    expect(dueForWelcomeHome({ ...active, status: 'archived', returnDate: '2026-09-22' }, at('2026-09-23'))).toBe(false);
    expect(dueForWelcomeHome({ ...active, status: null, returnDate: '2026-09-22' }, at('2026-09-23'))).toBe(false);
  });

  it('says nothing when it cannot tell when they came home', () => {
    for (const returnDate of [null, '', 'soon', '2026-9-22', '2026-09-22T10:00:00Z']) {
      expect(dueForWelcomeHome({ ...active, returnDate }, at('2026-09-23')), String(returnDate)).toBe(false);
    }
  });
});

describe('daysSinceReturn', () => {
  it('counts calendar days, whatever the time of day', () => {
    expect(daysSinceReturn('2026-09-22', Date.parse('2026-09-23T00:00:01Z'))).toBe(1);
    expect(daysSinceReturn('2026-09-22', Date.parse('2026-09-23T23:59:59Z'))).toBe(1);
  });

  // The clocks change in the UK on the last Sunday of October. Counting in
  // UTC dates means the week is still seven days across it.
  it('is not thrown by the clocks changing', () => {
    expect(daysSinceReturn('2026-10-22', at('2026-10-29'))).toBe(7);
  });
});

describe('returnDateWindow', () => {
  it('asks the database for exactly the dates that can be due', () => {
    expect(returnDateWindow(at('2026-09-23'))).toEqual({ from: '2026-09-16', to: '2026-09-22' });
  });

  it('agrees with the rule at both ends', () => {
    const now = at('2026-09-23');
    const { from, to } = returnDateWindow(now);
    expect(daysSinceReturn(from, now)).toBe(SEND_UNTIL_DAYS);
    expect(daysSinceReturn(to, now)).toBe(SEND_FROM_DAYS);
    expect(dueForWelcomeHome({ ...active, returnDate: from }, now)).toBe(true);
    expect(dueForWelcomeHome({ ...active, returnDate: to }, now)).toBe(true);
  });
});

describe('what it says', () => {
  it('opens the review screen', () => {
    expect(WELCOME_HOME.url).toBe('/review');
  });

  // A repeat must replace, not stack, and it is not an alarm.
  it('collapses repeats and does not buzz like a gate change', () => {
    expect(WELCOME_HOME.tag).toBe('welcome-home');
    expect(WELCOME_HOME.urgent).toBeFalsy();
  });

  // It is drawn under the platform's name, not the agency's, and the server
  // cannot name the agency for every booking — so it must not pretend to.
  it('says who the answer goes to without naming anybody it cannot vouch for', () => {
    expect(WELCOME_HOME.body).toMatch(/your travel agent/i);
    expect(WELCOME_HOME.body).not.toMatch(/\{|\}|we /i);
  });

  it('fits on a lock screen', () => {
    expect(WELCOME_HOME.title.length).toBeLessThanOrEqual(40);
    expect(WELCOME_HOME.body.length).toBeLessThanOrEqual(120);
  });
});
