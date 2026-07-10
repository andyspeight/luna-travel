# Luna Travel — Go-Live Readiness Review

**Date:** 9 July 2026
**Reviewer:** engineering review (branch `claude/go-live-readiness-review-74ho1c`)
**Build under review:** `main` @ `d98266e` (PDF-import training) — this is what production
(`lunatravel.travelify.io` / `luna-travel-seven.vercel.app`) is currently serving.
**Predecessor:** `docs/smoke-test-2026-06-16.md` (last formal gate). ~3 weeks of feature
work landed 16–18 June and then the project went quiet; this review brings the picture current.

---

## Verdict

**Strong foundation, not yet go-live. Estimate: ~1–2 focused days of code + a config pass.**

The platform underneath is genuinely production-grade — real Supabase backend, sound auth,
no leaked secrets, all quality gates green, and most of the "big" subsystems (off-platform
bookings, PDF import, sync monitor, per-agency Travelify credentials, messaging, flight hub,
documents) are wired to real data end-to-end.

What holds it back from a real launch is a **band of demo-grade surfaces in the
traveller-facing onboarding path** (a first-time visitor is shown a fake Maldives holiday),
a few **vestigial/mock admin flows**, and a set of **production config dependencies that must
be confirmed** (a single unset env var silently routes every agency through one demo Travelify
account). None of these are architectural — they're finish-work.

---

## 1. Quality gates — GREEN

| Gate | Result |
|---|---|
| `npm install` | OK |
| `npm run type-check` (`tsc --noEmit`) | PASS — 0 errors |
| `npm run lint` (`next lint`) | PASS — 0 warnings/errors |
| `npm run build` (`next build`) | PASS — all routes compiled, middleware built |

> Note: the local environment has a global TypeScript **6.0.2** on `PATH`
> (`/opt/node22/bin/tsc`) that, if it ever shadows the pinned local **5.6.2**, fails
> type-check on a `baseUrl` deprecation (TS5101). The npm script correctly uses the local
> 5.6.2 and passes. `next lint` is deprecated (removed in Next 16) — migrate to the ESLint
> CLI when convenient. Neither is a blocker.

---

## 2. Live infrastructure — verified

- **Vercel** (`agendasgroup` team, project `luna-travel`): latest production deployment is
  `READY`, auto-deployed from `main`. Node 24.x. Domains: `lunatravel.travelify.io` (custom),
  `luna-travel-seven.vercel.app`. Security headers set in `vercel.json`
  (X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy); `X-Powered-By` removed.
- **Supabase**: the `luna_travel` schema lives inside the shared **Travelgenix CRM** project
  (`iexryjynfaktfbvzlwlx`, eu-west-1). All 12 tables present and migrated:
  `invites, travellers, documents, messages, message_recipients, audit_events,
  trip_flights, app_opens, sync_events, bookings, pdf_extraction_profiles, push_subscriptions`.
  RLS is enabled on every table with **no policies** — correct here, because these are
  service-role-only tables (RLS-on + no-policy = deny-all to anon/auth). The 7
  `rls_enabled_no_policy` advisories against them are INFO-level and expected.
- **Supabase advisories** attributable to `luna_travel`: one WARN only —
  `function_search_path_mutable` on `luna_travel.set_updated_at` (set a fixed `search_path`;
  one-line migration). The 15 ERROR-level advisories in the project belong to **other schemas**
  (`backoffice`, `public`) sharing the CRM database — not this app.
- **Cron**: `vercel.json` registers a daily `GET /api/cron/sync` at 06:00 UTC.

---

## 3. What's real (production-ready today)

- **Auth & security architecture (sound).** Admin APIs are double-gated (edge middleware
  against the central `tg_session` + in-handler `requireAdmin()`); the traveller `lt_session`
  is an HS256 JWT (30-day, httpOnly/secure/sameSite=lax) issued only after a booking
  knowledge-check, and every traveller API verifies it and scopes queries by the token's
  claims. The AeroDataBox webhook uses a constant-time token compare. The Supabase
  service-role key and all other secrets are server-only; the sole `NEXT_PUBLIC_` value is the
  public Supabase URL. No secrets in logs, no PII in logs.
- **Off-platform bookings** (manual + PDF import) — end-to-end real: writes a real
  `luna_travel.bookings` row, creates a real invite, and the PWA renders it identically to a
  live Travelify booking via the canonical mapper.
