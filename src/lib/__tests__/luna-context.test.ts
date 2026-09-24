import { describe, it, expect } from 'vitest';
import { buildLunaContext, forbiddenStrings, type BrainFacts } from '@/lib/luna-context';
import type { Booking } from '@/types/booking';
import type { PlaceView } from '@/types/destination-content';

const BOOKING: Booking = {
  reference: 'YTG58405',
  status: 'confirmed',
  leadEmail: 'tracy.hendricks@example.com',
  destinationLabel: 'Maldives',
  primaryCountryCode: 'MV',
  tripStart: '2026-11-27',
  tripEnd: '2026-12-04',
  tripStartEvent: 'flight',
  durationLabel: '7 nights',
  travellers: [
    { id: 't1', firstName: 'Tracy', lastName: 'Hendricks', type: 'adult', isLead: true },
    { id: 't2', firstName: 'Mark', lastName: 'Hendricks', type: 'adult', isLead: false },
    { id: 't3', firstName: 'Ellie', lastName: 'Hendricks', type: 'child', isLead: false },
  ],
  flights: [
    {
      id: 'f1',
      carrierCode: 'EY',
      carrierName: 'Etihad',
      flightNumber: 'EY20',
      cabin: 'Economy',
      depAirport: 'LGW',
      depAirportName: 'London Gatwick',
      depCity: 'London',
      depTime: '2026-11-27T20:15:00Z',
      depTerminal: 'South',
      arrAirport: 'AUH',
      arrAirportName: 'Abu Dhabi',
      arrCity: 'Abu Dhabi',
      arrTime: '2026-11-28T07:25:00Z',
      durationMinutes: 430,
      baggageAllowance: '23kg checked',
      pnr: 'QR7X2K',
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
      specialRequests: 'Twin room preferred.',
    },
  ],
  airportExtras: [
    { id: 'x1', type: 'lounge', name: 'No1 Lounge', airport: 'LGW', date: '2026-11-27', time: '17:00', guests: 3 },
  ],
  experiences: [],
  documents: [{ id: 'd1', name: 'Booking pack', kind: 'booking-pack', url: '#', updatedAt: '2026-09-01' }],
  payment: { currency: 'GBP', total: 6240, deposit: 1248, balance: 4992, balanceDueDate: '2026-09-27' },
  agency: { name: 'Your Ticket Genie', phone: '01234 567890', email: 'hello@ytg.co.uk' },
};

const PLACE = {
  tier: 'country',
  slug: 'maldives',
  code: 'MV',
  trail: ['Maldives'],
  breadcrumb: 'Maldives',
  name: 'Maldives',
  heroSlug: '',
  tagline: { value: 'Overwater villas and the bluest water on earth.', tier: 'country', from: 'Maldives' },
  facts: {},
  sections: [
    { key: 'overview', tier: 'country', from: 'Maldives', body: 'A nation of 1,192 coral islands grouped into 26 atolls.' },
    { key: 'things-to-do', tier: 'country', from: 'Maldives', body: 'Snorkel a house reef. Watch the sunset from a sandbank.' },
  ],
  highlights: [{ icon: 'water', title: 'Overwater Villa', description: 'Glass floors above the reef.', tier: 'country', from: 'Maldives' }],
  events: [
    { name: 'Hanifaru Manta Season', description: 'Manta rays gather in Baa Atoll.', monthLabel: 'Aug-Nov', months: [7, 8, 9, 10], tier: 'country', from: 'Maldives' },
    { name: 'Independence Day', description: 'Parades in Male.', monthLabel: 'Jul', months: [6], tier: 'country', from: 'Maldives' },
  ],
  climate: {
    tier: 'country',
    from: 'Maldives',
    tempC: [30, 30, 31, 32, 31, 30, 30, 30, 29, 30, 30, 30],
    rainfallMm: [75, 55, 75, 125, 220, 170, 145, 175, 245, 220, 205, 215],
    season: null,
  },
  images: [],
  bestForTags: ['Honeymoons'],
  audienceTags: [],
  suggestions: [],
  parks: [],
  resolved: { resort: false, city: false, country: true },
  stale: false,
  generatedAt: '2026-09-19T00:00:00Z',
} as unknown as PlaceView;

const BRAIN: BrainFacts = {
  currency: 'Maldivian Rufiyaa (MVR)',
  tapWaterSafe: 'No',
  drivingSide: 'Left',
  emergencyNumber: '119',
  lastVerified: '2026-07-08',
};

