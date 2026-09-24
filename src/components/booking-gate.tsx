'use client';

import { usePathname } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { needsBooking } from '@/lib/booking-gate';
import { OnboardingHome } from '@/components/onboarding-home';

/**
 * Wraps every screen. A traveller screen is not drawn at all until the booking
 * is the traveller's own (or a demo somebody asked for), because until then
 * the provider holds the built-in sample booking and a screen would show its
 * names, flights and documents (lib/booking-gate.ts has the history).
 *
 * While the check is running: the same quiet mark the home screen has always
 * shown. If it finds no booking and no demo was asked for: the way in, on any
 * screen, as the home screen has always done, rather than the sample trip.
 */
export function BookingGate({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { ready, liveLoading } = useBooking();

  if (ready || !needsBooking(pathname)) return <>{children}</>;

  if (liveLoading) {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center" aria-busy="true">
        <span className="sr-only">Loading your trip</span>
        <div aria-hidden className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-teal animate-pulse" />
      </main>
    );
  }

  return <OnboardingHome />;
}
