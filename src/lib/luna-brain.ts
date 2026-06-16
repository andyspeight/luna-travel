/**
 * Luna Brain adapter — read-only.
 *
 * Reads verified destination knowledge from the Luna Brain Airtable base
 * (appPKx77relfeiqmq) — the single source of truth shared with the Luna Chat
 * widget. Server-only: uses AIRTABLE_KEY (the same key as src/lib/travelify.ts).
 * NEVER import this from a client component.
 *
 * Two unified tables are read (the same ones the Luna Chat widget queries):
 *   - Destinations: structured, verified facts per destination, including the
 *     date-aware "Best Months to Visit" and "Cheapest Time to Fly".
 *   - Knowledge: consumer-facing Q&A. Destination linkage is via the
 *     "Search Index" field (what the widget searches), NOT "Related To".
 *
 * Data-integrity (travelgenix-security): we only ever surface Consumer/Both
 * audience answers, carry each answer's Source + Confidence + Last Verified for
 * provenance, and flag FCDO-sensitive answers so the UI can caveat + link out.
 * Nothing is invented — a missing field simply hides that line.
 */

const BRAIN_BASE = 'appPKx77relfeiqmq';
const T_DESTINATIONS = 'tblirr0vJuQcTLuH2';
const T_KNOWLEDGE = 'tblgdLszaPmquxQ7O';
const AIRTABLE_V0 = 'https://api.airtable.com/v0';

/** True when the Airtable key is present. Lets callers fail soft (no key in
 *  local dev → the guide falls back to its static content). */
export function brainConfigured(): boolean {
  return !!process.env.AIRTABLE_KEY;
}

export interface BrainDestination {
  name: string;
  isoCode: string;
  currency?: string;
  capital?: string;
  languages?: string;
  timeZone?: string;
  diallingCode?: string;
  emergencyNumber?: string;
  drivingSide?: string;
  plugType?: string;
  voltage?: string;
  ukVisaRequired?: string;
  tapWaterSafe?: string;
  fcdoStatus?: string;
  bestMonths?: string;
  cheapestToFly?: string;
  monthlyFlightCosts?: string;
  vaccinations?: string;
  ukEmbassy?: string;
  lastVerified?: string;
}

export interface BrainAnswer {
  id: string;
  question: string;
  answer: string;
  category: string;
  confidence?: string;
  source?: string;
  seasonal: boolean;
  fcdoSensitive: boolean;
  lastVerified?: string;
}

export interface BrainGuide {
  destination: BrainDestination | null;
  byCategory: { category: string; items: BrainAnswer[] }[];
  forYourDates: {
    travelLabel: string;
    bestMonths?: string;
    cheapestToFly?: string;
    climate: BrainAnswer[];
  } | null;
  generatedAt: string;
}

// ───────── Airtable REST ─────────

type AirtableRecord = { id: string; fields: Record<string, unknown> };

