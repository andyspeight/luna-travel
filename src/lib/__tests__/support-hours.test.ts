import { describe, it, expect } from 'vitest';
import {
  supportState,
  supportLabel,
  toMinutes,
  type SupportHours,
} from '@/lib/support-hours';

/**
 * A traveller reads this to decide whether to wait or to ring the emergency
 * line. Getting it wrong either strands somebody or wakes somebody up.
 */

const weekdays = (open = '09:00', close = '17:30'): SupportHours => ({
  timezone: 'Europe/London',
  days: [1, 2, 3, 4, 5].map((day) => ({ day, open, close })),
});

const at = (iso: string) => new Date(iso);

describe('when the agency has not set its hours', () => {
  // The whole point: an invented opening time is worse than none, because
  // somebody plans around it.
  it('says nothing at all', () => {
    expect(supportState(undefined, at('2026-09-22T10:00:00Z')).kind).toBe('unknown');
    expect(supportState(null, at('2026-09-22T10:00:00Z')).kind).toBe('unknown');
    expect(supportLabel(supportState(undefined))).toBeNull();
  });

  it('says nothing for an empty or unusable set', () => {
    expect(supportState({ timezone: 'Europe/London', days: [] }).kind).toBe('unknown');
    expect(
      supportState({ timezone: 'Europe/London', days: [{ day: 1, open: 'x', close: 'y' }] }).kind,
    ).toBe('unknown');
    expect(supportState({ timezone: '', days: [{ day: 1, open: '09:00', close: '17:00' }] }).kind)
      .toBe('unknown');
  });

  it('says nothing rather than assuming London for a nonsense timezone', () => {
    const broken = { timezone: 'Not/AZone', days: [{ day: 1, open: '09:00', close: '17:00' }] };
    expect(supportState(broken, at('2026-09-21T10:00:00Z')).kind).toBe('unknown');
  });
});

describe('during opening hours', () => {
  it('says so, and when they close', () => {
    // Monday 10:00 UTC — British Summer Time, so 11:00 in London.
    const s = supportState(weekdays(), at('2026-09-21T10:00:00Z'));
    expect(s.kind).toBe('open');
    expect(supportLabel(s)).toMatch(/^Open now · until 17:30/);
  });

  it('is open on the minute they open and closed on the minute they close', () => {
    // 09:00 and 17:30 London, in September that is UTC+1.
    expect(supportState(weekdays(), at('2026-09-21T08:00:00Z')).kind).toBe('open');
    expect(supportState(weekdays(), at('2026-09-21T07:59:00Z')).kind).toBe('closed');
    expect(supportState(weekdays(), at('2026-09-21T16:29:00Z')).kind).toBe('open');
    expect(supportState(weekdays(), at('2026-09-21T16:30:00Z')).kind).toBe('closed');
  });
});

describe('outside opening hours', () => {
  it('gives the time they open later the same day', () => {
    // Monday 06:00 London.
    const s = supportState(weekdays(), at('2026-09-21T05:00:00Z'));
    expect(s).toMatchObject({ kind: 'closed', opensWhen: 'today', opensAt: '09:00' });
    expect(supportLabel(s)).toMatch(/^Closed · opens at 09:00/);
  });

  it('rolls to tomorrow once the day is over', () => {
    // Monday 19:00 London.
    const s = supportState(weekdays(), at('2026-09-21T18:00:00Z'));
    expect(s).toMatchObject({ kind: 'closed', opensWhen: 'tomorrow', opensAt: '09:00' });
  });

  // The weekend is where a static "Mon-Fri 9-5:30" leaves somebody guessing.
  it('names the day when it is more than a night away', () => {
    // Saturday afternoon.
    const s = supportState(weekdays(), at('2026-09-26T13:00:00Z'));
    expect(s).toMatchObject({ kind: 'closed', opensWhen: 'Monday', opensAt: '09:00' });
    expect(supportLabel(s)).toMatch(/^Closed · opens Monday at 09:00/);
  });

  it('still answers when the agency opens exactly one day a week', () => {
    const sundayOnly: SupportHours = {
      timezone: 'Europe/London',
      days: [{ day: 0, open: '10:00', close: '14:00' }],
    };
    expect(supportState(sundayOnly, at('2026-09-21T12:00:00Z'))).toMatchObject({
      kind: 'closed',
      opensWhen: 'Sunday',
    });
    expect(supportState(sundayOnly, at('2026-09-27T10:00:00Z')).kind).toBe('open');
  });
});

describe('the traveller is somewhere else', () => {
  // A Maldives traveller reading "opens at 09:00" will assume their morning,
  // which is five hours earlier than the agency's.
  it('names the timezone whenever it names a time', () => {
    const open = supportLabel(supportState(weekdays(), at('2026-09-21T10:00:00Z')));
    const closed = supportLabel(supportState(weekdays(), at('2026-09-21T05:00:00Z')));
    expect(open).toMatch(/BST|GMT/);
    expect(closed).toMatch(/BST|GMT/);
  });

  it('follows the agency into and out of daylight saving', () => {
    // 08:30 UTC is 09:30 London in summer (open) and 08:30 in winter (closed).
    expect(supportState(weekdays(), at('2026-07-06T08:30:00Z')).kind).toBe('open');
    expect(supportState(weekdays(), at('2026-01-05T08:30:00Z')).kind).toBe('closed');
  });

  it('works for an agency that is not in the UK', () => {
    const dubai: SupportHours = {
      timezone: 'Asia/Dubai',
      days: [{ day: 1, open: '09:00', close: '18:00' }],
    };
    // 07:00 UTC on a Monday is 11:00 in Dubai.
    expect(supportState(dubai, at('2026-09-21T07:00:00Z')).kind).toBe('open');
    // 03:00 UTC is 07:00 in Dubai — before they open.
    expect(supportState(dubai, at('2026-09-21T03:00:00Z'))).toMatchObject({
      kind: 'closed',
      opensWhen: 'today',
    });
  });
});

describe('a desk that runs past midnight', () => {
  // How an out-of-hours line is usually written, and the case a naive
  // open<=now<close comparison reports as permanently shut.
  const overnight: SupportHours = {
    timezone: 'Europe/London',
    days: [{ day: 5, open: '20:00', close: '02:00' }],
  };

  it('is open before midnight', () => {
    expect(supportState(overnight, at('2026-09-25T21:00:00Z')).kind).toBe('open');
  });

  it('is still open after midnight, on what is now the next day', () => {
    // 00:30 Saturday London, which is the Friday session still running.
    expect(supportState(overnight, at('2026-09-25T23:30:00Z')).kind).toBe('open');
  });

  it('is closed once it has actually ended', () => {
    expect(supportState(overnight, at('2026-09-26T02:00:00Z')).kind).toBe('closed');
  });
});

describe('toMinutes', () => {
  it('reads the times an editor will produce', () => {
    expect(toMinutes('09:00')).toBe(540);
    expect(toMinutes('9:05')).toBe(545);
    expect(toMinutes('00:00')).toBe(0);
    expect(toMinutes('23:59')).toBe(1439);
  });

  it('refuses what it cannot read rather than returning zero', () => {
    for (const bad of ['', '24:00', '12:60', 'noon', '9', '09:0']) {
      expect(Number.isNaN(toMinutes(bad)), bad).toBe(true);
    }
  });
});
