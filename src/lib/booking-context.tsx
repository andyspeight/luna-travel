'use client';

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from 'react';
import type { Booking } from '@/types/booking';
import { BOOKINGS, getDefaultBooking } from '@/data/mock-bookings';
import { brandVars, BRAND_VAR_KEYS } from '@/lib/brand';

const STORAGE_KEY = 'luna-travel.activeBookingRef';

/**
 * Source of the active booking:
 *   - 'mock' : the demo picker / mock data (the TravelTech Show path)
 *   - 'live' : a real Travelify booking for the current lt_session
 *
 * The mock path is unchanged from the original implementation. The live path
 * is purely additive: on mount we ask /api/traveller/booking whether there's a
 * live booking for this session. If yes, we show it. If no (204) or it fails,
 * we stay on mock exactly as before. The picker only ever drives mock data.
 */
type BookingSource = 'mock' | 'live';

interface BookingContextValue {
  booking: Booking;
  setBookingByRef: (ref: string) => void;
  allBookings: Booking[];
  source: BookingSource;
  liveLoading: boolean;
  /**
   * True when there is no real (lt_session) booking AND no demo trip has been
   * explicitly chosen (via /?demo=, a saved picker selection, or the picker).
   * i.e. a genuine first-time / un-onboarded visitor — the app shows an
   * onboarding prompt instead of the (fallback) demo trip. `booking` still
   * holds the demo default so nothing crashes, but the UI must not present it.
   */
  onboarding: boolean;
  /** A demo trip was explicitly chosen (deep-link / saved selection / picker). */
  demoSelected: boolean;
  /**
   * Re-check /api/traveller/booking for a live booking NOW. Needed after invite
   * redemption: the provider lives in the root layout, so a client-side
   * router.push from /install to / does NOT remount it — without this call the
   * home would render the provider's stale pre-redemption state (the demo trip
   * or onboarding) instead of the just-unlocked real booking.
   */
  refreshLive: () => Promise<void>;
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<Booking>(() => getDefaultBooking());
  const [source, setSource] = useState<BookingSource>('mock');
  const [liveLoading, setLiveLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);
  // A demo trip was explicitly chosen (deep-link, saved selection, or picker).
  // Distinguishes "show the demo trip" from "first-run onboarding".
  const [demoSelected, setDemoSelected] = useState(false);

  // 1. Restore mock selection on mount. A /?demo=<ref> deep-link (used by the
  //    admin Demo launchpad QRs) selects a sample trip directly and takes
  //    precedence over the saved selection; otherwise behaviour is unchanged.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const demoRef = new URLSearchParams(window.location.search).get('demo');
      if (demoRef) {
        const dm = BOOKINGS.find((b) => b.reference.toUpperCase() === demoRef.toUpperCase());
        if (dm) {
          setBooking(dm);
          setDemoSelected(true);
          try { window.localStorage.setItem(STORAGE_KEY, dm.reference); } catch { /* ignore */ }
          setHydrated(true);
          return;
        }
      }
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const found = BOOKINGS.find((b) => b.reference === saved);
        if (found) { setBooking(found); setDemoSelected(true); }
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // 2. Attempt a live booking for the current session. If one comes back, it
  //    takes over AND permanently clears any saved demo selection on this
  //    device — a real traveller must never fall back to a demo trip again.
  //    Otherwise we silently remain on mock. Any failure is swallowed - the
  //    demo must never break because the backend hiccuped.
  //
  //    Exposed as refreshLive so /install can re-run it right after a
  //    successful redemption (the provider persists across client-side
  //    navigation, so without this the home would show stale state).
  const refreshLive = useCallback(async () => {
    setLiveLoading(true);
    try {
      const res = await fetch('/api/traveller/booking', {
        credentials: 'include',
        cache: 'no-store',
      });
      if (res.status === 200) {
        const data = await res.json();
        if (data?.booking) {
          setBooking(data.booking as Booking);
          setSource('live');
          setDemoSelected(false);
          try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
        }
      }
      // 204 / 502 / anything else -> stay on mock.
    } catch {
      /* network error -> stay on mock */
    } finally {
      setLiveLoading(false);
    }
  }, []);

  useEffect(() => {
    void refreshLive();
  }, [refreshLive]);

  // 3. Engagement ping - record that the traveller opened the app. Fire-and-
  //    forget, gated server-side by the lt_session cookie (no session => 401,
  //    a harmless no-op for the mock/demo path). Fires on open and on return to
  //    the foreground; a client throttle plus the server's session window stop
  //    refocus spam from inflating the open count.
  useEffect(() => {
    let lastPing = 0;
    const ping = () => {
      const now = Date.now();
      if (now - lastPing < 5 * 60 * 1000) return; // at most once / 5 min client-side
      lastPing = now;
      fetch('/api/traveller/ping', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        keepalive: true,
      }).catch(() => {
        /* engagement is best-effort; never disturb the app */
      });
    };
    ping();
    const onVisible = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') ping();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, []);

  // Apply the active agency's white-label brand colours to the document as CSS
  // variables (the `teal`/`navy` Tailwind tokens read these). When the agency
  // has no colours, we clear the overrides so the Luna Travel defaults in
  // globals.css apply — this also handles switching from a branded booking back
  // to an unbranded one.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars = brandVars(booking.agency.brandPrimaryColour, booking.agency.brandAccentColour);
    for (const key of BRAND_VAR_KEYS) {
      const v = vars[key];
      if (v) root.style.setProperty(key, v);
      else root.style.removeProperty(key);
    }
  }, [booking.agency.brandPrimaryColour, booking.agency.brandAccentColour]);

  // Picker - drives MOCK data only, exactly as before. When the user picks a
  // mock booking we also drop back to the mock source.
  const setBookingByRef = (ref: string) => {
    const found = BOOKINGS.find((b) => b.reference === ref);
    if (!found) return;
    setBooking(found);
    setSource('mock');
    setDemoSelected(true);
    try {
      window.localStorage.setItem(STORAGE_KEY, found.reference);
    } catch {
      /* ignore */
    }
  };

  // Genuine first-run: no live booking and no demo explicitly chosen. While the
  // live fetch is still in flight we are NOT onboarding yet (avoids flashing the
  // onboarding screen before a real booking resolves).
  const onboarding = !liveLoading && source === 'mock' && !demoSelected;

  const value: BookingContextValue = {
    booking,
    setBookingByRef,
    allBookings: BOOKINGS,
    source,
    liveLoading,
    onboarding,
    demoSelected,
    refreshLive,
  };

  // hydrated retained for parity with the original gating pattern.
  void hydrated;

  return <BookingContext.Provider value={value}>{children}</BookingContext.Provider>;
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
