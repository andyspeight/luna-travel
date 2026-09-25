'use client';

import { usePathname } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { needsBooking } from '@/lib/booking-gate';

/**
 * Says so when the trip on screen is the copy kept on this phone because the
 * network could not answer (lib/saved-trip.ts). Flight times and gates change;
 * a traveller reading a saved copy in a terminal should know it may be behind,
 * and when it is from.
 */
export function SavedTripNotice() {
  const { savedAt } = useBooking();
  const { t, locale } = useI18n();
  const pathname = usePathname();

  if (savedAt === null || !needsBooking(pathname)) return null;

  let when = '';
  try {
    when = new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : locale, {
      day: 'numeric',
      month: 'short',
      hour: '2-digit',
      minute: '2-digit',
    }).format(savedAt);
  } catch {
    when = new Date(savedAt).toLocaleString();
  }

  return (
    <div
      role="status"
      className="px-4 py-2 text-[13px] leading-snug text-ink-2 bg-surface-2 border-b border-line text-center"
    >
      {t('offline.savedTrip', { when })}
    </div>
  );
}
