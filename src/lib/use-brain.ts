'use client';

/**
 * The Luna Brain layer for a booking's destination and dates.
 *
 * Lifted out of the destination page when a second screen needed the same
 * thing. Brain is the only layer carrying Source, Confidence and Last Verified,
 * so it owns the verified facts — emergency numbers, plugs, visas — and both
 * the destination screen and the essentials screen read it.
 *
 * Additive by design: any failure at all, offline or unconfigured, leaves the
 * caller with null and the static guide standing. A missing Brain must never
 * be the reason a screen does not render.
 */

import { useEffect, useState } from 'react';
import type { Booking } from '@/types/booking';

export interface BrainAnswer {
  id: string;
  question: string;
  answer: string;
  category: string;
  confidence?: string;
  source?: string;
  seasonal: boolean;
  fcdoSensitive: boolean;
  lastVerified?: string;
}

/**
 * A type alias, not an interface, and deliberately.
 *
 * resolveGuide takes `Record<string, unknown>`. TypeScript gives an object type
 * alias an implicit index signature and a named interface none, so declaring
 * this as an interface makes it unassignable there for no behavioural reason.
 * The destination page's own copy is an anonymous object type inline in its
 * BrainGuide, which is why that compiled while naming it here did not.
 */
export type BrainDestinationFacts = {
  name: string;
  currency?: string;
  capital?: string;
  languages?: string;
  timeZone?: string;
  emergencyNumber?: string;
  drivingSide?: string;
  plugType?: string;
  voltage?: string;
  ukVisaRequired?: string;
  tapWaterSafe?: string;
  fcdoStatus?: string;
  bestMonths?: string;
  cheapestToFly?: string;
  vaccinations?: string;
  lastVerified?: string;
};

export interface BrainGuide {
  configured: boolean;
  destination?: BrainDestinationFacts | null;
  byCategory?: { category: string; items: BrainAnswer[] }[];
  forYourDates?: {
    travelLabel: string;
    bestMonths?: string;
    cheapestToFly?: string;
    climate: BrainAnswer[];
    events: BrainAnswer[];
    thingsToDo: BrainAnswer[];
  } | null;
}

/**
 * The place names worth asking Brain about: what the booking calls the
 * destination, plus every city and resort actually stayed in. A booking to
 * "Greek Islands" that stays in Fira should match Santorini.
 */
function tokensFor(booking: Booking): string {
  const labelParts = booking.destinationLabel.split(/[&,/]+/);
  return Array.from(
    new Set(
      [
        ...labelParts,
        ...booking.hotels.map((h) => h.city),
        ...booking.hotels.map((h) => h.resort || ''),
      ]
        .map((s) => s.trim())
        .filter(Boolean),
    ),
  ).join(',');
}

export function useBrainGuide(booking: Booking | null | undefined): {
  brain: BrainGuide | null;
  loading: boolean;
} {
  const [brain, setBrain] = useState<BrainGuide | null>(null);
  const [loading, setLoading] = useState(true);

  const cc = booking?.primaryCountryCode || '';
  const from = booking?.tripStart || '';
  const to = booking?.tripEnd || '';
  const tokens = booking ? tokensFor(booking) : '';

  useEffect(() => {
    if (!cc) {
      setBrain(null);
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);

    const qs = new URLSearchParams({ cc, tokens, from, to });
    fetch(`/api/traveller/destination?${qs.toString()}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: BrainGuide | null) => {
        if (alive && data && data.configured) setBrain(data);
      })
      .catch(() => {
        /* ignore — the static guide stands */
      })
      .finally(() => {
        if (alive) setLoading(false);
      });

    return () => {
      alive = false;
    };
  }, [cc, tokens, from, to]);

  return { brain, loading };
}
