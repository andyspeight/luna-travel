/**
 * PDF → structured booking extraction (server-only).
 *
 * Powers the "Import from PDF" control on the Add-booking form: a supplier
 * confirmation / e-ticket / itinerary PDF is turned into a draft that PRE-FILLS
 * the form for an admin to review and save. No booking is created here —
 * extraction only. The output shape is exactly the Add-booking form's field
 * shape (FormDraft), so the client can spread it straight into state; photos are
 * never extracted (the admin adds those).
 *
 * Two backends, tried in order:
 *   1. Luna Chat's internal AI service (PREFERRED) — reuses the Brain widget's
 *      Anthropic credentials/credits. Configured via LUNA_CHAT_EXTRACT_URL +
 *      TG_INTERNAL_KEY. Request/response contract is in docs/pdf-import.md.
 *   2. A direct Anthropic Messages call (FALLBACK) — self-contained, used when
 *      LUNA_CHAT_EXTRACT_URL is unset (or fails) but ANTHROPIC_API_KEY is set.
 *      Lets the feature work before the cross-repo Luna Chat endpoint is live.
 *
 * If neither is configured, returns { ok:false, configured:false } so the UI can
 * tell the admin to enter the booking manually.
 */

import type { ExtractionProfile } from '@/lib/pdf-profile';

// ───────── form-ready output shape (mirrors src/app/admin/bookings/new) ─────────

export interface FormFlight {
  carrierCode: string;
  flightNumber: string;
  fromIata: string;
  toIata: string;
  departAt: string; // YYYY-MM-DDTHH:mm  (datetime-local)
  arriveAt: string; // YYYY-MM-DDTHH:mm
  cabin: string; // one of CABINS
}
export interface FormHotel {
  name: string;
  city: string;
  country: string; // display name, e.g. "Spain"
  checkIn: string; // YYYY-MM-DD  (date)
  checkOut: string; // YYYY-MM-DD
  board: string; // one of BOARDS or ''
}
export interface FormExperience {
  kind: string; // one of EXP_KINDS
  title: string;
  supplier: string;
  location: string;
  startAt: string; // YYYY-MM-DDTHH:mm  (datetime-local)
  endAt: string; // YYYY-MM-DDTHH:mm
  notes: string;
}
export interface FormDraft {
  leadFirstName: string;
  leadLastName: string;
  leadEmail: string;
  destinationLabel: string;
  countryCode: string; // ISO-2
  reference: string;
  flights: FormFlight[];
  hotels: FormHotel[];
  experiences: FormExperience[];
  warnings: string[];
  source: string; // detected layout/issuer label, '' if unclear — drives the learned profile
}

export type ExtractResult =
  | { ok: true; source: 'luna-chat' | 'anthropic'; draft: FormDraft }
  | { ok: false; configured: boolean; error: string };

/**
 * Why an extraction failed, which decides what the admin is told.
 *
 * The distinction is the whole point of this type. Every failure used to
 * produce "Could not read this PDF automatically. Try a clearer file" — which
 * blames the document. An admin hitting a misconfigured backend would try three
 * more PDFs, conclude the feature was rubbish, and never report it. That is how
 * a broken setting survives for months without anybody noticing.
 */
type FailureKind =
  /** Our credentials or our model id. Nothing about the document will fix it. */
  | 'config'
  /** Busy or briefly down. Trying again is genuinely worth it. */
  | 'transient'
  /** The backend worked and could not read this particular file. */
  | 'document';

class ExtractionFailure extends Error {
  constructor(message: string, readonly kind: FailureKind) {
    super(message);
    this.name = 'ExtractionFailure';
  }
}

function kindOf(err: unknown): FailureKind {
  return err instanceof ExtractionFailure ? err.kind : 'document';
}

/**
 * What an HTTP failure from an extraction backend means.
 *
 * Exported so it can be tested directly: getting this wrong is how a broken
 * setting gets reported to an admin as a bad scan.
 *
 * 401 and 403 are our credentials. 404 is nearly always the model id — a real
 * key pointed at a model that does not exist. A 400 that mentions the model is
 * the same problem wearing a different status. 429 and 5xx are worth retrying.
 * Everything else is genuinely about the document we sent.
 */
