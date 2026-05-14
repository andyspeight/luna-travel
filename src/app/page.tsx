'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { BookingPicker } from '@/components/booking-picker';
import {
  countdownTo,
  countdownLabel,
  type CountdownParts,
} from '@/lib/format';

export default function HomePage() {
  const { booking } = useBooking();
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(booking.tripStart));

  // Tick the countdown every second
  useEffect(() => {
    setParts(countdownTo(booking.tripStart));
    const id = setInterval(() => setParts(countdownTo(booking.tripStart)), 1000);
    return () => clearInterval(id);
  }, [booking.tripStart]);

  const lead = booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];

  return (
    <main className="px-5 pt-2">
      {/* Header */}
      <header className="flex items-center justify-between py-3">
        <BookingPicker>
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center">
              L
            </div>
            <div className="text-left">
              <div className="text-sm font-semibold text-ink leading-none">Luna Travel</div>
              <div className="text-[11px] text-ink-3 leading-none mt-1">
                {booking.agency.name}
              </div>
            </div>
          </div>
        </BookingPicker>
      </header>

      {/* Greeting */}
      <div className="mt-2">
        <p className="text-xs uppercase tracking-wide text-ink-3 font-medium">
          {new Date().toLocaleDateString('en-GB', { weekday: 'long' })} morning
        </p>
        <h1 className="font-serif text-[34px] leading-tight text-ink">
          Hello <em className="not-italic font-serif italic text-teal-dark">{lead.firstName}</em>.
        </h1>
      </div>

      {/* Hero trip card */}
      <Link href="/itinerary" className="block mt-5">
        <article className="rounded-3xl overflow-hidden bg-surface shadow-md">
          <div
            className="relative h-48 p-4 text-white"
            style={{
              background:
                'linear-gradient(180deg, rgba(11,29,62,0.0) 30%, rgba(11,29,62,0.65) 100%), linear-gradient(135deg, #00B4D8 0%, #0077B6 35%, #023E8A 100%)',
            }}
          >
            <div className="flex justify-between items-start">
              <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-light shadow-[0_0_0_3px_rgba(72,202,228,0.3)]" />
                {booking.status === 'confirmed' ? 'Upcoming' : booking.status}
              </span>
              <span className="text-[11px] opacity-80 tabular tracking-wide">
                REF · {booking.reference}
              </span>
            </div>
            <div className="absolute bottom-5 left-5 right-5">
              <h2 className="font-serif text-3xl leading-none mb-1">
                <em>{booking.destinationLabel}</em>
              </h2>
              <p className="text-sm opacity-90">
                {booking.hotels[0]?.name ?? 'Custom itinerary'} · {booking.durationLabel} ·{' '}
                {booking.travellers.length} traveller{booking.travellers.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Countdown strip */}
          <div className="grid grid-cols-4 p-5 divide-x divide-line-light">
            {[
              { v: parts.days, l: 'Days' },
              { v: parts.hours, l: 'Hours' },
              { v: parts.minutes, l: 'Mins' },
              { v: parts.seconds, l: 'Secs' },
            ].map((c) => (
              <div key={c.l} className="text-center">
                <div className="text-2xl font-bold text-navy dark:text-teal-light tabular leading-none">
                  {String(c.v).padStart(2, '0')}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ink-3 mt-1">
                  {c.l}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center text-[11px] text-ink-2 pb-4 -mt-1">
            {countdownLabel(booking.tripStartEvent)}
          </div>
        </article>
      </Link>

      {/* Sprint 1 placeholder */}
      <div className="mt-6 p-4 rounded-2xl bg-surface border border-line-light text-center">
        <p className="text-xs text-ink-2 leading-relaxed">
          <strong className="text-ink">Sprint 1 of 6</strong> · Foundation laid.
          <br />
          Quick tiles, &ldquo;up next&rdquo;, and screen detail come in sprint 2.
          <br />
          <span className="text-ink-3">
            Long-press the logo to switch bookings or toggle theme.
          </span>
        </p>
      </div>
    </main>
  );
}
