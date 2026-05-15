/**
 * Booking helper functions — pure, no React, no side effects.
 *
 * The itinerary timeline needs a single ordered list of events from
 * many sources (flights, hotels, airport extras). This file builds it.
 */

import type {
  Booking,
  FlightLeg,
  Hotel,
  AirportExtra,
  Traveller,
} from '@/types/booking';

export type EventKind =
  | 'flight'
  | 'hotel-checkin'
  | 'hotel-checkout'
  | 'lounge'
  | 'parking'
  | 'fast-track'
  | 'transfer'
  | 'other';

export interface TimelineEvent {
  id: string;
  kind: EventKind;
  date: string; // ISO
  endDate?: string;
  title: string;
  subtitle?: string;
  meta?: string;
  href: string; // detail page
  past: boolean;
}

const now = () => Date.now();
const isPast = (iso: string) => new Date(iso).getTime() < now();

/**
 * Build the canonical ordered event list for a booking.
 * One flight → one event. One hotel → two events (check-in, check-out).
 */
export function buildTimeline(booking: Booking): TimelineEvent[] {
  const events: TimelineEvent[] = [];

  for (const f of booking.flights) {
    events.push({
      id: `flight-${f.id}`,
      kind: 'flight',
      date: f.depTime,
      endDate: f.arrTime,
      title: `${f.flightNumber} · ${f.depCity} → ${f.arrCity}`,
      subtitle: `${f.carrierName} ${cabinLabel(f.cabin)}`,
      meta: `${f.depAirport} → ${f.arrAirport}`,
      href: `/flight/${f.id}`,
      past: isPast(f.arrTime),
    });
  }

  for (const h of booking.hotels) {
    events.push({
      id: `hotel-checkin-${h.id}`,
      kind: 'hotel-checkin',
      date: h.checkIn,
      title: h.name,
      subtitle: `Check in · ${h.nights} night${h.nights === 1 ? '' : 's'}`,
      meta: [h.resort, h.city].filter(Boolean).join(' · '),
      href: `/hotel/${h.id}`,
      past: isPast(h.checkIn),
    });
    events.push({
      id: `hotel-checkout-${h.id}`,
      kind: 'hotel-checkout',
      date: h.checkOut,
      title: h.name,
      subtitle: 'Check out',
      meta: [h.resort, h.city].filter(Boolean).join(' · '),
      href: `/hotel/${h.id}`,
      past: isPast(h.checkOut),
    });
  }

  for (const x of booking.airportExtras) {
    events.push({
      id: `extra-${x.id}`,
      kind: x.type === 'lounge' ? 'lounge' : x.type === 'parking' ? 'parking' : x.type === 'fast-track' ? 'fast-track' : 'other',
      date: x.date,
      title: x.name,
      subtitle: extraSubtitle(x),
      meta: x.airport,
      href: `/extra/${x.id}`,
      past: isPast(x.date),
    });
  }

  events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  return events;
}

function extraSubtitle(x: AirportExtra): string {
  switch (x.type) {
    case 'lounge': return 'Airport lounge';
    case 'parking': return 'Airport parking';
    case 'fast-track': return 'Security fast track';
    case 'hotel': return 'Airport hotel';
    default: return 'Extra';
  }
}

function cabinLabel(c: string): string {
  if (c === 'PremiumEconomy') return 'Premium Economy';
  return c;
}

/**
 * The next event chronologically that hasn't happened yet.
 * Returns undefined if everything is in the past.
 */
export function nextEvent(booking: Booking): TimelineEvent | undefined {
  return buildTimeline(booking).find((e) => !e.past);
}

/**
 * Group events by calendar day. Returns an array of [dayISO, events].
 */
export function groupByDay(events: TimelineEvent[]): Array<{ day: string; events: TimelineEvent[] }> {
  const map = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const d = new Date(e.date);
    const key = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(d.getUTCDate()).padStart(2, '0')}`;
    const list = map.get(key) ?? [];
    list.push(e);
    map.set(key, list);
  }
  return Array.from(map.entries()).map(([day, list]) => ({ day, events: list }));
}

export function findFlight(booking: Booking, id: string): FlightLeg | undefined {
  return booking.flights.find((f) => f.id === id);
}

export function findHotel(booking: Booking, id: string): Hotel | undefined {
  return booking.hotels.find((h) => h.id === id);
}

export function findExtra(booking: Booking, id: string): AirportExtra | undefined {
  return booking.airportExtras.find((x) => x.id === id);
}

export function leadTraveller(booking: Booking): Traveller {
  return booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];
}

export function travellerById(booking: Booking, id: string): Traveller | undefined {
  return booking.travellers.find((t) => t.id === id);
}

/**
 * Total trip length in days (start-of-day to end-of-day inclusive).
 */
export function totalDays(booking: Booking): number {
  const s = new Date(booking.tripStart);
  const e = new Date(booking.tripEnd);
  const ms = e.getTime() - s.getTime();
  return Math.max(1, Math.ceil(ms / (1000 * 60 * 60 * 24)));
}