export function classifyStatus(status: number, detail = ''): FailureKind {
  if (status === 401 || status === 403 || status === 404) return 'config';
  if (status === 400 && /model/i.test(detail)) return 'config';
  if (status === 429 || status >= 500) return 'transient';
  return 'document';
}

/** What an admin should read, by cause. */
export function messageFor(kind: FailureKind): string {
  if (kind === 'config') {
    return 'PDF import is misconfigured — the AI backend rejected our credentials or model. This is a settings problem, not a problem with your file, so a different PDF will not help. Please tell your administrator. You can enter the booking manually below.';
  }
  if (kind === 'transient') {
    return 'The extraction service is busy or briefly unavailable. Try again in a moment, or enter the booking manually below.';
  }
  return 'Could not read this PDF automatically. Try a clearer file, or enter the booking manually.';
}

const CABINS = ['Economy', 'PremiumEconomy', 'Business', 'First'];
const BOARDS = ['RO', 'BB', 'HB', 'FB', 'AI'];
const EXP_KINDS = ['excursion', 'car-hire', 'transfer', 'activity', 'other'];

// ───────── public entry point ─────────

export function extractConfigured(): boolean {
  return !!process.env.LUNA_CHAT_EXTRACT_URL && !!process.env.TG_INTERNAL_KEY ? true : !!process.env.ANTHROPIC_API_KEY;
}

/** Turn a PDF into a form-ready draft, preferring Luna Chat, falling back to Anthropic. */
export async function extractBookingFromPdf(
  bytes: Buffer,
  filename: string,
  mediaType = 'application/pdf',
  profile?: ExtractionProfile | null,
): Promise<ExtractResult> {
  const dataBase64 = bytes.toString('base64');
  const lunaUrl = process.env.LUNA_CHAT_EXTRACT_URL;
  const internalKey = process.env.TG_INTERNAL_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;

  // 1) Preferred: Luna Chat internal AI service.
  if (lunaUrl && internalKey) {
    try {
      const raw = await extractViaLunaChat(lunaUrl, internalKey, { filename, mediaType, dataBase64, profile: profile ?? undefined });
      return { ok: true, source: 'luna-chat', draft: toFormDraft(raw) };
    } catch (err) {
      const kind = kindOf(err);
      console.error(`[booking-extract] luna-chat failed (${kind}):`, err instanceof Error ? err.message : err);
      // Fall through to Anthropic where we have it — the point of two backends
      // is that one being down is survivable.
      if (!anthropicKey) {
        return { ok: false, configured: true, error: messageFor(kind) };
      }
    }
  }

  // 2) Fallback: direct Anthropic Messages call.
  if (anthropicKey) {
    try {
      const raw = await extractViaAnthropic(anthropicKey, { mediaType, dataBase64, profile: profile ?? undefined });
      return { ok: true, source: 'anthropic', draft: toFormDraft(raw) };
    } catch (err) {
      const kind = kindOf(err);
      // A config failure is logged at error level with the model id in the
      // message, because it is the one an operator has to see in the logs.
      console.error(`[booking-extract] anthropic failed (${kind}):`, err instanceof Error ? err.message : err);
      return { ok: false, configured: true, error: messageFor(kind) };
    }
  }

  return {
    ok: false,
    configured: false,
    error: 'PDF import is not switched on (set LUNA_CHAT_EXTRACT_URL or ANTHROPIC_API_KEY). Enter the booking manually below.',
  };
}

// ───────── backend: Luna Chat ─────────

async function extractViaLunaChat(
  url: string,
  key: string,
  payload: { filename: string; mediaType: string; dataBase64: string; profile?: ExtractionProfile },
): Promise<RawExtraction> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-TG-Internal-Key': key },
    body: JSON.stringify(payload),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) throw new ExtractionFailure(`luna-chat ${res.status}`, classifyStatus(res.status));
  const json = (await res.json()) as { ok?: boolean; booking?: unknown; error?: string };
  if (json.ok === false || !json.booking) {
    throw new ExtractionFailure(json.error || 'luna-chat returned no booking', 'document');
  }
  return asRecord(json.booking);
}

