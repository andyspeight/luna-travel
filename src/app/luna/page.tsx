'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { usePlace } from '@/lib/use-place';
import { useBrainGuide } from '@/lib/use-brain';
import { packingList } from '@/lib/packing';
import { getDestinationGuide } from '@/data/destinations';
import { resolveGuide } from '@/lib/guide-merge';
import { essentialsAnswer, type EssentialsContext } from '@/lib/luna-essentials';
import { PageEnter } from '@/components/page-enter';
import {
  IconInfo,
  IconSend,
} from '@/components/icons';
import { leadTraveller } from '@/lib/booking-helpers';
import { formatBoard, formatDayMonth } from '@/lib/format';
import type { Booking } from '@/types/booking';

interface ChatMessage {
  id: string;
  from: 'luna' | 'user';
  text: string;
  pills?: string[]; // suggested follow-ups, appended after Luna messages only
}

/**
 * Luna concierge.
 *
 * Trip context is pre-loaded into a redacted summary banner and informs the
 * answers. For the prototype the responses are pre-written per destination —
 * deterministic for show demos, swap to a real API call in production.
 *
 * Security note: the context shown to the user is the same shape that gets
 * passed to the AI in production via getSafeContextSummary() — no names,
 * no emails, no prices. Only destination, dates, party shape, board basis.
 */
export default function LunaPage() {
  const { booking } = useBooking();
  const { place } = usePlace(booking);
  const { brain } = useBrainGuide(booking);
  const lead = leadTraveller(booking);
  const safeContext = buildSafeContext(booking);

  // The same data the essentials screen renders. Built here so a question about
  // plugs or packing is answered from the booking's own destination rather than
  // from a country-by-country list that only ever covered four of them.
  const essentials = useMemo<EssentialsContext>(() => {
    // The same three-source merge the destination and essentials screens use,
    // rather than reading place content alone. Brain composes a plug string
    // from its own voltage + plug type, and the static guide carries emergency
    // numbers, so going straight to `place` silently answered nothing for any
    // destination whose facts live in the other two layers.
    const guide = resolveGuide({
      countryCode: booking.primaryCountryCode,
      place,
      brain: brain ? { destination: brain.destination ?? undefined } : null,
      staticGuide: getDestinationGuide(booking.primaryCountryCode),
    });
    const plug = guide.voltageAndPlug || '';
    const tipping = (brain?.byCategory ?? [])
      .flatMap((c) => c.items)
      .find((a) => /tip|gratuit|service charge/i.test(`${a.question} ${a.answer}`))?.answer;
    return {
      destinationLabel: booking.destinationLabel,
      currencyLabel: guide.currency || '',
      languageLabel: guide.languages || '',
      voltageAndPlug: plug,
      emergencyNumber: guide.emergencyNumber || '',
      tipping,
      packing: packingList({
        tripStart: booking.tripStart,
        tripEnd: booking.tripEnd,
        climate: place?.climate ?? null,
        tags: [...(place?.bestForTags ?? []), ...(place?.audienceTags ?? [])],
        voltageAndPlug: plug,
        travellerTypes: booking.travellers.map((t) => t.type),
        hasFlights: booking.flights.length > 0,
      }),
    };
  }, [booking, place, brain]);

  const [messages, setMessages] = useState<ChatMessage[]>(() => initialMessages(booking, lead.firstName));
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const threadRef = useRef<HTMLDivElement | null>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    if (threadRef.current) {
      threadRef.current.scrollTop = threadRef.current.scrollHeight;
    }
  }, [messages, typing]);

  const send = (raw: string) => {
    const text = raw.trim();
    if (!text || typing) return;

    // Agent handoff (offered when Luna can't answer) — open email/phone, no chat bubble
    if (text === 'Email my agent' && booking.agency.email) {
      setDraft('');
      const subject = encodeURIComponent(`Question about my trip ${booking.reference}`);
      const body = encodeURIComponent(
        `Hi ${booking.agency.name},\n\nI have a question about my booking (${booking.reference}):\n\n`
      );
      window.location.href = `mailto:${booking.agency.email}?subject=${subject}&body=${body}`;
      return;
    }
    if (text === 'Call my agent' && booking.agency.phone) {
      setDraft('');
      window.location.href = `tel:${booking.agency.phone.replace(/\s/g, '')}`;
      return;
    }

    setDraft('');
    // Add user message
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    // Simulate Luna thinking, then respond
    window.setTimeout(() => {
      const reply = lunaAnswer(text, booking, essentials);
      setMessages((prev) => [
        ...prev,
        { id: `l-${Date.now()}`, from: 'luna', text: reply.text, pills: reply.pills },
      ]);
      setTyping(false);
    }, 700);
  };

  return (
    <PageEnter>
      <div className="flex flex-col min-h-[calc(100dvh-88px-var(--safe-top))]">
        {/* Header */}
        <header className="px-5 pt-3 pb-3 border-b border-line-light">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-navy to-teal text-white font-bold text-sm flex items-center justify-center">
              L
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-base font-semibold text-ink leading-tight">Luna</div>
              <div className="text-[11px] text-success inline-flex items-center gap-1 mt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-success" />
                {booking.agency.name} concierge
              </div>
            </div>
          </div>
        </header>

        {/* Trip context banner */}
        <div className="px-5 py-2.5 bg-teal/5 border-b border-teal/10 text-[11px] text-teal-dark dark:text-teal-light inline-flex items-start gap-1.5 leading-relaxed">
          <IconInfo size={12} className="flex-shrink-0 mt-0.5" />
          <span>
            <span className="font-semibold">Luna knows:</span> {safeContext}
          </span>
        </div>

        {/* Thread */}
        <div
          ref={threadRef}
          className="flex-1 overflow-y-auto px-4 py-4 space-y-3 scrollbar-thin"
        >
          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} onPill={send} />
          ))}
          {typing && <TypingBubble />}
        </div>

        {/* Composer */}
        <div className="px-4 py-3 border-t border-line-light bg-surface flex items-center gap-2">
          <input
            type="text"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                send(draft);
              }
            }}
            placeholder="Ask Luna anything about your trip…"
            aria-label="Ask Luna"
            enterKeyHint="send"
            className="flex-1 h-10 px-4 rounded-full bg-surface-3 text-sm text-ink placeholder:text-ink-3 outline-none focus:ring-2 focus:ring-teal/40"
          />
          <button
            type="button"
            aria-label="Send"
            onClick={() => send(draft)}
            disabled={!draft.trim() || typing}
            className="w-10 h-10 rounded-full bg-navy text-white dark:bg-teal dark:text-navy-dark flex items-center justify-center flex-shrink-0 disabled:opacity-40 transition-opacity"
          >
            <IconSend size={18} />
          </button>
        </div>
      </div>
    </PageEnter>
  );
}

