'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { BookingPicker } from '@/components/booking-picker';
import { SectionHeading } from '@/components/section-heading';
import {
  IconPlane,
  IconBed,
  IconDoc,
  IconChat,
  IconLounge,
  IconCar,
  IconFastTrack,
  IconChevR,
  IconPin,
  IconClock,
  IconMap,
  IconCompass,
  IconBell,
} from '@/components/icons';
import {
  countdownTo,
  formatDayMonth,
  formatTime,
  type CountdownParts,
} from '@/lib/format';
import { buildTimeline, nextEvent, type TimelineEvent } from '@/lib/booking-helpers';
import { destinationHero } from '@/lib/hero';
import { InspirationCard } from '@/components/inspiration-card';
import { getInspirations } from '@/data/inspirations';
import { useI18n } from '@/lib/locale-context';
import { PageEnter } from '@/components/page-enter';
import { CoverSplash } from '@/components/cover-splash';
import { useCover } from '@/lib/cover-context';
import { useAgentMessages, type AgentLatest } from '@/lib/use-agent-messages';

export default function HomePage() {
  const { booking } = useBooking();
  const { coverEnabled, coverDismissed } = useCover();
  const { t } = useI18n();
  const { latest } = useAgentMessages();

  // Mark a surfaced agent message read in place, then tell the rest of the app
  // (bottom-bar badge, this banner) to refresh so it clears immediately.
  const markRead = async (id: string) => {
    try {
      await fetch('/api/traveller/messages/read', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      });
    } catch {
      /* ignore — a transient failure just leaves it unread */
    }
    try {
      window.dispatchEvent(new Event('lt:messages-changed'));
    } catch {
      /* no-op */
    }
  };
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(booking.tripStart));

  useEffect(() => {
    setParts(countdownTo(booking.tripStart));
    const id = setInterval(() => setParts(countdownTo(booking.tripStart)), 1000);
    return () => clearInterval(id);
  }, [booking.tripStart]);

  const lead = booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];
  const next = nextEvent(booking);
  const upcoming = buildTimeline(booking).filter((e) => !e.past).slice(0, 3);
  const hero = destinationHero(booking.primaryCountryCode);
  const hasFlights = booking.flights.length > 0;
  const tripOver = Date.now() > new Date(booking.tripEnd).getTime();
  const inspirations = getInspirations(booking.primaryCountryCode);

  // Cover mode: full-bleed splash takes over the home route until the user
  // taps a dock action (which calls dismiss()). The dashboard then becomes
  // accessible via the tab bar for the rest of the session.
  if (coverEnabled && !coverDismissed) {
    return <CoverSplash />;
  }

  return (
    <PageEnter>
    <main className="px-5 pt-2 pb-6">
      {/* Header with picker */}
      <header className="flex items-center justify-between py-3">
        <BookingPicker>
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center shadow-sm">
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
      <div className="mt-2 mb-5">
        <p className="text-xs uppercase tracking-wide text-ink-3 font-medium">
          {t(greetingKey())}
        </p>
        <h1 className="font-serif text-[34px] leading-tight text-ink">
          {t('home.hello')}{' '}
          <em className="not-italic font-serif italic text-teal-dark dark:text-teal-light">
            {lead.firstName}
          </em>
          .
        </h1>
      </div>

      {/* Urgent / unread agent message, surfaced at the top so it can't be missed */}
      {latest && (
        <AgentMessageBanner message={latest} agency={booking.agency.name} onRead={markRead} />
      )}

      {/* Post-trip: lead with rebooking. Once the trip is over, the countdown
          is spent — turn the top of the home screen into "where next?". */}
      {tripOver && (
        <Link href="/inspiration" className="block mb-4">
          <article className="relative rounded-3xl overflow-hidden shadow-md p-5 text-white min-h-[132px] flex flex-col justify-end">
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 60%, #00B4D8 100%)' }}
            />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 80% 10%, rgba(255,255,255,0.22), transparent 55%)',
              }}
            />
            <div className="relative flex items-center gap-3">
              <span className="w-11 h-11 rounded-2xl bg-white/20 backdrop-blur flex items-center justify-center flex-shrink-0">
                <IconCompass size={22} />
              </span>
              <div className="min-w-0">
                <div className="text-[11px] uppercase tracking-wider opacity-90">
                  {t('next.welcomeHome')}
                </div>
                <h2 className="font-serif text-2xl leading-tight">
                  <em>{t('next.whereNext')}</em>
                </h2>
                <p className="text-xs opacity-90 mt-0.5">
                  {t('next.lovedX', { dest: booking.destinationLabel, agency: booking.agency.name })}
                </p>
              </div>
              <IconChevR size={20} className="ml-auto flex-shrink-0 opacity-90" />
            </div>
          </article>
        </Link>
      )}

      {/* Hero trip card */}
      <Link href="/itinerary" className="block">
        <article className="rounded-3xl overflow-hidden bg-surface shadow-md hover:shadow-lg transition-shadow">
          <div
            className="relative h-48 p-4 text-white"
            style={{ background: hero.gradient }}
          >
            {hero.image && (
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: `center/cover no-repeat url("${hero.image}")` }}
              />
            )}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: hero.glow }}
            />
            <div className="relative flex justify-between items-start">
              <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-light shadow-[0_0_0_3px_rgba(72,202,228,0.3)]" />
                {booking.status === 'confirmed' ? t('home.upcoming') : booking.status}
              </span>
              <span className="text-[11px] opacity-80 tabular tracking-wide">
                REF · {booking.reference}
              </span>
            </div>
            <div className="absolute bottom-5 left-5 right-5">
              <h2 className="font-serif text-3xl leading-none mb-1">
                <em>{booking.destinationLabel}</em>
              </h2>
              <p className="text-sm opacity-90 truncate">
                {booking.hotels[0]?.name ?? 'Custom itinerary'} · {booking.durationLabel} ·{' '}
                {booking.travellers.length} traveller{booking.travellers.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Countdown strip */}
          <div className="grid grid-cols-4 p-5 pb-3 divide-x divide-line-light">
            {[
              { v: parts.days, l: t('cd.days') },
              { v: parts.hours, l: t('cd.hours') },
              { v: parts.minutes, l: t('cd.mins') },
              { v: parts.seconds, l: t('cd.secs') },
            ].map((c) => (
              <div key={c.l} className="text-center">
                <div className="text-2xl font-bold text-navy dark:text-teal-light tabular leading-none">
                  {String(c.v).padStart(2, '0')}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-ink-3 mt-1.5">
                  {c.l}
                </div>
              </div>
            ))}
          </div>
          <div className="text-center text-[11px] text-ink-2 pb-4">
            {t(countdownKey(booking.tripStartEvent))}
          </div>
        </article>
      </Link>

      {/* Quick tiles */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        <QuickTile
          href={hasFlights ? `/flight/${booking.flights[0].id}` : '/itinerary'}
          icon={<IconPlane size={18} />}
          label={hasFlights ? t('tile.flights') : t('tile.plan')}
        />
        <QuickTile
          href={`/hotel/${booking.hotels[0]?.id ?? ''}`}
          icon={<IconBed size={18} />}
          label={t('tile.hotel')}
          disabled={!booking.hotels.length}
        />
        <QuickTile href="/map" icon={<IconMap size={18} />} label={t('tile.map')} />
        <QuickTile href="/documents" icon={<IconDoc size={18} />} label={t('tile.docs')} />
        <QuickTile href="/luna" icon={<IconChat size={18} />} label={t('tile.luna')} />
      </div>

      {/* Up next */}
      {next && (
        <section className="mt-7">
          <SectionHeading title={t('home.upNext')} seeAllHref="/itinerary" />
          <UpNextCard event={next} />
        </section>
      )}

      {/* Upcoming list (after the next one) */}
      {upcoming.length > 1 && (
        <section className="mt-6">
          <SectionHeading title={t('home.comingUp')} seeAllHref="/itinerary" />
          <ul className="space-y-2">
            {upcoming.slice(1).map((e) => (
              <li key={e.id}>
                <CompactEventRow event={e} />
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Destination guide */}
      <section className="mt-6">
        <SectionHeading title={t('home.getToKnow')} />
        <Link
          href="/destination"
          className="block rounded-2xl overflow-hidden bg-surface border border-line-light hover:shadow-sm transition-shadow tap"
        >
          <div className="flex items-stretch">
            <div
              className="w-24 flex-shrink-0 relative"
              style={{ background: hero.gradient }}
            >
              {hero.image && (
                <div
                  aria-hidden
                  className="absolute inset-0"
                  style={{ background: `center/cover no-repeat url("${hero.image}")` }}
                />
              )}
              <div
                aria-hidden
                className="absolute inset-0"
                style={{ background: hero.glow }}
              />
            </div>
            <div className="flex-1 p-4 min-w-0">
              <div className="text-[11px] uppercase tracking-wider text-ink-3 font-semibold">
                {t('home.destGuide')}
              </div>
              <div className="text-[15px] font-semibold text-ink mt-0.5 leading-tight">
                {booking.destinationLabel}
              </div>
              <div className="text-xs text-ink-2 mt-1 line-clamp-2">
                {t('home.destBlurb')}
              </div>
            </div>
            <div className="flex items-center pr-4 text-ink-3">
              <IconChevR size={18} />
            </div>
          </div>
        </Link>
      </section>

      {/* Inspiration teaser — discoverable before the trip, prominent after.
          The dedicated /inspiration route carries the full collection. */}
      {inspirations.length > 0 && (
        <section className="mt-6">
          <SectionHeading
            title={tripOver ? t('next.whereNext') : t('home.teaserPre')}
            seeAllHref="/inspiration"
          />
          <div className="-mx-5 px-5 overflow-x-auto scrollbar-none">
            <div className="flex gap-3" style={{ width: 'max-content' }}>
              {inspirations.slice(0, 4).map((ins) => (
                <div key={ins.id} className="w-[200px] flex-shrink-0">
                  <InspirationCard inspiration={ins} agency={booking.agency} variant="compact" />
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Airport extras */}
      {booking.airportExtras.length > 0 && (
        <section className="mt-6">
          <SectionHeading title={t('home.airportExtras')} />
          <ul className="space-y-2">
            {booking.airportExtras.map((x) => (
              <li key={x.id}>
                <Link
                  href={`/extra/${x.id}`}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light hover:shadow-sm transition-shadow tap"
                >
                  <span
                    className="w-10 h-10 rounded-xl text-white flex items-center justify-center flex-shrink-0"
                    style={{
                      background:
                        x.type === 'lounge'
                          ? 'linear-gradient(135deg, #1B2B5B, #0096B7)'
                          : x.type === 'parking'
                            ? 'linear-gradient(135deg, #0F766E, #0EA5E9)'
                            : 'linear-gradient(135deg, #C2410C, #F59E0B)',
                    }}
                  >
                    {x.type === 'lounge' ? (
                      <IconLounge size={18} />
                    ) : x.type === 'parking' ? (
                      <IconCar size={18} />
                    ) : (
                      <IconFastTrack size={18} />
                    )}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-ink truncate">{x.name}</div>
                    <div className="text-xs text-ink-2">
                      {formatDayMonth(x.date)} · {formatTime(x.date)} · {x.airport}
                    </div>
                  </div>
                  <IconChevR size={18} className="text-ink-3" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
    </PageEnter>
  );
}

function greetingKey(): string {
  const h = new Date().getHours();
  if (h < 12) return 'home.morning';
  if (h < 18) return 'home.afternoon';
  return 'home.evening';
}

function countdownKey(event: string): string {
  if (event === 'flight') return 'cd.fly';
  if (event === 'check-in') return 'cd.checkin';
  return 'cd.travel';
}

function QuickTile({
  href,
  icon,
  label,
  disabled,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  disabled?: boolean;
}) {
  const body = (
    <div
      className={[
        'bg-surface border border-line-light rounded-2xl py-3.5 text-center transition-all',
        disabled ? 'opacity-40' : 'hover:-translate-y-0.5 hover:shadow-sm cursor-pointer',
      ].join(' ')}
    >
      <div className="w-8 h-8 mx-auto mb-1.5 rounded-xl bg-teal/10 text-navy dark:text-teal-light flex items-center justify-center">
        {icon}
      </div>
      <div className="text-[10px] font-semibold text-ink leading-tight">{label}</div>
    </div>
  );
  if (disabled) return body;
  return <Link href={href}>{body}</Link>;
}

function UpNextCard({ event }: { event: TimelineEvent }) {
  return (
    <Link
      href={event.href}
      className="block bg-surface border border-line-light rounded-2xl p-4 hover:shadow-sm transition-shadow tap"
    >
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="w-11 h-11 rounded-xl text-white flex items-center justify-center flex-shrink-0 shadow-sm"
          style={{ background: eventGradient(event.kind) }}
        >
          {eventIcon(event.kind)}
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium text-ink-2 mb-0.5">{event.subtitle}</div>
          <div className="text-[15px] font-semibold text-ink leading-snug truncate">
            {event.title}
          </div>
          <div className="text-xs text-ink-3 mt-1 inline-flex items-center gap-1.5">
            <IconClock size={12} />
            <span>{formatDayMonth(event.date)} · {formatTime(event.date)}</span>
          </div>
        </div>
        <IconChevR size={18} className="text-ink-3 flex-shrink-0 mt-1" />
      </div>
    </Link>
  );
}

function CompactEventRow({ event }: { event: TimelineEvent }) {
  return (
    <Link
      href={event.href}
      className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light hover:shadow-sm transition-shadow tap"
    >
      <span
        className="w-9 h-9 rounded-xl text-white flex items-center justify-center flex-shrink-0"
        style={{ background: eventGradient(event.kind) }}
      >
        {eventIcon(event.kind, 16)}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold text-ink truncate">{event.title}</div>
        <div className="text-xs text-ink-2 truncate">
          {formatDayMonth(event.date)} · {formatTime(event.date)} · {event.subtitle}
        </div>
      </div>
      <IconChevR size={18} className="text-ink-3" />
    </Link>
  );
}

function eventGradient(k: TimelineEvent['kind']): string {
  switch (k) {
    case 'flight':
      return 'linear-gradient(135deg, #1B2B5B, #00B4D8)';
    case 'hotel-checkin':
    case 'hotel-checkout':
      return 'linear-gradient(135deg, #0EA5E9, #0369A1)';
    case 'lounge':
      return 'linear-gradient(135deg, #1B2B5B, #0096B7)';
    case 'parking':
      return 'linear-gradient(135deg, #0F766E, #0EA5E9)';
    case 'fast-track':
      return 'linear-gradient(135deg, #C2410C, #F59E0B)';
    default:
      return 'linear-gradient(135deg, #475569, #94A3B8)';
  }
}

function eventIcon(k: TimelineEvent['kind'], size = 18) {
  switch (k) {
    case 'flight':
      return <IconPlane size={size} />;
    case 'hotel-checkin':
    case 'hotel-checkout':
      return <IconBed size={size} />;
    case 'lounge':
      return <IconLounge size={size} />;
    case 'parking':
      return <IconCar size={size} />;
    case 'fast-track':
      return <IconFastTrack size={size} />;
    default:
      return <IconPin size={size} />;
  }
}

/**
 * Home-screen banner for the newest unread agent message. Urgent messages take
 * a red accent, important an amber one, so they can't be missed at the top of
 * the trip screen. "View message" opens Notifications (which marks read);
 * "Mark as read" clears it in place.
 */
function AgentMessageBanner({
  message,
  agency,
  onRead,
}: {
  message: AgentLatest;
  agency: string;
  onRead: (id: string) => void;
}) {
  const pri = message.priority;
  const urgent = pri === 'urgent';
  const important = pri === 'important';
  const accent = urgent
    ? 'border-l-4 border-l-red-500'
    : important
      ? 'border-l-4 border-l-amber-500'
      : 'border-l-4 border-l-teal';
  const preview =
    message.body.length > 160 ? `${message.body.slice(0, 157).trimEnd()}…` : message.body;

  return (
    <div
      role="status"
      className={['mb-5 rounded-2xl bg-surface border border-line-light shadow-sm px-4 py-3.5', accent].join(' ')}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <span
          aria-hidden
          className="w-6 h-6 rounded-lg bg-teal/15 text-teal-dark flex items-center justify-center flex-shrink-0"
        >
          <IconBell size={13} />
        </span>
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-2">
          Message from {agency}
        </span>
        {(urgent || important) && (
          <span
            className={[
              'text-[9px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded',
              urgent ? 'bg-red-500/15 text-red-600' : 'bg-amber-500/15 text-amber-600',
            ].join(' ')}
          >
            {pri}
          </span>
        )}
      </div>
      {message.subject && (
        <div className="text-sm font-semibold text-ink leading-snug">{message.subject}</div>
      )}
      <p className="text-sm text-ink-2 mt-0.5 leading-snug break-words">{preview}</p>
      <div className="flex items-center gap-2 mt-3">
        <Link
          href="/notifications"
          className="inline-flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full bg-navy text-white dark:bg-teal dark:text-navy-dark"
        >
          View message
          <IconChevR size={14} />
        </Link>
        <button
          type="button"
          onClick={() => onRead(message.id)}
          className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface border border-line text-ink-2 hover:text-ink hover:border-teal/40 transition-colors"
        >
          Mark as read
        </button>
      </div>
    </div>
  );
}
