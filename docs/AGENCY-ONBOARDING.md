# Helping an agency get started

Two separate things, and they answer different questions.

| | |
|---|---|
| **The walkthrough** | *Where is everything?* Runs itself on a first sign-in. |
| **The guide** (`/agency/guide`) | *How do I do this, and why did that break?* Always there. |

Luna Travel shipped with neither. An agency arriving from Control got eleven
menu items and no answer to "what is this, and what do I press first?".

## The walkthrough

A coach-mark tour, matching the Widget Suite's (`tg-widgets/public/editor-tour.js`):
the page dims, one real control is spotlit, and a short instruction is anchored
beside it. The control underneath stays usable — that is the whole difference
between a coach mark and a modal that talks at you.

Written for React rather than ported. That engine is built on the widget
editor's own shell — its tabs, its sections, its `window.tgse` global — none of
which exists here.

- `src/components/coach-tour.tsx` — the engine. Generic; nothing agency-specific.
- `src/app/agency/tour-steps.ts` — what it says and what it points at. Plain data.
- `src/app/agency/tour.tsx` — starts it, and mounts the "Show me how" button.

It runs once (`localStorage`, per browser) and replays from the corner button
for ever after. Anything that talks at somebody on their first morning and then
vanishes is a leaflet, not help.

### Adding or editing a step

Edit `tour-steps.ts`. A step is `{ target?, title, body, placement? }`.

- **`target`** is a `data-tour` attribute value, *not* a CSS selector. A class
  name is a styling decision somebody will reasonably change one day; the tour
  should not break when they do. Today every target is a `nav-<key>` menu item,
  because those are the only anchors present on every page.
- **No `target`** gives a centred callout, which is how the welcome and the
  sign-off are drawn.
- **There is no `href`.** Steps must not navigate — see below.

### Why a test reads the source

`src/lib/__tests__/tour-steps.test.ts` checks every anchor a step names really
exists: nav keys against the menu, and any other `data-tour` value against every
page in the app.

This is not ceremony. An attribute-anchored tour fails **silently** when a page
is renamed or a nav key changes: the spotlight stops appearing, nothing throws,
no other test goes red, and nobody finds out until an agency mentions it months
later. Rename a `data-tour` value or the `content` nav key and that test goes red
immediately — both verified by doing it.

### It never navigates, and that is load-bearing

The first version moved the agent to a page for the two steps where pointing at
the real form seemed worth it. Every move remounted the portal shell, which
refetches and redraws — so **pressing Next flashed the whole page**, and it read
as the tour reloading the site underneath you. Reported as a bug within a day of
shipping, and rightly.

Every step now points at something already on screen. The menu is on every page,
so a step about a section spotlights its nav item. The test enforces this: a
step with an `href` fails, and so does a target that is not a `nav-` one.

Scrolling had the same flavour of problem. `scrollIntoView` ran for every step,
and asking to centre the *sticky* menu can only be satisfied by throwing the
document to the top — so most steps jumped the page. It now scrolls only when
the target is genuinely off screen.

## The guide

`src/app/agency/guide/page.tsx`. Written for somebody who has never seen the
product and wants to be live today: a step-by-step setup they can work straight
down, each step carrying a tip; then real screenshots of what their travellers
will see; then what a traveller actually does; then every section; then
troubleshooting.

**The troubleshooting is not padding.** Every entry is something that has
already gone wrong for a real agency, and the first one — *the email must be the
address held on the booking* — accounts for more failed sign-ins than everything
else put together. If that section is ever trimmed, keep that one.

### The screenshots are real

`npm run guide:shots` drives a real browser at a running app and captures the
traveller screens at phone size, into `public/guide/`:

```
npm run build && npm start     # in one terminal
npm run guide:shots            # in another
```

Real screens rather than drawings, because a drawing drifts from the product the
first time somebody moves a button. Regenerate them when the traveller app
changes.

Two things make this work with no database behind it:

- The traveller app falls back to a **demo booking** when nobody is signed in,
  and `?demo=<ref>` (the app's own deep-link) opens the trip home, which
  otherwise shows the "add your trip" onboarding.
- A **Control agency resolves entirely from its own session claims**
  (`resolvePortalAgency`), so a session minted against the local dev
  `JWT_SECRET` renders the whole portal.

Only the two portal screens the setup steps talk about are captured. The rest of
the portal is a list that is empty without a database, and an agent reading the
guide is already looking at the real thing.

## Smoke test

`npm run smoke` drives a browser over every screen an agency or traveller
opens, and walks the tour end to end:

```
npm run build
JWT_SECRET=local-development-secret-at-least-32-chars npx next start
npm run smoke                                   # in another terminal
```

It exists because the walkthrough shipped with a bug — pressing Next reloaded
the page — that no unit test could have caught and one click would have. Two of
its checks are that regression directly: *Next never changes the page* and
*Next never jumps the scroll*.

Same no-database trick as the screenshots, so it needs only a local server.
Lists will be empty; this checks screens render, not that they render data.
