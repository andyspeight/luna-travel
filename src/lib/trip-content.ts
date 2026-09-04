/**
 * Trip content — agency-authored pages shown in the traveller app.
 *
 * Three page types, stored as one luna_travel.trip_content row per
 * (agency, booking, page) with an ordered jsonb `items` array:
 *
 *   before-you-travel — accordion entries { id, title, body }
 *   itinerary         — accordion entries { id, title, body }
 *   find-your-way     — map places { id, name, description, lat, lng, category }
 *
 * booking_ref '' is the agency-level DEFAULT scope: the traveller API falls
 * back to it for before-you-travel when the booking has no page of its own
 * (visa/packing advice is destination-generic; an itinerary never is).
 *
 * Everything that reaches the database goes through sanitizeItems() — inputs
 * are trimmed, capped and shape-checked server-side; anything malformed is
 * rejected rather than coerced silently past the caps
 * (travelgenix-security rule 3/7).
 */

export const TRIP_CONTENT_PAGES = ['before-you-travel', 'itinerary', 'find-your-way'] as const;
export type TripContentPage = (typeof TRIP_CONTENT_PAGES)[number];

export function isTripContentPage(v: unknown): v is TripContentPage {
  return typeof v === 'string' && (TRIP_CONTENT_PAGES as readonly string[]).includes(v);
}

export interface AccordionItem {
  id: string;
  title: string;
  body: string;
}

export const PLACE_CATEGORIES = ['sight', 'food', 'beach', 'shop', 'practical', 'other'] as const;
export type PlaceCategory = (typeof PLACE_CATEGORIES)[number];

export interface PlaceItem {
  id: string;
  name: string;
  description: string;
  lat: number;
  lng: number;
  category: PlaceCategory;
}

export type TripContentItem = AccordionItem | PlaceItem;

/** The complete content payload for one booking, keyed by page. */
export type TripContentPages = {
  'before-you-travel': AccordionItem[];
  itinerary: AccordionItem[];
  'find-your-way': PlaceItem[];
};

export const EMPTY_TRIP_CONTENT: TripContentPages = {
  'before-you-travel': [],
  itinerary: [],
  'find-your-way': [],
};

// Caps — generous for real content, tight enough that nobody can store a novel.
const MAX_ITEMS = 50;
const MAX_TITLE = 160;
const MAX_BODY = 6000;
const MAX_NAME = 120;
const MAX_DESC = 1000;

const ID_RE = /^[A-Za-z0-9-]{1,40}$/;

function cleanId(v: unknown): string {
  // globalThis.crypto exists in Node 18.17+ and every target browser, so this
  // file stays importable from client components (types + constants only there).
  return typeof v === 'string' && ID_RE.test(v) ? v : globalThis.crypto.randomUUID();
}

function cleanStr(v: unknown, max: number): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function cleanCoord(v: unknown, min: number, max: number): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' ? Number(v) : NaN;
  if (!Number.isFinite(n) || n < min || n > max) return null;
  return Math.round(n * 1e6) / 1e6;
}

/**
 * Validate and normalise a raw items array for a page. Returns the cleaned
 * array, or null when the input is not an array or exceeds the item cap.
 * Individual entries that are unusable (no title / no name / bad coords) are
 * dropped — an agent deleting a title mid-edit shouldn't 400 the whole save.
 */
export function sanitizeItems(page: TripContentPage, raw: unknown): TripContentItem[] | null {
  if (!Array.isArray(raw) || raw.length > MAX_ITEMS) return null;

  if (page === 'find-your-way') {
    const out: PlaceItem[] = [];
    for (const r of raw) {
      if (typeof r !== 'object' || r === null) continue;
      const o = r as Record<string, unknown>;
      const name = cleanStr(o.name, MAX_NAME);
      const lat = cleanCoord(o.lat, -90, 90);
      const lng = cleanCoord(o.lng, -180, 180);
      if (!name || lat === null || lng === null) continue;
      const cat = typeof o.category === 'string' && (PLACE_CATEGORIES as readonly string[]).includes(o.category)
        ? (o.category as PlaceCategory)
        : 'other';
      out.push({ id: cleanId(o.id), name, description: cleanStr(o.description, MAX_DESC), lat, lng, category: cat });
    }
    return out;
  }

  const out: AccordionItem[] = [];
  for (const r of raw) {
    if (typeof r !== 'object' || r === null) continue;
    const o = r as Record<string, unknown>;
    const title = cleanStr(o.title, MAX_TITLE);
    if (!title) continue;
    out.push({ id: cleanId(o.id), title, body: cleanStr(o.body, MAX_BODY) });
  }
  return out;
}

/** Booking references as they appear across the app (Travelify + LT-manual). */
const BOOKING_REF_RE = /^[A-Za-z0-9][A-Za-z0-9_-]{0,39}$/;

export function isValidBookingRef(v: unknown): v is string {
  return typeof v === 'string' && BOOKING_REF_RE.test(v);
}
