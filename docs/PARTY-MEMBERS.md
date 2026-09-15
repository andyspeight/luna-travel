# Who a booking belongs to

A booking has several people on it. Until now the app did not.

## What it used to do

`travellers` was keyed `(agency_id, booking_ref)` — **one row per booking**. So:

- Whoever opened the invite first owned the booking.
- Anyone else following the same link was handed *that first person's record*,
  silently. They were now, as far as the app was concerned, their partner.
- Every reply to the agent came from one name.
- Withdrawing access took it from the whole family at once.
- You could not tell who had opened anything.

Travellers forward the link to their party. That is the obvious thing to do and
the app should not fight it.

## What it does now

One row **per person**, keyed `(agency_id, booking_ref, pax_ref)`.

After the booking reference, email and departure date check out, a booking with
more than one passenger asks **"Who's travelling?"** and offers the names from
the order's own manifest. Each person taps themselves and gets their own record,
their own thread with the agent, and their own revoke.

A solo booking never sees the question.

## pax_ref: why the name, and not the obvious things

`src/lib/party.ts` derives the key from the passenger's **name**, lower-cased
with everything that is not a letter or digit removed — so `O'Neill`, `O Neill`
and `ONeill` are one person.

**Not the manifest position.** `orderToBooking` numbers passengers `trv-0`,
`trv-1`… in whatever order Travelify returned them. A reorder would point an
existing traveller row at a different human being.

**Not the email.** This is the one that looks right and is not. The knowledge
check is reference + email + departure date, and **Travelify only matches the
email held on the order** — so everyone in the party authenticates with the same
address. Keying on it would collapse the family straight back into one row,
which is the bug.

So the person is the key, and the email is only what they authenticated with.

Two people with genuinely identical names on one booking share a key. That is
accepted: it is rare, and merging them beats handing one of them a stranger's
record.

## The invite is for the booking

A redeemed invite stays usable. Only **revoked** and **expired** close it — both
the stored status and the clock, so "closed" does not depend on which way it was
closed.

Re-redemption by the same person needs no special case: they resolve to the same
`pax_ref` and are handed their existing row. That covers a double-tap, a refresh,
a re-install and a second device with one code path.

The invite is still marked redeemed against whoever used it first, for the
portal's "has this been used?" column.

## What this does not change

Travelify's lookup still requires the email on the order, so a forwarded link
still needs *that* address to get past the knowledge check. Party members get
their own identity and their own revoke; they do not get to authenticate with
their own email address.

Letting the lead vouch for their party — so the others need no order email at
all — is a separate, additive piece of work.

## Deploying it

`db/migrations/luna_travel_travellers_party_members.sql` is written to be applied
**before** the code that uses it. `pax_ref` is `NOT NULL` but carries a default,
so the previously deployed redeem route — which knows nothing about it — keeps
inserting one row per booking exactly as it did. Without that default, every
redemption between the migration and the deploy would have failed, and the
traveller would simply have been told their booking could not be found.

Existing rows were backfilled as the lead, with `pax_ref` derived from the name
they already carried by the same rule as `paxRef()`, so a traveller who was
already onboarded matches their own row rather than gaining a second one.

`lead_passenger_name` holds **this row's** traveller name, not the booking's
lead — every reader already treated it that way. `is_lead` is the column that
says whether they are the lead. The misleading name is flagged in the schema and
a rename is pending on its own.
