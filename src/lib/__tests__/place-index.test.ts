import { describe, expect, it } from 'vitest';
import {
  ancestorRefs,
  heroSlugFor,
  parkIdsForChain,
  resolvePlaceRef,
} from '@/lib/place-index';

// Live record ids from the committed index snapshot. Pinned here deliberately:
// if a regeneration moves the Orlando resort or the Walt Disney World join, the
// park guide silently disappears and this is the test that says so.
const ORLANDO = 'recZCCYVBMpPyTB6B'; // resort
const FLORIDA = 'recaNUk5XpMUeRdHY'; // city (parent of Orlando)
const USA = 'rece8Eu6yKS9hOcVs'; // country
const CALIFORNIA = 'recb4SNnnhXblDYMS'; // city, a sibling of Florida
const WALT_DISNEY_WORLD = 'recQ3Ap2OBq2c5ZQz';
const UNIVERSAL_ORLANDO = 'recgPO2Os1emMztPH';
const SEAWORLD_ORLANDO = 'recXMa5Pf2Ku0S75Q';
const DISCOVERY_COVE = 'rec4w8gbFNBWuT9hJ';
const LEGOLAND_FLORIDA = 'rec8HpwWqEiYASGdQ'; // joined to FLORIDA, not Orlando
const BUSCH_GARDENS = 'recKCrzy8Fi4bSmmC'; // joined to FLORIDA, not Orlando

describe('resolvePlaceRef — a signal outranks the hero slug', () => {
  it('returns the Orlando resort even when slug=florida is supplied', () => {
    // THE regression. booking.locationSlug is a HERO key: matchLocationSlug
    // walks Orlando (no uploaded hero) up to Florida, so an Orlando booking
    // carries 'florida'. While that slug was an absolute override the Orlando
    // record was never read and the traveller got Florida's page — Miami and
    // Key West events, Florida's Honeymoons/Beach tags, and no park guide.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['orlando'],
    });
    expect(ref?.id).toBe(ORLANDO);
    expect(ref?.tier).toBe('resort');
    expect(ref?.slug).toBe('orlando');
  });

  it('resolves identically with no slug at all', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: ['orlando'] });
    expect(ref?.id).toBe(ORLANDO);
  });

  it('lets a signal outrank a slug that names the country tier', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'usa',
      signals: ['orlando'],
    });
    expect(ref?.id).toBe(ORLANDO);
  });

  it('still resolves Orlando from a real booking-shaped signal list', () => {
    // placeSignals() lowercases, dedupes and sorts, so this is the shape the
    // route actually receives for an attractions-only Orlando trip.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['florida', 'orlando', 'walt disney world resort'],
    });
    expect(ref?.id).toBe(ORLANDO);
  });

  it('keeps the hero on Florida while the content sits on Orlando', () => {
    // The two fixes have to coexist: the hero slug is still the ancestor that
    // owns an uploaded photograph, the content ref is the specific place.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['orlando'],
    });
    expect(heroSlugFor(ref ?? null)).toBe('florida');
    expect(ancestorRefs(ref!).city?.id).toBe(FLORIDA);
    expect(ancestorRefs(ref!).country?.id).toBe(USA);
  });
});

describe('resolvePlaceRef — an agent-picked slug still wins', () => {
  it('wins when there are no signals at all', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', locationSlug: 'california', signals: [] });
    expect(ref?.id).toBe(CALIFORNIA);
  });

  it('wins when no signal resolves to anything', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['somewhere nobody has written up'],
    });
    expect(ref?.id).toBe(FLORIDA);
  });

  it('wins when the signal points outside the slug subtree', () => {
    // A slug the agent picked by hand beats free text scraped off a supplier
    // feed; only a MORE SPECIFIC name for the SAME place may overrule it.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'california',
      signals: ['orlando'],
    });
    expect(ref?.id).toBe(CALIFORNIA);
  });

  it('is ignored when it names no row in this country', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', locationSlug: 'corfu', signals: [] });
    expect(ref?.id).toBe(USA);
  });
});

