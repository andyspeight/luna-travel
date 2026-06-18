# Luna Travel

The post-booking traveller PWA in the Travelgenix stack.

An installable, offline-capable Next.js 14 app that re-presents a confirmed
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
- **Version:** 0.14.11

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

---

## What's real vs mock today

**Real (live, Supabase + Travelify + AeroDataBox + Control):**
- Admin sign-in via Travelgenix ID SSO
- Agencies list reads live from Control (only clients entitled to `luna-travel`)
- Invite creation, QR generation, and traveller redemption (validates the
  booking ref + email + departure date against Travelify before issuing a
  session)
- Per-agency document upload, storage, categorisation and signed download
- Per-agency branding (logo) and Travelify integration credentials + test
- Hero image upload and serving
- Agent → traveller messaging pipeline (compose, deliver, unread, mark read)
- Live flight status pipeline (subscribe + webhook → `trip_flights` → messages),
  active wherever `AERODATABOX_API_KEY` / `AERODATABOX_WEBHOOK_TOKEN` are set
- Audit logging across admin actions; admin stats

**Still mock (prototype data, swappable in production):**
- The four demo bookings powering the traveller PWA (`mock-bookings.ts`)
- `/welcome` ref-lookup matches against the mock set, not live Travelify
- The agency **detail** page is live-wired (it fetches `/api/admin/agencies?id=`
  and every tab calls a real API); the in-file `AGENCIES` const is a vestigial
  type anchor, not a data source — worth replacing with a named interface
- `/admin/sync` deliberately **simulates** a sync activity feed from a
  hardcoded agency list (visualisation only; not wired to live data)
- Per-agency Travelify creds exist in Control, but the live booking lookup
  still uses the demo App 250 path until wired to each agency's own creds

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
| `agencies` | Local agency cache / counters (source of truth remains Control) |
| `travellers` | Redeemed travellers (booking ref, email, agency, session) |
| `invites` | Invite records for the QR/redeem loop |
| `documents` | Per-agency uploaded documents (private bucket pointers) |
| `messages` | Agent/system → traveller messages (subject, body, priority, category, targeting) |
| `message_recipients` | Per-traveller delivery + read state for each message |
| `trip_flights` | Live flight rows (status, gate, terminal, belt, est times, AeroDataBox subscription id) |
| `app_opens` | Engagement pings for stats |
| `audit_events` | Admin action audit log |

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
| `TG_INTERNAL_KEY` | Internal service-to-service auth for flight subscribe + booking fetch + Luna Chat PDF extraction |
| `BLOB_READ_WRITE_TOKEN` | Vercel Blob token for logo + message-image uploads |
| `LUNA_CHAT_EXTRACT_URL` | Luna Chat PDF-extraction endpoint (preferred PDF-import backend); see `docs/pdf-import.md` |
| `ANTHROPIC_API_KEY` | Direct Anthropic fallback for PDF import when `LUNA_CHAT_EXTRACT_URL` is unset |
| `ANTHROPIC_MODEL` | Optional model override for PDF import (default `claude-sonnet-4-6`) |

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
  **Defense in depth (done 16 Jun):** all 17 admin API routes also re-verify the
  session inside the handler via `requireAdmin()`, so a bypassed or regressed
  middleware cannot reach the logic
- The AeroDataBox webhook is unauthenticated by the provider, so it is gated by
  a secret token in the query string, compared in constant time
- Travelify calls require the `Origin` header or the API returns a silent 401 —
  do not remove it
- Traveller documents live in a **private** bucket; the PWA only ever receives
  short-lived (15-min) signed URLs, authorised by the `lt_session` cookie
- Hero images live in a **public** bucket — durable, cacheable, offline-friendly
- Response security headers (X-Frame-Options, nosniff, Referrer-Policy,
  Permissions-Policy) set in `vercel.json`
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
│   │   ├── heroes/  audit/  sync/  settings/  signin/
│   │   └── agencies/[id]/      # detail page + InvitesTab, TravellersTab, MessageComposer
│   └── api/
│       ├── invites/                      # create, fetch, redeem (QR loop)
│       ├── flights/                      # subscribe, subscribe-booking, webhook
│       ├── traveller/                    # booking, documents, flights, messages, ping
│       └── admin/                        # agencies (+[id] branding/integration/
│                                         # documents/messages/travellers/upload-logo),
│                                         # audit, stats, heroes, flight-test, me, signout
├── components/                 # tab-bar, nav-bar, cover-splash, picker, icons,
│                               # trip-map, map-sheet, inspiration-card,
│                               # version-check, engagement-ping, language-switcher…
├── lib/
│   ├── format.ts               # Data integrity formatters
│   ├── booking-helpers.ts      # Timeline build, lookups, grouping
│   ├── hero.ts                 # Destination hero gradients + cinematic covers
│   ├── travelify.ts            # Travelify lookup + AES-256-GCM credential decrypt
│   ├── order-to-booking.ts     # Travelify order → Booking mapper
│   ├── aerodatabox.ts          # AeroDataBox client + status mapping
│   ├── use-flight-live.ts      # Client hook for live flight status
│   ├── use-agent-messages.ts   # Client hook for unread agent messages
│   ├── supabase.ts             # Lazy admin/public clients (luna_travel schema)
│   ├── jwt.ts                  # lt_session sign/verify (jose)
│   ├── admin-session.ts        # Travelgenix ID session verification
│   ├── audit.ts                # Audit event logging
│   ├── categorise-document.ts  # Document type auto-categorisation
│   ├── i18n.ts / locale-context.tsx   # Lightweight 6-locale i18n
│   ├── trip-map.ts / geo.ts    # Map route + geo helpers
│   ├── booking-context.tsx     # Active booking state (+ live fetch on mount)
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
├── version.json                # Build version (0.14.11)
├── icons/  images/             # PWA icons + hero imagery
└── documents/                  # Pre-generated demo PDFs per booking ref

scripts/
├── generate-pdfs.py            # HTML+Playwright widget-style PDF generator
├── generate-icons.py           # PWA icon generation
└── booking_data.py             # Source data for PDF generation

docs/
├── live-wiring-state.md        # Control-integration architecture + delta log
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

16 June 2026 — README brought current to **v0.14.11**. Documents the Flight Hub
(AeroDataBox live status + webhook fan-out), agent ↔ traveller messaging, trip
map, 6-locale i18n, inspiration feed, per-agency branding/integration, live
booking fetch, engagement ping and PWA force-update — none of which existed at
the previous (0.8.0) update. Records the security/quality hardening shipped the
same day: Next.js upgraded to 15.5.19 (async route params; React stays 18.3),
all 17 admin API routes self-gated for defense in depth, the PWA tooling moved
to `@ducanh2912/next-pwa`, plus the new lint config and refreshed env/data-model
tables. See `docs/smoke-test-2026-06-16.md` for go-live status.
