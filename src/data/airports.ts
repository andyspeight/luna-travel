/**
 * Airport coordinate lookup.
 *
 * The Travelify booking shape carries airports as IATA codes only (see
 * FlightLeg in types/booking.ts) — no coordinates. The trip map needs a point
 * to plot, so we resolve the code to a real, verified lat/lng here.
 *
 * Rule 8 (Supplier Data Integrity): these are NOT invented supplier values —
 * they are fixed, verifiable airport reference coordinates (the same class of
 * static reference data as the destination guide). A code that is not in the
 * table returns `undefined`, and the map simply omits that node rather than
 * guessing a location. When the live flight feed begins supplying coordinates,
 * prefer those and treat this as the fallback.
 *
 * Coverage: the airports used by the four demo bookings. Extend as real
 * bookings introduce new airports (or swap for a fuller dataset / live feed).
 */

export interface AirportCoord {
  lat: number;
  lng: number;
}

const AIRPORTS: Record<string, AirportCoord> = {
  LGW: { lat: 51.1537, lng: -0.1821 }, // London Gatwick
  LHR: { lat: 51.47, lng: -0.4543 }, // London Heathrow
  BHX: { lat: 52.4539, lng: -1.748 }, // Birmingham
  AUH: { lat: 24.433, lng: 54.6511 }, // Abu Dhabi
  DXB: { lat: 25.2532, lng: 55.3657 }, // Dubai
  MLE: { lat: 4.1918, lng: 73.5291 }, // Malé (Velana)
  PMI: { lat: 39.5517, lng: 2.7388 }, // Palma de Mallorca
  ATH: { lat: 37.9364, lng: 23.9445 }, // Athens (in case a future flight needs it)
};

/**
 * Resolve an IATA code to coordinates, or undefined if unknown.
 * Returns undefined (never a fabricated point) for codes not in the table.
 */
export function airportCoord(iata?: string | null): AirportCoord | undefined {
  if (typeof iata !== 'string') return undefined;
  return AIRPORTS[iata.trim().toUpperCase()];
}
