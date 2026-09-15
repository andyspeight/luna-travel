'use client';

/**
 * Presentational blocks for Travelgenix destination content. No fetching, no
 * hooks beyond i18n — the caller owns the data.
 *
 * Deliberately NOT routed through BrainSection/Provenance on the destination
 * page: that pair stamps a "Luna Brain" chip and expects Confidence / Last
 * Verified / Source, none of which the Destination Content base carries for
 * prose. Labelling editorial copy as verified is worse than labelling it not
 * at all.
 *
 * Content stacks by tier, so a block can be answering with Florida's words on
 * an Orlando page. Wherever that is possible the place that authored the words
 * is named, and every block hides itself when it has nothing.
 */

import { useI18n } from '@/lib/locale-context';
import type { Locale } from '@/lib/i18n';
import { climateForTrip } from '@/lib/destination-dates';
import type { EventWindow } from '@/lib/destination-dates';
import { HighlightIconGlyph } from '@/components/place-icons';
import type {
  ClimateBand,
  Highlight,
  PlaceEvent,
  PlaceSection,
  PlaceSectionKey,
  PlaceTier,
  PlaceView,
} from '@/types/destination-content';

const TIER_RANK: Record<PlaceTier, number> = { resort: 0, city: 1, country: 2 };

function mostSpecific(tiers: PlaceTier[]): PlaceTier | null {
  let best: PlaceTier | null = null;
  for (const tier of tiers) {
    if (!best || TIER_RANK[tier] < TIER_RANK[best]) best = tier;
  }
  return best;
}

/** A row in FactGrid/FactRows. `from` + `tier` are optional so the same
 *  components render Luna Brain and static-guide values, which have no tier. */
export interface PlaceFactRow {
  icon?: React.ReactNode;
  label: string;
  value?: string;
  /** Display name of the place that supplied the value, e.g. "Florida". */
  from?: string;
  tier?: PlaceTier;
}

function TierLabel({ tier, from }: { tier: PlaceTier; from: string }) {
  const { t } = useI18n();
  if (!from) return null;
  const key = tier === 'country' ? 'place.acrossX' : 'place.inOrlando';
  return (
    <span className="text-[10px] uppercase tracking-wider text-ink-3">
      {t(key, { place: from })}
    </span>
  );
}

// ───────── Highlights ─────────

