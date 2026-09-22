import { describe, it, expect } from 'vitest';
import { cleanOpeningDays, isTimezone, isEmail, MAX_REPLY_WITHIN } from '@/lib/agency-settings';

/**
 * What an agency types here is shown to travellers as a promise, so the
 * validation is the line between "we are open until 5:30" and a made-up
 * opening time somebody plans their airport run around.
 */

describe('cleanOpeningDays', () => {
  it('keeps a well-formed week', () => {
    const days = cleanOpeningDays([
      { day: 1, open: '09:00', close: '17:30' },
      { day: 2, open: '09:00', close: '17:30' },
    ]);
    expect(days).toHaveLength(2);
    expect(days[0]).toEqual({ day: 1, open: '09:00', close: '17:30' });
  });

  it('sorts, so the stored order does not depend on which box was ticked first', () => {
    const days = cleanOpeningDays([
      { day: 5, open: '09:00', close: '17:00' },
      { day: 1, open: '09:00', close: '17:00' },
    ]);
    expect(days.map((d) => d.day)).toEqual([1, 5]);
  });

  // Dropped rather than defaulted: a day nobody can parse is a day we do not
  // know about, and the app should be quiet about it.
  it('drops a day it cannot read instead of inventing one', () => {
    expect(cleanOpeningDays([{ day: 1, open: 'nine', close: 'five' }])).toEqual([]);
    expect(cleanOpeningDays([{ day: 1, open: '09:00' }])).toEqual([]);
    expect(cleanOpeningDays([{ day: 9, open: '09:00', close: '17:00' }])).toEqual([]);
    expect(cleanOpeningDays([{ day: -1, open: '09:00', close: '17:00' }])).toEqual([]);
  });

  it('drops a zero-length day, which means closed rather than open all day', () => {
    expect(cleanOpeningDays([{ day: 1, open: '09:00', close: '09:00' }])).toEqual([]);
  });

  it('keeps only the first of a duplicated day', () => {
    const days = cleanOpeningDays([
      { day: 1, open: '09:00', close: '12:00' },
      { day: 1, open: '13:00', close: '17:00' },
    ]);
    expect(days).toEqual([{ day: 1, open: '09:00', close: '12:00' }]);
  });

  it('survives anything at all coming back from the database', () => {
    for (const junk of [null, undefined, 'a string', 42, {}, [null], [{}], [[]]]) {
      expect(() => cleanOpeningDays(junk)).not.toThrow();
      expect(cleanOpeningDays(junk)).toEqual([]);
    }
  });
});

describe('isTimezone', () => {
  it('accepts zones this runtime can actually resolve', () => {
    expect(isTimezone('Europe/London')).toBe(true);
    expect(isTimezone('Asia/Dubai')).toBe(true);
    expect(isTimezone('  Europe/London  ')).toBe(true);
    expect(isTimezone('UTC')).toBe(true);
  });

  // The times are useless to somebody abroad without a zone to hang them on,
  // so a zone we cannot resolve has to fail rather than silently become UTC.
  it('refuses one it cannot', () => {
    expect(isTimezone('Somewhere/Else')).toBe(false);
    expect(isTimezone('GMT+1')).toBe(false);
    expect(isTimezone('')).toBe(false);
    expect(isTimezone(null)).toBe(false);
    expect(isTimezone(undefined)).toBe(false);
    expect(isTimezone(42)).toBe(false);
  });
});

describe('the reply promise', () => {
  it('is bounded, so it stays a promise rather than a paragraph', () => {
    expect(MAX_REPLY_WITHIN).toBeLessThanOrEqual(120);
    expect(MAX_REPLY_WITHIN).toBeGreaterThan(20);
  });
});

describe('isEmail', () => {
  it('still behaves as it did', () => {
    expect(isEmail('team@agency.co.uk')).toBe(true);
    expect(isEmail('not an email')).toBe(false);
    expect(isEmail(undefined)).toBe(false);
  });
});
