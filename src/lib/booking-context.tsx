'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import type { Booking } from '@/types/booking';
import { BOOKINGS, getDefaultBooking } from '@/data/mock-bookings';

const STORAGE_KEY = 'luna-travel.activeBookingRef';

interface BookingContextValue {
  booking: Booking;
  setBookingByRef: (ref: string) => void;
  allBookings: Booking[];
}

const BookingContext = createContext<BookingContextValue | null>(null);

export function BookingProvider({ children }: { children: ReactNode }) {
  const [booking, setBooking] = useState<Booking>(() => getDefaultBooking());
  const [hydrated, setHydrated] = useState(false);

  // Restore from localStorage on mount
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

  const setBookingByRef = (ref: string) => {
    const found = BOOKINGS.find((b) => b.reference === ref);
    if (!found) return;
    setBooking(found);
    try {
      window.localStorage.setItem(STORAGE_KEY, found.reference);
    } catch {
      /* ignore */
    }
  };

  // Avoid hydration mismatch by gating on a stable initial state
  if (!hydrated) {
    return (
      <BookingContext.Provider value={{ booking, setBookingByRef, allBookings: BOOKINGS }}>
        {children}
      </BookingContext.Provider>
    );
  }

  return (
    <BookingContext.Provider value={{ booking, setBookingByRef, allBookings: BOOKINGS }}>
      {children}
    </BookingContext.Provider>
  );
}

export function useBooking(): BookingContextValue {
  const ctx = useContext(BookingContext);
  if (!ctx) throw new Error('useBooking must be used within BookingProvider');
  return ctx;
}
