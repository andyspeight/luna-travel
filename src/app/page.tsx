'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { BookingPicker } from '@/components/booking-picker';
import { AgencyLogo } from '@/components/agency-logo';
import { OnboardingHome } from '@/components/onboarding-home';
import { SectionHeading } from '@/components/section-heading';
import { GuideLinks } from '@/components/guide-links';
import { AddToHomeBanner } from '@/components/add-to-home';
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
  IconTicket,
  IconCalendar,
} from '@/components/icons';
import {
  countdownTo,
  formatDayMonth,
  formatTime,
  type CountdownParts,
} from '@/lib/format';
import { buildTimeline, nextEvent, type TimelineEvent } from '@/lib/booking-helpers';
import { destinationHero } from '@/lib/hero';
import { getDestinationGuide } from '@/data/destinations';
import { WhatsOn } from '@/components/whats-on';
import { SuggestionRail } from '@/components/suggestion-rail';
import { useI18n } from '@/lib/locale-context';
import { PageEnter } from '@/components/page-enter';
import { CoverSplash, tripStartInstant } from '@/components/cover-splash';
import { useCover } from '@/lib/cover-context';
import { useAgentMessages, type AgentLatest } from '@/lib/use-agent-messages';
import { usePlace } from '@/lib/use-place';
import { useFlightLive } from '@/lib/use-flight-live';
import { useOnline } from '@/lib/use-online';
import { tripPhase, flightOfTheDay } from '@/lib/trip-phase';
import { SupportCard } from '@/components/support-card';
import { FeedbackCard, NextIdeaCard } from '@/components/post-trip';
import { BalanceCard } from '@/components/balance-card';
import { HeroPhoto } from '@/components/hero-photo';
import { TravelDayCard } from '@/components/travel-day';
import { warmCache, summarise, cacheSupported, cacheableDocUrl } from '@/lib/offline-docs';

