import { describe, expect, it } from 'vitest';
import {
  backfillWindows,
  carrierKey,
  carrierMatches,
  earliest,
  latest,
  mergeMonths,
  monthOf,
  normaliseMonths,
} from '@/lib/route-history';

describe('carrier matching — the false negative that started this', () => {
  // Luna told a Romanian customer that Wizz Air probably flew Cluj to Malaga
  // with a connection. They fly it direct. When we finally asked AeroDataBox,
  // the operator came back as Wizz Air MALTA (W4/WMT), not Wizz Air Hungary
  // (W6). So the obvious implementation — match the airline on its IATA code —
  // would have answered "not found" on the very first real query, about the
  // exact route that caused the complaint.
  const malta = { carrier_name: 'Wizz Air Malta', carrier_iata: 'W4', carrier_icao: 'WMT' };
  const hungary = { carrier_name: 'Wizz Air', carrier_iata: 'W6', carrier_icao: 'WZZ' };

  it('matches the brand across both air operator certificates', () => {
    expect(carrierMatches(malta, 'wizz')).toBe(true);
    expect(carrierMatches(hungary, 'wizz')).toBe(true);
  });

  it('a single code does NOT reach the other certificate', () => {
    // Not a bug, the point. It is why the name is matched as well.
    expect(carrierMatches(malta, 'W6')).toBe(false);
    expect(carrierMatches(hungary, 'W4')).toBe(false);
  });

  it('still matches an exact code when that is what was asked', () => {
    expect(carrierMatches(malta, 'W4')).toBe(true);
    expect(carrierMatches(malta, 'wmt')).toBe(true);
  });

  it('does not match a different airline', () => {
    expect(carrierMatches(malta, 'ryanair')).toBe(false);
    expect(carrierMatches(hungary, 'easyjet')).toBe(false);
  });

  it('an empty query matches nothing, rather than everything', () => {
    expect(carrierMatches(malta, '')).toBe(false);
    expect(carrierMatches(malta, '   ')).toBe(false);
  });

  it('keys a row on the name, so two certificates stay two rows', () => {
    expect(carrierKey({ name: 'Wizz Air Malta', iata: 'W4', icao: 'WMT' })).toBe('wizz air malta');
    expect(carrierKey({ name: 'Wizz Air', iata: 'W6', icao: 'WZZ' })).toBe('wizz air');
    expect(carrierKey({ name: 'Wizz Air Malta', iata: 'W4' })).not.toBe(
      carrierKey({ name: 'Wizz Air', iata: 'W6' }),
    );
  });

  it('falls back to a code only when the provider sends no name', () => {
    expect(carrierKey({ name: '', iata: 'W4', icao: 'WMT' })).toBe('w4');
    expect(carrierKey({ name: null, iata: null, icao: 'WMT' })).toBe('wmt');
    expect(carrierKey({})).toBe('');
  });
});

describe('months accumulate and are never forgotten', () => {
  // This is the whole reason for accumulating rather than asking once. A ski
  // charter asked about in July is invisible to a seven-day window, and a
  // January sighting is the only thing that can answer it.
  it('records a first sighting', () => {
    expect(mergeMonths(undefined, 7)).toEqual([7]);
    expect(mergeMonths(null, 7)).toEqual([7]);
  });

  it('adds a month without dropping the ones already known', () => {
    expect(mergeMonths([7], 1)).toEqual([1, 7]);
    expect(mergeMonths([1, 7], 12)).toEqual([1, 7, 12]);
  });

  it('is idempotent, so a repeated sweep changes nothing', () => {
    expect(mergeMonths([1, 7], 7)).toEqual([1, 7]);
  });

  it('comes back sorted, not in insertion order', () => {
    expect(mergeMonths([12, 2], 6)).toEqual([2, 6, 12]);
  });

  it('throws away anything that is not a month', () => {
    expect(mergeMonths([0, 13, 'x', null, 3], 5)).toEqual([3, 5]);
    expect(mergeMonths([3], 0)).toEqual([3]);
    expect(mergeMonths([3], 13)).toEqual([3]);
  });

  it('normalises without adding, for the read path', () => {
    expect(normaliseMonths([5, 5, 2])).toEqual([2, 5]);
    expect(normaliseMonths('not an array')).toEqual([]);
    expect(normaliseMonths(undefined)).toEqual([]);
  });
});

describe('the backfill walks backwards, so the two dates move independently', () => {
  // first_seen_on has to be draggable EARLIER by a backfill, without the same
  // pass dragging last_seen_on back with it. Getting this wrong corrupts every
  // row silently, and nothing would complain.
  it('a backfill pulls first_seen_on earlier', () => {
    expect(earliest('2026-09-15', '2026-01-15')).toBe('2026-01-15');
  });

  it('...and leaves last_seen_on where it was', () => {
    expect(latest('2026-09-15', '2026-01-15')).toBe('2026-09-15');
  });

  it('a weekly sweep pushes last_seen_on forward', () => {
    expect(latest('2026-09-08', '2026-09-15')).toBe('2026-09-15');
  });

  it('...and leaves first_seen_on where it was', () => {
    expect(earliest('2026-01-15', '2026-09-15')).toBe('2026-01-15');
  });

  it('a brand new row takes the sweep date for both', () => {
    expect(earliest(null, '2026-09-15')).toBe('2026-09-15');
    expect(latest(undefined, '2026-09-15')).toBe('2026-09-15');
  });
});

describe('monthOf', () => {
  it('reads the month from a stored date', () => {
    expect(monthOf('2026-02-03')).toBe(2);
    expect(monthOf('2026-12-31')).toBe(12);
    expect(monthOf('2026-01-01')).toBe(1);
  });
});

describe('backfillWindows', () => {
  const from = '2026-09-15';

  it('returns one window per month, newest first', () => {
    const w = backfillWindows(3, from);
    expect(w).toEqual(['2026-08-15', '2026-07-15', '2026-06-15']);
  });

  it('never includes the current month, because the weekly sweep covers it', () => {
    expect(backfillWindows(12, from)).not.toContain('2026-09-15');
  });

  it('crosses the year boundary correctly', () => {
    const w = backfillWindows(12, from);
    expect(w).toHaveLength(12);
    expect(w[w.length - 1]).toBe('2025-09-15');
    expect(w).toContain('2025-12-15');
    expect(w).toContain('2026-01-15');
  });

  it('covers all twelve calendar months exactly once over a year', () => {
    const months = backfillWindows(12, from).map((d) => monthOf(d)).sort((a, b) => a - b);
    expect(months).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12]);
  });

  it('uses the 15th, so a month end cannot push a window into the wrong month', () => {
    // Asking from the 31st with naive date maths lands on the 31st of a month
    // that has 30 days, which Date rolls forward into the next one.
    const w = backfillWindows(4, '2026-03-31');
    expect(w).toEqual(['2026-02-15', '2026-01-15', '2025-12-15', '2025-11-15']);
    expect(w.map(monthOf)).toEqual([2, 1, 12, 11]);
  });

  it('is stable, so re-running a backfill overwrites the same windows', () => {
    expect(backfillWindows(6, from)).toEqual(backfillWindows(6, from));
  });

  it('asks for nothing when asked for nothing', () => {
    expect(backfillWindows(0, from)).toEqual([]);
  });
});
