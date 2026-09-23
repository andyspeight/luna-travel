import { describe, it, expect } from 'vitest';
import { pickPhoto } from '@/components/hero-photo';

/**
 * Which destination photo to show. The rule that matters: a less specific
 * photo never shows while a more specific one might still arrive — that is the
 * Italy-then-Rome flash (WCS96420, 23 Sep 2026).
 */

const PLACE = 'IT/rome/trastevere';
const CITY = 'IT/rome';
const COUNTRY = 'IT';
const ALL = [PLACE, CITY, COUNTRY];

describe('pickPhoto', () => {
  it('shows nothing while the most specific photo is still coming, even if the country has arrived', () => {
    expect(pickPhoto(ALL, { [COUNTRY]: 'ok' })).toBeNull();
    expect(pickPhoto(ALL, { [COUNTRY]: 'ok', [CITY]: 'ok' })).toBeNull();
  });

  it('shows the most specific one as soon as it has loaded', () => {
    expect(pickPhoto(ALL, { [PLACE]: 'ok' })).toBe(PLACE);
    expect(pickPhoto(ALL, { [PLACE]: 'ok', [COUNTRY]: 'ok' })).toBe(PLACE);
  });

  // Most places have no photo of their own; they must still get one.
  it('falls back only once everything more specific has failed', () => {
    expect(pickPhoto(ALL, { [PLACE]: 'failed', [CITY]: 'ok' })).toBe(CITY);
    expect(pickPhoto(ALL, { [PLACE]: 'failed', [CITY]: 'failed', [COUNTRY]: 'ok' })).toBe(COUNTRY);
  });

  it('waits on the city after the place has failed', () => {
    expect(pickPhoto(ALL, { [PLACE]: 'failed', [COUNTRY]: 'ok' })).toBeNull();
  });

  it('shows the gradient when there is no photo at all', () => {
    expect(pickPhoto(ALL, { [PLACE]: 'failed', [CITY]: 'failed', [COUNTRY]: 'failed' })).toBeNull();
    expect(pickPhoto([], {})).toBeNull();
  });

  it('works with only a country photo, the common case', () => {
    expect(pickPhoto([COUNTRY], {})).toBeNull();
    expect(pickPhoto([COUNTRY], { [COUNTRY]: 'ok' })).toBe(COUNTRY);
  });
});
