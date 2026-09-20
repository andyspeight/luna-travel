# Live flight status

A traveller's flight is watched from the moment they first open a live booking,
and their phone is told when something about it changes. No agent action, no
setting to switch on.

Worth saying plainly, because a competitive review recently listed this as a gap
we had not started: **it was built, and it was one call short of working.**

## How it works

AeroDataBox calls **us**. There is no polling, no cron, and no per-check cost to
budget for — we register an interest in a flight and they push updates at us.

```
traveller opens a live booking
        │
        ▼
POST /api/flights/subscribe-booking     (internal, fire-and-forget)
        │   one subscription per leg, never re-subscribing a watched leg
        ▼
      AeroDataBox
        │   ... a gate is assigned, a delay, a cancellation
        ▼
POST /api/flights/webhook?t=<token>
        │
        ├── update trip_flights           → the card is fresh, even offline
        ├── is this news?                 → src/lib/flight-alerts.ts
        ├── write a message               → messages + message_recipients
        └── send a Web Push               → src/lib/push.ts → public/push-sw.js
```

| | |
|---|---|
| `src/lib/aerodatabox.ts` | provider client |
| `src/app/api/flights/subscribe`, `subscribe-booking` | registering interest, deduped per leg |
| `src/app/api/flights/webhook` | the inbound callback — I/O only |
| `src/lib/flight-alerts.ts` | **what a change means.** Pure, and where the tests are |
| `src/app/api/traveller/flights` | the traveller's live overlay |
| `src/app/api/agency/flights`, `/agency/flights` | the same flights, agency side |

## What a traveller gets

Check-in open, boarding (with the gate where there is one), gate closed,
delayed, departed, on approach, landed (with the belt where the feed carries
one), cancelled, diverted, possible disruption.

Cancelled and diverted are **urgent**: they buzz and stay on screen until
acknowledged. Boarding, gate closed and delayed are **important**. Everything
else is ordinary, because a product that treats everything as urgent gets muted.

Scheduled and Unknown send nothing. They are states, not events.

### Two decisions worth keeping

**One notification per flight, updated in place.** Every alert for a leg carries
the same `tag`, so gate 22 → gate 23 → delayed is one row on the phone that
keeps changing rather than three rows to scroll through. The service worker sets
`renotify`, so a replacement still buzzes — collapsing is not going quiet.

**It lands on the flight**, `/flight/<legId>`, not on a notifications list. That
page already copes with a leg it cannot find, so an old notification tapped
weeks later offers the itinerary rather than an error.

### What does not fire an alert

A field being blanked. Providers routinely drop a gate between updates, and
treating that as news would send "gate 22", "gate gone", "gate 22" for one gate
that never moved. A status change always counts; a gate, terminal or belt counts
only when the new value exists.

## If notifications are off

Everything still works. The push is the only part that needs permission — the
flight card updates regardless, carries an "Updated HH:MM" stamp, and reads from
cache with no signal. A traveller who declined notifications sees the same
information, just not before they look.

## Configuration

```
AERODATABOX_API_KEY         provider
AERODATABOX_WEBHOOK_TOKEN   the ?t= secret; the callback's ONLY auth
LUNA_TRAVEL_PUBLIC_URL      where AeroDataBox should call back to
TG_INTERNAL_KEY             guards subscribe-booking
VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY / VAPID_SUBJECT     push
```

AeroDataBox does not sign its callbacks, so the token in the query string is all
that stands between the endpoint and anyone who finds it. It is compared in
constant time. Treat it like a password: if it leaks, rotate it and re-subscribe.

With no VAPID keys the app still works and simply cannot notify — every send
becomes a logged no-op rather than an error.

## Testing it

`src/lib/__tests__/flight-alerts.test.ts` covers the decisions.
`src/app/api/flights/webhook/__tests__/route.test.ts` covers the seam, with the
database and the push service faked — it fails if the push call is removed,
which is the whole reason it exists.

For a live check, `/admin/flight-test` looks up any flight number and date
against the real provider without subscribing or writing anything.

### Proving the loop before a traveller does

Everything above can pass while no alert ever arrives. The health panel reads
config and asks AeroDataBox if it is alive; neither tells you whether the
callback URL we *register* is a URL this deployment actually *serves*, or
whether the token in our environment is the token the endpoint expects. A
mismatch is silent — subscriptions succeed, updates go nowhere, and the first
person to find out is standing at a gate.

**Can AeroDataBox actually reach us?** on `/admin/flight-test` closes that gap.
It calls our own public webhook URL — the exact string the subscribe route
builds — twice: once with a deliberately wrong token, once with the real one.
That proves the address resolves to this deployment, the endpoint is reachable
from outside (DNS, TLS, routing, middleware), the token matches, a bad token is
refused, and the handler parses and answers. A real round trip, not an internal
call, because an internal call proves none of it.

It costs nothing and writes nothing: the good-token probe carries a
subscription id that matches no row, so the handler finds nothing to update and
says so.

**What it does not prove**, and says so on screen: that AeroDataBox will accept
a subscription, and that it will call us when a flight moves. Those need credits
and a real flight. This is the half that is free to check and, on the evidence
of every integration ever, the half more likely to be wrong.

The decision logic lives in `src/lib/flight-selftest.ts` so it can be tested
away from the network; the endpoint is `/api/admin/flight-selftest`, admin-gated
like the rest of `/api/admin/*`, and `npm run smoke` checks that it is shut
without a session — it makes outbound requests, so an open door is a free
traffic generator pointed at our own webhook.

## Known edge

The row is updated before the message is written. If the message insert fails,
the next identical callback sees no change and that one alert is lost rather
than retried. It is pre-existing and rare; the alternative — messaging first —
trades it for a stale card, which is worse. Worth revisiting if the logs ever
show it happening.
