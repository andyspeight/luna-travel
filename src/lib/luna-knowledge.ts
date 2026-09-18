/**
 * Searching Luna Brain's answers for the question that was actually asked.
 *
 * Brain holds hundreds of verified Q&A rows — visas, health, money, transport,
 * culture — each with a source and a verification date, and the destination
 * screen already renders them by category. Luna never looked at them. A
 * traveller asking "is the water safe to drink" got the honest handoff while a
 * verified answer sat one layer away.
 *
 * Deliberately conservative. A wrong answer here is worse than no answer,
 * because Brain's rows carry an air of authority — they are the layer with the
 * source link. So a match has to clear a real bar, and anything short of it
 * returns null and lands on the handoff.
 *
 * Pure. The caller does the fetching.
 */

export interface KnowledgeItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  confidence?: string;
  source?: string;
  lastVerified?: string;
}

/** Words that appear in every travel question and so distinguish nothing. */
const STOP = new Set([
  'the', 'a', 'an', 'is', 'are', 'was', 'do', 'does', 'did', 'i', 'we', 'you', 'my', 'our',
  'me', 'us', 'it', 'to', 'of', 'in', 'on', 'at', 'for', 'and', 'or', 'but', 'if', 'can',
  'will', 'would', 'should', 'need', 'any', 'there', 'what', 'when', 'where', 'how', 'why',
  'much', 'many', 'get', 'got', 'have', 'has', 'be', 'been', 'am', 'this', 'that', 'with',
  'about', 'from', 'like', 'go', 'going', 'trip', 'holiday', 'please', 'thanks',
]);

function tokens(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOP.has(w))
    // Crude singularisation, so "vaccinations" matches "vaccination".
    .map((w) => (w.length > 4 && w.endsWith('s') ? w.slice(0, -1) : w));
}

/**
 * How well an item answers the question, 0..1.
 *
 * The item's own QUESTION is weighted far above its answer text. Brain's
 * answers are long and range across destinations — the ferries row mentions
 * Greece, Croatia, Thailand, the Maldives, Venice and Bali — so scoring on
 * answer text alone matches almost anything to almost everything.
 */
function score(queryTokens: string[], item: KnowledgeItem): number {
  if (!queryTokens.length) return 0;
  const inQuestion = new Set(tokens(item.question));
  const inAnswer = new Set(tokens(item.answer).slice(0, 120));

  let hits = 0;
  let questionHits = 0;
  let weighted = 0;
  for (const t of queryTokens) {
    if (inQuestion.has(t)) {
      hits += 1;
      questionHits += 1;
      weighted += 1;
    } else if (inAnswer.has(t)) {
      hits += 1;
      weighted += 0.25;
    }
  }
  if (!hits) return 0;

  // Plenty of real questions come down to one or two words once the filler is
  // gone — "what should I wear?" is just "wear". Those are allowed, but they
  // have to land on the item's own QUESTION: finding "wear" somewhere in a long
  // answer about six countries is not a match.
  if (queryTokens.length <= 2) {
    if (questionHits < queryTokens.length) return 0;
  } else if (hits < 2) {
    // With more to go on, one word in common is a coincidence.
    return 0;
  }

  return weighted / queryTokens.length;
}

/**
 * The bar a match has to clear.
 *
 * Set by trying it: below this, the ferry row starts answering questions about
 * taxis because they share the word "airport".
 */
const THRESHOLD = 0.5;

export interface KnowledgeMatch {
  item: KnowledgeItem;
  score: number;
}

/** The best verified answer for a question, or null. */
export function findKnowledge(question: string, items: KnowledgeItem[]): KnowledgeMatch | null {
  const q = tokens(question);
  // One meaningful token is allowed — "what should I wear?" reduces to "wear" —
  // because score() then requires it to land on an item's own question.
  if (!q.length || !items.length) return null;

  let best: KnowledgeMatch | null = null;
  for (const item of items) {
    if (!item.answer?.trim()) continue;
    const s = score(q, item);
    if (s >= THRESHOLD && (!best || s > best.score)) best = { item, score: s };
  }
  return best;
}

/**
 * The answer as Luna says it.
 *
 * Brain rows are written for a knowledge base, not a conversation, so long ones
 * are trimmed to the part that answers rather than dumped whole. Where a row
 * was checked, the date is given: these are the only answers in the app that
 * carry provenance, and hiding it would waste the one thing that makes them
 * more trustworthy than the rest.
 */
export function knowledgeReply(match: KnowledgeMatch): { text: string } {
  const { item } = match;
  const body = item.answer.trim();

  // Long rows are a list of destinations. Keep the paragraphs, cap the length,
  // and never cut mid-sentence.
  let text = body;
  if (body.length > 700) {
    const cut = body.slice(0, 700);
    const lastBreak = Math.max(cut.lastIndexOf('\n\n'), cut.lastIndexOf('. '));
    text = lastBreak > 200 ? `${cut.slice(0, lastBreak + 1).trim()}` : `${cut.trim()}…`;
  }

  if (item.lastVerified) {
    text += `\n\nChecked ${item.lastVerified}.`;
  }
  return { text };
}
