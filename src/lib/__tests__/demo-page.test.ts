import { describe, it, expect } from 'vitest';
import { existsSync } from 'fs';
import { join } from 'path';
import { DEMO_TRIPS, CAPABILITIES, SCREENS, coverUrl, tripUrl } from '@/app/demo/trips';
import { BOOKINGS } from '@/data/mock-bookings';

/**
 * /demo is the page a prospect sees first. Its failure mode is not a crash —
 * it is a beautiful page whose links go nowhere, or whose images are missing,
 * discovered by a customer rather than by us.
 *
 * The copy is deliberately hand-written rather than derived from the fixtures,
 * so these check the two halves still agree.
 */

describe('every demo trip on the page actually exists', () => {
  // THE one. Rename a fixture and the page silently offers a dead trip.
  it.each(DEMO_TRIPS.map((t) => [t.reference, t.destination] as const))(
    '%s (%s) is a real mock booking',
    (reference) => {
      expect(BOOKINGS.some((b) => b.reference === reference)).toBe(true);
    },
  );

  it('offers every mock booking, so a new one is not quietly left off', () => {
    expect(DEMO_TRIPS.map((t) => t.reference).sort()).toEqual(
      BOOKINGS.map((b) => b.reference).sort(),
    );
  });

  it('names the destination the booking actually says', () => {
    for (const trip of DEMO_TRIPS) {
      const booking = BOOKINGS.find((b) => b.reference === trip.reference)!;
      expect(booking.destinationLabel, trip.reference).toBe(trip.destination);
    }
  });

  it('lists each trip once', () => {
    const refs = DEMO_TRIPS.map((t) => t.reference);
    expect(new Set(refs).size).toBe(refs.length);
  });
});

describe('every image the page asks for is on disk', () => {
  const publicPath = (p: string) => join(process.cwd(), 'public', p);

  it.each(DEMO_TRIPS.map((t) => [t.destination, t.cc] as const))(
    '%s has a landscape cover',
    (_d, cc) => {
      expect(existsSync(publicPath(coverUrl(cc, 'landscape')))).toBe(true);
    },
  );

  it.each(SCREENS.map((s) => [s.caption, s.src] as const))(
    'the %s screenshot exists',
    (_c, src) => {
      expect(existsSync(publicPath(src))).toBe(true);
    },
  );
});

describe('tripUrl', () => {
  it('builds an absolute URL, because a QR code has no origin', () => {
    expect(tripUrl('https://my-booking.co', 'DEMO81297')).toBe(
      'https://my-booking.co/?demo=DEMO81297',
    );
  });

  it('does not double the slash when the origin carries one', () => {
    expect(tripUrl('https://my-booking.co/', 'DEMO81297')).toBe(
      'https://my-booking.co/?demo=DEMO81297',
    );
  });
});

describe('the copy', () => {
  it('gives every trip a reason to be the one you open', () => {
    for (const t of DEMO_TRIPS) {
      expect(t.highlight.length, t.reference).toBeGreaterThan(30);
      expect(t.place.trim().length, t.reference).toBeGreaterThan(0);
      expect(t.duration.trim().length, t.reference).toBeGreaterThan(0);
    }
  });

  // The page claims these are all live in the demo. If that stops being true
  // a prospect catches us in a small lie, which is worse than a short list.
  it('claims a sensible number of capabilities, each explained', () => {
    expect(CAPABILITIES.length).toBeGreaterThanOrEqual(4);
    for (const c of CAPABILITIES) {
      expect(c.title.length, c.title).toBeGreaterThan(3);
      expect(c.body.length, c.title).toBeGreaterThan(40);
    }
  });

  it('points Trip essentials at a destination that actually has a phrase book', () => {
    // Athens is the only one of the four in a supported language, and the copy
    // says so. Maldives (Dhivehi) has neither phrase book nor allergy card.
    const essentials = DEMO_TRIPS.find((t) => /phrase book|allergy/i.test(t.highlight));
    expect(essentials?.destination).toBe('Athens');
  });
});
