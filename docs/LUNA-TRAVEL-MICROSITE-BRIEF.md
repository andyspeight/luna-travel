# Luna Travel — microsite brief

**For:** the session building the Luna Travel microsite on travelgenix.io (Framer)
**From:** the session that built the product
**Source of truth:** the Luna Travel codebase. Every feature below was read out
of shipped code, not a roadmap.

Read §11 (**Do not claim**) before writing any copy. It is the most important
section in this document.

This is a companion to the Luna Marketing microsite brief. The two products are
siblings — Luna Marketing wins the customer, Luna Travel keeps them — and the
two microsites should cross-link (§9).

---

## 1. What Luna Travel is

Luna Travel is a branded trip app for a travel agency's customers — the thing
that lives on the traveller's phone between booking and coming home, with the
agency's name and logo on it.

The agent sends one link (or shows a QR code). The traveller taps it, and their
actual trip appears — a cinematic cover with destination photography and a
countdown, the itinerary, live flight status, their tickets and documents, a
map, advice from their agent, and a direct message line back to the agency. One
more tap adds it to their home screen like an app. No app store, no download,
no password.

**One-sentence version:** Luna Travel puts a travel agency's own branded app on
every customer's phone in about ten seconds — the whole trip in their pocket,
and the agent one tap away.

**What makes it different from "we email the documents":** the booking becomes
a product. TUI and Jet2 customers get an app; a homeworker's customers get a
PDF. Luna Travel closes that gap without the agency building anything — for
Travelify-connected agencies the trip populates itself from the booking, with
zero data entry.

**Positioning line already in the product:** *"The post-booking trip experience
for SME travel agents."*

---

## 2. Who it is for

Same Travelgenix segments as Luna Marketing, different pains — these are
post-booking pains.

| Segment | What they are | What they feel |
|---|---|---|
| **Homeworkers & independent agents** | One person, competing with TUI's app on service alone | "My service is better than the big brands'. My customer experience after booking is a PDF and a WhatsApp." |
| **Independent high-street agencies** | 1–3 branches, loyal customers, no tech budget | "Customers ask us what terminal, what time, where's the voucher. Every answer is a phone call." |
| **Multi-branch agencies** | 4–20 branches, brand standards | "Every branch sends confirmations differently. There's no consistent experience with our name on it." |
| **Consortia, groups & franchises** | Central support for many members | "Members keep asking for 'an app like the big boys have'. We can't build one each." |
| **Tour operators & specialists** | Own product, high-touch trips | "Our trips are crafted. The way customers experience them before departure is an email attachment." |

The platform admin manages many agencies, each fully branded, and agencies sign
in to their own portal straight from the Travelgenix Control dashboard (single
sign-on) — so the group / consortium story is real, not aspirational.

---

## 3. The problem (use this for the problem section)

Write these as the customer's own words, not as feature gaps.

**1. After the booking, the agent goes quiet.**
The most excited a customer ever is about a holiday is right after booking it —
and that is exactly when most agencies disappear until "your balance is due".
The relationship that won the booking sits idle for months.

**2. The trip lives in an email attachment.**
Confirmations, e-tickets, vouchers, transfer details — scattered across PDFs in
an inbox, searched for at the airport on hotel wifi. It works, in the way a
shoebox of receipts works.

**3. "What terminal? What time? Has the flight changed?"**
Every pre-departure question is a phone call or a WhatsApp to the agent —
usually at the weekend, usually answerable by an app the agency doesn't have.

**4. The big brands have an app and you don't.**
TUI, Jet2 and easyJet customers get countdowns, live gates and documents on
their phone. An independent's customers get less — even when the holiday and
the service were better. The gap is visible to the customer every single trip.

**5. Someone else's app owns your customer.**
When the traveller's only good tool is the airline's or the OTA's app, that
brand is the one in their pocket all holiday — and the one they remember at
rebooking time.

**6. Reviews go uncollected.**
The customer lands home glowing, and nobody asks. Two weeks later the glow is
gone.