async function brainGet(
  table: string,
  query: Record<string, string | string[]>,
): Promise<AirtableRecord[]> {
  const key = process.env.AIRTABLE_KEY;
  if (!key) throw new Error('AIRTABLE_KEY not set');

  const usp = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (Array.isArray(v)) v.forEach((x) => usp.append(k, x));
    else usp.append(k, v);
  }

  const url = `${AIRTABLE_V0}/${BRAIN_BASE}/${table}?${usp.toString()}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${key}` },
    // Destination knowledge changes rarely (Last Verified is ~monthly), so we
    // let Next cache the upstream call for a day rather than hit Airtable on
    // every request.
    next: { revalidate: 86400 },
  });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Luna Brain ${table} (${res.status}): ${body.slice(0, 200)}`);
  }
  const data = (await res.json()) as { records?: AirtableRecord[] };
  return Array.isArray(data.records) ? data.records : [];
}

/** Coerce any Airtable cell value to a trimmed display string. */
function str(v: unknown): string {
  if (v == null) return '';
  if (typeof v === 'string') return v.trim();
  if (typeof v === 'number') return String(v);
  if (Array.isArray(v)) return v.map(str).filter(Boolean).join(', ');
  if (typeof v === 'object') {
    const name = (v as { name?: unknown }).name;
    if (typeof name === 'string') return name.trim();
  }
  return '';
}

/** Airtable formula string literal — strip anything that could break the quote. */
function lit(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9 ]/g, '').trim();
}

// ───────── Reads ─────────

export async function getDestination(cc: string): Promise<BrainDestination | null> {
  const code = cc.toUpperCase().replace(/[^A-Z]/g, '');
  if (code.length !== 2) return null;

  const recs = await brainGet(T_DESTINATIONS, {
    filterByFormula: `AND({ISO Code}='${code}',{Type}='Country')`,
    maxRecords: '1',
    'fields[]': [
      'Name', 'ISO Code', 'Currency', 'Capital', 'Languages', 'Time Zone',
      'Dialling Code', 'Emergency Number', 'Driving Side', 'Plug Type', 'Voltage',
      'UK Visa Required', 'Tap Water Safe', 'FCDO Status', 'Best Months to Visit',
      'Vaccinations', 'Cheapest Time to Fly', 'Monthly Flight Costs GBP',
      'UK Embassy Info', 'Last Verified',
    ],
  });
  if (!recs.length) return null;
  const f = recs[0].fields;

  return {
    name: str(f['Name']),
    isoCode: str(f['ISO Code']),
    currency: str(f['Currency']) || undefined,
    capital: str(f['Capital']) || undefined,
    languages: str(f['Languages']) || undefined,
    timeZone: str(f['Time Zone']) || undefined,
    diallingCode: str(f['Dialling Code']) || undefined,
    emergencyNumber: str(f['Emergency Number']) || undefined,
    drivingSide: str(f['Driving Side']) || undefined,
    plugType: str(f['Plug Type']) || undefined,
    voltage: str(f['Voltage']) || undefined,
    ukVisaRequired: str(f['UK Visa Required']) || undefined,
    tapWaterSafe: str(f['Tap Water Safe']) || undefined,
    fcdoStatus: str(f['FCDO Status']) || undefined,
    bestMonths: str(f['Best Months to Visit']) || undefined,
    cheapestToFly: str(f['Cheapest Time to Fly']) || undefined,
    monthlyFlightCosts: str(f['Monthly Flight Costs GBP']) || undefined,
    vaccinations: str(f['Vaccinations']) || undefined,
    ukEmbassy: str(f['UK Embassy Info']) || undefined,
    lastVerified: str(f['Last Verified']) || undefined,
  };
}

export async function getKnowledge(tokens: string[]): Promise<BrainAnswer[]> {
  const clean = Array.from(
    new Set(tokens.map(lit).filter((t) => t.length >= 3)),
  );
  if (!clean.length) return [];

  // Match the destination on the *indexing* fields only (question, phrasings,
  // search index, related-to) — NOT the answer body. Matching the answer pulls
  // in generic Q&A that merely mention the place as an example ("how much does
  // a holiday cost?"), which is noise in a destination guide. Precise now;
  // recall grows automatically as Luna Brain's Search Index is populated.
  // Consumer-facing only (drop Agent-only rows).
  const SEARCH_FIELDS = ['Search Index', 'Question', 'Alt Phrasings', 'Related To'];
  const finds = clean
    .flatMap((t) => SEARCH_FIELDS.map((f) => `FIND('${t}',LOWER({${f}}))`))
    .join(',');
  const recs = await brainGet(T_KNOWLEDGE, {
    filterByFormula: `AND(NOT({Audience}='Agent'),OR(${finds}))`,
    maxRecords: '60',
    'fields[]': [
      'Question', 'Consumer Answer', 'Category', 'Confidence', 'Seasonal',
      'FCDO Sensitive', 'Source', 'Last Verified',
    ],
    'sort[0][field]': 'Last Verified',
    'sort[0][direction]': 'desc',
  });

  return recs
    .map((r) => ({
      id: r.id,
      question: str(r.fields['Question']),
      answer: str(r.fields['Consumer Answer']),
      category: str(r.fields['Category']),
      confidence: str(r.fields['Confidence']) || undefined,
      source: str(r.fields['Source']) || undefined,
      seasonal: !!r.fields['Seasonal'],
      fcdoSensitive: !!r.fields['FCDO Sensitive'],
      lastVerified: str(r.fields['Last Verified']) || undefined,
    }))
    .filter((a) => a.question && a.answer);
}

// ───────── Date helpers (the "time/date relevance" lens) ─────────

const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

/** A human label for the travel window, e.g. "August 2026" or
 *  "August – September 2026". Empty string if we can't read the dates. */
export function travelWindowLabel(fromIso?: string, toIso?: string): string {
  const from = fromIso ? new Date(fromIso) : null;
  if (!from || Number.isNaN(from.getTime())) return '';
  const to = toIso ? new Date(toIso) : null;
  const a = `${MONTHS[from.getUTCMonth()]} ${from.getUTCFullYear()}`;
  if (!to || Number.isNaN(to.getTime())) return a;
  if (to.getUTCMonth() === from.getUTCMonth() && to.getUTCFullYear() === from.getUTCFullYear()) {
    return a;
  }
  const sameYear = to.getUTCFullYear() === from.getUTCFullYear();
  const aShort = sameYear ? MONTHS[from.getUTCMonth()] : a;
  return `${aShort} – ${MONTHS[to.getUTCMonth()]} ${to.getUTCFullYear()}`;
}

// ───────── Composition ─────────

export async function getGuide(opts: {
  cc: string;
  tokens: string[];
  from?: string;
  to?: string;
}): Promise<BrainGuide> {
  const destination = await getDestination(opts.cc);

  // The destination's own name is a strong match token for the Q&A search.
  const tokens = [...opts.tokens];
  if (destination?.name) tokens.push(destination.name);
  const knowledge = await getKnowledge(tokens);

  const byCategory = groupByCategory(knowledge);

  // "For your dates" pulls the genuinely time-relevant material: the verified
  // best-months / cheapest-to-fly guidance plus any climate or seasonal Q&A.
  const climate = knowledge.filter(
    (a) => /climate|when to go/i.test(a.category) || a.seasonal,
  );
  const forYourDates =
    destination?.bestMonths || destination?.cheapestToFly || climate.length
      ? {
          travelLabel: travelWindowLabel(opts.from, opts.to),
          bestMonths: destination?.bestMonths,
          cheapestToFly: destination?.cheapestToFly,
          climate,
        }
      : null;

  return {
    destination,
    byCategory,
    forYourDates,
    generatedAt: new Date().toISOString(),
  };
}

function groupByCategory(items: BrainAnswer[]): { category: string; items: BrainAnswer[] }[] {
  const map = new Map<string, BrainAnswer[]>();
  for (const a of items) {
    const key = a.category || 'Good to know';
    const arr = map.get(key);
    if (arr) arr.push(a);
    else map.set(key, [a]);
  }
  return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
}
