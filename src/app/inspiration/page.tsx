'use client';

import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { InspirationCard } from '@/components/inspiration-card';
import { getInspirations } from '@/data/inspirations';
import { useI18n } from '@/lib/locale-context';

export default function InspirationPage() {
  const { booking } = useBooking();
  const { t } = useI18n();
  const items = getInspirations(booking.primaryCountryCode);
  const tripOver = Date.now() > new Date(booking.tripEnd).getTime();

  const intro = tripOver
    ? t('next.introPost', { dest: booking.destinationLabel, agency: booking.agency.name })
    : t('next.introPre', { agency: booking.agency.name });

  return (
    <>
      <NavBar title={t('next.whereNext')} backLabel={t('tab.trip')} />
      <PageEnter>
        <main className="px-5 pt-2 pb-8">
          <header className="py-3">
            <h1 className="font-serif text-[30px] leading-tight text-ink">
              {t('next.whereNext')}
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">{intro}</p>
          </header>

          <div className="space-y-3 mt-2">
            {items.map((ins) => (
              <InspirationCard key={ins.id} inspiration={ins} agency={booking.agency} />
            ))}
          </div>

          <p className="mt-5 text-[11px] text-ink-3 leading-relaxed text-center">
            {t('next.footer', { agency: booking.agency.name })}
          </p>
        </main>
      </PageEnter>
    </>
  );
}
