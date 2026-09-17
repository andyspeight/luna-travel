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

Edit `tour-steps.ts`. A step is `{ href?, target?, title, body, placement? }`.

- **`target`** is a `data-tour` attribute value, *not* a CSS selector. A class
  name is a styling decision somebody will reasonably change one day; the tour
  should not break when they do. Add `data-tour="thing"` to the element.
- **`href`** moves the tour to another page first. The nav bar is on every page,
  so a step explaining a section needs no `href` — spotlight `nav-<key>` from
  wherever the tour already is. Only branding and Send access navigate, because
  those are the two things an agency has to actually *do*.
- **No `target`** gives a centred callout, which is how the welcome and the
  sign-off are drawn.

### Why a test reads the source

`src/lib/__tests__/tour-steps.test.ts` checks every anchor a step names really
exists — nav keys against the menu, `data-tour` attributes against every page,
hrefs against the route files.

This is not ceremony. An attribute-anchored tour fails **silently** when a page
is renamed or a nav key changes: the spotlight stops appearing, nothing throws,
no other test goes red, and nobody finds out until an agency mentions it months
later. Rename `data-tour="access-list"` or the `content` nav key and that test
goes red immediately — both verified by doing it.

### Crossing pages

The agency portal is a dozen separate pages, so a step with an `href` writes its
position to `sessionStorage`, navigates, and the next page picks the tour back
up on mount. `sessionStorage`, not local: a second tab is not halfway through a
tour.

`tourInProgress()` is why a **replay** survives a page change. Without it the
navigation unmounts everything and only a first run — which auto-starts — would
come back.

## The guide

`src/app/agency/guide/page.tsx`. Written for somebody who has never seen the
product and wants to be live today: a four-step checklist first, what a
traveller actually does second, every section third, and troubleshooting last.

**The troubleshooting is not padding.** Every entry is something that has
already gone wrong for a real agency, and the first one — *the email must be the
address held on the booking* — accounts for more failed sign-ins than everything
else put together. If that section is ever trimmed, keep that one.