**7. The rebooking moment is missed.**
The best time to plant the next trip is the week they come home. Almost nobody
has a mechanism for it.

---

## 4. The solution — the core promise

**The ten-second install is the hero of the whole site. Lead with it.**

> Your customer books. You send one link — or they scan a QR at the desk.
>
> Their trip appears on their phone, under **your** brand: the countdown, the
> flights, the documents, the lot.
>
> One more tap puts it on their home screen. From now until they're home,
> you're the app.

Everything else on the microsite is "and here is what's inside". The emotional
sell is *the agency's brand in the customer's pocket* — big-brand experience,
independent-agency service.

Three supporting promises:

1. **Zero admin.** On Travelify, the trip builds itself from the booking —
   flights, hotels, dates, travellers. Manual trips can be built in the portal
   for everything else.
2. **The agent stays in the story.** Messaging, documents, advice pages and
   next-trip ideas all carry the agency's name — not a supplier's.
3. **It tells the truth.** Destination facts come from Travelgenix's verified
   library with provenance; weather shows only when two independent forecasters
   agree. It does not invent (§5.11 — this mirrors the Luna Marketing trust
   story and the family resemblance is worth pointing out).

---

## 5. Features — full detail

Each of these is built and shipping. Use the "why it matters" line as the
customer-facing benefit; use the detail for feature pages.

### 5.1 Instant access — no app store, no passwords

- Agent creates access from the portal in seconds: a **sign-in link plus a QR
  code** for a booking, with a **preview button** so the agent sees exactly
  what the traveller will get before sending
- The traveller opens the link and lands on a full-screen reveal: their name,
  their destination, their dates, a countdown — then one button into the app
- **No password, ever.** Access is a secure magic link; returning travellers
  re-verify with their own booking details
- **Add to home screen everywhere:** one-tap native install on Android/Chrome,
  a Share-sheet guide on iPhone/iPad, a browser-menu guide on everything else.
  The affordance lives permanently in the app (Me screen), and the app tells
  travellers when it's already installed
- Because it's a link, it works sent by email, WhatsApp, SMS, printed as a QR
  in a ticket wallet, or scanned off the agent's screen at the desk

**Why it matters:** the single biggest killer of agency apps is "download our
app from the store". Luna removes the store entirely — the trip is on the
phone before the customer has left the shop.

### 5.2 The cover — a countdown they'll show their friends

The app opens on a full-bleed destination photograph with a live countdown
clock ticking down to departure — days, hours, minutes, seconds.

- A **photographic library covering every country** (the platform holds ~250
  country slots in portrait and landscape, managed centrally), with
  **city/region-level photos** layered on top where they exist — an Abu Dhabi
  booking shows Abu Dhabi, not just "UAE"
- The copy is **date- and content-aware**: "your trip is almost here" before,
  "Enjoy Abu Dhabi" during, "Welcome home from Abu Dhabi" after — and it says
  *trip*, not *holiday*, when the booking is flight-only
- A **share button** posts the countdown moment ("12 days until Abu Dhabi! ✈️")
  through the phone's native share sheet — travellers market the agency to
  their friends
- Quick-action dock straight into Summary, Itinerary, Documents and Ask Luna

**Why it matters:** this is the screen that gets screenshotted and sent to the
group chat. It makes a £40/head booking feel like a big-brand product.

### 5.3 Home — the whole trip on one screen

- Greeting by name, trip countdown, and an **"Up next"** feed built from the
  itinerary (next flight, next check-in)
- Quick tiles: Flights, Hotel, Map, Docs, Luna
- The **destination guide** card, the **"From your travel agent"** content
  pages (§5.9), **airport extras** attached to the booking (lounges,
  fast-track), and the post-trip **"Where next?"** section (§5.13)
- After the trip ends, the home reshuffles: countdown gone, rebooking content
  leads

### 5.4 Auto-populated from Travelify — zero data entry

- For Travelify-connected agencies, the traveller's real booking loads live:
  flights with terminals and times, hotels with stay dates, passengers,
  extras — nothing typed by anyone
