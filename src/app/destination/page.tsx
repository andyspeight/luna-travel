'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import {
  IconCoin,
  IconClock,
  IconInfo,
  IconWarning,
  IconShield,
  IconPin,
  IconPlane,
  IconChevR,
} from '@/components/icons';
import {
  ClimateStrip,
  EventList,
  OtherTimesEvents,
  UndatedEvents,
  FactGrid,
  FactRows,
  HighlightGrid,
  PlaceCredit,
  ProseStack,
  type PlaceFactRow,
} from '@/components/place-sections';
import { ParkPanel } from '@/components/park-panel';
import { destinationHero } from '@/lib/hero';
import { getDestinationGuide } from '@/data/destinations';
import { usePlace } from '@/lib/use-place';
import { useBrainGuide, type BrainAnswer, type BrainGuide } from '@/lib/use-brain';
import { isEmptyGuide, resolveGuide, type ResolvedGuide } from '@/lib/guide-merge';
import { splitEvents } from '@/lib/destination-dates';
import { emergencyNumbers } from '@/lib/emergency';
import { haversineKm, matchTicketsToParks } from '@/lib/park-match';
import type {
  ParkRecord,
  PlaceFact,
  PlaceSectionKey,
  PlaceTier,
  PlaceView,
} from '@/types/destination-content';
import type { ExperienceKind } from '@/types/booking';

// ───────── Live conditions shapes (mirror weather.ts / holidays.ts) ─────────

interface CondWeather {
  mode: 'forecast' | 'normals';
  summary: string;
  maxC: number | null;
  minC: number | null;
  seaTempC?: number | null;
  days?: { date: string; maxC: number | null; minC: number | null; precipProb?: number | null }[];
  monthLabel?: string;
  sources: string[];
  asOf: string;
  note?: string;
}
interface CondHoliday { date: string; name: string; kind: 'public' | 'observance'; sources: string[] }
interface CondHolidays { holidays: CondHoliday[]; sourceCount: number; asOf: string }
interface CondSegment {
  label: string;
  countryCode: string;
  from: string;
  to: string;
  weather: CondWeather | null;
  holidays: CondHolidays | null;
}
interface Conditions { configured: boolean; segments: CondSegment[] }

interface TabDef { id: string; label: string }

const TAB_OVERVIEW = 'Overview';
const TAB_DATES = 'For your dates';
const TAB_WHATS_ON = "What's on";
const TAB_ESSENTIALS = 'Essentials';
const TAB_PARK = 'Your park guide';
const TAB_VISA = 'Visa & safety';
const TAB_TIPS = 'Insider tips';

// Kinds that can legitimately BE a theme park visit. Mirrors the gate on
// src/app/experience/[id]/page.tsx — a transfer, car hire, lounge, parking or
// fast-track add-on never gets a park guide, however park-shaped its title is.
// Only a genuine attraction booking earns a park guide. Travelify Extras — a dining
// plan, resort car parking, a fast-track pass — all map to kind 'other', and they
// carry the park's NAME, so including 'other' here handed "Walt Disney World Dining
// Plan" a full park guide with Disney's height restrictions on it. attractionKind()
// only ever returns 'excursion' or 'activity' for a real ticket.
const TICKET_KINDS = new Set<ExperienceKind>(['excursion', 'activity']);

