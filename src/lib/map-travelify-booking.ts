/**
 * Travelify order → Luna Travel `Booking` mapper.
 *
 * DESIGN PRINCIPLE (per Andy, 27 May 2026):
 *   Real bookings arrive in wildly varying shapes and completeness. Documents
 *   and payments may be empty now and fill in later. Fields like roomType may
 *   be "Unknown" now and real later. The mapper must therefore be defensive
 *   EVERYWHERE — every field optional until proven present, every array
 *   possibly empty, every nested object possibly missing. It degrades
 *   gracefully and NEVER invents data (travelgenix-security Rule 8).
 *
 * KEY STRUCTURAL DECISION — flights:
 *   Travelify nests flights as items[].dataObject.routes[].segments[]. A single
 *   route may contain multiple segments (e.g. JFK→BOS then BOS→LAS). The PWA's
 *   FlightLeg is one leg = one segment. So we FLATTEN every segment across
 *   every route into its own FlightLeg. Confirmed against the real DEMO61807
 *   multi-city booking, which renders as 5 distinct flight rows.
 *
 * What we deliberately DON'T do:
 *   - No fabricated check-out: derived from check-in + nights (the only honest
 *     source Travelify gives us).
 *   - No invented terminals/baggage/PNR/seats — left undefined, UI hides them.
 *   - No guessed board basis — passed through formatBoard's whitelist rules at
 *     render time; here we just carry the raw string.
 */

import type {
  Booking,
  Traveller,
  TravellerType,
  FlightLeg,
  FlightCabin,
  Hotel,
  AirportExtra,
  Document as TravelDocument,
  PaymentBreakdown,
  BoardBasis,
  Agency,
  TripStartEvent,
} from '@/types/booking';

// ───────────────────────── tiny safe accessors ─────────────────────────

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.trim() !== '' ? v : undefined;

const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;

const obj = (v: unknown): Record<string, unknown> =>
  v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};

const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);

/** Travelify dates often lack a timezone ("2026-04-01T00:00:00"). Treat such
 *  values as UTC so downstream Date parsing is stable across environments. */
function toIso(v: unknown): string | undefined {
  const s = str(v);
  if (!s) return undefined;
  // Already has zone (Z or ±hh:mm)?
  if (/(Z|[+-]\d{2}:?\d{2})$/.test(s)) {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
  }
  // Naive datetime — assume UTC.
  const d = new Date(s + 'Z');
  return Number.isNaN(d.getTime()) ? undefined : d.toISOString();
}