- **PDF import** — real AI extraction with a per-agency learning loop (hints + confirmed
  examples). Backends tried in order: Luna Chat internal service → direct Anthropic fallback.
- **Sync monitor** — real feed backed by `luna_travel.sync_events` (the previously-simulated
  generator is gone).
- **Per-agency Travelify credentials** — the live read paths (traveller booking, redemption,
  sync sweep) resolve each agency's own credentials through Control's internal endpoint when
  `TG_INTERNAL_KEY` is set. Credentials never leave Control (good posture).
- **Also real:** agent→traveller messaging, live flight hub (subscribe + webhook fan-out),
  private-bucket documents with 15-min signed URLs, hero images, audit logging, admin stats
  (which explicitly refuse to fabricate telemetry), the live weather + public-holidays layer.

---

## 4. Go-live blockers — CODE (traveller-facing "demo smell")

These are what a real customer would hit or see. All are finish-work, not redesign.

1. **A first-time / un-onboarded visitor sees a fake holiday.** The no-session default booking
   is the Maldives demo trip (`src/lib/booking-context.tsx:32`, `getDefaultBooking()`). With no
   `lt_session`, the app renders Darren Swan's Maldives itinerary rather than an onboarding/empty
   state. The live-booking override is correctly additive — the problem is only the *default*.
2. **The "find my trip" onboarding is simulated against mock data.** `src/app/welcome/page.tsx`
   matches the booking reference against the 4 mock bookings via `setTimeout`, not Travelify.
   It also renders, to real users, a **"Demo mode — try DEMO81297 / Swan"** hint (`:134–144`)
   and a `mailto:hello@travelaire.co.uk` link to the fictional demo agency (`:126`).
3. **Post-trip reviews are never submitted.** `src/app/review/page.tsx:27–30` only sets local
   state, yet the UI shows "Thanks — that's sent" (`:107`). Wire the POST or disable the screen.
4. **Vestigial admin sign-in page.** `src/app/admin/signin/page.tsx` posts to
   `POST /api/admin/signin`, which **does not exist** (auth moved to Travelgenix ID SSO). It
   shows a dead email/password form and a **"Coming soon: sign in with your Travelgenix
   account."** footer. Remove it (and the `admin.signin*` audit-event mapping in
   `stats/route.ts:221–223`).
5. **The "Create agency" wizard is mock and misleading.** `src/app/admin/agencies/new/page.tsx`
   fakes the credential test and never persists — it just `router.push`es back to the list. This
   is architecturally moot (agencies are created in **Control**, the single source of truth), so
   the wizard should be removed or replaced with a "manage agencies in Control" pointer. Its
   default Travelify **App ID `'250'`** (the demo account) should not ship as a default either.
6. **The Demo tab ships in production, first in the admin nav.** `/admin/demo` is `NAV[0]` in
   `src/app/admin/layout.tsx` with no environment/feature gate. It bundles mock booking data and
   exposes `/?demo=<ref>` deep-links into the live traveller app. Gate it behind a non-prod /
   feature flag (and confirm the `/?demo=` deep-link is acceptable to leave enabled).
7. **App version is frozen at 0.14.11** (`src/lib/app-update.ts` and `public/version.json`,
   dated 2026-06-03) despite all the June feature work. Because `APP_VERSION` equals the
   published `version.json`, the PWA force-update pill **never fires** — installed users won't be
   nudged onto the new build. Bump both on release.

---

## 5. Go-live blockers — CONFIG (must confirm in Vercel; cannot be read from code)

The app is deliberately fail-soft: missing env vars don't crash the build, routes degrade.
That makes an explicit production env audit essential — a silent fallback is worse than a crash.

1. **`TG_INTERNAL_KEY` — highest impact.** Unset ⇒ invite redemption and the sync sweep
   **silently validate every agency against the single demo Travelify account** (App 250,
   record `rec6TnQI0Pz8PyrGs`). On-platform traveller-booking fetch hard-requires it (500 if
   missing). Confirm it is set.
2. **`CRON_SECRET`** — unset ⇒ the daily `/api/cron/sync` returns 401 forever, the sweep never
   runs, and the Sync monitor stays empty. No alerting on this. Confirm it is set (Vercel sends
   `Authorization: Bearer ${CRON_SECRET}`).
