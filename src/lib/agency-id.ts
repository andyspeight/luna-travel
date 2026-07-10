/**
 * Agency identifiers.
 *
 * An "agency" in Luna Travel can come from two sources:
 *   - Control (Travelgenix ID): a Clients record, id `rec` + 14 chars (Airtable).
 *   - Luna-native: an agency created directly in Luna Travel (for non-Travelgenix
 *     clients — stage 2), id `lt` + 14 chars, stored in luna_travel.agencies.
 *
 * Both are valid agency ids and flow through the same agency-scoped features
 * (branding, off-platform bookings, invites, travellers, documents…). Control
 * agencies additionally have Travelify credentials and Control-managed branding;
 * Luna-native agencies are off-platform only.
 *
 * The prefix is the source of truth for which store to resolve against — never
 * infer source any other way.
 */

const CONTROL_RE = /^rec[A-Za-z0-9]{14}$/;
const LUNA_RE = /^lt[A-Za-z0-9]{14}$/;

/** Any valid agency id (Control or Luna-native). */
export const AGENCY_ID_RE = /^(?:rec|lt)[A-Za-z0-9]{14}$/;

export function isAgencyId(id: unknown): id is string {
  return typeof id === 'string' && AGENCY_ID_RE.test(id);
}

/** A Control (Travelgenix) client id (`rec…`). */
export function isControlAgency(id: unknown): id is string {
  return typeof id === 'string' && CONTROL_RE.test(id);
}

/** A Luna-native agency id (`lt…`). */
export function isLunaAgency(id: unknown): id is string {
  return typeof id === 'string' && LUNA_RE.test(id);
}

const ID_ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';

/** Mint a new Luna-native agency id: `lt` + 14 base62 chars. */
export function newLunaAgencyId(): string {
  const bytes = new Uint8Array(14);
  crypto.getRandomValues(bytes);
  let s = '';
  for (let i = 0; i < 14; i++) s += ID_ALPHABET[bytes[i] % ID_ALPHABET.length];
  return `lt${s}`;
}