function addDays(iso: string, days: number): string {
  const d = new Date(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString();
}

// ───────────────────────── enums ─────────────────────────

const CABINS: FlightCabin[] = ['Economy', 'PremiumEconomy', 'Business', 'First'];
function toCabin(v: unknown): FlightCabin {
  const s = (str(v) ?? '').replace(/\s+/g, '');
  const hit = CABINS.find((c) => c.toLowerCase() === s.toLowerCase());
  return hit ?? 'Economy'; // Economy is the safe, non-misleading default
}

const BOARDS: BoardBasis[] = [
  'RoomOnly', 'SelfCatering', 'BedAndBreakfast', 'HalfBoard', 'HalfBoardPlus',
  'FullBoard', 'FullBoardPlus', 'AllInclusive', 'AllInclusivePlus', 'UltraAllInclusive',
];
/** Returns a valid BoardBasis or undefined — never a fabricated default. */
function toBoard(v: unknown): BoardBasis | undefined {
  const s = str(v);
  if (!s) return undefined;
  return BOARDS.find((b) => b.toLowerCase() === s.toLowerCase());
}

function toTravellerType(v: unknown): TravellerType {
  const s = (str(v) ?? '').toLowerCase();
  if (s === 'child') return 'child';
  if (s === 'infant') return 'infant';
  return 'adult';
}

function toStatus(v: unknown): Booking['status'] {
  const s = (str(v) ?? '').toLowerCase();
  if (s === 'confirmed') return 'confirmed';
  if (s === 'cancelled' || s === 'canceled') return 'cancelled';
  return 'pending';
}

// ───────────────────────── travellers ─────────────────────────

interface RawGuest {
  type?: unknown; title?: unknown; firstname?: unknown; surname?: unknown;
  dateOfBirth?: unknown; nationality?: unknown;
}

function ageFromDob(dob: unknown): number | undefined {
  const s = str(dob);
  if (!s) return undefined;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return undefined;
  const diff = Date.now() - d.getTime();
  const age = Math.floor(diff / (1000 * 60 * 60 * 24 * 365.25));
  return age >= 0 && age < 130 ? age : undefined;
}

function guestKey(g: RawGuest): string {
  return `${str(g.firstname) ?? ''}|${str(g.surname) ?? ''}|${str(g.dateOfBirth) ?? ''}`.toLowerCase();
}

/** Gather travellers from across all items, de-dupe by name+dob, mark a lead. */
function collectTravellers(items: Record<string, unknown>[]): Traveller[] {
  const seen = new Map<string, Traveller>();
  let i = 0;

  for (const item of items) {
    const data = obj(item.dataObject);
    // Hotels expose `guests`, flights expose `travellers` — same shape.
    const raw = [...arr(data.guests), ...arr(data.travellers)] as RawGuest[];
    for (const g of raw) {
      const key = guestKey(g);
      if (!key || key === '||' || seen.has(key)) continue;
      i += 1;
      seen.set(key, {
        id: `t${i}`,
        title: str(g.title),
        firstName: str(g.firstname) ?? '',
        lastName: str(g.surname) ?? '',
        type: toTravellerType(g.type),
        age: ageFromDob(g.dateOfBirth),
        passportNationality: str(g.nationality),
        isLead: false,
      });
    }
  }

  const list = [...seen.values()];
  if (list.length) list[0].isLead = true;
  return list;
}

// ───────────────────────── hotels ─────────────────────────

function mapHotel(item: Record<string, unknown>, idx: number): Hotel | null {
  const data = obj(item.dataObject);
  const name = str(data.name);
  if (!name) return null; // no name = nothing meaningful to render

  const loc = obj(data.location);
  const unit = obj(arr(data.units)[0]);
  const firstRate = obj(arr(unit.rates)[0]);

  const checkInIso =
    toIso(unit.checkin) ?? toIso(item.startDate);
  if (!checkInIso) return null; // can't place it on the timeline without a date

  const nights = num(unit.nights) ?? num(item.duration) ?? 1;
  const roomTypeRaw = str(unit.roomType);

  return {
    id: str(item.id) ? `h-${item.id}` : `h-${idx}`,
    name,
    stars: num(data.rating),
    // Travelify gives a single "city"; address2 sometimes holds a broader area.
    city: str(loc.city) ?? str(loc.address2) ?? '',
    region: str(loc.address2),
    country: str(loc.country) ?? '',
    countryCode: (str(loc.country) ?? '').toUpperCase().slice(0, 2),
    lat: num(loc.latitude),
    lng: num(loc.longitude),
    checkIn: checkInIso,
    checkOut: addDays(checkInIso, nights),
    nights,
    roomName: str(unit.name) ?? '',
    // Hide "Unknown" — only carry a real room type.
    roomType: roomTypeRaw && roomTypeRaw.toLowerCase() !== 'unknown' ? roomTypeRaw : undefined,
    boardBasis: toBoard(firstRate.board),
    hotelReference: str(item.bookingReference),
  };
}

// ───────────────────────── flights (flatten segments) ─────────────────────────

function mapFlightSegments(item: Record<string, unknown>): FlightLeg[] {
  const data = obj(item.dataObject);
  const routes = arr(data.routes);
  const legs: FlightLeg[] = [];
  let seg = 0;

  for (const routeRaw of routes) {
    const route = obj(routeRaw);
    for (const segRaw of arr(route.segments)) {
      const s = obj(segRaw);
      const origin = obj(s.origin);
      const dest = obj(s.destination);
      const depTime = toIso(s.depart);
      const arrTime = toIso(s.arrive);
      if (!depTime || !arrTime) continue; // a flight with no times can't be shown

      const carrier = obj(s.operatingCarrier ?? s.marketingCarrier);
      seg += 1;

      legs.push({
        id: str(item.id) ? `f-${item.id}-${seg}` : `f-${seg}`,
        carrierCode: str(carrier.code) ?? '',
        carrierName: str(carrier.name) ?? str(carrier.code) ?? 'Airline',
        flightNumber: str(s.flightNo) ?? '',
        cabin: toCabin(s.cabinClass),
        depAirport: str(origin.iataCode) ?? '',
        depAirportName: str(origin.name) ?? str(origin.iataCode) ?? '',
        depCity: cityFromAirport(origin),
        depTime,
        arrAirport: str(dest.iataCode) ?? '',
        arrAirportName: str(dest.name) ?? str(dest.iataCode) ?? '',
        arrCity: cityFromAirport(dest),
        arrTime,
        durationMinutes: num(s.duration) ?? minutesBetween(depTime, arrTime),
        aircraft: str(s.aircraft),
        // terminals / baggage / pnr / seats: not in this feed → left undefined.
      });
    }
  }
  return legs;
}

/** Travelify airport `description` is "London, England, UK (LHR-Heathrow)".
 *  Pull a human city from it; otherwise fall back to the airport name. */
function cityFromAirport(a: Record<string, unknown>): string {
  const desc = str(a.description);
  if (desc) {
    const city = desc.split(',')[0]?.trim();
    if (city) return city;
  }
  return str(a.name) ?? str(a.iataCode) ?? '';
}

function minutesBetween(a: string, b: string): number {
  const d = (new Date(b).getTime() - new Date(a).getTime()) / 60000;
  return d > 0 && Number.isFinite(d) ? Math.round(d) : 0;
}

/**
 * For flight-only bookings, derive the destination country from the final
 * flight segment's arrival airport. Returns '' if not determinable.
 */
function lastFlightArrivalCountry(items: Record<string, unknown>[]): string {
  let country = '';
  for (const item of items) {
    if (str(item.product) !== 'Flights') continue;
    const data = obj(item.dataObject);
    for (const routeRaw of arr(data.routes)) {
      const route = obj(routeRaw);
      for (const segRaw of arr(route.segments)) {
        const dest = obj(obj(segRaw).destination);
        const c = str(dest.country);
        if (c) country = c.toUpperCase().slice(0, 2); // keep the latest = final arrival
      }
    }
  }
  return country;
}

// ───────────────────────── documents & payments (often empty now) ─────────────────────────

function mapDocuments(raw: unknown[]): TravelDocument[] {
  const out: TravelDocument[] = [];
  raw.forEach((dRaw, i) => {
    const d = obj(dRaw);
    const url = str(d.url) ?? str(d.href);
    const name = str(d.name) ?? str(d.title) ?? `Document ${i + 1}`;
    if (!url) return; // a document with no link is not useful
    out.push({
      id: str(d.id) ?? `doc-${i}`,
      name,
      kind: 'other', // refine once we see Travelify's real document shape
      url,
      updatedAt: toIso(d.updated) ?? toIso(d.created) ?? new Date().toISOString(),
    });
  });
  return out;
}

function mapPayment(raw: unknown[], currency: string, fallbackTotal: number): PaymentBreakdown | undefined {
  // Travelify `payments` is empty on many orders. If there's nothing, we still
  // surface an order total derived from item prices so the money section has
  // something honest to show — but only if we actually have a positive total.
  if (raw.length === 0) {
    return fallbackTotal > 0 ? { currency, total: fallbackTotal } : undefined;
  }
  let total = 0;
  for (const pRaw of raw) {
    const p = obj(pRaw);
    total += num(p.amount) ?? num(p.price) ?? 0;
  }
  return { currency, total: total > 0 ? total : fallbackTotal };
}

// ───────────────────────── headline (trip span, destination) ─────────────────────────

const DEFAULT_AGENCY: Agency = {
  name: 'Your travel agent',
  phone: '',
  email: '',
};

function tripStartEventFor(firstKind: 'flight' | 'hotel' | 'extra' | null): TripStartEvent {
  if (firstKind === 'flight') return 'flight';
  if (firstKind === 'hotel') return 'check-in';
  return 'other';
}

// ───────────────────────── the mapper ─────────────────────────

export interface MapResult {
  booking: Booking;
  /** Diagnostics — what was present, what was empty, what we couldn't map.
   *  Surfaced by the review endpoint; never shown to travellers. */
  report: {
    itemCount: number;
    flightsMapped: number;
    hotelsMapped: number;
    travellersMapped: number;
    documentsMapped: number;
    hasPayment: boolean;
    skipped: string[];
    notes: string[];
  };
}

export function mapTravelifyBooking(
  rawInput: unknown,
  opts?: { reference?: string; agency?: Partial<Agency> },
): MapResult {
  const raw = obj(rawInput);
  const skipped: string[] = [];
  const notes: string[] = [];

  const items = arr(raw.items).map(obj);
  const currency = str(raw.currency) ?? 'GBP';

  // ── components ──
  const hotels: Hotel[] = [];
  const flights: FlightLeg[] = [];
  const airportExtras: AirportExtra[] = []; // none in current feed; structure ready
  let priceTotal = 0;

  items.forEach((item, idx) => {
    const product = str(item.product) ?? 'unknown';
    priceTotal += num(item.price) ?? 0;

    if (product === 'Accommodation') {
      const h = mapHotel(item, idx);
      if (h) hotels.push(h);
      else skipped.push(`item ${idx} (Accommodation) — no name or date`);
    } else if (product === 'Flights') {
      const legs = mapFlightSegments(item);
      if (legs.length) flights.push(...legs);
      else skipped.push(`item ${idx} (Flights) — no usable segments`);
    } else {
      skipped.push(`item ${idx} (${product}) — no mapper for this product type yet`);
      notes.push(`Unmapped product type "${product}" — extend the mapper when needed.`);
    }
  });

  const travellers = collectTravellers(items);
  if (travellers.length === 0) {
    // Fall back to the order customer as the sole traveller.
    const fn = str(raw.customerFirstname);
    const ln = str(raw.customerSurname);
    if (fn || ln) {
      travellers.push({
        id: 't1', title: str(raw.customerTitle),
        firstName: fn ?? '', lastName: ln ?? '',
        type: 'adult', isLead: true,
        passportNationality: undefined,
      });
      notes.push('No traveller list on items — used order customer as lead.');
    }
  }

  const documents = mapDocuments(arr(raw.documents));
  if (arr(raw.documents).length === 0) {
    notes.push('No documents on the order — section will show its empty state.');
  }
  const payment = mapPayment(arr(raw.payments), currency, priceTotal);
  if (arr(raw.payments).length === 0) {
    notes.push('No payments on the order — total derived from item prices.');
  }

  // ── trip span from REAL events only (no guessing) ──
  const eventDates: Array<{ iso: string; kind: 'flight' | 'hotel' | 'extra' }> = [];
  for (const f of flights) {
    eventDates.push({ iso: f.depTime, kind: 'flight' });
    eventDates.push({ iso: f.arrTime, kind: 'flight' });
  }
  for (const h of hotels) {
    eventDates.push({ iso: h.checkIn, kind: 'hotel' });
    eventDates.push({ iso: h.checkOut, kind: 'hotel' });
  }
  eventDates.sort((a, b) => new Date(a.iso).getTime() - new Date(b.iso).getTime());

  const tripStart = eventDates[0]?.iso ?? new Date().toISOString();
  const tripEnd = eventDates[eventDates.length - 1]?.iso ?? tripStart;
  const firstKind = eventDates[0]?.kind ?? null;

  if (eventDates.length) {
    const spanDays = Math.ceil(
      (new Date(tripEnd).getTime() - new Date(tripStart).getTime()) / 86400000,
    );
    if (spanDays > 60) {
      notes.push(
        `Trip span is ${spanDays} days — likely a stitched test booking with ` +
        `mismatched item dates. Rendered honestly from the real dates.`,
      );
    }
  } else {
    notes.push('No dated events — trip span defaulted to today.');
  }

  // ── destination label & primary country ──
  const hotelCities = hotels.map((h) => h.city).filter(Boolean);
  const uniqueCities = [...new Set(hotelCities)];
  let destinationLabel = '';
  if (uniqueCities.length === 1) destinationLabel = uniqueCities[0];
  else if (uniqueCities.length === 2) destinationLabel = uniqueCities.join(' & ');
  else if (uniqueCities.length > 2) destinationLabel = `${uniqueCities[0]} & more`;
  else if (flights.length) destinationLabel = flights[flights.length - 1].arrCity || '';

  // Primary country: prefer the first hotel's country; otherwise (flight-only
  // bookings) use the final flight segment's arrival country, read from the raw
  // flight items. Empty string if neither is available — UI hides the guide.
  const primaryCountryCode =
    hotels.find((h) => h.countryCode)?.countryCode ?? lastFlightArrivalCountry(items);

  // duration label
  const nightsTotal = hotels.reduce((sum, h) => sum + (h.nights || 0), 0);
  const durationLabel = nightsTotal > 0
    ? `${nightsTotal} night${nightsTotal === 1 ? '' : 's'}`
    : '';

  const booking: Booking = {
    reference: opts?.reference ?? str(raw.key) ?? str(raw.id) ?? '',
    travelifyOrderId: str(raw.id),
    status: toStatus(raw.status),
    leadEmail: str(raw.customerEmail) ?? '',
    destinationLabel,
    primaryCountryCode,
    tripStart,
    tripEnd,
    tripStartEvent: tripStartEventFor(firstKind),
    durationLabel,
    travellers,
    flights,
    hotels,
    airportExtras,
    documents,
    payment,
    agency: { ...DEFAULT_AGENCY, ...(opts?.agency ?? {}) },
  };

  return {
    booking,
    report: {
      itemCount: items.length,
      flightsMapped: flights.length,
      hotelsMapped: hotels.length,
      travellersMapped: travellers.length,
      documentsMapped: documents.length,
      hasPayment: !!payment,
      skipped,
      notes,
    },
  };
}