- Structured **destination capture** feeds the photography and content systems
  (country plus city/region), kept in sync automatically as bookings change
- For everything else, the portal's **Trips** builder creates a manual
  itinerary (flights, hotels, dates) and sends access for it the same way

**Why it matters:** an app the agent has to populate is an app the agent stops
using. On Travelify the marginal effort per booking is one click.

### 5.5 Itinerary — timeline and storyboard

- The full trip auto-built as a day-by-day **timeline**: flights, hotel
  check-ins and check-outs, transfers, extras — with times, durations and
  detail pages for each item
- A **storyboard view** — the same trip as a swipeable visual story
- Flight detail pages per leg; hotel detail pages per stay

### 5.6 Live flight status

- Real-time flight tracking wired into the app (AeroDataBox data): status,
  gates, terminals, times
- Travellers see it on their flight pages; the agency portal has a **Flights**
  view of upcoming departures across all their travellers
- Admin-side health checks and test tooling keep the integration observable

**Why it matters:** "has the flight changed?" stops being a phone call.

### 5.7 Documents — tickets in their pocket

- The agency uploads documents per booking from the portal (tickets, vouchers,
  transfers, insurance); travellers get them in the app, organised by trip
- The app is a full PWA — installed, it opens like a native app, and the
  product's own promise is "tickets and documents, even offline" (standard
  PWA caching; see §11 before making offline a headline claim)

### 5.8 Maps — the trip, and the neighbourhood

- **Trip Map:** the journey plotted — airports, hotels, distances flown
- **Find your way around** (new, first-client-requested): the agent curates
  named places — sights, restaurants, beaches, practical stops — which appear
  as pins on a real pan/zoom street map with a description and a one-tap
  **Directions** button that opens the phone's navigation. Adding a place in
  the portal is just typing its name — a search fills in the coordinates

### 5.9 Trip pages — the agent's own advice, in the app

Three agency-authored content pages, edited in the portal, appearing on the
traveller's home under **"From your travel agent"**:

- **Before you travel** — accordion sections (visas, packing, check-in advice).
  Can be written once as an **agency-wide default** applied to every booking,
  with per-booking overrides
- **Itinerary** — the trip day by day in the agent's own words, alongside the
  auto-built timeline
- **Find your way around** — the curated map above

Rows appear on the traveller's home only when the page has content, so there
are never empty screens.

**Why it matters:** this is the agent's expertise — the actual product of a
good travel agency — delivered in the app instead of a Word attachment.

### 5.10 Messages — the agent one tap away

- **Two-way messaging** between traveller and agency: the agent writes from
  the portal, the traveller reads and replies in the app
- **Read receipts** back to the agent, unread badges for the traveller
- **Broadcast** — one message to many travellers at once (e.g. "storm at the
  airport, check your flight before leaving")
- Everything is in-app messaging with the agency's name on it (see §11 — there
  are no push notifications; don't claim them)

### 5.11 Destination guide — verified facts, honest weather

**Give this its own trust section — it is the family resemblance with Luna
Marketing's "it won't make things up".**

- Destination content comes from **Travelgenix's own verified library (Luna
  Brain)** — structured facts per destination including best months to visit
  and cheapest time to fly, plus consumer Q&A. Every answer carries its
  source, confidence and last-verified date, and FCDO-sensitive answers are
  flagged and caveated. Nothing is generated on the fly; a missing fact is
  simply not shown
- **Weather is agree-or-drop:** near-term forecasts are cross-checked across
  two independent providers (Open-Meteo and MET Norway) and figures are shown
  only where they agree — otherwise a range, or nothing. Beyond the forecast
  horizon it shows labelled climate normals for the stay's month, not a fake
  forecast

**Why it matters:** an app that invents a sunny week or a visa rule damages
the agency that sent it. Luna would rather show less than guess.

### 5.12 Reviews — caught while the glow is warm

- After the trip, the app asks the traveller for a review
- Reviews land in the agency portal's **Reviews** section — rating, text,
  trip context

