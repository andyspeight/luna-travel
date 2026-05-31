/**
 * Luna Travel — Flight Hub live status types
 *
 * APPEND these to src/types/booking.ts (do not replace the file).
 *
 * Design: the booking's `FlightLeg` stays the source of truth for what was
 * SOLD (scheduled times, booked terminal, cabin, seats). This overlay holds
 * what is happening NOW, fetched live from AeroDataBox and joined to the leg
 * by `flightLegId`. The UI merges them at render so booked vs live data is
 * never confused — consistent with the "no invented fallbacks" rule.
 */

// Mapped from AeroDataBox FlightStatus (their 13-value enum) onto ours.
// CancelledUncertain is kept distinct so the UI can soften the message.
export type FlightStatusCode =
  | 'Scheduled'
  | 'CheckIn'
  | 'Boarding'
  | 'GateClosed'
  | 'Departed'
  | 'Delayed'
  | 'Approaching'
  | 'Landed'
  | 'Cancelled'
  | 'Diverted'
  | 'CancelledUncertain'
  | 'Unknown';

export type FlightWatchState = 'pending' | 'active' | 'expired';

export interface FlightLiveStatus {
  /** Join key — matches FlightLeg.id on the booking. */
  flightLegId: string;

  statusCode: FlightStatusCode;

  /** Live times — only set when known. ISO strings (UTC). */
  estDepTime?: string;
  actualDepTime?: string;
  estArrTime?: string;
  actualArrTime?: string;

  /** Live operational fields — may be null until assigned by the airport. */
  depTerminalLive?: string;
  depGate?: string;
  arrTerminalLive?: string;
  baggageBelt?: string;
  checkInDesk?: string;
  checkInOpensAt?: string;
  boardingAt?: string;

  /** Derived "leave for the airport by" nudge (Phase 2). ISO. */
  leaveByAt?: string;

  /** True only where the route's airports have live/ADS-B coverage. */
  hasLiveCoverage: boolean;

  /** Drives the offline "last updated HH:MM" stamp. ISO. */
  lastUpdated: string;

  watchState: FlightWatchState;
}

/**
 * Convenience shape for the Flights screen: the booked leg with its live
 * overlay attached (overlay is undefined until the first fetch lands).
 */
export interface FlightLegWithLive {
  leg: FlightLeg;
  live?: FlightLiveStatus;
}
