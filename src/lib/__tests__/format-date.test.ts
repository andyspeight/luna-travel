import { describe, it, expect } from 'vitest';
import { formatDate, formatDayMonth, formatWeekday } from '@/lib/format';

/**
 * These look like cosmetic assertions. They are not.
 *
 * Asked for a short weekday alongside a date, with the same locale and the
 * same options, Node renders "Fri 27 Nov" and Chromium renders "Fri, 27 Nov".
 * Every screen showing a weekday is server-rendered and then hydrated, so
 * React found the two disagreeing and threw the whole tree away to re-render
 * it — the flight, hotel, experience, extra and itinerary screens, every
 * visit, as an uncaught error in the console.
 *
 * So the output must not depend on whose ICU is asked, and these pin the
 * exact strings that differed.
 */

const DEP = '2026-11-27T20:15:00Z';

describe('a weekday alongside a date', () => {
  // THE bug. Chromium put a comma here and Node did not.
  it('is composed rather than left to the engine', () => {
    expect(formatDate(DEP, { weekday: 'short', day: 'numeric', month: 'short' })).toBe(
      'Fri 27 Nov',
    );
  });

  it('never contains the comma the two engines disagreed about', () => {
    const variants = [
      { weekday: 'short', day: 'numeric', month: 'short' },
      { weekday: 'long', day: 'numeric', month: 'long' },
      { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' },
      { weekday: 'long', day: 'numeric', month: 'short' },
    ] as const;
    for (const v of variants) {
      expect(formatDate(DEP, v)).not.toContain(',');
    }
  });

  it('reads correctly in full', () => {
    expect(formatDate(DEP, { weekday: 'long', day: 'numeric', month: 'long' })).toBe(
      'Friday 27 November',
    );
  });

  it('gives the weekday alone when that is all that was asked for', () => {
    expect(formatDate(DEP, { weekday: 'short' })).toBe('Fri');
    expect(formatWeekday(DEP)).toBe('Fri');
  });
});

describe('a date with no weekday', () => {
  // Untouched by the fix, and worth pinning so it stays that way.
  it('is unchanged', () => {
    expect(formatDayMonth(DEP)).toBe('27 Nov');
    expect(formatDate(DEP)).toBe('27 Nov 2026');
    expect(formatDate(DEP, { day: 'numeric', month: 'long' })).toBe('27 November');
  });
});

describe('nonsense in', () => {
  it('gives an empty string rather than "Invalid Date" on a screen', () => {
    expect(formatDate('')).toBe('');
    expect(formatDate('not-a-date')).toBe('');
    expect(formatDate('not-a-date', { weekday: 'short', day: 'numeric' })).toBe('');
  });
});
