# PDF import (Add-booking → "Import from PDF")

Lets an admin upload a supplier confirmation / e-ticket / itinerary PDF and have
it **pre-fill** the Add-booking form (`/admin/bookings/new`) for review. It
creates nothing — it only produces a draft the admin checks and saves. The
booking is then stored exactly like a manually-entered off-platform booking.

```
PDF  ──upload──▶  POST /api/admin/import-pdf  ──▶  extractBookingFromPdf()
                                                      │
                          ┌───────────────────────────┴──────────────┐
                          ▼ (preferred)                               ▼ (fallback)
                  Luna Chat AI service                        direct Anthropic call
              (LUNA_CHAT_EXTRACT_URL)                          (ANTHROPIC_API_KEY)
                          └───────────────────────────┬──────────────┘
                                                      ▼
                                       normalised FormDraft  ──▶  form pre-fill
```

The whole pipeline is server-only (`src/lib/booking-extract.ts`). The PDF bytes
never reach the browser a second time; the client only receives the structured
draft.

## Two backends

`extractBookingFromPdf()` tries, in order:

1. **Luna Chat's internal AI service (preferred).** Reuses the Brain widget's
   existing Anthropic credentials/credits rather than provisioning a second key.
   Active when **both** `LUNA_CHAT_EXTRACT_URL` and `TG_INTERNAL_KEY` are set.
2. **A direct Anthropic Messages call (fallback).** Self-contained; active when
   `ANTHROPIC_API_KEY` is set. Used when the Luna Chat URL is unset, or when the
   Luna Chat call fails. This is what makes the feature work for the show before
   the cross-repo endpoint is live.

If neither is configured the route returns `501 { ok:false, configured:false }`
and the form tells the admin to enter the booking manually. Nothing crashes.

## Environment variables

| Var | Used for |
|---|---|
| `LUNA_CHAT_EXTRACT_URL` | Full URL of Luna Chat's PDF-extraction endpoint (preferred backend). Leave unset to use the Anthropic fallback. |
| `TG_INTERNAL_KEY` | Existing internal service key, sent to Luna Chat as `X-TG-Internal-Key`. Already used for the Control booking fetch. |
| `ANTHROPIC_API_KEY` | Anthropic key for the direct fallback. |
| `ANTHROPIC_MODEL` | Optional model override for the fallback (default `claude-sonnet-4-6`). |

**To switch it on for the show:** set `ANTHROPIC_API_KEY` in luna-travel's Vercel
env (Production). That alone makes import work, no Luna Chat changes required.
When the Luna Chat endpoint below is built, set `LUNA_CHAT_EXTRACT_URL` and it
takes precedence automatically.

## Contract for the Luna Chat endpoint (to be built in luna-chat-endpoint)

`POST {LUNA_CHAT_EXTRACT_URL}`

Request headers: `Content-Type: application/json`, `X-TG-Internal-Key: <key>`
(validate this equals the shared internal key before doing any work).

Request body:

```json
{ "filename": "confirmation.pdf", "mediaType": "application/pdf", "dataBase64": "<base64 of the PDF bytes>" }
```

Success response (`200`):

```json
{
  "ok": true,
  "booking": {
    "leadFirstName": "", "leadLastName": "", "leadEmail": "",
    "destinationLabel": "", "countryCode": "", "reference": "",
    "flights": [
      { "carrierCode": "", "flightNumber": "", "fromIata": "", "toIata": "",
        "departAt": "YYYY-MM-DDTHH:MM", "arriveAt": "YYYY-MM-DDTHH:MM", "cabin": "Economy" }
    ],
    "hotels": [
      { "name": "", "city": "", "country": "",
        "checkIn": "YYYY-MM-DD", "checkOut": "YYYY-MM-DD", "board": "BB" }
    ],
    "experiences": [
      { "kind": "transfer", "title": "", "supplier": "", "location": "",
        "startAt": "YYYY-MM-DDTHH:MM", "endAt": "", "notes": "" }
    ]
  }
}
```

Failure response: any non-200, or `{ "ok": false, "error": "…" }`.

### Field rules (the luna-travel side re-normalises, but match these to minimise surprises)

- **Times** (`departAt`/`arriveAt`/`startAt`/`endAt`): local wall-clock time as
  printed on the document, 24-hour, `YYYY-MM-DDTHH:MM`. **Do not convert time
  zones** — the PWA renders these as the displayed itinerary times.
- **Dates** (`checkIn`/`checkOut`): `YYYY-MM-DD`.
- `countryCode`: ISO 3166-1 alpha-2 of the **destination** (where the traveller
  is going), uppercase.
- `cabin`: one of `Economy`, `PremiumEconomy`, `Business`, `First`.
- `board`: one of `RO`, `BB`, `HB`, `FB`, `AI`, or empty.
- `kind`: one of `excursion`, `car-hire`, `transfer`, `activity`, `other`.
- Split multi-leg journeys into one `flights[]` entry per segment.
- Never invent values — leave anything not present empty. Photos are never
  extracted; the admin adds them.

The luna-travel side (`toFormDraft` in `src/lib/booking-extract.ts`) coerces,
upper-cases, clamps and re-formats everything above, so a slightly loose
response is still usable — but matching the contract gives the cleanest pre-fill.
The direct-Anthropic fallback uses exactly this shape as its tool `input_schema`,
so it doubles as the reference implementation.

## Limits

- PDF only, 16 MB max (base64 stays under Anthropic's 32 MB request ceiling).
- Route `maxDuration` is 60s to allow for document reasoning.
