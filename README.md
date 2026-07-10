# Luna Travel

The post-booking traveller PWA in the Travelgenix stack.

An installable, offline-capable Next.js 15 app that re-presents a confirmed
booking to the traveller as a native-feel mobile app — trip wallet, itinerary,
live flight status, documents, destination guides, maps, agent messaging and a
Luna concierge. Vamoos-class experience, built on Travelgenix rails.

Originally scoped to demo at **TravelTech Show, 24–25 June 2026**. The
prototype is complete and the project has since grown a real Supabase-backed
multi-agency platform behind it. No throwaway code — the prototype is the
foundation of production v1.

- **Live:** https://luna-travel-seven.vercel.app
- **Show URL:** https://lunatravel.travelify.io (deploys from `main`)
- **Repo:** https://github.com/andyspeight/luna-travel
- **Vercel:** https://vercel.com/agendasgroup/luna-travel (agendasgroup team)
- **Version:** 0.15.0 (go-live hardening in progress on `claude/go-live-readiness-review-74ho1c`)

---

## Two halves of the product

Luna Travel is two connected systems in one repo:

1. **The traveller PWA** (public) — what the holidaymaker installs and uses.
   Runs on mock bookings today; the live Travelify fetch path is present and
   additive (see "What's real vs mock").
2. **The agency + admin platform** (gated) — how agencies onboard travellers,
   upload documents, message travellers, and how Travelgenix administers the
   whole thing. This is real: Supabase database, Control (Travelgenix ID) as
   the source of truth for agencies, Travelify credential decryption, signed
   document storage, invite/QR redemption, live flight tracking and audit
   logging.

---

## Tech stack

- **Next.js 15.5.19** (App Router, React 18.3) + **TypeScript** + **Tailwind**
- **`@ducanh2912/next-pwa`** — service worker, manifest, install prompt, offline cache
- **Supabase** — Postgres (`luna_travel` schema) for agencies, travellers,
  invites, documents, messages and live flight rows; Storage for hero images
  (public bucket) and traveller documents (private bucket, signed URLs)
- **AeroDataBox** (via API.Market) — live flight status; inbound webhook
- **Travelify** — booking lookup via the same AES-256-GCM credential pattern as
  the tg-widgets project (ClientIntegrations table, base `appAYzWZxvK6qlwXK`)
- **`@vercel/blob`** — agency logo + message-image uploads (client-upload flow)
- **`jose`** — traveller session JWTs (`lt_session` cookie)
- **Travelgenix ID (SSO)** — admin auth via `tg_session` + `tg-auth-gate.js`,
  with Control as the single source of truth for agencies/entitlements
- **`qrcode`** — booth/invite QR generation
- In-house lightweight **i18n** (6 locales) — no runtime dependency
- Inter (UI) + Instrument Serif (display) via `next/font`
- **`@travelgenix/ui`** — shared design-token package (`packages/ui`)

---

## Build plan — six sprints (prototype: COMPLETE)

| Sprint | Dates | Scope | Status |
|---|---|---|---|
| 1 — Foundation | 14–20 May | Scaffold, PWA, design tokens, mock data, app shell, picker | DONE |
| 2 — Trip core | 21–27 May | Home with quick tiles & "Up next", itinerary timeline, flight/hotel/extras detail | DONE |
| 3 — Documents & travellers | 28 May–3 Jun | Documents preview/share/download, travellers list & detail, Me page, entrance animations | DONE |
| 4 — Luna & guides + cover mode | 4–10 Jun | Cover splash, Luna concierge with trip context + pill prompts, destination guides, PWA version check | DONE |
| 5 — Polish | 11–17 Jun | Onboarding ref-lookup, post-trip review, notifications preview, micro-interactions, bug fixes | DONE |
| 6a — Widget-style PDFs | 18–20 Jun | HTML+Playwright PDF generator matching the booking widget (Inter + Fraunces, navy header, ref bar) | DONE |
| 6b — Show prep | 21–24 Jun | `/install` QR page, demo script, photography brief, bug-bash | DONE |

**Post-prototype work shipped (not in original plan):**

