'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useCover } from '@/lib/cover-context';
import { BookingPicker } from '@/components/booking-picker';
import { AgencyLogo } from '@/components/agency-logo';
import {
  IconCalendar,
  IconDoc,
  IconChat,
  IconShare,
  IconUser,
  IconPin,
  IconCheck,
} from '@/components/icons';
import { countdownTo, type CountdownParts } from '@/lib/format';
import { cinematicCover } from '@/lib/hero';
import { leadTraveller } from '@/lib/booking-helpers';
import { usePlace } from '@/lib/use-place';
import type { Booking } from '@/types/booking';

/**
 * The real instant this trip begins — what the countdown ticks down to and what
 * the "away / home" phase lines switch on.
 *
 * WHY: `booking.tripStart` is a CALENDAR DATE ('2026-11-27'), deliberately, so
 * that a trip window means the same thing in every timezone. But `new Date()`
 * reads a bare date as 00:00 UTC, so counting straight down to it reaches zero
 * hours before the aircraft moves and flips "I'm in Dubai right now" at UTC
 * midnight instead of at take-off. The departure instant was never lost — it
 * lives on the items — so read it from there: the earliest flight departure ON
 * the start day, else the earliest airport extra or dated experience that
 * carries a time, else the calendar date exactly as before.
 *
 * Only same-day candidates count. A booking that opens with an airport hotel
 * the night before an 06:00 flight must still count down to that hotel day; a
 * blind "first flight" would overshoot it by a day.
 *
 * A booking with no time information anywhere falls through to `tripStart`
 * untouched, so it keeps its current behaviour (including a NaN date staying
 * NaN, which is what the zeroed clock downstream already expects).
 *
 * WHY IT LIVES HERE: its natural home is a shared helper lib, but this pass
 * owns only this file and app/page.tsx, so it is exported from here and
 * imported there rather than duplicated. Worth relocating to
 * `@/lib/booking-helpers` next time that file is in scope.
 */
export function tripStartInstant(booking: Booking): string {
  const day = dayPart(booking.tripStart);
  if (!day) return booking.tripStart;

  // Flights first: take-off is the moment the traveller is counting to.
  const flight = earliest((booking.flights ?? []).map((f) => instantOn(day, f.depTime)));
  if (flight !== null) return new Date(flight).toISOString();

  // No flight — the lounge, the transfer or the ticket that opens the day.
  const other = earliest([
    ...(booking.airportExtras ?? []).map((x) => instantOn(day, x.date, x.time)),
    ...(booking.experiences ?? []).map((e) => instantOn(day, e.startDate, e.time)),
  ]);
  if (other !== null) return new Date(other).toISOString();

  return booking.tripStart;
}

/** 'YYYY-MM-DD' from an ISO date or date-time, '' when there isn't one. Same
 *  leading-10-characters reading order-to-booking normalises with, so the day
 *  always compares like with like. */
function dayPart(iso: string | undefined): string {
  const m = /^(\d{4}-\d{2}-\d{2})/.exec((iso ?? '').trim());
  return m ? m[1] : '';
}

/** Milliseconds for a component starting on `day`, or null when it falls on a
 *  different day or carries no time at all. A full ISO timestamp is trusted as
 *  given; a bare 'HH:MM' has no zone, so it is read as local time — the same
 *  reading the itinerary already prints it with. */
function instantOn(day: string, date?: string, time?: string): number | null {
  if (dayPart(date) !== day) return null;
  const raw = (date ?? '').trim();
  let ms = /T\d{2}:\d{2}/.test(raw) ? new Date(raw).getTime() : NaN;
  if (Number.isNaN(ms)) {
    const hm = /^(\d{1,2}):(\d{2})$/.exec((time ?? '').trim());
    if (!hm) return null; // date only — no instant to be had, so don't invent one
    ms = new Date(`${day}T${hm[1].padStart(2, '0')}:${hm[2]}:00`).getTime();
  }
  return Number.isNaN(ms) ? null : ms;
}

