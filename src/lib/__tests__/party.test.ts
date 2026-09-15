import { describe, it, expect } from 'vitest';
import {
  paxRef, paxRefFromFullName, partyFromBooking, resolvePartyMember, needsIdentity,
  type PartyMember,
} from '@/lib/party';
import type { Booking, Traveller } from '@/types/booking';

function pax(firstName: string, lastName: string, isLead = false): Traveller {
  return { id: `trv-${firstName}`, firstName, lastName, type: 'adult', isLead };
}

function booking(travellers: Traveller[]): Booking {
  return { travellers } as unknown as Booking;
}

describe('paxRef', () => {
  it('is stable across punctuation and case, which suppliers are not', () => {
    const forms = ["O'Neill", 'O Neill', 'ONeill', 'o’neill'];
    const refs = new Set(forms.map((last) => paxRef('Sinead', last)));
    expect(refs.size).toBe(1);
  });

  it('does not depend on manifest position', () => {
    // The whole point: trv-0 can become trv-1 when Travelify reorders, and a
    // positional key would then point an existing row at a different person.
    expect(paxRef('Daniel', 'Davison')).toBe(paxRef('Daniel', 'Davison'));
    expect(paxRef('Daniel', 'Davison')).not.toBe(paxRef('Tracy', 'Davison'));
  });

  it('agrees with the one-string form used to backfill legacy rows', () => {
    expect(paxRefFromFullName('Daniel Davison')).toBe(paxRef('Daniel', 'Davison'));
  });

  it('never returns an empty key', () => {
    expect(paxRef('', '')).toBe('traveller');
    expect(paxRef('...', '!!')).toBe('traveller');
  });

  it('keeps digits, which some manifests carry', () => {
    expect(paxRef('John', 'Smith 2nd')).toBe('johnsmith2nd');
  });
});

describe('partyFromBooking', () => {
  it('puts the lead first, wherever they sit in the manifest', () => {
    const party = partyFromBooking(
      booking([pax('Tracy', 'Davison'), pax('Daniel', 'Davison', true), pax('Mia', 'Davison')]),
    );
    expect(party[0].name).toBe('Daniel Davison');
    expect(party.map((p) => p.name)).toHaveLength(3);
  });

  it('drops manifest rows with no name — they are nobody to choose', () => {
    const party = partyFromBooking(booking([pax('Daniel', 'Davison', true), pax('', '')]));
    expect(party).toHaveLength(1);
  });

  it('shows one entry per person even if the manifest repeats them', () => {
    const party = partyFromBooking(booking([pax('Daniel', 'Davison', true), pax('Daniel', 'Davison')]));
    expect(party).toHaveLength(1);
  });

  it('is empty for a booking with no manifest at all', () => {
    expect(partyFromBooking(booking([]))).toEqual([]);
    expect(partyFromBooking(null)).toEqual([]);
  });
});

describe('resolvePartyMember', () => {
  const party: PartyMember[] = [
    { ref: 'danieldavison', name: 'Daniel Davison', type: 'adult', isLead: true },
    { ref: 'miadavison', name: 'Mia Davison', type: 'child', isLead: false },
  ];

  it('returns the person who was chosen', () => {
    expect(resolvePartyMember(party, 'miadavison')?.name).toBe('Mia Davison');
  });

  it('never guesses when there is a real choice', () => {
    // Choosing for somebody is exactly how one person ended up owning a whole
    // booking under the old model.
    expect(resolvePartyMember(party)).toBeNull();
  });

  it('needs no choice when the booking has one traveller', () => {
    expect(resolvePartyMember([party[0]])?.name).toBe('Daniel Davison');
  });

  it('rejects a ref that is not on this booking', () => {
    expect(resolvePartyMember(party, 'someoneelse')).toBeNull();
  });

  it('returns null rather than inventing someone when the manifest is empty', () => {
    expect(resolvePartyMember([], 'anything')).toBeNull();
    expect(resolvePartyMember([])).toBeNull();
  });
});

describe('needsIdentity', () => {
  const party: PartyMember[] = [
    { ref: 'a', name: 'A', type: 'adult', isLead: true },
    { ref: 'b', name: 'B', type: 'adult', isLead: false },
  ];

  it('asks when several people share the booking and none is chosen', () => {
    expect(needsIdentity(party)).toBe(true);
  });

  it('stops asking once a valid person is chosen', () => {
    expect(needsIdentity(party, 'b')).toBe(false);
  });

  it('asks again if the choice is not on the booking', () => {
    expect(needsIdentity(party, 'nobody')).toBe(true);
  });

  it('never asks a solo traveller', () => {
    expect(needsIdentity([party[0]])).toBe(false);
    expect(needsIdentity([])).toBe(false);
  });
});