export function HighlightGrid({ highlights }: { highlights: Highlight[] }) {
  const { t } = useI18n();
  const list = (highlights ?? []).filter((h) => h && h.title);
  if (!list.length) return null;
  const closest = mostSpecific(list.map((h) => h.tier));

  return (
    <div className="mt-5">
      <h2 className="text-base font-semibold text-ink mb-2">{t('place.highlights')}</h2>
      <div className="grid grid-cols-2 gap-2">
        {list.map((h) => (
          <div
            key={`${h.tier}-${h.title}`}
            className="p-3 rounded-xl bg-surface border border-line-light"
          >
            {h.icon && (
              <div className="w-7 h-7 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center mb-2">
                <HighlightIconGlyph icon={h.icon} size={15} />
              </div>
            )}
            <div className="text-[13px] font-semibold text-ink leading-snug">{h.title}</div>
            {h.description && (
              <p className="text-xs text-ink-2 leading-relaxed mt-1">{h.description}</p>
            )}
            {closest && h.tier !== closest && (
              <div className="mt-1.5">
                <TierLabel tier={h.tier} from={h.from} />
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ───────── Stacked prose ─────────

/** The most specific tier's body expanded, every broader tier behind a labelled
 *  <details>. Travelgenix wrote Florida's Overview as well as Orlando's and both
 *  are worth reading, but only one of them can open by default. */
export function ProseStack({
  sections,
  sectionKey,
  title,
}: {
  sections: PlaceSection[];
  sectionKey: PlaceSectionKey | PlaceSectionKey[];
  /** Omitted for the lead paragraph of a page, which carries no heading. */
  title?: string;
}) {
  const keys = Array.isArray(sectionKey) ? sectionKey : [sectionKey];
  const all = sections ?? [];
  const matching = all.filter((s) => s && s.body && keys.includes(s.key));
  if (!matching.length) return null;

  const [lead, ...rest] = matching;
  // Measured against the whole payload, not just this block: a country-tier
  // Overview on a resort page needs naming even when it is the only one here.
  const closest = mostSpecific(all.map((s) => s.tier));

  return (
    <div className="mt-5 first:mt-0">
      {title && <h2 className="text-base font-semibold text-ink mb-2">{title}</h2>}
      {closest && lead.tier !== closest && (
        <div className="mb-1.5">
          <TierLabel tier={lead.tier} from={lead.from} />
        </div>
      )}
      <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{lead.body}</p>
      {rest.map((s) => (
        <details
          key={`${s.tier}-${s.from}`}
          className="group mt-2 p-3.5 rounded-2xl bg-surface border border-line-light"
        >
          <summary className="cursor-pointer list-none text-sm font-semibold text-ink flex items-start justify-between gap-3">
            <TierLabel tier={s.tier} from={s.from} />
            <span className="text-ink-3 transition-transform group-open:rotate-180 shrink-0">⌄</span>
          </summary>
          <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line mt-2">{s.body}</p>
        </details>
      ))}
    </div>
  );
}

// ───────── Facts ─────────

function labelledRows(facts: PlaceFactRow[]) {
  const rows = (facts ?? []).filter((f) => f && f.label && f.value);
  const closest = mostSpecific(rows.map((f) => f.tier).filter((t): t is PlaceTier => !!t));
  return { rows, closest };
}

export function FactGrid({ facts }: { facts: PlaceFactRow[] }) {
  const { rows, closest } = labelledRows(facts);
  if (!rows.length) return null;
  return (
    <div className="grid grid-cols-2 gap-2 mt-5">
      {rows.map((f) => (
        <div key={f.label} className="p-3 rounded-xl bg-surface border border-line-light">
          {f.icon && (
            <div className="w-7 h-7 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center mb-2">
              {f.icon}
            </div>
          )}
          <div className="text-[10px] uppercase tracking-wider text-ink-3 mb-0.5">{f.label}</div>
          <div className="text-[13px] font-semibold text-ink leading-snug">{f.value}</div>
          {f.tier && closest && f.tier !== closest && f.from && (
            <div className="mt-1">
              <TierLabel tier={f.tier} from={f.from} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function FactRows({ facts }: { facts: PlaceFactRow[] }) {
  const { rows, closest } = labelledRows(facts);
  if (!rows.length) return null;
  return (
    <div className="space-y-2">
      {rows.map((f) => (
        <div
          key={f.label}
          className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface border border-line-light"
        >
          {f.icon && (
            <span className="w-8 h-8 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
              {f.icon}
            </span>
          )}
          <div className="flex-1 min-w-0">
            <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">
              {f.label}
            </div>
            <div className="text-sm font-medium text-ink mt-0.5 whitespace-pre-line">{f.value}</div>
            {f.tier && closest && f.tier !== closest && f.from && (
              <div className="mt-0.5">
                <TierLabel tier={f.tier} from={f.from} />
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

// ───────── Climate ─────────

const MONTHS_SHORT = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

const SEASON_LABEL: Record<'best' | 'shoulder' | 'off', string> = {
  best: 'Best',
  shoulder: 'Shoulder',
  off: 'Quiet',
};

/** Typical weather for the months the trip touches. Hidden below six populated
 *  months in the band: a half-imported row reads as missing data rather than
 *  seasonality, and this strip sits next to a live forecast that is genuinely
 *  complete. */
export function ClimateStrip({
  climate,
  tripStart,
  tripEnd,
}: {
  climate?: ClimateBand;
  tripStart?: string;
  tripEnd?: string;
}) {
  const { t } = useI18n();
  if (!climate) return null;

  let populated = 0;
  for (let m = 0; m < 12; m += 1) {
    const hasAny =
      typeof climate.tempC?.[m] === 'number' ||
      typeof climate.rainfallMm?.[m] === 'number' ||
      !!climate.season?.[m];
    if (hasAny) populated += 1;
  }
  if (populated < 6) return null;

  const slices = climateForTrip(climate, tripStart, tripEnd);
  if (!slices.length) return null;

  return (
    <div className="mt-5">
      <h2 className="text-base font-semibold text-ink mb-2">{t('place.climate')}</h2>
      <div className="flex gap-1.5 overflow-x-auto scrollbar-none">
        {slices.map((s) => (
          <div
            key={s.month}
            className="flex-shrink-0 w-16 text-center p-2 rounded-xl bg-surface border border-line-light"
          >
            <div className="text-[10px] uppercase tracking-wider text-ink-3">
              {MONTHS_SHORT[s.month]}
            </div>
            {typeof s.tempC === 'number' && (
              <div className="text-[13px] font-semibold text-ink mt-1">{s.tempC}°</div>
            )}
            {typeof s.rainfallMm === 'number' && (
              <div className="text-[11px] text-ink-3">{s.rainfallMm}mm</div>
            )}
            {s.season && (
              <div className="text-[10px] text-teal-dark dark:text-teal-light mt-0.5">
                {SEASON_LABEL[s.season]}
              </div>
            )}
          </div>
        ))}
      </div>
      {climate.from && (
        <div className="mt-1.5">
          <TierLabel tier={climate.tier} from={climate.from} />
        </div>
      )}
    </div>
  );
}

// ───────── Events ─────────

/** The one event renderer, shared with the home-screen "What's on" section.
 *  The source carries no year, so the raw month token is the only date string
 *  that ever appears — never a constructed date, never a time, and nothing that
 *  could read as a booked item on the traveller's own itinerary. */
export function EventList({
  events,
  variant = 'window',
}: {
  events: Array<PlaceEvent & { window?: EventWindow }>;
  variant?: 'window' | 'yearRound';
}) {
  const list = (events ?? []).filter((e) => e && e.name);
  if (!list.length) return null;

  return (
    <div className="space-y-2">
      {list.map((e) => (
        <div
          key={`${e.tier}-${e.name}`}
          className={[
            'p-3.5 rounded-2xl border border-line-light',
            variant === 'yearRound' ? 'bg-surface-3' : 'bg-surface',
          ].join(' ')}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="text-sm font-semibold text-ink">{e.name}</div>
            {e.monthLabel && (
              <span className="text-[10px] uppercase tracking-wider font-semibold text-ink-3 bg-surface-3 px-1.5 py-0.5 rounded flex-shrink-0">
                {e.monthLabel}
              </span>
            )}
          </div>
          {e.description && (
            <p className="text-sm text-ink-2 leading-relaxed mt-1">{e.description}</p>
          )}
          {e.from && (
            <div className="mt-1">
              <TierLabel tier={e.tier} from={e.from} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/** Six-locale copy for the one heading src/lib/i18n.ts does not carry yet.
 *
 * WHY it lives here: undated events need a heading that makes NO date claim,
 * and the shared table has no such key. i18n.ts is owned by another unit, so
 * the strings sit next to the only block that renders them rather than being
 * smuggled into a file this unit must not touch.
 *
 * The lookup asks the SHARED table first and only falls back here — translate()
 * echoes the key back for a row it does not have — so the moment
 * 'whatson.datesVary' is promoted into i18n.ts these locals go quiet with no
 * edit to this file.
 */
const LOCAL_COPY: Record<string, Record<Locale, string>> = {
  'whatson.datesVary': {
    en: 'Dates vary',
    ro: 'Datele variază',
    fr: 'Dates variables',
    de: 'Termine variieren',
    es: 'Fechas variables',
    it: 'Date variabili',
  },
};

function useEventCopy() {
  const { t, locale } = useI18n();
  return (key: string) => {
    const shared = t(key);
    if (shared !== key) return shared;
    const row = LOCAL_COPY[key];
    return row ? (row[locale] ?? row.en) : key;
  };
}

/** One heading + one EventList, either open or behind a <details>.
 *
 * The home screen sits directly under the traveller's own confirmed itinerary,
 * so its secondary event buckets stay collapsed; the destination page has a
 * whole tab and shows them open. Same rows, same muted treatment, one renderer
 * — a second copy is how the two surfaces drifted apart the first time. */
function EventBlock({
  title,
  events,
  collapsible,
}: {
  title: string;
  events: PlaceEvent[];
  collapsible?: boolean;
}) {
  const list = (events ?? []).filter((e) => e && e.name);
  if (!list.length) return null;

  if (collapsible) {
    return (
      <details className="group mt-2 p-3.5 rounded-2xl bg-surface-3 border border-line-light">
        <summary className="cursor-pointer list-none text-sm font-semibold text-ink flex items-center justify-between gap-3">
          <span>{title}</span>
          <span className="text-ink-3 transition-transform group-open:rotate-180 shrink-0">⌄</span>
        </summary>
        <div className="mt-2">
          <EventList events={list} variant="yearRound" />
        </div>
      </details>
    );
  }

  return (
    <div className="mt-5">
      <h2 className="text-base font-semibold text-ink mb-2">{title}</h2>
      <EventList events={list} variant="yearRound" />
    </div>
  );
}

/** `splitEvents().otherTimes` — events whose month we READ, which simply do not
 * fall in the traveller's dates — under a NEUTRAL heading.
 *
 * The old heading ("{place} through the year") was a positive claim the source
 * never makes: the Events JSON carries a token like "Feb", not a run length, so
 * a February carnival on a July trip was announced as year-round with a
 * contradicting "Feb" chip beside it. 'whatson.otherTimes' says only what we
 * know — not while you are there.
 *
 * Pass `otherTimes`, never `yearRound`: that alias is deprecated, and on the
 * destination page it was still being fed to the old heading.
 */
export function OtherTimesEvents({
  events,
  collapsible,
}: {
  events: PlaceEvent[];
  collapsible?: boolean;
}) {
  const t = useEventCopy();
  return <EventBlock title={t('whatson.otherTimes')} events={events} collapsible={collapsible} />;
}

/** `splitEvents().undated` — events whose month token could not be read at all
 * ("Easter", "Late summer", "Varies").
 *
 * These have to go somewhere. Filing them under "Other times of year" would
 * assert the one fact they are missing (Easter can fall inside a late-March
 * trip), and dropping them made them vanish from the app entirely. So they get
 * their own block under a heading that claims no date at all, with the raw
 * token still shown as the chip, exactly as the source wrote it.
 */
export function UndatedEvents({
  events,
  collapsible,
}: {
  events: PlaceEvent[];
  collapsible?: boolean;
}) {
  const t = useEventCopy();
  return <EventBlock title={t('whatson.datesVary')} events={events} collapsible={collapsible} />;
}

// ───────── Attribution ─────────

/** Photographer credits from the payload plus the Travelgenix line. The base
 *  carries no Source/Confidence/Last Verified for prose, so nothing here may
 *  imply the copy was verified. */
export function PlaceCredit({ place }: { place: PlaceView | null }) {
  const { t } = useI18n();
  if (!place) return null;

  const credits: string[] = [];
  for (const img of place.images ?? []) {
    const a = (img?.attribution || '').trim();
    if (a && !credits.includes(a)) credits.push(a);
  }

  return (
    <p className="text-[10px] text-ink-3 mt-4">
      {t('place.credit')}
      {credits.length > 0 && ` · ${credits.join(' · ')}`}
    </p>
  );
}