| Area | What landed | Status |
|---|---|---|
| Real backend | Supabase `luna_travel` schema, lazy clients, env health checks | DONE |
| Control integration | Agencies read from Control (id.travelify.io) via cookie-forward server-to-server; Luna stores no agency records | DONE |
| Agency admin | `/admin` dashboard, agencies (list/new/detail + tabs), travellers, heroes, audit, sync, settings, signin | DONE |
| Invites & QR | Create invite → QR → traveller redeems, validated against Travelify → traveller row + `lt_session` | DONE |
| Documents | Per-agency upload to private Supabase bucket, auto-categorisation, signed-URL download, soft-delete | DONE |
| Hero manager | `/admin/heroes` — browser converts to webp + centre-crops → public bucket; 100 destinations × portrait/landscape | DONE |
| SSO migration | 26 May — admin auth moved to Travelgenix ID (`tg_session`); local password + `lt_admin_session` removed | DONE |
| **Flight Hub** | **Live flight status via AeroDataBox: subscribe by flight, token-authed webhook updates `trip_flights`, fans out flight-category messages to travellers. Admin `flight-test` rig.** | DONE |
| **Agent messaging** | **Agencies message travellers (priority, category, attachments, targeting) via `messages` + `message_recipients`; PWA surfaces unread on home banner, Me badge and Notifications.** | DONE |
| **Per-agency branding** | **Logo upload to Vercel Blob; per-agency Travelify integration credentials + a live connection test.** | DONE |
| **Trip map** | **Map page + sheet, route/geo helpers.** | DONE |
| **i18n** | **6 locales (en, ro, fr, de, es, it) across chrome, home, map, storyboard, inspirations, settings. English is source + fallback. Supplier text is never translated.** | DONE |
| **Inspiration feed** | **Destination-keyed inspiration cards on home + `/inspiration`.** | DONE |
| **Live booking fetch** | **PWA asks `/api/traveller/booking` on mount; uses a real `lt_session` booking if present, else falls back to the mock picker (additive).** | DONE |
| **Engagement ping** | **`/api/traveller/ping` records app opens (`app_opens`) for admin stats.** | DONE |
| **PWA force-update** | **`app-update.ts` + `version-check.tsx`: drop the SW, wipe caches, navigate cache-busted — fixes the stale-shell reload loop.** | DONE |
| Security upgrade | 16 Jun — Next.js 14.2.13 → 14.2.35 → **15.5.19** (closes the middleware auth-bypass CVE-2025-29927 + others) | DONE |
| Admin defense-in-depth | 16 Jun — all 17 admin API routes now re-verify the session in-handler (not middleware alone) | DONE |
| PWA tooling | 16 Jun — `next-pwa@5.6.0` → `@ducanh2912/next-pwa@10` (maintained; Next 15-compatible) | DONE |
| Lint config | 16 Jun — added `.eslintrc.json` (`next/core-web-vitals` + `@typescript-eslint`); `npm run lint` passes clean | DONE |
| Real photography | Cover splashes + PDF heroes for all 4 demo destinations | DONE |

**Post-0.14.11 → 0.15.0 (destination, off-platform bookings, sync, security):**

| Area | What landed | Status |
|---|---|---|
| **Destination guide v1** | Read-only Luna Brain adapter → "For your dates" tab; surfaces Luna Brain events + things-to-do; **live weather (Open-Meteo, keyless) + public holidays (Calendarific) per stay dates** | DONE |
| **Off-platform bookings** | Bookings not held in Travelify: **manual entry** (Vamoos-style), **PDF import** (Luna Chat extract → Anthropic fallback) with **per-client training** (profiles + correction-capture); full products (excursions / car hire / transfers) with photos + live preview; stored in `luna_travel.bookings` (JSONB payload) | DONE |
| **Sync-health monitor** | Real Travelify sync-health monitor + per-booking re-sync; `sync_events` feed wired live (replaces the earlier simulated feed); `/api/cron/sync` sweep (Vercel Cron, `CRON_SECRET`-gated) | DONE |
| **Per-agency Travelify creds** | Live booking lookup now uses each agency's own Control credentials (not the shared demo App 250 path) | DONE |
| Demo surfaces | Admin **Demo tab** (sample-trip QR deep-links) gated out of production (`NEXT_PUBLIC_LUNA_DEMO=1` to show); retired demo-grade admin surfaces; honest SSO "signed out" screen | DONE |
| Security headers | **CSP + HSTS** response headers; in-handler auth on the messages GET | DONE |

