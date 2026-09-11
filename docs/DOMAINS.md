# Domains — traveller app vs agency portal

Luna Travel is **one** Next.js app (one Vercel project, one deployment) served
on **two** public domains.

| | Host | Serves | Who sees it |
|---|---|---|---|
| **Traveller app** | `my-booking.co` | everything except `/agency` and `/admin` | customers |
| **Agency portal + platform admin** | `lunatravel.travelify.io` | `/agency/*`, `/admin/*` | agents, Travelgenix staff |

Why the traveller side needs its own domain: the app is white-labelled per
agency, and a customer of *Seaside Travel* should not be looking at a
`travelify.io` URL. `my-booking.co` is agency-neutral.

## Why the portal side cannot move

**`/admin` and the Control SSO hand-off only work on a `travelify.io` host.**
Admin auth is the central Travelgenix ID `tg_session` cookie, which is scoped
to `.travelify.io`. On any other hostname the browser simply never sends it, so
`/admin` would be permanently signed out and `POST /api/agency/session/sso`
(the "click through from Control and you're already signed in" flow) would have
no session to exchange. This is a browser rule, not a config choice.

The agency portal lives on the same host for the same reason — that is where
Control hands agents off.

## How the split is implemented

- **`src/lib/origins.ts`** — the single source of truth. Reads
  `NEXT_PUBLIC_TRAVELLER_ORIGIN` and `NEXT_PUBLIC_PORTAL_ORIGIN`, classifies
  paths (`/agency` and `/admin` are portal; everything else is traveller), and
  exposes `travellerUrl()` / `portalUrl()` for building absolute links.
- **`src/middleware.ts`** — redirects each **page** request to the host that
  owns it. API routes are deliberately never redirected: the app calls them
  same-origin, each authenticates on its own cookie, and bouncing a non-GET
  across origins is how you lose a request body.
- **Links are built canonically**, not from the incoming request:
  - invite / QR links (`/install?invite=…`) → **traveller** origin
  - agency sign-in links (`/agency/login?token=…`) → **portal** origin

Session cookies are host-only (neither sets a `domain`), so travellers and
agents get cleanly separated sessions for free.

### Old links keep working

Invite links already sent point at `lunatravel.travelify.io/install?invite=…`.
Those are **redirected, not broken** — path and query are preserved, so the
traveller lands on `my-booking.co/install?invite=…` and their session cookie is
set on the traveller domain where it belongs.

Redirects are **307 (temporary)** on purpose: a permanently-cached 308 sitting
in every traveller's browser would be painful to undo during launch. Promote to
308 once the split has been stable for a few weeks.

### It is opt-in, and that is the rollback

With the two env vars unset, **nothing changes** — every route is served on
every host and links are built from the incoming request, exactly as before.
Both vars must be set, and must differ, for the split to activate. Unknown
hosts (`*.vercel.app` previews, `localhost`) always serve everything, so
preview deployments and local development are untouched.

---

## Setting it up

Do these **in order**. Step 3 is the switch; doing it before step 1 would
redirect travellers to a domain that does not answer yet.

### 1. Attach the domain in Vercel

Vercel project **`luna-travel`** (team `agendasgroup`), Settings → Domains.
Add both:

- `my-booking.co`
- `www.my-booking.co`

Vercel will display the exact DNS records to create. Use what it shows.

> ### ⚠️ Point the apex/www redirect the right way
>
> Vercel's default when you add both is often **apex → www**, which is the
> opposite of what this app is configured for. `NEXT_PUBLIC_TRAVELLER_ORIGIN`
> is the **apex** (`https://my-booking.co`), so invite links are generated as
> `my-booking.co/install?...` — and an apex→www rule turns every one of those
> into an extra redirect hop, landing the traveller (and their session cookie)
> on `www`.
>
> **Set `my-booking.co` as the primary domain, and `www.my-booking.co` to
> redirect to it.**
>
> If you would rather keep `www` as the canonical host, that is fine — but then
> change `NEXT_PUBLIC_TRAVELLER_ORIGIN` to `https://www.my-booking.co` so the
> two agree, and redeploy.
>
> The app tolerates either way round: `hostMatches()` in `lib/origins.ts`
> treats `www.x` and `x` as the same site, so `/agency` and `/admin` are
> redirected off the consumer domain whichever of the pair the request lands
> on. Without that tolerance, an unconfigured `www` looks like an unknown host
> and quietly serves the portal and admin on the consumer domain. Getting the
> redirect direction right still matters for the extra hop and for keeping
> session cookies on one host.

### 2. Point DNS at Vercel (Cloudflare)

`my-booking.co` is currently on Cloudflare and is **not** pointed at Vercel yet
(it resolves to Cloudflare IPs today).

Create the records Vercel gives you. For reference, the existing
`lunatravel.travelify.io` resolves to Vercel's anycast IP `216.150.1.1`, and
`www` normally goes to `cname.vercel-dns.com`.

**Two Cloudflare gotchas:**

- **Set the records to "DNS only" (grey cloud), not proxied (orange cloud).**
  Proxying in front of Vercel breaks the Let's Encrypt challenge, so the
  certificate never issues and the domain serves an SSL error. If you
  deliberately want Cloudflare in front later, it needs SSL mode **Full
  (strict)** — but get it working grey-clouded first.
- Apex records on Cloudflare use CNAME flattening, which is fine — just make
  sure it is unproxied.

**Verify before continuing:** `https://my-booking.co/` should load the Luna
Travel app (it will still serve everything at this point — that is expected)
and show a valid certificate.

