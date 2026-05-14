/**
 * Luna Travel — Booking type definitions
 *
 * These types mirror the Travelify booking response shape closely enough that
 * swapping from mock JSON to the live `/api/retrieve-order` response is a
 * data-source change, not a component rewrite.
 *
 * Source of truth: My Booking widget v1.4.1 (data integrity enforced):
 *   - No invented fallbacks. If a field is missing, the UI hides it.
 *   - Board basis mapped through a strict whitelist.
 *   - Room name reads from units[].name (real supplier text).
 */

export type BoardBasis =
  | 'RoomOnly'
  | 'SelfCatering'
  | 'BedAndBreakfast'
  | 'HalfBoard'
  | 'HalfBoardPlus'
  | 'FullBoard'
  | 'FullBoardPlus'
  | 'AllInclusive'
  | 'AllInclusivePlus'
  | 'UltraAllInclusive';

export type FlightCabin = 'Economy' | 'PremiumEconomy' | 'Business' | 'First';

export type TripStartEvent = 'flight' | 'check-in' | 'other';

export type TravellerType = 'adult' | 'child' | 'infant';

export interface Traveller {
  id: string;
  title?: string;
  firstName: string;
  lastName: string;
  type: TravellerType;
  age?: number;
  passportNationality?: string;
  isLead: boolean;
}

export interface FlightLeg {
  id: string;
  carrierCode: string;
  carrierName: string;
  flightNumber: string;
  cabin: FlightCabin;
  depAirport: string; // IATA
  depAirportName: string;
  depCity: string;
  depTime: string; // ISO
  depTerminal?: string;
  arrAirport: string;
  arrAirportName: string;
  arrCity: string;
  arrTime: string; // ISO
  arrTerminal?: string;
  durationMinutes: number;
  aircraft?: string;
  baggageAllowance?: string;
  pnr?: string;
  seats?: Record<string, string>; // travellerId -> seat
}

export interface Hotel {
  id: string;
  name: string;
  stars?: number;
  resort?: string;
  city: string;
  region?: string;
  country: string;
  countryCode: string;
  lat?: number;
  lng?: number;
  checkIn: string; // ISO
  checkOut: string; // ISO
  nights: number;
  roomName: string; // units[].name from Travelify — supplier text
  roomType?: string; // only if real (not "Unknown")
  boardBasis?: BoardBasis;
  hotelReference?: string;
  specialRequests?: string;
}

export interface AirportExtra {
  id: string;
  type: 'lounge' | 'parking' | 'fast-track' | 'hotel' | 'other';
  name: string;
  airport: string; // IATA
  date: string; // ISO
  time?: string;
  guests?: number;
  notes?: string;
}

export interface Document {
  id: string;
  name: string;
  kind: 'booking-pack' | 'e-ticket' | 'voucher' | 'lounge-pass' | 'atol' | 'insurance' | 'other';
  url: string; // mock data uses placeholder URLs
  sizeBytes?: number;
  updatedAt: string;
}

export interface PaymentBreakdown {
  currency: string;
  total: number;
  deposit?: number;
  balance?: number;
  balanceDueDate?: string;
}

export interface Agency {
  name: string;
  logoUrl?: string;
  phone: string;
  email: string;
  emergencyPhone?: string;
  website?: string;
  atolNumber?: string;
}

export interface Booking {
  // Identity
  reference: string; // never invented — the customer-typed value
  travelifyOrderId?: string; // internal Travelify ID, never shown to user
  status: 'confirmed' | 'pending' | 'cancelled';

  // Headline
  leadEmail: string;
  destinationLabel: string; // human-readable, e.g. "Maldives" or "Dubai & Athens"
  primaryCountryCode: string; // ISO-2, used to fetch the destination guide
  tripStart: string; // ISO — first event date
  tripEnd: string; // ISO — last event date
  tripStartEvent: TripStartEvent;
  durationLabel: string; // e.g. "7 nights" or "10 days, 8 nights"

  // Components (any may be empty)
  travellers: Traveller[];
  flights: FlightLeg[];
  hotels: Hotel[];
  airportExtras: AirportExtra[];
  documents: Document[];

  // Money
  payment?: PaymentBreakdown;

  // Agency branding (white-label)
  agency: Agency;
}

export interface DestinationGuide {
  countryCode: string;
  name: string;
  region: string;
  currency: string;
  timeZone: string;
  languages: string[];
  weatherSummary: string;
  introduction: string;
  whyWeLoveIt: string;
  insiderTips: string;
  visaSummary: string;
  emergencyNumber?: string;
}
