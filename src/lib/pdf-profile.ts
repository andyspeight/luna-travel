/**
 * Per-agency PDF-import "training" profiles — server-only.
 *
 * A repeat client tends to send the same PDF layout every time, so we store a
 * profile per agency and feed it back into extraction:
 *   - `hints`: admin-editable, layout-specific guidance ("dates are DD/MM/YYYY,
 *     the lead is labelled 'Lead Pax', board appears as 'Meal Plan'").
 *   - `examples`: confirmed-correct bookings, captured automatically when an
 *     admin reviews and SAVES an imported booking. Each carries the diff of what
 *     the admin changed vs the raw extraction, so the profile literally learns
 *     from corrections.
 *
 * lib/booking-extract injects hints + the most recent examples into the
 * extraction call, so a known layout is read consistently — while an unseen
 * layout still gets the generic best-effort path. Stored in
 * luna_travel.pdf_extraction_profiles (one row per agency; service-role only).
 */

import { getSupabaseAdmin } from '@/lib/supabase';

const REC_ID_RE = /^rec[A-Za-z0-9]{14}$/;
const MAX_EXAMPLES = 10; // how many we retain per agency
const FEWSHOT_EXAMPLES = 2; // how many we inject into a given extraction
const MAX_HINTS = 4000;

/** The comparable draft shape — a subset of the Add-booking form (no photos). */
export interface ProfileDraft {
  leadFirstName?: string;
  leadLastName?: string;
  leadEmail?: string;
  destinationLabel?: string;
  countryCode?: string;
  reference?: string;
  flights?: Record<string, unknown>[];
  hotels?: Record<string, unknown>[];
  experiences?: Record<string, unknown>[];
}

interface ProfileExample {
  at: string; // ISO
  reference: string;
  source: string; // detected layout/issuer label, '' if unknown
  corrected: ProfileDraft; // the admin-approved final
  editedFields: string[]; // what changed vs the raw extraction
}

/** What extraction consumes: hints + a few recent confirmed-correct examples. */
export interface ExtractionProfile {
  hints: string;
  examples: Array<{ source: string; corrected: ProfileDraft }>;
}

/** What the admin UI shows. */
export interface ProfileSummary {
  hints: string;
  bookingsLearned: number;
  exampleCount: number;
  lastLearnedAt: string | null;
  sources: string[];
}

/** Read the profile for injection into an extraction call (null = nothing useful). */
export async function getExtractionProfile(agencyId: string): Promise<ExtractionProfile | null> {
  if (!REC_ID_RE.test(agencyId)) return null;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pdf_extraction_profiles')
    .select('hints, examples')
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (error || !data) return null;

  const hints = typeof data.hints === 'string' ? data.hints.trim() : '';
  const all: ProfileExample[] = Array.isArray(data.examples) ? (data.examples as ProfileExample[]) : [];
  const examples = all
    .slice(0, FEWSHOT_EXAMPLES)
    .filter((e) => e && e.corrected)
    .map((e) => ({ source: e.source || '', corrected: e.corrected }));
  if (!hints && examples.length === 0) return null;
  return { hints, examples };
}

/** Summary for the admin UI. */
export async function getProfileSummary(agencyId: string): Promise<ProfileSummary> {
  const empty: ProfileSummary = { hints: '', bookingsLearned: 0, exampleCount: 0, lastLearnedAt: null, sources: [] };
  if (!REC_ID_RE.test(agencyId)) return empty;
  const supabase = getSupabaseAdmin();
  const { data, error } = await supabase
    .from('pdf_extraction_profiles')
    .select('hints, examples, bookings_learned')
    .eq('agency_id', agencyId)
    .maybeSingle();
  if (error || !data) return empty;
  const examples: ProfileExample[] = Array.isArray(data.examples) ? (data.examples as ProfileExample[]) : [];
  const sources = Array.from(new Set(examples.map((e) => (e.source || '').trim()).filter(Boolean)));
  return {
    hints: typeof data.hints === 'string' ? data.hints : '',
    bookingsLearned: Number(data.bookings_learned) || 0,
    exampleCount: examples.length,
    lastLearnedAt: examples[0]?.at || null,
    sources,
  };
}

