/**
 * order-to-booking.ts
 *
 * Maps the trimmed Travelify order returned by Control
 * (/api/internal/retrieve-order-by-client → same shape as the My Booking
 * widget's trimOrder) plus the agency branding block into Luna Travel's
 * Booking type.
 *
 * Design rule (inherited from the Booking type): NO invented fallbacks. If a
 * field is genuinely absent in the order, it is left empty/undefined and the
 * PWA hides it. The only pragmatic defaults are on REQUIRED enum fields that a
 * real booking always has in practice (flight cabin → Economy, traveller type
 * → adult, status → confirmed); these are commented where they occur.
 *
 * This is a pure function — no I/O, no env. Trivially testable.
 */

import type {
  Booking,
  Traveller,
  TravellerType,
  FlightLeg,
  FlightCabin,
  Hotel,
  BoardBasis,
  AirportExtra,
  Document as BookingDocument,
  PaymentBreakdown,
  Agency,
  TripStartEvent,
} from '@/types/booking';

// ───────── Loosely-typed view of the trimmed Control/Travelify order ─────────
// We keep these permissive: the order is sanitised server-side, and we never
// trust shape here beyond optional-chaining our way through it.

interface RawSegment {
  origin?: { iataCode?: string | null; terminal?: string | null; name?: string | null; country?: string | null } | null;
  destination?: { iataCode?: string | null; terminal?: string | null; name?: string | null; country?: string | null } | null;
  depart?: string | null;
  arrive?: string | null;
  duration?: number | null;
  cabinClass?: string | null;
  baggage?: { allowance?: string | null; weight?: string | null } | null;
  operatingCarrier?: { code?: string | null; name?: string | null } | null;
  marketingCarrier?: { code?: string | null; name?: string | null } | null;
  flightNo?: string | null;
  aircraft?: string | null;
}
interface RawRoute { legID?: number | null; direction?: string | null; duration?: number | null; segments?: RawSegment[] }
interface RawUnit { name?: string | null; roomType?: string | null; checkin?: string | null; nights?: number | null; rates?: Array<{ board?: string | null }> }
interface RawLocation { city?: string | null; state?: string | null; country?: string | null; latitude?: number | null; longitude?: number | null }
interface RawPerson { type?: string | null; title?: string | null; firstname?: string | null; surname?: string | null }
interface RawItem {
  id?: number | null;
  status?: string | null;
  product?: string | null;
  bookingReference?: string | null;
  price?: number | null;
  currency?: string | null;
  startDate?: string | null;
  duration?: number | null;
  accommodation?: { name?: string | null; rating?: number | null; location?: RawLocation | null; units?: RawUnit[] } | null;
  flights?: { routes?: RawRoute[] } | null;
  airportExtras?: { type?: string | null; name?: string | null; subTitle?: string | null; startDateTime?: string | null; endDateTime?: string | null; location?: { iataCode?: string | null } | null; travellers?: RawPerson[] } | null;
}
interface RawSummary { totalPrice?: number | null; earliestStart?: string | null; latestEnd?: string | null; travellers?: RawPerson[] }
interface RawDocument { name?: string | null; ext?: string | null; size?: number | null; url?: string | null; created?: string | null }
export interface TrimmedOrder {
  id?: number | null;
  status?: string | null;
  customerTitle?: string | null;
  customerFirstname?: string | null;
  customerSurname?: string | null;
  customerEmail?: string | null;
  currency?: string | null;
  items?: RawItem[];
  summary?: RawSummary;
  documents?: RawDocument[];
}
export interface ControlAgency {
  name?: string;
  legalName?: string;
  appName?: string;
  email?: string;
  website?: string;
  logoUrl?: string;
  phone?: string;
  brandPrimaryColour?: string;
  brandAccentColour?: string;
  welcomeMessage?: string;
}

// ───────── Small helpers ─────────

