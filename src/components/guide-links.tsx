'use client';

/**
 * Home section linking to the agency-authored guide pages. Renders nothing
 * until content exists — pages appear one by one as the agent publishes them,
 * so an agency that only writes "Before you travel" shows a single row.
 */

import Link from 'next/link';
import { useI18n } from '@/lib/locale-context';
import { SectionHeading } from '@/components/section-heading';
import { useTripContent } from '@/lib/use-trip-content';
import { IconList, IconCalendar, IconMap, IconChevR } from '@/components/icons';

export function GuideLinks() {
  const { pages } = useTripContent();
  const { t } = useI18n();

  const rows = [
    pages['before-you-travel'].length > 0 && {
      href: '/guide/before-you-travel',
      title: t('guide.byt'),
      blurb: t('guide.bytBlurb'),
      icon: <IconList size={17} />,
    },
    pages.itinerary.length > 0 && {
      href: '/guide/itinerary',
      title: t('guide.itinerary'),
      blurb: t('guide.itinBlurb'),
      icon: <IconCalendar size={17} />,
    },
    pages['find-your-way'].length > 0 && {
      href: '/guide/find-your-way',
      title: t('guide.fyw'),
      blurb: t('guide.fywBlurb'),
      icon: <IconMap size={17} />,
    },
  ].filter((r): r is Exclude<typeof r, false> => !!r);

  if (rows.length === 0) return null;

  return (
    <section className="mt-6">
      <SectionHeading title={t('guide.section')} />
      <div className="rounded-2xl bg-surface border border-line-light divide-y divide-line-light overflow-hidden">
        {rows.map((r) => (
          <Link key={r.href} href={r.href} className="flex items-center gap-3 p-4 tap">
            <span className="flex-none w-9 h-9 rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center">
              {r.icon}
            </span>
            <span className="flex-1 min-w-0">
              <span className="block text-sm font-semibold text-ink">{r.title}</span>
              <span className="block text-xs text-ink-2 mt-0.5">{r.blurb}</span>
            </span>
            <span className="flex-none text-ink-3">
              <IconChevR size={15} />
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
