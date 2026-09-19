/**
 * The model layer — server only.
 *
 * Everything specific to a booking is answered deterministically before this is
 * ever called (src/lib/luna-booking.ts, luna-essentials.ts, luna-knowledge.ts).
 * This exists for the questions those cannot reach: "what's there to do with
 * teenagers on a wet afternoon", "is it worth hiring a car for a week",
 * "what's on near the hotel in the evenings".
 *
 * THE RULE THE WHOLE THING RESTS ON. The model answers from the supplied
 * context and from nothing else. It is not a travel expert here; it is a
 * reader. Where the context does not support an answer it says so and the
 * traveller is offered their agent — which is the same honest failure the
 * deterministic layers already give.
 *
 * Two backends, matching the pattern booking-extract.ts already established:
 *   1. Luna Chat's internal service, when LUNA_CHAT_URL is set — reuses the
 *      Brain widget's credentials and credits.
 *   2. A direct Anthropic Messages call as the fallback.
 * Neither configured → { ok: false }, and the caller falls back to the handoff.
 */

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';

/**
 * Sonnet 5, because grounding adherence matters more here than anything else:
 * the failure that costs an agency is a confident invented fact, not a slow
 * reply. Override with LUNA_CHAT_MODEL.
 *
 * Note this is deliberately NOT ANTHROPIC_MODEL, which booking-extract uses for
 * PDF extraction — a different job with different tolerances, and changing one
 * should not silently change the other.
 */
const DEFAULT_MODEL = 'claude-sonnet-5';

/** The marker the model returns when the context cannot answer the question. */
export const CANNOT_ANSWER = 'CANNOT_ANSWER';

export function lunaAiConfigured(): boolean {
  return !!(process.env.LUNA_CHAT_URL || process.env.ANTHROPIC_API_KEY);
}

const SYSTEM = `You are Luna, a travel concierge inside a holiday app. You are answering one traveller about one trip they have already booked and paid for.

THE CONTEXT BELOW IS YOUR ONLY SOURCE. It contains their booking, the destination content the agency publishes, and verified country facts. Answer from it and from nothing else.

Rules, in order of importance:

1. NEVER invent or alter a fact about their booking. Times, dates, flight numbers, hotel names, room types and durations appear in the context exactly as they are. Repeat them exactly or not at all.
2. If the context does not answer the question, reply with exactly ${CANNOT_ANSWER} and nothing else. Do not apologise, do not guess, do not fall back on general knowledge about the destination. A traveller is better served by their agent than by a plausible invention.
3. Never state a price, a fee, an opening time, an availability or a phone number that is not in the context. These are the facts that cost an agency money when they are wrong.
4. Never promise anything on the agency's behalf — no upgrades, no refunds, no "they can definitely arrange that".
5. Anything you say about the weather is a long-term average, not a forecast, and you say so.
6. Where the context marks something as being on at another time of year, do not imply it is on during their trip.

Style: British English. Warm, brief, specific. Two or three short paragraphs at most, usually one. No bullet lists unless you are genuinely listing things. No emoji. Do not open with "Certainly" or "Great question". Write as a knowledgeable person who has read their file, not as a brochure.

If the traveller asks something that needs a human — changing the booking, a complaint, anything about money — answer what you can from the context and say their agent handles the rest.`;

export interface AiReply {
  ok: boolean;
  /** Absent when ok is false, or when the model returned the marker. */
  text?: string;
  /** For logging: which backend answered, and roughly what it cost. */
  via?: 'luna-chat' | 'anthropic';
  inputTokens?: number;
  outputTokens?: number;
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: { input_tokens?: number; output_tokens?: number };
}

async function viaAnthropic(question: string, context: string): Promise<AiReply> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return { ok: false };

  const res = await fetch(ANTHROPIC_URL, {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model: process.env.LUNA_CHAT_MODEL || DEFAULT_MODEL,
      max_tokens: 700,
      system: SYSTEM,
      messages: [
        {
          role: 'user',
          content: `<context>\n${context}\n</context>\n\nThe traveller asks: ${question}`,
        },
      ],
    }),
    cache: 'no-store',
    // Long enough for a considered answer, short enough that a traveller is not
    // left watching a typing indicator. The caller falls back on timeout.
    signal: AbortSignal.timeout(20_000),
  });

  if (!res.ok) {
    let detail = '';
    try {
      const e = (await res.json()) as { error?: { message?: string } };
      detail = e?.error?.message || '';
    } catch {
      /* the status is enough */
    }
    console.error('[luna-ai] anthropic', res.status, detail);
    return { ok: false };
  }

  const json = (await res.json()) as AnthropicResponse;
  const text = (json.content || [])
    .filter((b) => b?.type === 'text')
    .map((b) => b.text || '')
    .join('')
    .trim();

  return {
    ok: true,
    text,
    via: 'anthropic',
    inputTokens: json.usage?.input_tokens,
    outputTokens: json.usage?.output_tokens,
  };
}

async function viaLunaChat(question: string, context: string): Promise<AiReply> {
  const url = process.env.LUNA_CHAT_URL;
  const key = process.env.TG_INTERNAL_KEY;
  if (!url || !key) return { ok: false };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-tg-internal-key': key },
    body: JSON.stringify({ system: SYSTEM, context, question, maxTokens: 700 }),
    cache: 'no-store',
    signal: AbortSignal.timeout(20_000),
  });
  if (!res.ok) {
    console.error('[luna-ai] luna-chat', res.status);
    return { ok: false };
  }
  const json = (await res.json()) as { answer?: string; text?: string };
  const text = (json.answer || json.text || '').trim();
  return text ? { ok: true, text, via: 'luna-chat' } : { ok: false };
}

/**
 * Ask the model.
 *
 * Returns ok:false for every failure — unconfigured, down, timed out, or a
 * refusal — because the caller's response to all of them is identical: offer
 * the agent. A traveller should never see a stack trace or a shrug that sounds
 * like a bug.
 */
export async function askLuna(question: string, context: string): Promise<AiReply> {
  if (!question.trim() || !context.trim()) return { ok: false };

  try {
    if (process.env.LUNA_CHAT_URL) {
      const viaService = await viaLunaChat(question, context);
      if (viaService.ok) return viaService;
      // Fall through to Anthropic rather than failing: the point of two
      // backends is that one of them being down is survivable.
    }
    return await viaAnthropic(question, context);
  } catch (e) {
    console.error('[luna-ai] threw', e instanceof Error ? e.message : e);
    return { ok: false };
  }
}

/**
 * Did the model decline?
 *
 * Checked loosely on purpose. A model told to return a bare marker will
 * occasionally wrap it in a sentence, and treating that as an answer would show
 * a traveller the word CANNOT_ANSWER.
 */
export function isRefusal(text: string | undefined): boolean {
  if (!text) return true;
  const t = text.trim();
  if (!t) return true;
  return t.length < 120 && t.toUpperCase().includes(CANNOT_ANSWER);
}
