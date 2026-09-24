/**
 * A traveller's app shows their booking and nothing else.
 *
 * Until the check for the real booking comes back, the provider holds the
 * built-in sample, and every screen but the home drew it: a client saw the
 * sample family's documents, and could download them, on every refresh.
 */

import { describe, it, expect } from 'vitest';
import { bookingReady, needsBooking } from '../booking-gate';

describe('bookingReady', () => {
  it('holds everything back while the check for a real booking runs', () => {
    expect(bookingReady({ source: 'mock', liveLoading: true, demoSelected: false })).toBe(false);
  });

  it('holds back a demo chosen earlier on this phone until we know there is no real trip', () => {
    // The traveller who once looked at a demo must not glimpse it again on the
    // way to their own booking.
    expect(bookingReady({ source: 'mock', liveLoading: true, demoSelected: true })).toBe(false);
  });

  it('never shows the sample to somebody with no trip and no demo', () => {
    expect(bookingReady({ source: 'mock', liveLoading: false, demoSelected: false })).toBe(false);
  });

  it("shows the traveller's own booking, including while it refreshes", () => {
    expect(bookingReady({ source: 'live', liveLoading: false, demoSelected: false })).toBe(true);
    expect(bookingReady({ source: 'live', liveLoading: true, demoSelected: false })).toBe(true);
  });

  it('shows a demo that was asked for once there is no real booking', () => {
    expect(bookingReady({ source: 'mock', liveLoading: false, demoSelected: true })).toBe(true);
  });
});

describe('needsBooking', () => {
  it.each([
    '/',
    '/documents',
    '/itinerary',
    '/travellers',
    '/travellers/t1',
    '/flight/f1',
    '/hotel/h1',
    '/me',
    '/help',
    '/luna',
    '/guide/find-your-way',
    // A screen nobody has written yet is covered without anyone remembering.
    '/some-new-screen',
  ])('%s waits for the booking', (p) => {
    expect(needsBooking(p)).toBe(true);
  });

  it.each(['/agency', '/agency/access', '/admin', '/admin/demo', '/demo', '/install', '/welcome', '/offline'])(
    '%s shows no booking, so never waits',
    (p) => {
      expect(needsBooking(p)).toBe(false);
    },
  );

  it('does not let a look-alike path through', () => {
    expect(needsBooking('/agencyx')).toBe(true);
    expect(needsBooking('/demo-trip')).toBe(true);
  });

  it('treats a missing path as the home screen', () => {
    expect(needsBooking(null)).toBe(true);
    expect(needsBooking(undefined)).toBe(true);
  });
});
