import type { Booking } from '@/types/booking';

/**
 * Mock bookings for the prototype.
 *
 * Four shapes intentionally:
 * 1. Long-haul beach, multi-stop flight, family of 4, B&B  (Maldives — Swan)
 * 2. Short-haul beach, direct flight, family of 4, AI       (Mallorca — Watson)
 * 3. Premium stopover, business class, multi-hotel, couple (Dubai — Patel)
 * 4. Hotel-only (no flight), solo traveller                 (Athens — Mitchell)
 *
 * The "Travelaire Holidays" demo agency wraps all four — change once and the
 * whole demo rebrands.
 */

const DEMO_AGENCY = {
  name: 'Travelaire Holidays',
  logoUrl: '/images/travelaire-logo.svg',
  phone: '+44 121 555 8800',
  email: 'hello@travelaire.co.uk',
  emergencyPhone: '+44 7700 900900',
  website: 'travelaire.co.uk',
  atolNumber: 'ATOL 12345',
};

// ────────────────────────────────────────────────────────────────
// 1 · Maldives — Swan family — the hero demo
// ────────────────────────────────────────────────────────────────
export const MALDIVES_SWAN: Booking = {
  reference: 'DEMO81297',
  travelifyOrderId: '82300',
  status: 'confirmed',
  leadEmail: 'darren.swan@example.com',
  destinationLabel: 'Maldives',
  primaryCountryCode: 'MV',
  tripStart: '2026-11-27T20:15:00.000Z',
  tripEnd: '2026-12-04T11:00:00.000Z',
  tripStartEvent: 'flight',
  durationLabel: '7 nights',
  travellers: [
    { id: 't1', title: 'Mr', firstName: 'Darren', lastName: 'Swan', type: 'adult', isLead: true, passportNationality: 'GB' },
    { id: 't2', title: 'Mrs', firstName: 'Sarah', lastName: 'Swan', type: 'adult', isLead: false, passportNationality: 'GB' },
    { id: 't3', title: 'Master', firstName: 'Ethan', lastName: 'Swan', type: 'child', age: 11, isLead: false, passportNationality: 'GB' },
    { id: 't4', title: 'Miss', firstName: 'Lily', lastName: 'Swan', type: 'child', age: 9, isLead: false, passportNationality: 'GB' },
  ],
  flights: [
    {
      id: 'f1', carrierCode: 'EY', carrierName: 'Etihad Airways', flightNumber: 'EY20', cabin: 'Economy',
      depAirport: 'LGW', depAirportName: 'London Gatwick', depCity: 'London', depTerminal: 'South',
      depTime: '2026-11-27T20:15:00.000Z',
      arrAirport: 'AUH', arrAirportName: 'Abu Dhabi International', arrCity: 'Abu Dhabi',
      arrTime: '2026-11-28T07:25:00.000Z',
      durationMinutes: 430, aircraft: 'B787-9', baggageAllowance: '23kg checked + 7kg cabin', pnr: 'PQR4X9',
      seats: { t1: '14A', t2: '14B', t3: '14C', t4: '14D' },
    },
    {
      id: 'f2', carrierCode: 'EY', carrierName: 'Etihad Airways', flightNumber: 'EY278', cabin: 'Economy',
      depAirport: 'AUH', depAirportName: 'Abu Dhabi International', depCity: 'Abu Dhabi',
      depTime: '2026-11-28T10:00:00.000Z',
      arrAirport: 'MLE', arrAirportName: 'Velana International', arrCity: 'Malé',
      arrTime: '2026-11-28T12:55:00.000Z',
      durationMinutes: 265, aircraft: 'A320', baggageAllowance: '23kg checked + 7kg cabin', pnr: 'PQR4X9',
      seats: { t1: '8A', t2: '8B', t3: '8C', t4: '8D' },
    },
    {
      id: 'f3', carrierCode: 'EY', carrierName: 'Etihad Airways', flightNumber: 'EY279', cabin: 'Economy',
      depAirport: 'MLE', depAirportName: 'Velana International', depCity: 'Malé',
      depTime: '2026-12-04T14:30:00.000Z',
      arrAirport: 'AUH', arrAirportName: 'Abu Dhabi International', arrCity: 'Abu Dhabi',
      arrTime: '2026-12-04T18:05:00.000Z',
      durationMinutes: 275, aircraft: 'A320', baggageAllowance: '23kg checked + 7kg cabin', pnr: 'PQR4X9',
    },
    {
      id: 'f4', carrierCode: 'EY', carrierName: 'Etihad Airways', flightNumber: 'EY11', cabin: 'Economy',
      depAirport: 'AUH', depAirportName: 'Abu Dhabi International', depCity: 'Abu Dhabi',
      depTime: '2026-12-04T21:15:00.000Z',
      arrAirport: 'LGW', arrAirportName: 'London Gatwick', arrCity: 'London',
      arrTime: '2026-12-05T02:25:00.000Z',
      durationMinutes: 430, aircraft: 'B787-9', baggageAllowance: '23kg checked + 7kg cabin', pnr: 'PQR4X9',
    },
  ],
  hotels: [
    {
      id: 'h1', name: 'Avyanna Gulhi Beach Hotel', stars: 4,
      resort: 'Gulhi Island', city: 'Gulhi', region: 'South Malé Atoll', country: 'Maldives', countryCode: 'MV',
      lat: 3.9837, lng: 73.4453,
      checkIn: '2026-11-28T15:00:00.000Z', checkOut: '2026-12-04T11:00:00.000Z', nights: 6,
      roomName: '8 Bed Mixed Dorm', boardBasis: 'BedAndBreakfast',
      hotelReference: 'AVY-GLH-887412',
      specialRequests: 'Twin room preferred. Late check-in noted with hotel. Cot not required.',
    },
  ],
  airportExtras: [
    { id: 'x1', type: 'lounge', name: 'No1 Lounge South Terminal', airport: 'LGW',
      date: '2026-11-27T17:00:00.000Z', guests: 4, notes: '3-hour pre-departure access' },
  ],
  documents: [
    { id: 'd1', name: 'Full booking pack', kind: 'booking-pack', url: '/documents/DEMO81297/booking-pack.pdf', sizeBytes: 463780, updatedAt: '2026-05-14T09:00:00.000Z' },
    { id: 'd2', name: 'E-tickets · Etihad', kind: 'e-ticket', url: '/documents/DEMO81297/e-ticket.pdf', sizeBytes: 325541, updatedAt: '2026-05-14T09:00:00.000Z' },
    { id: 'd3', name: 'Hotel voucher · Avyanna', kind: 'voucher', url: '/documents/DEMO81297/hotel-voucher.pdf', sizeBytes: 303615, updatedAt: '2026-05-14T09:00:00.000Z' },
    { id: 'd4', name: 'No1 Lounge pass · LGW', kind: 'lounge-pass', url: '/documents/DEMO81297/lounge-pass.pdf', sizeBytes: 241621, updatedAt: '2026-05-14T09:00:00.000Z' },
    { id: 'd5', name: 'ATOL certificate', kind: 'atol', url: '/documents/DEMO81297/atol-certificate.pdf', sizeBytes: 335516, updatedAt: '2026-05-14T09:00:00.000Z' },
    { id: 'd6', name: 'Travel insurance summary', kind: 'insurance', url: '/documents/DEMO81297/travel-insurance.pdf', sizeBytes: 292485, updatedAt: '2026-05-14T09:00:00.000Z' },
  ],
  payment: { currency: 'GBP', total: 6240.00, deposit: 1248.00, balance: 0, balanceDueDate: '2026-09-15' },
  agency: DEMO_AGENCY,
};