function earliest(values: Array<number | null>): number | null {
  let best: number | null = null;
  for (const v of values) if (v !== null && (best === null || v < best)) best = v;
  return best;
}

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
  // The splash, the home hero and /destination must all key the photo the same
  // way, or one trip shows two different covers. booking.locationSlug is only
  // re-derived on the live Travelify path; a redeemed invite persists
  // location_slug at redeem time and a stored off-platform payload bakes it in,
  // so for those rows it stays null — those travellers saw the generic country
  // photo on the FIRST screen and the right one a tap later. place.heroSlug is
  // resolved from the booking's signals at request time and fixes them.
  // usePlace shares a module-level cache and one in-flight promise with the
  // home screen that renders this component, so this costs no extra request;
  // until it resolves the country photo shows, which is the same layer the
  // location photo sits on top of anyway.
  const { place } = usePlace(booking);
  const cover = cinematicCover(
    booking.primaryCountryCode,
    place?.heroSlug || booking.locationSlug,
  );
  const lead = leadTraveller(booking);
  // Not booking.tripStart: that is a calendar date, and counting down to its
  // UTC midnight hits zero before the flight has left. See tripStartInstant.
  const startIso = tripStartInstant(booking);
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(startIso));
  const [shared, setShared] = useState(false);

  // Share the countdown moment — text only, no links, nothing private beyond
  // what the traveller chooses to send. Native share sheet where available,
  // clipboard fallback elsewhere (brief tick on the button as feedback).
  const shareTrip = async () => {
    const dest = booking.destinationLabel.trim();
    const now = Date.now();
    // The plane is only honest when there is a flight — an attractions booking
    // sharing "Flying to…" is the same class of bug as calling a flight-only
    // booking a holiday.
    const sign = booking.flights.length ? '✈️' : '✨';
    const text =
      now > new Date(booking.tripEnd).getTime()
        ? `Just home${dest ? ` from ${dest}` : ''} — what a trip! ${sign}`
        : now >= new Date(startIso).getTime()
          ? `${dest ? `I'm in ${dest}` : "I'm away"} right now ${sign}`
          : parts.days > 0
            ? `${parts.days} day${parts.days === 1 ? '' : 's'} until ${dest || 'my trip'}! ${sign}`
            : `${dest ? `Off to ${dest}` : 'My trip starts'} today ${sign}`;
    try {
      if (typeof navigator !== 'undefined' && navigator.share) {
        await navigator.share({ text });
      } else if (typeof navigator !== 'undefined' && navigator.clipboard) {
        await navigator.clipboard.writeText(text);
        setShared(true);
        setTimeout(() => setShared(false), 2000);
      }
    } catch {
      /* user cancelled the share sheet — nothing to do */
    }
  };

  useEffect(() => {
    setParts(countdownTo(startIso));
    const id = setInterval(() => setParts(countdownTo(startIso)), 1000);
    return () => clearInterval(id);
  }, [startIso]);

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
      {/* Top vignette for legibility of the header.
          The old 0.35 → transparent ramp over h-32 died before it reached the
          chrome: the vignette starts at the physical top of the screen, so on a
          notched phone the safe-area inset alone eats a third of it and the
          agency name lands where the alpha is nearly zero. Over pure white
          photography that left 10px text at roughly 1.4:1. The ramp now runs
          160px with a shaping stop, so the composited floor is ~0.26 alpha
          (0.74 white) behind the icon buttons and ~0.19 (0.81 white) behind the
          agency name — the header chips below take it the rest of the way. */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-0 h-40 pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.38) 55%, rgba(0,0,0,0.15) 82%, transparent 100%)',
        }}
      />
      {/* Middle/bottom scrim for the headline & countdown.
          Deliberately heavier than it looks like it needs to be. The old ramp
          reached only ~0.35 where the headline sits, which is fine over a dim
          sea and unreadable over bright sky, pale sand or a theme-park photo.
          White-on-photo has to hold at the worst case, not the average one. */}
      <div
        aria-hidden
        className="absolute inset-x-0 bottom-0 h-[72%] pointer-events-none"
        style={{
          background:
            'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.10) 22%, rgba(0,0,0,0.38) 48%, rgba(0,0,0,0.62) 72%, rgba(0,0,0,0.78) 100%)',
        }}
      />

      {/* ── Top bar ──
          The chips were bg-white/15: a white wash on a white photograph, which
          is why the three 1px hamburger rules and the 10px agency name both
          disappeared over bright sky. They are now black-tinted, so each chip
          darkens whatever is under it instead of lightening it, and the
          backdrop-blur is kept purely for the glass texture rather than being
          the only thing separating the chrome from the photo.
          Worst case, pure white photo: vignette leaves 0.74 white behind the
          icon buttons and 0.81 behind the agency name; black/45 composites
          those to 0.41 and 0.44, giving the white/95 name ~4.6:1 and the white
          rules and icons well past the 3:1 non-text floor. */}
      <header
        className="relative z-10 flex items-center justify-between px-4 pt-3"
        style={{ textShadow: '0 1px 6px rgba(0,0,0,0.6)' }}
      >
        <Link
          href="/me"
          onClick={dismiss}
          aria-label="Menu"
          className="w-10 h-10 rounded-full bg-black/45 border border-white/25 backdrop-blur flex items-center justify-center hover:bg-black/55 transition-colors"
        >
          <span aria-hidden className="block w-4 space-y-[3px]">
            <span className="block h-px bg-white" />
            <span className="block h-px bg-white" />
            <span className="block h-px bg-white" />
          </span>
        </Link>

        <BookingPicker>
          <div className="px-3 py-2 rounded-xl bg-black/45 backdrop-blur border border-white/25 flex flex-col items-center gap-1.5">
            {booking.agency.logoUrl && (
              <AgencyLogo agency={booking.agency} size={26} />
            )}
            <div className="text-[10px] uppercase tracking-[0.18em] text-white/95 text-center">
              {booking.agency.name}
            </div>
          </div>
        </BookingPicker>

        <button
          type="button"
          aria-label="Share your trip"
          onClick={shareTrip}
          className="w-10 h-10 rounded-full bg-black/45 border border-white/25 backdrop-blur flex items-center justify-center hover:bg-black/55 transition-colors"
        >
          {shared ? <IconCheck size={16} /> : <IconShare size={16} />}
        </button>
      </header>

      {/* ── Body: headline + countdown ── */}
      <div
        className="relative z-10 flex-1 flex flex-col justify-end items-center px-6 pb-44 text-center"
        style={{ textShadow: '0 1px 12px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)' }}
      >
        <div className="mb-6 inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.18em] text-white">
          <IconPin size={12} />
          {booking.destinationLabel}
        </div>

        <h1 className="font-serif text-[34px] leading-[1.05] tracking-tight max-w-[300px]">
          {headline}
        </h1>
        <p className="mt-1.5 text-base text-white/95">{lead.firstName}</p>

        {/* Countdown clock — only while the trip is still ahead. During or
            after the trip a ticking zero clock reads as broken, so show a
            phase-appropriate line instead. */}
        {Date.now() < new Date(startIso).getTime() ? (
          <div className="mt-9">
            <div className="font-light text-[44px] leading-none tracking-tight tabular flex items-baseline justify-center gap-1">
              <span className="min-w-[58px] text-center">{String(parts.days).padStart(2, '0')}</span>
              <span className="text-white/85 px-0.5">:</span>
              <span className="min-w-[58px] text-center">{String(parts.hours).padStart(2, '0')}</span>
              <span className="text-white/85 px-0.5">:</span>
              <span className="min-w-[58px] text-center">{String(parts.minutes).padStart(2, '0')}</span>
              <span className="text-white/85 px-0.5">:</span>
              <span className="min-w-[58px] text-center">{String(parts.seconds).padStart(2, '0')}</span>
            </div>
            {/* 10px at 0.18em tracking is the smallest type on the splash, and
                it sits where the scrim is only ~0.62 — white/80 measured barely
                over 4:1 against a white photo there. white/95 clears 5:1, and
                the separators follow at /85 so the clock still reads as one
                figure rather than four. */}
            <div className="mt-2.5 grid grid-cols-4 gap-1 max-w-[280px] mx-auto text-[10px] uppercase tracking-[0.18em] text-white/95">
              <span className="text-center">Days</span>
              <span className="text-center">Hours</span>
              <span className="text-center">Mins</span>
              <span className="text-center">Secs</span>
            </div>
          </div>
        ) : (
          <p className="mt-9 text-[15px] text-white/90">
            {Date.now() > new Date(booking.tripEnd).getTime()
              ? 'We hope it was unforgettable.'
              : 'Enjoy every moment.'}
          </p>
        )}
      </div>

      {/* ── Dock ──
          The glass is the only thing separating the dock from the photograph,
          and it is load-bearing: rgba(255,255,255,0.14) READ ALONE is a white
          wash, so wherever backdrop-filter is unsupported or switched off
          (Firefox with the pref disabled, reduced-transparency modes, older
          WebKit) the dock vanishes into a bright bottom edge. The @supports
          fallback swaps in slate at 0.62, which over the scrim's 0.78 floor
          composites to ~0.15 white — the labels clear 10:1 there, against
          ~6.4:1 with the blur working. It has to live in a rule rather than
          the inline style, because an inline background would win over it. */}
      <style>{`
        .cover-dock { background: rgba(255,255,255,0.14); }
        @supports not ((backdrop-filter: blur(1px)) or (-webkit-backdrop-filter: blur(1px))) {
          .cover-dock { background: rgba(15,23,42,0.62); }
        }
      `}</style>
      <nav
        className="cover-dock relative z-10 mx-3 mb-3 rounded-3xl px-2 py-2 grid grid-cols-4 gap-1"
        style={{
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

      {/* The credit sat at 9px/white-45, which is under 2:1 against the scrim's
          0.78 floor and simply unreadable over a bright bottom edge — an
          attribution nobody can read is not an attribution. 10px at white/75
          over that floor measures ~7.4:1, and it borrows the body block's
          shadow so it survives the stretch of photo the scrim does not cover. */}
      {cover.credit && (
        <div
          className="relative z-10 pb-1 text-center text-[10px] text-white/75 tracking-wide"
          style={{ textShadow: '0 1px 12px rgba(0,0,0,0.55), 0 1px 2px rgba(0,0,0,0.4)' }}
        >
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
      <span className="text-white">{icon}</span>
      <span className="text-[10px] mt-1 font-medium tracking-wide text-white/95">{label}</span>
    </Link>
  );
}

/**
 * Pick a headline appropriate to the trip shape.
 *
 * Every line has a form that works without a destination. Some bookings simply
 * have no place attached — an attraction ticket carries neither a hotel city
 * nor an arrival airport — and "Escape to " with nothing after it is far worse
 * than a shorter headline.
 */
function tripHeadline(booking: ReturnType<typeof useBooking>['booking']): string {
  const hasFlights = booking.flights.length > 0;
  const hasHotels = booking.hotels.length > 0;
  const hasChildren = booking.travellers.some((t) => t.type === 'child' || t.type === 'infant');
  const isPremium = booking.flights.some((f) => f.cabin === 'Business' || f.cabin === 'First');
  const dest = booking.destinationLabel.trim();

  // Date-aware first: a trip that's over or under way must not read like an
  // upcoming one ("almost here" for a past date was a reported bug).
  const now = Date.now();
  if (now > new Date(booking.tripEnd).getTime()) {
    return dest ? `Welcome home from ${dest}` : 'Welcome home';
  }
  // The real departure instant, not the calendar date's UTC midnight — the
  // headline must turn from "Your trip to Dubai" into "Enjoy Dubai" when the
  // flight leaves, in step with the countdown above it, not hours earlier.
  if (now >= new Date(tripStartInstant(booking)).getTime()) {
    return dest ? `Enjoy ${dest}` : 'Enjoy every moment';
  }

  if (isPremium) return dest ? `Luxury trip to ${dest}` : 'Your luxury trip';
  // "Holiday" only when there's actually a stay — a flight-only booking is a trip.
  if (hasChildren) {
    if (hasHotels) return dest ? `Family holiday in ${dest}` : 'Your family holiday';
    return dest ? `Family trip to ${dest}` : 'Your family trip';
  }
  if (!hasFlights) return dest ? `Escape to ${dest}` : 'Your trip';
  return dest ? `Your trip to ${dest}` : 'Your trip';
}