/** Admin edits the layout hints. */
export async function setProfileHints(agencyId: string, hints: string): Promise<boolean> {
  if (!REC_ID_RE.test(agencyId)) return false;
  const supabase = getSupabaseAdmin();
  const { error } = await supabase
    .from('pdf_extraction_profiles')
    .upsert(
      { agency_id: agencyId, hints: (hints || '').slice(0, MAX_HINTS), updated_at: new Date().toISOString() },
      { onConflict: 'agency_id' },
    );
  if (error) {
    console.error('[pdf-profile] setProfileHints failed:', error.message);
    return false;
  }
  return true;
}

/**
 * Fold a reviewed-and-saved import into the agency's profile: store the final as
 * a confirmed-correct example (with the diff vs the raw extraction) and bump the
 * learned counter. Best-effort — callers must not let a failure here break the
 * booking save.
 */
export async function recordImportCorrection(
  agencyId: string,
  imported: ProfileDraft,
  finalDraft: ProfileDraft,
  meta: { reference: string; source?: string },
): Promise<void> {
  if (!REC_ID_RE.test(agencyId)) return;
  const supabase = getSupabaseAdmin();

  const { data } = await supabase
    .from('pdf_extraction_profiles')
    .select('examples, bookings_learned')
    .eq('agency_id', agencyId)
    .maybeSingle();

  const example: ProfileExample = {
    at: new Date().toISOString(),
    reference: meta.reference || '',
    source: (meta.source || '').slice(0, 120),
    corrected: stripDraft(finalDraft),
    editedFields: diffDrafts(imported, finalDraft),
  };
  const existing: ProfileExample[] = Array.isArray(data?.examples) ? (data!.examples as ProfileExample[]) : [];
  const examples = [example, ...existing].slice(0, MAX_EXAMPLES);
  const bookingsLearned = (Number(data?.bookings_learned) || 0) + 1;

  const { error } = await supabase
    .from('pdf_extraction_profiles')
    .upsert(
      { agency_id: agencyId, examples, bookings_learned: bookingsLearned, updated_at: new Date().toISOString() },
      { onConflict: 'agency_id' },
    );
  if (error) console.error('[pdf-profile] recordImportCorrection failed:', error.message);
}

// ───────── diff (what the admin changed vs the raw extraction) ─────────

const SCALARS: Array<keyof ProfileDraft> = ['leadFirstName', 'leadLastName', 'leadEmail', 'destinationLabel', 'countryCode', 'reference'];

function diffDrafts(a: ProfileDraft, b: ProfileDraft): string[] {
  const out: string[] = [];
  for (const k of SCALARS) {
    if (norm(a[k]) !== norm(b[k])) out.push(k);
  }
  diffArray('flights', a.flights, b.flights, out);
  diffArray('hotels', a.hotels, b.hotels, out);
  diffArray('experiences', a.experiences, b.experiences, out);
  return out;
}

function diffArray(name: string, a: Record<string, unknown>[] = [], b: Record<string, unknown>[] = [], out: string[]): void {
  const n = Math.max(a.length, b.length);
  for (let i = 0; i < n; i++) {
    const ra = a[i];
    const rb = b[i];
    if (!ra && rb) { out.push(`${name}[${i}] added`); continue; }
    if (ra && !rb) { out.push(`${name}[${i}] removed`); continue; }
    const keys = new Set([...Object.keys(ra || {}), ...Object.keys(rb || {})]);
    for (const key of keys) {
      if (norm((ra || {})[key]) !== norm((rb || {})[key])) out.push(`${name}[${i}].${key}`);
    }
  }
}

function norm(v: unknown): string {
  return v == null ? '' : String(v).trim();
}

/** Keep only the comparable fields (drop photos / stray keys) before storing. */
function stripDraft(d: ProfileDraft): ProfileDraft {
  const pick = (rows: Record<string, unknown>[] | undefined, keys: string[]) =>
    (rows || []).map((r) => {
      const o: Record<string, unknown> = {};
      for (const k of keys) if (r[k] !== undefined) o[k] = r[k];
      return o;
    });
  return {
    leadFirstName: d.leadFirstName,
    leadLastName: d.leadLastName,
    leadEmail: d.leadEmail,
    destinationLabel: d.destinationLabel,
    countryCode: d.countryCode,
    reference: d.reference,
    flights: pick(d.flights, ['carrierCode', 'flightNumber', 'fromIata', 'toIata', 'departAt', 'arriveAt', 'cabin']),
    hotels: pick(d.hotels, ['name', 'city', 'country', 'checkIn', 'checkOut', 'board']),
    experiences: pick(d.experiences, ['kind', 'title', 'supplier', 'location', 'startAt', 'endAt', 'notes']),
  };
}
