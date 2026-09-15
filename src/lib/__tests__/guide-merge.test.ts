import { describe, expect, it } from 'vitest';
import { isEmptyGuide, resolveGuide } from '@/lib/guide-merge';
import type { PlaceView } from '@/types/destination-content';
import type { DestinationGuide } from '@/types/booking';

function view(partial: Partial<PlaceView>): PlaceView {
  return {
    tier: 'city',
    slug: 'florida',
    code: 'US',
    trail: ['Florida', 'USA'],
    breadcrumb: 'Florida · USA',
    name: 'Florida',
    heroSlug: 'florida',
    facts: {},
    sections: [],
    highlights: [],
    events: [],
    images: [],
    bestForTags: [],
    audienceTags: [],
    suggestions: [],
    parks: [],
    resolved: { resort: false, city: true, country: true },
    stale: false,
    generatedAt: '2026-09-15T00:00:00.000Z',
    ...partial,
  };
}

const staticGuide: DestinationGuide = {
  countryCode: 'US',
  name: 'USA',
  region: 'North America',
  currency: 'US Dollar (static)',
  timeZone: 'Various (static)',
  languages: ['English'],
  weatherSummary: 'Varies hugely by state',
  introduction: 'Static introduction.',
  whyWeLoveIt: 'Static reason.',
  insiderTips: 'Static tips.',
  visaSummary: 'Static visa paragraph.',
  emergencyNumber: '911',
};

describe('resolveGuide', () => {
  it('lets a city currency beat a Luna Brain country currency', () => {
    const g = resolveGuide({
      countryCode: 'US',
      place: view({ facts: { currency: { value: 'US Dollar (USD)', tier: 'city', from: 'Florida' } } }),
      brain: { destination: { currency: 'United States Dollar' } },
      staticGuide,
    });
    expect(g.currency).toBe('US Dollar (USD)');
    expect(g.sourceOf.currency).toBe('city');
  });

  it('lets a city time zone beat the country-level one', () => {
    const g = resolveGuide({
      countryCode: 'US',
      place: view({ facts: { timeZone: { value: 'Eastern Time (GMT −5)', tier: 'city', from: 'Florida' } } }),
      brain: { destination: { timeZone: 'GMT −5 to GMT −10' } },
      staticGuide,
    });
    expect(g.timeZone).toBe('Eastern Time (GMT −5)');
  });

  it('lets a Luna Brain visa beat a country-tier visa paragraph', () => {
    const g = resolveGuide({
      countryCode: 'US',
      place: view({
        sections: [{ key: 'visa', tier: 'country', from: 'USA', body: 'Country-tier visa paragraph.' }],
      }),
      brain: { destination: { ukVisaRequired: 'ESTA required for UK passport holders.' } },
      staticGuide,
    });
    expect(g.visaSummary).toBe('ESTA required for UK passport holders.');
    expect(g.sourceOf.visaSummary).toBeUndefined();
  });

  it('falls back to the country-tier visa paragraph when Luna Brain is silent', () => {
    const g = resolveGuide({
      countryCode: 'US',
      place: view({
        sections: [{ key: 'visa', tier: 'country', from: 'USA', body: 'Country-tier visa paragraph.' }],
      }),
      brain: null,
      staticGuide: undefined,
    });
    expect(g.visaSummary).toBe('Country-tier visa paragraph.');
    expect(g.sourceOf.visaSummary).toBe('country');
  });

  it('prefers place prose for the headline and records the source', () => {
    const g = resolveGuide({
      countryCode: 'US',
      place: view({
        sections: [{ key: 'hero-intro', tier: 'city', from: 'Florida', body: 'Florida in one paragraph.' }],
      }),
      brain: null,
      staticGuide,
    });
    expect(g.introduction).toBe('Florida in one paragraph.');
    expect(g.source).toBe('content');
    expect(g.region).toBe('Florida · USA');
  });

  it('renders from the static guide alone', () => {
    const g = resolveGuide({ countryCode: 'US', place: null, brain: null, staticGuide });
    expect(g.introduction).toBe('Static introduction.');
    expect(g.languages).toBe('English');
    expect(g.source).toBe('static');
  });
});

describe('isEmptyGuide', () => {
  it('is true only when all three sources are empty', () => {
    expect(
      isEmptyGuide(resolveGuide({ countryCode: 'US', place: null, brain: null, staticGuide: undefined })),
    ).toBe(true);
    expect(
      isEmptyGuide(resolveGuide({ countryCode: 'US', place: null, brain: null, staticGuide })),
    ).toBe(false);
    expect(
      isEmptyGuide(
        resolveGuide({
          countryCode: 'US',
          place: null,
          brain: { destination: { currency: 'US Dollar' } },
          staticGuide: undefined,
        }),
      ),
    ).toBe(false);
    expect(
      isEmptyGuide(
        resolveGuide({
          countryCode: 'US',
          place: view({ tagline: { value: 'The Sunshine State', tier: 'city', from: 'Florida' } }),
          brain: null,
          staticGuide: undefined,
        }),
      ),
    ).toBe(false);
  });
});
