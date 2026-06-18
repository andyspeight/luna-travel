'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { Storyboard } from '@/components/storyboard';
import {
  IconPlane,
  IconBed,
  IconLounge,
  IconCar,
  IconFastTrack,
  IconCompass,
  IconPin,
  IconChevR,
  IconList,
  IconImage,
  IconMap,
} from '@/components/icons';
import { buildTimeline, groupByDay, type TimelineEvent } from '@/lib/booking-helpers';
import { formatDate, formatTime, formatDuration } from '@/lib/format';

type View = 'timeline' | 'storyboard';

export default function ItineraryPage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const [view, setView] = useState<View>('timeline');
  const events = buildTimeline(booking);

  return (
    <>
      <NavBar title={t('tab.itinerary')} backLabel={t('tab.trip')} />
      <PageEnter>
      <main className="px-5 pt-2 pb-6">
        <header className="py-3">
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
            {booking.destinationLabel}
          </h1>
          <p className="text-sm text-ink-2 mt-1.5">
            {formatDate(booking.tripStart, { day: 'numeric', month: 'short' })} –{' '}
            {formatDate(booking.tripEnd, { day: 'numeric', month: 'short', year: 'numeric' })} ·{' '}
            {booking.durationLabel} · {booking.reference}
          </p>
        </header>

        {/* View controls: Timeline ⇄ Storyboard, plus Map */}
        <div className="flex items-center gap-2 mt-1 mb-2">
          <div
            role="tablist"
            aria-label="Itinerary view"
            className="inline-flex p-0.5 rounded-xl bg-surface-2 border border-line-light"
          >
            <ViewTab
              active={view === 'timeline'}
              onClick={() => setView('timeline')}
              icon={<IconList size={15} />}
              label={t('itin.timeline')}
            />
            <ViewTab
              active={view === 'storyboard'}
              onClick={() => setView('storyboard')}
              icon={<IconImage size={15} />}
              label={t('itin.storyboard')}
            />
          </div>
          <Link
            href="/map"
            className="ml-auto inline-flex items-center gap-1.5 h-9 px-3 rounded-xl bg-surface border border-line-light text-[13px] font-medium text-teal-dark dark:text-teal-light hover:shadow-sm transition-shadow tap"
          >
            <IconMap size={15} />
            <span>{t('itin.map')}</span>
          </Link>
        </div>

        {events.length === 0 ? (
          <div className="mt-6 p-6 rounded-2xl bg-surface border border-line-light text-center">
            <p className="text-sm text-ink-2">{t('itin.noEvents')}</p>
          </div>
        ) : view === 'timeline' ? (
          <TimelineView events={events} />
        ) : (
          <Storyboard booking={booking} />
        )}
      </main>
      </PageEnter>
    </>
  );
}

function ViewTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        'inline-flex items-center gap-1.5 px-3 h-8 rounded-lg text-[13px] font-medium transition-colors',
        active
          ? 'bg-surface text-ink shadow-sm'
          : 'text-ink-3 hover:text-ink-2',
      ].join(' ')}
    >
      {icon}
      <span>{label}</span>
    </button>
  );
}

function TimelineView({ events }: { events: TimelineEvent[] }) {
  const days = groupByDay(events);
  return (
    <section className="mt-3 relative">
      {/* Vertical line down the middle of the dots */}
      <div aria-hidden className="absolute left-[7px] top-3 bottom-3 w-px bg-line" />

      <div className="space-y-5">
        {days.map(({ day, events: dayEvents }) => (
          <div key={day}>
            <h2 className="ml-8 text-[11px] uppercase tracking-wider font-semibold text-ink-3 mb-2">
              {formatDate(day, { weekday: 'long', day: 'numeric', month: 'short' })}
            </h2>
            <ul className="space-y-2">
              {dayEvents.map((e) => (
                <li key={e.id} className="relative pl-8">
                  <span
                    aria-hidden
                    className={[
                      'absolute left-0 top-5 w-[15px] h-[15px] rounded-full border-2 z-10',
                      e.past ? 'bg-teal border-teal' : 'bg-surface border-teal',
                    ].join(' ')}
                    style={{
                      boxShadow: e.past ? 'none' : '0 0 0 4px rgba(0,180,216,0.12)',
                    }}
                  />
                  <TimelineCard event={e} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </section>
  );
}

function TimelineCard({ event }: { event: TimelineEvent }) {
  return (
    <Link
      href={event.href}
      className={[
        'block bg-surface border border-line-light rounded-2xl p-4 hover:shadow-sm transition-all tap',
        event.past ? 'opacity-70' : '',
      ].join(' ')}
    >
      <div className="flex items-start justify-between gap-3 mb-2">
        <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-teal-dark dark:text-teal-light">
          {kindIcon(event.kind)}
          {kindLabel(event.kind)}
        </span>
        <span className="text-xs text-ink-3 tabular flex-shrink-0">
          {formatTime(event.date)}
          {event.endDate && event.kind === 'flight' && (
            <>
              <span className="mx-1">→</span>
              {formatTime(event.endDate)}
            </>
          )}
        </span>
      </div>
      <div className="text-[15px] font-semibold text-ink leading-snug">{event.title}</div>
      {event.subtitle && (
        <div className="text-xs text-ink-2 mt-1">
          {event.subtitle}
          {event.endDate && event.kind === 'flight' && (
            <span> · {formatDuration(durationBetween(event.date, event.endDate))}</span>
          )}
        </div>
      )}
      <div className="mt-2 flex items-center justify-between">
        <span className="text-xs text-ink-3">{event.meta}</span>
        <IconChevR size={16} className="text-ink-3" />
      </div>
    </Link>
  );
}

function durationBetween(a: string, b: string): number {
  return Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 60000));
}

function kindIcon(k: TimelineEvent['kind']) {
  switch (k) {
    case 'flight':
      return <IconPlane size={14} />;
    case 'hotel-checkin':
    case 'hotel-checkout':
      return <IconBed size={14} />;
    case 'lounge':
      return <IconLounge size={14} />;
    case 'parking':
      return <IconCar size={14} />;
    case 'fast-track':
      return <IconFastTrack size={14} />;
    case 'car-hire':
    case 'transfer':
      return <IconCar size={14} />;
    case 'excursion':
    case 'activity':
      return <IconCompass size={14} />;
    default:
      return <IconPin size={14} />;
  }
}

function kindLabel(k: TimelineEvent['kind']): string {
  switch (k) {
    case 'flight':
      return 'Flight';
    case 'hotel-checkin':
      return 'Check in';
    case 'hotel-checkout':
      return 'Check out';
    case 'lounge':
      return 'Lounge';
    case 'parking':
      return 'Parking';
    case 'fast-track':
      return 'Fast track';
    case 'car-hire':
      return 'Car hire';
    case 'transfer':
      return 'Transfer';
    case 'excursion':
      return 'Excursion';
    case 'activity':
      return 'Activity';
    default:
      return 'Event';
  }
}
