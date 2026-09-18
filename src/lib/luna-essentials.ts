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

  /**
   * Luna Brain's structured country facts. Each one is a verified field with a
   * Last Verified date behind it, and none of them were being used — a
   * traveller asking "is the water safe to drink" got the handoff while Brain
   * held the answer.
   */
  tapWaterSafe?: string;
  vaccinations?: string;
  drivingSide?: string;
  diallingCode?: string;
  ukEmbassy?: string;
  timeZone?: string;
  lastVerified?: string;
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
  // Deliberately NOT "how much is" — that opens a question about the price of
  // something ("how much is a taxi from the airport"), which naming the
  // currency does not answer. It displaced the honest handoff with a non-answer.
  if (/\b(currency|cash|exchange rate|money to take|convert|atms?)\b/.test(q) || /\bwhat.{0,6}(currency|money)\b/.test(q)) {
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

  // ── Tap water ──
  if (/\b(tap water|drink the water|water safe|bottled water|safe to drink)\b/.test(q)) {
    const safe = (ctx.tapWaterSafe || '').trim();
    if (!safe) return null;
    const yes = /^yes|generally safe/i.test(safe);
    return {
      text: yes
        ? `Yes — tap water in ${ctx.destinationLabel} is safe to drink (${safe}). Take a refillable bottle and you will save a fortune.`
        : `No — stick to bottled or filtered water in ${ctx.destinationLabel} (${safe}). That includes ice outside hotels and resorts, and brushing your teeth if you are being careful.`,
      pills: [MORE],
    };
  }

  // ── Vaccinations ──
  if (/\b(vaccin|jab|jabs|injection|immunis|immuniz|malaria|shots)\b/.test(q)) {
    const vax = (ctx.vaccinations || '').trim();
    if (!vax) return null;
    return {
      text:
        `${vax}\n\nThat is the general position for ${ctx.destinationLabel} — your GP or a travel clinic should confirm it against your own history, ideally six to eight weeks before you go.`,
      pills: [MORE],
    };
  }

  // ── Driving ──
  if (/\b(driv|drive|driving|car hire|hire car|which side of the road|licence|license)\b/.test(q)) {
    const side = (ctx.drivingSide || '').trim();
    if (!side) return null;
    return {
      text: `They drive on the ${side.toLowerCase()} in ${ctx.destinationLabel}${/left/i.test(side) ? ', the same as home' : ', the opposite of home'}. Most hire companies want a full licence held for a year or more, and some ask for an international permit — worth checking before you book.`,
      pills: [MORE],
    };
  }

  // ── Phoning home, and the embassy ──
  if (/\b(dial|dialling|calling code|country code|phone home|ring home|embassy|consulate|high commission)\b/.test(q)) {
    const wantsEmbassy = /\b(embassy|consulate|high commission)\b/.test(q);
    if (wantsEmbassy) {
      const embassy = (ctx.ukEmbassy || '').trim();
      if (!embassy) return null;
      return { text: embassy, pills: [MORE] };
    }
    const code = (ctx.diallingCode || '').trim();
    if (!code) return null;
    return {
      text: `${ctx.destinationLabel}'s dialling code is ${code}. To ring a UK number from there, dial +44 and drop the leading zero.`,
      pills: [MORE],
    };
  }

  // ── Time difference ──
  if (/\b(time difference|what time is it|ahead|behind|time zone|timezone|clocks)\b/.test(q)) {
    const tz = (ctx.timeZone || '').trim();
    if (!tz) return null;
    return {
      text: `${ctx.destinationLabel} is on ${tz}. Your itinerary already shows every time in local time, so there is nothing to convert.`,
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