3. **PDF-import AI backend** — needs `ANTHROPIC_API_KEY` (fallback) or
   `LUNA_CHAT_EXTRACT_URL` + `TG_INTERNAL_KEY` (preferred). Also verify **`ANTHROPIC_MODEL`** —
   the code default `claude-sonnet-4-6` looks stale against the current model line; an invalid id
   makes every fallback extraction 400. Set an explicit, valid model id.
4. **Core secrets** must all be present: `SUPABASE_URL`, `SUPABASE_ANON_KEY`,
   `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SUPABASE_URL`, `JWT_SECRET` (≥32 chars),
   `TG_ENCRYPTION_KEY`, `AIRTABLE_KEY`, `AERODATABOX_API_KEY`, `AERODATABOX_WEBHOOK_TOKEN`,
   `LUNA_TRAVEL_PUBLIC_URL`, `BLOB_READ_WRITE_TOKEN`, `CALENDARIFIC_KEY`.

---

## 6. Should-fix (security / correctness / honesty — not strictly blocking)

- **Add in-handler `requireAdmin()` to `GET /api/admin/agencies/[id]/messages`**
  (`route.ts:208`). It's the one admin route/method relying on edge middleware alone; it returns
  message content via the service-role client. Add for parity with the POST beside it.
- **Add a Content-Security-Policy (and HSTS).** There is no CSP anywhere — the highest-value
  missing control for a PWA that renders agency branding, message images and signed doc URLs.
- **No role enforcement.** `verifyAdminSession` checks only that the `luna_travel` permission is
  present, never `claims.role`. Any entitled user can delete heroes/documents and edit
  integrations. Decide whether destructive actions require `owner`.
- **Off-platform invite creation failure is swallowed** — the booking saves but the success
  screen can show `inviteId: null` with no QR and no error, stranding the traveller with no way
  to onboard. Surface the failure.
- **"Sync" overstates what it does.** It's a reachability health-check: it never updates the
  traveller row and always records `documents_added: 0`, yet the detail reads "Booking
  refreshed." Fix the wording or implement real refresh.
- **Notifications / push is a visual mock.** The Notifications page renders an iOS-style
  *preview*; preferences are local `useState` (not persisted) and there is **no web-push code** —
  which is why the `push_subscriptions` table (migrated 30 May) sits empty and orphaned.
  Messaging is delivered **in-app** (unread banner/badge), which is fine for v1 — but say so
  honestly and either wire real push or relabel the preferences UI.
- **Luna concierge is 100% canned** (`src/app/luna/page.tsx` — deterministic per-country
  strings, no AI). Acceptable as a stated v1 limitation; otherwise wire the real API.
- **Minor:** PDF-imported bookings are stored as `source:'manual'` (never `'pdf'`);
  normalise timing-safe compares for `x-tg-internal-key` and `CRON_SECRET` (the webhook already
  uses `timingSafeEqual`); the sync sweep is sequential over all travellers (a scaling risk, not
  a launch risk); the traveller JWT has no early revocation (30-day validity).

---

## 7. Docs & hygiene

- **README / `live-wiring-state.md` / `smoke-test` all stop at 16 June** and don't reflect the
  16–18 June features (weather/holidays, real sync monitor, off-platform bookings, PDF import,
  demo tab, per-agency creds). The README's data-model table is also drifted: it lists an
  `agencies` table that **does not exist** in `luna_travel` (agencies are read from Control) and
  omits `push_subscriptions` and `sync_events`/`bookings`/`pdf_extraction_profiles` nuances.
- **In-repo migrations are a partial set.** *(Closed — see the Session-2-continued addendum.)*
  Originally `db/migrations/` held only the newest few files; the core tables
  (`travellers`, `invites`, `documents`, `messages`, `message_recipients`, `trip_flights`,
  `app_opens`, `audit_events`) had been applied directly to prod, so a fresh environment built
  from `db/migrations/` alone would fail (the `sync_events` migration FK-references `travellers`).
  `luna_travel_baseline.sql` now captures those base tables + enums + indexes + RLS, so the repo
  is reproducible. (`push_subscriptions` is deliberately omitted — it is orphaned/unused; web-push
  is not implemented, and messaging is in-app for v1.)

---

## 8. Prioritised go-live checklist

