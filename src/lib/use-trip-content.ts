'use client';

/**
 * Client hook for the agency-authored content pages of the signed-in
 * traveller's booking. One fetch shared by every consumer (home section +
 * the three /guide pages) via a short-TTL module cache, so navigating
 * between guide pages doesn't refetch, but fresh edits appear within a
 * minute. A 401 (demo browsing, no session) resolves to empty content —
 * consumers simply render nothing.
 */

import { useEffect, useState } from 'react';
import { EMPTY_TRIP_CONTENT, type TripContentPages } from '@/lib/trip-content';

const TTL_MS = 60_000;

let _cache: { pages: TripContentPages; at: number } | null = null;
let _inflight: Promise<TripContentPages> | null = null;

async function load(): Promise<TripContentPages> {
  try {
    const res = await fetch('/api/traveller/content', { cache: 'no-store' });
    if (!res.ok) return EMPTY_TRIP_CONTENT;
    const json = (await res.json()) as { pages?: TripContentPages };
    const p = json.pages;
    if (!p || typeof p !== 'object') return EMPTY_TRIP_CONTENT;
    return {
      'before-you-travel': Array.isArray(p['before-you-travel']) ? p['before-you-travel'] : [],
      itinerary: Array.isArray(p.itinerary) ? p.itinerary : [],
      'find-your-way': Array.isArray(p['find-your-way']) ? p['find-your-way'] : [],
    };
  } catch {
    return EMPTY_TRIP_CONTENT;
  }
}

export function useTripContent(): { pages: TripContentPages; loading: boolean } {
  const [pages, setPages] = useState<TripContentPages>(
    _cache && Date.now() - _cache.at < TTL_MS ? _cache.pages : EMPTY_TRIP_CONTENT,
  );
  const [loading, setLoading] = useState(!_cache || Date.now() - _cache.at >= TTL_MS);

  useEffect(() => {
    if (_cache && Date.now() - _cache.at < TTL_MS) {
      setPages(_cache.pages);
      setLoading(false);
      return;
    }
    let alive = true;
    if (!_inflight) {
      _inflight = load().finally(() => {
        _inflight = null;
      });
    }
    void _inflight.then((p) => {
      _cache = { pages: p, at: Date.now() };
      if (alive) {
        setPages(p);
        setLoading(false);
      }
    });
    return () => {
      alive = false;
    };
  }, []);

  return { pages, loading };
}
