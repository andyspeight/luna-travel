import { describe, expect, it } from 'vitest';
import { matchLocationSlug } from '@/lib/location-match';
import { iso2 } from '@/lib/order-to-booking';

describe('matchLocationSlug — last-resort resort → parent city', () => {
  it('resolves an Orlando booking to the Florida hero', () => {
    // The bug this whole branch exists for: "Orlando" scores 0 against
    // "Florida", so the traveller got the generic USA photograph.
    expect(matchLocationSlug('US', ['Orlando'])).toBe('florida');
  });

  it('never leaks a place across a country border', () => {
    expect(matchLocationSlug('GR', ['Orlando'])).toBeUndefined();
  });

  it('does not pick an unrelated roster region for a resort it cannot place', () => {
    expect(matchLocationSlug('US', ['Miami'])).not.toBe('nashville-memphis');
  });
});

describe('matchLocationSlug — existing scorer is untouched', () => {
  it('matches an exact roster name', () => {
    expect(matchLocationSlug('US', ['Orlando', 'Florida'])).toBe('florida');
  });

  it('still matches a distinctive token inside a longer signal', () => {
    // Only the scorer can produce this: the last-resort branch matches a whole
    // normalised signal exactly, so it can never fire on an embedded token.
    expect(matchLocationSlug('US', ['Hotel in Charleston, South Carolina'])).toBe(
      'charleston-deep-south',
    );
  });

  it('matches a city that needs no index lookup at all', () => {
    expect(matchLocationSlug('AE', ['Dubai'])).toBe('dubai');
  });

  it('returns nothing without a country code', () => {
    expect(matchLocationSlug('', ['Dubai'])).toBeUndefined();
    expect(matchLocationSlug(undefined, ['Dubai'])).toBeUndefined();
  });

  it('returns nothing when no signal is usable', () => {
    expect(matchLocationSlug('AE', ['', null, undefined, 'ab'])).toBeUndefined();
  });
});

describe('iso2', () => {
  // Every new surface keys on primaryCountryCode, and iso2() is where it comes
  // from — an unrecognised country value hides the hero, the guide and the
  // weather at once, so the tolerated spellings are pinned here.
  it('accepts an ISO-2 code in any case', () => {
    expect(iso2('US')).toBe('US');
    expect(iso2('us')).toBe('US');
    expect(iso2(' us ')).toBe('US');
  });

  it('accepts the colloquial and full-name forms suppliers actually send', () => {
    expect(iso2('USA')).toBe('US');
    expect(iso2('United States')).toBe('US');
    expect(iso2('united states of america')).toBe('US');
    expect(iso2('UK')).toBe('GB');
    expect(iso2('United Kingdom')).toBe('GB');
    expect(iso2('United Arab Emirates')).toBe('AE');
  });

  it('returns nothing for a value it cannot place, rather than guessing', () => {
    expect(iso2('Republic of Nowhere')).toBe('');
    expect(iso2('')).toBe('');
    expect(iso2(null)).toBe('');
    expect(iso2(undefined)).toBe('');
  });
});
