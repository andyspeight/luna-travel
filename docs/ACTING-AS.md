# Acting as an agency

Travelgenix staff can use the agency portal **as** one of their client agencies.
This is Luna Travel's side of a platform-wide pattern; the design, and the
incident that produced it, are in `tg-widgets/docs/act-as-scoping-spec.md`
(Luna is the "phase 3" tool named in section 4.2).

## Why it exists

A client's bookings live in **their** Travelify account, reachable only with
their App ID and API key. Without acting as them, a staff member creating an
invite for one of their bookings gets "we couldn't find that booking", because
Control looked in Travelgenix's own account instead.

## How it works

| | |
|---|---|
| Who can | Travelgenix staff only, enforced at Control |
| Scope | one browser tab |
| Lifetime | 30 minutes, capped server-side |
| Default | always yourself |

1. **Start.** The portal's **Act as agency** picker lists the staff member's
   clients from Control and asks Control to mint a short-lived signed grant.
2. **Carry.** The grant is held in that tab's `sessionStorage` and attached as
   `X-TG-Act-As` to Luna's own `/api/agency/*` calls by a fetch wrapper in the
   portal shell. A second tab has no grant, so it is still you.
3. **Resolve.** `requireAgency` forwards the grant, alongside the session
   cookie, to Control's `/api/auth/me`. Control applies the overlay in its own
   `requireAuth` and returns the client it resolved to. That client is the
   agency for the request.
4. **Show.** An amber banner names the agency on every portal page, with one
   click to stop.
5. **Record.** Audit events carry the real staff email as the actor, plus the
   agency in `metadata`, so the trail reads "Andy, acting as Cypher Travel,
   created an invite".

## Two things that matter

**Luna never verifies the grant.** It does not hold the signing secret and
should not. Luna already delegates session validation to Control by forwarding
the cookie; the grant rides along the same path, so the security decision stays
with the system that owns it. Adding the secret here would spread a high-value
credential for no benefit.

**It never silently becomes you.** There are two different failures and they
are deliberately not treated alike:

| | |
|---|---|
| **No grant** | Nobody is acting. Run as the ordinary session. |
| **A grant we refused** | Somebody *believes* they are acting. Fail the request. |

An expired or tampered grant, a non-staff caller, an unreachable Control — all
of those are the second row, and they 401. The portal clears the dead grant,
reloads, and says *"Your acting session ended."*

This was learned the hard way. The original build treated both rows as "you are
you". A grant expired (30 minutes, and nothing said so), the portal fell back to
the staff member's own agency while still looking like it was acting, and an
invite for a client's booking was written into Travelgenix instead. Nothing
errored. It surfaced days later, in front of the client, as *"we couldn't find a
booking with those details"* — wording that blames the traveller for something
only we could fix.

Falling back is safe for a read: you see your own data and nothing leaks. It is
not safe for a write, because the write lands somewhere real and looks like it
worked. `src/lib/__tests__/act-as.test.ts` pins this down, including the exact
incident: a valid own-agency cookie plus a refused grant must yield null, not
the cookie's agency.

A staff member acting as an agency needs **no** agency session of their own, so
the picker also appears on the signed-out card. Minting them a real
`lt_agency_session` would have been simpler and is deliberately not done: it
would be indistinguishable from the agency signing in, and it would flip the
portal for the whole browser rather than one tab.

## Cost

Nothing when nobody is acting. With no header `resolveActAs` returns before it
touches the network, which matters because it sits in front of every agency API
call. While acting, each call adds one round trip to Control, the same one the
admin session already makes.

## Invites are checked before they are sent

Separately, and for the same reason: `POST /api/agency/invites` now validates
the booking reference, email and departure date against **that agency's own**
Travelify account before the invite is created, and refuses a definite
not-found with a message naming all three.

It is cause-agnostic, which is the point — it catches a stale act-as grant, a
mistyped reference, a wrong date and an email Travelify does not hold, all at
the desk rather than on the traveller's phone. A Travelify outage (anything that
is not a definite 404) lets the invite through: the booking desk should not stop
because a supplier is having a bad minute, and redemption checks again anyway.

## If it does not appear

- **No picker.** The client list is staff-gated at Control. If you are not staff
  for the Travelgenix account, nothing renders.
- **Picker is empty.** It lists clients with status Active.
- **Agency has no bookings.** Acting as them uses their Travelify credentials;
  if their App ID or API key is missing in Control, lookups still fail. That is
  a credentials problem, not an act-as one.
