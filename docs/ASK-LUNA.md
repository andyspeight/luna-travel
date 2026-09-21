# Ask Luna

## What it is, plainly

**Luna is a router with a model behind it.** It reads the question and decides
which layer can answer. Anything factual — the booking, the destination facts,
Brain's verified rows — is assembled from real data with no generation at all.
Only what none of those can reach goes to a model, and that model answers from
the same data or says it cannot.

The split is the point. A check-out time, a baggage allowance or an emergency
number is a fact an agency has to stand behind, and a paraphrase of one is a
liability. Those are never generated. "What's there to do with teenagers on a
wet afternoon" has no field behind it and never will, so that is where a model
earns its place.

That is worth writing down because it was not written down. The go-live review
of 9 July flagged it — *"Luna concierge is 100% canned… acceptable as a stated
v1 limitation"* — and the one action attached to it, to state the limitation,
was never done. The screen went on promising "Ask Luna anything about your trip"
for two months. It now says "Ask about your trip".

## Why the facts stay deterministic

Not "not yet" — on purpose, and permanently.

These are facts about a booking somebody has paid four thousand pounds for. A
model paraphrasing a check-out time, a baggage allowance or an emergency number
is a liability, and "the AI said so" is not a defence an agency wants to give a
customer. So those answers are assembled from fields, and the model is never
asked.

It also means **they work offline.** The booking is already cached on the
device, so the questions a traveller asks standing in a terminal with no signal
are exactly the ones answered without a network. The model layer is the only
part that needs a signal, and it is the only part whose questions can wait.

## The layers, in order

Each returns null when it cannot answer, and the question falls through.

| | Layer | Source | Offline |
|---|---|---|---|
| 1 | Pleasantries | — | ✅ |
| 2 | Lost passport | — | ✅ |
| 3 | **The booking** (`luna-booking.ts`) | flights, hotels, party, extras, documents, payment | ✅ |
| 4 | **The essentials** (`luna-essentials.ts`) | content base + Brain's structured facts | ✅ |
| 5 | Written replies | four countries, in the page | ✅ |
| 6 | **Luna Brain Q&A** (`luna-knowledge.ts`) | verified rows with a source and a date | ❌ needs the fetch |
| 7 | **Signposting** (`signpostAnswer`) | routes to the hotel or the agent | ✅ |
| 8 | **The model** (`luna-ai.ts`) | the same data, as a grounded prompt | ❌ needs the network |
| 9 | Handoff | offers the agent | ✅ |

Order is not arbitrary. The booking beats the destination, because *your*
check-out time beats a general fact about Greece. Brain sits second to last
because its rows are broad: it knows about ferries in six countries, so anything
specific should have had its turn first.

## Measured, not asserted

Twenty-four questions a traveller would actually ask, put through the real UI in
a browser. That is how all of this was found, and how it is checked.

| | Answered |
|---|---|
| Before | **12 / 24** |
| Booking + Brain facts + knowledge | 19 / 24 |
| Plus signposting | **24 / 24** |

Those twenty-four are closed questions with a right answer. The model layer is
for the open ones, which have no scoreboard — what it is measured on instead is
that it never contradicts the booking and refuses rather than invents.

The last five — a kids club, a cot, the wifi password, whether the hotel is near
the beach, changing a flight — are genuinely not in any source we hold.
Declining is correct. Declining all five with the same sentence was not: they
now say who *does* know, and show the special requests the agent already logged.

They are signposted BEFORE the model rather than after, deliberately. The model
has the hotel's name but nothing about its facilities, so it would refuse — and
"the hotel can tell you, and here is what your booking already notes" is a
better answer than a refusal, faster, and free.

`npm run smoke` keeps the important ones honest. A router's failure mode is a
question landing in the wrong branch, which no unit test of the branch itself
would notice.

## The model layer

Reached only when layers 1–7 have all declined, so nothing factual about a
booking is ever paraphrased by it.

**It sees the grounding pack and nothing else** (`luna-context.ts`): the trip's
shape and timings, the destination content, Brain's verified facts, and the Q&A
rows that matched. It is told, in order of importance, never to alter a booking
fact, to return a refusal marker rather than guess, never to state a price or an
opening time that is not in front of it, and never to promise anything on the
agency's behalf.