// ────────────────────────────────────────────────────────────────
// 2 · Mallorca — Watson family — short-haul, direct, AI
// ────────────────────────────────────────────────────────────────
export const MALLORCA_WATSON: Booking = {
  reference: 'DEMO74002',
  travelifyOrderId: '79188',
  status: 'confirmed',
  leadEmail: 'helen.watson@example.com',
  destinationLabel: 'Mallorca',
  primaryCountryCode: 'ES',
  tripStart: '2026-07-22T06:15:00.000Z',
  tripEnd: '2026-08-01T22:40:00.000Z',
  tripStartEvent: 'flight',
  durationLabel: '10 days · 10 nights',
  travellers: [
    { id: 't1', title: 'Mrs', firstName: 'Helen', lastName: 'Watson', type: 'adult', isLead: true, passportNationality: 'GB' },
    { id: 't2', title: 'Mr', firstName: 'Paul', lastName: 'Watson', type: 'adult', isLead: false, passportNationality: 'GB' },
    { id: 't3', title: 'Miss', firstName: 'Grace', lastName: 'Watson', type: 'child', age: 8, isLead: false, passportNationality: 'GB' },
    { id: 't4', title: 'Master', firstName: 'Theo', lastName: 'Watson', type: 'child', age: 6, isLead: false, passportNationality: 'GB' },
  ],
  flights: [
    {
      id: 'f1', carrierCode: 'LS', carrierName: 'Jet2', flightNumber: 'LS835', cabin: 'Economy',
      depAirport: 'BHX', depAirportName: 'Birmingham', depCity: 'Birmingham',
      depTime: '2026-07-22T06:15:00.000Z',
      arrAirport: 'PMI', arrAirportName: 'Palma de Mallorca', arrCity: 'Palma',
      arrTime: '2026-07-22T10:05:00.000Z',
      durationMinutes: 170, aircraft: 'B737-800', baggageAllowance: '22kg checked + 10kg cabin', pnr: 'LSGH88',
      seats: { t1: '12C', t2: '12D', t3: '12E', t4: '12F' },
    },
    {
      id: 'f2', carrierCode: 'LS', carrierName: 'Jet2', flightNumber: 'LS836', cabin: 'Economy',
      depAirport: 'PMI', depAirportName: 'Palma de Mallorca', depCity: 'Palma',
      depTime: '2026-08-01T19:20:00.000Z',
      arrAirport: 'BHX', arrAirportName: 'Birmingham', arrCity: 'Birmingham',
      arrTime: '2026-08-01T22:40:00.000Z',
      durationMinutes: 175, aircraft: 'B737-800', baggageAllowance: '22kg checked + 10kg cabin', pnr: 'LSGH88',
    },
  ],
  hotels: [
    {
      id: 'h1', name: 'Iberostar Selection Playa de Muro Village', stars: 4,
      resort: 'Playa de Muro', city: 'Alcúdia', region: 'North Mallorca', country: 'Spain', countryCode: 'ES',
      lat: 39.7868, lng: 3.1100,
      checkIn: '2026-07-22T15:00:00.000Z', checkOut: '2026-08-01T11:00:00.000Z', nights: 10,
      roomName: 'Family Junior Suite Garden View', boardBasis: 'AllInclusive',
      hotelReference: 'IBE-PDM-552901',
      specialRequests: 'Cot for Theo. Family room close to kids club preferred.',
    },
  ],
  airportExtras: [
    { id: 'x1', type: 'parking', name: 'BHX Express Parking', airport: 'BHX',
      date: '2026-07-22T04:00:00.000Z', notes: '10 days · Bay 14B' },
    { id: 'x2', type: 'fast-track', name: 'Security Fast Track', airport: 'BHX',
      date: '2026-07-22T04:30:00.000Z', guests: 4 },
  ],
  documents: [
    { id: 'd1', name: 'Full booking pack', kind: 'booking-pack', url: '/documents/DEMO74002/booking-pack.pdf', sizeBytes: 451527, updatedAt: '2026-05-12T11:30:00.000Z' },
    { id: 'd2', name: 'E-tickets · Jet2', kind: 'e-ticket', url: '/documents/DEMO74002/e-ticket.pdf', sizeBytes: 281576, updatedAt: '2026-05-12T11:30:00.000Z' },
    { id: 'd3', name: 'Hotel voucher · Iberostar', kind: 'voucher', url: '/documents/DEMO74002/hotel-voucher.pdf', sizeBytes: 305063, updatedAt: '2026-05-12T11:30:00.000Z' },
    { id: 'd4', name: 'Parking voucher · BHX', kind: 'voucher', url: '/documents/DEMO74002/hotel-voucher.pdf', sizeBytes: 305063, updatedAt: '2026-05-12T11:30:00.000Z' },
    { id: 'd5', name: 'ATOL certificate', kind: 'atol', url: '/documents/DEMO74002/atol-certificate.pdf', sizeBytes: 332616, updatedAt: '2026-05-12T11:30:00.000Z' },
  ],
  payment: { currency: 'GBP', total: 4180.00, deposit: 836.00, balance: 3344.00, balanceDueDate: '2026-06-08' },
  agency: DEMO_AGENCY,
};

