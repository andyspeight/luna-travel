import { describe, expect, it } from 'vitest';
import {
  MAX_PARK_MATCH_KM,
  RESCUE_PARK_MATCH_KM,
  STOP_TITLES,
  haversineKm,
  matchTicketsToParks,
} from '@/lib/park-match';
import type { ParkRecord } from '@/types/destination-content';

function park(
  id: string,
  name: string,
  slug: string,
  coords?: { lat: number; lng: number },
): ParkRecord {
  return { id, slug, name, code: 'US', bestFor: [], hasOnSiteHotels: false, ...coords };
}

/**
 * The REAL Orlando candidate list, ids and coordinates copied from
 * src/data/destination-places.ts. Three of the four names contain "Orlando",
 * which is the whole point: a two-park fixture makes that token look
 * distinctive and hides the bug where all three Orlando parks answer to every
 * Orlando ticket and the ticket is discarded as ambiguous.
 */
const disney = park('recQ3Ap2OBq2c5ZQz', 'Walt Disney World Resort', 'walt-disney-world-resort', {
  lat: 28.3852,
  lng: -81.5639,
});
const universal = park('recgPO2Os1emMztPH', 'Universal Orlando Resort', 'universal-orlando-resort', {
  lat: 28.4762,
  lng: -81.4683,
});
const seaworld = park('recXMa5Pf2Ku0S75Q', 'SeaWorld Orlando', 'seaworld-orlando', {
  lat: 28.4112,
  lng: -81.4615,
});
const discoveryCove = park('rec4w8gbFNBWuT9hJ', 'Discovery Cove Orlando', 'discovery-cove-orlando', {
  lat: 28.412,
  lng: -81.4626,
});

const ORLANDO = [disney, universal, seaworld, discoveryCove];

describe('the real four-park Orlando list', () => {
  it('matches every Orlando ticket to its own park', () => {
    // Each of these matched NOTHING before the fix, because "orlando" put three
    // parks through the name gate and the ticket was thrown away unread.
    const cases: Array<[string, string]> = [
      ['Universal Orlando 3-Park Explorer Ticket', universal.id],
      ['SeaWorld Orlando Single Day Ticket', seaworld.id],
      ['Discovery Cove Orlando Day Resort Package', discoveryCove.id],
      ['Walt Disney World 14-Day Ultimate Ticket', disney.id],
    ];
    for (const [title, expectedId] of cases) {
      const { matched } = matchTicketsToParks([{ id: 'e1', title }], ORLANDO);
      expect(matched, title).toHaveLength(1);
      expect(matched[0].park.id, title).toBe(expectedId);
    }
  });

  it('matches the Universal ticket sitting on Universal, not its Orlando neighbours', () => {
    // The observed failure: 0.00 km from Universal, matched nothing.
    const { matched, nearby } = matchTicketsToParks(
      [{ id: 'e1', title: 'Universal Orlando 3-Park Explorer Ticket', lat: 28.4762, lng: -81.4683 }],
      ORLANDO,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].park.id).toBe(universal.id);
    expect(matched[0].matchedBy).toBe('name+coords');
    expect(nearby.map((p) => p.id)).toEqual([disney.id, seaworld.id, discoveryCove.id]);
  });

  it('treats a shared place word as carrying no information', () => {
    // "Orlando" describes three of the four candidates, so on its own it must
    // never put any park through the gate.
    const { matched } = matchTicketsToParks(
      [{ id: 'e1', title: 'Orlando Explorer Ticket' }],
      ORLANDO,
    );
    expect(matched).toHaveLength(0);
  });
});

