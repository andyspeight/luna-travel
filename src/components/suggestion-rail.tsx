'use client';

/**
 * The two "where next" rails, driven by place content.
 *
 * THEY ARE NOT THE SAME RAIL WITH A DIFFERENT FILTER. "Best Paired With" is an
 * editorial, intra-country relationship (Orlando pairs to the Florida Keys,
 * Miami and the Gulf Coast — all US), so it reads as "add a few days" and must
 * keep the trip's own country. "Where next?" is tag similarity in ANOTHER
 * country and is the rebooking surface. Showing the paired set under "Where
 * next?" would be offering the traveller the state they are already in.
 *
 * Every card is still the InspirationCard button that opens the enquiry sheet —
 * mailto / tel / Luna / agency site is the conversion model and is unchanged.
 */

import { useBooking } from '@/lib/booking-context';
import { usePlace } from '@/lib/use-place';
import { useI18n } from '@/lib/locale-context';
import { SectionHeading } from '@/components/section-heading';
import { InspirationCard } from '@/components/inspiration-card';
import { getInspirations, inspirationFromSuggestion, type Inspiration } from '@/data/inspirations';

interface Props {
  reason: 'paired' | 'similar';
  variant?: 'compact' | 'full';
  /** Overrides the generated subline — the /inspiration page supplies its own
   *  pre-trip / post-trip copy for the 'similar' block. */
  intro?: string;
}

const MAX_TAGS = 3;

export function SuggestionRail({ reason, variant = 'compact', intro }: Props) {
  const { booking } = useBooking();
  const { t } = useI18n();
  const { place } = usePlace(booking);

  const live: Inspiration[] = (place?.suggestions ?? [])
    .filter((s) => s.reason === reason)
    .map(inspirationFromSuggestion);

  // The curated floor only ever backs the rebooking rail. A paired rail with no
  // content has nothing honest to say — Santorini is not "a few days on from
  // Orlando" — so it hides itself instead.
  const items =
    live.length > 0 || reason === 'paired'
      ? live
      : getInspirations(booking.primaryCountryCode);
  if (items.length === 0) return null;

  const title = reason === 'paired' ? t('next.addDays') : t('next.whereNext');
  const sub = intro ?? defaultSub();
  const compact = variant === 'compact';

  function defaultSub(): string {
    if (reason === 'paired') {
      return place?.name ? t('next.addDaysIntro', { place: place.name }) : '';
    }
    // Only claim a reason when the suggestions really came from shared tags;
    // the curated floor was not chosen because of anything the traveller liked.
    if (live.length === 0) return '';
    const tags = sharedTags(place?.suggestions ?? []);
    return tags.length > 0 ? t('next.becauseTags', { tags: tags.join(', ') }) : '';
  }

  return (
    <section className="mt-6">
      {compact ? (
        <SectionHeading title={title} seeAllHref="/inspiration" />
      ) : (
        <h2 className="px-1 pb-1 font-serif text-[24px] leading-tight text-ink">{title}</h2>
      )}
      {sub && <p className="px-1 pb-1 text-[13px] text-ink-2 leading-snug">{sub}</p>}
      {/* Said once here and again on every card. These rails sit below the
          traveller's confirmed itinerary, and "Where next?" alone does not
          make it obvious that a priced card is an idea rather than a booking.
          The short form where an intro has already named the agency, so the
          two lines do not say it twice. */}
      <p className="px-1 pb-2.5 text-[11.5px] text-ink-3">
        {sub
          ? t('next.ideaNoteShort')
          : t('next.ideaNote', { agency: booking.agency.name })}
      </p>

      {compact ? (
        <div className="-mx-5 px-5 overflow-x-auto scrollbar-none">
          <div className="flex gap-3" style={{ width: 'max-content' }}>
            {items.map((ins) => (
              <div key={ins.id} className="w-[200px] flex-shrink-0">
                <InspirationCard
                  inspiration={ins}
                  agency={booking.agency}
                  variant="compact"
                  becauseOf={place?.name}
                />
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((ins) => (
            <InspirationCard
              key={ins.id}
              inspiration={ins}
              agency={booking.agency}
              becauseOf={place?.name}
            />
          ))}
        </div>
      )}
    </section>
  );
}

/** The tags the similar set actually has in common with the traveller's place,
 *  in the order the adapter ranked them. Verbatim — never relabelled. */
function sharedTags(suggestions: Array<{ reason: string; sharedTags: string[] }>): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const s of suggestions) {
    if (s.reason !== 'similar') continue;
    for (const tag of s.sharedTags ?? []) {
      const key = tag.trim().toLowerCase();
      if (!key || seen.has(key)) continue;
      seen.add(key);
      out.push(tag.trim());
      if (out.length >= MAX_TAGS) return out;
    }
  }
  return out;
}