// ───────── backend: direct Anthropic ─────────

const EXTRACT_TOOL = {
  name: 'save_booking',
  description: 'Save the travel booking extracted from the document.',
  input_schema: {
    type: 'object',
    properties: {
      leadFirstName: { type: 'string', description: 'Lead traveller first name' },
      leadLastName: { type: 'string', description: 'Lead traveller surname' },
      leadEmail: { type: 'string', description: "Lead traveller's email if printed, else empty" },
      destinationLabel: { type: 'string', description: 'Short human label for the destination, e.g. "Mallorca", "Maldives", "New York"' },
      countryCode: { type: 'string', description: 'ISO 3166-1 alpha-2 code of the destination country, uppercase, e.g. ES, MV, US' },
      reference: { type: 'string', description: 'Booking / order reference if printed, else empty' },
      source: { type: 'string', description: 'The brand/issuer/template this document appears to come from, e.g. "Travel Counsellors confirmation", "Jet2holidays itinerary". Empty if unclear.' },
      flights: {
        type: 'array',
        description: 'One entry per flight segment (split multi-leg journeys).',
        items: {
          type: 'object',
          properties: {
            carrierCode: { type: 'string', description: 'Airline IATA code, e.g. BA, EZY, TP' },
            flightNumber: { type: 'string', description: 'Flight number digits, e.g. 2070' },
            fromIata: { type: 'string', description: 'Departure airport IATA, e.g. LGW' },
            toIata: { type: 'string', description: 'Arrival airport IATA, e.g. PMI' },
            departAt: { type: 'string', description: 'Local departure date-time exactly as printed, format YYYY-MM-DDTHH:MM (24h). Do NOT convert time zones.' },
            arriveAt: { type: 'string', description: 'Local arrival date-time, format YYYY-MM-DDTHH:MM (24h).' },
            cabin: { type: 'string', enum: CABINS, description: 'Cabin class' },
          },
        },
      },
      hotels: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            name: { type: 'string' },
            city: { type: 'string' },
            country: { type: 'string', description: 'Country display name, e.g. "Spain"' },
            checkIn: { type: 'string', description: 'Check-in date, format YYYY-MM-DD' },
            checkOut: { type: 'string', description: 'Check-out date, format YYYY-MM-DD' },
            board: { type: 'string', enum: ['', ...BOARDS], description: 'Board basis if stated (RO/BB/HB/FB/AI), else empty' },
          },
        },
      },
      experiences: {
        type: 'array',
        description: 'Car hire, transfers, excursions, activities, etc.',
        items: {
          type: 'object',
          properties: {
            kind: { type: 'string', enum: EXP_KINDS },
            title: { type: 'string' },
            supplier: { type: 'string' },
            location: { type: 'string' },
            startAt: { type: 'string', description: 'Local start date-time, format YYYY-MM-DDTHH:MM (24h).' },
            endAt: { type: 'string', description: 'Local end date-time if applicable, format YYYY-MM-DDTHH:MM.' },
            notes: { type: 'string' },
          },
        },
      },
    },
  },
} as const;

const EXTRACT_PROMPT = [
  'Extract the details of this ONE travel booking from the attached document',
  '(a supplier confirmation, e-ticket or itinerary) and save it with the save_booking tool.',
  '',
  'Rules:',
  '- Only record what is actually printed. Do not guess, infer or invent values. Leave anything not present empty.',
  '- Times: copy them exactly as printed (local time at the relevant airport/hotel), 24-hour, as YYYY-MM-DDTHH:MM. Never convert time zones.',
  '- Dates without a time: YYYY-MM-DD.',
  '- Split a multi-leg flight journey into one flights[] entry per individual segment.',
  '- countryCode is the ISO-2 of the destination the traveller is going TO (not their home/origin).',
  '- Classify car hire, airport transfers/shuttles, excursions/tours and tickets/activities into experiences[].',
].join('\n');