**Go-live readiness — `claude/go-live-readiness-review-74ho1c` (post-0.15.0):**

| Area | What landed | Status |
|---|---|---|
| **White-label branding** | Agency brand (app name, primary/accent colour, welcome message, logo) carried end-to-end into the traveller app: CSS-variable-backed Tailwind tokens re-theme the whole PWA; header renders logo + app name + welcome message | DONE |
| **Branding override model** | Branding **pulls from Control when available**; a Luna-side `agency_branding` override layer lets each field be set/overridden in Luna Travel; Control-agency overrides **sync back to Control** ("write to both"), native agencies are Luna-only; per-field Reset-to-Control | DONE |
| **Luna-native agencies** | Agencies can be created **outside Control** for non-Travelgenix clients (stage 2). Prefix-based id scheme (`rec…` = Control, `lt…` = Luna-native); every agency-scoped route is source-aware; list is a Control + Luna union that still shows Luna agencies when Control is unreachable | DONE |
| **Onboarding honesty** | First run with **no session shows a real onboarding screen** ("Add your trip" / "Find my trip"), not a fake demo trip; demo deep-links (`/?demo=`, saved ref, picker) still show the sample trip. `/welcome` and notifications copy made honest (no fake mailto, no false "encrypted push" claim) | DONE |
| **Off-platform invites** | Invite-creation failures on off-platform bookings surface to the agent (retry UI) instead of being swallowed | DONE |
| **Backend hardening** | Constant-time secret comparison (`safeEqual`) for internal keys + cron bearer; `set_updated_at()` search_path pinned (clears Supabase advisory); sync wording made accurate | DONE |

**Agency portal — self-serve, no SSO (`/agency/*`):**

Luna-native agencies (non-Travelgenix clients) have no Travelgenix ID, so they
reach a passwordless portal via a magic link and manage only their own agency.

| Area | What landed | Status |
|---|---|---|
| **Passwordless auth** | `lt_agency_session` JWT (jose/HS256 over `JWT_SECRET`) with a fixed `kind:'agency'` claim so it can't be swapped with a traveller `lt_session`. Single-use, sha256-hashed magic-link tokens (`agency_login_tokens`, atomic `used_at is null` consume). Operators mint a link from the SSO admin (agency detail → "Generate access link") | DONE |
| **App branding** | `/agency/branding` — self-serve name, colours, welcome message, logo, with a **cinematic live phone preview** that re-skins as you type. Writes the Luna override store | DONE |
| **Trips** | `/agency/trips` — itinerary builder (lead, destination, flights, hotels) that reuses `buildManualBooking`, stores an off-platform booking and opens a pending invite. For bookings not in Travelify | DONE |
| **Documents** | `/agency/documents` — upload vouchers/tickets/insurance against a booking ref (before or after redemption); Delivered/Waiting state; delete. Traveller documents route now also matches by the session's booking ref (agency-scoped) | DONE |
| **Send access + invites** | `/agency/access` — create an invite (QR + link) and track every invite sent with a status (Pending / Opened / Installed / Expired / Revoked) + one-tap **revoke** (agency-scoped, pending-only) | DONE |
| **Traveller home polish** | Cinematic hero (scrim + "{N} days until you fly" pill) and a boarding-pass "Up next" card for flights, bringing the live app up to the branding-preview standard | DONE |

Every `/api/agency/*` route self-gates with `requireAgency` and takes the agency
id from the session (never the request), so an agency can only ever touch its
own branding, trips, documents and invites. Verified against the live table:
session cross-rejection, single-use tokens, and cross-agency revoke / delete /
document isolation are all blocked.

---

## What's real vs mock today

**Real (live, Supabase + Travelify + AeroDataBox + Control):**
- Admin sign-in via Travelgenix ID SSO
- Agencies list reads live from Control (only clients entitled to `luna-travel`),
  **unioned with Luna-native agencies** created outside Control
