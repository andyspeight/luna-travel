import { describe, it, expect } from 'vitest';
import { inviteUsable } from '@/lib/invite-status';

/**
 * The portal offers an access link's QR code again only while the link still
 * opens the trip (24 Sep 2026). A used link keeps working for everyone on the
 * booking until its date, so "Installed" alone does not mean it works.
 */

const NOW = Date.parse('2026-09-24T09:00:00Z');

describe('inviteUsable', () => {
  it('a link nobody has used yet works until its date', () => {
    expect(inviteUsable('pending', '2026-10-23T15:50:57Z', NOW)).toBe(true);
    expect(inviteUsable('pending', '2026-09-01T00:00:00Z', NOW)).toBe(false);
  });

  it('a used link still works for the rest of the booking until its date', () => {
    expect(inviteUsable('redeemed', '2026-10-23T15:50:57Z', NOW)).toBe(true);
  });

  it('a used link past its date does not, even though it says Installed', () => {
    expect(inviteUsable('redeemed', '2026-09-23T00:00:00Z', NOW)).toBe(false);
  });

  it('a revoked or expired link never does', () => {
    expect(inviteUsable('revoked', '2027-01-01T00:00:00Z', NOW)).toBe(false);
    expect(inviteUsable('expired', '2027-01-01T00:00:00Z', NOW)).toBe(false);
  });

  it('an unreadable date is not taken on trust', () => {
    expect(inviteUsable('pending', null, NOW)).toBe(false);
    expect(inviteUsable('pending', 'soon', NOW)).toBe(false);
  });
});
