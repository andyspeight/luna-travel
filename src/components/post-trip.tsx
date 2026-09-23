'use client';

/**
 * The home screen once the trip is over.
 *
 * The review's eighth point: the feedback request and the next-trip idea make
 * commercial sense, but they must not crowd out the things a traveller may
 * still need — a document for an insurance claim, or the agency, because a
 * problem does not end when the holiday does.
 *
 * Two cards here, and both follow rules the rest of this change set enforces:
 *
 *   FEEDBACK says where it goes, and can be put away. It sat behind a screen
 *   nothing ever linked to; now it is on the home screen, once, and "Not now"
 *   means not again on this phone.
 *
 *   THE NEXT IDEA is an enquiry to a person, not a claim about a place. The
 *   screen it replaces promised "direct flights from Birmingham" and "school-
 *   holiday dates available" in the agency's voice, with nothing behind either
 *   and a button that went to the AI rather than the agent. This names a
 *   place and asks the agent — who supplies the dates and the price.
 */

import { useEffect, useState } from 'react';
import Link from 'next/link';
import type { Booking } from '@/types/booking';
import { useBooking } from '@/lib/booking-context';
import { usePlace } from '@/lib/use-place';
import { useI18n } from '@/lib/locale-context';
import {
  getInspirations,
  inspirationFromSuggestion,
  type Inspiration,
} from '@/data/inspirations';
import { readFeedback, writeFeedback, shouldAskForFeedback } from '@/lib/feedback-state';
import { EnquirySheet } from '@/components/inspiration-card';
import { IconStar, IconChevR, IconCompass } from '@/components/icons';

/**
 * The one place to name, chosen exactly as the "Where next?" rail chooses its
 * first card — so the action at the top and the rail below never disagree
 * about what the idea is.
 */
export function useNextIdea(booking: Booking): Inspiration | null {
  const { place } = usePlace(booking);
  const live = (place?.suggestions ?? [])
    .filter((s) => s.reason === 'similar')
    .map(inspirationFromSuggestion);
  const items = live.length > 0 ? live : getInspirations(booking.primaryCountryCode);
  return items[0] ?? null;
}

/** "How was the Maldives?" — once, dismissible, gone once answered. */
export function FeedbackCard() {
  const { booking } = useBooking();
  const { t } = useI18n();
  // Read after mount: storage does not exist on the server, and a card that
  // rendered there and vanished on the client would flash for everybody who
  // had already said not now.
  const [state, setState] = useState<ReturnType<typeof readFeedback> | null>(null);

  useEffect(() => {
    setState(readFeedback(booking.reference));
  }, [booking.reference]);

  if (state === null) return null;
  if (!shouldAskForFeedback({ tripEnd: booking.tripEnd, state })) return null;

  const agency = booking.agency.name || 'your travel agent';

  return (
    <section
      aria-labelledby="feedback-title"
      className="mb-4 rounded-2xl border border-line-light bg-surface p-4"
    >
      <div className="flex items-start gap-3">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-gold/15 text-gold">
          <IconStar size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id="feedback-title" className="text-[15px] font-semibold text-ink">
            {t('post.feedbackTitle', { dest: booking.destinationLabel || 'your trip' })}
          </h2>
          <p className="mt-0.5 text-[13px] leading-snug text-ink-2">
            {t('post.feedbackBody', { agency })}
          </p>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Link
          href="/review"
          className="inline-flex min-h-[44px] flex-1 items-center justify-center rounded-xl bg-navy px-4 text-[14px] font-semibold text-navy-on dark:bg-teal dark:text-teal-on"
        >
          {t('post.feedbackCta')}
        </Link>
        <button
          type="button"
          onClick={() => {
            writeFeedback(booking.reference, 'dismissed');
            setState('dismissed');
          }}
          className="inline-flex min-h-[44px] items-center px-4 text-[14px] font-medium text-ink-2"
        >
          {t('post.notNow')}
        </button>
      </div>
    </section>
  );
}

/**
 * "Ask Travelgenix about Santorini" — the review's own example of a specific
 * next-trip action, reaching the agent rather than a search or the AI.
 */
export function NextIdeaCard({ booking }: { booking: Booking }) {
  const { t } = useI18n();
  const idea = useNextIdea(booking);
  const [open, setOpen] = useState(false);

  if (!idea) return null;
  const agency = booking.agency.name || 'your travel agent';

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="mb-4 flex min-h-[44px] w-full items-center gap-3 rounded-2xl border border-line-light bg-surface p-4 text-left"
      >
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light">
          <IconCompass size={18} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[11px] uppercase tracking-wider text-ink-3">
            {t('post.nextIdea')}
          </span>
          <span className="block text-[15px] font-semibold text-ink">
            {t('post.askAbout', { agency, place: idea.name })}
          </span>
        </span>
        <IconChevR size={16} className="flex-none text-ink-3" />
      </button>

      {open && (
        <EnquirySheet
          ins={idea}
          agency={booking.agency}
          becauseOf={booking.destinationLabel}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