// ────────────────────────────────────────────────────────────────
// 3 · Dubai stopover — Patel — premium, multi-hotel
// ────────────────────────────────────────────────────────────────
export const DUBAI_PATEL: Booking = {
  reference: 'DEMO66541',
  travelifyOrderId: '71204',
  status: 'confirmed',
  leadEmail: 'priya.patel@example.com',
  destinationLabel: 'Dubai',
  primaryCountryCode: 'AE',
  tripStart: '2026-10-05T22:30:00.000Z',
  tripEnd: '2026-10-12T17:15:00.000Z',
  tripStartEvent: 'flight',
  durationLabel: '5 nights',
  travellers: [
    { id: 't1', title: 'Mrs', firstName: 'Priya', lastName: 'Patel', type: 'adult', isLead: true, passportNationality: 'GB' },
    { id: 't2', title: 'Mr', firstName: 'Raj', lastName: 'Patel', type: 'adult', isLead: false, passportNationality: 'GB' },
  ],
  flights: [
    {
      id: 'f1', carrierCode: 'EK', carrierName: 'Emirates', flightNumber: 'EK4', cabin: 'Business',
      depAirport: 'LHR', depAirportName: 'London Heathrow', depCity: 'London', depTerminal: '3',
      depTime: '2026-10-05T22:30:00.000Z',
      arrAirport: 'DXB', arrAirportName: 'Dubai International', arrCity: 'Dubai', arrTerminal: '3',
      arrTime: '2026-10-06T09:05:00.000Z',
      durationMinutes: 415, aircraft: 'A380-800', baggageAllowance: '40kg checked + 7kg cabin', pnr: 'EK77JN',
      seats: { t1: '14A', t2: '14K' },
    },
    {
      id: 'f2', carrierCode: 'EK', carrierName: 'Emirates', flightNumber: 'EK1', cabin: 'Business',
      depAirport: 'DXB', depAirportName: 'Dubai International', depCity: 'Dubai', depTerminal: '3',
      depTime: '2026-10-12T08:30:00.000Z',
      arrAirport: 'LHR', arrAirportName: 'London Heathrow', arrCity: 'London', arrTerminal: '3',
      arrTime: '2026-10-12T13:15:00.000Z',
      durationMinutes: 405, aircraft: 'A380-800', baggageAllowance: '40kg checked + 7kg cabin', pnr: 'EK77JN',
    },
  ],
  hotels: [
    {
      id: 'h1', name: 'Atlantis, The Palm', stars: 5,
      resort: 'Palm Jumeirah', city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE',
      lat: 25.1308, lng: 55.1170,
      checkIn: '2026-10-06T15:00:00.000Z', checkOut: '2026-10-09T12:00:00.000Z', nights: 3,
      roomName: 'Ocean Deluxe King Room', boardBasis: 'BedAndBreakfast',
      hotelReference: 'ATL-PLM-339920',
      specialRequests: 'High floor · away from lift.',
    },
    {
      id: 'h2', name: 'Burj Al Arab Jumeirah', stars: 5,
      resort: 'Jumeirah Beach', city: 'Dubai', country: 'United Arab Emirates', countryCode: 'AE',
      lat: 25.1412, lng: 55.1853,
      checkIn: '2026-10-09T15:00:00.000Z', checkOut: '2026-10-12T05:00:00.000Z', nights: 2,
      roomName: 'Deluxe Two Bedroom Suite', boardBasis: 'HalfBoard',
      hotelReference: 'BAJ-JMR-771403',
      specialRequests: 'Anniversary stay — please advise hotel.',
    },
  ],
  airportExtras: [
    { id: 'x1', type: 'lounge', name: 'Plaza Premium Lounge', airport: 'LHR',
      date: '2026-10-05T20:00:00.000Z', guests: 2 },
    { id: 'x2', type: 'fast-track', name: 'Security Fast Track', airport: 'LHR',
      date: '2026-10-05T20:30:00.000Z', guests: 2 },
  ],
  documents: [
    { id: 'd1', name: 'Full booking pack', kind: 'booking-pack', url: '/documents/DEMO66541/booking-pack.pdf', sizeBytes: 427764, updatedAt: '2026-05-13T14:15:00.000Z' },
    { id: 'd2', name: 'E-tickets · Emirates Business', kind: 'e-ticket', url: '/documents/DEMO66541/e-ticket.pdf', sizeBytes: 288025, updatedAt: '2026-05-13T14:15:00.000Z' },
    { id: 'd3', name: 'Hotel voucher · Atlantis', kind: 'voucher', url: '/documents/DEMO66541/hotel-voucher.pdf', sizeBytes: 302747, updatedAt: '2026-05-13T14:15:00.000Z' },
    { id: 'd4', name: 'Hotel voucher · Burj Al Arab', kind: 'voucher', url: '/documents/DEMO66541/hotel-voucher.pdf', sizeBytes: 302747, updatedAt: '2026-05-13T14:15:00.000Z' },
    { id: 'd5', name: 'ATOL certificate', kind: 'atol', url: '/documents/DEMO66541/atol-certificate.pdf', sizeBytes: 332231, updatedAt: '2026-05-13T14:15:00.000Z' },
    { id: 'd6', name: 'Travel insurance summary', kind: 'insurance', url: '/documents/DEMO66541/travel-insurance.pdf', sizeBytes: 288619, updatedAt: '2026-05-13T14:15:00.000Z' },
  ],
  payment: { currency: 'GBP', total: 11280.00, deposit: 2256.00, balance: 0, balanceDueDate: '2026-08-08' },
  agency: DEMO_AGENCY,
};