export default function HomePage() {
  const { booking, onboarding, liveLoading, source } = useBooking();
  const { coverEnabled, coverDismissed } = useCover();
  const { t } = useI18n();
  const { latest } = useAgentMessages();
  // Third first-paint fetch on this screen, and deliberately non-blocking: the
  // hook returns {place:null, loading:false} without touching the network for a
  // booking with no country, and every section it feeds hides itself.
  const { place, loading: placeLoading } = usePlace(booking);

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
  // NOT booking.tripStart: that is a calendar date ('2026-11-27'), so counting
  // down to it counts down to 00:00 UTC on departure day and the pill reads
  // "0 hours until you fly" while the traveller is still at home. The real
  // instant is derived from the first flight / timed item — see tripStartInstant
  // in cover-splash.tsx, which the splash on this same screen ticks from too, so
  // the two clocks can never disagree.
  const startIso = tripStartInstant(booking);
  const [parts, setParts] = useState<CountdownParts>(() => countdownTo(startIso));

  useEffect(() => {
    setParts(countdownTo(startIso));
    const id = setInterval(() => setParts(countdownTo(startIso)), 1000);
    return () => clearInterval(id);
  }, [startIso]);

  const lead = booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];
  const next = nextEvent(booking);
  const upcoming = buildTimeline(booking).filter((e) => !e.past).slice(0, 3);
  // heroSlug first, locationSlug second — and /destination and the cover splash
  // do exactly the same. booking.locationSlug is only re-derived on the live
  // Travelify path; a redeemed invite persists location_slug at redeem time and
  // a stored off-platform payload bakes it in, so for those travellers it stays
  // null and this screen showed the generic country cover while the guide page
  // one tap later showed the right photo. place.heroSlug is resolved from the
  // booking's signals at request time, so it is correct for those rows too.
  // usePlace is already called above: no extra fetch.
  const hero = destinationHero(
    booking.primaryCountryCode,
    place?.heroSlug || booking.locationSlug,
    // The resolved place itself, so Orlando can carry its own photograph
    // rather than only inheriting Florida's. heroSlug above is the nearest
    // ANCESTOR that has one; this is the place. When no photo has been
    // uploaded for it the layer simply does not paint and the ancestor shows
    // through, so this can never make a cover worse than it was.
    place?.slug,
  );
  const tripOver = Date.now() > new Date(booking.tripEnd).getTime();

  // ── Travel day ──
  //
  // The screen used to look the same on the sofa six weeks out as it did in
  // the departures hall. On the day of a flight it leads with that flight
  // instead of a countdown reading "0 days".
  const phase = tripPhase(booking);
  const todaysFlight = flightOfTheDay(booking, Date.now());
  const isTravelDay = phase === 'travel-day' || phase === 'returning';
  const { getLive, refresh, refreshing, failed } = useFlightLive();

  const online = useOnline();
  const [storedDocs, setStoredDocs] = useState<Set<string>>(new Set());

  // Warm the documents on a travel day even if the traveller never opens the
  // documents screen. Today is the day they will need them without signal.
  const docUrls = booking.documents
    .map(cacheableDocUrl)
    .filter((u): u is string => !!u);
  const docKey = isTravelDay ? docUrls.join('|') : '';
  useEffect(() => {
    if (!docKey) return;
    let cancelled = false;
    void (async () => {
      const have = await warmCache(docKey.split('|'));
      if (!cancelled) setStoredDocs(have);
    })();
    return () => {
      cancelled = true;
    };
  }, [docKey]);

  const docSummary = summarise({
    total: docUrls.length,
    stored: docUrls.filter((u) => storedDocs.has(u)).length,
    supported: cacheSupported(),
    online,
  });

  // Tiles describe the booking rather than a fixed template. The old five were
  // hardcoded, so a tickets-only trip got a permanently dead Hotel tile and a
  // plane on a trip with no flight. Candidates in priority order; first five win.
  const tiles: Array<{ href: string; icon: React.ReactNode; label: string }> = [];
  if (booking.flights.length) {
    tiles.push({
      href: `/flight/${booking.flights[0].id}`,
      icon: <IconPlane size={18} />,
      label: t('tile.flights'),
    });
  }
  if (booking.hotels.length) {
    tiles.push({
      href: `/hotel/${booking.hotels[0].id}`,
      icon: <IconBed size={18} />,
      label: t('tile.hotel'),
    });
  }
  if (booking.experiences?.length) {
    tiles.push({
      href: `/experience/${booking.experiences[0].id}`,
      icon: <IconTicket size={18} />,
      label: t('tile.tickets'),
    });
  }
  tiles.push({ href: '/itinerary', icon: <IconCalendar size={18} />, label: t('tile.plan') });
  tiles.push({ href: '/map', icon: <IconMap size={18} />, label: t('tile.map') });
  tiles.push({ href: '/documents', icon: <IconDoc size={18} />, label: t('tile.docs') });
  tiles.push({ href: '/luna', icon: <IconChat size={18} />, label: t('tile.luna') });

  // A guide card that leads to "coming soon" is worse than no card, so the link
  // waits until we know there is something behind it — either a place record or
  // the static guide.
  //
  // Only the place-only branch waits on the network. getDestinationGuide() is a
  // synchronous lookup in local bundled data, so gating it on !placeLoading meant
  // a stalled /api/traveller/place request — lie-fi, a captive portal, a socket
  // that never settles, i.e. the normal condition for this app's audience — hid
  // the destination card for the whole session for a country we could already
  // render offline.
  const hasGuide = Boolean(
    booking.primaryCountryCode &&
      (getDestinationGuide(booking.primaryCountryCode) || (!placeLoading && place)),
  );

  // First-run / un-onboarded visitor (no session, no demo trip chosen): show
  // the onboarding prompt instead of the fallback demo booking.
  if (onboarding) {
    return <OnboardingHome />;
  }

  // Still checking for a real booking — show a light loading state rather than
  // flashing a demo trip that a live booking is about to replace. This holds
  // even when a demo was previously selected on this device: a traveller with
  // a real session must never glimpse the demo Maldives trip (the bug where
  // "Take me to my booking" landed on the wrong holiday).
  if (liveLoading && source !== 'live') {
    return (
      <main className="min-h-[100dvh] flex items-center justify-center" aria-busy="true">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-navy to-teal animate-pulse" />
      </main>
    );
  }

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
            <AgencyLogo agency={booking.agency} size={36} />
            <div className="text-left">
              <div className="text-sm font-semibold text-ink leading-none">
                {booking.agency.appName || 'Luna Travel'}
              </div>
              {/* The company name only when it adds something. An agency whose
                  app is simply called by its own name printed it twice, one
                  above the other. */}
              {booking.agency.name &&
                booking.agency.name.trim().toLowerCase() !==
                  (booking.agency.appName || 'Luna Travel').trim().toLowerCase() && (
                  <div className="text-[11px] text-ink-3 leading-none mt-1">
                    {booking.agency.name}
                  </div>
                )}
            </div>
          </div>
        </BookingPicker>
      </header>

      {/* Greeting.

          On a travel day it says what today IS. The agency's welcome message
          is written for somebody looking forward to a trip, and the top of the
          screen in a departures hall is the most expensive space in the app —
          it belongs to the flight. */}
      <div className="mt-2 mb-5">
        {isTravelDay && todaysFlight ? (
          <>
            <p className="text-xs uppercase tracking-wide text-ink-3 font-medium">
              Today, {formatDayMonth(todaysFlight.depTime)}
            </p>
            <h1 className="font-serif text-[32px] leading-tight text-ink">
              {phase === 'returning'
                ? 'Flying home today'
                : `Flying to ${booking.destinationLabel} today`}
            </h1>
            <p className="text-sm text-ink-2 mt-1.5 leading-relaxed max-w-[340px]">
              Your next step, tickets and help, all here.
            </p>
          </>
        ) : (
          <>
            <p className="text-xs uppercase tracking-wide text-ink-3 font-medium">
              {tripOver ? t('next.welcomeHome') : t(greetingKey())}
            </p>
            <h1 className="font-serif text-[34px] leading-tight text-ink">
              {t('home.hello')}{' '}
              <em className="not-italic font-serif italic text-teal-dark dark:text-teal-light">
                {lead.firstName}
              </em>
              .
            </h1>
            {/* The agency's welcome is written for somebody looking forward to
                a trip ("anything you need before or during your trip"), so
                once it is over the screen says what is still here instead. */}
            {tripOver ? (
              <p className="text-sm text-ink-2 mt-2 leading-relaxed max-w-[340px]">
                {t('post.stillHere', { agency: booking.agency.name || 'travel' })}
              </p>
            ) : (
              booking.agency.welcomeMessage && (
                <p className="text-sm text-ink-2 mt-2 leading-relaxed max-w-[340px]">
                  {booking.agency.welcomeMessage}
                </p>
              )
            )}
          </>
        )}
      </div>

      {/* Urgent / unread agent message, surfaced at the top so it can't be missed */}
      {latest && (
        <AgentMessageBanner message={latest} agency={booking.agency.name} onRead={markRead} />
      )}

      {/* After the trip: ask how it went, then offer ONE specific next idea.
          This replaced a generic "Where next?" banner; the review asked for a
          specific action ("Ask your agent about Crete") and for the feedback
          request to say where it goes and be dismissible. The documents and
          help both stay below, because a problem does not end when the holiday
          does — an insurance claim needs the policy, a complaint needs the
          agent. */}
      {tripOver && (
        <>
          <FeedbackCard />
          <NextIdeaCard booking={booking} />
        </>
      )}

      {/* On a travel day the flight takes the hero's place. */}
      {isTravelDay && todaysFlight && (
        <TravelDayCard
          flight={todaysFlight}
          live={getLive(todaysFlight.id)}
          isReturn={phase === 'returning'}
          destination={booking.destinationLabel}
          docsLine={docUrls.length ? docSummary.text : null}
          docsWarn={docSummary.warn}
          online={online}
          refreshing={refreshing}
          failed={failed}
          onRefresh={() => void refresh()}
        />
      )}

      {/* Hero trip card */}
      {!(isTravelDay && todaysFlight) && (
      <Link href="/itinerary" className="block">
        <article className="rounded-3xl overflow-hidden bg-surface shadow-md hover:shadow-lg transition-shadow">
          <div
            className="relative h-56 p-4 text-white"
            style={{ background: hero.gradient }}
          >
            {/* The most specific photo that exists, and never a wrong one first. */}
            <HeroPhoto candidates={[hero.imagePlace, hero.imageLocation, hero.image]} />
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: hero.glow }}
            />
            {/* Scrim — lifts the destination + countdown off the image for a
                cinematic, always-legible cover. */}
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'linear-gradient(to top, rgba(2,6,23,0.72) 0%, rgba(2,6,23,0.18) 46%, rgba(2,6,23,0.14) 58%, rgba(2,6,23,0.60) 100%)',
              }}
            />
            <div className="relative flex justify-between items-start">
              <span className="inline-flex items-center gap-1.5 bg-navy-dark/55 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
                <span className="w-1.5 h-1.5 rounded-full bg-teal-light shadow-[0_0_0_3px_rgba(72,202,228,0.3)]" />
                {tripOver ? t('post.tripComplete') : booking.status === 'confirmed' ? t('home.upcoming') : booking.status}
              </span>
              <span className="text-[11px] opacity-80 tabular tracking-wide">
                REF · {booking.reference}
              </span>
            </div>
            <div className="absolute bottom-5 left-5 right-5">
              {!tripOver && (
                <span className="inline-flex items-center gap-1.5 bg-navy-dark/55 backdrop-blur px-3 py-1 rounded-full text-[12px] font-semibold mb-2.5 shadow-sm">
                  <IconPlane size={13} />
                  {countdownPill(parts, t, countdownKey(booking.tripStartEvent))}
                </span>
              )}
              <h2 className="font-serif text-[32px] leading-none mb-1.5 drop-shadow-sm">
                <em>{booking.destinationLabel || t('home.yourTrip')}</em>
              </h2>
              <p className="text-sm opacity-95 truncate">
                {booking.hotels[0]?.name ?? booking.experiences?.[0]?.title ?? t('home.tripCustom')}{' '}
                · {booking.durationLabel} ·{' '}
                {booking.travellers.length} traveller{booking.travellers.length === 1 ? '' : 's'}
              </p>
            </div>
          </div>

          {/* Countdown strip. Not after the trip: it sat at 00:00:00:00 on a
              holiday that ended days ago. */}
          {!tripOver && (
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
          )}
          <div className="pb-4" />
        </article>
      </Link>
      )}

      {/* Money still owed. Draws nothing for a booking that is paid, or whose
          balance the app cannot see — see components/balance-card. */}
      {!tripOver && <BalanceCard booking={booking} />}

      {/* Quick tiles */}
      <div className="grid grid-cols-5 gap-2 mt-4">
        {tiles.slice(0, 5).map((tile) => (
          <QuickTile key={tile.href} href={tile.href} icon={tile.icon} label={tile.label} />
        ))}
      </div>

      {/* Getting hold of a human, from the screen the app opens on. It used to
          take knowing that "Me" was where the phone number lived. */}
      <div className="mt-4">
        <SupportCard agency={booking.agency} compact />
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

      {/* Add to home screen — until installed or dismissed on this device */}
      <AddToHomeBanner />

      {/* Agency-authored guide pages — appear as the agent publishes them */}
      <GuideLinks />

      {/* Destination guide — needs a country to have anything to show. A
          booking of attraction tickets has no hotel city and no arrival
          airport, so it has no country, and the card rendered as a blank
          title over an empty gradient. */}
      {/* "Get to know it" is preparation — visa, weather, currency — for a
          trip that is now over. The guide is still one tap away on its tab. */}
      {hasGuide && !tripOver && (
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
              {/* The most specific photo that exists, and never a wrong one first. */}
              <HeroPhoto candidates={[hero.imagePlace, hero.imageLocation, hero.image]} />
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
      )}

      {/* Local events inside the traveller's own dates */}
      <WhatsOn />

      {/* Two rails, not one filtered rail: "add a few days" keeps the trip's own
          country, "where next?" is the rebooking surface in another one. Both
          fall back to the curated collection on /inspiration. */}
      <SuggestionRail reason="paired" variant="compact" />
      <SuggestionRail reason="similar" variant="compact" />

      {/* Airport extras */}
      {/* Listed as if still to come. They remain on the itinerary, and their
          vouchers in Documents. */}
      {booking.airportExtras.length > 0 && !tripOver && (
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

/** One elegant line for the hero cover, e.g. "12 days until you fly". */
function countdownPill(parts: CountdownParts, t: (k: string) => string, key: string): string {
  const until = t(key);
  if (parts.days >= 1) return `${parts.days} ${t('cd.days')} ${until}`;
  if (parts.hours >= 1) return `${parts.hours} ${t('cd.hours')} ${until}`;
  return `${parts.minutes} ${t('cd.mins')} ${until}`;
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
  // Flights get a boarding-pass-style layout: the route reads at a glance.
  const route = event.kind === 'flight' ? (event.meta || '').split('→').map((s) => s.trim()) : null;
  if (route && route.length === 2 && route[0] && route[1]) {
    const [from, to] = route;
    return (
      <Link
        href={event.href}
        className="block bg-surface border border-line-light rounded-2xl p-4 hover:shadow-sm transition-shadow tap"
      >
        <div className="flex items-center gap-2 mb-3.5">
          <span
            aria-hidden
            className="w-8 h-8 rounded-lg text-white flex items-center justify-center flex-shrink-0"
            style={{ background: eventGradient('flight') }}
          >
            <IconPlane size={15} />
          </span>
          <span className="text-[13px] font-semibold text-ink truncate">{event.subtitle}</span>
          <span className="ml-auto text-[11px] text-ink-3 inline-flex items-center gap-1 flex-shrink-0">
            <IconClock size={11} />
            {formatDayMonth(event.date)}
          </span>
        </div>
        <div className="flex items-center gap-3">
          <div className="text-left">
            <div className="text-xl font-extrabold text-ink leading-none tracking-tight">{from}</div>
            <div className="text-[11px] text-ink-3 mt-1">{formatTime(event.date)}</div>
          </div>
          <div className="flex-1 relative h-px bg-line mx-1">
            <span className="absolute left-1/2 -top-[9px] -translate-x-1/2 bg-surface px-1 text-navy dark:text-teal-light">
              <IconPlane size={14} />
            </span>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-ink leading-none tracking-tight">{to}</div>
            <div className="text-[11px] text-ink-3 mt-1">&nbsp;</div>
          </div>
        </div>
      </Link>
    );
  }

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
            <span>{[formatDayMonth(event.date), formatTime(event.date)].filter(Boolean).join(' · ')}</span>
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
          {[formatDayMonth(event.date), formatTime(event.date), event.subtitle].filter(Boolean).join(' · ')}
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
    // Tickets and excursions matched the experience page's own treatment
    // nowhere: a Disney day read as an unclassified 'other' in grey.
    case 'activity':
    case 'excursion':
      return 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)';
    case 'car-hire':
    case 'transfer':
      return 'linear-gradient(135deg, #0F766E, #0EA5E9)';
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
    case 'activity':
    case 'excursion':
      return <IconCompass size={size} />;
    case 'car-hire':
    case 'transfer':
      return <IconCar size={size} />;
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