### 3. Set the environment variables and redeploy

In Vercel → Settings → Environment Variables, **Production**:

```
NEXT_PUBLIC_TRAVELLER_ORIGIN = https://my-booking.co
NEXT_PUBLIC_PORTAL_ORIGIN    = https://lunatravel.travelify.io
```

**A redeploy is required.** `NEXT_PUBLIC_*` values are inlined into the bundle
at **build** time — saving the variables alone changes nothing until the next
deployment. Redeploy from the Vercel dashboard, or push any commit.

### 4. Check it

| Try | Expect |
|---|---|
| `my-booking.co/` | the traveller app |
| `my-booking.co/agency` | redirect → `lunatravel.travelify.io/agency` |
| `lunatravel.travelify.io/agency` | the portal |
| `lunatravel.travelify.io/install?invite=X` | redirect → `my-booking.co/install?invite=X`, query intact |
| Create an invite in the portal | the copied link starts `https://my-booking.co/install?...` |
| Click through from Control | still signs straight into `/agency` |
| `my-booking.co/` | serves the app **directly** — a 308 to `www` here means the apex/www redirect is the wrong way round (see the warning above) |
| `www.my-booking.co/agency` | redirect → portal, **never** the portal itself |

### Rollback

Delete the two environment variables and redeploy. Every host goes back to
serving everything, and links revert to being built from the request. No data
changes, nothing to migrate.

---

## Email (SendGrid, sending as my-booking.co)

Transactional mail — currently the "email me my trip link" recovery flow —
sends from the **traveller** domain, so the address the customer sees matches
the app they are being sent to.

Environment variables (Production):

```
SENDGRID_API_KEY        = <a key with the Mail Send permission ONLY>
TRIP_ACCESS_FROM_EMAIL  = trips@my-booking.co   (optional; this is the default)
```

**Single Sender Verification is not enough.** Verifying one address gets mail
*accepted* by SendGrid, but the message is then signed for `sendgrid.net`
rather than `my-booking.co`, so it fails DMARC alignment and Gmail/Outlook will
treat it as suspicious — spam folder at best. For mail that reliably lands,
complete **Domain Authentication** for `my-booking.co` in SendGrid
(Settings → Sender Authentication) and add the CNAMEs it issues to Cloudflare.

Same Cloudflare gotcha as the web records: those CNAMEs must be **"DNS only"
(grey cloud)**. A proxied record breaks the verification.

The agency's name is used as the email's *display name* and their address as
*reply-to*, so it reads as from the agency in the inbox while the sending
domain stays authenticated and consistent. Agencies that have never set an app
name in **App branding** fall back to a neutral label rather than a wrong one —
worth filling that field in per agency.

## Push notifications (Web Push / VAPID)

Notifications go through the browser's Push API, not APNs/FCM directly. The
server signs an encrypted payload with a VAPID key pair and posts it to the
endpoint the browser issued; the platform's push service wakes the app's
service worker (`worker/index.js`), which draws the notification.

Generate the key pair once and add all three to Vercel (Production):

```
npx web-push generate-vapid-keys
```

```
NEXT_PUBLIC_VAPID_PUBLIC_KEY = <the PUBLIC key>
VAPID_PUBLIC_KEY             = <the same public key>
VAPID_PRIVATE_KEY            = <the PRIVATE key — secret, server only>
VAPID_SUBJECT                = mailto:ops@travelgenix.io
```

The public key is needed in both forms: `NEXT_PUBLIC_` for the browser to
subscribe with, plain for the server to sign with. **A redeploy is required** —
`NEXT_PUBLIC_*` inlines at build time. With no keys set, every send is a logged
no-op and the app works normally; it simply cannot notify.

**Rotating the keys invalidates every existing subscription.** Travellers would
silently stop receiving notifications and would each have to opt in again, so
treat the private key as permanent unless it leaks.

### Two things that are not obvious

- **On iPhone and iPad, push only works once the app is on the home screen.**
  iOS supports web push from 16.4, but never from a Safari tab. So for iOS
  travellers "add to home screen" is a hard prerequisite for notifications, not
  a nicety — which is why the install prompt is pushed as hard as it is.
- **The permission ask is one-shot.** A traveller who declines cannot be
  prompted again by the page; only they can reverse it in browser settings.
  That is why the opt-in explains check-in, flight changes and agent messages
  *before* triggering the prompt, and never fires on page load.

Subscriptions live in `luna_travel.push_subscriptions`, one row per device. A
push service answering 404/410 means the subscription is dead and the row is
deleted automatically. (The legacy `travellers.push_token` column is unused —
a subscription is an endpoint plus two keys, not a token.)

## Notes

- **Reinstall the PWA.** Anyone who added the app to their home screen from
  `lunatravel.travelify.io` has it scoped to that origin; after the split it
  will redirect out to the browser. Delete the old icon and re-add from a fresh
  `my-booking.co` invite link. (Andy — this applies to the app on your phone.)
- **`LUNA_TRAVEL_PUBLIC_URL`** is unrelated to this split. It is the
  server-to-server callback base for AeroDataBox flight webhooks. API routes
  are never redirected, so it works on either host — but leave it pointed at a
  stable one and do not repurpose it as "the public app URL".
- **Adding new pages:** anything agent- or admin-facing must live under
  `/agency` or `/admin`. Everything else is automatically treated as
  traveller-facing and will be served on `my-booking.co`.
- **Email/marketing pages** for Luna Travel live on `travelgenix.io` (the
  Framer microsite) and are unaffected by any of this.