// ────────────────────────────────────────────────────────────────
// 4 · Athens — Mitchell — hotel only, no flight, solo
// ────────────────────────────────────────────────────────────────
export const ATHENS_MITCHELL: Booking = {
  reference: 'DEMO52188',
  travelifyOrderId: '60029',
  status: 'confirmed',
  leadEmail: 'james.mitchell@example.com',
  destinationLabel: 'Athens',
  primaryCountryCode: 'GR',
  tripStart: '2026-09-18T15:00:00.000Z',
  tripEnd: '2026-09-21T11:00:00.000Z',
  tripStartEvent: 'check-in',
  durationLabel: '3 nights',
  travellers: [
    { id: 't1', title: 'Mr', firstName: 'James', lastName: 'Mitchell', type: 'adult', isLead: true, passportNationality: 'GB' },
  ],
  flights: [],
  hotels: [
    {
      id: 'h1', name: 'Electra Metropolis Athens', stars: 5,
      resort: 'Plaka', city: 'Athens', country: 'Greece', countryCode: 'GR',
      lat: 37.9775, lng: 23.7286,
      checkIn: '2026-09-18T15:00:00.000Z', checkOut: '2026-09-21T11:00:00.000Z', nights: 3,
      roomName: 'Deluxe Acropolis View King Room', boardBasis: 'BedAndBreakfast',
      hotelReference: 'ELE-MET-449117',
      specialRequests: 'Acropolis view confirmed at booking.',
    },
  ],
  airportExtras: [],
  documents: [
    { id: 'd1', name: 'Full booking pack', kind: 'booking-pack', url: '/documents/DEMO52188/booking-pack.pdf', sizeBytes: 325185, updatedAt: '2026-05-10T16:00:00.000Z' },
    { id: 'd2', name: 'Hotel voucher · Electra', kind: 'voucher', url: '/documents/DEMO52188/hotel-voucher.pdf', sizeBytes: 303593, updatedAt: '2026-05-10T16:00:00.000Z' },
  ],
  payment: { currency: 'GBP', total: 980.00, deposit: 196.00, balance: 0, balanceDueDate: '2026-07-25' },
  agency: DEMO_AGENCY,
};

// ────────────────────────────────────────────────────────────────
// Registry
// ────────────────────────────────────────────────────────────────
export const BOOKINGS: Booking[] = [
  MALDIVES_SWAN,
  MALLORCA_WATSON,
  DUBAI_PATEL,
  ATHENS_MITCHELL,
];

export function getBookingByRef(ref: string): Booking | undefined {
  return BOOKINGS.find((b) => b.reference.toLowerCase() === ref.toLowerCase());
}

export function getDefaultBooking(): Booking {
  return MALDIVES_SWAN;
}
