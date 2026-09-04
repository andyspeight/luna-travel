'use client';

/**
 * Shared shell for the agency-authored accordion pages (Before you travel,
 * Itinerary). The find-your-way page has its own layout (map + list).
 */

import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { GuideAccordion } from '@/components/guide-accordion';
import { useTripContent } from '@/lib/use-trip-content';
import type { AccordionItem } from '@/lib/trip-content';

export function GuideAccordionPage({
  page,
  titleKey,
}: {
  page: 'before-you-travel' | 'itinerary';
  titleKey: string;
}) {
  const { booking } = useBooking();
  const { t } = useI18n();
  const { pages, loading } = useTripContent();
  const items = pages[page] as AccordionItem[];

  return (
    <>
      <NavBar title={t(titleKey)} backLabel={t('tab.trip')} />
      <PageEnter>
        <main className="px-5 pt-2 pb-8">
          <header className="py-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
              {t(titleKey)}
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">
              {t('guide.from', { agency: booking.agency.name })}
            </p>
          </header>

          {items.length > 0 ? (
            <GuideAccordion items={items} />
          ) : (
            <div className="p-6 rounded-2xl bg-surface border border-line-light text-center text-sm text-ink-2">
              {loading ? '…' : t('guide.empty')}
            </div>
          )}
        </main>
      </PageEnter>
    </>
  );
}
