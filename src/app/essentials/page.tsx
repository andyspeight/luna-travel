'use client';

/**
 * Trip essentials — the small things a traveller actually opens the app for.
 *
 * Seven utilities that competitors sell as paid add-ons, in one screen, free.
 * They share one data layer rather than being seven features with seven
 * sources: the destination content base supplies currency, language and plug
 * type; Luna Brain supplies the verified facts; the booking supplies the dates
 * and who is going. Nothing here is authored per destination.
 *
 * OFFLINE. Every card works with no signal except the converter, which cannot,
 * so it keeps the last rate it was given and says when that was. A stale rate
 * labelled honestly is useful; a stale rate presented as today's is worse than
 * nothing.
 *
 * Rule 8. Every card hides itself when its data is missing. A destination with
 * no plug type recorded shows no power card — not "Plug type: unknown", which
 * is a way of taking up space to say nothing.
 */

import { useEffect, useMemo, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { usePlace } from '@/lib/use-place';
import { useBrainGuide } from '@/lib/use-brain';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { getDestinationGuide } from '@/data/destinations';
import { resolveGuide } from '@/lib/guide-merge';
import { currencyIso, currencyName, currencySymbol } from '@/lib/currency-iso';
import { packingList, type PackingGroup } from '@/lib/packing';
import { phrasesFor, type PhraseSet } from '@/lib/phrasebook';
import { allergensFor, SHOW_DONT_SAY, type AllergenPhrase } from '@/lib/allergens';
import { emergencyNumbers } from '@/lib/emergency';
import {
  IconCoin,
  IconBaggage,
  IconChat,
  IconWarning,
  IconInfo,
  IconPhone,
  IconRefresh,
  IconCheck,
} from '@/components/icons';

// ───────── Shared furniture ─────────

function Section({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-6">
      <div className="flex items-center gap-2 mb-2">
        <span className="w-7 h-7 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center">
          {icon}
        </span>
        <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
      </div>
      {subtitle && <p className="text-[12px] text-ink-3 mb-2 leading-snug">{subtitle}</p>}
      {children}
    </section>
  );
}

function Card({ children }: { children: React.ReactNode }) {
  return <div className="p-4 rounded-xl bg-surface border border-line-light">{children}</div>;
}

// ───────── Money ─────────

interface CachedRate {
  rate: number;
  asOf: string;
  fetchedAt: string;
}

function rateKey(base: string, quote: string): string {
  return `luna-travel.fx.${base}.${quote}`;
}

function readCachedRate(base: string, quote: string): CachedRate | null {
  try {
    const raw = window.localStorage.getItem(rateKey(base, quote));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedRate;
    return typeof parsed?.rate === 'number' && parsed.rate > 0 ? parsed : null;
  } catch {
    return null;
  }
}

function writeCachedRate(base: string, quote: string, value: CachedRate): void {
  try {
    window.localStorage.setItem(rateKey(base, quote), JSON.stringify(value));
  } catch {
    /* a private window, or storage full — the converter still works this session */
  }
}

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/** Format in the local currency, letting Intl decide the decimal places. */
function money(amount: number, iso: string): string {
  try {
    return new Intl.NumberFormat('en-GB', {
      style: 'currency',
      currency: iso,
      maximumFractionDigits: amount >= 1000 ? 0 : 2,
    }).format(amount);
  } catch {
    // An ISO code Intl does not know — show the number and the code rather
    // than nothing.
    return `${amount.toFixed(2)} ${iso}`;
  }
}

const QUICK_AMOUNTS = [1, 5, 10, 20, 50, 100];

/**
 * The quick-reference grid carries bare numbers.
 *
 * Three columns is not wide enough for "MVR 1,942" and the code was being
 * truncated to "MVR 194…" — which is not a smaller number, it is a wrong one.
 * The currency is named directly above, so repeating it six times costs the
 * width that made the figures unreadable.
 */
function plainAmount(value: number): string {
  // Fixed precision within a band, so a column does not read
  // 19.42 / 97.1 / 194 with the decimals wandering.
  const places = value >= 100 ? 0 : 2;
  return new Intl.NumberFormat('en-GB', {
    minimumFractionDigits: places,
    maximumFractionDigits: places,
  }).format(value);
}

function Money({ label }: { label: string }) {
  const iso = currencyIso(label);
  const name = currencyName(label);
  const symbol = currencySymbol(label);

  const [rate, setRate] = useState<CachedRate | null>(null);
  const [state, setState] = useState<'loading' | 'live' | 'cached' | 'none'>('loading');
  const [amount, setAmount] = useState('10');
  const [inverted, setInverted] = useState(false);

  useEffect(() => {
    if (!iso) return;
    let alive = true;

    // Show whatever we already hold immediately, so an offline traveller sees
    // a rate rather than a spinner that never resolves.
    const cached = readCachedRate('GBP', iso);
    if (cached) {
      setRate(cached);
      setState('cached');
    }

    fetch(`/api/traveller/fx?to=${iso}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { ok?: boolean; rate?: number; asOf?: string } | null) => {
        if (!alive) return;
        if (data?.ok && typeof data.rate === 'number' && data.rate > 0) {
          const fresh: CachedRate = {
            rate: data.rate,
            asOf: data.asOf || new Date().toISOString(),
            fetchedAt: new Date().toISOString(),
          };
          setRate(fresh);
          setState('live');
          writeCachedRate('GBP', iso, fresh);
        } else if (!cached) {
          setState('none');
        }
      })
      .catch(() => {
        if (alive && !cached) setState('none');
      });

    return () => {
      alive = false;
    };
  }, [iso]);

  // The section carries its own heading so that a destination we cannot get a
  // rate for shows nothing, rather than the word "Money" over an empty box.
  // Nothing live and nothing cached is a real outcome — offline on the first
  // run, or a currency the provider does not carry.
  if (!iso || !rate) return null;

  const entered = Number(amount.replace(/[^0-9.]/g, '')) || 0;
  const converted = inverted ? entered / rate.rate : entered * rate.rate;

  return (
    <Section icon={<IconCoin size={15} />} title="Money" subtitle={label}>
    <Card>
      <div className="flex items-end gap-2">
        <label className="flex-1">
          <span className="block text-[10px] uppercase tracking-wider text-ink-3 mb-1">
            {inverted ? name : 'Pounds'}
          </span>
          <div className="flex items-center gap-1">
            <span className="text-ink-2 text-lg">{inverted ? symbol || '' : '£'}</span>
            <input
              type="text"
              inputMode="decimal"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              aria-label={`Amount in ${inverted ? name : 'pounds'}`}
              className="w-full bg-transparent text-2xl font-semibold text-ink outline-none tabular"
            />
          </div>
        </label>

        <button
          type="button"
          onClick={() => setInverted((v) => !v)}
          aria-label="Swap direction"
          className="mb-1 w-9 h-9 rounded-lg bg-surface-3 text-ink-2 flex items-center justify-center shrink-0"
        >
          <IconRefresh size={16} />
        </button>

        <div className="flex-1 text-right">
          <span className="block text-[10px] uppercase tracking-wider text-ink-3 mb-1">
            {inverted ? 'Pounds' : name}
          </span>
          <span className="block text-2xl font-semibold text-teal-dark dark:text-teal-light tabular truncate">
            {inverted
              ? new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(converted)
              : money(converted, iso)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 mt-4">
        {QUICK_AMOUNTS.map((n) => (
          <div key={n} className="p-2 rounded-lg bg-surface-3 text-center">
            <div className="text-[11px] text-ink-3 tabular">£{n}</div>
            <div className="text-[13px] font-semibold text-ink tabular">
              {plainAmount(n * rate.rate)}
            </div>
          </div>
        ))}
      </div>

      <p className="mt-3 text-[11px] text-ink-3 leading-snug">
        £1 = {money(rate.rate, iso)}
        {rate.asOf ? ` · rate from ${shortDate(rate.asOf)}` : ''}
        {state === 'cached' && ' · saved copy, not refreshed'}
        . Indicative only — a bureau or a card will differ.
      </p>
    </Card>
    </Section>
  );
}

// ───────── Allergies ─────────

/**
 * The completed sentence, picked rather than composed.
 *
 * "I'm allergic to…" in the phrase book is a stem, and a traveller finishes a
 * stem in English — which puts the one word that matters into a language the
 * listener may not have. Here they choose the allergen and get the whole
 * sentence.
 *
 * Built to be SHOWN first and spoken second. A mispronounced word can turn an
 * allergy into a preference, so the chosen line is set large and high-contrast,
 * for holding up to whoever is serving.
 */
function AllergyCard({ set, allergens }: { set: PhraseSet; allergens: AllergenPhrase[] }) {
  const [chosen, setChosen] = useState<string | null>(null);
  const [canSpeak, setCanSpeak] = useState(false);

  useEffect(() => {
    try {
      setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window);
    } catch {
      setCanSpeak(false);
    }
  }, []);

  const picked = allergens.find((a) => a.en === chosen) || null;

  return (
    <div className="space-y-3">
      <Card>
        <div className="flex flex-wrap gap-2">
          {allergens.map((a) => {
            const on = a.en === chosen;
            return (
              <button
                key={a.en}
                type="button"
                onClick={() => setChosen(on ? null : a.en)}
                aria-pressed={on}
                className={`px-3 py-2 rounded-lg text-[13px] font-medium border transition-colors ${
                  on
                    ? 'bg-teal-dark text-white border-teal-dark dark:bg-teal-light dark:text-ink dark:border-teal-light'
                    : 'bg-surface-3 text-ink-2 border-line-light'
                }`}
              >
                {a.en}
              </button>
            );
          })}
        </div>

        {!picked && (
          <p className="mt-3 text-[12px] text-ink-3 leading-snug">
            Tap whichever applies. You will get the whole sentence — not a phrase to finish
            in English, which is what leaves the important word untranslated.
          </p>
        )}
      </Card>

      {picked && (
        <Card>
          <div className="text-[11px] uppercase tracking-wider text-ink-3">
            {picked.en} &middot; {set.language}
          </div>

          {/* Large and plain: this gets held up to somebody across a counter. */}
          <p
            className="mt-2 text-[22px] font-semibold text-ink leading-tight"
            lang={set.speechLang}
            dir={set.speechLang.startsWith('ar') ? 'rtl' : undefined}
          >
            {picked.local}
          </p>

          <p className="mt-1.5 text-[13px] text-ink-2 italic">{picked.say}</p>

          {picked.note && (
            <p className="mt-2 text-[12px] text-ink-3 leading-snug">{picked.note}</p>
          )}

          {canSpeak && (
            <button
              type="button"
              onClick={() => speak(picked.local, set.speechLang)}
              className="mt-3 inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-3 text-teal-dark dark:text-teal-light text-[13px] font-medium"
            >
              <IconChat size={15} /> Say it out loud
            </button>
          )}

          <p className="mt-3 pt-3 border-t border-line-light text-[12px] text-ink-3 leading-snug">
            {SHOW_DONT_SAY}
          </p>
        </Card>
      )}
    </div>
  );
}

// ───────── Phrases ─────────

function speak(text: string, lang: string): void {
  try {
    const synth = window.speechSynthesis;
    if (!synth) return;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = lang;
    utterance.rate = 0.85; // a shade slow, so it can be copied
    synth.speak(utterance);
  } catch {
    /* no speech on this device — the written phrase still stands */
  }
}

function PhraseBook({ set }: { set: PhraseSet }) {
  const [canSpeak, setCanSpeak] = useState(false);

  // Feature-detect after mount: it does not exist during server render, and on
  // some devices it exists with no voices installed.
  useEffect(() => {
    try {
      setCanSpeak(typeof window !== 'undefined' && 'speechSynthesis' in window);
    } catch {
      setCanSpeak(false);
    }
  }, []);

  return (
    <div className="space-y-3">
      {set.groups.map((group) => (
        <Card key={group.title}>
          <h3 className="text-[11px] uppercase tracking-wider text-ink-3 mb-2">{group.title}</h3>
          <ul className="divide-y divide-line-light">
            {group.phrases.map((phrase) => (
              <li key={phrase.en} className="py-2.5 first:pt-0 last:pb-0">
                <div className="flex items-start gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="text-[12px] text-ink-3">{phrase.en}</div>
                    <div className="text-[15px] font-semibold text-ink leading-snug" lang={set.speechLang}>
                      {phrase.local}
                    </div>
                    {phrase.say && (
                      <div className="text-[12px] text-ink-2 italic">{phrase.say}</div>
                    )}
                    {phrase.note && (
                      <div className="text-[11px] text-ink-3 mt-1 leading-snug">{phrase.note}</div>
                    )}
                  </div>
                  {canSpeak && (
                    <button
                      type="button"
                      onClick={() => speak(phrase.local, set.speechLang)}
                      aria-label={`Say "${phrase.en}" in ${set.language}`}
                      className="shrink-0 w-9 h-9 rounded-lg bg-surface-3 text-teal-dark dark:text-teal-light flex items-center justify-center"
                    >
                      <IconChat size={16} />
                    </button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ───────── Packing ─────────

function PackingList({ groups }: { groups: PackingGroup[] }) {
  const [ticked, setTicked] = useState<Set<string>>(new Set());

  // Per-device convenience only. If it comes back empty the list is still
  // correct, just unticked.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem('luna-travel.packing.ticked');
      if (raw) setTicked(new Set(JSON.parse(raw) as string[]));
    } catch {
      /* nothing to restore */
    }
  }, []);

  function toggle(label: string) {
    setTicked((prev) => {
      const next = new Set(prev);
      if (next.has(label)) next.delete(label);
      else next.add(label);
      try {
        window.localStorage.setItem('luna-travel.packing.ticked', JSON.stringify([...next]));
      } catch {
        /* not worth failing the tap over */
      }
      return next;
    });
  }

  return (
    <div className="space-y-3">
      {groups.map((group) => (
        <Card key={group.title}>
          <h3 className="text-[11px] uppercase tracking-wider text-ink-3 mb-2">{group.title}</h3>
          <ul className="divide-y divide-line-light">
            {group.items.map((item) => {
              const done = ticked.has(item.label);
              return (
                <li key={item.label}>
                  <button
                    type="button"
                    onClick={() => toggle(item.label)}
                    aria-pressed={done}
                    className="w-full py-2.5 flex items-start gap-3 text-left"
                  >
                    <span
                      className={[
                        'mt-0.5 w-5 h-5 rounded-md border flex items-center justify-center shrink-0',
                        done
                          ? 'bg-teal border-teal text-white'
                          : 'border-line text-transparent',
                      ].join(' ')}
                    >
                      <IconCheck size={13} />
                    </span>
                    <span className="min-w-0">
                      <span
                        className={[
                          'block text-[14px] leading-snug',
                          done ? 'text-ink-3 line-through' : 'text-ink',
                        ].join(' ')}
                      >
                        {item.label}
                      </span>
                      {item.note && (
                        <span className="block text-[11px] text-ink-3 leading-snug mt-0.5">
                          {item.note}
                        </span>
                      )}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Card>
      ))}
    </div>
  );
}

// ───────── The screen ─────────

export default function EssentialsPage() {
  const { booking } = useBooking();
  const { place } = usePlace(booking);
  const { brain } = useBrainGuide(booking);

  const guide = useMemo(
    () =>
      resolveGuide({
        countryCode: booking.primaryCountryCode,
        place,
        brain: brain ? { destination: brain.destination ?? undefined } : null,
        staticGuide: getDestinationGuide(booking.primaryCountryCode),
      }),
    [booking.primaryCountryCode, place, brain],
  );

  const currencyLabel = place?.facts.currency?.value || guide.currency || '';
  const languageLabel = place?.facts.language?.value || guide.languages || '';
  const plug = place?.facts.voltageAndPlug?.value || guide.voltageAndPlug || '';
  const phrases = phrasesFor(languageLabel);
  const allergens = allergensFor(phrases?.language);

  const packing = useMemo(
    () =>
      packingList({
        tripStart: booking.tripStart,
        tripEnd: booking.tripEnd,
        climate: place?.climate ?? null,
        tags: [...(place?.bestForTags ?? []), ...(place?.audienceTags ?? [])],
        voltageAndPlug: plug,
        travellerTypes: booking.travellers.map((t) => t.type),
        hasFlights: booking.flights.length > 0,
      }),
    [booking, place, plug],
  );

  // Tipping comes from Luna Brain's Money & Costs answers, which carry a source
  // and a verification date. No answer means no card — tipping etiquette is
  // exactly the sort of thing it would be embarrassing to guess at.
  const tipping = useMemo(() => {
    const items = (brain?.byCategory ?? []).flatMap((c) => c.items);
    return items.find((a) => /tip|gratuit|service charge/i.test(`${a.question} ${a.answer}`)) ?? null;
  }, [brain]);

  const emergency = guide.emergencyNumber || '';
  // Each service gets its own button. One link over the whole field stripped
  // "102 (police) · 119 (medical)" down to tel:102119, which dials nothing.
  const emergencyDialable = useMemo(() => emergencyNumbers(emergency), [emergency]);

  return (
    <PageEnter>
      <NavBar title="Trip essentials" />
      <div className="px-4 pb-10">
        <p className="mt-3 text-[13px] text-ink-2 leading-relaxed">
          The practical things for {booking.destinationLabel}. Everything here works without a
          signal except the exchange rate, which shows the last one we were given.
        </p>

        {currencyLabel && <Money label={currencyLabel} />}

        <Section
          icon={<IconBaggage size={15} />}
          title="Packing list"
          subtitle="Built from your dates, the climate while you are there, and what you booked."
        >
          <PackingList groups={packing} />
        </Section>

        {phrases && allergens && (
          <Section
            icon={<IconInfo size={15} />}
            title="Allergies"
            subtitle={`Say exactly which one, in ${phrases.language}.`}
          >
            <AllergyCard set={phrases} allergens={allergens} />
          </Section>
        )}

        {phrases && (
          <Section
            icon={<IconChat size={15} />}
            title={`A little ${phrases.language}`}
            subtitle="Tap the button to hear it said."
          >
            <PhraseBook set={phrases} />
          </Section>
        )}

        {(emergency || plug || tipping) && (
          <Section icon={<IconInfo size={15} />} title="Good to know">
            <div className="space-y-3">
              {emergency && (
                <Card>
                  <div className="flex items-center gap-2 mb-1">
                    <IconWarning size={14} />
                    <h3 className="text-[11px] uppercase tracking-wider text-ink-3">
                      Emergency services
                    </h3>
                  </div>
                  {emergencyDialable.length > 0 ? (
                    <div className="flex flex-wrap gap-2">
                      {emergencyDialable.map((n) => (
                        <a
                          key={n.dial}
                          href={`tel:${n.dial}`}
                          className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-3 text-[17px] font-semibold text-teal-dark dark:text-teal-light"
                        >
                          <IconPhone size={16} />
                          {n.display}
                          {n.service && (
                            <span className="text-[12px] font-normal text-ink-3">{n.service}</span>
                          )}
                        </a>
                      ))}
                    </div>
                  ) : (
                    // Unparseable: show the words rather than a link that dials
                    // the wrong thing.
                    <div className="text-[15px] font-semibold text-ink">{emergency}</div>
                  )}
                </Card>
              )}

              {plug && (
                <Card>
                  <h3 className="text-[11px] uppercase tracking-wider text-ink-3 mb-1">Power</h3>
                  <div className="text-[15px] font-semibold text-ink">{plug}</div>
                  <p className="text-[12px] text-ink-3 mt-1 leading-snug">
                    {/Type\s+G\b/i.test(plug) && !/Type\s+[A-FH-Z]/i.test(plug)
                      ? 'The same sockets as home — no adapter needed.'
                      : 'You will need a travel adapter.'}
                  </p>
                </Card>
              )}

              {tipping && (
                <Card>
                  <h3 className="text-[11px] uppercase tracking-wider text-ink-3 mb-1">Tipping</h3>
                  <p className="text-[14px] text-ink leading-relaxed whitespace-pre-line">
                    {tipping.answer}
                  </p>
                  {tipping.lastVerified && (
                    <p className="text-[11px] text-ink-3 mt-2">
                      Checked {shortDate(tipping.lastVerified)}
                    </p>
                  )}
                </Card>
              )}
            </div>
          </Section>
        )}
      </div>
    </PageEnter>
  );
}
