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
  Experience,
  ExperienceKind,
  Document as BookingDocument,
  PaymentBreakdown,
  Agency,
  TripStartEvent,
} from '@/types/booking';
import { matchLocationSlug } from '@/lib/location-match';

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

/** Shared shape for every pickup/dropoff/venue point Control trims. */
interface RawPoint {
  dateTime?: string | null;
  name?: string | null;
  address1?: string | null;
  iataCode?: string | null;
  country?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}
interface RawMedia { url?: string | null }
interface RawTickets {
  name?: string | null;
  ticketType?: string | null;
  location?: { city?: string | null; country?: string | null; address1?: string | null; latitude?: number | null; longitude?: number | null } | null;
  categories?: Array<string | null>;
  selectedOption?: {
    name?: string | null;
    scheduledDateTime?: string | null;
    scheduledLabel?: string | null;
    subOption?: { name?: string | null } | null;
  } | null;
  media?: RawMedia[];
}
interface RawTransfers {
  type?: string | null;
  vehicle?: string | null;
  company?: string | null;
  journeyDuration?: string | null;
  outPickup?: RawPoint | null;
  outDropoff?: RawPoint | null;
  returnPickup?: RawPoint | null;
  returnDropoff?: RawPoint | null;
  media?: RawMedia[];
}
interface RawCarRental {
  name?: string | null;
  className?: string | null;
  transmission?: string | null;
  seats?: number | null;
  rentalOperator?: { name?: string | null } | null;
  pickup?: RawPoint | null;
  dropoff?: RawPoint | null;
  media?: RawMedia[];
}
interface RawExtraGroup {
  name?: string | null;
  extras?: Array<{ name?: string | null; description?: string | null; qty?: number | null }>;
}

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
  // Control has always trimmed these four; Luna simply never read them, so
  // every transfer, hire car, attraction ticket and add-on was dropped.
  ticketsAttractions?: RawTickets | null;
  transfers?: RawTransfers | null;
  carRental?: RawCarRental | null;
  extras?: RawExtraGroup[] | null;
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

/**
 * Accept a colour only if it is a plain hex (#RGB or #RRGGBB), returning a
 * normalised #rrggbb. Anything else (including CSS functions/expressions) is
 * rejected — these values are written into CSS custom properties on the
 * traveller's device, so unbounded input would be an injection vector.
 */
function hexColour(v?: string | null): string | undefined {
  if (typeof v !== 'string') return undefined;
  const m = /^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.exec(v.trim());
  if (!m) return undefined;
  let h = m[1].toLowerCase();
  if (h.length === 3) h = h.split('').map((c) => c + c).join('');
  return `#${h}`;
}

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

/** Normalise a Travelify country value to uppercase ISO-2, or '' if it isn't one. */
/** Whatever the supplier called this place, in preference order. */
function pointPlace(p?: RawPoint | null): string {
  if (!p) return '';
  return (p.name || p.address1 || p.iataCode || '').trim();
}

function pointCountry(...points: Array<RawPoint | null | undefined>): string {
  for (const p of points) {
    const cc = iso2(p?.country);
    if (cc) return cc;
  }
  return '';
}

function photoUrls(media?: RawMedia[] | null): string[] | undefined {
  const urls = (Array.isArray(media) ? media : [])
    .map((m) => (m?.url || '').trim())
    .filter(Boolean)
    .slice(0, 6);
  return urls.length ? urls : undefined;
}

/** Join the parts of a subtitle that actually exist. */
function joinNotes(...parts: Array<string | null | undefined>): string | undefined {
  const kept = parts.map((x) => (x || '').trim()).filter(Boolean);
  return kept.length ? kept.join(' · ') : undefined;
}

/**
 * A guided tour and a museum ticket are both attractions to Travelify but read
 * very differently on an itinerary, so split them on the supplier's own words
 * rather than showing everything as a generic activity.
 */
function attractionKind(t: RawTickets): ExperienceKind {
  const words = [t.ticketType || '', ...(t.categories || []).map((c) => c || '')].join(' ').toLowerCase();
  return /tour|excursion|safari|cruise|day trip|sightseeing/.test(words) ? 'excursion' : 'activity';
}

