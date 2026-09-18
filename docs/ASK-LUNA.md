# Ask Luna

## What it is, plainly

**Luna is not a language model.** It is a router: it reads the question, decides
which layer can answer it, and assembles a reply from real data. There is no
generation anywhere in it.

That is worth writing down because it was not written down. The go-live review
of 9 July flagged it — *"Luna concierge is 100% canned… acceptable as a stated
v1 limitation"* — and the one action attached to it, to state the limitation,
was never done. The screen went on promising "Ask Luna anything about your trip"
for two months. It now says "Ask about your trip".

## Why deterministic, and not just "not yet"

These are facts about a booking somebody has paid four thousand pounds for. A
model paraphrasing a check-out time, a baggage allowance or an emergency number
is a liability, and "the AI said so" is not a defence an agency wants to give a
customer.

It also means **the answers work offline.** The booking is already cached on the
device, so the questions a traveller asks standing in a terminal with no signal
are exactly the ones answered without a network.

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
| 8 | Handoff | offers the agent | ✅ |

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

The last five — a kids club, a cot, the wifi password, whether the hotel is near
the beach, changing a flight — are genuinely not in any source we hold.
Declining is correct. Declining all five with the same sentence was not: they
now say who *does* know, and show the special requests the agent already logged.

`npm run smoke` keeps the important ones honest. A router's failure mode is a
question landing in the wrong branch, which no unit test of the branch itself
would notice.

## What it still cannot do

Anything open-ended. *"What is there to do with teenagers on a wet afternoon?"*
has no field behind it and never will. Today that gets the handoff, which is
honest but is the ceiling of this design.

Going past it means a model, grounded in the layers above and allowed to answer
only from them. That is a real decision rather than a task: it costs money per
message, it needs a refusal policy, and it changes what an agency is putting
its name to. **Not taken.**

## Adding an answer

Put it in the layer that owns the data, not in the page:

- a fact about the booking → `luna-booking.ts`
- a fact about the destination → `luna-essentials.ts`, and add the field to
  `EssentialsContext`
- something Brain already knows → nothing to do; `findKnowledge` will find it

Then add the question to the battery and check it in a browser. Every bug in
this file was found by asking, not by reading.

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