function dateOnly(s?: string | null): string {
  if (typeof s !== 'string' || !s) return '';
  return s.slice(0, 10);
}
function addDays(isoDate: string, days: number): string {
  const d = new Date(`${dateOnly(isoDate)}T00:00:00Z`);
  if (Number.isNaN(d.getTime())) return '';
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function daysBetween(a: string, b: string): number {
  const da = new Date(`${dateOnly(a)}T00:00:00Z`).getTime();
  const db = new Date(`${dateOnly(b)}T00:00:00Z`).getTime();
  if (Number.isNaN(da) || Number.isNaN(db)) return 0;
  return Math.max(0, Math.round((db - da) / 86_400_000));
}
function timePart(s?: string | null): string | undefined {
  if (typeof s !== 'string') return undefined;
  const m = s.match(/T(\d{2}:\d{2})/);
  return m ? m[1] : undefined;
}

// ───────── Normalisers for required enum fields ─────────

function normaliseCabin(raw?: string | null): FlightCabin {
  const v = (raw || '').toLowerCase().replace(/[\s_-]/g, '');
  if (v.includes('first')) return 'First';
  if (v.includes('business')) return 'Business';
  if (v.includes('premium')) return 'PremiumEconomy';
  return 'Economy'; // pragmatic default — every flown segment has a cabin
}

const BOARD_MAP: Record<string, BoardBasis> = {
  ro: 'RoomOnly', roomonly: 'RoomOnly',
  sc: 'SelfCatering', selfcatering: 'SelfCatering',
  bb: 'BedAndBreakfast', bedandbreakfast: 'BedAndBreakfast', breakfast: 'BedAndBreakfast',
  hb: 'HalfBoard', halfboard: 'HalfBoard',
  hbplus: 'HalfBoardPlus', halfboardplus: 'HalfBoardPlus',
  fb: 'FullBoard', fullboard: 'FullBoard',
  fbplus: 'FullBoardPlus', fullboardplus: 'FullBoardPlus',
  ai: 'AllInclusive', allinclusive: 'AllInclusive',
  aiplus: 'AllInclusivePlus', allinclusiveplus: 'AllInclusivePlus',
  uai: 'UltraAllInclusive', ultraallinclusive: 'UltraAllInclusive',
};
function normaliseBoard(raw?: string | null): BoardBasis | undefined {
  if (!raw) return undefined;
  const v = raw.toLowerCase().replace(/[\s_&-]/g, '');
  return BOARD_MAP[v]; // undefined if not on the whitelist → UI hides it
}

function normaliseExtraType(raw?: string | null): AirportExtra['type'] {
  const v = (raw || '').toLowerCase().replace(/[\s_-]/g, '');
  if (v.includes('lounge')) return 'lounge';
  if (v.includes('park')) return 'parking';
  if (v.includes('fasttrack') || v.includes('security')) return 'fast-track';
  if (v.includes('hotel')) return 'hotel';
  return 'other';
}

function normaliseTravellerType(raw?: string | null): TravellerType {
  const v = (raw || '').toLowerCase();
  if (v.includes('infant')) return 'infant';
  if (v.includes('child')) return 'child';
  return 'adult'; // pragmatic default
}

function normaliseStatus(raw?: string | null): Booking['status'] {
  const v = (raw || '').toLowerCase();
  if (/cancel/.test(v)) return 'cancelled';
  if (/pending|provisional|hold|unconfirmed/.test(v)) return 'pending';
  return 'confirmed';
}

function inferDocKind(name?: string | null, ext?: string | null): BookingDocument['kind'] {
  const n = `${name || ''} ${ext || ''}`.toLowerCase();
  if (/atol/.test(n)) return 'atol';
  if (/insur/.test(n)) return 'insurance';
  if (/lounge/.test(n)) return 'lounge-pass';
  if (/e-?ticket|boarding|itinerary/.test(n)) return 'e-ticket';
  if (/voucher/.test(n)) return 'voucher';
  if (/confirm|booking|pack/.test(n)) return 'booking-pack';
  return 'other';
}

// ───────── Main mapper ─────────

export function orderToBooking(
  order: TrimmedOrder | null | undefined,
  agency: ControlAgency | null | undefined,
  typedRef: string,
): Booking | null {
  if (!order || !order.id) return null;

  const items: RawItem[] = Array.isArray(order.items) ? order.items : [];
  const summary: RawSummary = order.summary || {};

  // ----- Flights: one FlightLeg per segment -----
  const flights: FlightLeg[] = [];
  items.forEach((item) => {
    const routes = item.flights?.routes;
    if (!Array.isArray(routes)) return;
    routes.forEach((route) => {
      const segs = Array.isArray(route.segments) ? route.segments : [];
      segs.forEach((seg, si) => {
        if (!seg) return;
        const mk = seg.marketingCarrier || {};
        const op = seg.operatingCarrier || {};
        flights.push({
          id: `flt-${item.id ?? 'x'}-${route.legID ?? 'r'}-${si}`,
          carrierCode: mk.code || op.code || '',
          carrierName: mk.name || op.name || '',
          flightNumber: seg.flightNo || '',
          cabin: normaliseCabin(seg.cabinClass),
          depAirport: seg.origin?.iataCode || '',
          depAirportName: seg.origin?.name || '',
          depCity: '', // Travelify segments carry no city field; UI hides empties
          depTime: seg.depart || '',
          depTerminal: seg.origin?.terminal || undefined,
          arrAirport: seg.destination?.iataCode || '',
          arrAirportName: seg.destination?.name || '',
          arrCity: '',
          arrTime: seg.arrive || '',
          arrTerminal: seg.destination?.terminal || undefined,
          durationMinutes: typeof seg.duration === 'number' ? seg.duration : 0,
          aircraft: seg.aircraft || undefined,
          baggageAllowance: seg.baggage?.allowance || undefined,
          pnr: item.bookingReference || undefined,
        });
      });
    });
  });

  // ----- Hotels: one Hotel per accommodation item (from units[0]) -----
  const hotels: Hotel[] = [];
  items.forEach((item) => {
    const a = item.accommodation;
    if (!a) return;
    const loc = a.location || {};
    const unit = Array.isArray(a.units) && a.units[0] ? a.units[0] : null;
    const checkIn = dateOnly(unit?.checkin || item.startDate || '');
    const nights =
      typeof unit?.nights === 'number'
        ? unit.nights
        : typeof item.duration === 'number'
        ? item.duration
        : 0;
    const checkOut = checkIn && nights ? addDays(checkIn, nights) : '';
    const roomTypeRaw = unit?.roomType || '';
    hotels.push({
      id: `htl-${item.id ?? 'x'}`,
      name: a.name || '',
      stars: typeof a.rating === 'number' ? a.rating : undefined,
      city: loc.city || '',
      region: loc.state || undefined,
      country: loc.country || '',
      countryCode: (loc.country || '').toUpperCase(),
      lat: typeof loc.latitude === 'number' ? loc.latitude : undefined,
      lng: typeof loc.longitude === 'number' ? loc.longitude : undefined,
      checkIn,
      checkOut,
      nights,
      roomName: unit?.name || '',
      roomType: roomTypeRaw && !/unknown/i.test(roomTypeRaw) ? roomTypeRaw : undefined,
      boardBasis: normaliseBoard(unit?.rates?.[0]?.board),
      hotelReference: item.bookingReference || undefined,
    });
  });

  // ----- Airport extras -----
  const airportExtras: AirportExtra[] = [];
  items.forEach((item) => {
    const e = item.airportExtras;
    if (!e) return;
    const guests = Array.isArray(e.travellers) && e.travellers.length ? e.travellers.length : undefined;
    airportExtras.push({
      id: `ext-${item.id ?? 'x'}`,
      type: normaliseExtraType(e.type),
      name: e.name || '',
      airport: e.location?.iataCode || '',
      date: e.startDateTime || item.startDate || '',
      time: timePart(e.startDateTime),
      guests,
      notes: e.subTitle || undefined,
    });
  });

  // ----- Travellers (summary list is already de-duped server-side) -----
  const leadFirst = (order.customerFirstname || '').toLowerCase();
  const leadLast = (order.customerSurname || '').toLowerCase();
  const summaryTravellers: RawPerson[] = Array.isArray(summary.travellers) ? summary.travellers : [];
  const travellers: Traveller[] = summaryTravellers.map((t, i) => {
    const firstName = t.firstname || '';
    const lastName = t.surname || '';
    const matchesLead =
      !!leadFirst && firstName.toLowerCase() === leadFirst && lastName.toLowerCase() === leadLast;
    return {
      id: `trv-${i}`,
      title: t.title || undefined,
      firstName,
      lastName,
      type: normaliseTravellerType(t.type),
      isLead: matchesLead,
    };
  });
  if (travellers.length && !travellers.some((t) => t.isLead)) {
    travellers[0].isLead = true; // ensure exactly one lead
  }

  // ----- Documents (Travelify-embedded; agency uploads come via the
  //       separate /api/traveller/documents route) -----
  const documents: BookingDocument[] = (Array.isArray(order.documents) ? order.documents : [])
    .map((d, i) => ({
      id: `doc-${i}`,
      name: d.name || 'Document',
      kind: inferDocKind(d.name, d.ext),
      url: d.url || '',
      sizeBytes: typeof d.size === 'number' ? d.size : undefined,
      updatedAt: d.created || '',
    }))
    .filter((d) => d.url);

  // ----- Dates -----
  const tripStart = summary.earliestStart || items.find((i) => i.startDate)?.startDate || '';
  const endCandidates: string[] = [];
  hotels.forEach((h) => { if (h.checkOut) endCandidates.push(dateOnly(h.checkOut)); });
  flights.forEach((f) => { if (f.arrTime) endCandidates.push(dateOnly(f.arrTime)); });
  airportExtras.forEach((x) => { if (x.date) endCandidates.push(dateOnly(x.date)); });
  if (summary.latestEnd) endCandidates.push(dateOnly(summary.latestEnd));
  let tripEnd = '';
  endCandidates.forEach((d) => { if (d && (!tripEnd || d > tripEnd)) tripEnd = d; });
  if (!tripEnd) tripEnd = dateOnly(tripStart);

  // tripStartEvent: product of the earliest-starting item
  let earliestProduct = '';
  let earliestDate = '';
  items.forEach((item) => {
    if (item.startDate && (!earliestDate || item.startDate < earliestDate)) {
      earliestDate = item.startDate;
      earliestProduct = item.product || '';
    }
  });
  let tripStartEvent: TripStartEvent = 'other';
  if (earliestProduct === 'Flights' || earliestProduct === 'Packages') tripStartEvent = 'flight';
  else if (earliestProduct === 'Accommodation') tripStartEvent = 'check-in';

  // durationLabel: prefer total hotel nights, else day span
  const totalNights = hotels.reduce((n, h) => n + (h.nights || 0), 0);
  let durationLabel = '';
  if (totalNights > 0) {
    durationLabel = `${totalNights} night${totalNights === 1 ? '' : 's'}`;
  } else if (tripStart && tripEnd) {
    const days = daysBetween(tripStart, tripEnd);
    if (days > 0) durationLabel = `${days} day${days === 1 ? '' : 's'}`;
  }

  // ----- Destination -----
  let destinationLabel = '';
  let primaryCountryCode = '';
  const hotelCities = Array.from(new Set(hotels.map((h) => h.city).filter(Boolean)));
  if (hotels.length) {
    primaryCountryCode = hotels[0].countryCode || '';
    destinationLabel =
      hotelCities.length > 1 ? hotelCities.slice(0, 2).join(' & ') : hotels[0].city || hotels[0].country || '';
  } else if (flights.length) {
    const lastOutbound = flights[flights.length > 1 ? Math.floor(flights.length / 2) - 1 : 0] || flights[0];
    destinationLabel = lastOutbound.arrAirportName || lastOutbound.arrAirport || '';
    primaryCountryCode = '';
  }

  // ----- Payment -----
  let payment: PaymentBreakdown | undefined;
  const currency = order.currency || items.find((i) => i.currency)?.currency || '';
  if (typeof summary.totalPrice === 'number' && summary.totalPrice > 0 && currency) {
    payment = { currency, total: summary.totalPrice };
  }

  // ----- Agency branding (white-label) -----
  const ag: Agency = {
    name: agency?.name || agency?.appName || agency?.legalName || '',
    logoUrl: agency?.logoUrl || undefined,
    phone: agency?.phone || '',
    email: agency?.email || '',
    website: agency?.website || undefined,
    // emergencyPhone and atolNumber are not held on the Control Clients record
    // yet, so they are intentionally omitted (UI hides them).
  };

  const booking: Booking = {
    reference: typedRef, // the customer-typed value — never invented
    travelifyOrderId: order.id != null ? String(order.id) : undefined,
    status: normaliseStatus(order.status),
    leadEmail: order.customerEmail || '',
    destinationLabel,
    primaryCountryCode,
    tripStart,
    tripEnd,
    tripStartEvent,
    durationLabel,
    travellers,
    flights,
    hotels,
    airportExtras,
    documents,
    payment,
    agency: ag,
  };

  return booking;
}
