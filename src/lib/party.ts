/**
 * Who, out of the people on a booking, this traveller is.
 *
 * Until now a booking had exactly one traveller row, keyed
 * (agency_id, booking_ref). Whoever redeemed first owned the whole booking:
 * their partner following the same link was silently handed THEIR record, so
 * every reply to the agent came from one name, "revoke" was all-or-nothing, and
 * you could not tell who had opened anything.
 *
 * The Travelify order already carries the real passenger manifest, so a party
 * member can identify themselves off it rather than inventing an identity.
 *
 * WHY NOT KEY ON EMAIL. It is the obvious choice and it is wrong here. The
 * knowledge check is ref + email + departure date, and Travelify only matches
 * the email held on the ORDER — so everyone in the party types the same address.
 * Keying on it would collapse the whole family back into one row, which is the
 * bug. The person is the key; the email is just what they authenticated with.
 */

import type { Booking, Traveller, TravellerType } from '@/types/booking';

export interface PartyMember {
  /** Stable within a booking. See paxRef. */
  ref: string;
  name: string;
  type: TravellerType;
  isLead: boolean;
}

/**
 * A stable key for one person on a booking.
 *
 * Derived from the name rather than the manifest position, because position is
 * not stable: `orderToBooking` numbers passengers `trv-0`, `trv-1`… in whatever
 * order Travelify returned them, and a reorder would silently point an existing
 * traveller row at a different human being.
 *
 * Everything that is not a letter or digit goes, so "O'Neill", "O Neill" and
 * "ONeill" are one person — suppliers are not consistent about punctuation, and
 * a traveller who came back to a slightly differently-punctuated manifest would
 * otherwise get a second record.
 *
 * Two people with genuinely identical names on one booking share a key. That is
 * accepted: it is rare, and merging them is a far better failure than handing
 * one of them a stranger's record.
 */
export function paxRef(firstName: string, lastName = ''): string {
  const key = `${firstName || ''}${lastName || ''}`.toLowerCase().replace(/[^a-z0-9]+/g, '');
  return key || 'traveller';
}

/** The same key for a name we only hold as one string (a legacy row). */
export function paxRefFromFullName(fullName: string): string {
  return paxRef(fullName);
}

export function displayName(t: Pick<Traveller, 'firstName' | 'lastName'>): string {
  return `${t.firstName || ''} ${t.lastName || ''}`.trim();
}

/**
 * The party on a booking, ready to be offered as "which of you is this?".
 *
 * Deduplicated by ref so the picker never shows the same person twice, and the
 * lead sorts first because they are usually the one redeeming.
 */
export function partyFromBooking(booking: Booking | null | undefined): PartyMember[] {
  const seen = new Set<string>();
  const out: PartyMember[] = [];

  for (const t of booking?.travellers ?? []) {
    const name = displayName(t);
    if (!name) continue; // an unnamed manifest row is nobody to choose
    const ref = paxRef(t.firstName, t.lastName);
    if (seen.has(ref)) continue;
    seen.add(ref);
    out.push({ ref, name, type: t.type, isLead: !!t.isLead });
  }

  out.sort((a, b) => (a.isLead === b.isLead ? 0 : a.isLead ? -1 : 1));
  return out;
}

/**
 * Resolve the person a redemption is for.
 *
 * `chosen` is the ref the traveller picked. Returns null when the party has
 * several people and none has been chosen yet — the caller then asks.
 */
export function resolvePartyMember(party: PartyMember[], chosen?: string | null): PartyMember | null {
  if (chosen) return party.find((p) => p.ref === chosen) ?? null;
  // Nobody to choose between: a solo booking, or a manifest we could not read.
  // Never guess when there is a real choice to make — picking for someone is
  // how the old single-row behaviour went wrong in the first place.
  return party.length === 1 ? party[0] : null;
}

/** Does this booking need the traveller to say who they are? */
export function needsIdentity(party: PartyMember[], chosen?: string | null): boolean {
  return party.length > 1 && !party.some((p) => p.ref === chosen);
}

/**
 * The party, guaranteed non-empty.
 *
 * Not every booking yields a manifest: the legacy demo lookup carries none, and
 * a sparse Travelify order can have an empty travellers array. Those bookings
 * worked before this feature and must keep working, so they become a party of
 * one built from whatever name we do have — which also means they never see the
 * "which of you is this?" step.
 */
export function partyOrFallback(party: PartyMember[], leadName?: string | null): PartyMember[] {
  if (party.length) return party;
  const name = (leadName || '').trim();
  return [{ ref: name ? paxRefFromFullName(name) : 'traveller', name, type: 'adult', isLead: true }];
}
