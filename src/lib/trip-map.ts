/**
 * Trip-map model builder — pure, no React.
 *
 * Turns a Booking into the geometry the map renders:
 *   - nodes: airports, hotels and located airport-extras, each with a stable
 *     order number that follows the trip chronologically.
 *   - legs:  flight arcs (airport → airport) and ground transfers
 *     (airport ↔ hotel), inferred from the booking timing.
 *
 * Data integrity (Rule 8): a node is only produced when a real coordinate
 * exists — hotels carry lat/lng on the booking; airports resolve through the
 * verified airportCoord() table. Anything unresolved is silently dropped, so
 * the map never plots a guessed location.
 */

import type { Booking, Hotel, FlightLeg } from '@/types/booking';
import { airportCoord } from '@/data/airports';
import { haversineKm, type LngLat } from '@/lib/geo';

export type MapNodeKind = 'airport' | 'hotel' | 'extra';

export interface MapNode {
  id: string;
  kind: MapNodeKind;
  order: number; // 1-based, chronological
  lng: number;
  lat: number;
  title: string; // primary label
  code?: string; // IATA for airports
  subtitle?: string; // city / resort / dates
  href?: string; // detail page, if any
}

export type MapLegKind = 'flight' | 'transfer';

export interface MapLeg {
  id: string;
  kind: MapLegKind;
  from: LngLat;
  to: LngLat;
}

export interface TripMapModel {
  nodes: MapNode[];
  legs: MapLeg[];
  points: LngLat[]; // every plotted coordinate, for framing
  totalFlightKm: number;
  airportCount: number;
  hotelCount: number;
}

function hotelCoord(h: Hotel): LngLat | undefined {
  return typeof h.lat === 'number' && typeof h.lng === 'number'
    ? { lng: h.lng, lat: h.lat }
    : undefined;
}

/** Latest flight that lands at-or-before a hotel check-in (the inbound flight). */
function inboundFor(h: Hotel, flights: FlightLeg[]): FlightLeg | undefined {
  const ci = new Date(h.checkIn).getTime();
  return flights
    .filter((f) => new Date(f.arrTime).getTime() <= ci)
    .sort((a, b) => new Date(b.arrTime).getTime() - new Date(a.arrTime).getTime())[0];
}

/** Earliest flight that departs at-or-after a hotel check-out (the outbound flight). */
function outboundFor(h: Hotel, flights: FlightLeg[]): FlightLeg | undefined {
  const co = new Date(h.checkOut).getTime();
  return flights
    .filter((f) => new Date(f.depTime).getTime() >= co)
    .sort((a, b) => new Date(a.depTime).getTime() - new Date(b.depTime).getTime())[0];
}

export function buildTripMap(booking: Booking): TripMapModel {
  const nodes: MapNode[] = [];
  const legs: MapLeg[] = [];
  const points: LngLat[] = [];

  // ── Airport nodes (unique by IATA, ordered by first chronological use) ──
  const airportSeen = new Map<string, MapNode>();
  const flightsByTime = [...booking.flights].sort(
    (a, b) => new Date(a.depTime).getTime() - new Date(b.depTime).getTime(),
  );

  const addAirport = (code: string, name: string, city: string) => {
    const key = code.toUpperCase();
    if (airportSeen.has(key)) return airportSeen.get(key)!;
    const c = airportCoord(key);
    if (!c) return undefined; // unknown airport → no node (never guess)
    const node: MapNode = {
      id: `airport-${key}`,
      kind: 'airport',
      order: 0, // assigned after the full chronological walk
      lng: c.lng,
      lat: c.lat,
      title: name || key,
      code: key,
      subtitle: city || undefined,
    };
    airportSeen.set(key, node);
    return node;
  };

  // ── Flight legs (arc per leg) + ensure both airports exist ──
  let totalFlightKm = 0;
  for (const f of flightsByTime) {
    const dep = addAirport(f.depAirport, f.depAirportName, f.depCity);
    const arr = addAirport(f.arrAirport, f.arrAirportName, f.arrCity);
    if (dep && arr) {
      const from = { lng: dep.lng, lat: dep.lat };
      const to = { lng: arr.lng, lat: arr.lat };
      legs.push({ id: `flight-${f.id}`, kind: 'flight', from, to });
      totalFlightKm += haversineKm(from, to);
    }
  }

  // ── Hotel nodes + ground-transfer legs to/from their airports ──
  const hotelNodes: MapNode[] = [];
  booking.hotels.forEach((h) => {
    const c = hotelCoord(h);
    if (!c) return; // hotel without coordinates → not plotted
    const node: MapNode = {
      id: `hotel-${h.id}`,
      kind: 'hotel',
      order: 0,
      lng: c.lng,
      lat: c.lat,
      title: h.name,
      subtitle: [h.resort, h.city].filter(Boolean).join(' · ') || h.country,
      href: `/hotel/${h.id}`,
    };
    hotelNodes.push(node);

    const inbound = inboundFor(h, flightsByTime);
    if (inbound) {
      const ac = airportCoord(inbound.arrAirport);
      if (ac) legs.push({ id: `transfer-in-${h.id}`, kind: 'transfer', from: ac, to: c });
    }
    const outbound = outboundFor(h, flightsByTime);
    if (outbound) {
      const ac = airportCoord(outbound.depAirport);
      if (ac) legs.push({ id: `transfer-out-${h.id}`, kind: 'transfer', from: c, to: ac });
    }
  });

  // ── Order numbers: walk the timeline, numbering first appearances ──
  // Build a chronological list of (time, node) for every plotted thing.
  type Stamped = { t: number; node: MapNode };
  const stamped: Stamped[] = [];
  for (const f of flightsByTime) {
    const dep = airportSeen.get(f.depAirport.toUpperCase());
    const arr = airportSeen.get(f.arrAirport.toUpperCase());
    if (dep) stamped.push({ t: new Date(f.depTime).getTime(), node: dep });
    if (arr) stamped.push({ t: new Date(f.arrTime).getTime(), node: arr });
  }
  for (const h of booking.hotels) {
    const node = hotelNodes.find((n) => n.id === `hotel-${h.id}`);
    if (node) stamped.push({ t: new Date(h.checkIn).getTime(), node });
  }
  stamped.sort((a, b) => a.t - b.t);

  let order = 0;
  const numbered = new Set<string>();
  for (const s of stamped) {
    if (numbered.has(s.node.id)) continue;
    numbered.add(s.node.id);
    s.node.order = ++order;
  }

  // Assemble final node list (airports first registered, then hotels), then
  // sort by the chronological order number for a stable, readable sequence.
  nodes.push(...Array.from(airportSeen.values()), ...hotelNodes);
  nodes.sort((a, b) => a.order - b.order);

  for (const n of nodes) points.push({ lng: n.lng, lat: n.lat });

  return {
    nodes,
    legs,
    points,
    totalFlightKm,
    airportCount: airportSeen.size,
    hotelCount: hotelNodes.length,
  };
}
