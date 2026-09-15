#!/usr/bin/env node
/**
 * Regenerates src/data/destination-places.ts — the static resolution index that
 * maps a booking to an Airtable destination-content record with no network call.
 *
 * Run it the same way as "regenerate the hero locations":
 *
 *   AIRTABLE_KEY=pat... node scripts/regenerate-destination-places.mjs
 *
 * Options (both optional):
 *   --out=<path>          write somewhere else, e.g. to diff before committing
 *   --generated-at=<iso>  pin GENERATED_AT; everything else is already
 *                         deterministic, so this makes a re-run byte-identical
 *
 * It prints a REPORT to stdout — unmatched parks, dropped rows, slug collisions —
 * and exits non-zero on anything that would put a guessed value in the index.
 *
 * WHY A SCRIPT AND NOT A RUNTIME LOOKUP: resolution sits on the booking-build
 * path (order-to-booking.ts, location-match.ts, hero.ts), all of which are
 * documented pure and synchronous. The expensive half of "which record is this?"
 * is therefore paid once, here, for everyone.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const HERE = dirname(fileURLToPath(import.meta.url));
const REPO = resolve(HERE, '..');

const AIRTABLE_V0 = 'https://api.airtable.com/v0';
const BASE = 'appuZdlMJ7HKUt6qS';

/**
 * Field IDs, not names: the content team renames columns, and a rename must not
 * silently empty this index. Fetched with returnFieldsByFieldId=true.
 */
const TABLES = {
  countries: {
    id: 'tblsxbqbyhTDoWhbo',
    name: 'flddJJrpwcXOwWIow',
    slug: 'fldDwZVR1C63K4HGT',
    status: 'fldCpclokepeFkQZ2',
    tags: 'fldC5ZvX1hitoxWY6',
    lat: 'fldlxsWrbmU6ELUPW',
    lng: 'fldz3whFdzKsZ66hg',
  },
  cities: {
    id: 'tblTkKujdVZgWPAQe',
    name: 'fld2VkY61c1JKUWKB',
    slug: 'fldL6MlFZgZMW25Vp',
    status: 'fld8GKaD5SPycD4Ld',
    parent: 'fldmJaOJZcMFtJNZD',
    tags: 'fldZQTVNuqRXHileW',
    lat: 'fldjk3yUCbVQRuxx8',
    lng: 'fldNSlAA0Qb1akknz',
    latAlt: 'fldLDQj6e1K4lq3tT',
    lngAlt: 'fld2pa6AKkU6dIq7O',
  },
  resorts: {
    id: 'tblwV9gnbVEyZ99gI',
    name: 'fldnvOipaWpG3W1rx',
    slug: 'fldwVxLg8V4CBi90B',
    status: 'fldTQcZWJ21MahuCF',
    parent: 'fldrUx3VrEMJPheIP',
    tags: 'fldTmH3gT1wT48PLn',
    lat: 'fld4INRwIKWCG21RV',
    lng: 'fldd8CwfdzCDhW68w',
    latAlt: 'flda4Fa7bBj6Nf850',
    lngAlt: 'fldpXXwrWplV7DiKN',
  },
  parks: {
    id: 'tblhVDUdpwaLabDmQ',
    name: 'fldboK0kstNohXgqJ',
    status: 'fldSMqzRfIwIcodgS',
    country: 'fldlx9YGIZQ797rem',
    location: 'fldyoIhTvHu2NI3gn',
    lat: 'fldxmLHlNM0GYndlb',
    lng: 'fldywVEVFPKDZgXWn',
    nearestTown: 'fldyh0d8etOmfwGIE',
  },
};

/** Places ship on Live alone. Parks differ — every Orlando row is 'Published',
 *  and a 'Live'-only filter returns zero parks. */
const PLACE_LIVE = new Set(['Live']);
const PARK_LIVE = new Set(['Live', 'Published']);

/**
 * Country names the Airtable roster spells differently from hero-destinations.ts.
 * Nothing here is inferred: every entry was checked against the ISO-2 roster by
 * hand. An unmapped Live country hard-fails rather than shipping a guess.
 */
