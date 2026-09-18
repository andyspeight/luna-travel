import { describe, it, expect } from 'vitest';
import { bookingAnswer, signpostAnswer } from '@/lib/luna-booking';
import type { Booking } from '@/types/booking';

const BASE: Booking = {
  reference: 'YTG58405',
  status: 'confirmed',
  leadEmail: 'tracy@example.com',
  destinationLabel: 'Maldives',
  primaryCountryCode: 'MV',
  tripStart: '2026-11-27',
  tripEnd: '2026-12-04',
  tripStartEvent: 'flight',
  durationLabel: '7 nights',
  travellers: [
    { id: 't1', firstName: 'Tracy', lastName: 'Adams', type: 'adult', isLead: true },
    { id: 't2', firstName: 'Mark', lastName: 'Adams', type: 'adult', isLead: false },
    { id: 't3', firstName: 'Ellie', lastName: 'Adams', type: 'child', isLead: false },
  ],
  flights: [
    {
      id: 'f1',
      carrierCode: 'EY',
      carrierName: 'Etihad',
      flightNumber: '20',
      cabin: 'Economy',
      depAirport: 'LGW',
      depAirportName: 'Gatwick',
      depCity: 'London',
      depTime: '2026-11-27T21:40:00Z',
      depTerminal: 'North',
      arrAirport: 'AUH',
      arrAirportName: 'Abu Dhabi',
      arrCity: 'Abu Dhabi',
      arrTime: '2026-11-28T07:55:00Z',
      arrTerminal: 'A',
      durationMinutes: 375,
      baggageAllowance: '23kg checked, 7kg cabin',
    },
    {
      id: 'f2',
      carrierCode: 'EY',
      carrierName: 'Etihad',
      flightNumber: '21',
      cabin: 'Economy',
      depAirport: 'AUH',
      depAirportName: 'Abu Dhabi',
      depCity: 'Abu Dhabi',
      depTime: '2026-12-04T09:10:00Z',
      arrAirport: 'LGW',
      arrAirportName: 'Gatwick',
      arrCity: 'London',
      arrTime: '2026-12-04T13:30:00Z',
      durationMinutes: 440,
      baggageAllowance: '23kg checked, 7kg cabin',
    },
  ],
  hotels: [
    {
      id: 'h1',
      name: 'Avyanna Gulhi Beach Hotel',
      city: 'Gulhi',
      country: 'Maldives',
      countryCode: 'MV',
      checkIn: '2026-11-28',
      checkOut: '2026-12-04',
      nights: 6,
      roomName: 'Deluxe Sea View',
      boardBasis: 'BedAndBreakfast',
    },
  ],
  airportExtras: [
    {
      id: 'x1',
      type: 'lounge',
      name: 'No1 Lounge South Terminal',
      airport: 'LGW',
      date: '2026-11-27',
      time: '17:00',
      guests: 3,
    },
  ],
  experiences: [],
  documents: [
    { id: 'd1', name: 'Booking pack', kind: 'booking-pack', url: '#', updatedAt: '2026-09-01' },
  ],
  payment: { currency: 'GBP', total: 6400, deposit: 800, balance: 5600, balanceDueDate: '2026-09-27' },
  agency: { name: 'Your Ticket Genie', phone: '01234 567890', email: 'hello@ytg.co.uk' },
};

const ask = (q: string, booking: Booking = BASE) => bookingAnswer(q, booking);

describe('flight times', () => {
  it('answers what time we land, with the airport', () => {
    const r = ask('what time do we land?');
    expect(r?.text).toContain('EY20');
    expect(r?.text).toContain('Abu Dhabi');
    // Times are local to the airport, and it says so rather than leaving it open.
    expect(r?.text).toMatch(/local to the airport/);
  });

  it('answers what time we take off, with the terminal', () => {
    const r = ask('what time do we take off?');
    expect(r?.text).toContain('EY20');
    expect(r?.text).toContain('Terminal North');
  });

  it('gives the return leg when the question is about coming home', () => {
    expect(ask('what time do we land back home?')?.text).toContain('EY21');
  });
});

describe('baggage', () => {
  it('quotes the allowance from the booking', () => {
    expect(ask('how much luggage can I take?')?.text).toContain('23kg checked');
  });

  // Rule 8: the airline's general rules may not be the ones sold.
  it('refuses to invent an allowance the booking does not carry', () => {
    const noBags: Booking = {
      ...BASE,
      flights: BASE.flights.map((f) => ({ ...f, baggageAllowance: undefined })),
    };
    const r = ask('what is my baggage allowance?', noBags);
    expect(r?.text).toMatch(/does not list a baggage allowance/);
    expect(r?.text).not.toMatch(/\d+ ?kg/);
  });
});

describe('the hotel', () => {
  it('answers check-out', () => {
    expect(ask('what time is check out?')?.text).toContain('Avyanna Gulhi Beach Hotel');
  });

  it('answers hotel check-in with the number of nights', () => {
    expect(ask('when do we check in to the hotel?')?.text).toContain('6 nights');
  });

  // "online check-in" is a FLIGHT question and must reach Luna's own branch.
  it('does not steal online flight check-in', () => {
    expect(ask('online check-in time?')).toBeNull();
    expect(ask('when does check-in open for the flight?')).toBeNull();
  });

  it('names the room and the board', () => {
    const r = ask("what room have we got and what's included?");
    expect(r?.text).toContain('Deluxe Sea View');
    expect(r?.text.toLowerCase()).toContain('bed');
  });

  it('says nothing about board when the supplier said Unknown', () => {
    const unknown: Booking = {
      ...BASE,
      hotels: [{ ...BASE.hotels[0], boardBasis: 'Unknown' as never }],
    };
    expect(ask('what room are we in?', unknown)?.text).not.toMatch(/on unknown/i);
  });

  it('says where the hotel is', () => {
    expect(ask('where is the hotel?')?.text).toContain('Gulhi');
  });
});