function MessageBubble({
  message,
  onPill,
}: {
  message: ChatMessage;
  onPill: (text: string) => void;
}) {
  const mine = message.from === 'user';
  return (
    <div className={mine ? 'flex justify-end' : 'flex flex-col items-start'}>
      <div
        className={[
          'max-w-[82%] px-3.5 py-2.5 text-[14px] leading-snug',
          mine
            ? 'bg-navy text-white dark:bg-teal dark:text-navy-dark rounded-2xl rounded-br-md'
            : 'bg-surface text-ink border border-line-light rounded-2xl rounded-bl-md',
        ].join(' ')}
      >
        {message.text}
      </div>
      {message.pills && message.pills.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2 max-w-[82%]">
          {message.pills.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => onPill(p)}
              className="text-xs font-medium px-3 py-1.5 rounded-full bg-surface border border-line text-ink hover:border-teal/40 hover:bg-teal/5 transition-colors"
            >
              {p}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function TypingBubble() {
  return (
    <div className="flex justify-start">
      <div className="bg-surface border border-line-light rounded-2xl rounded-bl-md px-4 py-3 inline-flex items-center gap-1">
        <Dot delay={0} />
        <Dot delay={150} />
        <Dot delay={300} />
      </div>
    </div>
  );
}

function Dot({ delay }: { delay: number }) {
  return (
    <span
      className="w-1.5 h-1.5 rounded-full bg-ink-3"
      style={{
        animation: 'pulse 1.2s ease-in-out infinite',
        animationDelay: `${delay}ms`,
      }}
    />
  );
}

/**
 * Build the trip context summary line, redacted for safety.
 * Mirrors the production `getSafeContextSummary()` rules: no names, no email,
 * no exact prices. Just destination, dates, party shape, board basis.
 */
function buildSafeContext(booking: Booking): string {
  const adults = booking.travellers.filter((t) => t.type === 'adult').length;
  const children = booking.travellers.filter((t) => t.type === 'child').length;
  const partyParts: string[] = [];
  if (adults) partyParts.push(`${adults} adult${adults === 1 ? '' : 's'}`);
  if (children) partyParts.push(`${children} child${children === 1 ? '' : 'ren'}`);
  const board = formatBoard(booking.hotels[0]?.boardBasis);

  return [
    booking.destinationLabel,
    formatDayMonth(booking.tripStart),
    partyParts.join(', '),
    board,
  ]
    .filter(Boolean)
    .join(' · ');
}

function initialMessages(booking: Booking, firstName: string): ChatMessage[] {
  const daysAway = Math.ceil(
    (new Date(booking.tripStart).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
  );
  const dest = booking.destinationLabel;
  const starter: ChatMessage = {
    id: 'l-1',
    from: 'luna',
    text:
      daysAway > 0
        ? `Hi ${firstName} — ${daysAway} day${daysAway === 1 ? '' : 's'} until you head to ${dest}. How can I help?`
        : `Welcome back ${firstName}! How was ${dest}?`,
    pills: pillsFor(booking),
  };
  return [starter];
}

/** The handoff options this agency actually offers. */
function agentPillsFor(booking: Booking): string[] {
  const pills: string[] = [];
  if (booking.agency.email) pills.push('Email my agent');
  if (booking.agency.phone) pills.push('Call my agent');
  return pills;
}

function pillsFor(booking: Booking): string[] {
  const dest = booking.destinationLabel;
  const hasFlights = booking.flights.length > 0;
  const pills = [
    `Do I need a visa for ${dest}?`,
    `What's the weather like the week we're there?`,
  ];
  if (hasFlights) pills.push('Online check-in time?');
  pills.push('Build a packing list');
  return pills;
}

/**
 * Pre-canned answers. Returns reply text plus optional follow-up pills.
 * Keyed by destination country code and question topic.
 */
function lunaAnswer(
  question: string,
  booking: Booking,
  essentials: EssentialsContext,
): { text: string; pills?: string[] } {
  const q = question.toLowerCase();
  const cc = booking.primaryCountryCode;
  const dest = booking.destinationLabel;

  // Pleasantries first, BEFORE the data layer. "Hello" reaches the phrase book
  // otherwise, and a traveller who says hello to their concierge gets taught to
  // say it in Greek. Answering it with "I can't answer that one for certain"
  // was no better — it read as broken before they had asked anything.
  if (/^(hi|hey|hello|good morning|good afternoon|good evening|yo)\b[\s!.?]*$/.test(q)) {
    return { text: `Hello. What can I help with for ${dest}?`, pills: pillsFor(booking) };
  }
  if (/^(thanks|thank you|ta|cheers|great|perfect|lovely|ok|okay)\b[\s!.?]*$/.test(q)) {
    return { text: "You're welcome. Anything else?" };
  }

  // Losing a passport is an emergency, and it was being answered with the
  // validity rules — the expiry date is not the problem when the passport is
  // gone. Ahead of the passport branch below, which handles the ordinary
  // "how long does mine need left on it" question.
  if (/\b(lost|lose|losing|stolen|stole|missing)\b/.test(q) && /\b(passport|documents?)\b/.test(q)) {
    return {
      text:
        `That needs handling today. Report it to the local police and get a written report, then contact the nearest British embassy or consulate — they issue an emergency travel document, usually within a couple of working days. Tell ${booking.agency.name} as well, because they may need to change your return flight.\n\n` +
        'Report it lost or stolen at gov.uk/report-a-lost-or-stolen-passport so nobody else can use it.',
      pills: agentPillsFor(booking),
    };
  }

  // Then the shared data layer, which answers from the booking's own
  // destination and so covers every country in the content base rather than the
  // handful with written replies below. It returns null when it has no data,
  // which lands on the honest handoff at the bottom of this function.
  const fromData = essentialsAnswer(question, essentials);
  if (fromData) return fromData;

  // Visa
  if (q.includes('visa')) {
    const visa = VISA_ANSWERS[cc] ?? `For ${dest}, requirements vary by passport. I'd suggest checking the FCDO Travel Advice page for your nationality — your agent can confirm specifics if you'd like.`;
    return {
      text: visa,
      pills: ['Passport validity rules?', 'Build a packing list'],
    };
  }

  // Weather
  if (q.includes('weather') || q.includes('temperature') || q.includes('rain')) {
    const weather = WEATHER_ANSWERS[cc] ?? `Late ${monthName(booking.tripStart)} in ${dest} tends to be pleasant. I can pull a full forecast closer to your travel date.`;
    return {
      text: weather,
      pills: ['Build a packing list', 'What to wear evenings?'],
    };
  }

  // Check-in
  if (q.includes('check-in') || q.includes('check in')) {
    if (booking.flights.length > 0) {
      const f = booking.flights[0];
      return {
        text: `Online check-in for ${f.flightNumber} (${f.depAirport} → ${f.arrAirport}) opens 24 hours before departure. I'll push a notification the moment it's available so you can claim your seats together.`,
        pills: ['What about baggage rules?', 'Lounge access details'],
      };
    }
    if (booking.hotels.length > 0) {
      const h = booking.hotels[0];
      return {
        text: `${h.name} check-in is from 15:00 on arrival day. Earlier arrivals can usually leave bags at reception — happy to message the hotel on your behalf if you'd like.`,
        pills: ['Hotel contact details?', 'Local taxi options'],
      };
    }
  }

  // Things to do / food
  if (q.includes('eat') || q.includes('food') || q.includes('restaurant')) {
    const food = FOOD_TIPS[cc] ?? `Happy to suggest places to eat in ${dest}. Are you looking for something quick, local family-friendly, or a proper night out?`;
    return {
      text: food,
      pills: ['Family-friendly options', 'Best local dishes to try'],
    };
  }

  // Passport
  if (q.includes('passport')) {
    return {
      text: `Most destinations need your passport valid for at least 3 months past your return date (UK rule). For ${dest} specifically, you'll need at least one month past your return date. Want me to double-check expiry against your booking?`,
      pills: [`Visa rules for ${dest}?`],
    };
  }

  // Lounge
  if (q.includes('lounge')) {
    const lounge = booking.airportExtras.find((x) => x.type === 'lounge');
    if (lounge) {
      return {
        text: `You're confirmed for ${lounge.name} on ${formatDayMonth(lounge.date)} for ${lounge.guests} guest${lounge.guests === 1 ? '' : 's'}. Show your booking pack at reception — I've also added a separate lounge pass to your Documents.`,
        pills: ['What about baggage rules?', 'Online check-in time?'],
      };
    }
    return {
      text: `No lounge included on this booking, but I can suggest pay-on-arrival options at ${booking.flights[0]?.depAirport ?? 'the airport'} if that's helpful.`,
    };
  }

  // Generic fallback — be honest, hand off to the agent (no unrelated topic pills)
  const agentPills = agentPillsFor(booking);
  return {
    text: `I can't answer that one for certain, and I'd rather not guess. Your agent at ${booking.agency.name} will be able to help. Want me to put you in touch?`,
    pills: agentPills.length ? agentPills : undefined,
  };
}

const VISA_ANSWERS: Record<string, string> = {
  MV: 'Good news — UK passport holders get a free 30-day visa on arrival in the Maldives. You\'ll need a passport valid for at least one month past your return date, and proof of onward travel — which your Etihad return ticket covers.',
  ES: 'UK passport holders get up to 90 days visa-free in the Schengen area in any 180-day period. Make sure your passport has at least 3 months\' validity from your return date. Bring proof of accommodation and onward travel just in case border control asks.',
  AE: 'UK passport holders get a free visa on arrival in the UAE (30 days, extendable). Passport must be valid for at least 6 months from arrival date. You\'ll also need a return ticket — which your Emirates booking covers.',
  GR: 'UK passport holders get up to 90 days visa-free in the Schengen area (Greece is included). Passport needs at least 3 months\' validity past your return date. Easy in, easy out.',
};

const WEATHER_ANSWERS: Record<string, string> = {
  MV: 'Late November is the start of dry season in the Maldives. Expect 29–31°C, sunshine most days, occasional short showers. Sea temperature around 28°C. Pack light, breathable layers and reef-safe sunscreen.',
  ES: 'July and August in Mallorca are reliably hot — 26–30°C, dry, sea around 25°C. Mornings and evenings stay warm. Pack swimwear, light cottons, and a light cover for after-sunset.',
  AE: 'Early October in Dubai is hot but easing — 30–35°C in the day, dropping mid-month. Low humidity, almost no rain. Bring lightweight clothes plus a layer for over-air-conditioned indoors and evenings near the water.',
  GR: 'Mid-September in Athens averages 24–29°C with warm evenings. Sea still around 24°C if you fancy a beach day at Vouliagmeni. Pack light layers and decent walking shoes for the Acropolis.',
};

const FOOD_TIPS: Record<string, string> = {
  MV: 'On Gulhi, try Tikorra Restaurant for fresh-caught fish curry and roshi flatbread (around £10pp), or Beach Garden for sunset BBQ. Most local-island spots are casual; cash in rufiyaa or USD is easier than card.',
  ES: 'In Alcúdia, try Cas Capellà for traditional Mallorcan in a courtyard setting. For something more relaxed, Pizzeria Toscana on the seafront is great for families. The night-market on Tuesdays has stalls until late.',
  AE: 'For Atlantis stays, Ossiano (Michelin underwater dining) is unforgettable for the anniversary. More casual: Pierchic on the water at Madinat Jumeirah. For local flavour: try Al Fanar in Festival City for proper Emirati food.',
  GR: 'In Plaka, skip the tourist-trap mains-on-display spots. Walk 10 minutes to Pangrati for proper neighbourhood tavernas. Try Mavro Provato for small plates with friends, or Karavitis if you want classic Greek done well.',
};

function monthName(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('en-GB', { month: 'long' });
  } catch {
    return '';
  }
}
