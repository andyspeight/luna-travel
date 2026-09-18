/**
 * The packing list.
 *
 * Derived, never authored. Nobody writes 250 packing lists by hand and nobody
 * keeps them current; and a list written for "Greece" is wrong for Greece in
 * February. So this reads what the trip already knows — the months being
 * travelled, the climate for those months, what was booked, who is going, the
 * plug type — and builds the list from that.
 *
 * Pure. No dates of its own, no fetching, no randomness.
 *
 * Rule 8 in a slightly different key: this is advice rather than supplier data,
 * but it must never imply knowledge it lacks. With no climate figures there are
 * no weather lines at all — not "pack for mild weather", which would be a guess
 * dressed as a fact. The passport and the medication still apply everywhere, so
 * those stay.
 */

import type { ClimateBand } from '@/types/destination-content';
import type { TravellerType } from '@/types/booking';

export interface PackingItem {
  label: string;
  /** Why it is on the list. Only ever set from real figures. */
  note?: string;
}

export interface PackingGroup {
  title: string;
  items: PackingItem[];
}

export type TempBand = 'hot' | 'warm' | 'mild' | 'cool' | 'cold';

export interface PackingInput {
  /** ISO dates. Both required for any season awareness. */
  tripStart?: string;
  tripEnd?: string;
  climate?: ClimateBand | null;
  /** Place tags — "Beach", "Skiing", "Hiking", "Diving", "Golf", "City Break". */
  tags?: string[];
  /** "230V · Type F". Drives the adapter line, including whether one is needed. */
  voltageAndPlug?: string;
  travellerTypes?: TravellerType[];
  /** Any flight on the booking — drives the hand-luggage lines. */
  hasFlights?: boolean;
}

/** Month indexes (0-11) the trip covers, inclusive, capped at a year. */
export function monthsOfTrip(startIso?: string, endIso?: string): number[] {
  if (!startIso) return [];
  const start = new Date(startIso);
  if (Number.isNaN(start.getTime())) return [];
  const end = endIso ? new Date(endIso) : start;
  const last = Number.isNaN(end.getTime()) ? start : end;

  const months: number[] = [];
  const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
  const stop = new Date(last.getFullYear(), last.getMonth(), 1);
  while (cursor <= stop && months.length < 12) {
    months.push(cursor.getMonth());
    cursor.setMonth(cursor.getMonth() + 1);
  }
  return months.length ? months : [start.getMonth()];
}

/** Mean daytime high across the months travelled, or null with no figures. */
export function tripHighC(climate: ClimateBand | null | undefined, months: number[]): number | null {
  const temps = climate?.tempC;
  if (!temps || temps.length !== 12 || !months.length) return null;
  const values = months.map((m) => temps[m]).filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!values.length) return null;
  return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
}

/** Wettest month travelled, in mm, or null. */
export function tripRainMm(climate: ClimateBand | null | undefined, months: number[]): number | null {
  const rain = climate?.rainfallMm;
  if (!rain || rain.length !== 12 || !months.length) return null;
  const values = months.map((m) => rain[m]).filter((n) => typeof n === 'number' && !Number.isNaN(n));
  if (!values.length) return null;
  return Math.round(Math.max(...values));
}

export function tempBand(highC: number): TempBand {
  if (highC >= 28) return 'hot';
  if (highC >= 22) return 'warm';
  if (highC >= 15) return 'mild';
  if (highC >= 8) return 'cool';
  return 'cold';
}

/**
 * The plug line.
 *
 * A UK traveller needs an adapter everywhere except the Type G countries, and
 * telling somebody going to Malta to buy an adapter is how a list stops being
 * trusted. Type G plus anything else still needs one for the anything else.
 */
export function adapterItem(voltageAndPlug?: string): PackingItem | null {
  const raw = (voltageAndPlug || '').trim();
  if (!raw) return null;
  const types = raw.match(/Type\s+([A-Z](?:\/[A-Z])*)/i)?.[1] ?? '';
  if (!types) return null;
  const list = types.toUpperCase().split('/');
  if (list.length === 1 && list[0] === 'G') {
    return { label: 'No adapter needed', note: `Type G sockets, the same as home — ${raw}` };
  }
  return { label: 'Travel adapter', note: raw };
}

const TAG_ITEMS: Array<{ match: RegExp; group: string; items: PackingItem[] }> = [
  {
    match: /beach|summer sun|winter sun|diving|all-inclusive/i,
    group: 'For the beach',
    items: [
      { label: 'Swimwear — two sets, so one is always dry' },
      { label: 'Flip-flops or pool sliders' },
      { label: 'Beach towel', note: 'Many hotels lend them — worth checking before packing one' },
    ],
  },
  {
    match: /diving/i,
    group: 'For the beach',
    items: [{ label: 'Dive certification card and logbook' }],
  },
  {
    match: /skiing/i,
    group: 'On the slopes',
    items: [
      { label: 'Thermal base layers' },
      { label: 'Goggles and high-factor sun cream', note: 'Snow reflects most of the UV back at you' },
      { label: 'Helmet', note: 'Rentals have them, but a familiar fit is better' },
    ],
  },
  {
    match: /hiking|adventure|wildlife/i,
    group: 'On foot',
    items: [
      { label: 'Walking boots, already worn in' },
      { label: 'Daypack and a refillable water bottle' },
      { label: 'Blister plasters' },
    ],
  },
  { match: /golf/i, group: 'On the course', items: [{ label: 'Golf shoes and a glove' }] },
  {
    match: /city break|culture/i,
    group: 'For the city',
    items: [
      { label: 'Comfortable shoes you can walk all day in' },
      { label: 'A layer for the evening' },
    ],
  },
];

