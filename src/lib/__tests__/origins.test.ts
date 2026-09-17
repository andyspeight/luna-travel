/**
 * Which host serves what.
 *
 * These exist because the split shipped with a missing case rather than a wrong
 * one: every explicit rule was right, but nothing covered `/` on the portal
 * host. `/` is not a portal path, so the catch-all sent the portal domain's own
 * home page to the traveller app — and typing lunatravel.travelify.io landed you
 * in the customer app, which is what "both domains point at the same place"
 * turned out to mean.
 *
 * A missing branch is exactly what a table of examples catches and reading an
 * if-chain does not.
 */

import { describe, it, expect } from 'vitest';
import { routeForHost, isPortalPath, hostMatches, PORTAL_HOME, type HostConfig } from '@/lib/origins';

const LIVE: HostConfig = {
  travellerHost: 'my-booking.co',
  portalHost: 'lunatravel.travelify.io',
  travellerOrigin: 'https://my-booking.co',
  portalOrigin: 'https://lunatravel.travelify.io',
};

/** Where a request ends up, as "origin+path" or "served here". */
function land(host: string, path: string, cfg: HostConfig = LIVE): string {
  const r = routeForHost(host, path, cfg);
  return r ? `${r.origin}${r.path}` : 'served here';
}

describe('routeForHost', () => {
  it('sends the portal domain to the agent page, not the traveller app', () => {
    // The bug. Anything else here and the two domains are indistinguishable to
    // anyone who simply types the address.
    expect(land('lunatravel.travelify.io', '/')).toBe('https://lunatravel.travelify.io/agency');
    expect(PORTAL_HOME).toBe('/agency');
  });

  it('serves the traveller app at the traveller domain root', () => {
    expect(land('my-booking.co', '/')).toBe('served here');
  });

  it.each([
    ['/agency', 'https://lunatravel.travelify.io/agency'],
    ['/agency/travellers', 'https://lunatravel.travelify.io/agency/travellers'],
    ['/admin', 'https://lunatravel.travelify.io/admin'],
    ['/admin/heroes', 'https://lunatravel.travelify.io/admin/heroes'],
  ])('moves %s off the traveller domain', (path, expected) => {
    expect(land('my-booking.co', path)).toBe(expected);
  });

  it.each(['/agency', '/agency/messages', '/admin', '/admin/heroes'])(
    'serves %s on the portal domain',
    (path) => {
      expect(land('lunatravel.travelify.io', path)).toBe('served here');
    },
  );

  it.each(['/documents', '/itinerary', '/install'])(
    'moves the traveller page %s off the portal domain',
    (path) => {
      expect(land('lunatravel.travelify.io', path)).toBe(`https://my-booking.co${path}`);
    },
  );

  it('keeps invite links that point at the portal host working', () => {
    // These are already in the wild in people's inboxes. The middleware carries
    // the query string; this asserts the destination, which is the part the
    // routing rule owns.
    expect(land('lunatravel.travelify.io', '/install')).toBe('https://my-booking.co/install');
  });

  it('treats www as the same site on both domains', () => {
    // The apex/www redirect is a Vercel domain rule that runs BEFORE middleware,
    // so www must still be recognised or /agency would be served on the
    // consumer domain.
    expect(land('www.my-booking.co', '/agency')).toBe('https://lunatravel.travelify.io/agency');
    expect(land('www.lunatravel.travelify.io', '/')).toBe('https://lunatravel.travelify.io/agency');
  });

  it('serves everything on an unrecognised host', () => {
    // Preview deployments and localhost must keep working untouched.
    for (const path of ['/', '/agency', '/admin', '/documents']) {
      expect(land('luna-travel-abc123.vercel.app', path)).toBe('served here');
      expect(land('localhost:3000', path)).toBe('served here');
    }
  });

  it('does nothing at all when the split is not configured', () => {
    const off: HostConfig = { travellerHost: '', portalHost: '', travellerOrigin: '', portalOrigin: '' };
    expect(land('my-booking.co', '/agency', off)).toBe('served here');
    expect(land('lunatravel.travelify.io', '/', off)).toBe('served here');
  });

  it('does nothing when only one side is configured', () => {
    const half: HostConfig = {
      travellerHost: 'my-booking.co',
      portalHost: '',
      travellerOrigin: 'https://my-booking.co',
      portalOrigin: '',
    };
    expect(land('my-booking.co', '/agency', half)).toBe('served here');
  });

  it('does nothing when both hosts are the same, which would loop forever', () => {
    const same: HostConfig = {
      travellerHost: 'one.example',
      portalHost: 'one.example',
      travellerOrigin: 'https://one.example',
      portalOrigin: 'https://one.example',
    };
    expect(land('one.example', '/', same)).toBe('served here');
    expect(land('one.example', '/agency', same)).toBe('served here');
  });

  it('never returns a redirect back to the host it came from', () => {
    // A rule that sends a host to itself is an infinite loop in a browser. The
    // one legitimate same-host result is the portal front door, which changes
    // the path.
    for (const host of ['my-booking.co', 'lunatravel.travelify.io']) {
      for (const path of ['/', '/agency', '/admin', '/documents', '/install', '/itinerary']) {
        const r = routeForHost(host, path, LIVE);
        if (!r) continue;
        const sameHost = hostMatches(host, new URL(r.origin).host);
        if (sameHost) expect(r.path).not.toBe(path);
      }
    }
  });
});

describe('isPortalPath', () => {
  it.each(['/agency', '/agency/', '/agency/travellers', '/admin', '/admin/heroes'])(
    'claims %s',
    (p) => expect(isPortalPath(p)).toBe(true),
  );

  it.each(['/', '/documents', '/install', '/itinerary'])(
    'leaves %s to the traveller',
    (p) => expect(isPortalPath(p)).toBe(false),
  );

  it('does not claim a path that merely starts with the same letters', () => {
    // /agency-signup would otherwise be dragged onto the portal domain.
    expect(isPortalPath('/agencyx')).toBe(false);
    expect(isPortalPath('/administrator')).toBe(false);
  });
});
