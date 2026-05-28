# Luna Travel — Live Wiring & Control Integration: State

**Working branch: `main`** (consolidated 28 May — see Branch note below)
**Show URL:** https://lunatravel.travelify.io (deploys from main)
**Last updated:** 28 May 2026 (afternoon)

---

## ⚠️ BRANCH NOTE — read first

We consolidated onto `main`. Previously work was split:
- `main` had today's agencies/Control integration (28 May).
- `live-wiring` had yesterday's booking-context PWA live-fetch (27 May).
They had DIVERGED — each had something the other lacked. We brought the one
missing file (src/lib/booking-context.tsx, the additive live-fetch version)
from live-wiring onto main. main now contains EVERYTHING.

Going forward: **work only on `main`.** `live-wiring` is now redundant and
should be deleted to avoid future confusion (do this once main is confirmed
good in production). The old `show-ready-2026` tag still exists as a rollback
point to the pre-live-wiring build if ever needed.

Consequence accepted: the live booking-fetch path is now on the show build.
It is additive — no lt_session => falls back to the mock picker, so the
TravelTech Show mock demo is unaffected. Conscious choice, not an accident.

---

## ARCHITECTURE PRINCIPLE (locked 28 May)

Control (id.travelify.io/admin, tg-widgets repo) is the SINGLE SOURCE OF TRUTH
for clients. Every tool reads back to Control. All tools run on *.travelify.io
subdomains, sharing the tg_session SSO cookie. An "agency" in Luna Travel = a
Control client entitled to the `luna-travel` catalogue product, identified by
the Control client record id (recXXX). Luna Travel stores NO agency records.

---

## DONE — Control integration, stage one + Step 3 (28 May)

1. **Luna Travel in Control catalogue.** Product code `luna-travel` (hyphen),
   category Luna Suite, active. Added via Control's New Product panel.
2. **Editable entitlements built in Control (Phase 3 gap closed).** Every
   product now toggles on/off from the client detail page.
   - NEW: tg-widgets/api/admin/clients/update-entitlement.js (find-or-create,
     marks source 'Manual Override'). Deployed to prod, verified (405 to GET).
   - EDITED: tg-widgets/public/admin/client-detail.html (toggle switches).
3. **Travel Demo Tes Ltd granted Luna Travel.** Control client on Travelify
   App 250 — the SAME account holding test booking DEMO61807.
4. **STEP 3 DONE (one page): Luna Travel reads agencies from Control.**
   - NEW: src/app/api/admin/agencies/route.ts — gates with requireAdmin,
     forwards tg_session cookie to Control's /clients/list and /clients/get
     server-to-server (Path B — no CORS, no new creds, Control untouched),
     filters to productCode 'luna-travel' && enabled. ON MAIN.
   - EDITED: src/app/admin/agencies/page.tsx — now fetches /api/admin/agencies
     instead of the hardcoded AGENCIES array. Design unchanged. ON MAIN.
   - PROVEN LIVE on lunatravel.travelify.io: agencies list shows ONLY Travel
     Demo (the only client with luna-travel enabled). Fake agencies gone.
     Stats show '—' (Luna-Travel-derived data not wired yet — honest blanks).

## Why Path B (cookie-forward server-to-server) over Path A (browser CORS)
Credentialed CORS is a security footgun (loose origin reflection = auth hole).
Path B has no CORS surface, keeps the cookie between backends, and required
zero Control changes. Reuses the existing verifyAdminSession pattern in
src/lib/admin-session.ts. requireAdmin(req) gates; cookie forwarded verbatim.

---

## NEXT — finish Step 3 across the remaining admin pages

The agencies LIST page is done and proven. Same hardcoded AGENCIES array still
lives in four more pages — wire each to /api/admin/agencies (or ?id= for one):
1. src/app/admin/agencies/[id]/page.tsx  — DETAIL (most important next; the
   Travellers tab lives here, key to the onboarding journey). Use ?id=recXXX.
2. src/app/admin/travellers/page.tsx     — agency dropdown for invites.
3. src/app/admin/dashboard/page.tsx      — overview stats/agency list.
4. src/app/admin/sync/page.tsx           — sync monitor agency list.

Pattern proven: fetch on mount, loading/empty/error states, '—' for stats
Control doesn't have. Single-agency detail: GET /api/admin/agencies?id=recXXX
(returns { agency, entitlements }).

## Remaining gaps beyond Step 3
- Luna-Travel-derived stats (travellers, trips, installs, lastSync) — show '—'
  until that data layer is built. Decide source (count travellers/invites rows).
- Status vocab: Control says "active", Luna Travel UI historically said "live".
  Cosmetic mapping decision.
- Empty-state placeholders in PWA sections (documents/payments).
- arrCity refinement (IATA->city: "London -> New York").
- Per-agency Travelify creds: now available via Control client travelifyAppId
  + apiKey. Wire the live booking lookup to use the agency's own creds (it
  currently uses the demo App 250 bypass).
- Agency self-service portal: still none. Control is Travelgenix-operated.

## ⚠️ Before any "production clean" — remove temporary spikes
These are on BOTH branches and therefore on the live build. Secret-gated, so
not a security emergency, but delete before calling it production-clean:
- src/app/api/spike-booking/route.ts
- src/app/api/spike-invite/route.ts
- src/app/api/map-test/route.ts
- remove SPIKE_SECRET env var from Vercel.

## Key reusable facts
- Catalogue productCode: `luna-travel` (hyphen). Permission slug: `luna_travel`
  (underscore). Different identifiers, different jobs — don't conflate.
- Control client API: /api/admin/clients/list, /get?id=recXXX (gated
  widget_suite owner/admin via tg_session).
- Test client: Travel Demo Tes Ltd, Travelify App 250, booking DEMO61807.
- Mapper proven: src/lib/map-travelify-booking.ts (5 flights, 2 hotels etc).
