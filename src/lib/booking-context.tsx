'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Booking } from '@/types/booking';
import { BOOKINGS, getDefaultBooking } from '@/data/mock-bookings';

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
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<Booking>(() => getDefaultBooking());
  const [source, setSource] = useState<BookingSource>('mock');
  const [liveLoading, setLiveLoading] = useState(true);
  const [hydrated, setHydrated] = useState(false);

  // 1. Restore mock selection from localStorage on mount (unchanged behaviour).
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const saved = window.localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const found = BOOKINGS.find((b) => b.reference === saved);
        if (found) setBooking(found);
      }
    } catch {
      /* ignore */
    }
    setHydrated(true);
  }, []);

  // 2. Additive: attempt a live booking for the current session. If one comes
  //    back, it takes over. Otherwise we silently remain on mock. Any failure
  //    is swallowed - the demo must never break because the backend hiccuped.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/traveller/booking', {
          credentials: 'include',
          cache: 'no-store',
        });
        if (cancelled) return;
        if (res.status === 200) {
          const data = await res.json();
          if (data?.booking && !cancelled) {
            setBooking(data.booking as Booking);
            setSource('live');
          }
        }
        // 204 / 502 / anything else -> stay on mock.
      } catch {
        /* network error -> stay on mock */
      } finally {
        if (!cancelled) setLiveLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // Picker - drives MOCK data only, exactly as before. When the user picks a
  // mock booking we also drop back to the mock source.
  const setBookingByRef = (ref: string) => {
    const found = BOOKINGS.find((b) => b.reference === ref);
    if (!found) return;
    setBooking(found);
    setSource('mock');
    try {
      window.localStorage.setItem(STORAGE_KEY, found.reference);
    } catch {
      /* ignore */
    }
  };

  const value: BookingContextValue = {
    booking,
    setBookingByRef,
    allBookings: BOOKINGS,
    source,
    liveLoading,
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
