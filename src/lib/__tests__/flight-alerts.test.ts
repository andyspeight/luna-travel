import { describe, it, expect } from 'vitest';
import {
  mapStatus,
  priorityFor,
  isMeaningfulChange,
  buildMessage,
  pushForFlightAlert,
  type FlightSnapshot,
} from '@/lib/flight-alerts';

const snap = (over: Partial<FlightSnapshot> = {}): FlightSnapshot => ({
  statusCode: 'Scheduled',
  depGate: null,
  depTerminal: null,
  baggageBelt: null,
  ...over,
});

describe('mapStatus', () => {
  it('folds both in-air states onto Departed', () => {
    expect(mapStatus('EnRoute')).toBe('Departed');
    expect(mapStatus('Departed')).toBe('Departed');
  });

  it('maps the provider spellings we do not share', () => {
    expect(mapStatus('Canceled')).toBe('Cancelled');
    expect(mapStatus('Arrived')).toBe('Landed');
    expect(mapStatus('Expected')).toBe('Scheduled');
  });

  it('never guesses at an unfamiliar status', () => {
    expect(mapStatus('SomethingNew')).toBe('Unknown');
    expect(mapStatus(undefined)).toBe('Unknown');
  });
});

describe('priorityFor', () => {
  it('treats losing the flight as urgent', () => {
    expect(priorityFor('Cancelled')).toBe('urgent');
    expect(priorityFor('Diverted')).toBe('urgent');
  });

  it('treats anything you could still act on as important', () => {
    expect(priorityFor('Boarding')).toBe('important');
    expect(priorityFor('GateClosed')).toBe('important');
    expect(priorityFor('Delayed')).toBe('important');
  });

  it('leaves the rest ordinary, so urgency still means something', () => {
    expect(priorityFor('Landed')).toBe('info');
    expect(priorityFor('CheckIn')).toBe('info');
  });
});

describe('isMeaningfulChange', () => {
  it('says nothing happened when nothing happened', () => {
    expect(isMeaningfulChange(snap(), snap())).toBe(false);
  });

  it('always reports a status change', () => {
    expect(isMeaningfulChange(snap(), snap({ statusCode: 'Delayed' }))).toBe(true);
  });

  it('reports a gate, terminal or belt being assigned', () => {
    expect(isMeaningfulChange(snap(), snap({ depGate: '22' }))).toBe(true);
    expect(isMeaningfulChange(snap(), snap({ depTerminal: '5' }))).toBe(true);
    expect(isMeaningfulChange(snap(), snap({ baggageBelt: '4' }))).toBe(true);
  });

  it('reports a gate CHANGE, which is the one people run for', () => {
    expect(isMeaningfulChange(snap({ depGate: '22' }), snap({ depGate: '23' }))).toBe(true);
  });

  it('stays quiet when the same gate is repeated', () => {
    expect(isMeaningfulChange(snap({ depGate: '22' }), snap({ depGate: '22' }))).toBe(false);
  });

  // Providers blank a field between updates. Treating that as news would fire
  // "gate 22", "gate gone", "gate 22" for one unchanged gate.
  it('ignores a field being blanked', () => {
    expect(isMeaningfulChange(snap({ depGate: '22' }), snap({ depGate: null }))).toBe(false);
    expect(isMeaningfulChange(snap({ baggageBelt: '4' }), snap({ baggageBelt: null }))).toBe(false);
  });
});