### What never reaches it

Traveller names, the lead email, PNRs, and every figure about money. Names and
emails because a concierge has no use for them; PNRs because they are
credentials in all but name; money because it is answered deterministically
anyway and there is no reason to put a customer's balance in a prompt.

Checked twice: `luna-context.ts` never puts them in, and the route refuses to
send a context containing any of them. Both are tested — a leak here would be a
customer's details in a third party's logs.

### Cost, and who can spend it

The endpoint needs a real traveller session (`lt_session`) and is rate limited
to 25 questions per traveller per hour. An ungated model endpoint is an open
wallet and a public one is somebody else's free chatbot within a week.

The demo booking gets no model answers unless `LUNA_AI_ALLOW_DEMO=1`, which is
an explicit switch for showing the product rather than a hole left open. Turn
it on for a demo; leave it off otherwise.

### Configuration

```
LUNA_CHAT_URL + TG_INTERNAL_KEY   preferred — reuses Luna Chat's credits
ANTHROPIC_API_KEY                 the fallback, a direct Messages call
LUNA_CHAT_MODEL                   defaults to claude-sonnet-5
LUNA_AI_ALLOW_DEMO=1              let the demo booking use it
```

Unconfigured, down, timed out and refused all look identical to the traveller:
the agent handoff. That is deliberate — none of them is the traveller's problem
and none should look like a bug.

### Knowing whether it is actually on

Because all four failures look alike from the outside, you cannot tell a working
model layer from a dead one by using the app. `/admin/settings` carries a
**Luna (open questions)** tile that says which backend a question would reach.

It exists because the env checklist on that page tracked eleven variables and
none of them was this one — so the page could read 11/11, all green, with the
model layer entirely switched off. That is the same shape of problem as the
flight webhook that had never fired and the retention job that never ran: off,
with nothing saying so.

The tile is deliberately stricter than the code. `lunaAiConfigured()` is
optimistic — if a backend looks present it tries, and a wasted attempt ends in
the agent handoff, which is where an early return would land the traveller
anyway. `lunaAiStatus()` is pessimistic, because a green tile that lies is worse
than no tile.

The case only the tile catches: **`LUNA_CHAT_URL` set without
`TG_INTERNAL_KEY`**. `lunaAiConfigured()` returns true, `viaLunaChat` returns
immediately without calling anything, and the request falls through to
Anthropic — so with no direct key it is configured-looking and permanently dead.
The tile shows amber and names the missing variable. Amber rather than red on
purpose: red reads as "nothing set", and this is the worse case, something set
that cannot work.

## Adding an answer

Put it in the layer that owns the data, not in the page:

- a fact about the booking → `luna-booking.ts`
- a fact about the destination → `luna-essentials.ts`, and add the field to
  `EssentialsContext`
- something Brain already knows → nothing to do; `findKnowledge` will find it
- something with no field anywhere → nothing to do; it falls through to the
  model, which answers from the grounding pack or refuses

Then add the question to the battery and check it in a browser. Every bug in
this file was found by asking, not by reading.

If you are adding a fact the model should be able to use, add it to
`buildLunaContext` — the model sees that and nothing else, so a field the app
holds but the pack omits is a field the model will refuse to use.

## Bugs this found

Worth keeping as a list, because each was invisible from the source:

- **`EYEY20`** — `FlightLeg.flightNumber` already carries the carrier code, so
  concatenating them doubled it.
- **"My flight is cancelled" → a timetable.** It matched the flight-list branch.
  Somebody at a departure board needs a person.
- **"I have lost my passport" → passport validity rules.** The expiry date is
  not the problem when the passport is gone.
- **"How much is a taxi" → "Greece uses the Euro".** `how much is` in the money
  matcher caught every price question.
- **"Hello" → "I can't answer that one for certain."** And before that fix,
  "hello" reached the phrase book, so somebody greeting their concierge was
  taught to say it in Greek.
- **Maldives emergency number backwards** in the static guide: 119 is police,
  102 is the ambulance. It disagreed with both Brain and the content base.
