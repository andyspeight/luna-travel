# Luna Travel — Live Wiring: Session State

**Branch:** `live-wiring` (NOT merged to main — do not merge until after TravelTech Show)
**Tag protecting the show build:** `show-ready-2026` (on main)
**Preview URL:** https://luna-travel-git-live-wiring-agendasgroup.vercel.app
**Show URL (frozen on main):** https://lunatravel.travelify.io
**Last updated:** 27 May 2026

---

## Goal of this work

Wire the traveller PWA to live Travelify bookings, **additively** — the four
mock bookings and the long-press booking picker MUST stay on their own
untouched path so the TravelTech Show demo (24–25 Jun) is never at risk.
Live data is shown ONLY when there's a real session; with no session the PWA
falls back to the mock picker exactly as today.

At the show, Andy WILL demo a live QR-to-Travelify redemption as well as the
mock bookings, so the live path has to be solid and rehearsed by the 24th.

## Andy's testing philosophy (drives all design)

Andy will pull several real bookings of widely varying shape/completeness to
find where the platform breaks BEFORE the show. So:
- The mapper is defensive everywhere; every field optional, every array
  possibly empty, every nested object possibly missing. Never invents data.
- Documents and payments are often empty now and fill in LATER. Andy wants to
  see how the app copes with info arriving after the initial pull.
- Fields like roomType="Unknown" may be populated later — handle gracefully.
- Empty sections show a friendly "nothing here yet" placeholder (Andy's
  choice), NOT hidden. When data arrives later, the placeholder becomes content.
- Andy reviews each booking by wiring it into the live PWA and eyeballing it on
  the preview URL.

## Decisions locked

- **Flight segments flatten 1:1 to FlightLeg.** Travelify nests
  items[].dataObject.routes[].segments[]; one route can hold multiple segments.
  Every segment becomes its own FlightLeg. Confirmed by Andy against the real
  multi-city DEMO61807 (renders as 5 flight rows: LHR→JFK, JFK→BOS, BOS→LAS,
  LAS→JFK, JFK→LHR). Andy's screenshot confirmed this is the desired display.
- **Credentials:** the demo integration (App 250) reaches the test bookings, so
  the show demo can use the existing demo-bypass path. Per-agency credential
  lookup is still deferred (not needed for the show).
- **Documents come from Luna Travel's own Supabase bucket, NOT Travelify.**
  Travelify returns documents:[] — confirmed. So "documents pulling through"
  will come from the agency upload side, not this feed.

## DONE this session

1. **Protection:** tag `show-ready-2026` + branch `live-wiring` created.
2. **Spike** `/api/spike-booking` (secret-gated via SPIKE_SECRET env var) —
   fetches a real Travelify order and dumps full shape + a shape report.
   ⚠️ TEMPORARY — delete before merge. Lives at src/app/api/spike-booking/route.ts.
   (Was originally under /api/admin but moved out: the admin cookie is scoped to
   .travelify.io and never reaches a *.vercel.app preview URL, so admin-gated
   routes can't be hit on preview. Secret-token gate works on any domain.)
3. **Mapper** `src/lib/map-travelify-booking.ts` — raw Travelify → Booking.
   PROVEN against real DEMO61807 in a local esbuild+node run:
   - 5 flights, 2 hotels, 1 traveller (de-duped), £1,451 derived total
   - roomType "Unknown" correctly hidden; check-out derived from check-in+nights
   - empty documents/payments flagged with notes for empty-state handling
   - 161-day span (mismatched test dates) rendered honestly with an explanatory note
   - Returns { booking, report } — report has diagnostics for the review endpoint
   - skipped[] was empty: nothing in the booking defeated the mapper

## Env vars added

- `SPIKE_SECRET` (Vercel, All Environments) — gates the spike. Value held by Andy.

## NEXT — pick up here

1. **Review endpoint** `/api/map-test` (same SPIKE_SECRET gate): runs any booking
   ref through mapTravelifyBooking and returns raw + mapped Booking + report,
   side by side, so each new test booking can be checked.
2. **Source resolver:** the PWA fetches the live booking when a valid lt_session
   exists; otherwise falls back to the mock picker. Picker + mock-bookings.ts
   stay completely untouched. Likely a small server route + a tweak to
   booking-context so the active booking can come from either source.
3. **Empty-state placeholders:** friendly "nothing here yet" states on documents,
   payments (and any empty section) so info arriving later visibly fills in.

## Known quirks to remember

- tripStartEvent reflects the earliest DATED event. On DEMO61807 that's the
  April hotel, so it says "check-in"/"until you check in" rather than "fly".
  Correct behaviour — on clean data where the flight is first it'll say "fly".
- Travelify naive datetimes (no zone) are treated as UTC by the mapper's toIso().
- primaryCountryCode comes from first hotel's country; flight-only bookings need
  watching (current fallback is thin — revisit when a flight-only real booking
  is tested).
