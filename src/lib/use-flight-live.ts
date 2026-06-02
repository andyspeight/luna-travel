'use client';

import { useEffect, useState } from 'react';
import type { FlightLiveStatus } from '@/types/booking';

/**
 * use-flight-live — fetches the live flight overlay for the signed-in
 * traveller's booking and exposes a lookup by flightLegId.
 *
 * Mirrors the booking-context fetch pattern: additive and fail-silent. With no
 * lt_session (the mock/demo path) the endpoint returns 401 and we simply have
 * no live data — the flight page then renders booked data exactly as before.
 * The demo must never break because of this.
 *
 * One fetch per mount, cached in state. The Flights screen reads the whole map;
 * an individual flight page reads one entry via getLive(legId).
 */

export interface FlightLiveMap {
  byLegId: Record<string, FlightLiveStatus>;
  loading: boolean;
  /** true once a fetch has completed (success or not) */
  ready: boolean;
}

export function useFlightLive(): FlightLiveMap & {
  getLive: (flightLegId: string) => FlightLiveStatus | undefined;
} {
  const [byLegId, setByLegId] = useState<Record<string, FlightLiveStatus>>({});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/traveller/flights', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 200) {
          const data = await res.json();
          const list = Array.isArray(data?.flights)
            ? (data.flights as FlightLiveStatus[])
            : [];
          const map: Record<string, FlightLiveStatus> = {};
          for (const f of list) {
            if (f && typeof f.flightLegId === 'string') map[f.flightLegId] = f;
          }
          if (!cancelled) setByLegId(map);
        }
        // 401 / 204 / anything else -> no live data, stay booked-only.
      } catch {
        /* network error -> booked-only, never disturb the page */
      } finally {
        if (!cancelled) {
          setLoading(false);
          setReady(true);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return {
    byLegId,
    loading,
    ready,
    getLive: (flightLegId: string) => byLegId[flightLegId],
  };
}
