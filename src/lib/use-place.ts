'use client';

/**
 * Client hook for the destination content of the signed-in traveller's place.
 * Mirrors use-trip-content.ts: a module cache with a short TTL plus a single
 * in-flight promise, so the home screen, /destination, /experience/[id] and
 * /inspiration share ONE network request per session.
 *
 * The route takes no dates and no ticket titles, so the cache key is the place
 * itself — every traveller in Orlando hits the same entry here and the same
 * object at the CDN. Any failure resolves to the empty constant; this hook
 * never throws and never blocks first paint.
 *
 * It also sends the booking's own coordinates (a ticket's or a hotel's, never
 * the device's), rounded, because supplier feeds send postal cities such as
 * 'Lake Buena Vista' and 'Kissimmee' that match no place name and would
 * otherwise resolve no further than 'USA'.
 */

import { useEffect, useState } from 'react';
import {
  EMPTY_PARK_RESPONSE,
  EMPTY_PLACE_RESPONSE,
  type ParkResponse,
  type PlaceResponse,
  type ParkRecord,
  type PlaceView,
} from '@/types/destination-content';
import type { Booking } from '@/types/booking';

const TTL_MS = 60_000;
const MAX_SIGNALS = 3;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Hard ceiling on every request this hook makes.
 *
 * A hard offline failure rejects immediately, but a stalled socket — lie-fi, a
 * captive portal, an airport Wi-Fi that completes the handshake and then says
 * nothing — never settles at all, and this hook's `loading` flag is load-bearing:
 * the home screen gates its "Get to know <destination>" card on it and
 * /destination sits on GuideSkeleton until it clears. Without a timeout one hung
 * connection hides those surfaces for the whole session. The catch in each loader
 * turns the abort into the empty constant, which every consumer self-hides on.
 *
 * Guarded rather than called directly because AbortSignal.timeout is missing on
 * Safari < 16 and this is a PWA: there we fetch without a signal, which is the
 * behaviour we had before, instead of throwing the request away in the catch.
 */
function timeoutSignal(): AbortSignal | undefined {
  try {
    if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.timeout === 'function') {
      return AbortSignal.timeout(FETCH_TIMEOUT_MS);
    }
  } catch {
    /* fall through — no signal is better than no request */
  }
  return undefined;
}

const placeCache = new Map<string, { value: PlaceResponse; at: number }>();
const placeInflight = new Map<string, Promise<PlaceResponse>>();
const parkCache = new Map<string, { value: ParkResponse; at: number }>();
const parkInflight = new Map<string, Promise<ParkResponse>>();

function clean(s: string | undefined | null): string {
  const t = (s || '').trim().toLowerCase();
  return t.length >= 3 ? t.slice(0, 60) : '';
}

/**
 * Coordinates are rounded to 2dp (~1.1 km) before they enter the query string.
 *
 * The URL IS the cache key, here and at the CDN. Raw supplier precision would
 * give every ticket its own entry while changing nothing about the answer — the
 * resolver matches place rows within tens of kilometres — so rounding is what
 * keeps travellers in the same place sharing one response.
 */
function round2(v: number): number {
  return Math.round(v * 100) / 100;
}

/** Null Island (0, 0) is what a supplier feed sends when it has no coordinates
 *  at all; resolving from it would put the trip in the Gulf of Guinea. */
function usableCoords(lat: unknown, lng: unknown): { lat: number; lng: number } | null {
  if (typeof lat !== 'number' || typeof lng !== 'number') return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat === 0 && lng === 0) return null;
  return { lat: round2(lat), lng: round2(lng) };
}

/**
 * Where this trip actually happens, for the resolver's coordinate fallback.
 *
 * Experiences first, then hotels — the same preference order as placeSignals(),
 * and the reason this exists at all: an attraction ticket's `location` is a
 * postal city ('Lake Buena Vista', 'Kissimmee') that matches no place name, but
 * order-to-booking already maps its lat/lng straight off the supplier payload.
 * Returns null when nothing usable is present, and the request is then exactly
 * what it was before.
 */
export function placeCoords(booking: Booking): { lat: number; lng: number } | null {
  if (!booking) return null;
  for (const e of booking.experiences ?? []) {
    const c = usableCoords(e?.lat, e?.lng);
    if (c) return c;
  }
  for (const h of booking.hotels ?? []) {
    const c = usableCoords(h?.lat, h?.lng);
    if (c) return c;
  }
  return null;
}

/** Up to 3 place signals from a booking, normalised lowercase and sorted so
 *  every traveller in the same place produces the same cache key. */
export function placeSignals(booking: Booking): string[] {
  if (!booking) return [];
  const raw: Array<string | undefined> = [];

  for (const e of booking.experiences ?? []) raw.push(e?.location);
  for (const h of booking.hotels ?? []) raw.push(h?.resort);
  for (const h of booking.hotels ?? []) raw.push(h?.region);
  for (const h of booking.hotels ?? []) raw.push(h?.city);
  for (const part of (booking.destinationLabel || '').split(/[&,/]/)) raw.push(part);

  const seen = new Set<string>();
  const picked: string[] = [];
  for (const r of raw) {
    const c = clean(r);
    if (!c || seen.has(c)) continue;
    seen.add(c);
    picked.push(c);
    if (picked.length >= MAX_SIGNALS) break;
  }
  // Sorted last: preference decides WHICH three survive, order must not decide
  // whether two identical trips share a cache entry.
  return picked.sort();
}

