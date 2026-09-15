'use client';

import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { SuggestionRail } from '@/components/suggestion-rail';
import { useI18n } from '@/lib/locale-context';

export default function InspirationPage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const tripOver = Date.now() > new Date(booking.tripEnd).getTime();

  const intro = tripOver
    ? t('next.introPost', { dest: booking.destinationLabel, agency: booking.agency.name })
    : t('next.introPre', { agency: booking.agency.name });

  return (
    <>
      <NavBar title={t('next.whereNext')} backLabel={t('tab.trip')} />
      <PageEnter>
        <main className="px-5 pt-2 pb-8">
          {/* No page <h1>: NavBar already renders one, and a second "Where
              next?" above the rail that also says it read as a stutter.
              Extending the trip they already have comes first — it is the
              easier sale and the only rail that keeps their own country. */}
          <SuggestionRail reason="paired" variant="full" />
          <SuggestionRail reason="similar" variant="full" intro={intro} />

          <p className="mt-5 text-[11px] text-ink-3 leading-relaxed text-center">
            {t('next.footer', { agency: booking.agency.name })}
          </p>
        </main>
      </PageEnter>
    </>
  );
}
