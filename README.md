# Luna Travel

The post-booking traveller PWA in the Travelgenix stack.
Prototype to v1 production.

## What this repo is

A Next.js 14 App Router PWA, installable to the home screen, offline-capable,
that re-presents a booking to the traveller as a native-feel mobile app.

This is the prototype build, scoped to demo at **TravelTech Show, 24–25 June 2026**.
The code is also the foundation of the production v1 — no throwaway code.

## Tech stack

- **Next.js 14** (App Router) + **TypeScript** + **Tailwind**
- `next-pwa` for service worker, manifest, install prompt, offline cache
- Inter (UI) + Instrument Serif (display) via `next/font`
- No backend in sprint 1 — all data is mock JSON, swappable to live Travelify in production

## Build plan — six sprints

| Sprint | Dates | Scope |
|---|---|---|
| 1 — Foundation | 14–20 May | Scaffold, PWA, design tokens, mock data, app shell, picker — **DONE** |
| 2 — Trip core | 21–27 May | Home v2 with quick tiles & "Up next", itinerary timeline, flight detail, hotel detail, extras detail — **DONE** |
| 3 — Documents & travellers | 28 May – 3 Jun | Documents with preview/share/download, travellers list & detail, Me page with click-to-call agent, entrance animations — **DONE** |
| 4 — Luna & guides | 4–10 Jun | Luna concierge with trip context, destination guides |
| 5 — Polish | 11–17 Jun | Onboarding, push simulation, post-trip review, rebook, animations |
| 6 — Show prep | 18–24 Jun | QR codes, demo script, real-device testing, bug bash |

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

## Data integrity rules

Ported from My Booking widget v1.4.1 (`src/lib/format.ts`):

- No fabricated fallbacks on supplier data — missing fields hide that line
- Board basis through a strict whitelist; unknown values fall back to raw text
- Room name reads from supplier text, not a generic default
- Countdown copy is context-aware: "until you fly" only when flights exist

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

Push to GitHub → Vercel auto-deploys on every push to `main`.
Custom domain to be configured when ready.

## Project structure

```
src/
├── app/                # Next.js App Router pages
│   ├── layout.tsx      # Root layout, fonts, providers, tab bar
│   ├── page.tsx        # Home / trip wallet
│   ├── itinerary/      # Itinerary timeline
│   ├── flight/[id]/    # Flight detail
│   ├── hotel/[id]/     # Hotel detail
│   ├── extra/[id]/     # Lounge / parking / fast-track detail
│   ├── travellers/         # Travellers list
│   ├── travellers/[id]/    # Traveller detail (identity, seats)
│   ├── documents/      # Documents list + preview sheet
│   ├── luna/           # Luna concierge chat (sprint 4)
│   ├── me/             # Profile, agency contact, settings
│   └── offline/        # PWA offline fallback
├── components/
│   ├── icons.tsx           # Inline SVG icon library
│   ├── tab-bar.tsx         # Bottom tab navigation
│   ├── nav-bar.tsx         # iOS-style top nav for sub-pages
│   ├── section-heading.tsx # Section title + 'See all'
│   ├── action-button.tsx   # Primary/secondary CTA
│   ├── page-enter.tsx      # Subtle entrance animation wrapper
│   └── booking-picker.tsx  # Long-press demo picker
├── lib/
│   ├── format.ts            # Data integrity formatters
│   ├── booking-helpers.ts   # Timeline build, lookups, grouping
│   ├── hero.ts              # Destination hero gradients
│   ├── booking-context.tsx  # Active booking state
│   └── theme-context.tsx    # Light/dark mode
├── types/
│   └── booking.ts      # Travelify-shaped booking types
└── data/
    ├── mock-bookings.ts    # Four mock bookings
    └── destinations.ts     # Destination guide content

public/
├── manifest.json       # PWA manifest
├── icons/              # PWA icons
└── images/             # Hero imagery (real photos in sprint 4)
```

## Skills consulted

This build follows the rules in:
- `tg-widget-suite` — architecture, naming, registry
- `travelgenix-design` — design tokens, type scale, 4px grid, light/dark
- `travelgenix-security` — Rule 8 (supplier data integrity), no secrets client-side
- `frontend-design` — creative direction
- Luna Travel build skill — kickoff blueprint

## Last updated

14 May 2026 — sprint 3 shipped. Documents with preview/share, travellers list and detail, Me page with click-to-call agent contact, page entrance animations.
