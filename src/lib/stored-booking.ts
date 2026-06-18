/**
 * Off-platform (manual / PDF) bookings — server-only.
 *
 * Bookings that aren't in Travelify are stored in luna_travel.bookings as a
 * Booking payload (the same shape the PWA renders). buildManualBooking assembles
 * a Travelify-shaped order from form input and runs it through the canonical
 * orderToBooking mapper, so a manually-entered booking is structurally identical
 * to a live one — then overrides the destination/country/email we capture
 * explicitly. getStoredBooking is what the traveller fetch + redeem read back.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { orderToBooking, type TrimmedOrder, type ControlAgency } from '@/lib/order-to-booking';
import type { Booking, ExperienceKind } from '@/types/booking';

export interface ManualFlightInput {
  carrierCode: string;
  flightNumber: string;
  fromIata: string;
  toIata: string;
  departAt: string; // ISO
  arriveAt: string; // ISO
  cabin?: string;
}
export interface ManualHotelInput {
  name: string;
  city: string;
  country: string; // display name, e.g. "Maldives"
  checkIn: string; // YYYY-MM-DD
  checkOut: string; // YYYY-MM-DD
  board?: string; // e.g. BB, HB, AI
  photos?: string[];
}
export interface ManualExperienceInput {
  kind: ExperienceKind;
  title: string;
  supplier?: string;
  location?: string;
  startDate: string; // ISO
  endDate?: string; // ISO
  notes?: string;
  reference?: string;
  photos?: string[];
}
export interface ManualTravellerInput {
  firstName: string;
  lastName: string;
  type?: 'adult' | 'child' | 'infant';
}
export interface ManualBookingInput {
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  destinationLabel: string;
  countryCode: string; // ISO-2
  additionalTravellers?: ManualTravellerInput[];
  flights: ManualFlightInput[];
  hotels: ManualHotelInput[];
  experiences?: ManualExperienceInput[];
}

function durationMins(from: string, to: string): number {
  const a = new Date(from).getTime();
  const b = new Date(to).getTime();
  if (Number.isNaN(a) || Number.isNaN(b) || b <= a) return 0;
  return Math.round((b - a) / 60000);
}
function daysBetween(from: string, to: string): number {
  const a = new Date(`${from.slice(0, 10)}T00:00:00Z`).getTime();
  const b = new Date(`${to.slice(0, 10)}T00:00:00Z`).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.max(0, Math.round((b - a) / 86_400_000));
}

/** Build a valid Booking from manual form input by routing through orderToBooking. */
export function buildManualBooking(
  input: ManualBookingInput,
  agency: ControlAgency | null,
  reference: string,
): Booking | null {
  const items: NonNullable<TrimmedOrder['items']> = [];

  if (input.flights.length) {
    items.push({
      id: 1,
      product: 'Flights',
      startDate: input.flights[0].departAt,
      flights: {
        routes: [
          {
            legID: 1,
            segments: input.flights.map((f) => ({
              origin: { iataCode: f.fromIata.toUpperCase(), name: f.fromIata.toUpperCase() },
              destination: { iataCode: f.toIata.toUpperCase(), name: f.toIata.toUpperCase() },
              depart: f.departAt,
              arrive: f.arriveAt,
              duration: durationMins(f.departAt, f.arriveAt),
              cabinClass: f.cabin || 'Economy',
              marketingCarrier: { code: f.carrierCode.toUpperCase(), name: f.carrierCode.toUpperCase() },
              flightNo: f.flightNumber,
            })),
          },
        ],
      },
    });
  }

  input.hotels.forEach((h, idx) => {
    const nights = daysBetween(h.checkIn, h.checkOut);
    items.push({
      id: 100 + idx,
      product: 'Accommodation',
      startDate: `${h.checkIn.slice(0, 10)}T15:00:00.000Z`,
      duration: nights,
      accommodation: {
        name: h.name,
        location: { city: h.city, country: h.country },
        units: [{ name: 'Room', checkin: h.checkIn.slice(0, 10), nights, rates: [{ board: h.board || '' }] }],
      },
    });
  });

  const summaryTravellers = [
    { type: 'adult', firstname: input.leadFirstName, surname: input.leadLastName },
    ...(input.additionalTravellers || []).map((t) => ({
      type: t.type || 'adult',
      firstname: t.firstName,
      surname: t.lastName,
    })),
  ];

  const starts = [...input.flights.map((f) => f.departAt), ...input.hotels.map((h) => h.checkIn)].filter(Boolean).sort();
  const ends = [...input.flights.map((f) => f.arriveAt), ...input.hotels.map((h) => h.checkOut)].filter(Boolean).sort();

  const order: TrimmedOrder = {
    id: Date.now(), // synthetic — orderToBooking requires a truthy id
    status: 'confirmed',
    customerFirstname: input.leadFirstName,
    customerSurname: input.leadLastName,
    customerEmail: input.leadEmail,
    items,
    summary: { earliestStart: starts[0] || '', latestEnd: ends[ends.length - 1] || '', travellers: summaryTravellers },
    documents: [],
  };

  const booking = orderToBooking(order, agency, reference);
  if (!booking) return null;

  // Explicit overrides — these drive the destination guide, hero and weather.
  booking.primaryCountryCode = (input.countryCode || booking.primaryCountryCode || '').toUpperCase();
  if (input.destinationLabel) booking.destinationLabel = input.destinationLabel;
  booking.leadEmail = input.leadEmail;
  booking.travelifyOrderId = undefined; // not a Travelify order

  // Hotel photos (match by input order — orderToBooking keeps item order).
  input.hotels.forEach((h, i) => {
    if (h.photos?.length && booking.hotels[i]) booking.hotels[i].photos = h.photos;
  });

  // Experiences (excursions, car hire, transfers…) — not part of a Travelify
  // order, so attach them directly.
  const exps = input.experiences ?? [];
  booking.experiences = exps.map((e, i) => ({
    id: `exp-${i}`,
    kind: e.kind,
    title: e.title,
    supplier: e.supplier || undefined,
    location: e.location || undefined,
    startDate: e.startDate,
    endDate: e.endDate || undefined,
    notes: e.notes || undefined,
    reference: e.reference || undefined,
    photos: e.photos?.length ? e.photos : undefined,
  }));

  // Extend the trip window to cover experience dates.
  const expDates = exps
    .flatMap((e) => [e.startDate, e.endDate])
    .filter((d): d is string => !!d)
    .map((d) => d.slice(0, 10))
    .sort();
  if (expDates.length) {
    const curStart = (booking.tripStart || '').slice(0, 10);
    const curEnd = (booking.tripEnd || '').slice(0, 10);
    if (!curStart || expDates[0] < curStart) booking.tripStart = expDates[0];
    const maxExp = expDates[expDates.length - 1];
    if (!curEnd || maxExp > curEnd) booking.tripEnd = maxExp;
  }

  return booking;
}

export interface StoredBooking {
  reference: string;
  leadEmail: string | null;
  leadName: string | null;
  destination: string | null;
  departureDate: string | null;
  returnDate: string | null;
  payload: Booking;
}

/** Read a stored off-platform booking for an agency + reference, if one exists. */
export async function getStoredBooking(agencyId: string, reference: string): Promise<StoredBooking | null> {
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('bookings')
    .select('reference, lead_email, lead_name, destination, departure_date, return_date, payload')
    .eq('agency_id', agencyId)
    .eq('reference', reference)
    .maybeSingle();
  if (error || !data) return null;
  return {
    reference: data.reference as string,
    leadEmail: (data.lead_email as string) ?? null,
    leadName: (data.lead_name as string) ?? null,
    destination: (data.destination as string) ?? null,
    departureDate: (data.departure_date as string) ?? null,
    returnDate: (data.return_date as string) ?? null,
    payload: data.payload as Booking,
  };
}