function iso2(v: string | null | undefined): string {
  const s = (v || '').trim().toUpperCase();
  return /^[A-Z]{2}$/.test(s) ? s : '';
}

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
          arrCountryCode: iso2(seg.destination?.country),
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

  // ----- Experiences: attraction tickets, transfers, car hire, add-ons -----
  // Control trims all four; until now none was read, so a booking made of them
  // rendered as an empty trip. They all land in `experiences`, which already
  // has a timeline entry and a detail page.
  const experiences: Experience[] = [];
  items.forEach((item) => {
    const ref = item.bookingReference || undefined;
    const itemDate = dateOnly(item.startDate);
    const key = item.id ?? 'x';

    const t = item.ticketsAttractions;
    if (t) {
      const loc = t.location || {};
      const opt = t.selectedOption || null;
      // The scheduled date is the one the customer booked; item.startDate is
      // only a fallback for suppliers that leave the option unscheduled.
      const when = opt?.scheduledDateTime || item.startDate || '';
      experiences.push({
        id: `tkt-${key}`,
        kind: attractionKind(t),
        title: t.name || opt?.name || 'Attraction ticket',
        location: (loc.city || loc.address1 || '').trim() || undefined,
        startDate: dateOnly(when) || itemDate,
        time: timePart(when),
        notes: joinNotes(opt?.scheduledLabel, opt?.subOption?.name, t.ticketType),
        reference: ref,
        photos: photoUrls(t.media),
        lat: typeof loc.latitude === 'number' ? loc.latitude : undefined,
        lng: typeof loc.longitude === 'number' ? loc.longitude : undefined,
        countryCode: iso2(loc.country),
      });
    }

    const tr = item.transfers;
    if (tr) {
      // A return transfer is a second journey on a different day, so it gets
      // its own entry rather than being folded into the outbound one.
      const journeys: Array<{ from?: RawPoint | null; to?: RawPoint | null; suffix: string }> = [
        { from: tr.outPickup, to: tr.outDropoff, suffix: 'out' },
        { from: tr.returnPickup, to: tr.returnDropoff, suffix: 'ret' },
      ];
      journeys.forEach(({ from, to, suffix }) => {
        if (!from && !to) return;
        const dest = pointPlace(to);
        experiences.push({
          id: `trf-${key}-${suffix}`,
          kind: 'transfer',
          title: dest ? `Transfer to ${dest}` : tr.vehicle || 'Transfer',
          supplier: tr.company || undefined,
          location: pointPlace(from) || undefined,
          startDate: dateOnly(from?.dateTime || item.startDate || '') || itemDate,
          time: timePart(from?.dateTime),
          notes: joinNotes(tr.vehicle, tr.type, tr.journeyDuration),
          reference: ref,
          photos: photoUrls(tr.media),
          lat: typeof from?.latitude === 'number' ? from.latitude : undefined,
          lng: typeof from?.longitude === 'number' ? from.longitude : undefined,
          countryCode: pointCountry(to, from),
        });
      });
    }

    const cr = item.carRental;
    if (cr) {
      experiences.push({
        id: `car-${key}`,
        kind: 'car-hire',
        title: cr.name || cr.className || 'Car hire',
        supplier: cr.rentalOperator?.name || undefined,
        location: pointPlace(cr.pickup) || undefined,
        startDate: dateOnly(cr.pickup?.dateTime || item.startDate || '') || itemDate,
        endDate: dateOnly(cr.dropoff?.dateTime || '') || undefined,
        time: timePart(cr.pickup?.dateTime),
        notes: joinNotes(
          cr.className,
          cr.transmission,
          typeof cr.seats === 'number' && cr.seats > 0 ? `${cr.seats} seats` : '',
        ),
        reference: ref,
        photos: photoUrls(cr.media),
        lat: typeof cr.pickup?.latitude === 'number' ? cr.pickup.latitude : undefined,
        lng: typeof cr.pickup?.longitude === 'number' ? cr.pickup.longitude : undefined,
        countryCode: pointCountry(cr.pickup, cr.dropoff),
      });
    }

    // Extras are the one product whose dataObject is an array of groups, each
    // holding several bookable add-ons. Each add-on is its own line.
    (item.extras || []).forEach((group, gi) => {
      (group?.extras || []).forEach((extra, ei) => {
        const name = (extra?.name || '').trim();
        if (!name) return;
        const qty = typeof extra?.qty === 'number' && extra.qty > 1 ? `×${extra.qty}` : '';
        experiences.push({
          id: `xtr-${key}-${gi}-${ei}`,
          kind: 'other',
          title: qty ? `${name} ${qty}` : name,
          location: undefined,
          startDate: itemDate,
          notes: joinNotes(extra?.description, group?.name),
          reference: ref,
        });
      });
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
  let tripStart = summary.earliestStart || items.find((i) => i.startDate)?.startDate || '';
  const endCandidates: string[] = [];
  hotels.forEach((h) => { if (h.checkOut) endCandidates.push(dateOnly(h.checkOut)); });
  flights.forEach((f) => { if (f.arrTime) endCandidates.push(dateOnly(f.arrTime)); });
  airportExtras.forEach((x) => { if (x.date) endCandidates.push(dateOnly(x.date)); });
  // An attraction is scheduled for the date the customer picked, which can sit
  // outside the item's own start date, so the window has to stretch to it or
  // the entry lands off the end of the itinerary.
  experiences.forEach((x) => {
    const start = dateOnly(x.startDate);
    if (start) {
      endCandidates.push(start);
      if (!tripStart || start < dateOnly(tripStart)) tripStart = start;
    }
    if (x.endDate) endCandidates.push(dateOnly(x.endDate));
  });
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
    // Flights-only booking (no hotel to read the country from): the arrival
    // airport's country IS the destination country. Without this the booking
    // had no country code at all, so the destination hero/cover never loaded
    // and the guide/weather had nothing to key on.
    primaryCountryCode = lastOutbound.arrCountryCode || '';
  }

  // Best-effort city/region match for a location-specific hero — auto-synced
  // bookings have no human "pick the area" step. Signals are the hotel cities
  // and the destination label, scoped to this booking's own country. Returns
  // undefined (country hero) unless it matches confidently.
  const locationSlug = matchLocationSlug(primaryCountryCode, [...hotelCities, destinationLabel]);

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
    // White-label fields. Colours are sanitised to #RRGGBB before they ever
    // reach the browser — they are written into CSS variables, so an unbounded
    // string would be a CSS-injection vector.
    appName: agency?.appName?.trim() || undefined,
    brandPrimaryColour: hexColour(agency?.brandPrimaryColour),
    brandAccentColour: hexColour(agency?.brandAccentColour),
    welcomeMessage: agency?.welcomeMessage?.trim() || undefined,
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
    locationSlug,
    tripStart,
    tripEnd,
    tripStartEvent,
    durationLabel,
    travellers,
    flights,
    hotels,
    airportExtras,
    experiences,
    documents,
    payment,
    agency: ag,
  };

  fillTripSummaryGaps(booking);

  return booking;
}

/**
 * Fill in trip summary fields that the hotel/flight derivation above could not
 * produce.
 *
 * It exists for bookings made of neither: attraction tickets, a day excursion,
 * a transfer on its own. Everything upstream reads the destination off a hotel
 * city or a flight arrival airport, so those bookings came out with no
 * destination, no duration and no hero — a blank trip that still rendered.
 *
 * Only ever fills gaps. Anything already derived, or set explicitly by an
 * agent on a manual booking, is left exactly as it is.
 */
export function fillTripSummaryGaps(booking: Booking): void {
  const experiences = booking.experiences ?? [];

  // Country first — the hero, the destination guide and the weather all key on
  // it, and on a booking of attraction tickets an experience is the only thing
  // carrying one.
  if (!booking.primaryCountryCode) {
    const cc = experiences.map((e) => e.countryCode || '').find(Boolean);
    if (cc) booking.primaryCountryCode = cc;
  }

  if (!booking.destinationLabel) {
    const places = Array.from(
      new Set(experiences.map((e) => (e.location || '').trim()).filter(Boolean)),
    );
    // Two at most, matching how multi-city hotel bookings are labelled.
    if (places.length) {
      booking.destinationLabel = places.length > 1 ? places.slice(0, 2).join(' & ') : places[0];
    }
  }

  // A location hero is matched within a country, so this can only run once
  // something has supplied a country code. An experience carries a free-text
  // place, never an ISO code, so it cannot supply one itself.
  if (!booking.locationSlug && booking.primaryCountryCode) {
    const signals = [...experiences.map((e) => e.location || ''), booking.destinationLabel];
    booking.locationSlug = matchLocationSlug(booking.primaryCountryCode, signals);
  }

  // A day trip spans no nights and no whole days, so the label came out empty
  // and the trip read as having no length at all.
  if (!booking.durationLabel && booking.tripStart) {
    const days = daysBetween(booking.tripStart, booking.tripEnd || booking.tripStart);
    booking.durationLabel = days > 0 ? `${days} day${days === 1 ? '' : 's'}` : '1 day';
  }
}
