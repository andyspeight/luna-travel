# Luna Travel — Live Wiring: Session State

**Branch:** `live-wiring` (NOT merged to main — do not merge until after TravelTech Show)
**Tag protecting the show build:** `show-ready-2026` (on main)
**Preview URL:** https://luna-travel-git-live-wiring-agendasgroup.vercel.app
**Show URL (frozen on main):** https://lunatravel.travelify.io
**Last updated:** 27 May 2026 (afternoon — live render achieved)

---

## Status: LIVE RENDER PROVEN END-TO-END

A real Travelify booking (DEMO61807, multi-city US trip, 5 flights + 2 hotels)
redeems through a real invite, mints a real lt_session, fetches via the new
traveller API, runs through the defensive mapper, and renders in the PWA on
the preview URL. Confirmed by Andy. Mock picker and four mock bookings remain
completely untouched.

## Goal of this work (recap)

Wire the traveller PWA to live Travelify bookings ADDITIVELY — mock data and
the long-press picker MUST stay on their own untouched path so the TravelTech
Show demo (24–25 Jun) is never at risk. Live data shows ONLY when there's a
real lt_session; with no session the PWA falls back to the mock picker
exactly as today. At the show, Andy will demo a live QR-to-Travelify
redemption alongside the mock bookings.

## Andy's testing philosophy (drives the design)

Andy is pulling several real bookings of widely varying shape to find where
the platform breaks BEFORE the show. So:
- Mapper is defensive everywhere; every field optional, every array possibly
  empty, every nested object possibly missing. Never invents data.
- Documents and payments are often empty now and fill in LATER. The PWA
  treats a booking as a living thing that fills in over time.
- "Unknown" room types and similar may be populated later — handled gracefully.
- Empty sections show a friendly placeholder (not hidden) so info arriving
  later visibly fills in. (Note: placeholder UI work itself is still queued
  for the empty-sections pass — see NEXT below.)
- Andy reviews each booking by wiring it into the live PWA and eyeballing it
  on the preview URL, with /api/map-test as the shape-and-coverage diagnostic.

## Decisions locked

- **Flight segments flatten 1:1 to FlightLeg.** Travelify's nested
  routes[].segments[] all flatten. Confirmed on DEMO61807 (5 rows: LHR→JFK,
  JFK→BOS, BOS→LAS, LAS→JFK, JFK→LHR). Matches the layout Andy showed.
- **Credentials:** demo integration (App 250) reaches the test bookings, so
  the show demo can use the existing demo-bypass path. Per-agency credential
  lookup is still deferred.
- **Documents come from Luna Travel's own Supabase bucket, NOT Travelify.**
  Confirmed (Travelify returned documents:[]).
- **No real agencies table yet.** invites.agency_id is a free-text column; the
  hardcoded admin-UI ids (e.g. agc_7k2n) are what flows through. Reconciling
  agencies to a real table is post-show work.

## DONE this session

1. **Protection:** tag `show-ready-2026` + branch `live-wiring`.
2. **Spike** `src/app/api/spike-booking/route.ts` (SPIKE_SECRET-gated): dumps
   full raw Travelify shape + a shape report.
3. **Mapper** `src/lib/map-travelify-booking.ts`: raw Travelify → Booking.
   Proven via live `/api/map-test` against DEMO61807:
   - 5 flights, 2 hotels, 1 traveller (de-duped), £1,451 derived total
   - "Unknown" roomType correctly hidden; check-out derived from check-in+nights
   - empty documents/payments flagged with notes for the empty-state work
   - 161-day span (mismatched test dates) rendered honestly with explanatory note
   - skipped[] empty: nothing defeated the mapper
   - Bug caught + fixed on the branch: original primaryCountryCode fallback for
     flight-only bookings was malformed TS that broke type-check; replaced with
     a `lastFlightArrivalCountry` helper. Verified by full local next build.
4. **Live helpers**:
   - `src/lib/travelify-live.ts` — fetchTravelifyRaw + lookupKeysForSession
     (reads email + departure_date from the travellers row).
   - `src/app/api/traveller/booking/route.ts` — public, lt_session-gated;
     returns mapped Booking, 204 if no session (the fallback-to-mock signal).
5. **Additive booking-context** `src/lib/booking-context.tsx` — mock path
   unchanged; on mount also tries `/api/traveller/booking` and overrides with
   the live booking if one comes back. New `source: 'mock'|'live'` and
   `liveLoading` fields added; existing consumers untouched.
6. **Review endpoint** `src/app/api/map-test/route.ts` — secret-gated; runs
   any ref through the mapper and returns raw + booking + report side by side.
   This is the per-booking diagnostic tool.
7. **Invite spike** `src/app/api/spike-invite/route.ts` — secret-gated; bypasses
   the .travelify.io cookie gate so invites can be created from a preview URL.
   Defaults agency_id to `agc_7k2n` (Coast & Crown Travel, the most common
   hardcoded admin id).
8. **README brought current** earlier this morning. version.json bumped to 0.8.0.

## Env vars used

- `SPIKE_SECRET` — gates all four spike endpoints. Currently `sp1ke-luna-7Qx2maY8`.
- All existing vars (AIRTABLE_KEY, TG_ENCRYPTION_KEY, SUPABASE_*, JWT_SECRET).

## ⚠️ Must do before merge to main

Delete all four temporary spike files:
- `src/app/api/spike-booking/route.ts`
- `src/app/api/spike-invite/route.ts`
- `src/app/api/map-test/route.ts`
- (and remove the SPIKE_SECRET env var from Vercel)

## NEXT (when we pick this up again)

1. **Pull more real test bookings through `/api/map-test` and the live render.**
   Each different shape (flight-only, package, no flights, multi-PAX, with
   children, with airport extras) exercises a different mapper path. We tune
   the mapper as edges surface. This is the hardening exercise Andy asked for.
2. **Empty-state placeholders** in the PWA sections (documents, payments) —
   "Your documents will appear here once your agent uploads them" etc. Andy
   chose placeholders (not hidden). Currently the rendering simply shows the
   empty sections without a friendly message.
3. **arrCity refinement.** Mapper currently falls back to airport name when
   Travelify's airport object has no `description`. Add a small IATA→city
   lookup so flight rows read "London → New York" rather than
   "London → John F. Kennedy Intl. (JFK)". Cosmetic, not blocking.
4. **Test the "info arrives later" flow** Andy specifically wanted to observe:
   upload documents to this agency, refresh the PWA, watch the empty docs
   section populate. Same for payments when Travelify returns them.
5. **Per-agency Travelify credentials.** Still on demo bypass. Required when
   we move past the demo integration agency.
6. **Reconcile admin pages with real data.** Agencies/dashboard/sync/travellers
   admin pages still render from hardcoded arrays. Wire to the real Supabase
   data once an `agencies` table is created (currently agency_id is free-text).

## Known quirks to remember

- DEMO61807's flights are in September but hotels in April — it's a stitched
  test booking. tripStartEvent reflects the EARLIEST dated event, so on this
  booking it says "check-in" rather than "fly". Correct behaviour; clean data
  will produce "fly". The 161-day note from the mapper flags it.
- Travelify naive datetimes (no zone) are treated as UTC by toIso().
- *.vercel.app preview URLs cannot receive the .travelify.io admin cookie. So
  admin-gated routes can't be used on the preview. All spike endpoints work
  around this with the secret-gate pattern.
- Esbuild was used during this session for quick syntax checks but does NOT
  type-check — Vercel uses full tsc. Always run `npm run build` locally before
  saying a file is clean. (Lesson learned this session.)
