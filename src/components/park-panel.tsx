'use client';

/**
 * Theme-park guide for an attraction ticket the matcher was confident about,
 * plus the "also in the area" list for the parks it was not.
 *
 * Price Band is editorial guidance copy ("Premium (£200–£400)"), not a bookable
 * rate. src/data/inspirations.ts:13-15 reserves "from" pricing for marketing the
 * agency set, so it renders here as a plain labelled row and never as a price
 * chip — a traveller must not read it as what their ticket cost.
 *
 * There is no park photograph to reach for: the destination-heroes bucket is
 * keyed {COUNTRY}/{locationSlug} and holds nothing for parks, and none of the
 * Theme Parks table's url fields were name-resolved, so no Airtable image is
 * assumed. The banner uses the supplier photo the experience already carries,
 * then a gradient.
 */

import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useI18n } from '@/lib/locale-context';
import { ActionButton } from '@/components/action-button';
import { formatDate } from '@/lib/format';
import {
  IconTicket,
  IconStar,
  IconSparkle,
  IconChevR,
  IconExternal,
} from '@/components/icons';
import { haversineKm, MAX_PARK_MATCH_KM } from '@/lib/park-match';
import type { ParkRecord, PlaceView } from '@/types/destination-content';

const PARK_GRADIENT = 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)';

/** Official Website is free text an editor typed into Airtable and the adapter
 *  passes it through untouched, so anything that is not http(s) is dropped
 *  rather than handed to the browser as an href. */
function httpUrl(raw: string | undefined): string {
  if (!raw) return '';
  try {
    const u = new URL(raw.trim());
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.href : '';
  } catch {
    return '';
  }
}

/** Multiline Airtable prose to display lines. Bullet glyphs the author typed
 *  are stripped; nothing is added, reordered or re-punctuated. */
function parkLines(raw: string | undefined): string[] {
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((l) => l.replace(/^\s*[-–—•*]\s*/, '').trim())
    .filter(Boolean);
}

export function ParkPanel({
  park,
  href,
  image,
}: {
  park: ParkRecord;
  href: string;
  /** experience.photos[0] where the supplier sent one. */
  image?: string;
}) {
  const { t } = useI18n();
  const router = useRouter();

  const stars = parkLines(park.starAttractions).slice(0, 3);
  const tips = parkLines(park.quirksAndInsiderTips).slice(0, 2);

  return (
    <section className="bg-surface border border-line-light rounded-2xl overflow-hidden">
      <div className="relative h-28 text-white" style={{ background: PARK_GRADIENT }}>
        {image && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `center/cover no-repeat url("${image}")` }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.15) 0%, transparent 35%, rgba(15,23,42,0.80) 100%)',
          }}
        />
        <div className="relative h-full p-4 flex flex-col justify-end">
          <span className="inline-flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider opacity-90">
            <IconTicket size={12} />
            {t('park.section')}
          </span>
          <h3 className="font-serif text-xl leading-tight mt-0.5 drop-shadow-sm">{park.name}</h3>
          {park.tagline && <p className="text-[13px] opacity-90 mt-0.5 leading-snug">{park.tagline}</p>}
        </div>
      </div>

      <div className="p-4 space-y-3">
        <ul className="divide-y divide-line-light text-sm">
          {park.daysNeeded && <Row label={t('park.days')} value={park.daysNeeded} />}
          {park.bestTimeToVisit && <Row label={t('place.bestTime')} value={park.bestTimeToVisit} />}
          {/* Affirmative only. `hasOnSiteHotels` is false both for a park that
              genuinely has none AND for one whose Airtable row was never filled
              in (the adapter coerces with `?? !!onSiteHotels`), so a rendered
              "No" would turn missing data into a fact a family plans around.
              Every other row here hides when absent; this one now does too. */}
          {park.hasOnSiteHotels === true && (
            <Row label={t('park.hotels')} value={t('common.yes')} />
          )}
          {/* Guidance copy, deliberately a row and not a "from" price chip. */}
          {park.priceBand && <Row label={t('park.priceGuide')} value={park.priceBand} />}
        </ul>

        {park.bestFor.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {park.bestFor.map((b) => (
              <span
                key={b}
                className="text-[11px] font-medium text-teal-dark dark:text-teal-light bg-teal/10 px-2 py-0.5 rounded-full"
              >
                {b}
              </span>
            ))}
          </div>
        )}

        {stars.length > 0 && (
          <Block title={t('park.stars')} icon={<IconStar size={13} />} lines={stars} />
        )}

        {tips.length > 0 && (
          <Block title={t('park.tips')} icon={<IconSparkle size={13} />} lines={tips} />
        )}

        <ActionButton
          variant="secondary"
          icon={<IconChevR size={18} />}
          onClick={() => router.push(href)}
        >
          {t('park.full')}
        </ActionButton>

        <ParkAttribution park={park} />
      </div>
    </section>
  );
}