/** Coordinates sit in a FIXED third slot so the key can be parsed back into
 *  request params; signals stay last because there can be up to three of them. */
function placeKey(
  cc: string,
  slug: string,
  coords: { lat: number; lng: number } | null,
  signals: string[],
): string {
  const xy = coords ? `${coords.lat},${coords.lng}` : '';
  return `${cc}|${slug}|${xy}|${signals.join('|')}`;
}

function parseKeyCoords(xy: string): { lat: number; lng: number } | null {
  const [a, b] = (xy || '').split(',');
  const lat = Number(a);
  const lng = Number(b);
  return Number.isFinite(lat) && Number.isFinite(lng) ? { lat, lng } : null;
}

async function loadPlace(
  cc: string,
  slug: string,
  coords: { lat: number; lng: number } | null,
  signals: string[],
): Promise<PlaceResponse> {
  try {
    const usp = new URLSearchParams();
    usp.set('cc', cc);
    if (slug) usp.set('slug', slug);
    if (coords) {
      usp.set('lat', String(coords.lat));
      usp.set('lng', String(coords.lng));
    }
    for (const s of signals) usp.append('q', s);
    const res = await fetch(`/api/traveller/place?${usp.toString()}`, {
      signal: timeoutSignal(),
    });
    if (!res.ok) return EMPTY_PLACE_RESPONSE;
    const json = (await res.json()) as PlaceResponse;
    if (!json || typeof json !== 'object') return EMPTY_PLACE_RESPONSE;
    return { configured: !!json.configured, reason: json.reason, place: json.place ?? null };
  } catch {
    return EMPTY_PLACE_RESPONSE;
  }
}

async function loadPark(cc: string, slug: string): Promise<ParkResponse> {
  try {
    const usp = new URLSearchParams({ cc, slug });
    const res = await fetch(`/api/traveller/park?${usp.toString()}`, {
      signal: timeoutSignal(),
    });
    if (!res.ok) return EMPTY_PARK_RESPONSE;
    const json = (await res.json()) as ParkResponse;
    if (!json || typeof json !== 'object') return EMPTY_PARK_RESPONSE;
    return { configured: !!json.configured, reason: json.reason, park: json.park ?? null };
  } catch {
    return EMPTY_PARK_RESPONSE;
  }
}

function fresh<T>(cache: Map<string, { value: T; at: number }>, key: string): T | null {
  const hit = cache.get(key);
  return hit && Date.now() - hit.at < TTL_MS ? hit.value : null;
}

/** Shared by the home screen, /destination, /experience/[id] and /inspiration —
 *  exactly one network request per session. Returns { place: null } for the
 *  demo/un-onboarded booking (no primaryCountryCode) WITHOUT fetching. */
export function usePlace(booking: Booking | null | undefined): {
  place: PlaceView | null;
  loading: boolean;
} {
  const cc = (booking?.primaryCountryCode || '').toUpperCase();
  const slug = booking?.locationSlug || '';
  const signals = booking ? placeSignals(booking) : [];
  const coords = booking ? placeCoords(booking) : null;
  // Empty key = the demo booking, which has no country and therefore no place.
  const key = /^[A-Z]{2}$/.test(cc) ? placeKey(cc, slug, coords, signals) : '';

  const [place, setPlace] = useState<PlaceView | null>(() =>
    key ? (fresh(placeCache, key)?.place ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !!key && !fresh(placeCache, key));

  useEffect(() => {
    if (!key) {
      setPlace(null);
      setLoading(false);
      return;
    }
    const cached = fresh(placeCache, key);
    if (cached) {
      setPlace(cached.place);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    let pending = placeInflight.get(key);
    if (!pending) {
      const [c, s, xy, ...q] = key.split('|');
      pending = loadPlace(c, s, parseKeyCoords(xy), q.filter(Boolean)).finally(() => {
        placeInflight.delete(key);
      });
      placeInflight.set(key, pending);
    }
    void pending.then((res) => {
      placeCache.set(key, { value: res, at: Date.now() });
      if (!alive) return;
      setPlace(res.place ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { place, loading };
}

export function usePark(code: string | undefined, slug: string | undefined): {
  park: ParkRecord | null;
  loading: boolean;
} {
  const cc = (code || '').toUpperCase();
  const s = (slug || '').trim();
  const key = /^[A-Z]{2}$/.test(cc) && s ? `${cc}|${s}` : '';

  const [park, setPark] = useState<ParkRecord | null>(() =>
    key ? (fresh(parkCache, key)?.park ?? null) : null,
  );
  const [loading, setLoading] = useState(() => !!key && !fresh(parkCache, key));

  useEffect(() => {
    if (!key) {
      setPark(null);
      setLoading(false);
      return;
    }
    const cached = fresh(parkCache, key);
    if (cached) {
      setPark(cached.park);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    let pending = parkInflight.get(key);
    if (!pending) {
      const [c, p] = key.split('|');
      pending = loadPark(c, p).finally(() => {
        parkInflight.delete(key);
      });
      parkInflight.set(key, pending);
    }
    void pending.then((res) => {
      parkCache.set(key, { value: res, at: Date.now() });
      if (!alive) return;
      setPark(res.park ?? null);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [key]);

  return { park, loading };
}
