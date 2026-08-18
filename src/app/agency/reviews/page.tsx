'use client';

/**
 * /agency/reviews — the reviews the agency's travellers have left, with an
 * average-rating summary. "Shareable" marks the ones the traveller consented to
 * share publicly (a testimonial). Read-only; scoped to the session's agency.
 */

import { useCallback, useEffect, useState } from 'react';
import { Star, MapPin, Share2 } from 'lucide-react';
import { AgencyShell, Callout, P, SERIF, card } from '../portal-chrome';

interface Review {
  rating: number;
  comment: string | null;
  travellerName: string | null;
  destination: string | null;
  bookingRef: string | null;
  shareConsent: boolean;
  createdAt: string | null;
}
interface Data { summary: { count: number; average: number }; reviews: Review[] }

function Stars({ value, size = 15 }: { value: number; size?: number }) {
  return (
    <span style={{ display: 'inline-flex', gap: 1 }} aria-label={`${value} out of 5`}>
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} strokeWidth={1.6} color={n <= value ? '#f59e0b' : P.line} fill={n <= value ? '#f59e0b' : 'none'} />
      ))}
    </span>
  );
}

function ReviewsPage() {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/agency/reviews', { cache: 'no-store' });
      if (res.ok) setData(await res.json());
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const reviews = data?.reviews ?? [];
  const summary = data?.summary;

  return (
    <div>
      <h1 style={{ fontFamily: SERIF, fontSize: 30, color: P.ink, margin: 0 }}>Reviews</h1>
      <p style={{ color: P.ink2, fontSize: 14, marginTop: 6, lineHeight: 1.5, maxWidth: 520 }}>
        What your travellers thought of their trip. Ones marked <strong>Shareable</strong> can be used
        as testimonials.
      </p>

      {summary && summary.count > 0 && (
        <div style={{ ...card, padding: '16px 18px', marginTop: 16, display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 34, fontWeight: 800, color: P.navy, fontFamily: SERIF }}>{summary.average.toFixed(1)}</span>
              <Stars value={Math.round(summary.average)} size={17} />
            </div>
            <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 2 }}>{summary.count} {summary.count === 1 ? 'review' : 'reviews'}</div>
          </div>
        </div>
      )}

      {loading ? (
        <p style={{ color: P.ink3, fontSize: 13, marginTop: 18 }}>Loading…</p>
      ) : reviews.length === 0 ? (
        <div style={{ marginTop: 18 }}>
          <Callout title="No reviews yet" icon={<Star size={16} />}>
            After a trip, travellers can leave a rating and a few words in the app. They&rsquo;ll appear
            here as they come in.
          </Callout>
        </div>
      ) : (
        <div style={{ display: 'grid', gap: 12, marginTop: 18 }}>
          {reviews.map((r, i) => (
            <div key={i} style={{ ...card, padding: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                <Stars value={r.rating} />
                {r.shareConsent && (
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 800, color: '#047857', background: '#d1fae5', borderRadius: 999, padding: '2px 9px' }}>
                    <Share2 size={11} /> Shareable
                  </span>
                )}
                <span style={{ marginLeft: 'auto', fontSize: 12, color: P.ink3 }}>{fmtDate(r.createdAt)}</span>
              </div>
              {r.comment && (
                <p style={{ fontSize: 14, color: P.ink, lineHeight: 1.55, marginTop: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                  &ldquo;{r.comment}&rdquo;
                </p>
              )}
              <div style={{ fontSize: 12.5, color: P.ink3, marginTop: 10, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                {r.travellerName && <span style={{ fontWeight: 600, color: P.ink2 }}>{r.travellerName}</span>}
                {r.destination && <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>· <MapPin size={11} /> {r.destination}</span>}
                {r.bookingRef && <span style={{ fontFamily: 'ui-monospace, monospace' }}>· {r.bookingRef}</span>}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string | null): string {
  if (!iso) return '';
  try {
    return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  } catch {
    return '';
  }
}

export default function AgencyReviewsPage() {
  return (
    <AgencyShell active="reviews">
      <ReviewsPage />
    </AgencyShell>
  );
}
