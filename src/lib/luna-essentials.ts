/**
 * The essentials, answered conversationally.
 *
 * The same data as the essentials screen, so asking Luna "what plug do I need"
 * and tapping through to the screen give the same answer. That was the point of
 * building one data layer rather than seven features: the data serves both
 * surfaces, and nothing is written per destination for either.
 *
 * WHAT THIS IS NOT. Ask Luna is a keyword router with written replies, not a
 * language model — see the note at the top of the Luna page. This does not
 * change that. What it changes is where the words come from: the four
 * hardcoded country packing lists answered four destinations and gave everyone
 * else a shrug, while these answer all of them from the booking's own data.
 *
 * Every answer returns null when the data behind it is missing, and the caller
 * falls through to Luna's existing "I'd rather not guess" handoff. An empty
 * answer is a good answer; an invented one is not.
 */

import type { PackingGroup } from '@/lib/packing';
import { currencyName } from '@/lib/currency-iso';
import { phrasesFor } from '@/lib/phrasebook';

export interface EssentialsContext {
  destinationLabel: string;
  /** "Thai Baht (฿)" as the content base writes it. */
  currencyLabel?: string;
  /** "Greek", or "Dutch, French". */
  languageLabel?: string;
  /** "230V · Type F". */
  voltageAndPlug?: string;
  emergencyNumber?: string;
  /** Already built by packingList(); this only puts it into sentences. */
  packing?: PackingGroup[];
  /** A verified tipping answer, where Luna Brain holds one. */
  tipping?: string;
}

export interface EssentialsReply {
  text: string;
  pills?: string[];
}

const MORE = 'Open Trip essentials';

/** Does the plug list mean a UK traveller can leave the adapter at home? */
function typeGOnly(plug: string): boolean {
  const types = plug.match(/Type\s+([A-Z](?:\/[A-Z])*)/i)?.[1] ?? '';
  const list = types.toUpperCase().split('/').filter(Boolean);
  return list.length === 1 && list[0] === 'G';
}

function packingSentence(groups: PackingGroup[], destination: string): string {
  // Lead with the group that is actually about the destination rather than the
  // documents, which are the same everywhere and make a dull opening line.
  const interesting = groups.filter((g) => g.title !== 'Documents' && g.title !== 'Tech');
  const source = interesting.length ? interesting : groups;

  const lines = source
    .slice(0, 4)
    .map((g) => `${g.title}: ${g.items.slice(0, 4).map((i) => i.label.toLowerCase()).join(', ')}`);

  return (
    `Here's what I'd pack for ${destination}, based on your dates and what you've booked:\n\n` +
    lines.join('\n') +
    '\n\nThe full list is in Trip essentials, with tick boxes.'
  );
}

/**
 * An answer, or null to let Luna's own router have it.
 *
 * Ordered by how specific the words are: "adapter" is unambiguous, "money"
 * less so, so the narrow matches are tested first.
 */
export function essentialsAnswer(question: string, ctx: EssentialsContext): EssentialsReply | null {
  const q = question.toLowerCase();

  // ── Power ──
  if (/\b(plug|adapter|adaptor|socket|voltage|charger|charge my)\b/.test(q)) {
    const plug = (ctx.voltageAndPlug || '').trim();
    if (!plug) return null;
    return {
      text: typeGOnly(plug)
        ? `Good news — ${ctx.destinationLabel} uses the same three-pin sockets as home (${plug}), so you can leave the adapter behind.`
        : `${ctx.destinationLabel} runs ${plug}, so you'll want a travel adapter. Worth packing two if you've phones and a camera to charge overnight.`,
      pills: [MORE, 'Build a packing list'],
    };
  }

  // ── Emergencies ──
  if (/\b(emergency|ambulance|police|999|112|hospital)\b/.test(q)) {
    const number = (ctx.emergencyNumber || '').trim();
    if (!number) return null;
    return {
      text: `Emergency services in ${ctx.destinationLabel}: ${number}. It's on the Trip essentials screen too, as a button you can press rather than something to type.`,
      pills: [MORE],
    };
  }

  // ── Tipping ──
  if (/\b(tip|tips|tipping|gratuity|service charge)\b/.test(q)) {
    const tipping = (ctx.tipping || '').trim();
    if (!tipping) return null;
    return { text: tipping, pills: [MORE] };
  }

  // ── Money ──
  if (/\b(currency|money|cash|exchange|convert|atm|how much is|what's a pound)\b/.test(q)) {
    const name = currencyName(ctx.currencyLabel);
    if (!name) return null;
    return {
      text: `${ctx.destinationLabel} uses the ${name}. There's a converter in Trip essentials with today's rate — it keeps the last rate it was given, so it still works when you've no signal.`,
      pills: [MORE],
    };
  }

  // ── Language ──
  if (/\b(say|speak|language|phrase|hello|thank you|please)\b/.test(q)) {
    const set = phrasesFor(ctx.languageLabel);
    if (!set) return null;
    const basics = set.groups[0]?.phrases ?? [];
    const hello = basics.find((p) => p.en === 'Hello');
    const thanks = basics.find((p) => p.en === 'Thank you');
    if (!hello || !thanks) return null;
    return {
      text:
        `A little ${set.language} goes a long way. Hello is "${hello.local}" (${hello.say}), ` +
        `and thank you is "${thanks.local}" (${thanks.say}).\n\n` +
        'There are a dozen more in Trip essentials, and the app will say them out loud for you.',
      pills: [MORE],
    };
  }

  // ── Packing ──
  if (/\b(pack|packing|what to wear|what to bring|what should i take)\b/.test(q)) {
    const groups = ctx.packing ?? [];
    if (!groups.length) return null;
    return {
      text: packingSentence(groups, ctx.destinationLabel),
      pills: [MORE],
    };
  }

  return null;
}
