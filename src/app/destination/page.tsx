'use client';

import { useEffect, useMemo, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import {
  IconCoin,
  IconClock,
  IconInfo,
  IconWarning,
  IconShield,
  IconPin,
} from '@/components/icons';
import { destinationHero } from '@/lib/hero';
import { getDestinationGuide } from '@/data/destinations';

// ───────── Luna Brain shapes (mirror src/lib/luna-brain.ts) ─────────

interface BrainAnswer {
  id: string;
  question: string;
  answer: string;
  category: string;
  confidence?: string;
  source?: string;
  seasonal: boolean;
  fcdoSensitive: boolean;
  lastVerified?: string;
}

interface BrainGuide {
  configured: boolean;
  destination?: {
    name: string;
    currency?: string;
    capital?: string;
    languages?: string;
    timeZone?: string;
    emergencyNumber?: string;
    drivingSide?: string;
    plugType?: string;
    voltage?: string;
    ukVisaRequired?: string;
    tapWaterSafe?: string;
    fcdoStatus?: string;
    bestMonths?: string;
    cheapestToFly?: string;
    vaccinations?: string;
    lastVerified?: string;
  } | null;
  byCategory?: { category: string; items: BrainAnswer[] }[];
  forYourDates?: {
    travelLabel: string;
    bestMonths?: string;
    cheapestToFly?: string;
    climate: BrainAnswer[];
    events: BrainAnswer[];
    thingsToDo: BrainAnswer[];
  } | null;
}

const STATIC_TABS = ['Overview', 'Essentials', 'Visa & safety', 'Insider tips'] as const;

export default function DestinationGuidePage() {
  const { booking } = useBooking();
  const guide = getDestinationGuide(booking.primaryCountryCode);
  const hero = destinationHero(booking.primaryCountryCode);
  const [brain, setBrain] = useState<BrainGuide | null>(null);
  const [tab, setTab] = useState<string>('Overview');

  // Pull the verified Luna Brain layer for this booking's destination + dates.
  // Additive: any failure (offline, no key) simply leaves the static guide.
  useEffect(() => {
    let alive = true;
    const labelParts = booking.destinationLabel.split(/[&,/]+/);
    const tokens = Array.from(
      new Set(
        [
          ...labelParts,
          ...booking.hotels.map((h) => h.city),
          ...booking.hotels.map((h) => h.resort || ''),
        ]
          .map((s) => s.trim())
          .filter(Boolean),
      ),
    ).join(',');

    const qs = new URLSearchParams({
      cc: booking.primaryCountryCode,
      tokens,
      from: booking.tripStart,
      to: booking.tripEnd,
    });
    fetch(`/api/traveller/destination?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BrainGuide | null) => {
        if (alive && data && data.configured) setBrain(data);
      })
      .catch(() => {
        /* ignore — static guide stands */
      });
    return () => {
      alive = false;
    };
  }, [booking.primaryCountryCode, booking.destinationLabel, booking.tripStart, booking.tripEnd, booking.hotels]);

  const hasDates = !!brain?.forYourDates;
  const tabs = useMemo<string[]>(() => {
    if (!hasDates) return [...STATIC_TABS];
    return ['Overview', 'For your dates', 'Essentials', 'Visa & safety', 'Insider tips'];
  }, [hasDates]);

  const essentialsQA = brainSectionFor(brain, /money|getting (around|there)|culture|practical/i);
  const visaQA = brainSectionFor(brain, /entry|visa|health|safety/i);

  if (!guide) {
    return (
      <>
        <NavBar title="Destination" backLabel="Trip" />
        <PageEnter>
          <main className="px-5 pt-12 text-center">
            <p className="text-ink-2">
              Destination guide for {booking.destinationLabel} is coming soon.
            </p>
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
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: hero.glow }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
            }}
          />
          <div className="relative">
            <NavBar title=" " backLabel="Trip" variant="dark" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 z-10">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/85 inline-flex items-center gap-1.5 mb-2">
              <IconPin size={12} />
              {guide.region}
            </div>
            <h1 className="font-serif text-[40px] leading-none tracking-tight">
              <em>{guide.name}</em>
            </h1>
            <p className="text-sm text-white/85 mt-1.5">{guide.weatherSummary}</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="sticky top-0 z-20 bg-surface border-b border-line-light">
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-none">
            {tabs.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                  tab === t
                    ? 'bg-navy text-white dark:bg-teal dark:text-navy-dark'
                    : 'bg-surface-3 text-ink-2 hover:text-ink',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4">
          {tab === 'Overview' && (
            <>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.introduction}
              </p>
              <h2 className="text-base font-semibold text-ink mt-5 mb-2">
                Why we love it
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.whyWeLoveIt}
              </p>

              {/* Quick facts */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Fact icon={<IconCoin size={14} />} label="Currency" value={brain?.destination?.currency || guide.currency} />
                <Fact icon={<IconClock size={14} />} label="Time zone" value={brain?.destination?.timeZone || guide.timeZone} />
                <Fact
                  icon={<IconInfo size={14} />}
                  label="Languages"
                  value={brain?.destination?.languages || guide.languages.join(' · ')}
                />
                <Fact icon={<IconInfo size={14} />} label="Weather" value={guide.weatherSummary} />
              </div>

              {brain?.destination && <VerifiedChip lastVerified={brain.destination.lastVerified} />}
            </>
          )}

          {tab === 'For your dates' && brain?.forYourDates && (
            <ForYourDates fyd={brain.forYourDates} fcdoStatus={brain.destination?.fcdoStatus} />
          )}

          {tab === 'Essentials' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2">
                The basics
              </h2>
              <div className="space-y-2">
                <EssentialRow icon={<IconCoin size={14} />} label="Currency" value={brain?.destination?.currency || guide.currency} />
                <EssentialRow icon={<IconClock size={14} />} label="Time zone" value={brain?.destination?.timeZone || guide.timeZone} />
                <EssentialRow icon={<IconInfo size={14} />} label="Languages" value={brain?.destination?.languages || guide.languages.join(', ')} />
                <EssentialRow icon={<IconInfo size={14} />} label="Weather" value={guide.weatherSummary} />
                {(brain?.destination?.plugType || brain?.destination?.voltage) && (
                  <EssentialRow icon={<IconInfo size={14} />} label="Power" value={[brain.destination.plugType, brain.destination.voltage].filter(Boolean).join(' · ')} />
                )}
                {brain?.destination?.tapWaterSafe && (
                  <EssentialRow icon={<IconInfo size={14} />} label="Tap water" value={brain.destination.tapWaterSafe} />
                )}
                {brain?.destination?.drivingSide && (
                  <EssentialRow icon={<IconInfo size={14} />} label="Driving" value={brain.destination.drivingSide} />
                )}
                {(brain?.destination?.emergencyNumber || guide.emergencyNumber) && (
                  <EssentialRow icon={<IconWarning size={14} />} label="Emergency" value={brain?.destination?.emergencyNumber || guide.emergencyNumber!} />
                )}
              </div>

              <BrainSection title="Good to know" answers={essentialsQA} />
            </>
          )}

          {tab === 'Visa & safety' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2 inline-flex items-center gap-1.5">
                <IconShield size={16} />
                Entry requirements
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.visaSummary}
              </p>

              {guide.emergencyNumber && (
                <>
                  <h2 className="text-base font-semibold text-ink mt-5 mb-2 inline-flex items-center gap-1.5">
                    <IconWarning size={16} />
                    In case of emergency
                  </h2>
                  <div className="p-4 rounded-2xl bg-danger/5 border border-danger/15">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-danger mb-1">
                      Emergency number
                    </div>
                    <a
                      href={`tel:${(brain?.destination?.emergencyNumber || guide.emergencyNumber).replace(/[^\d+]/g, '')}`}
                      className="text-base font-semibold text-ink"
                    >
                      {brain?.destination?.emergencyNumber || guide.emergencyNumber}
                    </a>
                  </div>
                </>
              )}

              <BrainSection title="Verified answers" answers={visaQA} />

              <p className="text-[11px] text-ink-3 italic mt-4">
                Always check the latest FCDO travel advice before you travel.
                Your agent can confirm specifics.
              </p>
            </>
          )}

          {tab === 'Insider tips' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2">
                What we&rsquo;d tell a friend
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.insiderTips}
              </p>
            </>
          )}
        </div>
      </main>
    </PageEnter>
  );
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
}: {
  fyd: NonNullable<BrainGuide['forYourDates']>;
  fcdoStatus?: string;
}) {
  return (
    <>
      {fyd.travelLabel && (
        <div className="inline-flex items-center gap-1.5 text-[11px] uppercase tracking-[0.16em] text-teal-dark dark:text-teal-light font-semibold mb-3">
          <IconClock size={12} />
          Travelling {fyd.travelLabel}
        </div>
      )}

      {fyd.bestMonths && (
        <InfoBlock title="Best time to visit" body={fyd.bestMonths} />
      )}
      {fyd.cheapestToFly && (
        <InfoBlock title="When it's cheapest to fly" body={fyd.cheapestToFly} />
      )}
      {fcdoStatus && (
        <InfoBlock title="FCDO travel advice" body={fcdoStatus} />
      )}

      {fyd.climate.length > 0 && (
        <BrainSection title="Weather & seasons" answers={fyd.climate} />
      )}
      {fyd.events.length > 0 && (
        <BrainSection title="What's on" answers={fyd.events} />
      )}
      {fyd.thingsToDo.length > 0 && (
        <BrainSection title="Things to do" answers={fyd.thingsToDo} />
      )}

      <BrainProvenanceFooter />
    </>
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

function BrainProvenanceFooter() {
  return (
    <p className="text-[11px] text-ink-3 italic mt-4">
      Drawn live from Luna Brain — Travelgenix&rsquo;s verified destination knowledge,
      refreshed daily. Live weather for your exact dates is coming soon.
    </p>
  );
}

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-surface border border-line-light">
      <div className="w-7 h-7 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center mb-2">
        {icon}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3 mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold text-ink leading-snug">{value}</div>
    </div>
  );
}

function EssentialRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface border border-line-light">
      <span className="w-8 h-8 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">
          {label}
        </div>
        <div className="text-sm font-medium text-ink mt-0.5">{value}</div>
      </div>
    </div>
  );
}