**Must, before launch**
- [x] Replace the no-session demo default with a real onboarding/empty state (§4.1) — **done** (first run with no session shows the onboarding screen; the `/?demo=` / saved-ref / picker demo paths are preserved per owner)
- [ ] Wire `/welcome` to the real booking lookup (§4.2) — **honesty half done** (demo-mode hint + fake `hello@travelaire.co.uk` mailto removed, copy made honest); **live-Travelify lookup still deferred**
- [x] Wire or remove post-trip reviews (§4.3) — **wired** (`luna_travel.reviews` + `/api/traveller/review`)
- [x] Remove the vestigial admin sign-in page (§4.4) — **done** (now an honest SSO "signed out" screen; the `admin.signin*` audit *types* were kept for historical rows)
- [x] Remove/redirect the mock "Create agency" wizard; drop the App-250 default (§4.5) — **done** (Control explainer)
- [x] Gate the Demo tab out of production (§4.6) — **done** (nav hidden in prod unless `NEXT_PUBLIC_LUNA_DEMO=1`; route still reachable by URL; the `/?demo=` deep-link left in place since the demo default stays for now)
- [x] Bump `APP_VERSION` + `version.json` so the update path works (§4.7) — **done** (0.15.0)
- [ ] **Confirm the production env vars** — `TG_INTERNAL_KEY`, `CRON_SECRET`, the AI backend +
      `ANTHROPIC_MODEL`, and the core secrets (§5) — *owner action (cannot be set from code)*

**Should, at/near launch**
- [x] `requireAdmin()` on `messages` GET; add CSP + HSTS (§6) — **done** *(validate the CSP on the preview deploy — see note)*
- [ ] Decide role enforcement (owner vs admin) (§6) — *decision pending*
- [x] Surface off-platform invite-creation failures (§6) — **done** (invite retried; explicit `inviteError` returned, booking kept; success screen shows a warning + "Retry invite")
- [x] Fix "sync" wording / document-count honesty (§6) — **done** ("Booking refreshed" → "Booking verified"; the sweep is now described as the reachability check it is)
- [ ] Decide + label the push-notifications and Luna-concierge v1 limitations (§6) — **notifications done** (page now says in-app-only, no false "encrypted push" claim); Luna-concierge labelling *still pending*
- [x] Refresh README / docs; commit the missing base migrations for reproducibility (§7) — **done** (README current to 0.15.0 + go-live work; `luna_travel_baseline.sql` captures the 8 base tables/enums/indexes/RLS, validated idempotent against prod)

**Nice-to-have / track**
- [ ] `source:'pdf'` labelling; sync-sweep batching; JWT revocation — timing-safe compares **done** (`safeEqual` on `TG_INTERNAL_KEY` + `CRON_SECRET`)
- [x] Harden `luna_travel.set_updated_at` search_path (§2) — **done** (`set search_path = ''`; clears the Supabase advisory)

---

## Addendum — closed on branch `claude/go-live-readiness-review-74ho1c` (9 Jul 2026)

Delivered in three commits on top of this review (all gates green — type-check,
lint, `next build`):

1. **Security hardening** — CSP + HSTS added to `vercel.json`; `requireAdmin()`
   added in-handler to `GET /api/admin/agencies/[id]/messages`.
2. **Retired demo-grade admin surfaces** — honest SSO sign-out page; the mock
   agency wizard replaced by a Control onboarding explainer (App-250 default
   gone); Demo tab gated out of the production nav; version bumped to 0.15.0.
3. **Post-trip reviews wired** — new `luna_travel.reviews` table (applied to
   prod), `POST /api/traveller/review` (session-scoped), and the review screen
   now persists for real / surfaces genuine errors instead of always claiming
   "sent".

**Deferred by owner decision:** the onboarding no-session default and the
`/welcome` live-Travelify lookup + demo-hint removal (§4.1–4.2) were left for a
later pass. **Owner action outstanding:** the production env-var confirmation
(§5) — a code review cannot read or set Vercel env vars.

**One thing to validate on the preview deploy before merging to `main`:** load
the installed PWA on the branch's Vercel preview and confirm the new CSP doesn't
block anything at runtime — the map iframes render, Google Fonts load, and hero
/ blob / signed-document images all appear, with no CSP violations in the
browser console. The policy was written to be compatible, but `vercel.json`
headers only apply on Vercel (not `next start`), so this is the first place it
can be exercised end-to-end.

---

## Addendum — session 2 (10 Jul 2026): agency platform + gap closes

Built on top of the go-live pass above; all gates (type-check, lint, `next build`)
stayed green throughout, and each DB change was applied to prod and round-tripped.