### 5.13 The rebooking loop — "Where next?"

- The agency curates **next-trip inspirations** (destination cards with the
  agency's branding) shown in the app — discoverable before the trip,
  front-and-centre once the traveller is home ("Loved Abu Dhabi? Here's where
  we'd send you next")
- Combined with reviews and messaging, the post-trip screen is a rebooking
  surface with the agency's name on it, sitting on the customer's phone

**Why it matters:** the app doesn't die when the trip ends — it turns into
the start of the next one.

### 5.14 White-label branding

- Agencies set their **app name, logo, primary and accent colours, and welcome
  message** in the portal — with a live phone preview while they edit
- The traveller's app opens under the agency's brand; invites, messages and
  content pages all carry it

### 5.15 Languages and appearance

- The app chrome is localised in **six languages** — English, Romanian,
  French, German, Spanish, Italian — auto-detected per traveller and
  switchable in settings (booking data and agency-written content stay in
  their original language; see §11)
- Full **dark mode**

### 5.16 The agency portal

Everything the agency does happens in one clean portal:

- **Overview** — travellers, app-open rate, departures in the next 30 days,
  pending invites, quick actions
- **Send access** — link + QR per booking, with preview
- **Travellers** — who has access, who's opened the app, how often, last seen
- **Messages / Broadcast** — with read state
- **Flights** — live status across upcoming departures
- **Reviews** — what travellers said
- **Trips** — manual itinerary builder for off-Travelify bookings
- **Trip pages** — the three content pages (§5.9)
- **Documents** — uploads per booking
- **App branding** — the white-label settings with live preview
- **Single sign-on from Travelgenix Control** — agents click through from
  their existing dashboard and are signed in; agencies without Control get a
  one-time sign-in link

### 5.17 For groups, consortia and the platform

- The platform admin runs **many agencies** from one place — each with its own
  branding, travellers, content and connections
- Central management of the destination photography library (every country,
  plus city/region drill-down), platform settings, integration health checks
  and a full audit log
- **This is the same commercial story as Luna Marketing's group page: bespoke
  branded apps for every member, without building an app per member. Do not
  bury it.**

---

## 6. Differentiators — the comparison table

The honest comparison is against the status quo (PDFs + WhatsApp) and against
"build an app" — not against naming competitors.

| | Email + PDFs + WhatsApp | A custom agency app | Luna Travel |
|---|---|---|---|
| On the customer's home screen, your brand | No | Yes, after £20k+ and a year | Yes, in seconds |
| App store download required | — | Yes, and most customers won't | **No — one link or QR** |
| Populates itself from the booking | No | Rarely | Yes, on Travelify; manual builder otherwise |
| Live flight status | No | Sometimes | Yes |
| Documents in one organised place | Inbox search | Yes | Yes |
| Two-way messaging with the agency | WhatsApp sprawl | Sometimes | Built in, with read receipts |
| Agent's own advice pages & curated map | Word attachments | Custom work | Built in, edited in the portal |
| Verified destination facts, honest weather | No | No | Yes — provenance-carrying library, agree-or-drop forecasts |
| Post-trip reviews and rebooking content | No | Custom work | Built in |
| Six languages, dark mode | — | Custom work | Built in |
| Cost of an empty week | — | The app still cost £20k | Nothing — it runs itself per booking |

**The strongest single differentiator: no app store.** Every competitor
experience begins with "download our app". Luna begins with "tap this link".
It is easy to explain, easy to demo, and it removes the exact step where
customers give up.

**Second strongest: zero data entry on Travelify.** An app is only as good as
the data in it, and Luna fills itself.

---

## 7. Objection handling

| Objection | Answer |
|---|---|
| "Our customers won't download an app." | They don't download anything. They tap a link and the trip is there; adding it to the home screen is one more tap. No store, no account, no password. |
| "We haven't got time to set up every booking." | On Travelify there is nothing to set up — the trip builds itself from the booking. Sending access is one click and a QR. |
| "We're not on Travelify." | The portal's Trips builder creates the itinerary manually, and everything else works identically. |
| "We already WhatsApp our customers." | Keep doing it. Luna is where the documents, flights and answers live so WhatsApp stops being the filing system. Messages in Luna carry your brand and read receipts. |
| "What if it shows wrong information?" | Trip data comes from the booking itself. Destination facts come from Travelgenix's verified library with sources and last-verified dates, and weather only shows when two independent forecasters agree. Nothing is generated on the fly. |
| "Will it look like us or like Luna?" | Your name, your logo, your colours, your welcome message — set once in the portal, previewed on a live phone mock-up. |
| "We're a group — 80 members can't each run an app." | One platform, many agencies, each fully branded, centrally administered. Members click straight in from Control. |
| "Our customers are older / not techy." | It's a link that opens a web page. If they can open a link in a message, they can use it — and the agent can show a QR at the desk and set it up with them in the shop. |

---

## 8. Screenshots — shot list

**I could not capture these myself** — traveller shots need a real phone with
a populated booking and portal shots need a signed-in agency. Andy is best
placed; **he already has two of the best shots from today's testing** (the Abu
Dhabi cover splash and the invite reveal, both on-device).

Traveller shots on a **real phone** (or DevTools at iPhone 14/15 size),
portal shots at a **wide browser window, light mode**. Use the demo agency
and demo bookings — never a real client's traveller data. The DEMO89654
Abu Dhabi booking photographs beautifully.

**Priority order.** If you only take six, take the first six.

| # | Shot | Where | State to set up | Use on site |
|---|---|---|---|---|
| 1 | **Cover splash** | app home, phone | Destination photo, countdown ticking (use a future-dated booking), agency chip visible | Hero. Andy has an Abu Dhabi version already; retake with a future date so the countdown shows. |
| 2 | **Invite reveal** | the access link, phone | Traveller name, destination, dates, countdown chip, "Open my trip" | "How it works" step 1. Andy has this. |
| 3 | **Send access + QR** | `/agency/access` | Link + QR generated for a booking, preview button in shot | The ten-second story, agent side |
| 4 | **Home dashboard** | `/` on phone | Up next feed, quick tiles, "From your travel agent" section populated | "Everything in one place" |
| 5 | **Live flight status** | flight page, phone | A real tracked flight with times/terminal | Flight status section |
| 6 | **Find your way around** | `/guide/find-your-way`, phone | 3–5 pins on the map, place cards with Directions | Maps / trip pages section |
| 7 | **Before you travel** | `/guide/before-you-travel`, phone | 4–5 accordion sections, one open | Trip pages section |
| 8 | **Itinerary timeline** | `/itinerary`, phone | A multi-day trip with flights + hotel | Itinerary section |
| 9 | **Documents** | `/documents`, phone | A few uploaded documents | Documents section |
| 10 | **Messages thread** | phone + `/agency/messages` side by side | The same conversation from both ends | Messaging section — the two-sided shot is the story |
| 11 | **App branding editor** | `/agency/branding` | Colours/logo set, **live phone preview** in shot | White-label section — the phone-in-portal preview sells it |
| 12 | **Portal overview** | `/agency` | Stats populated, quick actions | Portal tour |
| 13 | **Travellers engagement** | `/agency/travellers` | A few travellers, opened/installed states | "Know who's engaged" |
| 14 | **Trip pages editor** | `/agency/content` | Place search mid-flow or accordion editor populated | Agent-side content story |
| 15 | **Destination guide + weather** | `/destination`, phone | Facts + weather visible | Trust section |
| 16 | **"Where next?" post-trip home** | `/` with a past-dated booking | Welcome home + inspirations | Rebooking section |
| 17 | **Add to home screen** | Me screen, phone | The "Add to home screen" row (or the installed ✓ state) | Install story |

**The one piece of motion:** a screen recording of the full ten-seconds —
QR scanned → reveal → "Open my trip" → cover splash with the countdown
ticking → add to home screen. If the site gets one video, it is this. (Andy
can film it over-the-shoulder on a phone; it reads better than a screen
capture.)

**Before publishing any screenshot:** check for real traveller names, emails,
booking references you don't want public, and phone numbers. The demo agency
("Seaside Travel") and DEMO bookings exist for exactly this.

---

## 9. Suggested microsite structure

A hub page plus focused feature pages, mirroring the Luna Marketing microsite
so the two read as one family. The hub must carry the whole story for people
who never click through.

**1. Hub — `/what-we-do/luna-travel`** (rebuild the existing page)
- Hero: the ten-second install — cover-splash screenshot in a phone frame,
  ideally the video
- The problem, in the customer's words (§3)
- How it works in three steps: You send a link → their trip appears, in your
  brand → you're the app until they're home
- Feature overview grid, each linking to its page
- Who it's for (§2 segments)
- The trust section — verified destination facts, agree-or-drop weather,
  booking data from the booking
- The rebooking loop — reviews + Where next
- FAQ (§7)
- CTA: book a demo

**2. `/luna-travel/the-traveller-app`** — the app itself: cover, home,
itinerary, flights, documents, maps, languages. The visual page — heavy on
phone frames.

**3. `/luna-travel/trip-pages`** — Before you travel, Itinerary, Find your way
around; the agent's expertise delivered in-app. New and client-driven, worth
its own page.

**4. `/luna-travel/messaging-and-service`** — two-way messages, broadcast,
read receipts, documents; "every answer without a phone call".

**5. `/luna-travel/your-brand`** — white-label branding, the live preview,
the share button, what the customer sees at every step.

**6. `/luna-travel/after-the-trip`** — reviews, Where next, the rebooking
loop. Commercially the page that justifies the spend.

**7. `/luna-travel/for-groups`** — consortia, multi-branch, franchises, the
Control SSO story. As with Luna Marketing: the most valuable page.

**8. `/luna-travel/how-it-works`** — the journey end to end: booking made →
access sent → trip in pocket → home again; portal tour; what setup week
actually is (roughly: connect branding, send first access).

**Cross-linking:** every Luna Marketing page should footer-link "Luna keeps
marketing them after the trip too →" and vice versa ("Luna wins the customer;
Luna Travel keeps them"). If Andy wants a family page — `/what-we-do/luna` —
the pairing line is: *Luna Marketing fills the diary. Luna Travel fills the
pocket.*

---

## 10. Copy starters

Headlines to work from — not final, but the right register. Plain, confident,
no hype. Same tone rules as the Luna Marketing brief: short sentences,
concrete nouns, British English, travel-trade vocabulary (agents, homeworkers,
consortium, ABTA, high street — never "SMBs" or "users").

**Hero options**
- "Your brand. Their pocket. The whole trip."
- "The app the big brands have. Without building one."
- "Send one link. Be the app on their phone."
- "From 'booking confirmed' to 'welcome home' — in your brand."

**Section headers**
- Install: "No app store. No download. No password. One link."
- Cover: "The countdown they'll screenshot for the group chat."
- Data: "It fills itself in. You just send the link."
- Flights: "'Has the flight changed?' — answered before they ask."
- Trip pages: "Your advice used to be an attachment. Now it's an app."
- Messaging: "One tap from you, all holiday long."
- Trust: "It shows facts it can verify. Or it shows nothing."
- Weather: "Two forecasters have to agree before we show you a number."
- Rebooking: "The trip ends. The app doesn't."
- Groups: "A branded app for every member. Without an app project for every member."

**Words the product has earned** (all literally true): countdown, live flight
status, QR code, home screen, white-label, read receipts, verified, offline
documents (per product copy — see §11), six languages.

---

## 11. Do not claim — accuracy guardrails

**Read this before writing a word of copy.** A marketing session without code
access will fill gaps by inventing plausible capability. These are the gaps.

**Do not invent numbers.** There is **no performance data** — no customer
counts, no engagement uplift, no rebooking rates, no time saved. The first
client is onboarding **right now** (September 2026). Any statistic not
supplied by Andy is fabricated. No testimonials exist yet.

**Do not claim these — they are not built:**
- **Push notifications.** There are none. Messages, flight updates and review
  prompts appear **in the app**, not as phone notifications. Never write
  "we'll notify them the moment the gate changes" — they see it when they
  open the app.
- **A native App Store / Google Play app.** It is a PWA — that is the selling
  point. Say "no app store needed", never "download on the App Store".
- **An AI chat concierge.** The "Ask Luna" screen exists but its conversational
  answers are pre-written per destination (prototype-stage). The *destination
  guide* content is real and verified (§5.11) — sell that, not a chatbot.
- **Payments, upselling or in-app purchasing** of any kind. Airport extras
  display what is on the booking; nothing is bought in the app.
- **A booking engine.** Luna Travel is post-booking only. "Where next?"
  inspirations link back to the agency; the customer books with the agent.
- **Revenue attribution.** The portal shows engagement (opens, last seen,
  read receipts), not bookings caused.
- **Trustpilot/Google review syndication.** Reviews are collected in-app and
  shown to the agency. They do not post to Google.
- **Itinerary changes flowing live mid-trip from every supplier.** Travelify
  bookings load live from Travelify; flight status is live; but do not promise
  "any change from any supplier appears instantly".

**Handle with care:**
- **Offline.** The product's own install copy says "tickets and documents,
  even offline", and the app is a genuine installable PWA with an offline
  fallback. Fine to repeat the product's claim; do **not** escalate it to
  "the entire app works with no signal" without Andy testing it on a phone in
  airplane mode first.
- **Languages.** Six languages cover the app chrome (menus, labels, headings).
  Booking data, agency-written trip pages and destination editorial remain in
  their source language. Say "the app speaks six languages", not "your content
  is translated".
- **Flight status** depends on third-party flight data (AeroDataBox); coverage
  is broad but not literally every airline everywhere. "Live flight status"
  is fine; "guaranteed for every flight on earth" is not.
- **The Travelify dependency.** Auto-population requires the agency's
  Travelify connection. Without it the manual Trips builder does the work.
  State it plainly — it is also the cross-sell into the wider platform.
- **Destination photography.** The library covers every country slot and is
  being populated by hand (the vast majority done, including city-level for
  key destinations). Anywhere without a photo gets a designed gradient, never
  a blank. Say "designed for every destination", not "a photo of every city
  on earth".
- **The installed app's label.** Branding covers in-app name, logo, colours
  and welcome. Verify with Andy what name the home-screen icon shows before
  claiming "your name under the icon".

**Say "your", not "ours."** The travellers, the reviews, the messages and the
relationship belong to the agency. Luna is the plumbing. Getting this
backwards ("Luna's app engages your customers for you") undercuts the entire
pitch, which is that the *agency* is the brand the customer sees.

**Status.** Luna Travel is at first-client onboarding. Deployed, feature-
complete for launch, demo data still present in places. Do not imply an
established customer base.

---

## 12. Open questions for Andy

The Framer session will need these and I cannot answer them from the code:

1. **Pricing.** Per agency? Per traveller? Per booking? Bundled with
   Travelgenix websites or Travelify? Nothing in the codebase indicates it.
2. **Packaging with Luna Marketing.** Sold separately, together, or as a
   "Luna" suite? Decides whether the microsites share a parent page.
3. **The name in front of customers.** Travellers currently see "Luna Travel"
   chrome with the agency's branding inside. Is the public product name
   "Luna Travel" — and does the first client's app carry their name or
   Luna's on the home screen icon?
4. **Travelify dependency messaging.** How prominent should "works best with
   Travelify" be? It's both a constraint and the cross-sell.
5. **The CTA.** Book a demo, join the launch, or talk to sales? Is the first
   client willing to be named or filmed?
6. **Consortium commercials.** Same question as Luna Marketing — is there a
   group offer? The groups page needs its own CTA.
7. **Domain.** Does Luna Travel get marketing pages only on travelgenix.io,
   or its own domain like the app (lunatravel.travelify.io)?
