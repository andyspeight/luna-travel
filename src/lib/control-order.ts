/**
 * Control order retrieval — per-agency Travelify, server-only.
 *
 * Architecture (28 May): Control (id.travelify.io) is the single source of truth
 * for clients AND their Travelify credentials. Tools never handle raw agency
 * keys — they ask Control's internal endpoint, keyed by the agency's Control
 * record id, and Control resolves that agency's own credentials, calls Travelify
 * and returns a trimmed order. Auth is the service key X-TG-Internal-Key, so this
 * works in no-session contexts (cron, public redeem). The live booking fetch
 * (api/traveller/booking) already uses this path; this centralises it.
 *
 * Fallback: when TG_INTERNAL_KEY is not configured (e.g. local dev) we fall back
 * to the legacy demo integration in src/lib/travelify.ts, so nothing regresses.
 */

import { lookupBooking } from '@/lib/travelify';
import { orderToBooking, type TrimmedOrder, type ControlAgency } from '@/lib/order-to-booking';

const CONTROL_HOST = 'https://id.travelify.io';
const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;

export function controlInternalConfigured(): boolean {
  return !!process.env.TG_INTERNAL_KEY;
}

export interface ControlOrderResult {
  ok: boolean;
  status: number; // 200 ok · 404 not found · 5xx upstream · 0 not configured / bad input
  order?: TrimmedOrder;
  agency?: ControlAgency | null;
}

/** Ask Control for an order using a specific agency's own Travelify credentials. */
export async function retrieveOrderByClient(input: {
  recordId: string;
  orderRef: string;
  email: string;
  departDate: string;
}): Promise<ControlOrderResult> {
  const key = process.env.TG_INTERNAL_KEY;
  if (!key) {
    console.warn('[control-order] TG_INTERNAL_KEY is not set — falling back to the legacy demo lookup, which does not know real bookings');
    return { ok: false, status: 0 };
  }
  if (!REC_ID_RE.test(input.recordId) || !input.orderRef || !input.email) {
    console.warn('[control-order] rejected before calling Control', {
      recordIdValid: REC_ID_RE.test(input.recordId),
      hasOrderRef: !!input.orderRef,
      hasEmail: !!input.email,
    });
    return { ok: false, status: 0 };
  }

  try {
    const res = await fetch(`${CONTROL_HOST}/api/internal/retrieve-order-by-client`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-TG-Internal-Key': key },
      body: JSON.stringify({
        recordId: input.recordId,
        orderRef: input.orderRef,
        emailAddress: input.email,
        departDate: (input.departDate || '').slice(0, 10),
      }),
      cache: 'no-store',
      signal: AbortSignal.timeout(14_000),
    });
    if (res.status === 404) {
      // Control reached Travelify, but nothing matched the ref/email/date trio.
      // This is the "traveller mistyped something" case. No body logged: a
      // not-found response can echo the details that were searched for.
      console.warn('[control-order] no matching order', { recordId: input.recordId, orderRef: input.orderRef });
      return { ok: false, status: 404 };
    }
    if (!res.ok) {
      // Anything else is a Control or credentials problem rather than a
      // traveller typo, and the body carries the reason — e.g. the client
      // having no Travelify App ID, which cost us hours to find the first time
      // precisely because this status was being discarded.
      const detail = await res.text().catch(() => '');
      console.error('[control-order] Control call failed', res.status, detail.slice(0, 200));
      return { ok: false, status: res.status };
    }
    const json = (await res.json()) as { order?: TrimmedOrder; agency?: ControlAgency | null };
    if (!json?.order?.id) {
      console.warn('[control-order] Control returned 200 with no order', { recordId: input.recordId, orderRef: input.orderRef });
      return { ok: false, status: 404 };
    }
    return { ok: true, status: 200, order: json.order, agency: json.agency ?? null };
  } catch (e) {
    console.error('[control-order] Control call threw', e instanceof Error ? e.message : e);
    return { ok: false, status: 502 };
  }
}

export interface ValidatedBooking {
  leadName: string | null;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
  /** ISO-2 of the destination country — the key for the hero photograph. */
  countryCode: string | null;
  /** Optional city/region within that country, for a more specific photo. */
  locationSlug: string | null;
}

/**
 * Validate that a booking exists for an agency (used by invite redemption and
 * anywhere we need to confirm a booking + pull a teaser). Prefers the per-agency
 * Control path; falls back to the demo integration only when the internal path
 * is not configured. Returns normalised fields regardless of which path ran.
 */
export async function validateAgencyBooking(input: {
  agencyId: string;
  bookingRef: string;
  email: string;
  departureDate: string;
}): Promise<{ ok: true; booking: ValidatedBooking } | { ok: false }> {
  if (controlInternalConfigured()) {
    const r = await retrieveOrderByClient({
      recordId: input.agencyId,
      orderRef: input.bookingRef,
      email: input.email,
      departDate: input.departureDate,
    });
    if (!r.ok || !r.order) {
      console.warn('[validate-booking] no order from Control', {
        agencyId: input.agencyId,
        bookingRef: input.bookingRef,
        status: r.status,
      });
      return { ok: false };
    }
    const mapped = orderToBooking(r.order, r.agency ?? null, input.bookingRef);
    if (!mapped) {
      console.warn('[validate-booking] order found but could not be mapped', {
        agencyId: input.agencyId,
        bookingRef: input.bookingRef,
      });
      return { ok: false };
    }
    const lead = mapped.travellers.find((t) => t.isLead) ?? mapped.travellers[0];
    return {
      ok: true,
      booking: {
        leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() || null : null,
        departureDate: mapped.tripStart ? mapped.tripStart.slice(0, 10) : null,
        returnDate: mapped.tripEnd ? mapped.tripEnd.slice(0, 10) : null,
        destination: mapped.destinationLabel || null,
        countryCode: mapped.primaryCountryCode || null,
        locationSlug: mapped.locationSlug || null,
      },
    };
  }

  // Legacy demo path (only when the per-agency internal path isn't configured).
  const lookup = await lookupBooking({
    bookingRef: input.bookingRef,
    email: input.email,
    departureDate: input.departureDate,
  });
  if (!lookup.ok) {
    console.warn('[validate-booking] legacy demo lookup found nothing', { bookingRef: input.bookingRef });
    return { ok: false };
  }
  const b = lookup.booking;
  return {
    ok: true,
    booking: {
      leadName: [b.customerFirstname, b.customerSurname].filter(Boolean).join(' ').trim() || null,
      departureDate: b.departureDate,
      returnDate: b.returnDate,
      destination: b.destination,
      // The legacy demo lookup carries no structured destination keys.
      countryCode: null,
      locationSlug: null,
    },
  };
}