**White-label branding now reaches the traveller app (was §3 gap "biggest").**
The agency `Agency` type + `orderToBooking` carry `appName` / brand colours /
`welcomeMessage` (colours sanitised to `#RRGGBB`); the `teal`/`navy` Tailwind
tokens are CSS-variable-backed so an agency's colours re-theme the app at
runtime; a new `AgencyLogo` renders logo + app name on home / cover / Me, and the
welcome message shows on home. Verified in a headless browser (default teal vs a
gold-branded agency, resets on switch).

**Branding override model (owner-chosen "write to both").** New
`luna_travel.agency_branding` — effective branding resolves per-field as
`Luna override ?? Control ?? default`, Luna wins on read. The White-label tab
writes the Luna override *and* syncs to Control, with a "Reset to Control".
`/api/traveller/booking` overlays the override on live + stored bookings.

**Off-platform invite failure surfaced (was §6).** The Add-booking route retries
the invite and, on failure, returns an explicit `inviteError` (booking kept); the
success screen shows a warning + "Retry invite" instead of a QR-less success.

**Luna-native agencies (stage 2 — non-Travelgenix clients).** An agency can now
be a Control client (`rec…`) or Luna-native (`lt…`, `luna_travel.agencies`).
Shared `lib/agency-id.ts` + `lib/agencies.ts`; create form + `POST
/api/admin/agencies`; list = Control + Luna (native still listed if Control is
down); every agency-scoped path is source-aware (branding syncs to Control only
for Control agencies; off-platform bookings + traveller render never call Control
for native; Travelify tab hidden for native). Verified: store round-trips; id
scheme classifies `rec`/`lt`/junk correctly.

**Deferred / owner action:** the Control side must expose a `clients/create`
endpoint if Travelgenix clients should ever be *created* from Luna (native
agencies don't need it); the branding "sync to Control" + reads still depend on
Control's `update-branding` / `clients/get` persisting the five branding fields
(confirmed present on the Control **Clients** Airtable table). The full
admin→traveller flows for the new work need the deployed env (SSO + a redeemed
session) to exercise end-to-end.

### Session 2 (continued) — traveller honesty, hardening, reproducibility

**No fake first-run trip (§4.1).** With no `lt_session` and no demo deep-link the
home screen now shows a real onboarding view ("Your trip, in your pocket" +
"Add your trip" / "Find my trip"), tab bar hidden. Demo paths (`/?demo=`, saved
ref, long-press picker) still load the sample trip. Verified headless 5/5:
default → onboarding + no tab bar + no Maldives; `/?demo=DEMO81297` → trip + tab
bar.

**Traveller-facing honesty (§4.2, §6).** `/welcome` lost the demo-mode hint and
the fake `hello@travelaire.co.uk` mailto (honest placeholders + help copy); the
Notifications page no longer claims "Push tokens are stored encrypted" — it says
messaging is in-app for v1. (The live-Travelify `/welcome` lookup and the
Luna-concierge v1 labelling remain the only open items in §4.2 / §6.)

**Backend honesty + hardening (§2, §6).** `runSyncSweep` now reports "Booking
verified" (it's a reachability check, not a refresh). Internal secrets are
compared with `safeEqual` (SHA-256 + `timingSafeEqual`) in
`flights/subscribe`, `flights/subscribe-booking` and `cron/sync`, so neither
timing nor length leaks. `luna_travel.set_updated_at()` search_path pinned to
`''` (clears the Supabase `function_search_path_mutable` advisory).

**Reproducibility (§7).** `db/migrations/luna_travel_baseline.sql` now captures
the eight base tables (`travellers`, `invites`, `documents`, `messages`,
`message_recipients`, `trip_flights`, `app_opens`, `audit_events`) with their 11
enums, indexes, FKs and RLS — reconstructed from the live schema and validated as
an idempotent no-op re-run against prod. Together with the per-feature create
files a fresh environment is now buildable from `db/migrations/` alone. README
brought current to 0.15.0 + all go-live work (env vars, data model, structure,
security notes).

**Still open (owner decisions / owner actions, not code):** role enforcement
(owner vs admin), real web-push, the live-Travelify `/welcome` lookup, real Luna
concierge; production env-var confirmation (`TG_INTERNAL_KEY`, `CRON_SECRET`, AI
backend); CSP validation on the preview deploy; a Control `clients/create`
endpoint if Travelgenix clients are ever created from Luna.
