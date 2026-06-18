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
  if (!key) return { ok: false, status: 0 };
  if (!REC_ID_RE.test(input.recordId) || !input.orderRef || !input.email) {
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
    if (res.status === 404) return { ok: false, status: 404 };
    if (!res.ok) return { ok: false, status: res.status };
    const json = (await res.json()) as { order?: TrimmedOrder; agency?: ControlAgency | null };
    if (!json?.order?.id) return { ok: false, status: 404 };
    return { ok: true, status: 200, order: json.order, agency: json.agency ?? null };
  } catch {
    return { ok: false, status: 502 };
  }
}

export interface ValidatedBooking {
  leadName: string | null;
  departureDate: string | null;
  returnDate: string | null;
  destination: string | null;
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
    if (!r.ok || !r.order) return { ok: false };
    const mapped = orderToBooking(r.order, r.agency ?? null, input.bookingRef);
    if (!mapped) return { ok: false };
    const lead = mapped.travellers.find((t) => t.isLead) ?? mapped.travellers[0];
    return {
      ok: true,
      booking: {
        leadName: lead ? `${lead.firstName} ${lead.lastName}`.trim() || null : null,
        departureDate: mapped.tripStart ? mapped.tripStart.slice(0, 10) : null,
        returnDate: mapped.tripEnd ? mapped.tripEnd.slice(0, 10) : null,
        destination: mapped.destinationLabel || null,
      },
    };
  }

  // Legacy demo path (only when the per-agency internal path isn't configured).
  const lookup = await lookupBooking({
    bookingRef: input.bookingRef,
    email: input.email,
    departureDate: input.departureDate,
  });
  if (!lookup.ok) return { ok: false };
  const b = lookup.booking;
  return {
    ok: true,
    booking: {
      leadName: [b.customerFirstname, b.customerSurname].filter(Boolean).join(' ').trim() || null,
      departureDate: b.departureDate,
      returnDate: b.returnDate,
      destination: b.destination,
    },
  };
}
