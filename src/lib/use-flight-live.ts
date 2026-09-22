'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
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
 *
 * A refresh can also be asked for. Nothing polls: somebody watching a delay
 * wants to know now, and a screen that quietly refetched would still have to
 * explain how old the reading is, so the honest arrangement is a button they
 * press and a timestamp that says when they last pressed it.
 *
 * `failed` is the part worth keeping. A refresh that quietly does nothing
 * leaves the old time on screen looking freshly checked, which is exactly the
 * reassuring-with-no-age problem the timestamp exists to fix.
 */

export interface FlightLiveMap {
  byLegId: Record<string, FlightLiveStatus>;
  loading: boolean;
  /** true once a fetch has completed (success or not) */
  ready: boolean;
  /** A traveller-requested refresh is in flight. */
  refreshing: boolean;
  /** The last attempt did not bring anything back. */
  failed: boolean;
}

export function useFlightLive(): FlightLiveMap & {
  getLive: (flightLegId: string) => FlightLiveStatus | undefined;
  refresh: () => Promise<void>;
} {
  const [byLegId, setByLegId] = useState<Record<string, FlightLiveStatus>>({});
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [failed, setFailed] = useState(false);
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  /**
   * Returns whether anything came back, so a refresh can say it did not.
   *
   * A 401 is the demo and signed-out path and is NOT a failure: there is no
   * live data to have, and telling somebody the check failed would be wrong.
   */
  const load = useCallback(async (): Promise<boolean> => {
    try {
      const res = await fetch('/api/traveller/flights', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (!alive.current) return true;
      if (res.status === 401 || res.status === 204) return true;
      if (res.status !== 200) return false;

      const data = await res.json();
      const list = Array.isArray(data?.flights) ? (data.flights as FlightLiveStatus[]) : [];
      const map: Record<string, FlightLiveStatus> = {};
      for (const f of list) {
        if (f && typeof f.flightLegId === 'string') map[f.flightLegId] = f;
      }
      if (alive.current) setByLegId(map);
      return true;
    } catch {
      /* network error -> booked-only, never disturb the page */
      return false;
    }
  }, []);

  useEffect(() => {
    void (async () => {
      const ok = await load();
      if (!alive.current) return;
      setFailed(!ok);
      setLoading(false);
      setReady(true);
    })();
  }, [load]);

  const refresh = useCallback(async () => {
    if (!alive.current) return;
    setRefreshing(true);
    const ok = await load();
    if (!alive.current) return;
    setFailed(!ok);
    setRefreshing(false);
  }, [load]);

  return {
    byLegId,
    loading,
    ready,
    refreshing,
    failed,
    getLive: (flightLegId: string) => byLegId[flightLegId],
    refresh,
  };
}