/** Compose the extraction prompt, layering in a client's learned profile when present. */
function buildPrompt(profile?: ExtractionProfile): string {
  let p = EXTRACT_PROMPT;
  if (profile?.hints) {
    p += `\n\nClient-specific guidance for this client's documents (follow it):\n${profile.hints}`;
  }
  if (profile?.examples?.length) {
    const ex = profile.examples
      .map((e, i) => `Example ${i + 1}${e.source ? ` — ${e.source}` : ''}:\n${JSON.stringify(e.corrected)}`)
      .join('\n\n');
    p += `\n\nThe following are bookings from THIS SAME client that were previously confirmed correct. Use them only to match this client's conventions — field naming, date formats, board codes, how flights/experiences are described. Do NOT copy their values; extract everything from the attached document:\n${ex}`;
  }
  return p;
}

async function extractViaAnthropic(
  apiKey: string,
  payload: { mediaType: string; dataBase64: string; profile?: ExtractionProfile },
): Promise<RawExtraction> {
  // The previous default was 'claude-sonnet-4-6', which is not a model id that
  // exists. Unless ANTHROPIC_MODEL happened to be set, every fallback
  // extraction 404'd — and the admin was told their PDF was unreadable. The
  // July go-live review flagged exactly this and it went unticked for months,
  // which is an argument for the default being right rather than for a note
  // asking somebody to set it.
  const model = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5';
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      model,
      max_tokens: 8192,
      tools: [EXTRACT_TOOL],
      tool_choice: { type: 'tool', name: 'save_booking' },
      messages: [
        {
          role: 'user',
          content: [
            { type: 'document', source: { type: 'base64', media_type: payload.mediaType, data: payload.dataBase64 } },
            { type: 'text', text: buildPrompt(payload.profile) },
          ],
        },
      ],
    }),
    cache: 'no-store',
    signal: AbortSignal.timeout(60_000),
  });
  if (!res.ok) {
    let detail = '';
    try {
      const e = (await res.json()) as { error?: { message?: string } };
      detail = e?.error?.message || '';
    } catch { /* the status alone is enough to classify */ }

    throw new ExtractionFailure(
      `anthropic ${res.status}${detail ? `: ${detail}` : ''} (model ${model})`,
      classifyStatus(res.status, detail),
    );
  }
  const json = (await res.json()) as { content?: Array<{ type?: string; name?: string; input?: unknown }> };
  const toolUse = (json.content || []).find((b) => b?.type === 'tool_use' && b?.name === 'save_booking');
  // The model answered but would not fill the form — that is about the file.
  if (!toolUse?.input) throw new ExtractionFailure('anthropic returned no tool_use', 'document');
  return asRecord(toolUse.input);
}

// ───────── normalisation: raw JSON → form-ready draft ─────────

type RawExtraction = Record<string, unknown>;

function toFormDraft(raw: RawExtraction): FormDraft {
  const flights = asArray(raw.flights).map(normFlight).filter((f) => f.fromIata || f.toIata || f.flightNumber);
  const hotels = asArray(raw.hotels).map(normHotel).filter((h) => h.name || h.city);
  const experiences = asArray(raw.experiences).map(normExperience).filter((e) => e.title);

  const draft: FormDraft = {
    leadFirstName: str(raw.leadFirstName),
    leadLastName: str(raw.leadLastName),
    leadEmail: str(raw.leadEmail).toLowerCase(),
    destinationLabel: str(raw.destinationLabel),
    countryCode: str(raw.countryCode).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 2),
    reference: str(raw.reference).toUpperCase(),
    flights,
    hotels,
    experiences,
    warnings: [],
    source: str(raw.source),
  };

  // Helpful, non-blocking guidance for the admin reviewing the pre-fill.
  if (!flights.length && !hotels.length) {
    draft.warnings.push("Couldn't find any flights or hotels — check the PDF, or add them manually below.");
  }
  if (!draft.countryCode) {
    draft.warnings.push('Set the 2-letter country code — it drives the destination guide, weather and hero image.');
  }
  if (!draft.leadEmail) {
    draft.warnings.push('No traveller email was found — add one so the QR can be redeemed.');
  }
  if (draft.leadEmail && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(draft.leadEmail)) {
    draft.warnings.push('The traveller email looks incomplete — please check it.');
    draft.leadEmail = '';
  }
  return draft;
}