- **Manual + PDF-import creation of Luna-native agencies** for non-Travelgenix
  clients (stage 2)
- Invite creation, QR generation, and traveller redemption (validates the
  booking ref + email + departure date against Travelify before issuing a
  session); off-platform-booking invites surface failures to the agent
- Per-agency document upload, storage, categorisation and signed download
- **Per-agency white-label branding** — app name, primary/accent colour, welcome
  message, logo — pulled from Control with a Luna-side override layer that re-themes
  the whole PWA; Control-agency edits sync back to Control
- Per-agency Travelify integration credentials + connection test; **the live
  booking lookup uses each agency's own Control credentials**
- Hero image upload and serving
- Agent → traveller messaging pipeline (compose, deliver, unread, mark read)
- Live flight status pipeline (subscribe + webhook → `trip_flights` → messages),
  active wherever `AERODATABOX_API_KEY` / `AERODATABOX_WEBHOOK_TOKEN` are set
- **Destination guide** — Luna Brain events + things-to-do, live weather
  (Open-Meteo) and public holidays (Calendarific) for the traveller's exact dates
- **Off-platform bookings** — manual + PDF-imported bookings stored in
  `luna_travel.bookings`, with per-client PDF-extraction training
- **Travelify sync-health monitor** + per-booking re-sync + cron sweep
- Audit logging across admin actions; admin stats

**Still mock (prototype data, swappable in production):**
- The four demo bookings powering the traveller PWA (`mock-bookings.ts`), shown
  only via demo deep-links (`/?demo=`, saved ref, or the hidden picker) — a
  first run with no session now shows the real onboarding screen, not a demo trip
- `/welcome` ref-lookup matches against the mock set, not live Travelify
- The agency **detail** page is live-wired (it fetches `/api/admin/agencies?id=`
  and every tab calls a real API); the in-file `AGENCIES` const is a vestigial
  type anchor, not a data source — worth replacing with a named interface

---

## Mock bookings

Four shapes so the design is pressure-tested early:

| Ref | Destination | Lead | Shape |
|---|---|---|---|
| `DEMO81297` | Maldives | Darren Swan | Long-haul beach, multi-stop, family of 4, B&B |
| `DEMO74002` | Mallorca | Helen Watson | Short-haul beach, direct, family of 4, AI |
| `DEMO66541` | Dubai | Priya Patel | Premium stopover, business class, multi-hotel, couple |
| `DEMO52188` | Athens | James Mitchell | Hotel-only no flight, solo |

**Booking picker:** long-press the Luna logo on the home page to switch booking
or toggle theme. Hidden from production unless invoked.

---

## Data model — Supabase `luna_travel` schema

| Table | Holds |
|---|---|
| `agencies` | Luna-native agencies (`lt…` ids) + local cache/counters. Control (`rec…`) remains source of truth for Travelgenix clients |
| `agency_branding` | Per-agency branding override layer (app name, colours, welcome message, logo) merged over Control on read |
| `travellers` | Redeemed travellers (booking ref, email, agency, session) |
| `invites` | Invite records for the QR/redeem loop |
| `documents` | Per-agency uploaded documents (private bucket pointers) |
| `messages` | Agent/system → traveller messages (subject, body, priority, category, targeting) |
| `message_recipients` | Per-traveller delivery + read state for each message |
| `trip_flights` | Live flight rows (status, gate, terminal, belt, est times, AeroDataBox subscription id) |
| `app_opens` | Engagement pings for stats |
| `audit_events` | Admin action audit log |
| `bookings` | Off-platform bookings (manual / PDF import) not held in Travelify; JSONB `payload` is the rendered Booking |
| `pdf_extraction_profiles` | Per-agency PDF-import training — admin hints + confirmed-correct examples fed back into extraction |
| `reviews` | Post-trip traveller reviews (rating + text) |
| `sync_events` | Travelify sync-health feed (per-run + per-booking outcomes) |
| `agency_login_tokens` | Single-use, sha256-hashed magic-link tokens for the Luna-native agency portal (no SSO) |

RLS is on with no policies, so every table is deny-all except the service-role
client (`getSupabaseAdmin()`), which is the only path that touches them.

---

## Environment variables

