'use client';

/**
 * Full theme-park guide — automatic destination content, not agency-authored.
 * It deliberately sits outside /guide/* and never carries the "From your travel
 * agent" heading: nobody at the agency wrote it and it must not read as if they
 * did.
 *
 * Every field hides its own block. The Theme Parks table is populated unevenly,
 * so a park with only an Overview renders an Overview and nothing else rather
 * than a page of empty headings, and a park that does not resolve gets one
 * plain line instead of an error screen.
 */

import { useParams } from 'next/navigation';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { ParkAttribution } from '@/components/park-panel';
import { usePark } from '@/lib/use-place';
import {
  IconInfo,
  IconStar,
  IconWarning,
  IconUsers,
  IconSparkle,
  IconFastTrack,
  IconTicket,
  IconClock,
  IconNavigate,
  IconPlane,
  IconBed,
  IconCompass,
  IconCheck,
  IconMap,
} from '@/components/icons';

const PARK_GRADIENT = 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)';

export default function ParkGuidePage() {
  const params = useParams<{ slug: string }>();
  const { booking } = useBooking();
  const { t } = useI18n();
  const { park, loading } = usePark(booking.primaryCountryCode, params.slug);

  if (loading) {
    return (
      <>
        <NavBar title={t('park.full')} backLabel={t('common.back')} />
        <main className="px-5 pt-4 space-y-3" aria-hidden="true">
          <div className="h-32 rounded-2xl bg-line-light animate-pulse" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-2xl bg-surface border border-line-light p-4 animate-pulse">
              <div className="h-2.5 w-1/4 rounded bg-line-light" />
              <div className="h-3 w-full rounded bg-line-light mt-3" />
              <div className="h-3 w-4/5 rounded bg-line-light mt-2" />
            </div>
          ))}
        </main>
      </>
    );
  }

  if (!park) {
    return (
      <>
        <NavBar title={t('park.full')} backLabel={t('common.back')} />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">{t('park.unavailable')}</p>
          <Link href="/itinerary" className="mt-4 inline-block text-teal-dark hover:underline text-sm">
            {t('common.backToItinerary')}
          </Link>
        </main>
      </>
    );
  }

  const eyebrow = [park.attractionType, park.operator].filter(Boolean).join(' · ');
  const bestTime = [park.bestTimeToVisit, park.season].filter(Boolean).join('\n\n');

  return (
    <PageEnter>
      <main className="pb-6">
        <section className="relative pt-2 px-5 pb-8 text-white" style={{ background: PARK_GRADIENT }}>
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: 'radial-gradient(ellipse at 85% 10%, rgba(255,255,255,0.18), transparent 50%)' }}
          />
          <div className="relative">
            <NavBar title=" " backLabel={t('common.back')} variant="dark" />
            {eyebrow && (
              <div className="mt-3 mb-1 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
                <IconTicket size={14} />
                {eyebrow}
              </div>
            )}
            <h1 className="font-serif text-[28px] leading-tight mt-2">{park.name}</h1>
            {park.tagline && <p className="text-sm opacity-90 mt-1">{park.tagline}</p>}
            {park.locationText && (
              <p className="text-[13px] opacity-80 mt-1">{park.locationText}</p>
            )}
          </div>
        </section>

        <div className="px-5 pt-4 space-y-3">
          {park.bestFor.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
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

          <Prose title={t('park.overview')} icon={<IconInfo size={14} />} body={park.overview} />
          <Prose title={t('park.stars')} icon={<IconStar size={14} />} body={park.starAttractions} />
          <Prose
            title={t('park.heights')}
            icon={<IconWarning size={14} />}
            body={park.heightRestrictions}
          />
          <Prose title={t('park.family')} icon={<IconUsers size={14} />} body={park.familyGuide} />
          <Prose title={t('park.thrill')} icon={<IconSparkle size={14} />} body={park.thrillGuide} />
          <Prose
            title={t('park.fastTrack')}
            icon={<IconFastTrack size={14} />}
            body={park.fastTrackOptions}
          />
          {/* Guidance copy from the content base, never a bookable rate. */}
          <Prose
            title={t('park.tickets')}
            icon={<IconTicket size={14} />}
            body={park.ticketsAndPrices}
          />
          <Prose title={t('place.bestTime')} icon={<IconClock size={14} />} body={bestTime} />
          <Prose
            title={t('place.gettingThere')}
            icon={<IconNavigate size={14} />}
            body={park.gettingThere}
          />
          <Prose
            title={t('park.airport')}
            icon={<IconPlane size={14} />}
            body={park.nearestAirport}
          />
          <Prose title={t('park.hotels')} icon={<IconBed size={14} />} body={park.onSiteHotels} />
          <Prose title={t('place.food')} icon={<IconCompass size={14} />} body={park.foodAndDrink} />
          <Prose title={t('park.access')} icon={<IconCheck size={14} />} body={park.accessibility} />
          <Prose
            title={t('park.tips')}
            icon={<IconSparkle size={14} />}
            body={park.quirksAndInsiderTips}
          />
          <Prose title={t('park.combine')} icon={<IconMap size={14} />} body={park.combineWith} />

          <div className="pt-1">
            <ParkAttribution park={park} />
          </div>
        </div>
      </main>
    </PageEnter>
  );
}

function Prose({
  title,
  icon,
  body,
}: {
  title: string;
  icon: React.ReactNode;
  body?: string;
}) {
  if (!body || !body.trim()) return null;
  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
        {icon}
        {title}
      </h3>
      <p className="text-sm text-ink-2 leading-relaxed whitespace-pre-line">{body}</p>
    </section>
  );
}
