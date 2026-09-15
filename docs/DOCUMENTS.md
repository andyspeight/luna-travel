# How a traveller's documents reach them

The documents screen is the most important thing in the product. Everything else
is nice to have; a voucher at a check-in desk is not. This is how the bytes get
from a supplier to a phone, and why it is built the way it is.

## Where documents come from

| Source | Lives at | `DisplayDoc.id` |
|---|---|---|
| Agency upload | Supabase storage, `luna-travel-documents` | the `documents` row uuid |
| Travelify order | the supplier's own domain | `doc-0`, `doc-1`, … |
| Off-platform booking | whatever the stored payload says | `doc-0`, `doc-1`, … |
| Demo booking | same-origin placeholder paths | `d1`, `d2`, … |

Agency uploads win when there are any; otherwise the booking's own documents
show. Both are normalised to one `DisplayDoc` shape so the render path can never
crash on an unrecognised category.

## Two URLs, deliberately

Every document carries **two**, and the difference is the whole fix:

- **`url`** — the real thing, on somebody else's origin. Used by *Open full
  screen* and *Share*.
- **`previewUrl`** — `/api/traveller/document`, always same-origin. Used by the
  in-app preview and by *Download*.

A preview has to **fetch** the bytes; a new tab merely **navigates** to them.
CORS polices the first and ignores the second, so a supplier that sends no
`Access-Control-Allow-Origin` — which is most of them — breaks the preview while
leaving *Open full screen* working perfectly. That asymmetry is exactly what was
reported: documents were plainly there, and nothing would preview.

*Download* uses the proxy for a second reason: the `download` attribute is
ignored on a cross-origin `href`, so it had been opening files in a tab rather
than saving them.

## The proxy is not an open proxy

`/api/traveller/document?src=booking|agency&id=…` takes an **id, never a URL**.
It verifies `lt_session`, then resolves the id server-side:

- `src=agency` → the `documents` row, under the same predicate
  `/api/traveller/documents` lists by (agency, then `traveller_id` **or**
  `booking_ref`). Anything in the list previews; nothing else does.
- `src=booking` → the stored payload if the booking is off-platform, otherwise
  Control, then `orderToBooking`, then the document with that id.

Because no request input can name a host, there is no SSRF surface to defend.
Responses are `private, no-store` and `nosniff`.

HTML, XHTML, SVG, script, JSON and XML are refused with 415. An expired supplier
link usually answers `200` with a login page instead of `404`, so HTML is the
signature of a dead document — and serving attacker-influenced markup from this
origin, where the session cookie lives, would be a real XSS.

`Content-Length` is deliberately **not** forwarded: `fetch` transparently
decompresses, so upstream's length can describe compressed bytes that no longer
match the body, and the browser would hand PDF.js a truncated file.

## PDF.js is bundled, not fetched

It used to be injected from cdnjs at runtime — the only third-party script in the
app. That made the preview depend on a CDN being reachable from an airport
network, a captive portal, a corporate proxy, or an offline PWA launch.

Now it is an npm dependency loaded as its own lazy chunk (~360 kB, fetched the
first time a document is opened, so the page itself does not carry it). The
worker is vendored to `public/pdf.worker.min.js` by
`scripts/copy-pdf-worker.mjs`, which `prebuild` and `predev` run, so it can never
drift from the installed version.

Both use the **legacy** build. Travellers arrive on whatever phone they own, and
the modern build assumes syntax older Safari does not have. The lib and the
worker must stay a matched pair.

The worker is kept out of the precache manifest (`publicExcludes` in
`next.config.js`) and cached at runtime instead: it is over a megabyte, and a
traveller who never opens a document should not pay for it at install. Once
cached, previews work with no network at all.

`next.config.js` aliases `canvas` to `false` — PDF.js ships one bundle for
browsers and Node, and webpack must still resolve the Node half's `require`.

## Not everything is a PDF

One of the largest clients sells theme-park tickets, which arrive as JPEGs.
Those used to be fed to PDF.js, which produced "Preview couldn't load here" and
no clue why. `src/lib/document-type.ts` decides the file type once — preferring a
declared MIME type, falling back to the filename, defaulting to PDF — and both
the viewer and the proxy read from it, so the browser and the server cannot
disagree about the same file. Images render as images; an unrecognised extension
keeps its own name, because an agency's `.docx` must not be saved as `.pdf`.

## When a preview still fails

The viewers try `previewUrl` first and `url` second, then show "Preview couldn't
load here" with *Open full screen* and *Download* still available. A preview is
never the only way to reach a document.

Worth checking, in order: the traveller has a live `lt_session`; the supplier
link has not expired (a 415 in the logs means it returned a login page); and
Control can still resolve the order.
