import { afterEach, describe, expect, it } from 'vitest';
import {
  classifyEvent,
  climateForTrip,
  parseClimateRow,
  parseClimateSeasons,
  parseMonthToken,
  splitEvents,
  tripMonths,
} from '@/lib/destination-dates';
import { orderToBooking, type TrimmedOrder } from '@/lib/order-to-booking';
import type { ClimateBand, PlaceEvent } from '@/types/destination-content';

function evt(name: string, monthLabel: string): PlaceEvent {
  return {
    name,
    description: '',
    monthLabel,
    months: parseMonthToken(monthLabel),
    tier: 'city',
    from: 'Orlando',
  };
}

describe('parseMonthToken — year-round', () => {
  // These were invisible until the parser understood them. An unreadable month
  // makes an event `undated`, and undated events are deliberately never
  // rendered — so a permanently-open attraction was the one thing guaranteed
  // never to appear in "what's on". 31 resorts and 37 cities write it this way.
  it.each(['Year-round', 'year round', 'Yearround', 'All year', 'all-year', 'throughout the year', 'any time', 'Anytime'])(
    'reads "%s" as every month',
    (token) => {
      expect(parseMonthToken(token)).toHaveLength(12);
      expect(parseMonthToken(token)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
    },
  );

  it('still rejects things it genuinely cannot read', () => {
    // The all-or-nothing rule holds: a token we can only half-read is reported
    // as undated rather than asserting the half we recognised.
    expect(parseMonthToken('Easter')).toEqual([]);
    expect(parseMonthToken('Varies')).toEqual([]);
    expect(parseMonthToken('Late summer')).toEqual([]);
    expect(parseMonthToken('')).toEqual([]);
  });

  it('does not mistake a real month for an all-year token', () => {
    expect(parseMonthToken('Jan')).toEqual([0]);
    expect(parseMonthToken('Mar-Apr')).toEqual([2, 3]);
  });
});

describe('parseMonthToken', () => {
  it('reads a single month', () => {
    expect(parseMonthToken('Oct')).toEqual([9]);
    expect(parseMonthToken('october')).toEqual([9]);
  });

  it('reads an adjacent pair', () => {
    expect(parseMonthToken('Nov-Dec')).toEqual([10, 11]);
  });

  it('reads a long run', () => {
    expect(parseMonthToken('May-Sep')).toEqual([4, 5, 6, 7, 8]);
  });

  it('wraps through December', () => {
    expect(parseMonthToken('Dec-Feb')).toEqual([11, 0, 1]);
  });

  it('accepts an en-dash', () => {
    expect(parseMonthToken('Nov–Dec')).toEqual([10, 11]);
  });

  it('returns nothing for junk', () => {
    expect(parseMonthToken('Summer')).toEqual([]);
    expect(parseMonthToken('')).toEqual([]);
    expect(parseMonthToken('all year round')).toEqual([]);
  });

  // An Events JSON month cell may be an ARRAY (["Oct","Nov"]), which the adapter
  // flattens to "Oct, Nov". Reading only the first segment deleted November.
  it('keeps every month of a comma or slash list', () => {
    expect(parseMonthToken('Oct, Nov')).toEqual([9, 10]);
    expect(parseMonthToken('Oct,Nov,Dec')).toEqual([9, 10, 11]);
    expect(parseMonthToken('May/Jun')).toEqual([4, 5]);
    expect(parseMonthToken('February, August')).toEqual([1, 7]);
  });

  it('expands a range inside a list, and never repeats a month', () => {
    expect(parseMonthToken('Sep-Oct, Dec')).toEqual([8, 9, 11]);
    expect(parseMonthToken('Oct, Oct')).toEqual([9]);
    expect(parseMonthToken('Nov-Dec, Dec')).toEqual([10, 11]);
  });

  it('reports a half-readable list as undated rather than guessing the half', () => {
    expect(parseMonthToken('Easter (Mar/Apr)')).toEqual([]);
    expect(parseMonthToken('Oct, late summer')).toEqual([]);
  });
});

describe('tripMonths', () => {
  it('spans the months a window touches', () => {
    expect(tripMonths('2026-11-28', '2026-12-03')).toEqual([10, 11]);
  });

  it('returns nothing without both dates', () => {
    expect(tripMonths('2026-11-28', undefined)).toEqual([]);
    expect(tripMonths(undefined, undefined)).toEqual([]);
  });

  it('returns all twelve for a year or more', () => {
    expect(tripMonths('2026-01-01', '2027-06-01')).toHaveLength(12);
  });
});

describe('classifyEvent', () => {
  it('separates during, overlaps and outside', () => {
    expect(classifyEvent([9], [9])).toBe('during');
    expect(classifyEvent([4, 5, 6, 7, 8], [5])).toBe('overlaps');
    expect(classifyEvent([9], [5])).toBe('outside');
    expect(classifyEvent([], [5])).toBe('outside');
  });
});

describe('splitEvents', () => {
  const events = [
    evt('Halloween Horror Nights', 'Sep-Oct'),
    evt('Epcot Festival of the Holidays', 'Nov-Dec'),
  ];

  it('an October trip sees Halloween Horror Nights and not the Holidays festival', () => {
    const { inWindow, yearRound } = splitEvents(events, '2026-10-10', '2026-10-17');
    expect(inWindow.map((e) => e.name)).toEqual(['Halloween Horror Nights']);
    expect(yearRound.map((e) => e.name)).toEqual(['Epcot Festival of the Holidays']);
  });

  it('a June trip sees neither, and neither is deleted', () => {
    const { inWindow, yearRound } = splitEvents(events, '2026-06-01', '2026-06-08');
    expect(inWindow).toHaveLength(0);
    expect(yearRound).toHaveLength(2);
  });

  it('a 28 Nov - 3 Dec trip sees the Nov-Dec festival', () => {
    const { inWindow } = splitEvents(events, '2026-11-28', '2026-12-03');
    expect(inWindow.map((e) => e.name)).toEqual(['Epcot Festival of the Holidays']);
  });

  it('an unparseable trip window puts everything in the year-round block', () => {
    const { inWindow, yearRound } = splitEvents(events, undefined, undefined);
    expect(inWindow).toHaveLength(0);
    expect(yearRound).toHaveLength(2);
  });

  // The multi-month regression: a November traveller must see a ["Oct","Nov"]
  // event as on, not filed away as happening at some other time of year.
  it('an event spanning a comma-listed pair of months is in window for either', () => {
    const multi = [evt('Epcot Festival of the Holidays', 'Nov, Dec')];
    expect(splitEvents(multi, '2026-11-10', '2026-11-17').inWindow).toHaveLength(1);
    expect(splitEvents(multi, '2026-12-10', '2026-12-17').inWindow).toHaveLength(1);
    expect(splitEvents(multi, '2026-06-01', '2026-06-08').otherTimes).toHaveLength(1);
  });

  // "Easter" / "Varies" never states a year-round run, so it must not be filed
  // under a heading that claims one.
  it('holds an unreadable month token back instead of calling it year-round', () => {
    const mixed = [
      evt('Halloween Horror Nights', 'Sep-Oct'),
      evt('Easter parade', 'Easter'),
      evt('Street food nights', 'Varies'),
      { ...evt('Harvest fair', ''), months: [] },
    ];
    const { inWindow, otherTimes, undated, yearRound } = splitEvents(
      mixed,
      '2026-06-01',
      '2026-06-08',
    );
    expect(inWindow).toHaveLength(0);
    expect(otherTimes.map((e) => e.name)).toEqual(['Halloween Horror Nights']);
    expect(undated.map((e) => e.name)).toEqual([
      'Easter parade',
      'Street food nights',
      'Harvest fair',
    ]);
    // The deprecated alias the old call sites still read must not carry them.
    expect(yearRound.map((e) => e.name)).toEqual(['Halloween Horror Nights']);
  });

  it('holds undated events back even when the trip window is unparseable', () => {
    const { inWindow, otherTimes, undated } = splitEvents(
      [evt('Halloween Horror Nights', 'Sep-Oct'), evt('Easter parade', 'Easter')],
      undefined,
      undefined,
    );
    expect(inWindow).toHaveLength(0);
    expect(otherTimes.map((e) => e.name)).toEqual(['Halloween Horror Nights']);
    expect(undated.map((e) => e.name)).toEqual(['Easter parade']);
  });

  it('keeps the most specific tier when two tiers name the same event', () => {
    const duplicated: PlaceEvent[] = [
      { ...evt('Halloween Horror Nights', 'Sep-Oct'), tier: 'resort', from: 'Orlando' },
      { ...evt('Halloween horror nights', 'Sep-Oct'), tier: 'country', from: 'USA' },
    ];
    const { inWindow } = splitEvents(duplicated, '2026-10-10', '2026-10-17');
    expect(inWindow).toHaveLength(1);
    expect(inWindow[0].tier).toBe('resort');
  });
});

describe('climateForTrip', () => {
  const twelve = [21, 22, 24, 27, 30, 32, 33, 33, 31, 28, 24, 21];

  it('returns the slices the trip touches', () => {
    const band: ClimateBand = {
      tier: 'city',
      from: 'Florida',
      tempC: twelve,
      rainfallMm: null,
      season: null,
    };
    const slices = climateForTrip(band, '2026-10-10', '2026-10-17');
    expect(slices).toEqual([{ month: 9, tempC: 28, rainfallMm: null, season: null }]);
  });

  it('rejects an 11-value CSV rather than padding it', () => {
    expect(parseClimateRow(twelve.slice(0, 11).join(','))).toBeNull();
    expect(parseClimateRow(twelve.join(','))).toEqual(twelve);
    expect(parseClimateRow('21,22,not-a-number,27,30,32,33,33,31,28,24,21')).toBeNull();
    expect(parseClimateSeasons('best,best,best,best,best,best,best,best,best,best,best')).toBeNull();
    expect(
      parseClimateSeasons('best,best,shoulder,off,off,off,off,off,shoulder,best,best,best'),
    ).toHaveLength(12);
  });

  it('carries a null band through to the strip', () => {
    const band: ClimateBand = {
      tier: 'city',
      from: 'Florida',
      tempC: null,
      rainfallMm: null,
      season: null,
    };
    expect(climateForTrip(band, '2026-10-10', '2026-10-17')[0].tempC).toBeNull();
  });

  it('returns nothing without a climate band', () => {
    expect(climateForTrip(undefined, '2026-10-10', '2026-10-17')).toEqual([]);
  });
});

/* ───────────────────────────────────────────────────────────────────────────
 * Trip-window timezone safety.
 *
 * splitEvents and climateForTrip are called from 'use client' components
 * (destination/page.tsx, whats-on.tsx), so the timezone that reaches
 * tripMonths is the TRAVELLER'S BROWSER, not the server's. `new Date(iso)`
 * switches zone on the SHAPE of the string — a bare '2026-06-01T00:00:00' is
 * LOCAL midnight, a date-only '2026-06-02' is UTC midnight — so a booking
 * carrying one of each described a different window east of Greenwich than it
 * did in London, and a Tokyo traveller was shown May's events as if they fell
 * during a June stay.
 * ─────────────────────────────────────────────────────────────────────────── */
describe('tripMonths is the same window in every timezone', () => {
  const originalTz = process.env.TZ;
  afterEach(() => {
    if (originalTz === undefined) delete process.env.TZ;
    else process.env.TZ = originalTz;
  });

  // Node applies a TZ change to Date operations that follow it, so each case
  // genuinely re-parses under that zone rather than mocking the result.
  const zones = ['UTC', 'Europe/London', 'Asia/Tokyo', 'Australia/Sydney', 'Asia/Dubai', 'America/Los_Angeles'];

  for (const tz of zones) {
    it(`reads a 1-2 June trip as June alone in ${tz}`, () => {
      process.env.TZ = tz;
      // The exact reproduction: a timestamped start against a date-only end.
      expect(tripMonths('2026-06-01T00:00:00', '2026-06-02')).toEqual([5]);
      // And the shape orderToBooking now produces, which must agree with it.
      expect(tripMonths('2026-06-01', '2026-06-02')).toEqual([5]);
    });

    it(`treats a trip date as a calendar date, not an instant, in ${tz}`, () => {
      process.env.TZ = tz;
      // 23:00Z on 31 May is still 31 May as written, so the window opens in May
      // wherever it is read — no zone may pull it into June or back into April.
      expect(tripMonths('2026-05-31T23:00:00Z', '2026-06-02')).toEqual([4, 5]);
      expect(tripMonths('2026-05-23T00:00:00', '2026-05-24')).toEqual([4]);
      // The west-of-Greenwich half of the same bug: an evening departure read
      // as local time lands on the NEXT UTC day, which dropped May entirely for
      // a traveller in Los Angeles.
      expect(tripMonths('2026-05-31T20:00:00', '2026-06-02')).toEqual([4, 5]);
    });
  }

  it('gives the same answer whether or not the start carries a time', () => {
    for (const tz of zones) {
      process.env.TZ = tz;
      expect(tripMonths('2026-06-01T00:00:00', '2026-06-02')).toEqual(
        tripMonths('2026-06-01', '2026-06-02'),
      );
    }
  });

  it('carries the fix through the surfaces travellers actually see', () => {
    process.env.TZ = 'Asia/Tokyo';
    const june = [evt('Epcot Festival of the Holidays', 'Nov-Dec'), evt('Midsummer party', 'Jun')];
    // Before the fix the window was [4, 5], so a May-only event would have shown
    // under "While you're there" on a June trip.
    const { inWindow } = splitEvents(june, '2026-06-01T00:00:00', '2026-06-02');
    expect(inWindow.map((e) => e.name)).toEqual(['Midsummer party']);

    const band: ClimateBand = {
      tier: 'city',
      from: 'Orlando',
      tempC: [21, 22, 24, 27, 30, 32, 33, 33, 31, 28, 24, 21],
      rainfallMm: null,
      season: null,
    };
    expect(climateForTrip(band, '2026-06-01T00:00:00', '2026-06-02').map((s) => s.month)).toEqual([5]);
  });

  it('refuses a date it cannot read rather than guessing a window', () => {
    expect(tripMonths('not a date', '2026-06-02')).toEqual([]);
    expect(tripMonths('2026-13-45', '2026-06-02')).toEqual([]);
  });
});

/* ───────────────────────────────────────────────────────────────────────────
 * Trip DATES as orderToBooking produces them.
 *
 * These live here rather than in an order-to-booking test because they are
 * about the same thing the rest of this file is about: what a trip date means.
 * tripStart and tripEnd are the pair tripMonths above is handed, so the shape
 * they come out in is part of this contract, not an implementation detail of
 * the order mapper.
 * ─────────────────────────────────────────────────────────────────────────── */
function ticketItem(id: number, scheduled: string): NonNullable<TrimmedOrder['items']>[number] {
  return {
    id,
    product: 'Tickets & Attractions',
    startDate: scheduled,
    ticketsAttractions: {
      name: `Attraction ${id}`,
      location: { city: 'Orlando', country: 'US' },
      selectedOption: { scheduledDateTime: scheduled },
    },
  };
}

describe('orderToBooking trip dates', () => {
  it('states tripStart as a calendar date, the same shape as tripEnd', () => {
    const order: TrimmedOrder = {
      id: 1,
      items: [ticketItem(1, '2026-05-23T10:00:00'), ticketItem(2, '2026-05-24T09:30:00')],
      // Travelify sends a full timestamp here; tripEnd has always been sliced.
      summary: { earliestStart: '2026-05-23T00:00:00', latestEnd: '2026-05-24' },
    };
    const booking = orderToBooking(order, null, 'ABC123');
    expect(booking?.tripStart).toBe('2026-05-23');
    expect(booking?.tripEnd).toBe('2026-05-24');
    // The pair must now read identically in the traveller's browser, wherever
    // that is — this is the mismatch that produced [4, 5] instead of [4].
    expect(tripMonths(booking!.tripStart, booking!.tripEnd)).toEqual([4]);
  });

  it('counts a two-day ticket trip as two days, not the one-day span', () => {
    const order: TrimmedOrder = {
      id: 2,
      items: [ticketItem(1, '2026-05-23T10:00:00'), ticketItem(2, '2026-05-24T09:30:00')],
      summary: { earliestStart: '2026-05-23T00:00:00', latestEnd: '2026-05-24' },
    };
    expect(orderToBooking(order, null, 'ABC123')?.durationLabel).toBe('2 days');
  });

  it('still calls a single-day ticket trip one day', () => {
    const order: TrimmedOrder = {
      id: 3,
      items: [ticketItem(1, '2026-05-23T10:00:00')],
      summary: { earliestStart: '2026-05-23T00:00:00', latestEnd: '2026-05-23' },
    };
    expect(orderToBooking(order, null, 'ABC123')?.durationLabel).toBe('1 day');
  });

  it('leaves a hotel booking reporting its supplier nights', () => {
    const order: TrimmedOrder = {
      id: 4,
      items: [
        {
          id: 10,
          product: 'Accommodation',
          startDate: '2026-05-23T00:00:00',
          accommodation: {
            name: 'Test Resort',
            location: { city: 'Orlando', country: 'US' },
            units: [{ name: 'Standard', checkin: '2026-05-23', nights: 7 }],
          },
        },
      ],
      summary: { earliestStart: '2026-05-23T00:00:00', latestEnd: '2026-05-30' },
    };
    const booking = orderToBooking(order, null, 'ABC123');
    // Nights are the supplier's own count and never go through the day maths.
    expect(booking?.durationLabel).toBe('7 nights');
    expect(booking?.tripStart).toBe('2026-05-23');
  });
});