| Var | Used for |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public client (read public bucket) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin client (never client-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-side reference where needed (hero URLs) |
| `AIRTABLE_KEY` | Same key as tg-widgets — Travelify credential lookup |
| `TG_ENCRYPTION_KEY` | 64 hex chars; must match tg-widgets or decryption fails |
| `JWT_SECRET` | Signs/verifies the `lt_session` traveller cookie |
| `AERODATABOX_API_KEY` | AeroDataBox (API.Market) flight-status lookups |
| `AERODATABOX_WEBHOOK_TOKEN` | Shared secret in the inbound webhook `?t=` query (constant-time checked) |
| `LUNA_TRAVEL_PUBLIC_URL` | Public base URL used to build the webhook callback target |
| `TG_INTERNAL_KEY` | Internal service-to-service auth for flight subscribe + booking fetch + Luna Chat PDF extraction (constant-time checked) |
| `CRON_SECRET` | Bearer secret for the `/api/cron/sync` sweep (Vercel Cron; constant-time checked). Unset → the route 401s and the admin "Run sync now" button is used instead |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for logo + message-image uploads |
| `LUNA_CHAT_EXTRACT_URL` | Luna Chat PDF-extraction endpoint (preferred PDF-import backend); see `docs/pdf-import.md` |
| `ANTHROPIC_API_KEY` | Direct Anthropic fallback for PDF import when `LUNA_CHAT_EXTRACT_URL` is unset |
| `ANTHROPIC_MODEL` | Optional model override for PDF import (default `claude-sonnet-4-6`) |
| `CALENDARIFIC_KEY` | Optional — public-holiday lookups for the destination guide (Calendarific). Unset → holidays are skipped, weather still works |
| `NEXT_PUBLIC_LUNA_DEMO` | Set to `1` to show the admin Demo tab in production (hidden by default; the `/admin/demo` route stays reachable by URL either way) |

Weather uses Open-Meteo, which needs no key.

Missing env vars do not crash the build (clients are lazy) — routes that need
them return a controlled error and log it.

---

## Data integrity rules

Ported from My Booking widget v1.4.1 (`src/lib/format.ts`):

- No fabricated fallbacks on supplier data — missing fields hide that line
- Board basis through a strict whitelist; unknown values fall back to raw text
- Room name reads from supplier text, not a generic default
- Countdown copy is context-aware: "until you fly" only when flights exist
- Live flight data is overlaid on the booked leg, never merged into it — booked
  (what was sold) and live (what's happening now) are kept distinct at render

---

## Security notes (travelgenix-security)

- **Next.js pinned to 15.5.19** — closes the middleware authorization-bypass
  (CVE-2025-29927) and other advisories present in 14.2.13. The
  `x-middleware-subrequest` spoof is verified to no longer bypass the admin gate.
- Service-role key stays server-side via `getSupabaseAdmin()` only
- Admin API routes gated server-side in `src/middleware.ts` against the central
  Travelgenix ID session; admin pages gated client-side by `tg-auth-gate.js`.
  **Defense in depth:** every privileged admin API route also re-verifies the
  session inside the handler via `requireAdmin()` (23 of the 25 admin routes; the
  two exceptions — `me` and `signout` — read/clear the session themselves), so a
  bypassed or regressed middleware cannot reach the logic
- The AeroDataBox webhook is unauthenticated by the provider, so it is gated by
  a secret token in the query string, compared in constant time
- Internal service-to-service secrets (`TG_INTERNAL_KEY`, `CRON_SECRET`) are
  compared with `safeEqual()` (SHA-256 + `timingSafeEqual`) so neither timing nor
  length leaks — see `src/lib/constant-time.ts`
- Travelify calls require the `Origin` header or the API returns a silent 401 —
  do not remove it
- Traveller documents live in a **private** bucket; the PWA only ever receives
  short-lived (15-min) signed URLs, authorised by the `lt_session` cookie
- Hero images live in a **public** bucket — durable, cacheable, offline-friendly
- Response security headers (Content-Security-Policy, Strict-Transport-Security,
  X-Frame-Options, nosniff, Referrer-Policy, Permissions-Policy) set in `vercel.json`
- Every upload validated server-side: roster check, variant whitelist, mime and
  size caps; deny + log on any failure

---

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build & quality gates

```bash
npm run type-check   # tsc --noEmit
npm run lint         # next lint (eslint)
npm run build        # next build
npm start            # serve the production build
```

All four pass clean on the current build (see `docs/smoke-test-2026-06-16.md`).

## Deploy

Push to GitHub → Vercel auto-deploys (agendasgroup team). `main` →
lunatravel.travelify.io.

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, providers, tab bar
│   ├── page.tsx                # Home / trip wallet (+ agent-message banner)
│   ├── welcome/                # Onboarding ref-lookup (mock)
│   ├── itinerary/              # Itinerary timeline
│   ├── flight/[id]/            # Flight detail (+ live status overlay)
│   ├── hotel/[id]/             # Hotel detail
│   ├── extra/[id]/             # Lounge / parking / fast-track detail
│   ├── travellers/             # Travellers list + [id] detail
│   ├── documents/              # Documents list + preview sheet
│   ├── destination/            # Destination guide
│   ├── map/                    # Trip map
│   ├── inspiration/            # Inspiration feed
│   ├── luna/                   # Luna concierge chat
│   ├── notifications/          # Agent messages + push preferences
│   ├── review/                 # Post-trip review + rebook nudge
│   ├── me/                     # Profile, agency contact, settings, language
│   ├── install/                # QR booth / invite-redemption landing
│   ├── offline/                # PWA offline fallback
│   ├── admin/                  # Agency + platform admin (SSO-gated)
│   │   ├── dashboard/  agencies/[id|new]/  travellers/  flight-test/
│   │   ├── heroes/  audit/  sync/  settings/  signin/  demo/  bookings/new/
│   │   └── agencies/[id]/      # detail page + Branding, Invites, Travellers,
│   │                          #   Messages, Integration, Bookings tabs
│   └── api/
│       ├── invites/                      # create, fetch, redeem (QR loop)
│       ├── flights/                      # subscribe, subscribe-booking, webhook
│       ├── cron/sync/                    # Vercel Cron sync sweep (CRON_SECRET)
│       ├── traveller/                    # booking, documents, flights, messages,
│       │                                 #   ping, review, destination, conditions
│       └── admin/                        # agencies (+[id] branding/integration/
│                                         #   documents/messages/travellers/upload-logo/
│                                         #   bookings/booking-photo/extraction-profile),
│                                         #   import-pdf, sync(+run/booking), sync-events,
│                                         #   demo, audit, stats, heroes, flight-test, me, signout
├── components/                 # tab-bar, nav-bar, cover-splash, picker, icons,
│                               # onboarding-home, agency-logo, trip-map, map-sheet,
│                               # inspiration-card, version-check, engagement-ping,
│                               # language-switcher…
├── lib/
│   ├── format.ts               # Data integrity formatters
│   ├── booking-helpers.ts      # Timeline build, lookups, grouping
│   ├── hero.ts                 # Destination hero gradients + cinematic covers
│   ├── travelify.ts            # Travelify lookup + AES-256-GCM credential decrypt
│   ├── order-to-booking.ts     # Travelify order → Booking mapper
│   ├── control-order.ts        # Control order → Booking mapper
│   ├── stored-booking.ts       # Off-platform (bookings table) → Booking mapper
│   ├── booking-extract.ts      # PDF → structured booking (Luna Chat / Anthropic)
│   ├── pdf-profile.ts          # Per-agency PDF-extraction training profiles
│   ├── aerodatabox.ts          # AeroDataBox client + status mapping
│   ├── luna-brain.ts           # Read-only Luna Brain adapter (destination guide)
│   ├── weather.ts              # Open-Meteo forecast/archive/marine (keyless)
│   ├── holidays.ts             # Public-holiday lookup (Calendarific)
│   ├── sync.ts                 # Travelify sync sweep + health
│   ├── agency-id.ts            # Shared id scheme (rec… Control / lt… Luna-native)
│   ├── agencies.ts             # Luna-native agency store + resolver
│   ├── agency-branding.ts      # Branding override layer (merge over Control)
│   ├── brand.ts                # Brand hex → CSS-variable RGB channels
│   ├── constant-time.ts        # safeEqual() for secret comparison
│   ├── use-flight-live.ts      # Client hook for live flight status
│   ├── use-agent-messages.ts   # Client hook for unread agent messages
│   ├── supabase.ts             # Lazy admin/public clients (luna_travel schema)
│   ├── jwt.ts                  # lt_session sign/verify (jose)
│   ├── admin-session.ts        # Travelgenix ID session verification
│   ├── audit.ts                # Audit event logging
│   ├── categorise-document.ts  # Document type auto-categorisation
│   ├── i18n.ts / locale-context.tsx   # Lightweight 6-locale i18n
│   ├── trip-map.ts / geo.ts    # Map route + geo helpers
│   ├── booking-context.tsx     # Active booking state (+ live fetch, onboarding gate)
│   ├── theme-context.tsx       # Light/dark mode
│   ├── cover-context.tsx       # Cover mode (opt-in splash) state
│   └── app-update.ts           # APP_VERSION + force-update routine
├── middleware.ts               # Server-side gate for admin + invite APIs
├── types/booking.ts            # Travelify-shaped booking + live flight types
└── data/
    ├── mock-bookings.ts        # Four mock bookings
    ├── destinations.ts         # Destination guide content
    ├── hero-destinations.ts    # Hero roster (100 destinations)
    ├── inspirations.ts         # Inspiration feed content
    └── airports.ts             # IATA → airport/city lookup

packages/ui/                    # @travelgenix/ui — shared tokens + components
public/
├── manifest.json               # PWA manifest
├── version.json                # Build version (0.15.0)
├── icons/  images/             # PWA icons + hero imagery
└── documents/                  # Pre-generated demo PDFs per booking ref

scripts/
├── generate-pdfs.py            # HTML+Playwright widget-style PDF generator
├── generate-icons.py           # PWA icon generation
└── booking_data.py             # Source data for PDF generation

docs/
├── live-wiring-state.md        # Control-integration architecture + delta log
├── go-live-readiness-2026-07-09.md  # Go-live readiness review + gap log
├── pdf-import.md               # PDF-import backend + training design
└── smoke-test-2026-06-16.md    # Go-live smoke-test report
```

## Skills consulted

- `tg-widget-suite` — architecture, naming, registry
- `travelgenix-design` — design tokens, type scale, 4px grid, light/dark
- `travelgenix-security` — supplier data integrity, no client-side secrets,
  redacted AI context, signed-URL document access
- `frontend-design` — creative direction
- Luna Travel build skill — kickoff blueprint

## Last updated

10 July 2026 — README brought current to **v0.15.0** plus the go-live hardening
on `claude/go-live-readiness-review-74ho1c`. Since the 0.14.11 update this
documents: the **destination guide** (Luna Brain events/things-to-do + live
Open-Meteo weather and Calendarific holidays for the traveller's exact dates);
**off-platform bookings** (manual entry + PDF import with per-client training,
stored in `luna_travel.bookings`); the **Travelify sync-health monitor** and
cron sweep; **per-agency Travelify credentials** wired into the live lookup; the
gated Demo tab; and CSP + HSTS headers.

The go-live branch adds: **white-label branding carried end-to-end** into the
traveller app with a Control-pull + Luna-override model (Control edits sync
back); **Luna-native agencies** for non-Travelgenix clients (prefix id scheme,
source-aware routes, Control-outage-tolerant list); an honest **first-run
onboarding** screen (no fake demo trip) with `/welcome` and notifications copy
made truthful; off-platform invite-failure surfacing; and backend hardening
(constant-time secret compares, `set_updated_at` search_path pinned).

It also adds the **self-serve agency portal** (`/agency/*`, no SSO): passwordless
magic-link login for Luna-native agencies, with self-serve app branding (live
phone preview), Trips (manual itinerary builder), Documents (upload against a
booking), and Send access with invite tracking + revoke. Plus a cinematic pass
on the traveller home to match the branding preview. New tables:
`agency_branding`, `reviews`, `sync_events`, `agency_login_tokens`. See
`docs/go-live-readiness-2026-07-09.md` for the readiness review and gap log.