describe('the party', () => {
  it('lists who is on the booking', () => {
    const r = ask("who's on the booking?");
    expect(r?.text).toContain('Tracy Adams');
    expect(r?.text).toContain('2 adults');
    expect(r?.text).toContain('1 child');
  });
});

describe('extras', () => {
  it('finds the lounge', () => {
    expect(ask('lounge access details')?.text).toContain('No1 Lounge');
  });

  it('is straight about a transfer that was not booked', () => {
    const r = ask('is there a transfer from the airport?');
    expect(r?.text).toMatch(/no transfer on your booking/i);
  });

  it('reads a transfer that was', () => {
    const withTransfer: Booking = {
      ...BASE,
      experiences: [
        { id: 'e1', kind: 'transfer', title: 'Speedboat to Gulhi', startDate: '2026-11-28', time: '10:30', supplier: 'Maldives Transfers' },
      ],
    };
    expect(ask('how do we get from the airport?', withTransfer)?.text).toContain('Speedboat to Gulhi');
  });
});

describe('money', () => {
  it('gives the balance and when it is due', () => {
    const r = ask('how much do I still owe?');
    expect(r?.text).toMatch(/5,600/);
    expect(r?.text).toMatch(/27 Sep/);
  });
});

describe('documents', () => {
  it('says what is there', () => {
    expect(ask('where are my tickets?')?.text).toContain('Booking pack');
  });

  it('is honest when nothing has been uploaded', () => {
    const none: Booking = { ...BASE, documents: [] };
    expect(ask('where are my documents?', none)?.text).toMatch(/Nothing has been uploaded/);
  });
});

describe('how long', () => {
  it('reads the trip length off the booking', () => {
    expect(ask('how many nights are we there?')?.text).toContain('7 nights');
  });
});

// The whole point of returning null: the caller then offers the agent rather
// than this inventing something.
describe('what it refuses', () => {
  it('will not say whether the hotel is near the beach', () => {
    // The booking does not carry it, however reasonable the question.
    expect(ask('is the hotel near the beach?')).toBeNull();
  });

  it('will not answer a kids club or a cot', () => {
    expect(ask('is there a kids club?')).toBeNull();
    expect(ask('can I get a cot for the baby?')).toBeNull();
  });

  it('leaves the destination questions alone', () => {
    for (const q of ['do I need a visa', "what's the weather like", 'what plug do I need']) {
      expect(ask(q), q).toBeNull();
    }
  });
});

describe('a thin booking', () => {
  const thin: Booking = {
    ...BASE,
    flights: [],
    hotels: [],
    airportExtras: [],
    documents: [],
    payment: undefined,
  };

  it('declines rather than half-answering', () => {
    for (const q of ['what time do we land', 'what time is check out', 'how much do I owe', 'where are my tickets']) {
      const r = ask(q, thin);
      // Documents is allowed to answer "nothing uploaded yet"; the rest must not.
      if (q.includes('tickets')) expect(r?.text).toMatch(/Nothing has been uploaded/);
      else expect(r, q).toBeNull();
    }
  });

  it('still knows who is going and how long for', () => {
    expect(ask("who's on the booking", thin)?.text).toContain('Tracy');
    expect(ask('how many nights', thin)?.text).toContain('7 nights');
  });
});

describe('signposting what nobody here can answer', () => {
  const sign = (q: string, booking: Booking = BASE) => signpostAnswer(q, booking);

  it('sends hotel facilities to the hotel, by name', () => {
    const r = sign('is there a kids club?');
    expect(r?.text).toContain('Avyanna Gulhi Beach Hotel');
    expect(r?.text).toContain('Your Ticket Genie');
  });

  it('shows the special requests already on the booking', () => {
    const withRequests: Booking = {
      ...BASE,
      hotels: [{ ...BASE.hotels[0], specialRequests: 'Cot requested. Twin beds.' }],
    };
    expect(sign('can I get a cot?', withRequests)?.text).toContain('Cot requested');
  });

  it('routes a change to the agent, with the reference to quote', () => {
    const r = sign('can I change my flight?');
    expect(r?.text).toContain('YTG58405');
    expect(r?.text).toContain('Your Ticket Genie');
  });

  it('points at the policy when there is one', () => {
    const insured: Booking = {
      ...BASE,
      documents: [{ id: 'i1', name: 'Travel insurance summary', kind: 'insurance', url: '#', updatedAt: '2026-09-01' }],
    };
    expect(sign('am I covered for cancellation?', insured)?.text).toContain('Travel insurance summary');
  });

  it('is straight when there is no policy', () => {
    expect(sign('am I insured?')?.text).toMatch(/no insurance document/i);
  });

  // It routes; it does not answer. Nothing here may assert a fact about the
  // hotel, because the booking does not carry one.
  it('never claims to know the facility itself', () => {
    const r = sign('is there a gym and a spa?');
    expect(r?.text).not.toMatch(/\byes\b|\bno\b,|there is a/i);
  });

  it('leaves everything it has no business with alone', () => {
    for (const q of ['what time do we land', 'do I need a visa', 'how much do I owe']) {
      expect(sign(q), q).toBeNull();
    }
  });
});
