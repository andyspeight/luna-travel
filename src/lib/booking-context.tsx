'use client';

import { createContext, useContext, useEffect, useState, useCallback, useRef, ReactNode } from 'react';
import type { Booking } from '@/types/booking';
import { BOOKINGS, getDefaultBooking } from '@/data/mock-bookings';
import { brandVars, BRAND_VAR_KEYS } from '@/lib/brand';
import { bookingReady } from '@/lib/booking-gate';
import { saveTrip, loadTrip, forgetTrip } from '@/lib/saved-trip';
import { forgetSavedDocuments } from '@/lib/offline-docs';
import { pushSubscriptionOnThisPhone } from '@/lib/use-push';

const STORAGE_KEY = 'luna-travel.activeBookingRef';

/** How long the network gets before the trip kept on the phone is shown. */
const SLOW_MS = 4000;
/** When to stop waiting altogether. The server gives Travelify 14 seconds. */
const GIVE_UP_MS = 20000;

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
   * `booking` may be shown: it is the traveller's own, or a demo somebody asked
   * for and no real booking has turned up to replace it. Until then `booking`
   * is the built-in sample and must reach nobody (lib/booking-gate.ts).
   */
  ready: boolean;
  /**
   * Re-check /api/traveller/booking for a live booking NOW. Needed after invite
   * redemption: the provider lives in the root layout, so a client-side
   * router.push from /install to / does NOT remount it — without this call the
   * home would render the provider's stale pre-redemption state (the demo trip
   * or onboarding) instead of the just-unlocked real booking.
   */
  refreshLive: (opts?: { newSession?: boolean }) => Promise<void>;
  /**
   * When the trip on screen is the copy kept on this phone because the network
   * could not answer, the time that copy was saved. Null for a fresh booking.
   */
  savedAt: number | null;
  /** End this phone's session and remove the trip from it. False if offline. */
  signOut: () => Promise<boolean>;
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

  // Set when THIS page view arrived on a /?demo= link, as opposed to restoring
  // a saved selection. A ref rather than state because refreshLive resolves
  // before a state update would be visible to it — and it is read, never
  // rendered, so it needs no re-render of its own.
  const deepLinkedDemo = useRef(false);

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
          deepLinkedDemo.current = true;
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
  //
  //    When the network cannot answer (no signal, a connection that never
  //    replies, an error on our side), the copy of the traveller's own trip
  //    kept on this phone steps in (lib/saved-trip.ts). When the server says
  //    there is no booking for this phone, that copy is forgotten and any trip
  //    on screen comes down.
  //
  //    Exposed as refreshLive so /install can re-run it right after a
  //    successful redemption (the provider persists across client-side
  //    navigation, so without this the home would show stale state).
  const [savedAt, setSavedAt] = useState<number | null>(null);
  // Mirrors source === 'live' for the callbacks below, which must not depend
  // on render state to decide whether there is a trip to take down.
  const showingLive = useRef(false);
  // Only the latest check may change what is on screen: a slow answer to an
  // earlier one must not overwrite a newer one, or bring back a signed-out trip.
  const checkId = useRef(0);

  const showLive = useCallback((b: Booking, fromSavedAt: number | null) => {
    // An explicit /?demo= link wins over the live booking for this view.
    //
    // The rule below exists so a real traveller never FALLS BACK to a demo —
    // not to overrule someone who asked for one by name. Without this guard,
    // anyone who has ever redeemed a booking finds every demo link silently
    // showing them their own trip instead, which is every agent who tries the
    // product before demonstrating it.
    //
    // Their own trip is one tap away at / , and a later visit without the
    // parameter restores it as before.
    if (deepLinkedDemo.current) return;
    showingLive.current = true;
    setBooking(b);
    setSource('live');
    setDemoSelected(false);
    setSavedAt(fromSavedAt);
    try { window.localStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
  }, []);

  const showSaved = useCallback(() => {
    const saved = loadTrip();
    if (saved) showLive(saved.booking, saved.savedAt);
  }, [showLive]);

  const dropLive = useCallback(() => {
    forgetTrip();
    setSavedAt(null);
    if (showingLive.current) {
      showingLive.current = false;
      setBooking(getDefaultBooking());
      setSource('mock');
    }
  }, []);

  const refreshLive = useCallback(async (opts?: { newSession?: boolean }) => {
    const id = ++checkId.current;
    const latest = () => id === checkId.current;
    // A new invite was just opened on this phone. Whatever trip it held before
    // (on screen, or saved) may be somebody else's: take it down before the
    // new one loads, so it cannot show in the meantime.
    if (opts?.newSession) dropLive();
    setLiveLoading(true);
    // A connection that accepts the request and then says nothing is the
    // normal condition at an airport. After the same four seconds the service
    // worker gives a page, the saved trip goes up; a real answer still
    // replaces it when it comes.
    const slow = setTimeout(() => {
      if (latest()) showSaved();
    }, SLOW_MS);
    try {
      const res = await fetch('/api/traveller/booking', {
        credentials: 'include',
        cache: 'no-store',
        signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(GIVE_UP_MS) : undefined,
      });
      if (!latest()) return;
      if (res.status === 200) {
        const data = await res.json();
        if (!latest()) return;
        if (data?.booking && typeof data.booking === 'object') {
          const b = data.booking as Booking;
          saveTrip(b, typeof data.sessionEndsAt === 'number' ? data.sessionEndsAt : null);
          showLive(b, null);
        } else {
          dropLive();
        }
      } else if (res.status === 401 || res.status === 404) {
        // No session, or nothing for it any more: signed out, expired, or the
        // agency removed this traveller. Nothing of theirs stays on screen or
        // on the phone.
        dropLive();
      } else {
        // Our side failed (502 from Travelify, 500). Their own trip is better
        // than nothing.
        showSaved();
      }
    } catch {
      // No signal, or no answer in time.
      if (latest()) showSaved();
    } finally {
      clearTimeout(slow);
      if (latest()) setLiveLoading(false);
    }
  }, [showLive, showSaved, dropLive]);

  useEffect(() => {
    void refreshLive();
  }, [refreshLive]);

  // Showing the saved copy: fetch the real one as soon as there is signal.
  useEffect(() => {
    if (savedAt === null) return;
    const back = () => void refreshLive();
    window.addEventListener('online', back);
    return () => window.removeEventListener('online', back);
  }, [savedAt, refreshLive]);

  /**
   * Sign this phone out: end the session, stop its notifications, and remove
   * the trip and its documents from the phone. False when the server could
   * not be reached, in which case nothing is removed: the session would still
   * be live, and the trip would simply come back.
   */
  const signOut = useCallback(async (): Promise<boolean> => {
    // One request ends the session and removes this phone's notifications, so
    // a sign-out with no signal changes nothing rather than half of it.
    const push = await pushSubscriptionOnThisPhone();
    try {
      const res = await fetch('/api/traveller/signout', {
        method: 'POST',
        credentials: 'include',
        cache: 'no-store',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(push ? { endpoint: push.endpoint } : {}),
      });
      if (!res.ok) return false;
    } catch {
      return false;
    }
    checkId.current++; // any check still in flight must not bring the trip back
    dropLive();
    setLiveLoading(false);
    await push?.unsubscribe().catch(() => false);
    await forgetSavedDocuments();
    return true;
  }, [dropLive]);

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

  const ready = bookingReady({ source, liveLoading, demoSelected });

  // Apply the active agency's white-label brand colours to the document as CSS
  // variables (the `teal`/`navy` Tailwind tokens read these). When the agency
  // has no colours, we clear the overrides so the Luna Travel defaults in
  // globals.css apply — this also handles switching from a branded booking back
  // to an unbranded one. Not before the booking is ready: until then it is the
  // sample, and its agency's navy and gold are nobody's brand.
  useEffect(() => {
    if (typeof document === 'undefined') return;
    const root = document.documentElement;
    const vars: Record<string, string> = ready
      ? brandVars(booking.agency.brandPrimaryColour, booking.agency.brandAccentColour)
      : {};
    for (const key of BRAND_VAR_KEYS) {
      const v = vars[key];
      if (v) root.style.setProperty(key, v);
      else root.style.removeProperty(key);
    }
  }, [ready, booking.agency.brandPrimaryColour, booking.agency.brandAccentColour]);

  // Picker - drives MOCK data only, exactly as before. When the user picks a
  // mock booking we also drop back to the mock source.
  const setBookingByRef = (ref: string) => {
    const found = BOOKINGS.find((b) => b.reference === ref);
    if (!found) return;
    showingLive.current = false;
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
    ready,
    refreshLive,
    savedAt,
    signOut,
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
