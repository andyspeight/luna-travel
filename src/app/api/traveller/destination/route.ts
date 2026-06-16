/**
 * GET /api/traveller/destination?cc=AE&tokens=Dubai,Palm%20Jumeirah&from=ISO&to=ISO
 *
 * Returns the Luna Brain-sourced destination guide for a booking's destination:
 * the verified structured facts, consumer Q&A grouped by category (each with its
 * Source / Confidence / Last Verified for provenance), and a date-aware
 * "For your dates" block keyed to the travel window.
 *
 * Public, traveller-facing — it only ever returns published destination
 * knowledge (no PII), so it isn't gated. When AIRTABLE_KEY isn't configured
 * (e.g. local dev) it returns { configured: false } so the guide falls back to
 * its static content rather than erroring.
 */

import { NextRequest, NextResponse } from 'next/server';
import { brainConfigured, getGuide } from '@/lib/luna-brain';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  const cc = (req.nextUrl.searchParams.get('cc') || '').trim();
  if (!/^[A-Za-z]{2}$/.test(cc)) {
    return NextResponse.json({ error: 'invalid_cc' }, { status: 400 });
  }

  if (!brainConfigured()) {
    // Not an error — the page renders its static guide instead.
    return NextResponse.json({ configured: false, reason: 'AIRTABLE_KEY not set' });
  }

  const tokens = (req.nextUrl.searchParams.get('tokens') || '')
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean);
  const from = req.nextUrl.searchParams.get('from') || undefined;
  const to = req.nextUrl.searchParams.get('to') || undefined;

  try {
    const guide = await getGuide({ cc, tokens, from, to });
    return NextResponse.json({ configured: true, ...guide });
  } catch (err) {
    console.error('[traveller/destination] Luna Brain read failed:', (err as Error).message);
    // Soft-fail to the static guide.
    return NextResponse.json(
      { configured: false, reason: 'brain_unavailable' },
      { status: 502 },
    );
  }
}
