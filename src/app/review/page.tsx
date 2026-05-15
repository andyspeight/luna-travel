'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import { NavBar } from '@/components/nav-bar';
import { IconStar, IconCheck, IconChevR } from '@/components/icons';
import { leadTraveller } from '@/lib/booking-helpers';

/**
 * Post-trip review.
 *
 * In production this appears automatically after `tripEnd` has passed (deep
 * link from a "Welcome home" push notification). For the prototype it's
 * reachable via the route directly and shows for the active booking
 * regardless of date — handy for the show demo.
 */
export default function ReviewPage() {
  const { booking } = useBooking();
  const lead = leadTraveller(booking);
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [submitted, setSubmitted] = useState(false);

  const onSubmit = () => {
    // In production: POST to the agency's review endpoint
    setSubmitted(true);
  };

  // Rebook suggestion based on destination personality
  const next = nextDestination(booking.primaryCountryCode);

  return (
    <>
      <NavBar title="Welcome home" backLabel="Trip" />
      <PageEnter>
        <main className="px-5 pt-3 pb-6">
          {/* Welcome */}
          <header className="text-center pt-4 pb-2">
            <div className="text-5xl mb-3" aria-hidden>
              {welcomeEmoji(booking.primaryCountryCode)}
            </div>
            <h1 className="font-serif text-[28px] leading-tight text-ink">
              Welcome home,{' '}
              <em className="not-italic italic text-teal-dark dark:text-teal-light">
                {lead.firstName}
              </em>
              .
            </h1>
            <p className="text-sm text-ink-2 mt-2 max-w-[300px] mx-auto leading-relaxed">
              How was {booking.destinationLabel}? A few words to help{' '}
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
                        className={lit ? 'text-gold' : 'text-line'}
                      />
                    </button>
                  );
                })}
              </div>

              {/* Textarea-ish field */}
              <div className="bg-surface border border-line-light rounded-2xl p-4 mb-3">
                <textarea
                  placeholder="Anything you'd like to share with us…"
                  rows={4}
                  className="w-full bg-transparent resize-none text-sm text-ink placeholder-ink-3 focus:outline-none leading-relaxed"
                />
              </div>

              <ActionButton onClick={onSubmit} disabled={rating === 0}>
                {rating === 0 ? 'Pick a rating to send' : 'Send my review'}
              </ActionButton>

              <p className="text-[11px] text-ink-3 text-center mt-3 leading-relaxed max-w-[280px] mx-auto">
                Reviews go straight to your agent. With your permission, we may also share on the agency website.
              </p>
            </>
          ) : (
            <div className="text-center my-8 p-6 rounded-2xl bg-success/5 border border-success/20">
              <span className="inline-flex w-12 h-12 rounded-full bg-success text-white items-center justify-center mb-3">
                <IconCheck size={22} />
              </span>
              <h2 className="text-base font-semibold text-ink">Thanks — that&rsquo;s sent.</h2>
              <p className="text-xs text-ink-2 mt-1 leading-relaxed">
                Your agent will be in touch if there&rsquo;s anything to follow up.
              </p>
            </div>
          )}

          {/* Rebook nudge */}
          {next && (
            <section className="mt-7">
              <article
                className="relative overflow-hidden rounded-3xl p-5 text-white"
                style={{
                  background:
                    'linear-gradient(135deg, #1B2B5B 0%, #2A3F7A 50%, #0077B6 100%)',
                }}
              >
                <div
                  aria-hidden
                  className="absolute -top-10 -right-10 w-40 h-40 rounded-full"
                  style={{
                    background:
                      'radial-gradient(circle, rgba(0,180,216,0.45), transparent 70%)',
                  }}
                />
                <div className="relative">
                  <div className="text-[10px] uppercase tracking-[0.18em] text-white/80 mb-1.5">
                    Next idea · for {lead.firstName}
                  </div>
                  <h3 className="font-serif text-[26px] leading-tight">
                    Loved {booking.destinationLabel}?
                    <br />
                    Try <em>{next.name}</em>{' '}
                    <span className="text-white/85 text-base font-sans not-italic">
                      {next.when}
                    </span>
                  </h3>
                  <p className="text-[13px] text-white/85 mt-3 leading-relaxed">
                    {next.pitch}
                  </p>
                  <Link
                    href="/luna"
                    className="inline-flex items-center gap-1.5 mt-4 px-4 h-10 rounded-xl bg-white text-navy text-sm font-semibold hover:bg-white/95"
                  >
                    Get a tailored idea
                    <IconChevR size={16} />
                  </Link>
                </div>
              </article>

              <p className="text-[11px] text-ink-3 text-center mt-2.5">
                Powered by Luna Marketing&rsquo;s Promotion Engine
              </p>
            </section>
          )}
        </main>
      </PageEnter>
    </>
  );
}

function welcomeEmoji(cc: string): string {
  switch (cc) {
    case 'MV': return '🌴';
    case 'ES': return '☀️';
    case 'AE': return '🌅';
    case 'GR': return '🏛';
    default: return '✈️';
  }
}

/**
 * Light cross-sell logic. Per-destination "what would they love next?"
 * driven by similar vibe (beach → other beach, city → other city) and a
 * seasonal hint.
 *
 * In production this is the Luna Marketing Promotion Engine call.
 */
function nextDestination(
  cc: string
): { name: string; when: string; pitch: string } | undefined {
  switch (cc) {
    case 'MV':
      return {
        name: 'Mauritius',
        when: 'in spring',
        pitch:
          'Similar vibe, longer stay possible, school-holiday dates available. Reef walks that work for younger swimmers too.',
      };
    case 'ES':
      return {
        name: 'Crete',
        when: 'next summer',
        pitch:
          'A bigger island for older kids — beaches, ruins to climb, and food that keeps the family happy. Direct flights from Birmingham.',
      };
    case 'AE':
      return {
        name: 'the Maldives',
        when: 'in November',
        pitch:
          'A natural pairing with Dubai for an anniversary trip. Water-villa overnighters available — we can build a 2-stop itinerary.',
      };
    case 'GR':
      return {
        name: 'Lisbon',
        when: 'in October',
        pitch:
          'Another walkable European city you can do in a long weekend. Different food, similar pace — proper tavernas-meets-tascas energy.',
      };
    default:
      return undefined;
  }
}