describe('resolvePlaceRef — guards that must not regress', () => {
  it('falls back to the country tier when nothing matches', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: ['a place with no record'] });
    expect(ref?.id).toBe(USA);
    expect(ref?.tier).toBe('country');
  });

  it('never crosses a country border, slug or signal', () => {
    const ref = resolvePlaceRef({
      countryCode: 'GR',
      locationSlug: 'florida',
      signals: ['orlando'],
    });
    expect(ref?.code).toBe('GR');
    expect(ref?.id).not.toBe(ORLANDO);
    expect(ref?.id).not.toBe(FLORIDA);
  });

  it('returns null without a usable country code', () => {
    expect(resolvePlaceRef({ countryCode: '', signals: ['orlando'] })).toBeNull();
    expect(resolvePlaceRef({ countryCode: 'United States', signals: ['orlando'] })).toBeNull();
  });

  it('ignores signals too short to be a place name', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: ['', 'ab', null, undefined] });
    expect(ref?.id).toBe(USA);
  });
});

describe('parkIdsForChain — the park guide reaches an Orlando booking', () => {
  it('includes Walt Disney World for the Orlando-shaped ref', () => {
    // The joins live on the Orlando resort row; resolving to Florida instead
    // excluded all four Orlando parks and the "Your park guide" tab never
    // appeared for the Disney ticket the feature was built for.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['orlando'],
    });
    const ids = parkIdsForChain(ref!);
    expect(ids).toContain(WALT_DISNEY_WORLD);
    expect(ids).toContain(UNIVERSAL_ORLANDO);
    expect(ids).toContain(SEAWORLD_ORLANDO);
    expect(ids).toContain(DISCOVERY_COVE);
  });

  it('puts the Orlando parks ahead of the ones joined at the city tier', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: ['orlando'] });
    const ids = parkIdsForChain(ref!);
    expect(ids.indexOf(WALT_DISNEY_WORLD)).toBeLessThan(ids.indexOf(LEGOLAND_FLORIDA));
  });

  it('shows what resolving to Florida used to cost', () => {
    // Kept as the counterexample: the Florida city row carries only LEGOLAND
    // and Busch Gardens, ~45 km and ~90 km from Disney — far outside both the
    // name gate and the coordinate rescue in park-match.
    const florida = resolvePlaceRef({ countryCode: 'US', locationSlug: 'florida', signals: [] });
    expect(florida?.id).toBe(FLORIDA);
    const ids = parkIdsForChain(florida!);
    expect(ids).not.toContain(WALT_DISNEY_WORLD);
    expect(ids).toContain(LEGOLAND_FLORIDA);
    expect(ids).toContain(BUSCH_GARDENS);
  });

  it('honours the cap', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: ['orlando'] });
    expect(parkIdsForChain(ref!, 2)).toHaveLength(2);
  });
});

// ── Coordinate fallback ──────────────────────────────────────────────────────
// Resolution used to be literal-name-only, so an attraction whose location.city
// is 'Lake Buena Vista' — Walt Disney World's ACTUAL postal city, and what
// suppliers routinely send — resolved to nothing at all, as did 'Kissimmee',
// where a large share of Orlando villa guests stay. Both fell all the way to
// {tier:'country', slug:'usa'}: no Orlando record, no park guide, no Florida
// hero. The Orlando index row has aliases:[], so no name list could have saved
// them; the tickets' own lat/lng can.
const MIAMI = 'recUyqwoQB8YwIGSk'; // resort, ~319 km from Lake Buena Vista
const CANADA = 'rec65YzT6nF4kIETV'; // country
const UNITED_KINGDOM = 'recklVyOY5hcad6KA'; // country, its ONLY row

/** Walt Disney World's postal city. ~23 km from the Orlando row's centroid. */
const LAKE_BUENA_VISTA = { lat: 28.3772, lng: -81.519 };
/** The villa belt south of Orlando. ~28 km from the Orlando row's centroid. */
const KISSIMMEE = { lat: 28.292, lng: -81.4076 };

