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

const STATIC_TABS = ['Overview', 'Essentials', 'Visa & safety', 'Insider tips'] as const;

export default function DestinationGuidePage() {
  const { booking } = useBooking();
  const guide = getDestinationGuide(booking.primaryCountryCode);
  const hero = destinationHero(booking.primaryCountryCode);
  const [brain, setBrain] = useState<BrainGuide | null>(null);
  const [conditions, setConditions] = useState<Conditions | null>(null);
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

  // Pull the live weather + holidays layer, one segment per stay location
  // (consecutive stays in the same place are merged). Additive + graceful.
  useEffect(() => {
    let alive = true;
    const segments = buildSegments(booking.hotels);
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
  }, [booking.reference, booking.hotels]);

  const hasConditions = !!conditions?.segments?.some(
    (s) => s.weather || (s.holidays && s.holidays.holidays.length > 0),
  );
  const hasForYourDates = !!brain?.forYourDates || hasConditions;
  const tabs = useMemo<string[]>(() => {
    if (!hasForYourDates) return [...STATIC_TABS];
    return ['Overview', 'For your dates', 'Essentials', 'Visa & safety', 'Insider tips'];
  }, [hasForYourDates]);

  const essentialsQA = brainSectionFor(brain, /money|getting (around|there)|culture|practical/i);
  const visaQA = brainSectionFor(brain, /entry|visa|health|safety/i);
  const travelLabel = brain?.forYourDates?.travelLabel || travelWindowLabel(booking.tripStart, booking.tripEnd);

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

          {tab === 'For your dates' && (
            <ForYourDates
              fyd={brain?.forYourDates ?? null}
              fcdoStatus={brain?.destination?.fcdoStatus}
              conditions={conditions}
              travelLabel={travelLabel}
            />
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

/** Build one conditions segment per stay location, merging consecutive stays in
 *  the same place. Only hotels with real coordinates are used (never guessed). */
function buildSegments(
  hotels: { lat?: number; lng?: number; city?: string; resort?: string; country?: string; countryCode?: string; checkIn: string; checkOut: string }[],
): { lat: number; lng: number; countryCode: string; from: string; to: string; label: string }[] {
  const located = hotels
    .filter((h) => typeof h.lat === 'number' && typeof h.lng === 'number' && h.countryCode)
    .sort((a, b) => new Date(a.checkIn).getTime() - new Date(b.checkIn).getTime());

  const segs: { lat: number; lng: number; countryCode: string; from: string; to: string; label: string }[] = [];
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
  return segs;
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