describe('buildMessage', () => {
  const noParts = {};

  it('refuses to wake a phone for a non-event', () => {
    expect(buildMessage('BA123', 'Scheduled', noParts)).toBeNull();
    expect(buildMessage('BA123', 'Unknown', noParts)).toBeNull();
  });

  it('names the gate when boarding and there is one', () => {
    const m = buildMessage('BA123', 'Boarding', { gate: '22' });
    expect(m?.body).toBe('BA123 is boarding at gate 22.');
    expect(m?.subject).toBe('Gate 22 — boarding');
  });

  // Rule 8: no gate in the data means no gate in the sentence.
  it('invents nothing when boarding with no gate', () => {
    const m = buildMessage('BA123', 'Boarding', noParts);
    expect(m?.body).toBe('BA123 is boarding now.');
    expect(m?.body).not.toMatch(/gate/i);
    expect(m?.subject).not.toMatch(/gate/i);
  });

  it('carries the belt on landing when the feed has one', () => {
    expect(buildMessage('BA123', 'Landed', { baggageBelt: '4' })?.body)
      .toBe('BA123 has landed. Baggage on belt 4.');
    expect(buildMessage('BA123', 'Landed', noParts)?.body).toBe('BA123 has landed.');
  });

  it('points a cancellation at a human', () => {
    const m = buildMessage('BA123', 'Cancelled', noParts);
    expect(m?.body).toContain('contact your agent');
    expect(m?.subject).toBe('BA123 — important');
  });

  it('puts the terminal in the subject when check-in opens', () => {
    expect(buildMessage('BA123', 'CheckIn', { depTerminal: '5' })?.subject)
      .toBe('Check-in open — Terminal 5');
  });

  it("prefers the provider's own wording, which knows the specifics", () => {
    const m = buildMessage('BA123', 'Delayed', noParts, 'BA123 is delayed by 40 minutes.');
    expect(m?.body).toBe('BA123 is delayed by 40 minutes.');
    // The subject is still ours — the summary replaces the sentence, not the headline.
    expect(m?.subject).toBe('BA123 update');
  });

  it('ignores an empty summary rather than sending a blank notification', () => {
    expect(buildMessage('BA123', 'Delayed', noParts, '   ')?.body)
      .toBe('BA123 is delayed. Check the app for the latest time.');
  });
});

describe('pushForFlightAlert', () => {
  const base = { flightLegId: 'leg-1', body: 'BA123 is delayed.', priority: 'important' as const };

  it('is titled with the agency, because that is who the traveller booked with', () => {
    expect(pushForFlightAlert({ ...base, agencyName: 'Your Ticket Genie' }).title)
      .toBe('Your Ticket Genie');
  });

  it('falls back rather than showing an empty title', () => {
    expect(pushForFlightAlert({ ...base, agencyName: null }).title).toBe('Your travel agent');
    expect(pushForFlightAlert({ ...base, agencyName: '   ' }).title).toBe('Your travel agent');
    expect(pushForFlightAlert({ ...base, agencyName: undefined }).title).toBe('Your travel agent');
  });

  it('lands on the flight, not on a list', () => {
    expect(pushForFlightAlert({ ...base, agencyName: 'A' }).url).toBe('/flight/leg-1');
  });

  it('escapes a leg id so an odd supplier reference cannot break the link', () => {
    const p = pushForFlightAlert({ ...base, agencyName: 'A', flightLegId: 'leg 1/2' });
    expect(p.url).toBe('/flight/leg%201%2F2');
  });

  // The dedupe property: one row per flight on the phone, updated in place,
  // however many times the flight changes.
  it('gives every update for one leg the same tag', () => {
    const gate = pushForFlightAlert({ ...base, agencyName: 'A', body: 'Gate 22.' });
    const delay = pushForFlightAlert({ ...base, agencyName: 'A', body: 'Delayed.' });
    expect(gate.tag).toBe(delay.tag);
  });

  it('gives different legs different tags, so two flights do not overwrite each other', () => {
    const outbound = pushForFlightAlert({ ...base, agencyName: 'A', flightLegId: 'leg-1' });
    const inbound = pushForFlightAlert({ ...base, agencyName: 'A', flightLegId: 'leg-2' });
    expect(outbound.tag).not.toBe(inbound.tag);
  });

  it('only buzzes through a locked screen when it is worth it', () => {
    expect(pushForFlightAlert({ ...base, agencyName: 'A', priority: 'urgent' }).urgent).toBe(true);
    expect(pushForFlightAlert({ ...base, agencyName: 'A', priority: 'important' }).urgent).toBe(true);
    expect(pushForFlightAlert({ ...base, agencyName: 'A', priority: 'info' }).urgent).toBe(false);
  });
});