describe('ambiguity', () => {
  it('matches nothing for a genuinely ambiguous ticket with no coordinates', () => {
    const { matched, nearby } = matchTicketsToParks(
      [{ id: 'e1', title: 'SeaWorld Orlando and Discovery Cove Combo Ticket' }],
      ORLANDO,
    );
    expect(matched).toHaveLength(0);
    expect(nearby).toHaveLength(4);
  });

  it('lets coordinates break a name tie when one park is clearly nearest', () => {
    const { matched } = matchTicketsToParks(
      [
        {
          id: 'e1',
          title: 'Universal Orlando and SeaWorld Orlando Combo',
          lat: 28.4762,
          lng: -81.4683,
        },
      ],
      ORLANDO,
    );
    expect(haversineKm(28.4762, -81.4683, seaworld.lat!, seaworld.lng!)).toBeGreaterThan(
      RESCUE_PARK_MATCH_KM,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].park.id).toBe(universal.id);
    expect(matched[0].matchedBy).toBe('name+coords');
  });

  it('still matches nothing when the tied parks are too close to separate', () => {
    // SeaWorld and Discovery Cove are ~0.14 km apart — coordinates cannot tell
    // them apart, so neither is "your park". Never guess.
    expect(
      haversineKm(seaworld.lat!, seaworld.lng!, discoveryCove.lat!, discoveryCove.lng!),
    ).toBeLessThan(RESCUE_PARK_MATCH_KM);
    const { matched } = matchTicketsToParks(
      [
        {
          id: 'e1',
          title: 'SeaWorld Orlando and Discovery Cove Combo Ticket',
          lat: 28.4112,
          lng: -81.4615,
        },
      ],
      ORLANDO,
    );
    expect(matched).toHaveLength(0);
  });

  it('matches nothing when two parks share the only word the ticket gives', () => {
    const studios = park('rec3', 'Universal Studios Florida', 'universal-studios-florida');
    const islands = park('rec4', 'Universal Islands of Adventure', 'universal-islands-of-adventure');
    const { matched, nearby } = matchTicketsToParks(
      [{ id: 'e1', title: 'Universal 2-Park Ticket' }],
      [studios, islands],
    );
    expect(matched).toHaveLength(0);
    expect(nearby.map((p) => p.id)).toEqual(['rec3', 'rec4']);
  });
});

describe('matchTicketsToParks', () => {
  it('never matches a supplier placeholder title', () => {
    // order-to-booking falls back to the literal "Attraction ticket" when the
    // supplier gave nothing — it must never reach a park guide.
    expect(STOP_TITLES.has('attraction ticket')).toBe(true);
    const { matched, nearby } = matchTicketsToParks(
      [{ id: 'e1', title: 'Attraction ticket' }],
      ORLANDO,
    );
    expect(matched).toHaveLength(0);
    expect(nearby).toHaveLength(4);
  });

  it('corroborates a name match with nearby coordinates', () => {
    const { matched } = matchTicketsToParks(
      [{ id: 'e1', title: 'Walt Disney World 14-Day Ultimate Ticket', lat: 28.39, lng: -81.56 }],
      ORLANDO,
    );
    expect(matched[0].matchedBy).toBe('name+coords');
  });

  it('reports a bare name match as "name"', () => {
    const { matched } = matchTicketsToParks(
      [{ id: 'e1', title: 'Walt Disney World 14-Day Ultimate Ticket' }],
      ORLANDO,
    );
    expect(matched[0].matchedBy).toBe('name');
  });

  it('vetoes a name match more than 40 km away', () => {
    // Anaheim, not Orlando — the same words, a different attraction.
    const far = {
      id: 'e1',
      title: 'Walt Disney World 14-Day Ultimate Ticket',
      lat: 33.8121,
      lng: -117.919,
    };
    expect(haversineKm(far.lat, far.lng, disney.lat!, disney.lng!)).toBeGreaterThan(
      MAX_PARK_MATCH_KM,
    );
    const { matched, nearby } = matchTicketsToParks([far], [disney]);
    expect(matched).toHaveLength(0);
    expect(nearby).toHaveLength(1);
  });

  it('rescues an unnamed ticket sitting on top of exactly one park', () => {
    const { matched } = matchTicketsToParks(
      [{ id: 'e1', title: 'Magic Kingdom day pass', lat: 28.3852, lng: -81.5639 }],
      ORLANDO,
    );
    expect(matched).toHaveLength(1);
    expect(matched[0].park.id).toBe(disney.id);
    expect(matched[0].matchedBy).toBe('coords');
  });
});

describe('haversineKm', () => {
  it('is zero for the same point', () => {
    expect(haversineKm(28.5383, -81.3792, 28.5383, -81.3792)).toBeCloseTo(0, 6);
  });
});
