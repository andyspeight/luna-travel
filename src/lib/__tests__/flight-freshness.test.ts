import { describe, it, expect } from 'vitest';
import { describeFreshness } from '@/lib/flight-freshness';

/**
 * The rule under all of these: the sentence must carry an age or a reason.
 * A status word with neither looks current whatever its age, and somebody
 * reads it standing under a departure board.
 */

const now = new Date('2026-11-27T09:00:00Z').getTime();
const ago = (mins: number) => new Date(now - mins * 60_000).toISOString();

const d = (over: Partial<Parameters<typeof describeFreshness>[0]> = {}) =>
  describeFreshness({ live: { lastUpdated: ago(5) }, online: true, now, ...over });

describe('a recent reading', () => {
  it('says when it was taken, not merely that it is current', () => {
    expect(d().text).toBe('Updated 08:55');
    expect(d().tone).toBe('plain');
    expect(d().canRefresh).toBe(true);
  });
});

describe('an old reading', () => {
  // The review's example. The app fetches once per mount and never again, so
  // by the time somebody is at the gate this can be hours old.
  it('is flagged rather than left to pass as current', () => {
    const r = d({ live: { lastUpdated: ago(180) } });
    expect(r.text).toBe('Last updated 06:00');
    expect(r.tone).toBe('warn');
  });

  // It used to say "checking again" while nothing was checking.
  it('does not claim the app is doing something it is not', () => {
    expect(d({ live: { lastUpdated: ago(180) } }).text).not.toMatch(/checking/i);
  });
});

describe('offline', () => {
  it('carries the age, which is the whole point of the state', () => {
    const r = d({ online: false, live: { lastUpdated: ago(180) } });
    expect(r.text).toBe('Offline · last updated 06:00');
    expect(r.tone).toBe('warn');
  });

  it('says so plainly when it never got one', () => {
    expect(d({ online: false, live: null }).text).toBe('Offline · not updated yet');
  });

  // With no signal the age cannot change. A button that cannot work is worse
  // than no button.
  it('offers no refresh it could not honour', () => {
    expect(d({ online: false }).canRefresh).toBe(false);
  });
});

describe('a refresh that failed', () => {
  it('says so and still gives the age of what is on screen', () => {
    const r = d({ failed: true, live: { lastUpdated: ago(180) } });
    expect(r.text).toBe('Could not check just now · last updated 06:00');
    expect(r.tone).toBe('warn');
    expect(r.canRefresh).toBe(true);
  });
});

describe('while checking', () => {
  it('says only that, so the press has visible effect', () => {
    expect(d({ checking: true }).text).toBe('Checking now…');
    expect(d({ checking: true }).canRefresh).toBe(false);
  });

  // Whatever else is true, a press must not look ignored.
  it('beats every other state', () => {
    expect(d({ checking: true, failed: true, online: false }).text).toBe('Checking now…');
  });
});

describe('a flight the feed does not carry', () => {
  it('says the tracking is unavailable rather than staying silent', () => {
    const r = d({ live: null });
    expect(r.text).toBe('Live updates not available for this flight');
    expect(r.tone).toBe('plain');
  });

  it('offers no refresh, because there is nothing to fetch', () => {
    expect(d({ live: null }).canRefresh).toBe(false);
  });
});

describe('a flight being watched that has not reported yet', () => {
  // A row exists, so the tracking works — it simply has nothing yet. Saying
  // "not available" here would be wrong in the other direction.
  it('distinguishes that from not being tracked at all', () => {
    const r = d({ live: { lastUpdated: null } });
    expect(r.text).toBe('Waiting for the first update');
    expect(r.canRefresh).toBe(true);
  });

  it('treats an unreadable timestamp the same way', () => {
    expect(d({ live: { lastUpdated: 'not-a-date' } }).text).toBe('Waiting for the first update');
  });
});

describe('every state', () => {
  // The one property that must hold everywhere: never a bare status.
  it('names an age or a reason, always', () => {
    const cases = [
      d(),
      d({ live: { lastUpdated: ago(180) } }),
      d({ online: false }),
      d({ online: false, live: null }),
      d({ failed: true }),
      d({ checking: true }),
      d({ live: null }),
      d({ live: { lastUpdated: null } }),
    ];
    for (const c of cases) {
      expect(c.text.length).toBeGreaterThan(0);
      expect(/\d{2}:\d{2}|not available|Waiting|Checking|not updated|Could not/.test(c.text)).toBe(
        true,
      );
    }
  });
});