const CLOTHING: Record<TempBand, PackingItem[]> = {
  hot: [
    { label: 'Loose, light clothing — linen or cotton' },
    { label: 'Sun hat and sunglasses' },
    { label: 'High-factor sun cream' },
    { label: 'One long-sleeved layer', note: 'For air conditioning, and for covered sites' },
  ],
  warm: [
    { label: 'Light layers for the day' },
    { label: 'Sun cream and sunglasses' },
    { label: 'A jumper or jacket for the evening' },
  ],
  mild: [
    { label: 'Layers — it will not be the same temperature all day' },
    { label: 'A light waterproof' },
    { label: 'Closed shoes' },
  ],
  cool: [
    { label: 'A warm coat' },
    { label: 'Jumper or fleece layers' },
    { label: 'Scarf and gloves' },
  ],
  cold: [
    { label: 'Insulated coat' },
    { label: 'Thermal layers, hat and gloves' },
    { label: 'Waterproof boots with grip' },
  ],
};

function push(groups: Map<string, PackingItem[]>, title: string, items: PackingItem[]): void {
  const existing = groups.get(title) ?? [];
  for (const item of items) {
    if (!existing.some((e) => e.label === item.label)) existing.push(item);
  }
  groups.set(title, existing);
}

/**
 * Build the list.
 *
 * Order is deliberate: documents first, because that is the group that ruins a
 * holiday, and the one people check at the door.
 */
export function packingList(input: PackingInput): PackingGroup[] {
  const groups = new Map<string, PackingItem[]>();
  const months = monthsOfTrip(input.tripStart, input.tripEnd);
  const highC = tripHighC(input.climate, months);
  const rainMm = tripRainMm(input.climate, months);
  const tags = input.tags ?? [];
  const types = input.travellerTypes ?? [];

  // ── Documents — true of every trip, everywhere ──
  const documents: PackingItem[] = [
    { label: 'Passport', note: 'Check the expiry date against the rules for where you are going' },
    { label: 'Travel insurance details' },
    { label: 'Card you told your bank you would be using' },
  ];
  if (input.hasFlights) {
    documents.push({ label: 'Boarding passes', note: 'Saved offline as well as in the app' });
  }
  push(groups, 'Documents', documents);

  // ── Clothing — only with real figures behind it ──
  if (highC !== null) {
    const band = tempBand(highC);
    const items = CLOTHING[band].map((item, i) =>
      i === 0 ? { ...item, note: `Daytime highs average ${highC}°C while you are there` } : item,
    );
    push(groups, 'Clothing', items);
  }

  if (rainMm !== null && rainMm >= 80) {
    push(groups, 'Clothing', [
      { label: 'Proper waterproof', note: `The wettest month of your trip averages ${rainMm}mm of rain` },
    ]);
  }

  // ── What was booked and who is going ──
  for (const entry of TAG_ITEMS) {
    if (tags.some((t) => entry.match.test(t))) push(groups, entry.group, entry.items);
  }

  if (types.includes('child') || types.includes('infant')) {
    push(groups, 'For the children', [
      { label: "Children's medicines in the right doses" },
      { label: 'Something to do on the journey' },
      { label: 'A favourite toy that is not the only one of its kind' },
    ]);
  }
  if (types.includes('infant')) {
    push(groups, 'For the children', [
      { label: 'More nappies than the trip needs' },
      { label: 'Pram or carrier', note: 'Check what the airline allows you to gate-check' },
    ]);
  }

  // ── Health ──
  const health: PackingItem[] = [
    { label: 'Prescription medication in its original packaging', note: 'Plus a few days spare, in hand luggage' },
    { label: 'Small first-aid kit' },
  ];
  if (highC !== null && tempBand(highC) === 'hot') {
    health.push({ label: 'Rehydration sachets', note: `Highs average ${highC}°C` });
  }
  push(groups, 'Health', health);

  // ── Tech ──
  const tech: PackingItem[] = [{ label: 'Chargers and cables' }, { label: 'Power bank' }];
  const adapter = adapterItem(input.voltageAndPlug);
  if (adapter) tech.push(adapter);
  push(groups, 'Tech', tech);

  const ORDER = [
    'Documents',
    'Clothing',
    'For the beach',
    'On the slopes',
    'On foot',
    'On the course',
    'For the city',
    'For the children',
    'Health',
    'Tech',
  ];
  return ORDER.filter((title) => groups.has(title)).map((title) => ({
    title,
    items: groups.get(title) ?? [],
  }));
}