const COUNTRY_ISO_OVERRIDES = {
  'USA': 'US',
  'United States': 'US',
  'United States of America': 'US',
  'UK': 'GB',
  'Great Britain': 'GB',
  'England': 'GB',
  'Scotland': 'GB',
  'Wales': 'GB',
  'Northern Ireland': 'GB',
  'UAE': 'AE',
  'Czech Republic': 'CZ',
  'South Korea': 'KR',
  'North Macedonia': 'MK',
  'Hong Kong': 'HK',
  'Macau': 'MO',
  'The Gambia': 'GM',
  'Cape Verde': 'CV',
  'Curacao': 'CW',
  'Ivory Coast': 'CI',
  'Antigua': 'AG',
  'Tobago': 'TT',
  'Trinidad': 'TT',
  'St Lucia': 'LC',
  'St Kitts & Nevis': 'KN',
  'St Vincent & the Grenadines': 'VC',
  'Turks & Caicos': 'TC',
  'Vatican City': 'VA',
  'Burma': 'MM',
  'East Timor': 'TL',
  'Swaziland': 'SZ',
};

/* ── pure helpers ─────────────────────────────────────────────────────────── */

/** Byte-identical to normPlace()/the private norm() in location-match.ts. */
export function norm(s) {
  return (s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/&/g, ' ')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Theme Parks has no URL Slug column, so park slugs are assigned here.
 *  Apostrophes collapse rather than split, or Knott's becomes "knott-s". */
export function slugify(s) {
  return norm((s || '').replace(/['’]/g, '')).replace(/\s+/g, '-');
}

function str(v) {
  if (v === null || v === undefined) return '';
  if (Array.isArray(v)) return '';
  return String(v).trim();
}

/** A multipleRecordLinks cell. The REST v0 API returns an ARRAY OF RECORD ID
 *  STRINGS, not {id,name} objects — pointing str() at one renders the id. */
function linkIds(v) {
  if (!Array.isArray(v)) return [];
  return v.filter((x) => typeof x === 'string' && /^rec[A-Za-z0-9]{14}$/.test(x));
}

function tagList(v) {
  if (!Array.isArray(v)) return [];
  return v.map((x) => (typeof x === 'string' ? x.trim() : '')).filter(Boolean);
}

function num(...vals) {
  for (const v of vals) {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
  }
  return undefined;
}

export function haversineKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((aLat * Math.PI) / 180) * Math.cos((bLat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/* ── ISO-2 resolution ─────────────────────────────────────────────────────── */

/**
 * hero-destinations.ts carries all 249 ISO-2 codes with display names and is
 * already in the repo, so the Countries table needs no ISO column. Parsed as
 * text rather than imported because this is plain Node with no TS loader.
 */
export function readIsoMap(repoRoot) {
  const src = readFileSync(resolve(repoRoot, 'src/data/hero-destinations.ts'), 'utf8');
  const map = new Map();
  const re = /\{\s*code:\s*['"]([A-Z]{2})['"]\s*,\s*name:\s*['"]((?:[^'"\\]|\\.)*)['"]\s*\}/g;
  for (const m of src.matchAll(re)) map.set(norm(m[2].replace(/\\(.)/g, '$1')), m[1]);
  if (map.size < 200) throw new Error(`hero-destinations.ts parsed to only ${map.size} codes`);
  return map;
}

/**
 * The roster of city slugs that actually have an uploaded hero. /admin/heroes
 * validates uploads through isKnownLocation(), so this file IS the list of
 * destination-heroes/{CODE}/{slug}/landscape.webp objects that exist — the
 * Supabase bucket cannot be listed from here, and a speculative runtime request
 * that 404s is exactly what hasHero exists to prevent.
 */
export function readHeroLocations(repoRoot) {
  const src = readFileSync(resolve(repoRoot, 'src/data/hero-locations.ts'), 'utf8');
  const set = new Set();
  const re = /\{\s*code:\s*['"]([A-Z]{2})['"]\s*,\s*slug:\s*['"]([a-z0-9-]+)['"]/g;
  for (const m of src.matchAll(re)) set.add(`${m[1]}|${m[2]}`);
  if (set.size < 100) throw new Error(`hero-locations.ts parsed to only ${set.size} locations`);
  return set;
}

function isoFor(name, isoMap) {
  const override = COUNTRY_ISO_OVERRIDES[name] || COUNTRY_ISO_OVERRIDES[name.trim()];
  if (override) return override;
  return isoMap.get(norm(name));
}

/* ── index construction ───────────────────────────────────────────────────── */

/** Extra exact-match keys beyond normPlace(name) and slug, which resolvePlaceRef
 *  already tests directly. "Palm Beach & Eagle Beach" also answers to
 *  "palm beach"; "costa-del-sol" also answers to "costa del sol". */
function aliasesFor(name, slug) {
  const out = new Set();
  const deslug = norm(slug.replace(/-/g, ' '));
  if (deslug) out.add(deslug);
  for (const part of name.split(/[&,/]/)) {
    const n = norm(part);
    if (n.length >= 3) out.add(n);
    const dropThe = norm(part.replace(/\bthe\b/gi, ''));
    if (dropThe.length >= 3) out.add(dropThe);
  }
  out.delete(norm(name));
  out.delete(slug);
  return Array.from(out).sort();
}

/**
 * Builds the whole index from four already-fetched record arrays. Pure, so the
 * emitted file can be reproduced from a capture without hitting Airtable.
 */
export function buildIndex(tables, { isoMap, heroSlugs }) {
  const report = {
    droppedCountries: [],
    droppedCities: [],
    droppedResorts: [],
    unmappedCountries: [],
    slugCollisions: [],
    unmatchedParks: [],
    ambiguousParks: [],
    coordJoinedParks: [],
    countryJoinedParks: [],
    parksWithoutIso: [],
  };

  const F = TABLES;

  /* Countries. */
  const countryById = new Map();
  const places = [];
  for (const rec of tables.countries) {
    if (!PLACE_LIVE.has(str(rec.fields[F.countries.status]))) continue;
    const name = str(rec.fields[F.countries.name]);
    const slug = str(rec.fields[F.countries.slug]) || slugify(name);
    if (!name || !slug) {
      report.droppedCountries.push(`${rec.id} (missing name or slug)`);
      continue;
    }
    const code = isoFor(name, isoMap);
    if (!code) {
      report.unmappedCountries.push(`${name} (${rec.id})`);
      continue;
    }
    const row = {
      tier: 'country',
      id: rec.id,
      slug,
      name,
      code,
      parentId: '',
      aliases: aliasesFor(name, slug),
      tags: tagList(rec.fields[F.countries.tags]),
      lat: num(rec.fields[F.countries.lat]),
      lng: num(rec.fields[F.countries.lng]),
      hasHero: heroSlugs.has(`${code}|${slug}`),
    };
    countryById.set(rec.id, row);
    places.push(row);
  }

  /* Cities — code denormalised down from the linked country. */
  const cityById = new Map();
  for (const rec of tables.cities) {
    if (!PLACE_LIVE.has(str(rec.fields[F.cities.status]))) continue;
    const name = str(rec.fields[F.cities.name]);
    const slug = str(rec.fields[F.cities.slug]) || slugify(name);
    const parentId = linkIds(rec.fields[F.cities.parent])[0] || '';
    const parent = countryById.get(parentId);
    if (!name || !slug || !parent) {
      report.droppedCities.push(`${name || rec.id} (${!parent ? 'no Live country link' : 'missing name or slug'})`);
      continue;
    }
    const row = {
      tier: 'city',
      id: rec.id,
      slug,
      name,
      code: parent.code,
      parentId,
      aliases: aliasesFor(name, slug),
      tags: tagList(rec.fields[F.cities.tags]),
      lat: num(rec.fields[F.cities.lat], rec.fields[F.cities.latAlt]),
      lng: num(rec.fields[F.cities.lng], rec.fields[F.cities.lngAlt]),
      hasHero: heroSlugs.has(`${parent.code}|${slug}`),
    };
    cityById.set(rec.id, row);
    places.push(row);
  }

  /* Resorts — two hops from the country, so the ISO code on the row is
   * structural and a false cross-country match is impossible at runtime. */
  for (const rec of tables.resorts) {
    if (!PLACE_LIVE.has(str(rec.fields[F.resorts.status]))) continue;
    const name = str(rec.fields[F.resorts.name]);
    const slug = str(rec.fields[F.resorts.slug]) || slugify(name);
    const parentId = linkIds(rec.fields[F.resorts.parent])[0] || '';
    const parent = cityById.get(parentId);
    if (!name || !slug || !parent) {
      report.droppedResorts.push(`${name || rec.id} (${!parent ? 'no Live city link' : 'missing name or slug'})`);
      continue;
    }
    places.push({
      tier: 'resort',
      id: rec.id,
      slug,
      name,
      code: parent.code,
      parentId,
      aliases: aliasesFor(name, slug),
      tags: tagList(rec.fields[F.resorts.tags]),
      lat: num(rec.fields[F.resorts.lat], rec.fields[F.resorts.latAlt]),
      lng: num(rec.fields[F.resorts.lng], rec.fields[F.resorts.lngAlt]),
      hasHero: heroSlugs.has(`${parent.code}|${slug}`),
    });
  }

  /* A duplicate slug inside one country+tier makes resolvePlaceRef ambiguous,
   * and it resolves ties by falling back to the country tier — so a collision
   * silently coarsens a page. Fail instead. */
  const seen = new Map();
  for (const p of places) {
    const key = `${p.code}|${p.tier}|${p.slug}`;
    if (seen.has(key)) report.slugCollisions.push(`${key}: ${seen.get(key)} vs ${p.id}`);
    else seen.set(key, p.id);
  }

  /* Parks. The join is done here, once, so it is reviewable in a diff — a
   * runtime "Location starts with Orlando" test gets LEGOLAND wrong, which sits
   * in Winter Haven and belongs to Florida, not to Orlando. */
  const parks = [];
  const byCountry = new Map();
  for (const p of places) {
    if (!byCountry.has(p.code)) byCountry.set(p.code, []);
    byCountry.get(p.code).push(p);
  }

  for (const rec of tables.parks) {
    if (!PARK_LIVE.has(str(rec.fields[F.parks.status]))) continue;
    const name = str(rec.fields[F.parks.name]);
    if (!name) continue;
    const countryText = str(rec.fields[F.parks.country]);
    const code = isoFor(countryText, isoMap);
    if (!code) {
      report.parksWithoutIso.push(`${name} — country "${countryText}"`);
      continue;
    }
    const lat = num(rec.fields[F.parks.lat]);
    const lng = num(rec.fields[F.parks.lng]);
    const location = str(rec.fields[F.parks.location]);
    const nearest = str(rec.fields[F.parks.nearestTown]);

    const joined = joinParkToPlace(
      { name, lat, lng, location, nearest },
      byCountry.get(code) || [],
    );
    if (joined.ambiguous) report.ambiguousParks.push(`${name} — ${joined.ambiguous}`);
    if (joined.byCoords) report.coordJoinedParks.push(`${name} → ${joined.place.name} (${joined.place.tier})`);
    if (joined.countryOnly) report.countryJoinedParks.push(`${name} → ${joined.place.name} (no city or resort rows for ${code})`);
    if (!joined.place) report.unmatchedParks.push(`${name} (${code}) — Location "${location}"`);

    parks.push({
      id: rec.id,
      slug: slugify(name),
      name,
      code,
      aliases: aliasesFor(name, slugify(name)),
      placeId: joined.place ? joined.place.id : '',
      lat,
      lng,
    });
  }

  const parkSlugs = new Map();
  for (const p of parks) {
    if (parkSlugs.has(p.slug)) report.slugCollisions.push(`park ${p.slug}: ${parkSlugs.get(p.slug)} vs ${p.id}`);
    else parkSlugs.set(p.slug, p.id);
  }

  places.sort((a, b) => a.code.localeCompare(b.code) || tierRank(a) - tierRank(b) || a.slug.localeCompare(b.slug));
  parks.sort((a, b) => a.code.localeCompare(b.code) || a.slug.localeCompare(b.slug));

  return { places, parks, report };
}

function tierRank(p) {
  return p.tier === 'country' ? 0 : p.tier === 'city' ? 1 : 2;
}

/** A name match further than this from the park is not the same place. */
const PARK_JOIN_VETO_KM = 120;
/** No name match, but a real day trip: Parc Astérix is 35 km from the Paris row
 *  and belongs on a Paris booking. Beyond this the park is somewhere else. */
const PARK_JOIN_NEAR_KM = 60;

/**
 * Three passes, each one a corroborated fact rather than a guess.
 *
 * 1. Exact segment equality on Location, then on the first two segments of
 *    Nearest Town/City. "Winter Haven, Florida (between Orlando and Tampa)"
 *    yields "winter haven", "florida" and "between orlando and tampa" — none of
 *    which equals "orlando", which is the whole point: LEGOLAND belongs to
 *    Florida, and a runtime "Location contains Orlando" test gets it wrong.
 * 2. Coordinates alone, within PARK_JOIN_NEAR_KM.
 * 3. The country row, but only where the index holds nothing more specific for
 *    that country — every UK park is in this case, and the alternative is that
 *    they never surface at all.
 */
function joinParkToPlace(park, candidates) {
  const fromLocation = segments(park.location);
  const fromNearest = segments(park.nearest).slice(0, 2);

  for (const segs of [fromLocation, fromNearest]) {
    if (!segs.length) continue;
    const hits = [];
    for (const place of candidates) {
      const keys = new Set([norm(place.name), place.slug, norm(place.slug.replace(/-/g, ' ')), ...place.aliases]);
      if (!segs.some((s) => keys.has(s))) continue;
      if (farther(park, place, PARK_JOIN_VETO_KM)) continue;
      hits.push(place);
    }
    const picked = mostSpecific(park, hits);
    if (picked.place || picked.ambiguous) return picked;
  }

  if (park.lat !== undefined && park.lng !== undefined) {
    /* City tier only. A resort row is a neighbourhood — its centroid says
     * nothing useful about a park 30 km away, and "Parc Astérix, Left Bank &
     * Montmartre" is a worse answer than "Parc Astérix, Paris". */
    const near = candidates.filter(
      (p) =>
        p.tier === 'city' &&
        p.lat !== undefined &&
        p.lng !== undefined &&
        haversineKm(park.lat, park.lng, p.lat, p.lng) <= PARK_JOIN_NEAR_KM,
    );
    const picked = mostSpecific(park, near);
    if (picked.place) return { place: picked.place, byCoords: true };
  }

  const country = candidates.find((p) => p.tier === 'country');
  if (country && !candidates.some((p) => p.tier !== 'country')) return { place: country, countryOnly: true };

  return { place: null };
}

/** Most specific tier that matched, ties broken by distance. Two same-tier
 *  candidates with no coordinates to separate them are an ambiguity, not a
 *  coin toss — they go in the report and the park stays unjoined. */
function mostSpecific(park, hits) {
  if (!hits.length) return { place: null };
  const best = Math.max(...hits.map(tierRank));
  const tied = hits.filter((h) => tierRank(h) === best);
  if (tied.length === 1) return { place: tied[0] };
  if (park.lat !== undefined && park.lng !== undefined) {
    const located = tied.filter((h) => h.lat !== undefined && h.lng !== undefined);
    if (located.length) {
      located.sort(
        (a, b) =>
          haversineKm(park.lat, park.lng, a.lat, a.lng) - haversineKm(park.lat, park.lng, b.lat, b.lng),
      );
      return { place: located[0], ambiguous: `${tied.length} candidates, took nearest (${located[0].name})` };
    }
  }
  return { place: null, ambiguous: `${tied.length} candidates with no coordinates to separate them` };
}

function farther(park, place, km) {
  return (
    park.lat !== undefined && park.lng !== undefined &&
    place.lat !== undefined && place.lng !== undefined &&
    haversineKm(park.lat, park.lng, place.lat, place.lng) > km
  );
}

function segments(text) {
  return text
    .split(/[,()/;]|\bnear\b|\bbetween\b/i)
    .map((s) => norm(s))
    .filter((s) => s.length >= 3);
}

/* ── emit ─────────────────────────────────────────────────────────────────── */

const q = (s) => JSON.stringify(s);
const arr = (a) => `[${a.map(q).join(',')}]`;

function placeLine(p) {
  const bits = [
    `tier:${q(p.tier)}`,
    `id:${q(p.id)}`,
    `slug:${q(p.slug)}`,
    `name:${q(p.name)}`,
    `code:${q(p.code)}`,
    `parentId:${q(p.parentId)}`,
    `aliases:${arr(p.aliases)}`,
    `tags:${arr(p.tags)}`,
  ];
  if (p.lat !== undefined) bits.push(`lat:${p.lat}`);
  if (p.lng !== undefined) bits.push(`lng:${p.lng}`);
  bits.push(`hasHero:${p.hasHero}`);
  return `  { ${bits.join(', ')} },`;
}

function parkLine(p) {
  const bits = [
    `id:${q(p.id)}`,
    `slug:${q(p.slug)}`,
    `name:${q(p.name)}`,
    `code:${q(p.code)}`,
    `aliases:${arr(p.aliases)}`,
    `placeId:${q(p.placeId)}`,
  ];
  if (p.lat !== undefined) bits.push(`lat:${p.lat}`);
  if (p.lng !== undefined) bits.push(`lng:${p.lng}`);
  return `  { ${bits.join(', ')} },`;
}

export function renderModule({ places, parks }, generatedAt) {
  const counts = {
    country: places.filter((p) => p.tier === 'country').length,
    city: places.filter((p) => p.tier === 'city').length,
    resort: places.filter((p) => p.tier === 'resort').length,
  };
  const joined = parks.filter((p) => p.placeId).length;
  const heroes = places.filter((p) => p.hasHero).length;

  return `/**
 * GENERATED FILE — do not hand-edit.
 *
 * Regenerate with:
 *   AIRTABLE_KEY=pat... node scripts/regenerate-destination-places.mjs
 *
 * Source: Airtable base ${BASE} ("Destination content"), read at ${generatedAt}.
 * Status = Live for places; Live or Published for theme parks, because every
 * Orlando park row is Published and a Live-only filter returns none of them.
 *
 * Records per tier:
 *   countries ${counts.country}
 *   cities    ${counts.city}
 *   resorts   ${counts.resort}
 *   parks     ${parks.length} (${joined} joined to a place)
 *   hasHero   ${heroes}
 *
 * ISO-2 codes are resolved at generation time from src/data/hero-destinations.ts
 * plus an explicit override map in the script, and denormalised onto every city,
 * resort and park row — so a runtime match can never cross a country border.
 *
 * hasHero mirrors src/data/hero-locations.ts, which is the roster /admin/heroes
 * validates uploads against and therefore the list of
 * destination-heroes/{CODE}/{slug}/landscape.webp objects that exist. It is
 * false at country tier (a country hero lives at {CODE}/, not {CODE}/{slug}/)
 * and almost always false at resort tier, since only city slugs can be uploaded
 * today — which is why an Orlando booking shows the Florida photograph.
 */

import type { PlaceTier } from '@/types/destination-content';

export interface IndexPlace {
  tier: PlaceTier;
  /** Airtable record id — the runtime read key. */
  id: string;
  slug: string;
  /** Primary field: Resort/Area | City/Region | Country. */
  name: string;
  /** ISO-2, resolved at generation time. */
  code: string;
  /** Airtable record id of the parent tier; '' at country tier. */
  parentId: string;
  /** Pre-normalised extra match keys (lowercase, punctuation stripped). */
  aliases: string[];
  /** "Best For Tags", verbatim — lets similarity run with no extra fetch. */
  tags: string[];
  lat?: number;
  lng?: number;
  /** destination-heroes/{CODE}/{slug}/landscape.webp existed at generation
   *  time AND isKnownLocation(code, slug) was true. Drives the ancestor walk;
   *  never a speculative runtime request. */
  hasHero: boolean;
}

export interface IndexPark {
  id: string;
  slug: string;
  name: string;
  code: string;
  aliases: string[];
  /** Airtable record id of the place this park was joined to, offline. */
  placeId: string;
  lat?: number;
  lng?: number;
}

export const PLACE_INDEX: IndexPlace[] = [
${places.map(placeLine).join('\n')}
];

export const PARK_INDEX: IndexPark[] = [
${parks.map(parkLine).join('\n')}
];

export const GENERATED_AT = ${q(generatedAt)};

/* Derived lookups. Built once at module load rather than emitted, so the maps
 * cannot drift from the arrays above. */

export const PLACES_BY_COUNTRY: Record<string, IndexPlace[]> = PLACE_INDEX.reduce(
  (acc, place) => {
    (acc[place.code] ||= []).push(place);
    return acc;
  },
  {} as Record<string, IndexPlace[]>,
);

export const PLACE_BY_ID: Record<string, IndexPlace> = PLACE_INDEX.reduce(
  (acc, place) => {
    acc[place.id] = place;
    return acc;
  },
  {} as Record<string, IndexPlace>,
);

/** placeId → park record ids joined to it. Parks the generator could not join
 *  carry placeId '' and are deliberately absent. */
export const PARKS_BY_PLACE: Record<string, string[]> = PARK_INDEX.reduce(
  (acc, park) => {
    if (park.placeId) (acc[park.placeId] ||= []).push(park.id);
    return acc;
  },
  {} as Record<string, string[]>,
);

export const PARK_BY_SLUG: Record<string, IndexPark> = PARK_INDEX.reduce(
  (acc, park) => {
    acc[park.slug] = park;
    return acc;
  },
  {} as Record<string, IndexPark>,
);
`;
}

/* ── fetch ────────────────────────────────────────────────────────────────── */

async function listAll(tableId, fieldIds, key) {
  const out = [];
  let offset;
  do {
    const url = new URL(`${AIRTABLE_V0}/${BASE}/${tableId}`);
    url.searchParams.set('pageSize', '100');
    url.searchParams.set('returnFieldsByFieldId', 'true');
    for (const f of fieldIds) url.searchParams.append('fields[]', f);
    if (offset) url.searchParams.set('offset', offset);

    const res = await fetch(url, { headers: { Authorization: `Bearer ${key}` } });
    if (!res.ok) throw new Error(`${tableId}: ${res.status} ${await res.text()}`);
    const json = await res.json();
    out.push(...json.records);
    offset = json.offset;
    /* Airtable allows 5 req/s/base and the Luna Chat widget shares this quota. */
    if (offset) await new Promise((r) => setTimeout(r, 250));
  } while (offset);
  return out;
}

function fieldsOf(spec) {
  return Object.entries(spec).filter(([k]) => k !== 'id').map(([, v]) => v);
}

export async function fetchTables(key) {
  const [countries, cities, resorts, parks] = await Promise.all([
    listAll(TABLES.countries.id, fieldsOf(TABLES.countries), key),
    listAll(TABLES.cities.id, fieldsOf(TABLES.cities), key),
    listAll(TABLES.resorts.id, fieldsOf(TABLES.resorts), key),
    listAll(TABLES.parks.id, fieldsOf(TABLES.parks), key),
  ]);
  return { countries, cities, resorts, parks };
}

/* ── report ───────────────────────────────────────────────────────────────── */

export function printReport({ places, parks, report }) {
  const counts = {
    country: places.filter((p) => p.tier === 'country').length,
    city: places.filter((p) => p.tier === 'city').length,
    resort: places.filter((p) => p.tier === 'resort').length,
  };
  console.log('\n── destination-places report ──');
  console.log(`countries : ${counts.country}`);
  console.log(`cities    : ${counts.city}`);
  console.log(`resorts   : ${counts.resort}`);
  console.log(`parks     : ${parks.length} (${parks.filter((p) => p.placeId).length} joined to a place)`);
  console.log(`hasHero   : ${places.filter((p) => p.hasHero).length}`);

  const section = (title, rows) => {
    if (!rows.length) return;
    console.log(`\n${title} (${rows.length}):`);
    for (const r of rows) console.log(`  - ${r}`);
  };
  section('Dropped countries', report.droppedCountries);
  section('Dropped cities', report.droppedCities);
  section('Dropped resorts', report.droppedResorts);
  section('Parks joined on coordinates alone', report.coordJoinedParks);
  section('Parks joined to their country (nothing more specific in the index)', report.countryJoinedParks);
  section('Parks with no place join', report.unmatchedParks);
  section('Parks joined from an ambiguous match', report.ambiguousParks);
  section('Parks whose country could not be mapped', report.parksWithoutIso);
  section('UNMAPPABLE LIVE COUNTRIES', report.unmappedCountries);
  section('SLUG COLLISIONS', report.slugCollisions);
}

/* ── entry point ──────────────────────────────────────────────────────────── */

async function main() {
  const args = Object.fromEntries(
    process.argv.slice(2).map((a) => {
      const [k, ...rest] = a.replace(/^--/, '').split('=');
      return [k, rest.join('=') || true];
    }),
  );
  const key = process.env.AIRTABLE_KEY;
  if (!key) {
    console.error('AIRTABLE_KEY is not set. Run: AIRTABLE_KEY=pat... node scripts/regenerate-destination-places.mjs');
    process.exit(1);
  }

  const isoMap = readIsoMap(REPO);
  const heroSlugs = readHeroLocations(REPO);
  const tables = await fetchTables(key);
  const index = buildIndex(tables, { isoMap, heroSlugs });

  const fatal = index.report.unmappedCountries.length + index.report.slugCollisions.length;
  if (fatal) {
    printReport(index);
    console.error('\nRefusing to write: the index would carry a guessed or ambiguous code.');
    console.error('Add the country to COUNTRY_ISO_OVERRIDES, or fix the duplicate slug in Airtable.');
    process.exit(1);
  }

  const generatedAt = typeof args['generated-at'] === 'string' ? args['generated-at'] : new Date().toISOString();
  const out = typeof args.out === 'string' ? resolve(args.out) : resolve(REPO, 'src/data/destination-places.ts');
  writeFileSync(out, renderModule(index, generatedAt));
  console.log(`Wrote ${out}`);
  printReport(index);
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
