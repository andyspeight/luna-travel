# Trip essentials

The small practical things — money, packing, phrases, plugs, emergency numbers
— on one screen at `/essentials`, reached from the destination screen's
Essentials tab.

Vamoos sells these individually from about £12 per feature per month. They are
free here, which is a pricing story as much as a feature one.

## One data layer, two surfaces

The brief was explicit about this: *do not build seven separate features with
seven separate data sources.* So nothing on this screen is authored per
destination. Everything is derived from data that already existed:

| | Comes from |
|---|---|
| Currency + converter | content base `Currency`, via `currencyIso()` |
| Packing list | the booking's dates, the climate for those months, its tags, who is travelling |
| Phrase book | content base `Language` — the set is keyed on the LANGUAGE |
| Plug and voltage | content base `Voltage And Plug` |
| Emergency numbers | Luna Brain, with the static guide behind it |
| Tipping | Luna Brain's Money & Costs answers |

All of it runs through `resolveGuide()`, the same three-source merge the
destination screen uses, so a fact answered by Luna Brain on one screen is
answered by Luna Brain on the other.

Ask Luna reads the same model (`src/lib/luna-essentials.ts`). "What plug do I
need" answered in chat and answered on the screen are the same sentence from the
same field. That replaced four hardcoded country packing lists that covered the
Maldives, Spain, the UAE and Greece and shrugged at the other 107.

## Adding a destination adds nothing

A new country in the content base gets the converter, the packing list, the plug
card and — if it speaks one of the twelve languages below — the phrase book, with
no code change and nothing written for it.

What a new country needs is its own record filled in. What it does **not** need
is an entry in any list in this repo.

## Rule 8, card by card

Every card hides itself when its data is missing. No plug type recorded means no
power card, not "Plug type: unknown".

The two that matter most:

- **The converter needs an ISO code**, and `currencyIso()` returns null rather
  than guessing. The base writes currency for people to read — "Thai Baht (฿)" —
  so the names are mapped. An unmapped name shows no converter, because the
  failure mode of a guess here is a traveller misreading a price.
- **Tipping only appears where Luna Brain holds a verified answer.** Tipping
  etiquette is exactly the sort of thing it would be embarrassing to invent.

## The exchange rate is the one thing that needs a signal

Everything else works on a plane. A rate cannot, so the contract is different:
the last rate is kept in the browser and shown with the date it was good for,
labelled *saved copy, not refreshed*. A stale rate labelled honestly is useful.
A stale rate presented as today's is worse than nothing. Every figure carries
*indicative only* — we are not quoting a price.

Provider is `open.er-api.com`: keyless, ~160 currencies, daily. Six-hour
revalidate, matching `weather.ts`.

## The phrase book

Twelve languages: Spanish, French, Italian, Portuguese, German, Greek, Turkish,
Dutch, Croatian, Polish, Thai, Arabic. Twelve phrases each, in three groups,
every one with a pronunciation line — a phrase book you cannot say out loud is
decoration. Speaking uses the device's own synthesiser, so it works offline.

English destinations get no phrase book. A phrase book for somewhere they
already speak your language is clutter.

### Written in-house, and staying that way

Decided 21 Sep 2026: these are not getting a native-speaker pass, because
staffing one for every language a traveller might need does not scale, and
holding the feature back for a review that will never happen helps nobody.
`reviewedBy` stays on the type so a set can carry a name when somebody does
read one, but empty means in-house rather than outstanding.

The scope is what makes that defensible. Twelve stock phrases in twelve
languages: "Hello", "the bill please", "where is the toilet" have one obvious
form each, and the places machine translation slips — idiom, register, regional
variation — barely apply.

### The one that is not a phrase

`I'm allergic to…` is a stem, not a sentence, and the traveller finishes it
themselves — in English. "Soy alérgico a… **peanuts**" puts the one word that
carries the whole meaning into a language the listener may not have.

That is not a translation problem and no native-speaker review would have
caught it: every one of the twelve is individually correct. It is a design
problem, and it sits on the single phrase where being misunderstood has a
medical consequence rather than an awkward one.

The fix is a short closed list — nuts, peanuts, shellfish, fish, eggs, milk,
gluten, soy, sesame — rendered in the local language under that phrase, so the
traveller points instead of guessing. Not built yet. Worth doing before the
phrase book is pointed at anywhere with a serious allergy story.

## A bug worth knowing about

Both this screen and the destination screen used to render the whole emergency
field as one tap-to-call link, built by stripping non-digits:

```
"102 (police) · 119 (medical)"  →  tel:102119
```

Not a phone number anywhere on earth, on the screen a traveller reaches for in
an emergency. About a third of records carry two services like that, and they
are the countries where a traveller is least likely to already know the number.

`emergencyNumbers()` parses the field instead, and each service is its own
button. Anything it cannot read confidently renders as plain text with no link,
because a dead link on an emergency number is worse than no link.

## Not built

**The eSIM offer.** It is the one item on the list that is a commercial
arrangement rather than a feature — which provider, what the agency's cut is,
whether it is offered at all. That is a decision, not a build.

## Testing

- `src/lib/__tests__/` — `currency-iso`, `packing`, `phrasebook`, `emergency`,
  `luna-essentials`. All pure.
- `npm run smoke` drives the screen in a real browser: that a saved rate still
  converts with no network, that typing an amount reconverts, that each
  emergency service dials its own number, and that a ticked item stays ticked
  across a reload.

The smoke checks seed a rate into storage rather than calling the provider. The
saved-rate path is the offline behaviour this screen promises, so proving that
is worth more than proving a live call — and the provider is not reachable from
CI anyway.