describe('resolvePlaceRef — coordinates rescue a place with no matching name', () => {
  it('resolves Lake Buena Vista coordinates to the Orlando resort row', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['lake buena vista'],
      coords: LAKE_BUENA_VISTA,
    });
    expect(ref?.id).toBe(ORLANDO);
    expect(ref?.tier).toBe('resort');
  });

  it('resolves Kissimmee coordinates to the Orlando resort row', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['kissimmee'],
      coords: KISSIMMEE,
    });
    expect(ref?.id).toBe(ORLANDO);
  });

  it('prefers the resort over the city sharing the same centroid', () => {
    // The Orlando resort row and the Florida city row carry identical lat/lng in
    // the generated index, so distance alone cannot separate them — the tier
    // preference is what returns the row the parks are joined to.
    const ref = resolvePlaceRef({ countryCode: 'US', signals: [], coords: KISSIMMEE });
    expect(ref?.id).toBe(ORLANDO);
    expect(parkIdsForChain(ref!)).toContain(WALT_DISNEY_WORLD);
  });

  it('still lands the hero on Florida', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'florida',
      signals: ['lake buena vista'],
      coords: LAKE_BUENA_VISTA,
    });
    expect(heroSlugFor(ref ?? null)).toBe('florida');
    expect(ancestorRefs(ref!).city?.id).toBe(FLORIDA);
  });

  it('is what the country fallback used to swallow', () => {
    // Same call without coordinates: this is the production bug, pinned.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: undefined,
      signals: ['lake buena vista'],
    });
    expect(ref?.id).toBe(USA);
    expect(ref?.tier).toBe('country');
  });
});

describe('resolvePlaceRef — a name always beats a coordinate', () => {
  it('keeps the named place even when the coordinates point elsewhere', () => {
    // Miami is ~319 km from Lake Buena Vista. A name is an assertion about the
    // place; a coordinate is only a proximity, so the words win outright.
    const ref = resolvePlaceRef({
      countryCode: 'US',
      signals: ['miami'],
      coords: LAKE_BUENA_VISTA,
    });
    expect(ref?.id).toBe(MIAMI);
  });

  it('does not disturb the existing slug-versus-signal precedence', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'california',
      signals: ['orlando'],
      coords: LAKE_BUENA_VISTA,
    });
    expect(ref?.id).toBe(CALIFORNIA);
  });

  it('leaves an agent-picked slug alone when the coordinates sit outside it', () => {
    const ref = resolvePlaceRef({
      countryCode: 'US',
      locationSlug: 'california',
      signals: [],
      coords: LAKE_BUENA_VISTA,
    });
    expect(ref?.id).toBe(CALIFORNIA);
  });
});

describe('resolvePlaceRef — coordinates fail towards the country', () => {
  it('falls back when the coordinates are far from every row', () => {
    // Rural South Dakota: the nearest US row is ~628 km away.
    const ref = resolvePlaceRef({ countryCode: 'US', signals: [], coords: { lat: 44, lng: -100 } });
    expect(ref?.id).toBe(USA);
    expect(ref?.tier).toBe('country');
  });

  it('ignores Null Island, which is how a feed says "no coordinates"', () => {
    const ref = resolvePlaceRef({ countryCode: 'US', signals: [], coords: { lat: 0, lng: 0 } });
    expect(ref?.id).toBe(USA);
  });

  it('ignores impossible and non-finite pairs', () => {
    for (const coords of [
      { lat: 91, lng: -81 },
      { lat: 28, lng: 181 },
      { lat: NaN, lng: -81.5 },
      { lat: 28.3772, lng: Infinity },
    ]) {
      expect(resolvePlaceRef({ countryCode: 'US', signals: [], coords })?.id).toBe(USA);
    }
  });
});

describe('resolvePlaceRef — coordinates can never cross a country border', () => {
  it('will not return Orlando for a Florida coordinate on a UK booking', () => {
    // The guarantee is structural, not a distance check: only PLACES_BY_COUNTRY
    // for the booking's own code is ever scanned, and `code` is denormalised
    // onto every row at generation time.
    const ref = resolvePlaceRef({ countryCode: 'GB', signals: [], coords: LAKE_BUENA_VISTA });
    expect(ref?.id).toBe(UNITED_KINGDOM);
    expect(ref?.code).toBe('GB');
  });

  it('will not return Orlando for a Florida coordinate on a Canadian booking', () => {
    // Canada has resort and city rows of its own, so this proves the scan is
    // country-scoped rather than merely empty.
    const ref = resolvePlaceRef({ countryCode: 'CA', signals: [], coords: LAKE_BUENA_VISTA });
    expect(ref?.id).toBe(CANADA);
    expect(ref?.tier).toBe('country');
  });

  it('will not return a Canadian row for a Florida booking', () => {
    const toronto = { lat: 43.6532, lng: -79.3832 };
    const ref = resolvePlaceRef({ countryCode: 'US', signals: [], coords: toronto });
    expect(ref?.code).toBe('US');
    expect(ref?.tier).toBe('country');
  });
});
