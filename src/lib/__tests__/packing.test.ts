import { describe, it, expect } from 'vitest';
import {
  packingList,
  monthsOfTrip,
  tripHighC,
  tripRainMm,
  tempBand,
  adapterItem,
  type PackingGroup,
} from '@/lib/packing';
import type { ClimateBand } from '@/types/destination-content';

const climate = (tempC: number[] | null, rainfallMm: number[] | null = null): ClimateBand => ({
  tier: 'country',
  from: 'Test',
  tempC,
  rainfallMm,
  season: null,
});

// Jan..Dec. Cold winter, hot summer.
const FOUR_SEASONS = [8, 9, 12, 16, 21, 26, 30, 30, 25, 19, 13, 9];

const labels = (groups: PackingGroup[]) => groups.flatMap((g) => g.items.map((i) => i.label));
const titles = (groups: PackingGroup[]) => groups.map((g) => g.title);

describe('monthsOfTrip', () => {
  it('covers every month the trip touches', () => {
    expect(monthsOfTrip('2026-07-28', '2026-08-04')).toEqual([6, 7]);
  });

  it('is one month for a trip inside one month', () => {
    expect(monthsOfTrip('2026-07-02', '2026-07-09')).toEqual([6]);
  });

  it('wraps a new year', () => {
    expect(monthsOfTrip('2026-12-28', '2027-01-04')).toEqual([11, 0]);
  });

  it('gives nothing to work from when there are no dates', () => {
    expect(monthsOfTrip(undefined, undefined)).toEqual([]);
    expect(monthsOfTrip('not a date')).toEqual([]);
  });
});

describe('tripHighC / tripRainMm', () => {
  it('averages the months travelled, not the year', () => {
    // July + August are the hot ones; the annual mean would be far lower.
    expect(tripHighC(climate(FOUR_SEASONS), [6, 7])).toBe(30);
    expect(tripHighC(climate(FOUR_SEASONS), [0, 1])).toBe(9);
  });

  it('takes the wettest month travelled, because that is what you pack for', () => {
    const rain = [90, 80, 60, 40, 20, 5, 0, 0, 25, 70, 100, 95];
    expect(tripRainMm(climate(null, rain), [9, 10])).toBe(100);
  });

  it('returns null when the cell did not parse to twelve months', () => {
    expect(tripHighC(climate([20, 21]), [0])).toBeNull();
    expect(tripHighC(climate(null), [0])).toBeNull();
    expect(tripHighC(undefined, [0])).toBeNull();
  });
});

describe('tempBand', () => {
  it('splits where the packing genuinely changes', () => {
    expect(tempBand(31)).toBe('hot');
    expect(tempBand(28)).toBe('hot');
    expect(tempBand(24)).toBe('warm');
    expect(tempBand(17)).toBe('mild');
    expect(tempBand(10)).toBe('cool');
    expect(tempBand(2)).toBe('cold');
  });
});

describe('adapterItem', () => {
  // Telling somebody going to Malta to buy an adapter is how a list stops
  // being trusted.
  it('says no adapter is needed for a Type G country', () => {
    const item = adapterItem('230V · Type G');
    expect(item?.label).toBe('No adapter needed');
  });

  it('still wants one where Type G is only one of several', () => {
    expect(adapterItem('230V · Type C/G')?.label).toBe('Travel adapter');
    expect(adapterItem('110V · Type A/B/G')?.label).toBe('Travel adapter');
  });

  it('names the actual sockets rather than saying "an adapter"', () => {
    expect(adapterItem('230V · Type F/L')?.note).toBe('230V · Type F/L');
  });

  it('says nothing at all when the plug is unknown', () => {
    expect(adapterItem('')).toBeNull();
    expect(adapterItem(undefined)).toBeNull();
    expect(adapterItem('230V')).toBeNull();
  });
});

describe('packingList', () => {
  it('always covers the documents, whatever else it knows', () => {
    const list = packingList({});
    expect(titles(list)).toContain('Documents');
    expect(labels(list)).toContain('Passport');
  });

  // Rule 8 in its packing-list form: no figures, no claims about the weather.
  it('says nothing about clothing when there is no climate data', () => {
    const list = packingList({ tripStart: '2026-07-01', tripEnd: '2026-07-08' });
    expect(titles(list)).not.toContain('Clothing');
    expect(labels(list).join(' ')).not.toMatch(/sun cream|thermal|coat/i);
  });

  it('packs the same destination differently in July and January', () => {
    const base = { climate: climate(FOUR_SEASONS) };
    const summer = labels(packingList({ ...base, tripStart: '2026-07-01', tripEnd: '2026-07-08' }));
    const winter = labels(packingList({ ...base, tripStart: '2026-01-10', tripEnd: '2026-01-17' }));

    expect(summer.join(' ')).toMatch(/sun hat/i);
    expect(winter.join(' ')).toMatch(/warm coat/i);
    expect(winter.join(' ')).not.toMatch(/sun hat/i);
  });

  it('shows its working, with the real figure', () => {
    const list = packingList({
      tripStart: '2026-07-01',
      tripEnd: '2026-07-08',
      climate: climate(FOUR_SEASONS),
    });
    const notes = list.flatMap((g) => g.items.map((i) => i.note ?? '')).join(' ');
    expect(notes).toContain('30°C');
  });

  it('adds a waterproof only for a genuinely wet month', () => {
    const wet = [200, 190, 150, 90, 40, 10, 0, 0, 30, 120, 210, 220];
    const inRains = packingList({
      tripStart: '2026-11-01',
      tripEnd: '2026-11-08',
      climate: climate(FOUR_SEASONS, wet),
    });
    const inSun = packingList({
      tripStart: '2026-07-01',
      tripEnd: '2026-07-08',
      climate: climate(FOUR_SEASONS, wet),
    });
    expect(labels(inRains).join(' ')).toMatch(/waterproof/i);
    expect(labels(inSun).join(' ')).not.toMatch(/proper waterproof/i);
  });

  it('follows what was booked', () => {
    const beach = packingList({ tags: ['Beach', 'All-Inclusive'] });
    expect(titles(beach)).toContain('For the beach');
    expect(labels(beach).join(' ')).toMatch(/swimwear/i);

    const ski = packingList({ tags: ['Skiing'] });
    expect(titles(ski)).toContain('On the slopes');
    expect(labels(ski).join(' ')).not.toMatch(/swimwear/i);
  });

  it('remembers the children only when there are children', () => {
    expect(titles(packingList({ travellerTypes: ['adult', 'adult'] }))).not.toContain('For the children');
    expect(titles(packingList({ travellerTypes: ['adult', 'child'] }))).toContain('For the children');
    expect(labels(packingList({ travellerTypes: ['infant'] })).join(' ')).toMatch(/nappies/i);
  });

  it('never lists the same thing twice', () => {
    const list = packingList({ tags: ['Beach', 'Diving', 'Summer Sun'], travellerTypes: ['infant', 'child'] });
    const all = labels(list);
    expect(new Set(all).size).toBe(all.length);
  });

  it('puts documents first, because that is the group that ruins a holiday', () => {
    const list = packingList({ tags: ['Beach'], climate: climate(FOUR_SEASONS), tripStart: '2026-07-01' });
    expect(list[0].title).toBe('Documents');
  });

  it('mentions boarding passes only when there is a flight', () => {
    expect(labels(packingList({ hasFlights: true })).join(' ')).toMatch(/boarding pass/i);
    expect(labels(packingList({ hasFlights: false })).join(' ')).not.toMatch(/boarding pass/i);
  });
});