const ctx = buildLunaContext({
  booking: BOOKING,
  place: PLACE,
  brain: BRAIN,
  knowledge: [
    {
      id: 'k1',
      question: 'What should I wear on holiday?',
      answer: 'Maldives: no restrictions at resort islands. Cover up on local islands.',
      category: 'Culture & Practical',
      lastVerified: '2026-04-06',
    },
  ],
});

// THE test. A leak here is a customer's name in a third party's logs.
describe('what must never be sent', () => {
  it('contains no traveller names', () => {
    expect(ctx).not.toContain('Tracy');
    expect(ctx).not.toContain('Hendricks');
    expect(ctx).not.toContain('Ellie');
  });

  it('contains no email address', () => {
    expect(ctx).not.toContain('tracy.hendricks@example.com');
    expect(ctx).not.toMatch(/@example\.com/);
  });

  it('contains no PNR, which is a credential in all but name', () => {
    expect(ctx).not.toContain('QR7X2K');
  });

  it('contains no money', () => {
    expect(ctx).not.toContain('6240');
    expect(ctx).not.toContain('6,240');
    expect(ctx).not.toContain('4992');
  });

  it('is covered by the guard the route also applies', () => {
    const forbidden = forbiddenStrings(BOOKING);
    expect(forbidden).toContain('Tracy Hendricks');
    expect(forbidden).toContain('QR7X2K');
    for (const s of forbidden) expect(ctx, s).not.toContain(s);
  });
});

describe('what it does send', () => {
  it('gives the party as a shape, not a list of people', () => {
    expect(ctx).toContain('2 adults, 1 child');
  });

  it('gives the flight exactly, so the model can only repeat it', () => {
    expect(ctx).toContain('EY20');
    expect(ctx).toContain('London Gatwick');
    expect(ctx).toMatch(/terminal South/i);
    expect(ctx).toContain('23kg checked');
  });

  it('gives the hotel, the room and the board', () => {
    expect(ctx).toContain('Avyanna Gulhi Beach Hotel');
    expect(ctx).toContain('Deluxe Sea View');
    expect(ctx.toLowerCase()).toContain('bed & breakfast');
  });

  it('says plainly when no transfer is booked', () => {
    expect(ctx).toContain('No airport transfer is booked');
  });

  it('carries the destination content', () => {
    expect(ctx).toContain('1,192 coral islands');
    expect(ctx).toContain('Overwater Villa');
  });

  it('carries the verified country facts with their date', () => {
    expect(ctx).toContain('Tap water safe: No');
    expect(ctx).toContain('2026-07-08');
  });

  it('carries the matched knowledge rows', () => {
    expect(ctx).toContain('Cover up on local islands');
  });
});

// Getting this wrong means telling somebody a festival is on when it is not.
describe("what's on, and what isn't", () => {
  it('separates events during the trip from events at other times', () => {
    expect(ctx).toContain('On while they are there');
    expect(ctx).toContain('Hanifaru Manta Season');
    expect(ctx).toContain('NOT during their trip');
    const notDuring = ctx.slice(ctx.indexOf('NOT during their trip'));
    expect(notDuring).toContain('Independence Day');
  });

  it('labels the weather as an average rather than a forecast', () => {
    expect(ctx).toContain('long-term averages, not a forecast');
    expect(ctx).toContain('Nov 30°C');
  });
});

describe('a thin booking', () => {
  it('still produces something usable', () => {
    const thin = buildLunaContext({
      booking: { ...BOOKING, flights: [], hotels: [], airportExtras: [], documents: [] },
    });
    expect(thin).toContain('Maldives');
    expect(thin).toContain('7 nights');
    expect(thin.length).toBeGreaterThan(50);
  });

  it('does not invent sections it has no content for', () => {
    const thin = buildLunaContext({ booking: BOOKING, place: null, brain: null });
    expect(thin).not.toContain('VERIFIED COUNTRY FACTS');
    expect(thin).not.toContain('Highlights');
  });
});

// The traveller's app is the agency's. The model repeats headings back, so a
// product name in one is a product name in an answer (23 Sep 2026).
describe('what the model is told its sources are', () => {
  it('never names Luna Brain', () => {
    expect(ctx).toContain('VERIFIED COUNTRY FACTS');
    expect(ctx).toContain('VERIFIED ANSWERS');
    expect(ctx).not.toMatch(/Luna Brain/i);
  });
});
