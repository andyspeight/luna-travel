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

**It fails closed to yourself.** No header, an expired or tampered grant, a
non-staff caller, an unreachable Control — every one of them runs the request as
whoever the ordinary session says it is. The failure mode is "you are you",
never "you are silently them". That is what makes it safe to deploy before
anything else is finished.

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

## If it does not appear

- **No picker.** The client list is staff-gated at Control. If you are not staff
  for the Travelgenix account, nothing renders.
- **Picker is empty.** It lists clients with status Active.
- **Agency has no bookings.** Acting as them uses their Travelify credentials;
  if their App ID or API key is missing in Control, lookups still fail. That is
  a credentials problem, not an act-as one.
