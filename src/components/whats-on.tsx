'use client';

/**
 * Local events that fall inside the traveller's own dates, on the home screen.
 *
 * This sits directly under "Up next" / "Coming up", which are the traveller's
 * confirmed itinerary, so it is deliberately shaped NOT to read like one: a
 * muted month chip instead of a date and time, no row that opens a detail
 * screen, and a standing note that none of it is booked. The source carries no
 * year, so the verbatim month token is the only date string that ever appears.
 *
 * Machine-curated and identical for every traveller in the place — which is why
 * it never borrows the "From your travel agent" heading, and why nothing here
 * is written back to trip_content.
 */

import { useMemo } from 'react';
import { useBooking } from '@/lib/booking-context';
import { useI18n } from '@/lib/locale-context';
import { usePlace } from '@/lib/use-place';
import { splitEvents } from '@/lib/destination-dates';
import { SectionHeading } from '@/components/section-heading';
import { EventList, OtherTimesEvents, UndatedEvents } from '@/components/place-sections';

export function WhatsOn() {
  const { booking } = useBooking();
  const { place } = usePlace(booking);
  const { t } = useI18n();

  // Read `otherTimes` and `undated`, NOT the deprecated `yearRound` alias.
  // `yearRound` is `otherTimes` under the old "{place} through the year"
  // heading, which asserted a run length the Events JSON never states: an
  // October-only event was announced as year-round with an "Oct" chip beside
  // it. `undated` is the separate bucket for tokens we could not read at all.
  const { inWindow, otherTimes, undated } = useMemo(
    () => splitEvents(place?.events ?? [], booking?.tripStart, booking?.tripEnd),
    [place?.events, booking?.tripStart, booking?.tripEnd],
  );

  // Self-hiding: no key, no match, no events in the window — no section. There
  // is no empty state, because "nothing on" is not news to a traveller.
  if (!inWindow.length) return null;

  return (
    <section className="mt-6">
      <SectionHeading title={t('whatson.section')} />
      <EventList events={inWindow} />

      {/* Both secondary buckets stay collapsed here: this section sits directly
          under "Up next", and the traveller's own booked items must stay the
          loudest thing on the screen. Each block hides itself when empty. */}
      <OtherTimesEvents events={otherTimes} collapsible />
      <UndatedEvents events={undated} collapsible />

      <p className="text-[11px] text-ink-3 italic mt-2 px-1">{t('whatson.note')}</p>
    </section>
  );
}
