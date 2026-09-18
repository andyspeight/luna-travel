/**
 * Luna Travel — what a flight update MEANS.
 *
 * Pure decision logic, lifted out of /api/flights/webhook so it can be tested
 * without a provider, a database or a browser: given the previous state of a
 * leg and what AeroDataBox now says, decide whether it is worth telling anyone,
 * what to say, and how loudly to say it.
 *
 * The webhook keeps the I/O — token check, row updates, message rows, sending —
 * and nothing here touches either.
 *
 * Rule 8: every sentence is built from fields the provider actually sent. A
 * missing gate produces a sentence with no gate in it, never "gate TBC".
 */

import type { FlightStatusCode } from '@/types/booking';
import type { PushPayload } from '@/lib/push';

export type AlertPriority = 'info' | 'important' | 'urgent';

/** The fields a change is judged on. Everything else is detail, not news. */
export interface FlightSnapshot {
  statusCode: FlightStatusCode;
  depGate: string | null;
  depTerminal: string | null;
  baggageBelt: string | null;
}

/** Map an AeroDataBox FlightStatus onto ours. Anything unrecognised is Unknown. */
export function mapStatus(s?: string): FlightStatusCode {
  switch (s) {
    case 'CheckIn': return 'CheckIn';
    case 'Boarding': return 'Boarding';
    case 'GateClosed': return 'GateClosed';
    case 'EnRoute':
    case 'Departed': return 'Departed';
    case 'Delayed': return 'Delayed';
    case 'Approaching': return 'Approaching';
    case 'Arrived': return 'Landed';
    case 'Canceled': return 'Cancelled';
    case 'Diverted': return 'Diverted';
    case 'CanceledUncertain': return 'CancelledUncertain';
    case 'Expected': return 'Scheduled';
    default: return 'Unknown';
  }
}

/** How insistently to present it. Everything urgent survives a locked screen. */
export function priorityFor(status: FlightStatusCode): AlertPriority {
  if (status === 'Cancelled' || status === 'Diverted') return 'urgent';
  if (status === 'Boarding' || status === 'GateClosed' || status === 'Delayed') return 'important';
  return 'info';
}

/**
 * Is this news, or a no-op tick?
 *
 * A status change is always news. A gate, terminal or belt only counts when the
 * new value exists: providers routinely blank a gate between updates, and
 * "gate 22" → nothing → "gate 22" must not fire three notifications.
 */
export function isMeaningfulChange(prev: FlightSnapshot, next: FlightSnapshot): boolean {
  if (prev.statusCode !== next.statusCode) return true;
  if (!!next.depGate && prev.depGate !== next.depGate) return true;
  if (!!next.depTerminal && prev.depTerminal !== next.depTerminal) return true;
  if (!!next.baggageBelt && prev.baggageBelt !== next.baggageBelt) return true;
  return false;
}

/**
 * The sentence a traveller reads. Returns null when the status alone is not
 * worth anyone's attention — Scheduled and Unknown are states, not events.
 *
 * `summary` is the provider's own wording. Where it gives one it is better than
 * ours, because it knows the specifics ("delayed by 40 minutes").
 */
export function buildMessage(
  carrierFlight: string,
  status: FlightStatusCode,
  parts: { gate?: string | null; depTerminal?: string | null; baggageBelt?: string | null },
  summary?: string,
): { subject: string; body: string } | null {
  const gate = parts.gate || null;
  const depTerminal = parts.depTerminal || null;
  const belt = parts.baggageBelt || null;

  let body = '';
  switch (status) {
    case 'CheckIn': body = `Check-in is open for ${carrierFlight}.`; break;
    case 'Boarding': body = gate ? `${carrierFlight} is boarding at gate ${gate}.` : `${carrierFlight} is boarding now.`; break;
    case 'GateClosed': body = `The gate for ${carrierFlight} has closed.`; break;
    case 'Delayed': body = `${carrierFlight} is delayed. Check the app for the latest time.`; break;
    case 'Departed': body = `${carrierFlight} has departed.`; break;
    case 'Approaching': body = `${carrierFlight} is on approach.`; break;
    case 'Landed': body = belt ? `${carrierFlight} has landed. Baggage on belt ${belt}.` : `${carrierFlight} has landed.`; break;
    case 'Cancelled': body = `${carrierFlight} has been cancelled. Please contact your agent.`; break;
    case 'Diverted': body = `${carrierFlight} has been diverted. Please contact your agent.`; break;
    case 'CancelledUncertain': body = `There may be a disruption to ${carrierFlight}. Check the app for updates.`; break;
    default: return null; // Scheduled/Unknown alone isn't worth waking a phone
  }
  if (summary && summary.trim().length > 0) body = summary.trim();

  let subject = `${carrierFlight} update`;
  if (status === 'Boarding' && gate) subject = `Gate ${gate} — boarding`;
  else if (depTerminal && status === 'CheckIn') subject = `Check-in open — Terminal ${depTerminal}`;
  else if (status === 'Cancelled' || status === 'Diverted') subject = `${carrierFlight} — important`;

  return { subject, body };
}

/**
 * The notification itself.
 *
 * Two deliberate choices:
 *
 * - **One tag per leg**, so a phone shows the CURRENT state of a flight rather
 *   than a history of it. Gate 22, then gate 23, then delayed is one row that
 *   keeps changing, which is what a traveller running through an airport
 *   actually needs. The service worker sets `renotify`, so a replacement still
 *   buzzes — collapsing does not mean going quiet.
 * - **It lands on that flight**, not on a notifications list. The leg page
 *   already copes with an id it cannot find (it offers the itinerary), so an
 *   old notification tapped weeks later is a dead end rather than an error.
 *
 * The title is the agency's name because the traveller's relationship is with
 * them, not with us. Where we cannot resolve a name — a Control-sourced agency
 * has one only in its session claims, which a webhook does not have — it falls
 * back to the same wording the agency message path uses.
 */
export function pushForFlightAlert(input: {
  agencyName: string | null | undefined;
  flightLegId: string;
  body: string;
  priority: AlertPriority;
}): PushPayload {
  return {
    title: (input.agencyName || '').trim() || 'Your travel agent',
    body: input.body,
    url: `/flight/${encodeURIComponent(input.flightLegId)}`,
    tag: `flight-${input.flightLegId}`,
    urgent: input.priority !== 'info',
  };
}
