'use client';

import { useBooking } from '@/lib/booking-context';

export default function ItineraryPage() {
  const { booking } = useBooking();
  return (
    <main className="px-5 pt-4">
      <header className="py-2">
        <h1 className="text-2xl font-bold tracking-tight text-ink">Itinerary</h1>
        <p className="text-sm text-ink-2 mt-1">
          {booking.destinationLabel} · {booking.durationLabel} · {booking.reference}
        </p>
      </header>
      <section className="mt-4 p-4 rounded-2xl bg-surface border border-line-light text-sm text-ink-2 leading-relaxed">
        Timeline of flights, lounges, hotels, and check-outs lands in sprint 2.
        For now, this page proves routing and the active booking context.
      </section>
    </main>
  );
}
