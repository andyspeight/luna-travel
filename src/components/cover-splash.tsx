'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useCover } from '@/lib/cover-context';
import { BookingPicker } from '@/components/booking-picker';
import {
  IconCalendar,
  IconDoc,
  IconChat,
  IconShare,
  IconUser,
  IconPin,
} from '@/components/icons';
import { countdownTo, type CountdownParts } from '@/lib/format';
import { cinematicCover } from '@/lib/hero';
import { leadTraveller } from '@/lib/booking-helpers';

/**
 * Vamoos-style full-bleed welcome splash.
 *
 * Layout:
 *   - status-bar safe area at top
 *   - hamburger left, agency logo centre (long-press = picker), share right
 *   - empty space (the photograph speaks)
 *   - trip headline + lead name
 *   - giant ticking countdown
 *   - 4-action dock at bottom (safe-area aware)
 *
 * Tapping a dock action calls onEnter() which dismisses the cover for this
 * session, then the user lands on the requested page.
 */
export function CoverSplash() {
  const { booking } = useBooking();
  const { dismiss } = useCover();
  const cover = cinematicCover(booking.primaryCountryCode);
  const lead = leadTraveller(booking);
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(booking.tripStart));

  useEffect(() => {
    setParts(countdownTo(booking.tripStart));
    const id = setInterval(() => setParts(countdownTo(booking.tripStart)), 1000);
    return () => clearInterval(id);
  }, [booking.tripStart]);

  const headline = tripHeadline(booking);

  return (
    <div
      className="fixed inset-0 z-30 flex flex-col text-white overflow-hidden animate-fade-in"
      style={{
        background: cover.background,
        paddingTop: 'var(--safe-top)',
        paddingBottom: 'var(--safe-bottom)',
      }}
    >
      {/* Top vignette for legibility of the header */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-32 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.35) 0%, transparent 100%)',
        }}
      />
      {/* Middle/bottom vignette for the headline & countdown */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[60%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.15) 35%, rgba(0,0,0,0.45) 75%, rgba(0,0,0,0.6) 100%)',
        }}
      />

      {/* ── Top bar ── */}
      <header className="relative z-10 flex items-center justify-between px-4 pt-3">
        <Link
          href="/me"
          onClick={dismiss}
          aria-label="Menu"
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <span aria-hidden className="block w-4 space-y-[3px]">
            <span className="block h-px bg-white" />
            <span className="block h-px bg-white" />
            <span className="block h-px bg-white" />
          </span>
        </Link>

        <BookingPicker>
          <div className="px-3 py-2 rounded-xl bg-white/15 backdrop-blur border border-white/15">
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/80 text-center">
              {booking.agency.name}
            </div>
          </div>
        </BookingPicker>

        <button
          type="button"
          aria-label="Share"
          className="w-10 h-10 rounded-full bg-white/15 backdrop-blur flex items-center justify-center hover:bg-white/25 transition-colors"
        >
          <IconShare size={16} />
        </button>
      </header>

      {/* ── Body: headline + countdown ── */}
      <div className="relative z-10 flex-1 flex flex-col justify-end items-center px-6 pb-44 text-center">
        <div className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white/80">
          <IconPin size={12} />
          {booking.destinationLabel}
        </div>

        <h1 className="font-serif text-[34px] leading-[1.05] tracking-tight max-w-[300px]">
          {headline}
        </h1>
        <p className="mt-1.5 text-base text-white/85">{lead.firstName}</p>

        {/* Countdown clock */}
        <div className="mt-9">
          <div className="font-light text-[44px] leading-none tracking-tight tabular flex items-baseline justify-center gap-1">
            <span className="min-w-[58px] text-center">{String(parts.days).padStart(2, '0')}</span>
            <span className="text-white/55 px-0.5">:</span>
            <span className="min-w-[58px] text-center">{String(parts.hours).padStart(2, '0')}</span>
            <span className="text-white/55 px-0.5">:</span>
            <span className="min-w-[58px] text-center">{String(parts.minutes).padStart(2, '0')}</span>
            <span className="text-white/55 px-0.5">:</span>
            <span className="min-w-[58px] text-center">{String(parts.seconds).padStart(2, '0')}</span>
          </div>
          <div className="mt-2.5 grid grid-cols-4 gap-1 max-w-[280px] mx-auto text-[10px] uppercase tracking-[0.18em] text-white/65">
            <span className="text-center">Days</span>
            <span className="text-center">Hours</span>
            <span className="text-center">Mins</span>
            <span className="text-center">Secs</span>
          </div>
        </div>
      </div>

      {/* ── Dock ── */}
      <nav
        className="relative z-10 mx-3 mb-3 rounded-3xl px-2 py-2 grid grid-cols-4 gap-1"
        style={{
          background: 'rgba(255,255,255,0.14)',
          backdropFilter: 'blur(24px) saturate(180%)',
          WebkitBackdropFilter: 'blur(24px) saturate(180%)',
          border: '1px solid rgba(255,255,255,0.15)',
        }}
        aria-label="Quick actions"
      >
        <DockButton
          href="/"
          label="Summary"
          icon={<IconUser size={20} />}
          onTap={dismiss}
        />
        <DockButton
          href="/itinerary"
          label="Itinerary"
          icon={<IconCalendar size={20} />}
          onTap={dismiss}
        />
        <DockButton
          href="/documents"
          label="Documents"
          icon={<IconDoc size={20} />}
          onTap={dismiss}
        />
        <DockButton
          href="/luna"
          label="Ask Luna"
          icon={<IconChat size={20} />}
          onTap={dismiss}
        />
      </nav>

      {cover.credit && (
        <div className="relative z-10 pb-1 text-center text-[9px] text-white/45 tracking-wide">
          {cover.credit}
        </div>
      )}
    </div>
  );
}

function DockButton({
  href,
  label,
  icon,
  onTap,
}: {
  href: string;
  label: string;
  icon: React.ReactNode;
  onTap: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onTap}
      className="flex flex-col items-center justify-center py-2.5 rounded-2xl hover:bg-white/10 active:bg-white/15 transition-colors min-h-[58px]"
    >
      <span className="text-white/95">{icon}</span>
      <span className="text-[10px] mt-1 font-medium tracking-wide text-white/80">{label}</span>
    </Link>
  );
}

/** Pick a headline appropriate to the trip shape. */
function tripHeadline(booking: ReturnType<typeof useBooking>['booking']): string {
  const hasFlights = booking.flights.length > 0;
  const hasChildren = booking.travellers.some((t) => t.type === 'child' || t.type === 'infant');
  const isPremium = booking.flights.some((f) => f.cabin === 'Business' || f.cabin === 'First');
  const dest = booking.destinationLabel;

  if (isPremium) return `Luxury trip to ${dest}`;
  if (hasChildren) return `Family holiday in ${dest}`;
  if (!hasFlights) return `Escape to ${dest}`;
  return `Your trip to ${dest}`;
}
