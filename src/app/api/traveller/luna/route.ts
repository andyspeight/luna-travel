/**
 * POST /api/traveller/luna
 *
 * The model layer behind Ask Luna, for the questions the deterministic layers
 * cannot reach. The client has already tried those — the booking, the
 * destination facts, Brain's verified rows — so anything arriving here is
 * genuinely open-ended.
 *
 * GATED, DELIBERATELY. Every request costs the agency money, so this needs a
 * real traveller session (the lt_session cookie set at invite redemption) and
 * is rate limited per traveller. An ungated model endpoint is an open wallet,
 * and a public one would be somebody else's free chatbot inside a week.
 *
 * The demo booking therefore gets no model answers unless LUNA_AI_ALLOW_DEMO=1
 * is set, which is an explicit switch for showing the product rather than a
 * hole left open.
 *
 * Failure of any kind returns { ok: false } with a 200. "I could not answer" is
 * a normal outcome the client handles by offering the agent; a 5xx would read
 * to the traveller as the app being broken.
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifySession } from '@/lib/jwt';
import { askLuna, isRefusal, lunaAiConfigured } from '@/lib/luna-ai';
import { getBrandingOverride } from '@/lib/agency-branding';
import { forbiddenStrings } from '@/lib/luna-context';
import type { Booking } from '@/types/booking';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 30;

const SESSION_COOKIE = 'lt_session';

/** Questions per traveller per window. Generous for a person, useless for a bot. */
const LIMIT = 25;
const WINDOW_MS = 60 * 60 * 1000;

/**
 * In-memory, per-instance. Not a real rate limiter — a serverless fleet has
 * many instances and this bounds each one rather than the total. It is here to
 * stop one runaway client, not a determined attacker, and it costs nothing.
 * If this ever needs to be exact it belongs in Supabase with the session.
 */
const seen = new Map<string, { count: number; resetAt: number }>();

function overLimit(key: string): boolean {
  const now = Date.now();
  const row = seen.get(key);
  if (!row || now > row.resetAt) {
    seen.set(key, { count: 1, resetAt: now + WINDOW_MS });
    return false;
  }
  row.count += 1;
  // Bound the map: a busy instance should not accumulate sessions for ever.
  if (seen.size > 5000) {
    for (const [k, v] of seen) if (now > v.resetAt) seen.delete(k);
  }
  return row.count > LIMIT;
}

export async function POST(req: NextRequest) {
  if (!lunaAiConfigured()) {
    return NextResponse.json({ ok: false, reason: 'not_configured' });
  }

  let body: { question?: unknown; context?: unknown; booking?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, reason: 'bad_json' }, { status: 400 });
  }

  const question = typeof body.question === 'string' ? body.question.trim().slice(0, 500) : '';
  const context = typeof body.context === 'string' ? body.context.trim().slice(0, 24_000) : '';
  if (!question || !context) {
    return NextResponse.json({ ok: false, reason: 'missing' }, { status: 400 });
  }

  // ── Who is asking ──
  const token = req.cookies.get(SESSION_COOKIE)?.value || '';
  const claims = token ? await verifySession(token) : null;
  const allowDemo = process.env.LUNA_AI_ALLOW_DEMO === '1';
  if (!claims && !allowDemo) {
    return NextResponse.json({ ok: false, reason: 'no_session' });
  }

  const who = claims?.travellerId || `demo:${req.headers.get('x-forwarded-for') || 'local'}`;
  if (overLimit(who)) {
    return NextResponse.json({ ok: false, reason: 'rate_limited' });
  }

  // ── Last guard before it leaves the building ──
  //
  // The client builds the context and the client can be wrong, so the names,
  // email and PNRs are checked here too. A leak would be a customer's details
  // in a third party's logs, which is worth a belt as well as braces.
  if (body.booking && typeof body.booking === 'object') {
    const forbidden = forbiddenStrings(body.booking as Booking);
    const hit = forbidden.find((s) => context.includes(s));
    if (hit) {
      console.error('[luna] refused to send context containing personal data');
      return NextResponse.json({ ok: false, reason: 'context_rejected' });
    }
  }

  // The name the agency gave its assistant, from our own store rather than the
  // phone: it goes into the model's instructions.
  const assistant = claims?.agencyId ? (await getBrandingOverride(claims.agencyId)).assistantName : undefined;
  const reply = await askLuna(question, context, assistant);
  if (!reply.ok || isRefusal(reply.text)) {
    return NextResponse.json({ ok: false, reason: 'no_answer' });
  }

  console.log('[luna] answered', {
    via: reply.via,
    inputTokens: reply.inputTokens,
    outputTokens: reply.outputTokens,
  });

  return NextResponse.json({ ok: true, text: reply.text });
}
