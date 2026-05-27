# Luna Travel

The post-booking traveller PWA in the Travelgenix stack.

An installable, offline-capable Next.js 14 app that re-presents a confirmed
booking to the traveller as a native-feel mobile app — trip wallet, itinerary,
documents, destination guides, and a Luna concierge. Vamoos-class experience,
built on Travelgenix rails.

Originally scoped to demo at **TravelTech Show, 24–25 June 2026**. The
prototype is complete and the project has since grown a real Supabase-backed
multi-agency platform behind it. No throwaway code — the prototype is the
foundation of production v1.

- **Live:** https://luna-travel-seven.vercel.app
- **Repo:** https://github.com/andyspeight/luna-travel
- **Vercel:** https://vercel.com/agendasgroup/luna-travel (agendasgroup team)
- **Version:** 0.8.0

---

## Two halves of the product

Luna Travel is now two connected systems in one repo:

1. **The traveller PWA** (public) — what the holidaymaker installs and uses.
   Runs on mock bookings today; swappable to live Travelify in production.
2. **The agency + admin platform** (gated) — how agencies onboard travellers,
   upload documents, and how Travelgenix administers the whole thing. This is
   real: Supabase database, Travelify credential decryption, signed document
   storage, invite/QR redemption, and audit logging.

---

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- **`next-pwa`** — service worker, manifest, install prompt, offline cache
- **Supabase** — Postgres (`luna_travel` schema) for agencies, travellers,
  invites and documents; Storage for hero images (public bucket) and traveller
  documents (private bucket, signed URLs)
- **Travelify** — booking lookup via the same AES-256-GCM credential pattern as
  the tg-widgets project (ClientIntegrations table, base `appAYzWZxvK6qlwXK`)
- **`jose`** — traveller session JWTs (`lt_session` cookie)
- **Travelgenix ID (SSO)** — admin auth via `tg_session` + `tg-auth-gate.js`
- **`qrcode`** — booth/invite QR generation
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
| Agency admin | `/admin` dashboard, agencies (list/new/detail), travellers, heroes, audit, sync, settings, signin | DONE |
| Invites & QR | Create invite → QR → traveller redeems, validated against Travelify → traveller row + `lt_session` | DONE |
| Documents | Per-agency upload to private Supabase bucket, auto-categorisation, signed-URL download, soft-delete | DONE |
| Hero manager | `/admin/heroes` — browser converts to webp + centre-crops → public bucket; 100 destinations × portrait/landscape | DONE |
| SSO migration | 26 May — admin auth moved to Travelgenix ID (`tg_session`); local password + `lt_admin_session` removed | DONE |
| Real photography | Cover splashes + PDF heroes for all 4 demo destinations | DONE |

---

## What's real vs mock today

**Real (live, Supabase + Travelify):**
- Admin sign-in via Travelgenix ID SSO
- Invite creation, QR generation, and traveller redemption (validates the
  booking ref + email + departure date against Travelify before issuing a
  session)
- Per-agency document upload, storage, categorisation and signed download
- Hero image upload and serving
- Audit logging across admin actions

**Still mock (prototype data, swappable in production):**
- The four demo bookings powering the traveller PWA (`mock-bookings.ts`)
- `/welcome` ref-lookup matches against the mock set, not live Travelify
- Several admin **pages** render from hardcoded sample arrays (agencies list,
  dashboard, sync feed, travellers) — the **API routes** behind them are real,
  but the pages aren't yet wired to fetch from them
- The agency **detail** page is still mock (noted in-code)

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

## Environment variables

