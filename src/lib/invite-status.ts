/**
 * Whether an access link still opens the trip.
 *
 * A link belongs to the booking, not to one person: once used ("Installed")
 * it still lets anyone on the booking in, on any device, by confirming the
 * booking details (api/invites/[id]/redeem). What closes it is being revoked
 * or passing its expiry date, whichever its status says. So a used link past
 * its date is dead even though the list still calls it "Installed", and the
 * portal must not offer its QR code as if it worked.
 */
export function inviteUsable(status: string, expiresAt: string | null | undefined, now = Date.now()): boolean {
  if (status !== 'pending' && status !== 'redeemed') return false;
  const t = Date.parse(expiresAt || '');
  return Number.isFinite(t) && t > now;
}
