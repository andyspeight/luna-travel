'use client';

import { useEffect, useRef, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
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
  const lead = leadTraveller(booking);
  const safeContext = buildSafeContext(booking);

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
    setDraft('');
    // Add user message
    const userMsg: ChatMessage = { id: `u-${Date.now()}`, from: 'user', text };
    setMessages((prev) => [...prev, userMsg]);
    setTyping(true);

    // Simulate Luna thinking, then respond
    window.setTimeout(() => {
      const reply = lunaAnswer(text, booking);
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
  booking: Booking
): { text: string; pills?: string[] } {
  const q = question.toLowerCase();
  const cc = booking.primaryCountryCode;
  const dest = booking.destinationLabel;

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

  // Packing
  if (q.includes('pack') || q.includes('what to wear') || q.includes('what to bring')) {
    const list = PACKING_LISTS[cc] ?? `For ${dest}: comfortable layers, walking shoes, sun protection, and your travel adapter. Want me to tailor it for kids in the party, or for any specific activities?`;
    return {
      text: list,
      pills: ['What about kids?', 'Sun protection tips'],
    };
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

  // Generic fallback
  return {
    text: `Happy to help with that. I can answer questions about your flights, hotel, check-in, weather, packing, visas and lounges — or pass anything trickier to ${booking.agency.name}. What would you like to know?`,
    pills: pillsFor(booking),
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

const PACKING_LISTS: Record<string, string> = {
  MV: 'For the Maldives I\'d pack: swimwear (2–3 sets so they can dry), reef-safe sunscreen, a rash vest for snorkelling, light cottons for evenings, flip-flops + closed-toe shoes for the boat, a brimmed hat, and a small dry bag for excursions. Want me to add anything for the kids in your party?',
  ES: 'For Mallorca in summer: swimwear, beach cover-up, light cottons, sandals + comfortable walking shoes (for inland villages), strong sunscreen, sun hat, refillable water bottle. If you\'re planning Tramuntana drives, layers for evenings.',
  AE: 'For Dubai in October: lightweight long sleeves (the malls run cold), modest cover-ups for cultural sites, sunglasses, comfortable shoes for desert excursions, swimwear, and one smart-casual outfit for premium restaurants. Avoid black — heat retains.',
  GR: 'For Athens in September: comfortable walking shoes (essential for the Acropolis), light cottons, a wider sun hat, water bottle, and a light layer for tavernas after dark. Lots of marble and uneven ground — leave the heels at home.',
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
