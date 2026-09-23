'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import { NavBar } from '@/components/nav-bar';
import { IconStar, IconCheck } from '@/components/icons';
import { leadTraveller } from '@/lib/booking-helpers';
import { writeFeedback } from '@/lib/feedback-state';
import { NextIdeaCard } from '@/components/post-trip';

/**
 * Post-trip review.
 *
 * Reached from the feedback card on the home screen once the trip is over. It
 * used to claim it arrived by a "Welcome home" push notification; none was
 * ever built, and nothing else linked here, so no traveller ever saw it.
 * Still reachable by URL for any booking regardless of date, for demos.
 *
 * TWO THINGS THIS SCREEN MUST NOT DO.
 *
 * Promise a choice it does not offer. It said "with your permission, we may
 * also share on the agency website" and had no way to give permission, so
 * every review was sent with consent false. The box is real now, and unticked
 * by default: a review is private to the agency unless somebody says it isn't.
 *
 * Speak for the agency. The rebooking card underneath promised "direct flights
 * from Birmingham" and "school-holiday dates available" in the agency's voice,
 * credited itself to a "Promotion Engine" that was a switch statement, and
 * sent the traveller to the AI rather than the agent. It now names one place
 * and asks the agent, who supplies the dates and the price.
 */
export default function ReviewPage() {
  const { booking } = useBooking();
  const lead = leadTraveller(booking);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState('');
  // Off by default. A review is private to the agency unless the traveller
  // says otherwise, and the wording below says exactly that.
  const [shareConsent, setShareConsent] = useState(false);
  const router = useRouter();
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async () => {
    if (rating === 0 || submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch('/api/traveller/review', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ rating, comment: comment.trim(), shareConsent }),
      });
      // 201 = saved for a real traveller session. 401 = the mock/demo booking
      // (no lt_session) — nothing to persist, but the traveller has finished, so
      // still confirm. Only a genuine server error is surfaced to them.
      if (res.ok || res.status === 401) {
        setSubmitted(true);
        // So the home screen stops asking.
        writeFeedback(booking.reference, 'sent');
      } else {
        setError("We couldn't send your review just now. Please try again.");
      }
    } catch {
      setError("We couldn't send your review just now. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <NavBar title="Welcome home" backLabel="Trip" />
      <PageEnter>
        <main className="px-5 pt-3 pb-6">
          {/* Welcome */}
          <header className="text-center pt-4 pb-2">
            <h1 className="font-serif text-[28px] leading-tight text-ink">
              Welcome home,{' '}
              <em className="not-italic italic text-teal-dark dark:text-teal-light">
                {lead.firstName}
              </em>
              .
            </h1>
            <p className="text-sm text-ink-2 mt-2 max-w-[300px] mx-auto leading-relaxed">
              How was your {booking.destinationLabel} trip? A few words to help{' '}
              {booking.agency.name} send more travellers somewhere they&rsquo;ll love.
            </p>
          </header>

          {!submitted ? (
            <>
              {/* Star rating */}
              <div className="flex justify-center gap-1 my-7" role="radiogroup" aria-label="Rate your trip">
                {[1, 2, 3, 4, 5].map((n) => {
                  const lit = n <= (hover || rating);
                  return (
                    <button
                      key={n}
                      type="button"
                      role="radio"
                      aria-checked={n === rating}
                      aria-label={`${n} star${n === 1 ? '' : 's'}`}
                      onMouseEnter={() => setHover(n)}
                      onMouseLeave={() => setHover(0)}
                      onClick={() => setRating(n)}
                      className="p-1 transition-transform hover:scale-110 active:scale-95"
                    >
                      <IconStar
                        size={40}
                        className={lit ? 'text-gold' : 'text-star-off'}
                      />
                    </button>
                  );
                })}
              </div>
              {/* Which rating is chosen, in words. The stars only differ by
                  colour, and colour alone is not enough to tell somebody what
                  they have picked. */}
              <p className="-mt-4 mb-5 text-center text-[13px] text-ink-2" aria-live="polite">
                {rating ? `${rating} out of 5` : 'Tap a star to rate your trip'}
              </p>

              {/* Textarea-ish field */}
              <div className="bg-surface border border-line-light rounded-2xl p-4 mb-3">
                <textarea
                  value={comment}
                  onChange={(e) => setComment(e.target.value)}
                  placeholder="Anything you'd like to share with us…"
                  rows={4}
                  maxLength={2000}
                  className="w-full bg-transparent resize-none text-sm text-ink placeholder-ink-3 focus:outline-none leading-relaxed"
                />
              </div>

              <ActionButton onClick={onSubmit} disabled={rating === 0 || submitting}>
                {submitting
                  ? 'Sending…'
                  : rating === 0
                    ? 'Pick a rating to send'
                    : 'Send my review'}
              </ActionButton>

              {error && (
                <p className="text-[12px] text-danger-ink text-center mt-3 leading-relaxed max-w-[280px] mx-auto">
                  {error}
                </p>
              )}

              <p className="text-[12.5px] text-ink-2 text-center mt-3 leading-relaxed max-w-[300px] mx-auto">
                This goes to {booking.agency.name || 'your travel agent'} only.
              </p>
              <label className="mt-2 flex min-h-[44px] cursor-pointer items-start gap-3 rounded-xl px-1 py-2">
                <input
                  type="checkbox"
                  checked={shareConsent}
                  onChange={(e) => setShareConsent(e.target.checked)}
                  className="mt-0.5 h-5 w-5 flex-none accent-teal"
                />
                <span className="text-[13px] leading-snug text-ink-2">
                  {booking.agency.name || 'They'} may also share it on their website
                </span>
              </label>

              <button
                type="button"
                onClick={() => {
                  writeFeedback(booking.reference, 'dismissed');
                  router.push('/');
                }}
                className="mx-auto mt-1 flex min-h-[44px] items-center px-4 text-[13px] font-medium text-ink-2"
              >
                Not now
              </button>
            </>
          ) : (
            <div className="text-center my-8 p-6 rounded-2xl bg-success/5 border border-success/20">
              <span className="inline-flex w-12 h-12 rounded-full bg-success text-semantic-on items-center justify-center mb-3">
                <IconCheck size={22} />
              </span>
              <h2 className="text-base font-semibold text-ink">Thanks — that&rsquo;s sent.</h2>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Your agent will be in touch if there&rsquo;s anything to follow up.
              </p>
            </div>
          )}

          {/* One place, and a way to ask the agent about it. */}
          <section className="mt-7">
            <NextIdeaCard booking={booking} />
          </section>
        </main>
      </PageEnter>
    </>
  );
}
