/**
 * POST /api/trip-access — "email me my trip link".
 *
 * Public and unauthenticated by design: a traveller who has lost their invite
 * link enters their email address, and if it matches a trip we hold we mail
 * them the link. Nothing is granted here — possession of the mailbox is the
 * authentication.
 *
 * THE RESPONSE IS ALWAYS THE SAME. Confirming that an address did or did not
 * match would turn this into an oracle for whether someone is a travel
 * agency's customer, and by extension that they are going away. Matched,
 * unmatched, rate-limited, mail provider down — the caller sees one reply. The
 * only 4xx is for input that is not an email address at all, which reveals
 * nothing about anybody.
 */

import { NextRequest, NextResponse } from 'next/server';
import {
  checkRateLimit,
  findTripsForEmail,
  hashValue,
  isEmailLike,
  resolveInviteId,
  sendTripAccessEmail,
} from '@/lib/trip-access';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** The one and only successful reply. */
const GENERIC = {
  ok: true,
  message: "If that address has a trip with us, we've just sent the link to it.",
};

export async function POST(req: NextRequest) {
  let body: { email?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!email || email.length > 254 || !isEmailLike(email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  // Everything past validation is inside ONE try with a single exit, so that a
  // throw anywhere — database down, mail provider down — is indistinguishable
  // from "no match". A 500 escaping here would itself be a signal.
  try {
    // x-forwarded-for is a list; the client is the first entry.
    const ip = (req.headers.get('x-forwarded-for') || '').split(',')[0].trim();
    const allowed = await checkRateLimit(hashValue(email), ip ? hashValue(ip) : null);

    if (allowed) {
      const grouped = await findTripsForEmail(email);
      // One email per agency: a traveller who has booked with two of our
      // agencies gets two separately-branded emails, not one mixed list.
      for (const [agencyId, trips] of grouped) {
        const resolved: Array<{ trip: (typeof trips)[number]; inviteId: string }> = [];
        for (const trip of trips) {
          const inviteId = await resolveInviteId(trip, email);
          if (inviteId) resolved.push({ trip, inviteId });
        }
        if (resolved.length) await sendTripAccessEmail(email, agencyId, resolved);
      }
    }
  } catch (e) {
    // Log, but never let the caller tell a failure from a miss.
    console.error('[trip-access] lookup/send failed', e instanceof Error ? e.message : e);
  }

  return NextResponse.json(GENERIC);
}