export default function DestinationGuidePage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const { place, loading: placeLoading } = usePlace(booking);
  const { brain, loading: brainLoading } = useBrainGuide(booking);
  const [conditions, setConditions] = useState<Conditions | null>(null);
  const [tab, setTab] = useState<string>(TAB_OVERVIEW);

  // THE merge. Every guide.* dereference below reads from this object, so the
  // precedence between place content, Luna Brain and the static guide lives in
  // exactly one place instead of fifteen inline `brain?.x || guide.x` chains.
  const guide = useMemo<ResolvedGuide>(
    () =>
      resolveGuide({
        countryCode: booking.primaryCountryCode,
        place,
        brain: brain ? { destination: brain.destination ?? undefined } : null,
        staticGuide: getDestinationGuide(booking.primaryCountryCode),
      }),
    [booking.primaryCountryCode, place, brain],
  );

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

  // Pull the live weather + holidays layer, one segment per stay location
  // (consecutive stays in the same place are merged). Additive + graceful.
  useEffect(() => {
    let alive = true;
    const segments = buildSegments(
      booking.hotels,
      booking.experiences ?? [],
      place,
      booking.tripStart,
      booking.tripEnd,
    );
    if (!segments.length) return;
    const qs = new URLSearchParams();
    for (const s of segments) {
      qs.append('loc', `${s.lat},${s.lng},${s.countryCode},${s.from},${s.to},${s.label}`);
    }
    fetch(`/api/traveller/conditions?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: Conditions | null) => {
        if (alive && data && data.configured) setConditions(data);
      })
      .catch(() => {
        /* ignore — section just won't show */
      });
    return () => {
      alive = false;
    };
  }, [booking.reference, booking.hotels, booking.experiences, booking.tripStart, booking.tripEnd, place]);

  const events = useMemo(
    () => splitEvents(place?.events ?? [], booking.tripStart, booking.tripEnd),
    [place, booking.tripStart, booking.tripEnd],
  );

  // Ticket → park runs here so the tab can exist at all; the matcher is
  // deliberately conservative and an unmatched ticket simply gets no tab.
  //
  // Only real ticket kinds are offered to the matcher. order-to-booking.ts
  // builds transfer titles as `Transfer to ${dropoff}`, so a Mears airport
  // transfer arrives as "Transfer to Universal Orlando Resort" carrying the
  // PICKUP coordinates (the airport, inside the 40 km veto) and matches
  // Universal on name+coords. A transfer, a car hire or a generic add-on must
  // never be handed a park guide — the same gate the experience page applies.
  const parkMatch = useMemo(() => {
    const tickets = (booking.experiences ?? [])
      .filter((e) => TICKET_KINDS.has(e.kind))
      .map((e) => ({
        id: e.id,
        title: e.title,
        lat: e.lat,
        lng: e.lng,
      }));
    return matchTicketsToParks(tickets, place?.parks ?? []);
  }, [booking.experiences, place]);

  // EVERY confident match, not just the first. An Orlando booking routinely
  // carries a Disney ticket AND a Universal ticket; taking matched[0] gave the
  // second park no tab, no panel and no insider tips at all. Each park is
  // paired here with the photo from ITS OWN experience so a panel can never
  // show one park's guide over another park's supplier photo.
  const myParks = useMemo(() => {
    const seen = new Set<string>();
    const out: Array<{ park: ParkRecord; photo?: string }> = [];
    for (const m of parkMatch.matched) {
      // Two tickets can resolve to the same park (a park ticket plus its dining
      // plan); the traveller should see that guide once, not twice.
      if (seen.has(m.park.id)) continue;
      seen.add(m.park.id);
      out.push({
        park: m.park,
        photo: (booking.experiences ?? []).find((e) => e.id === m.experienceId)?.photos?.[0],
      });
    }
    return out;
  }, [parkMatch, booking.experiences]);

  const hasConditions = !!conditions?.segments?.some(
    (s) => s.weather || (s.holidays && s.holidays.holidays.length > 0),
  );
  const hasForYourDates = !!brain?.forYourDates || hasConditions;
  const hasWhatsOn =
    events.inWindow.length > 0 || events.otherTimes.length > 0 || events.undated.length > 0;

  const essentialsQA = brainSectionFor(brain, /money|getting (around|there)|culture|practical/i);
  const visaQA = brainSectionFor(brain, /entry|visa|health|safety/i);
  const travelLabel = brain?.forYourDates?.travelLabel || travelWindowLabel(booking.tripStart, booking.tripEnd);

  const sections = place?.sections ?? [];
  const hasIntroSections = hasSection(sections, ['hero-intro', 'overview']);
  const hasCharacterSections = hasSection(sections, ['what-makes-it-special', 'character']);
  const hasBestTime = hasSection(sections, ['best-time']);

  const quickFacts: PlaceFactRow[] = [
    { icon: <IconCoin size={14} />, label: 'Currency', value: guide.currency, ...attrOf(guide, place, 'currency', place?.facts.currency) },
    { icon: <IconClock size={14} />, label: 'Time zone', value: guide.timeZone, ...attrOf(guide, place, 'timeZone', place?.facts.timeZone) },
    { icon: <IconInfo size={14} />, label: 'Languages', value: guide.languages, ...attrOf(guide, place, 'languages', place?.facts.language) },
    { icon: <IconInfo size={14} />, label: t('place.power'), value: guide.voltageAndPlug, ...attrOf(guide, place, 'voltageAndPlug', place?.facts.voltageAndPlug) },
    { icon: <IconPlane size={14} />, label: t('place.flightTime'), value: guide.flightTimeFromUK, ...attrOf(guide, place, 'flightTimeFromUK', place?.facts.flightTimeFromUK) },
  ];

  // Does any row in the grid ABOVE actually come from Luna Brain?
  //
  // The chip says "Verified facts from Luna Brain", but resolveGuide now puts
  // place content AHEAD of Brain for exactly these five local-practicality
  // fields (guide-merge.ts), so on any destination with its own Airtable copy
  // none of them are Brain's and the chip was stamping "verified" on editorial
  // prose. place-sections.tsx's own header: labelling editorial copy as
  // verified is worse than labelling it not at all.
  //
  // A row is Brain's when it has a value, carries no place tier (sourceOf is
  // only ever set for place content) and Brain actually holds that field —
  // otherwise the value fell through to the static guide. flightTimeFromUK is
  // absent here on purpose: Luna Brain has no such field, so that row can only
  // ever be place content or static.
  const brainDest = brain?.destination;
  const fromBrain = (field: keyof ResolvedGuide, brainValue?: string) =>
    !!guide[field] && !guide.sourceOf[field] && !!brainValue;
  const quickFactsVerified =
    fromBrain('currency', brainDest?.currency) ||
    fromBrain('timeZone', brainDest?.timeZone) ||
    fromBrain('languages', brainDest?.languages) ||
    fromBrain(
      'voltageAndPlug',
      [brainDest?.voltage, brainDest?.plugType].filter(Boolean).join(' · '),
    );

  const essentialFacts: PlaceFactRow[] = [
    ...quickFacts,
    // Only the fallback wording: when the place has its own best-time prose it
    // renders in full on Overview and a truncated copy here helps nobody.
    ...(hasBestTime ? [] : [{ icon: <IconInfo size={14} />, label: 'Weather', value: guide.weatherSummary }]),
    ...(brain?.destination?.tapWaterSafe ? [{ icon: <IconInfo size={14} />, label: 'Tap water', value: brain.destination.tapWaterSafe }] : []),
    ...(brain?.destination?.drivingSide ? [{ icon: <IconInfo size={14} />, label: 'Driving', value: brain.destination.drivingSide }] : []),
    { icon: <IconWarning size={14} />, label: 'Emergency', value: guide.emergencyNumber },
  ];
  const hasEssentialFacts = essentialFacts.some((f) => !!f.value);

  // The four tabs used to be unconditional because DestinationGuide made every
  // field mandatory. Place content does not, so a country with only an Overview
  // would otherwise open a tab onto a blank screen.
  const hasEssentials =
    hasEssentialFacts ||
    hasSection(sections, ['getting-there', 'getting-around', 'nearby-excursions']) ||
    essentialsQA.length > 0;
  const hasVisa =
    !!guide.visaSummary ||
    !!guide.emergencyNumber ||
    visaQA.length > 0 ||
    hasSection(sections, ['visa', 'health']);
  const parkTips = myParks.filter((p) => !!p.park.quirksAndInsiderTips);
  const hasTips = !!guide.insiderTips || parkTips.length > 0;

  const tabs = useMemo<TabDef[]>(() => {
    const out: TabDef[] = [{ id: TAB_OVERVIEW, label: TAB_OVERVIEW }];
    if (hasForYourDates) out.push({ id: TAB_DATES, label: TAB_DATES });
    if (hasWhatsOn) out.push({ id: TAB_WHATS_ON, label: t('whatson.section') });
    if (hasEssentials) out.push({ id: TAB_ESSENTIALS, label: TAB_ESSENTIALS });
    // One tab whatever the count: two parks is the common Orlando case and does
    // not warrant two tabs, so both panels stack inside it.
    if (myParks.length > 0) out.push({ id: TAB_PARK, label: t('park.section') });
    if (hasVisa) out.push({ id: TAB_VISA, label: TAB_VISA });
    if (hasTips) out.push({ id: TAB_TIPS, label: TAB_TIPS });
    return out;
  }, [hasForYourDates, hasWhatsOn, hasEssentials, hasVisa, hasTips, myParks, t]);

  // A tab can vanish between renders (the place payload arrives, or the park
  // match changes); without this the page would show a body with nothing lit.
  const activeTab = tabs.some((d) => d.id === tab) ? tab : TAB_OVERVIEW;

  // Three states, in this order: nothing yet but still loading → skeleton;
  // nothing and settled → the coming-soon line; anything at all → the page.
  // Without the skeleton every booking outside the four static guides flashed
  // "coming soon" before the fetches resolved.
  if (isEmptyGuide(guide)) {
    const settled = !placeLoading && !brainLoading;
    return (
      <>
        <NavBar title="Destination" backLabel="Trip" />
        <PageEnter>
          <main className="px-5 pt-12">
            {settled ? (
              <p className="text-ink-2 text-center">
                Destination guide for {booking.destinationLabel} is coming soon.
              </p>
            ) : (
              <GuideSkeleton />
            )}
          </main>
        </PageEnter>
      </>
    );
  }

  return (
    <PageEnter>
      <main className="pb-6">
        {/* Hero */}
        <section
          className="relative h-72 text-white"
          style={{ background: hero.gradient }}
        >
          {hero.image && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `center/cover no-repeat url("${hero.image}")` }}
            />
          )}
          {hero.imageLocation && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `center/cover no-repeat url("${hero.imageLocation}")` }}
            />
          )}
          {hero.imagePlace && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `center/cover no-repeat url("${hero.imagePlace}")` }}
            />
          )}
          {/* The place's own photograph is the most specific image we have, so
              it sits above the bucket layers — which stay as the fallback when
              it fails to load. */}
          {place?.images?.[0]?.url && (
            <div
              aria-hidden
              className="absolute inset-0"
              style={{ background: `center/cover no-repeat url("${place.images[0].url}")` }}
            />
          )}
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: hero.glow }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-56"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.30) 42%, rgba(0,0,0,0.74) 100%)',
            }}
          />
          <div className="relative">
            <NavBar title=" " backLabel="Trip" variant="dark" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 z-10">
            {guide.region && (
              <div className="text-[11px] uppercase tracking-[0.18em] text-white inline-flex items-center gap-1.5 mb-2">
                <IconPin size={12} />
                {guide.region}
              </div>
            )}
            {guide.name && (
              <h1 className="font-serif text-[40px] leading-none tracking-tight">
                <em>{guide.name}</em>
              </h1>
            )}
            {(guide.tagline || guide.weatherSummary) && (
              <p className="text-sm text-white mt-1.5 line-clamp-2">
                {guide.tagline || guide.weatherSummary}
              </p>
            )}
          </div>
        </section>

        {/* Tabs */}
        <div className="sticky top-0 z-20 bg-surface border-b border-line-light">
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-none">
            {tabs.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => setTab(d.id)}
                className={[
                  'inline-flex min-h-[44px] items-center px-3.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                  activeTab === d.id
                    ? 'bg-navy text-white dark:bg-teal dark:text-navy-dark'
                    : 'bg-surface-3 text-ink-2 hover:text-ink',
                ].join(' ')}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4">
          {activeTab === TAB_OVERVIEW && (
            <>
              {hasIntroSections ? (
                <ProseStack sections={sections} sectionKey={['hero-intro', 'overview']} />
              ) : (
                guide.introduction && (
                  <p className="text-sm text-ink-2 leading-relaxed">{guide.introduction}</p>
                )
              )}

              {hasCharacterSections ? (
                <ProseStack
                  sections={sections}
                  sectionKey={['what-makes-it-special', 'character']}
                  title="Why we love it"
                />
              ) : (
                guide.whyWeLoveIt && (
                  <>
                    <h2 className="text-base font-semibold text-ink mt-5 mb-2">
                      Why we love it
                    </h2>
                    <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                      {guide.whyWeLoveIt}
                    </p>
                  </>
                )
              )}

              {place && <HighlightGrid highlights={place.highlights} />}

              <ProseStack sections={sections} sectionKey="things-to-do" title={t('place.thingsToDo')} />
              <ProseStack sections={sections} sectionKey="food" title={t('place.food')} />
              <ProseStack sections={sections} sectionKey="beaches" title="Beaches" />
              <ProseStack sections={sections} sectionKey="best-time" title={t('place.bestTime')} />

              <ClimateStrip
                climate={place?.climate}
                tripStart={booking.tripStart}
                tripEnd={booking.tripEnd}
              />

              <FactGrid facts={quickFacts} />

              {place?.audienceTags && place.audienceTags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-4">
                  {place.audienceTags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[11px] font-medium text-ink-2 bg-surface-3 px-2.5 py-1 rounded-full"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}
              {place?.audienceNote && (
                <p className="text-sm text-ink-2 leading-relaxed mt-4 whitespace-pre-line">
                  {place.audienceNote}
                </p>
              )}

              {quickFactsVerified && <VerifiedChip lastVerified={brainDest?.lastVerified} />}
              {place && <PlaceCredit place={place} />}
            </>
          )}

          {activeTab === TAB_DATES && (
            <ForYourDates
              fyd={brain?.forYourDates ?? null}
              fcdoStatus={brain?.destination?.fcdoStatus}
              conditions={conditions}
              travelLabel={travelLabel}
            />
          )}

          {activeTab === TAB_WHATS_ON && (
            <>
              {events.inWindow.length > 0 && (
                <>
                  <h2 className="text-base font-semibold text-ink mb-2">{t('whatson.section')}</h2>
                  <EventList events={events.inWindow} />
                </>
              )}
              {/* Out-of-window events get a neutral heading, never "through the
                  year" — an October-only festival shown to a May traveller under
                  that heading asserts a run length the Events JSON never states.
                  Undated ones ("Easter", "Varies") get a heading that claims no
                  date at all rather than being dropped. Both self-hide. */}
              <OtherTimesEvents events={events.otherTimes} />
              <UndatedEvents events={events.undated} />
              <p className="text-[11px] text-ink-3 italic mt-4">{t('whatson.note')}</p>
            </>
          )}

          {activeTab === TAB_ESSENTIALS && (
            <>
              {hasEssentialFacts && (
                <>
                  <h2 className="text-base font-semibold text-ink mb-2">
                    The basics
                  </h2>
                  <FactRows facts={essentialFacts} />
                </>
              )}

              {/* The facts above are read-only. The tools that USE them — the
                  converter, the packing list, the phrases — have their own
                  screen, because they need room and this page has none. */}
              <Link
                href="/essentials"
                className="mt-4 flex items-center justify-between gap-3 p-4 rounded-xl bg-surface border border-line-light"
              >
                <span className="min-w-0">
                  <span className="block text-[14px] font-semibold text-ink">Trip essentials</span>
                  <span className="block text-[12px] text-ink-3 leading-snug">
                    Currency converter, packing list, phrases to try
                  </span>
                </span>
                <IconChevR size={18} />
              </Link>

              <ProseStack sections={sections} sectionKey="getting-there" title={t('place.gettingThere')} />
              <ProseStack sections={sections} sectionKey="getting-around" title={t('place.gettingAround')} />
              <ProseStack sections={sections} sectionKey="nearby-excursions" title="Nearby excursions" />

              <BrainSection title="Good to know" answers={essentialsQA} />
              {place && <PlaceCredit place={place} />}
            </>
          )}

          {activeTab === TAB_PARK && myParks.length > 0 && (
            <div className="space-y-4">
              {myParks.map(({ park, photo }) => (
                <ParkPanel
                  key={park.id}
                  park={park}
                  href={`/park/${park.slug}`}
                  image={photo}
                />
              ))}
            </div>
          )}

          {activeTab === TAB_VISA && (
            <>
              {guide.visaSummary && (
                <>
                  <h2 className="text-base font-semibold text-ink mb-2 inline-flex items-center gap-1.5">
                    <IconShield size={16} />
                    Entry requirements
                  </h2>
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                    {guide.visaSummary}
                  </p>
                </>
              )}

              {guide.emergencyNumber && (
                <>
                  <h2 className="text-base font-semibold text-ink mt-5 mb-2 inline-flex items-center gap-1.5">
                    <IconWarning size={16} />
                    In case of emergency
                  </h2>
                  <div className="p-4 rounded-2xl bg-danger/5 border border-danger/15">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-danger-ink mb-1">
                      Emergency number
                    </div>
                    {/* One link over the whole field stripped
                        "102 (police) · 119 (medical)" to tel:102119 — not a
                        number anywhere, on the screen reached for in an
                        emergency. Each service is its own button now. */}
                    {emergencyNumbers(guide.emergencyNumber).length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {emergencyNumbers(guide.emergencyNumber).map((n) => (
                          <a
                            key={n.dial}
                            href={`tel:${n.dial}`}
                            className="inline-flex items-baseline gap-1.5 text-base font-semibold text-ink"
                          >
                            {n.display}
                            {n.service && (
                              <span className="text-[12px] font-normal text-ink-3">{n.service}</span>
                            )}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <span className="text-base font-semibold text-ink">{guide.emergencyNumber}</span>
                    )}
                  </div>
                </>
              )}

              {/* Luna Brain first — it is the only layer carrying Source,
                  Confidence and Last Verified. The country's own advisory copy
                  sits below it, never above. */}
              <BrainSection title="Verified answers" answers={visaQA} />

              {/* Suppressed when resolveGuide already promoted this very copy to
                  Entry requirements above, which it does when Brain had nothing. */}
              {guide.sourceOf.visaSummary === undefined && (
                <ProseStack sections={sections} sectionKey="visa" title="Visa advisory" />
              )}
              <ProseStack sections={sections} sectionKey="health" title="Health notes" />

              <p className="text-[11px] text-ink-3 italic mt-4">
                Always check the latest FCDO travel advice before you travel.
                Your agent can confirm specifics.
              </p>
            </>
          )}

          {activeTab === TAB_TIPS && (
            <>
              {guide.insiderTips && (
                <>
                  <h2 className="text-base font-semibold text-ink mb-2">
                    What we&rsquo;d tell a friend
                  </h2>
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                    {guide.insiderTips}
                  </p>
                </>
              )}

              {/* One block per matched park. The heading carries the park name
                  whenever there is more than one, so Disney's tips can never be
                  read as Universal's. */}
              {parkTips.map(({ park }) => (
                <div key={park.id} className="mt-5">
                  <h2 className="text-base font-semibold text-ink mb-2">
                    {parkTips.length > 1 ? `${park.name} — ${t('park.tips')}` : t('park.tips')}
                  </h2>
                  <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">
                    {park.quirksAndInsiderTips}
                  </p>
                </div>
              ))}
            </>
          )}
        </div>
      </main>
    </PageEnter>
  );
}

/** Attribution for a merged field — present only when place content supplied it,
 *  so a Luna Brain or static-guide value never gets labelled with a place name. */
function attrOf(
  guide: ResolvedGuide,
  place: PlaceView | null,
  field: keyof ResolvedGuide,
  fact?: PlaceFact,
): { tier?: PlaceTier; from?: string } {
  const tier = guide.sourceOf[field];
  if (!tier) return {};
  return { tier, from: fact?.from || place?.name };
}

function hasSection(
  sections: { key: PlaceSectionKey; body: string }[],
  keys: PlaceSectionKey[],
): boolean {
  return sections.some((s) => keys.includes(s.key) && !!s.body);
}

function GuideSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      <div className="h-6 w-1/2 rounded-lg bg-surface-3" />
      <div className="h-3 w-full rounded bg-surface-3" />
      <div className="h-3 w-5/6 rounded bg-surface-3" />
      <div className="h-3 w-4/6 rounded bg-surface-3" />
      <div className="grid grid-cols-2 gap-2 pt-3">
        <div className="h-20 rounded-xl bg-surface-3" />
        <div className="h-20 rounded-xl bg-surface-3" />
      </div>
    </div>
  );
}

interface Segment {
  lat: number;
  lng: number;
  countryCode: string;
  from: string;
  to: string;
  label: string;
}

/** An excursion inside this radius of a hotel segment is the same place as far
 *  as weather and public holidays go; splitting it out would put a per-segment
 *  heading on trips that read as one destination today. */
const SEGMENT_MERGE_KM = 25;

function segLabel(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

/**
 * Conditions segments, in decreasing order of confidence: located hotels, then
 * located experiences, then — only when there is neither — one segment from the
 * place's own coordinates. Coordinates are never guessed; a booking with none
 * still gets no weather, which is the correct failure.
 *
 * Without the second and third source an attraction-ticket booking (Orlando,
 * no hotel) had no segments at all, so the whole "For your dates" tab never
 * appeared.
 */
function buildSegments(
  hotels: { lat?: number; lng?: number; city?: string; resort?: string; country?: string; countryCode?: string; checkIn: string; checkOut: string }[],
  experiences: { lat?: number; lng?: number; location?: string; title?: string; countryCode?: string; startDate?: string; endDate?: string }[],
  place: PlaceView | null,
  tripStart: string,
  tripEnd: string,
): Segment[] {
  const located = (hotels ?? [])
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number' && h.countryCode)
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

  const segs: Segment[] = [];
  for (const h of located) {
    const label = (h.city || h.resort || h.country || h.countryCode!).trim();
    const from = h.checkIn.slice(0, 10);
    const to = h.checkOut.slice(0, 10);
    const last = segs[segs.length - 1];
    if (last && last.label === label && last.countryCode === h.countryCode) {
      if (to > last.to) last.to = to; // extend the merged stay
    } else {
      segs.push({ lat: h.lat!, lng: h.lng!, countryCode: h.countryCode!, from, to, label });
    }
  }

  const hotelSegs = segs.length;

  const locatedExps = (experiences ?? [])
    .filter(
      (e) =>
        typeof e.lat === 'number' &&
        typeof e.lng === 'number' &&
        !!e.countryCode &&
        !!e.startDate,
    )
    .sort((a, b) => new Date(a.startDate!).getTime() - new Date(b.startDate!).getTime());

  for (const e of locatedExps) {
    const label = (e.location || e.title || e.countryCode!).trim();
    const from = e.startDate!.slice(0, 10);
    const to = (e.endDate || e.startDate!).slice(0, 10);

    const covered = segs.slice(0, hotelSegs).some(
      (s) =>
        segLabel(s.label) === segLabel(label) ||
        haversineKm(s.lat, s.lng, e.lat!, e.lng!) <= SEGMENT_MERGE_KM,
    );
    if (covered) continue;

    const last = segs[segs.length - 1];
    if (last && last.label === label && last.countryCode === e.countryCode) {
      if (to > last.to) last.to = to;
    } else {
      segs.push({ lat: e.lat!, lng: e.lng!, countryCode: e.countryCode!, from, to, label });
    }
  }

  if (segs.length) return segs;

  // Last resort: the place record's own coordinates. Real numbers from a real
  // Airtable row, spanning the whole trip — never an approximation of a city.
  if (place?.coords && place.code && tripStart && tripEnd) {
    return [
      {
        lat: place.coords.lat,
        lng: place.coords.lng,
        countryCode: place.code,
        from: tripStart.slice(0, 10),
        to: tripEnd.slice(0, 10),
        label: place.name,
      },
    ];
  }

  return [];
}

const MONTHS_LONG = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

function travelWindowLabel(fromIso?: string, toIso?: string): string {
  const from = fromIso ? new Date(fromIso) : null;
  if (!from || Number.isNaN(from.getTime())) return '';
  const to = toIso ? new Date(toIso) : null;
  const a = `${MONTHS_LONG[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
  if (!to || Number.isNaN(to.getTime())) return a;
  if (to.getUTCMonth() === from.getUTCMonth() && to.getUTCFullYear() === from.getUTCFullYear()) return a;
  const sameYear = to.getUTCFullYear() === from.getUTCFullYear();
  return `${sameYear ? MONTHS_LONG[from.getUTCMonth()] : a} – ${MONTHS_LONG[to.getUTCMonth()]} ${to.getUTCFullYear()}`;
}

/** Pick the Brain Q&A whose category matches a tab. */
function brainSectionFor(brain: BrainGuide | null, match: RegExp): BrainAnswer[] {
  if (!brain?.byCategory) return [];
  return brain.byCategory
    .filter((g) => match.test(g.category))
    .flatMap((g) => g.items);
}

function ForYourDates({
  fyd,
  fcdoStatus,
  conditions,
  travelLabel,
}: {
  fyd: BrainGuide['forYourDates'];
  fcdoStatus?: string;
  conditions: Conditions | null;
  travelLabel: string;
}) {
  const segments = conditions?.segments?.filter(
    (s) => s.weather || (s.holidays && s.holidays.holidays.length > 0),
  ) ?? [];
  const multi = segments.length > 1;

  return (
    <>
      {travelLabel && (
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-teal-dark dark:text-teal-light font-semibold mb-3">
          <IconClock size={12} />
          Travelling {travelLabel}
        </div>
      )}

      {/* Live weather + holidays, per stay location */}
      {segments.map((seg) => (
        <StaySegment key={`${seg.label}-${seg.from}`} seg={seg} showHeading={multi} />
      ))}

      {/* Verified Luna Brain seasonal guidance */}
      {fyd?.bestMonths && <InfoBlock title="Best time to visit" body={fyd.bestMonths} />}
      {fyd?.cheapestToFly && <InfoBlock title="When it's cheapest to fly" body={fyd.cheapestToFly} />}
      {fcdoStatus && <InfoBlock title="FCDO travel advice" body={fcdoStatus} />}
      {fyd && fyd.climate.length > 0 && <BrainSection title="Weather & seasons" answers={fyd.climate} />}
      {fyd && fyd.events.length > 0 && <BrainSection title="What's on" answers={fyd.events} />}
      {fyd && fyd.thingsToDo.length > 0 && <BrainSection title="Things to do" answers={fyd.thingsToDo} />}

      <p className="text-[11px] text-ink-3 italic mt-4">
        Weather and public holidays are drawn live and cross-checked across two
        independent sources; destination knowledge comes from Luna Brain, refreshed
        daily.
      </p>
    </>
  );
}

function StaySegment({ seg, showHeading }: { seg: CondSegment; showHeading: boolean }) {
  return (
    <div className="mt-3">
      {showHeading && (
        <div className="text-sm font-semibold text-ink mb-2 inline-flex items-center gap-1.5">
          <IconPin size={13} />
          {seg.label} · {fmtRange(seg.from, seg.to)}
        </div>
      )}
      {seg.weather && <WeatherBlock w={seg.weather} />}
      {seg.holidays && seg.holidays.holidays.length > 0 && <HolidaysBlock h={seg.holidays} />}
    </div>
  );
}

function WeatherBlock({ w }: { w: CondWeather }) {
  return (
    <div className="p-4 rounded-2xl bg-surface border border-line-light">
      <div className="flex items-center justify-between mb-1">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">Weather</div>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-dark dark:text-teal-light bg-teal/10 px-1.5 py-0.5 rounded">
          {w.mode === 'forecast' ? 'Forecast' : 'Typical'}
        </span>
      </div>
      <p className="text-sm font-medium text-ink">{w.summary}</p>
      {typeof w.seaTempC === 'number' && (
        <p className="text-sm text-ink-2 mt-0.5">Sea around {w.seaTempC}°C</p>
      )}

      {w.mode === 'forecast' && w.days && w.days.length > 0 && (
        <div className="flex gap-1.5 mt-3 overflow-x-auto scrollbar-none">
          {w.days.map((d) => (
            <div key={d.date} className="flex-shrink-0 w-14 text-center p-2 rounded-xl bg-surface-3">
              <div className="text-[10px] text-ink-3">{fmtDay(d.date)}</div>
              <div className="text-[13px] font-semibold text-ink mt-1">{d.maxC ?? '–'}°</div>
              <div className="text-[11px] text-ink-3">{d.minC ?? '–'}°</div>
              {typeof d.precipProb === 'number' && d.precipProb > 0 && (
                <div className="text-[10px] text-teal-dark dark:text-teal-light mt-0.5">{d.precipProb}%</div>
              )}
            </div>
          ))}
        </div>
      )}

      {w.note && <p className="text-[11px] text-ink-3 italic mt-2">{w.note}</p>}
      <div className="text-[10px] text-ink-3 mt-2">
        {w.sources.join(' + ')} · as of {fmtDate(w.asOf)}
      </div>
    </div>
  );
}

function HolidaysBlock({ h }: { h: CondHolidays }) {
  return (
    <div className="mt-2 p-4 rounded-2xl bg-surface border border-line-light">
      <div className="flex items-center justify-between mb-2">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">
          Holidays during your stay
        </div>
        {h.sourceCount >= 2 && (
          <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-dark dark:text-teal-light bg-teal/10 px-1.5 py-0.5 rounded">
            Verified ×2
          </span>
        )}
      </div>
      <div className="space-y-1.5">
        {h.holidays.map((hol) => (
          <div key={`${hol.date}-${hol.name}`} className="flex items-baseline gap-2">
            <span className="text-[11px] font-semibold text-ink w-12 flex-shrink-0">{fmtDayMonth(hol.date)}</span>
            <span className="text-sm text-ink-2">
              {hol.name}
              {hol.kind === 'observance' && (
                <span className="text-[10px] uppercase tracking-wider text-ink-3 ml-1.5">observance</span>
              )}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function InfoBlock({ title, body }: { title: string; body: string }) {
  return (
    <div className="mt-3 p-4 rounded-2xl bg-surface border border-line-light">
      <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3 mb-1">
        {title}
      </div>
      <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{body}</p>
    </div>
  );
}

function BrainSection({ title, answers }: { title: string; answers: BrainAnswer[] }) {
  if (!answers.length) return null;
  return (
    <div className="mt-6">
      <h3 className="text-base font-semibold text-ink mb-2 inline-flex items-center gap-2">
        {title}
        <span className="text-[10px] uppercase tracking-wider font-semibold text-teal-dark dark:text-teal-light bg-teal/10 px-1.5 py-0.5 rounded">
          Luna Brain
        </span>
      </h3>
      <div className="space-y-2">
        {answers.map((a) => (
          <BrainQA key={a.id} a={a} />
        ))}
      </div>
    </div>
  );
}

function BrainQA({ a }: { a: BrainAnswer }) {
  return (
    <details className="group p-3.5 rounded-2xl bg-surface border border-line-light">
      <summary className="cursor-pointer list-none text-sm font-semibold text-ink flex items-start justify-between gap-3">
        <span>{a.question}</span>
        <span className="text-ink-3 transition-transform group-open:rotate-180 shrink-0 mt-0.5">⌄</span>
      </summary>
      <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line mt-2">{a.answer}</p>
      {a.fcdoSensitive && (
        <p className="text-[11px] text-ink-3 italic mt-2">
          Entry/safety rules change — confirm against the latest FCDO advice before you travel.
        </p>
      )}
      <Provenance source={a.source} lastVerified={a.lastVerified} confidence={a.confidence} />
    </details>
  );
}

function Provenance({
  source,
  lastVerified,
  confidence,
}: {
  source?: string;
  lastVerified?: string;
  confidence?: string;
}) {
  if (!source && !lastVerified && !confidence) return null;
  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 mt-2 text-[10px] text-ink-3">
      {confidence && <span className="uppercase tracking-wider font-semibold">{confidence}</span>}
      {lastVerified && <span>· Verified {fmtDate(lastVerified)}</span>}
      {source && (
        <>
          <span>·</span>
          <a
            href={source}
            target="_blank"
            rel="noopener noreferrer"
            className="text-teal-dark dark:text-teal-light underline underline-offset-2"
          >
            Source
          </a>
        </>
      )}
    </div>
  );
}

function VerifiedChip({ lastVerified }: { lastVerified?: string }) {
  return (
    <p className="text-[10px] text-ink-3 mt-3">
      Verified facts from Luna Brain{lastVerified ? ` · updated ${fmtDate(lastVerified)}` : ''}
    </p>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function fmtDayMonth(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

function fmtDay(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { weekday: 'short' });
}

function fmtRange(from: string, to: string): string {
  const a = new Date(from);
  const b = new Date(to);
  if (Number.isNaN(a.getTime()) || Number.isNaN(b.getTime())) return '';
  const sameMonth = a.getUTCMonth() === b.getUTCMonth();
  const aStr = a.toLocaleDateString('en-GB', { day: 'numeric', month: sameMonth ? undefined : 'short' });
  const bStr = b.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
  return `${aStr}–${bStr}`;
}
