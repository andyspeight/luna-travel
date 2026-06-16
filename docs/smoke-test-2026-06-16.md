# Luna Travel — Go-Live Smoke Test

**Date:** 16 June 2026
**Build under test:** v0.14.11 (`public/version.json`), branch
`claude/wonderful-rubin-hjvp9t` (identical to `origin/main` at start)
**Goal:** establish a clean, verified baseline before new features/polish.

---

## Result: GREEN

Every gate passes. One security issue was found and fixed during the run
(Next.js middleware auth-bypass); no functional blockers remain.

| Gate | Result |
|---|---|
| `npm install` | OK — 732 packages |
| `npm run type-check` (`tsc --noEmit`) | PASS — 0 errors |
| `npm run lint` (`next lint`) | PASS — 0 warnings/errors (after adding lint config, below) |
| `npm run build` (`next build`) | PASS — all routes compiled, 31 static pages, middleware built |
| Production boot (`npm start`) | PASS — ready in ~1s, no runtime errors logged during the sweep |

---

## Runtime route sweep (production server)

All public PWA pages returned **200** and rendered real content (home shows the
greeting, "Up next", destination and live countdown; `/welcome` shows the
booking-reference lookup):

`/`, `/itinerary`, `/documents`, `/me`, `/luna`, `/destination`, `/map`,
`/inspiration`, `/welcome`, `/install`, `/notifications`, `/review`,
`/offline`, `/travellers`, and the dynamic `/flight/[id]`, `/hotel/[id]`,
`/extra/[id]`, `/travellers/[id]`.

Gating behaved correctly:

| Path | Status | Notes |
|---|---|---|
| `/admin` | 307 | redirected by middleware |
| `/admin/dashboard`, `/agencies`, `/sync`, `/signin` | 200 | page shells load; gated client-side by `tg-auth-gate.js`, data fetched from gated APIs |
| `/api/admin/agencies`, `/api/admin/stats` | 401 | no `tg_session` → unauthorised (route checks auth before touching Supabase) |
| `/api/traveller/booking`, `/api/traveller/messages/summary` | 401 | no `lt_session` → unauthorised |
| `/api/flights/webhook` (GET) | 405 | POST-only |
| `/manifest.json`, `/version.json` | 200 | served correctly |

No endpoint returned an unhandled 500 or hung, despite no env vars being set —
the lazy Supabase clients and per-route auth checks degrade gracefully.

---

## Security finding (FIXED): Next.js middleware auth-bypass

**Before:** Next.js was pinned to **14.2.13**, which is vulnerable to
CVE-2025-29927 (`x-middleware-subrequest` header skips middleware). This app
gates `/api/admin/*` and invite creation in `src/middleware.ts`, and **7 of 17**
admin API routes rely on that middleware alone (no in-handler re-check) —
including the sensitive document download/list/delete, travellers (PII), audit,
stats and heroes routes. On 14.2.13 those were reachable by spoofing the header.

**Fix:** upgraded `next` and `eslint-config-next` to **14.2.35** (latest 14.2.x,
no breaking changes). Re-ran type-check, lint, build and the route sweep — all
still green.

**Verified empirically:** with the server on 14.2.35, requests carrying
`x-middleware-subrequest: middleware` (and a chained `middleware:middleware:…`
variant) against `/api/admin/stats` and `/api/admin/agencies` returned **401** —
the middleware is no longer bypassable.

---

## Lint configuration added

The repo advertised `npm run lint` but had **no project ESLint config**, so the
command could not run non-interactively. Added `.eslintrc.json`:

```json
{
  "extends": "next/core-web-vitals",
  "parser": "@typescript-eslint/parser",
  "plugins": ["@typescript-eslint"]
}
```

(The `@typescript-eslint` registration is required so the existing
`// eslint-disable-next-line @typescript-eslint/no-explicit-any` directives in
the codebase resolve.) `npm run lint` now reports **no warnings or errors**.

---

## Remaining `npm audit` items (not blockers; deliberately not auto-fixed)

`npm audit fix --force` would jump to Next 16 + a breaking ESLint config, so it
was **not** run. After the 14.2.35 upgrade the **critical is cleared**; what
remains splits into two lower-risk buckets:

1. **Residual Next advisories** (DoS, cache-poisoning, narrow-config XSS,
   websocket SSRF). 14.2.35 is already the newest 14.2.x — these are only fully
   resolved by moving to Next 15+, a deliberate planned upgrade. (One listed
   item, the i18n middleware bypass, is Pages-Router-only; this app is App
   Router, so it does not apply.)
2. **Build-time toolchain** (`workbox-build`, `serialize-javascript`,
   `postcss`, `glob`, `@babel/core`, `js-yaml`, `undici`) pulled in by the
   abandoned **`next-pwa@5.6.0`**. These are build/SW-generation deps, not a
   runtime exploit path. Resolving means migrating off `next-pwa` (e.g. to
   `@ducanh2912/next-pwa` or Serwist).

---

## Follow-up — same-day hardening (16 Jun)

Done after the baseline above, each its own commit, each re-verified
(type-check + lint + build + route sweep all green):

1. ✅ **Defense in depth** — all 17 admin API routes now call `requireAdmin()`
   in-handler (the 7 previously middleware-only routes: documents ×3, travellers,
   audit, stats, heroes). Verified every one returns 401 (GET/POST/DELETE)
   without a session.
2a. ✅ **PWA tooling migrated** — `next-pwa@5.6.0` → `@ducanh2912/next-pwa@10`
   (maintained, Next 15-compatible). Service worker still generated; high-severity
   audit advisories dropped 10 → 6 (residual workbox/glob items are build-time
   only).
2b. ✅ **Next.js 14.2.35 → 15.5.19** (React kept at 18.3.1). All 12 dynamic route
   handlers migrated to async `params` via the official codemod. Verified: the
   public invite route resolves async params at runtime (404, not a crash); the
   bypass probe still returns 401.

## Recommended next

- **#3 (held):** wire `/admin/sync` to live data and replace the vestigial
  `AGENCIES` type-anchor const in `admin/agencies/[id]/page.tsx`.
- **#4 (held):** switch the live booking lookup from the demo App 250 path to
  each agency's own Travelify credentials (already available via Control).
- **Env vars (#5):** the Vercel MCP exposes no env API, so values can't be read
  here. Confirm in the Vercel dashboard (Settings → Environment Variables, scope
  Production) or `vercel env ls production` that these are set:
  `AERODATABOX_API_KEY`, `AERODATABOX_WEBHOOK_TOKEN`, `LUNA_TRAVEL_PUBLIC_URL`,
  `TG_INTERNAL_KEY`, `BLOB_READ_WRITE_TOKEN`, plus the existing
  `SUPABASE_*`, `AIRTABLE_KEY`, `TG_ENCRYPTION_KEY`, `JWT_SECRET` set.
- **Merge to `main`:** the security/upgrade work is on branch
  `claude/wonderful-rubin-hjvp9t` (built as Vercel previews). Production still
  runs the pre-upgrade `main` build until this branch is merged.
- **Lint CLI:** Next 15 deprecates `next lint` (removed in 16); migrate to the
  ESLint CLI when convenient.
- **Residual audit items:** the remaining Next/​workbox advisories are build-time
  or only fully resolved by a future Next 16 jump — track, don't force.
