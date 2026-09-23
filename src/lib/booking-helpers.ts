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
  Experience,
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
  | 'excursion'
  | 'car-hire'
  | 'activity'
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
const DAY_MS = 86_400_000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;
const isDateOnly = (iso: string) => DATE_ONLY.test(iso);

/**
 * Over yet? A bare date is a day, so it is not over until the day is: a check-in
 * dated today is still ahead of somebody who has not landed.
 */
const isPast = (iso: string) => {
  const t = new Date(iso).getTime();
  return (isDateOnly(iso) ? t + DAY_MS : t) < now();
};

/**
 * Where an event with no time of day goes within its day.
 *
 * Travelify dates a hotel check-in and check-out with no time, and read as an
 * instant that is midnight, so a check-in came out BEFORE the flight that takes
 * you there (WCS96420, Rome, 23 Sep 2026). A bare date is placed by what it is
 * instead:
 *
 *   'before'  the departure end of the day — checking out, parking, the lounge,
 *             fast track — goes first, before that day's travel.
 *   number    everything else happens once you have arrived: after the last
 *             flight or transfer to land that day, the transfer first, then
 *             the hotel, then anything else booked for the day.
 */
const UNTIMED_PLACE: Record<EventKind, 'before' | number> = {
  'hotel-checkout': 'before',
  parking: 'before',
  lounge: 'before',
  'fast-track': 'before',
  transfer: 1,
  'car-hire': 1,
  'hotel-checkin': 2,
  excursion: 3,
  activity: 3,
  other: 3,
  flight: 3, // a flight always carries a time; listed for completeness
};

/** The kinds that bring somebody to where they are staying. */
const ARRIVES: EventKind[] = ['flight', 'transfer', 'car-hire'];

function orderedByTime(events: TimelineEvent[]): TimelineEvent[] {
  // The latest timed arrival on each calendar day. Flights land at endDate;
  // a transfer or car hire is over at its end, or at its start if that is all
  // it has. Airport-local times arrive dressed as UTC, so the UTC date is the
  // local day.
  const arrivals = new Map<string, number>();
  for (const e of events) {
    if (!ARRIVES.includes(e.kind)) continue;
    const at = e.endDate || e.date;
    if (!at || isDateOnly(at)) continue;
    const t = new Date(at).getTime();
    if (!Number.isFinite(t)) continue;
    const day = new Date(t).toISOString().slice(0, 10);
    arrivals.set(day, Math.max(arrivals.get(day) ?? -Infinity, t));
  }

  const key = (e: TimelineEvent): number => {
    const t = new Date(e.date).getTime();
    if (!isDateOnly(e.date)) return t;
    const place = UNTIMED_PLACE[e.kind];
    if (place === 'before') return t;
    const landed = arrivals.get(e.date);
    return (landed ?? t) + place;
  };

  return events
    .map((e, i) => ({ e, i, k: key(e) }))
    .sort((a, b) => a.k - b.k || a.i - b.i)
    .map((x) => x.e);
}

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
      title: `${f.flightNumber}${f.depCity && f.arrCity ? ` · ${f.depCity} → ${f.arrCity}` : ''}`,
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

  for (const x of booking.experiences ?? []) {
    events.push({
      id: `experience-${x.id}`,
      kind: experienceEventKind(x.kind),
      date: x.startDate,
      endDate: x.endDate,
      title: x.title,
      subtitle: experienceSubtitle(x),
      meta: x.location || x.supplier || '',
      href: `/experience/${x.id}`,
      past: isPast(x.endDate || x.startDate),
    });
  }

  return orderedByTime(events);
}

function experienceEventKind(k: Experience['kind']): EventKind {
  switch (k) {
    case 'excursion': return 'excursion';
    case 'car-hire': return 'car-hire';
    case 'transfer': return 'transfer';
    case 'activity': return 'activity';
    case 'lounge': return 'lounge';
    case 'parking': return 'parking';
    case 'fast-track': return 'fast-track';
    default: return 'other';
  }
}

const EXPERIENCE_LABELS: Record<Experience['kind'], string> = {
  excursion: 'Excursion',
  'car-hire': 'Car hire',
  transfer: 'Transfer',
  activity: 'Activity',
  lounge: 'Airport lounge',
  parking: 'Airport parking',
  'fast-track': 'Security fast track',
  other: 'Experience',
};

function experienceSubtitle(x: Experience): string {
  const label = EXPERIENCE_LABELS[x.kind];
  return x.supplier ? `${label} · ${x.supplier}` : label;
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

export function findExperience(booking: Booking, id: string): Experience | undefined {
  return (booking.experiences ?? []).find((x) => x.id === id);
}

export { EXPERIENCE_LABELS };

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