/** "Theme parks in the area" makes a SPATIAL claim; the join behind the list
 *  does not. Parks are joined to a place offline, and at the country tier that
 *  join says nothing about distance — every GB park hangs off the single United
 *  Kingdom row, so an unfiltered list told a Cornwall booking that Alton Towers,
 *  Blackpool and Flamingo Land (up to ~600 km away) were nearby. The 40 km
 *  coordinate veto in park-match.ts only ever guarded the MATCHED panel.
 *
 *  So: real coordinates on both sides, a real distance, or nothing.
 *  - a park with no coordinates is dropped rather than kept on trust;
 *  - the origin must be at least as specific as a city. When a booking resolves
 *    no further than its country, place.coords is a country centroid and a
 *    circle drawn round it describes nobody's trip, so the block hides. That
 *    also drops country-tier joins for every booking more specific than the
 *    country, which is the other half of the same bug. */
const NEARBY_PARK_KM = MAX_PARK_MATCH_KM;

function nearbyParksFor(
  parks: ParkRecord[],
  place: PlaceView | null | undefined,
): ParkRecord[] {
  const origin = place?.coords;
  if (!origin || origin.tier === 'country') return [];
  return parks.filter(
    (p) =>
      typeof p.lat === 'number' &&
      typeof p.lng === 'number' &&
      haversineKm(origin.lat, origin.lng, p.lat, p.lng) <= NEARBY_PARK_KM,
  );
}

/** The parks the matcher would not attach to a ticket. Shown so they are not
 *  lost, never framed as the traveller's own park — and only when they are
 *  genuinely in the area. */
export function NearbyParks({
  parks,
  place,
}: {
  parks: ParkRecord[];
  /** The resolved place. Without it there is no origin, so no spatial claim. */
  place: PlaceView | null | undefined;
}) {
  const { t } = useI18n();
  const near = nearbyParksFor(parks, place);
  if (!near.length) return null;

  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
        <IconTicket size={14} />
        {t('park.nearby')}
      </h3>
      <ul className="divide-y divide-line-light">
        {near.map((p) => (
          <li key={p.id}>
            <Link
              href={`/park/${p.slug}`}
              className="flex items-center gap-3 py-2.5 tap"
            >
              <span className="flex-1 min-w-0">
                <span className="block text-sm font-semibold text-ink leading-snug">{p.name}</span>
                {(p.tagline || p.locationText) && (
                  <span className="block text-xs text-ink-2 mt-0.5 truncate">
                    {p.tagline || p.locationText}
                  </span>
                )}
              </span>
              <span className="flex-none text-ink-3">
                <IconChevR size={16} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Verified Date and Official Website — the only provenance this base carries. */
export function ParkAttribution({ park }: { park: ParkRecord }) {
  const { t } = useI18n();
  const verified = park.verifiedDate
    ? formatDate(park.verifiedDate, { day: 'numeric', month: 'long', year: 'numeric' })
    : '';
  const site = httpUrl(park.officialWebsite);
  if (!verified && !site) return null;

  return (
    <p className="text-[11px] text-ink-3 leading-relaxed">
      {verified && <span>{t('park.verifiedOn', { date: verified })}</span>}
      {verified && site && <span aria-hidden> · </span>}
      {site && (
        <a
          href={site}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-teal-dark dark:text-teal-light hover:underline"
        >
          {t('park.official')}
          <IconExternal size={11} />
        </a>
      )}
    </p>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <li className="py-2.5 flex justify-between gap-3">
      <span className="text-ink-2">{label}</span>
      <span className="text-ink font-medium text-right">{value}</span>
    </li>
  );
}

function Block({
  title,
  icon,
  lines,
}: {
  title: string;
  icon: React.ReactNode;
  lines: string[];
}) {
  return (
    <div>
      <h4 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5">
        {icon}
        {title}
      </h4>
      <ul className="space-y-1">
        {lines.map((l, i) => (
          <li key={i} className="text-sm text-ink-2 leading-relaxed flex gap-2">
            <span aria-hidden className="text-ink-3 flex-none">·</span>
            <span>{l}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