| Var | Used for |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_ANON_KEY` | Public client (read public bucket) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-side admin client (never client-side) |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser-side reference where needed |
| `AIRTABLE_KEY` | Same key as tg-widgets — Travelify credential lookup |
| `TG_ENCRYPTION_KEY` | 64 hex chars; must match tg-widgets or decryption fails |
| `JWT_SECRET` | Signs/verifies the `lt_session` traveller cookie |

---

## Data integrity rules

Ported from My Booking widget v1.4.1 (`src/lib/format.ts`):

- No fabricated fallbacks on supplier data — missing fields hide that line
- Board basis through a strict whitelist; unknown values fall back to raw text
- Room name reads from supplier text, not a generic default
- Countdown copy is context-aware: "until you fly" only when flights exist

---

## Security notes (travelgenix-security)

- Service-role key stays server-side via `getSupabaseAdmin()` only
- Admin API routes gated server-side in `src/middleware.ts` against the central
  Travelgenix ID session; admin pages gated client-side by `tg-auth-gate.js`
- Travelify calls require the `Origin` header or the API returns a silent 401 —
  do not remove it
- Traveller documents live in a **private** bucket; the PWA only ever receives
  short-lived (15-min) signed URLs, authorised by the `lt_session` cookie
- Hero images live in a **public** bucket — durable, cacheable, offline-friendly
- Every upload validated server-side: roster check, variant whitelist, mime and
  size caps; deny + log on any failure

---

## Run locally

```bash
npm install
npm run dev
# open http://localhost:3000
```

## Build

```bash
npm run build
npm start
```

## Deploy

Push to GitHub → Vercel auto-deploys on every push to `main` (agendasgroup team).

---

## Project structure

```
src/
├── app/
│   ├── layout.tsx              # Root layout, fonts, providers, tab bar
│   ├── page.tsx                # Home / trip wallet
│   ├── welcome/                # Onboarding ref-lookup (mock)
│   ├── itinerary/              # Itinerary timeline
│   ├── flight/[id]/            # Flight detail
│   ├── hotel/[id]/             # Hotel detail
│   ├── extra/[id]/             # Lounge / parking / fast-track detail
│   ├── travellers/             # Travellers list + [id] detail
│   ├── documents/              # Documents list + preview sheet
│   ├── destination/            # Destination guide
│   ├── luna/                   # Luna concierge chat
│   ├── notifications/          # Push notification preferences + samples
│   ├── review/                 # Post-trip review + rebook nudge
│   ├── me/                     # Profile, agency contact, settings
│   ├── install/                # QR booth / invite-redemption landing
│   ├── offline/                # PWA offline fallback
│   ├── admin/                  # Agency + platform admin (SSO-gated)
│   │   ├── dashboard/  agencies/[id|new]/  travellers/
│   │   ├── heroes/  audit/  sync/  settings/  signin/
│   └── api/
│       ├── invites/                      # create, fetch, redeem (QR loop)
│       ├── traveller/documents/          # PWA-facing signed document list
│       └── admin/                        # agencies, documents, travellers,
│                                         # heroes, audit, me, signout
├── components/                 # tab-bar, nav-bar, cover-splash, picker, icons…
├── lib/
│   ├── format.ts               # Data integrity formatters
│   ├── booking-helpers.ts      # Timeline build, lookups, grouping
│   ├── hero.ts                 # Destination hero gradients + cinematic covers
│   ├── travelify.ts            # Travelify lookup + AES-256-GCM credential decrypt
│   ├── supabase.ts             # Lazy admin/public clients (luna_travel schema)
│   ├── jwt.ts                  # lt_session sign/verify (jose)
│   ├── admin-session.ts        # Travelgenix ID session verification
│   ├── audit.ts                # Audit event logging
│   ├── categorise-document.ts  # Document type auto-categorisation
│   ├── booking-context.tsx     # Active booking state
│   ├── theme-context.tsx       # Light/dark mode
│   └── cover-context.tsx       # Cover mode (opt-in splash) state
├── middleware.ts               # Server-side gate for admin + invite APIs
├── types/booking.ts            # Travelify-shaped booking types
└── data/
    ├── mock-bookings.ts        # Four mock bookings
    ├── destinations.ts         # Destination guide content
    └── hero-destinations.ts    # Hero roster (100 destinations)

packages/ui/                    # @travelgenix/ui — shared tokens + components
public/
├── manifest.json               # PWA manifest
├── version.json                # Build version (0.8.0)
├── icons/  images/             # PWA icons + hero imagery
└── documents/                  # Pre-generated demo PDFs per booking ref

scripts/
├── generate-pdfs.py            # HTML+Playwright widget-style PDF generator
├── generate-icons.py           # PWA icon generation
└── booking_data.py             # Source data for PDF generation
```

## Skills consulted

- `tg-widget-suite` — architecture, naming, registry
- `travelgenix-design` — design tokens, type scale, 4px grid, light/dark
- `travelgenix-security` — supplier data integrity, no client-side secrets,
  redacted AI context, signed-URL document access
- `frontend-design` — creative direction
- Luna Travel build skill — kickoff blueprint

## Last updated

27 May 2026 — README brought current. Documents the full Supabase-backed agency
+ admin platform, the invite/QR redemption loop validated against Travelify, the
26 May Travelgenix ID SSO migration, signed-URL document storage, the hero image
manager, and an honest real-vs-mock breakdown. Version 0.8.0.
