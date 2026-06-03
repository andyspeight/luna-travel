'use client';

import Link from 'next/link';
import type { Booking, Hotel } from '@/types/booking';
import {
  buildTimeline,
  type TimelineEvent,
} from '@/lib/booking-helpers';
import { destinationHero } from '@/lib/hero';
import { useI18n } from '@/lib/locale-context';
import { formatDate, formatTime } from '@/lib/format';
import {
  IconPlane,
  IconBed,
  IconLounge,
  IconCar,
  IconFastTrack,
  IconPin,
  IconChevR,
} from '@/components/icons';

/**
 * Storyboard — the image-led, day-by-day visual itinerary.
 *
 * Renders EVERY day of the trip from start to end (not only days that happen
 * to carry an event), and themes each day to where the traveller actually is
 * that day — the hotel they're resident in, otherwise the destination. Built
 * over the same canonical timeline the Itinerary list uses, so the two views
 * can't drift apart.
 */
function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Inclusive list of YYYY-MM-DD keys from start to end (UTC). */
function eachDay(startIso: string, endIso: string): string[] {
  const s = new Date(startIso);
  const e = new Date(endIso);
  let cur = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const last = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const out: string[] = [];
  let guard = 0;
  while (cur <= last && guard < 400) {
    const d = new Date(cur);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`,
    );
    cur += 86_400_000;
    guard += 1;
  }
  return out;
}

/** The hotel the traveller is resident in on a given day (check-in..check-out inclusive). */
function hotelForDay(booking: Booking, day: string): Hotel | undefined {
  return booking.hotels.find((h) => dayKey(h.checkIn) <= day && day <= dayKey(h.checkOut));
}

export function Storyboard({ booking }: { booking: Booking }) {
  const events = buildTimeline(booking);

  // Group events by UTC day.
  const byDay = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const k = dayKey(e.date);
    const list = byDay.get(k) ?? [];
    list.push(e);
    byDay.set(k, list);
  }

  // Full day range: trip start → trip end, falling back to event days.
  const start = booking.tripStart || events[0]?.date || '';
  const end = booking.tripEnd || events[events.length - 1]?.date || '';
  const dayList =
    start && end ? eachDay(start, end) : Array.from(byDay.keys()).sort();

  if (dayList.length === 0) {
    return (
      <div className="mt-6 p-6 rounded-2xl bg-surface border border-line-light text-center">
        <p className="text-sm text-ink-2">No events on this trip yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {dayList.map((day, i) => (
        <DayScene
          key={day}
          booking={booking}
          dayIso={day}
          dayNumber={i + 1}
          events={byDay.get(day) ?? []}
        />
      ))}
    </div>
  );
}

function DayScene({
  booking,
  dayIso,
  dayNumber,
  events,
}: {
  booking: Booking;
  dayIso: string;
  dayNumber: number;
  events: TimelineEvent[];
}) {
  const { t } = useI18n();

  // Theme the scene to where the traveller is that day: the hotel they're
  // resident in, otherwise the trip's primary destination.
  const dayHotel = hotelForDay(booking, dayIso);
  const cc = dayHotel?.countryCode ?? booking.primaryCountryCode;
  const hero = destinationHero(cc);

  const hasEvents = events.length > 0;
  const headline = hasEvents
    ? events[0]?.title ?? booking.destinationLabel
    : dayHotel
      ? 'At leisure'
      : booking.destinationLabel;

  const locationLabel = dayHotel
    ? [dayHotel.resort, dayHotel.city, dayHotel.country].filter(Boolean).join(' · ')
    : booking.destinationLabel;

  return (
    <article className="rounded-3xl overflow-hidden shadow-sm border border-line-light">
      <div className="relative min-h-[220px] p-4 text-white" style={{ background: hero.gradient }}>
        {hero.image && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `center/cover no-repeat url("${hero.image}")` }}
          />
        )}
        <div aria-hidden className="absolute inset-0" style={{ background: hero.glow }} />
        {/* Bottom legibility gradient */}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.10) 0%, transparent 30%, rgba(15,23,42,0.72) 100%)',
          }}
        />

        {/* Day chip */}
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
            {t('itin.day')} {dayNumber}
          </span>
          <span className="text-[11px] opacity-90 tracking-wide">
            {formatDate(dayIso, { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Headline + location + events */}
        <div className="relative mt-auto pt-20">
          <h3 className="font-serif text-2xl leading-tight drop-shadow-sm">
            <em>{headline}</em>
          </h3>
          {locationLabel && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] opacity-90">
              <IconPin size={13} />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}

          <ul className="mt-3 space-y-1.5">
            {hasEvents ? (
              events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={e.href}
                    className="group flex items-center gap-2.5 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-sm px-3 py-2 transition-colors"
                  >
                    <span className="flex-shrink-0 opacity-90">{kindGlyph(e.kind)}</span>
                    <span className="text-xs tabular opacity-90 flex-shrink-0 w-11">
                      {formatTime(e.date)}
                    </span>
                    <span className="text-[13px] font-medium truncate flex-1">{e.title}</span>
                    <IconChevR size={15} className="opacity-70 flex-shrink-0" />
                  </Link>
                </li>
              ))
            ) : dayHotel ? (
              // Quiet day mid-stay: one calm row pointing at the hotel.
              <li>
                <Link
                  href={`/hotel/${dayHotel.id}`}
                  className="group flex items-center gap-2.5 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-sm px-3 py-2 transition-colors"
                >
                  <span className="flex-shrink-0 opacity-90">
                    <IconBed size={15} />
                  </span>
                  <span className="text-[13px] font-medium truncate flex-1">{dayHotel.name}</span>
                  <IconChevR size={15} className="opacity-70 flex-shrink-0" />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </article>
  );
}

function kindGlyph(k: TimelineEvent['kind']) {
  switch (k) {
    case 'flight':
      return <IconPlane size={15} />;
    case 'hotel-checkin':
    case 'hotel-checkout':
      return <IconBed size={15} />;
    case 'lounge':
      return <IconLounge size={15} />;
    case 'parking':
      return <IconCar size={15} />;
    case 'fast-track':
      return <IconFastTrack size={15} />;
    default:
      return <IconPin size={15} />;
  }
}
