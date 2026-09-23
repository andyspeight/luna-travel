import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { BOOKINGS } from '@/data/mock-bookings';

/**
 * The demo apps are shown to prospects, so whatever agency they carry is a
 * brand a stranger sees.
 *
 * Both demo agencies used invented names that turned out to belong to real
 * travel companies — so every prospect shown a demo was looking at somebody
 * else's brand. The demos now carry Travelgenix's own, and this holds it
 * there.
 *
 * Asserted positively rather than by blocklist: nobody can list every real
 * agency in the country, but anybody can check the demo says Travelgenix.
 */

const ROOT = join(__dirname, '..', '..', '..');

describe('every demo booking', () => {
  it('is branded as Travelgenix, and nobody else', () => {
    for (const b of BOOKINGS) {
      expect(b.agency.name, b.reference).toBe('Travelgenix');
      expect(b.agency.appName, b.reference).toBe('Travelgenix');
    }
  });

  // A real domain on a demo would send a prospect's "Email" tap to a
  // stranger's inbox.
  it('points its contact details at Travelgenix', () => {
    for (const b of BOOKINGS) {
      expect(b.agency.email, b.reference).toMatch(/@travelgenix\.io$/);
      if (b.agency.website) expect(b.agency.website, b.reference).toBe('travelgenix.io');
    }
  });

  // Ofcom reserves these ranges for fiction, so a curious prospect who taps
  // Call on a demo cannot ring a real person.
  it('only ever dials numbers reserved for fiction', () => {
    const reserved = [/^\+44 121 555 /, /^\+44 20 7946 0/, /^\+44 7700 900/];
    for (const b of BOOKINGS) {
      for (const n of [b.agency.phone, b.agency.emergencyPhone].filter(Boolean) as string[]) {
        expect(
          reserved.some((r) => r.test(n)),
          `${b.reference} dials ${n}, which is not in a reserved range`,
        ).toBe(true);
      }
    }
  });

  it('uses a logo that exists', () => {
    for (const b of BOOKINGS) {
      if (!b.agency.logoUrl) continue;
      expect(() => readFileSync(join(ROOT, 'public', b.agency.logoUrl!)), b.agency.logoUrl).not.toThrow();
    }
  });
});

describe('the demo PDF data', () => {
  // The document pack is generated from a Python mirror of the bookings, and
  // bakes the agency name into every page — so it can drift from the app
  // without anything else noticing.
  it('carries the same agency as the app', () => {
    const py = readFileSync(join(ROOT, 'scripts', 'booking_data.py'), 'utf8');
    expect(py).toMatch(/"name":\s*"Travelgenix"/);
    expect(py).toMatch(/"email":\s*"hello@travelgenix\.io"/);
  });
});