function normFlight(v: unknown): FormFlight {
  const r = asRecord(v);
  return {
    carrierCode: str(r.carrierCode).toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3),
    flightNumber: str(r.flightNumber).toUpperCase().replace(/\s/g, ''),
    fromIata: str(r.fromIata).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
    toIata: str(r.toIata).toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3),
    departAt: toLocalDateTime(str(r.departAt)),
    arriveAt: toLocalDateTime(str(r.arriveAt)),
    cabin: normCabin(str(r.cabin)),
  };
}

function normHotel(v: unknown): FormHotel {
  const r = asRecord(v);
  return {
    name: str(r.name),
    city: str(r.city),
    country: str(r.country),
    checkIn: toLocalDate(str(r.checkIn)),
    checkOut: toLocalDate(str(r.checkOut)),
    board: normBoard(str(r.board)),
  };
}

function normExperience(v: unknown): FormExperience {
  const r = asRecord(v);
  return {
    kind: normKind(str(r.kind)),
    title: str(r.title),
    supplier: str(r.supplier),
    location: str(r.location),
    startAt: toLocalDateTime(str(r.startAt)),
    endAt: toLocalDateTime(str(r.endAt)),
    notes: str(r.notes),
  };
}

// ───────── value coercion helpers ─────────

function str(v: unknown): string {
  return typeof v === 'string' ? v.trim() : typeof v === 'number' ? String(v) : '';
}
function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}
function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === 'object' && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

/** Coerce assorted date-time strings to the form's datetime-local format (no TZ conversion). */
function toLocalDateTime(v: string): string {
  if (!v) return '';
  const m = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})[T\s](\d{1,2}):(\d{2})/);
  if (m) return `${m[1]}-${pad(m[2])}-${pad(m[3])}T${pad(m[4])}:${m[5]}`;
  const d = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (d) return `${d[1]}-${pad(d[2])}-${pad(d[3])}T00:00`;
  return '';
}
function toLocalDate(v: string): string {
  if (!v) return '';
  const d = v.match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
  return d ? `${d[1]}-${pad(d[2])}-${pad(d[3])}` : '';
}
function pad(s: string): string {
  return s.length === 1 ? `0${s}` : s;
}

function normCabin(v: string): string {
  const s = v.toLowerCase();
  if (s.includes('first')) return 'First';
  if (s.includes('business') || s.includes('biz')) return 'Business';
  if (s.includes('premium')) return 'PremiumEconomy';
  return 'Economy';
}
function normBoard(v: string): string {
  const up = v.toUpperCase().replace(/[^A-Z]/g, '');
  if (BOARDS.includes(up)) return up;
  const s = v.toLowerCase();
  if (s.includes('all') && s.includes('incl')) return 'AI';
  if (s.includes('full')) return 'FB';
  if (s.includes('half')) return 'HB';
  if (s.includes('breakfast') || s.includes('b&b') || s.includes('bed and')) return 'BB';
  if (s.includes('room only')) return 'RO';
  return '';
}
function normKind(v: string): string {
  const s = v.toLowerCase();
  if (EXP_KINDS.includes(s)) return s;
  if (s.includes('car') || s.includes('rental') || s.includes('hire')) return 'car-hire';
  if (s.includes('transfer') || s.includes('shuttle') || s.includes('taxi') || s.includes('pick')) return 'transfer';
  if (s.includes('excursion') || s.includes('tour') || s.includes('cruise') || s.includes('trip')) return 'excursion';
  if (s.includes('activity') || s.includes('ticket') || s.includes('experience') || s.includes('class')) return 'activity';
  return 'other';
}
