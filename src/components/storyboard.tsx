'use client';

import Link from 'next/link';
import type { Booking } from '@/types/booking';
import {
  buildTimeline,
  groupByDay,
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
 * A presentation layer over the same canonical timeline the Itinerary list
 * uses (buildTimeline + groupByDay), so the two views can never drift out of
 * sync. Each day becomes a full-bleed scene card themed to that day's
 * destination, with the day's events listed over a legibility gradient.
 */
export function Storyboard({ booking }: { booking: Booking }) {
  const events = buildTimeline(booking);
  const days = groupByDay(events);

  if (days.length === 0) {
    return (
      <div className="mt-6 p-6 rounded-2xl bg-surface border border-line-light text-center">
        <p className="text-sm text-ink-2">No events on this trip yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {days.map(({ day, events: dayEvents }, i) => (
        <DayScene
          key={day}
          booking={booking}
          dayIso={day}
          dayNumber={i + 1}
          events={dayEvents}
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
  // Theme the scene to the day's destination: prefer a hotel's country that
  // day, else the trip's primary country.
  const hotelEvent = events.find(
    (e) => e.kind === 'hotel-checkin' || e.kind === 'hotel-checkout',
  );
  const hotelId = hotelEvent?.id.replace(/^hotel-(checkin|checkout)-/, '');
  const hotel = booking.hotels.find((h) => h.id === hotelId);
  const cc = hotel?.countryCode ?? booking.primaryCountryCode;
  const hero = destinationHero(cc);

  const headline = events[0]?.title ?? booking.destinationLabel;

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

        {/* Headline + events */}
        <div className="relative mt-auto pt-20">
          <h3 className="font-serif text-2xl leading-tight drop-shadow-sm">
            <em>{headline}</em>
          </h3>
          <ul className="mt-3 space-y-1.5">
            {events.map((e) => (
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
            ))}
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
