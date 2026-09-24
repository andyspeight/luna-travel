/**
 * What Luna is allowed to know when a model answers.
 *
 * Everything the model sees comes from here, and nothing else. It is the whole
 * grounding surface, so two things matter more than anything:
 *
 * WHAT GOES IN. The booking's shape and timings, the destination content, Luna
 * Brain's verified facts and the Q&A rows that matched. All of it real, all of
 * it already in the app.
 *
 * WHAT STAYS OUT. Traveller names, the lead email, the booking's PNRs, and
 * every figure about money. Names and emails because a concierge answering
 * "what time do we land" has no use for them; PNRs because they are credentials
 * in all but name; money because it is answered deterministically and there is
 * no reason to put a customer's balance in a prompt.
 *
 * This is a deliberate narrowing, not an oversight. If a question genuinely
 * needs one of those, the deterministic layer answers it and the model is never
 * asked.
 *
 * Pure, and testable without a network.
 */

import type { Booking } from '@/types/booking';
import type { PlaceView } from '@/types/destination-content';
import type { KnowledgeItem } from '@/lib/luna-knowledge';
import { formatBoard, formatDate, formatDayMonth, formatTime } from '@/lib/format';
import { monthsOfTrip } from '@/lib/packing';

/** Brain's structured country facts, as the destination API returns them. */
export interface BrainFacts {
  currency?: string;
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
  vaccinations?: string;
  ukEmbassy?: string;
  bestMonths?: string;
  lastVerified?: string;
}

export interface ContextInput {
  booking: Booking;
  place?: PlaceView | null;
  brain?: BrainFacts | null;
  /** Rows findKnowledge thought relevant, best first. */
  knowledge?: KnowledgeItem[];
}

/** Long prose is trimmed rather than dropped: half a section still answers. */
function trim(text: string, max: number): string {
  const clean = (text || '').trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max);
  const stop = Math.max(cut.lastIndexOf('. '), cut.lastIndexOf('\n'));
  return `${(stop > max * 0.5 ? cut.slice(0, stop + 1) : cut).trim()}…`;
}

function line(label: string, value?: string | null): string {
  const v = (value || '').trim();
  return v ? `${label}: ${v}\n` : '';
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * The trip, without the people.
 *
 * Party is a shape — "2 adults, 2 children" — never names. A concierge question
 * does not need to know that the child is called Lily.
 */
function tripBlock(booking: Booking): string {
  const adults = booking.travellers.filter((t) => t.type === 'adult').length;
  const children = booking.travellers.filter((t) => t.type === 'child').length;
  const infants = booking.travellers.filter((t) => t.type === 'infant').length;
  const party = [
    adults ? `${adults} adult${adults === 1 ? '' : 's'}` : '',
    children ? `${children} child${children === 1 ? '' : 'ren'}` : '',
    infants ? `${infants} infant${infants === 1 ? '' : 's'}` : '',
  ]
    .filter(Boolean)
    .join(', ');

  let out = '## THEIR TRIP\n';
  out += line('Destination', booking.destinationLabel);
  out += line('Dates', `${formatDate(booking.tripStart)} to ${formatDate(booking.tripEnd)} (${booking.durationLabel})`);
  out += line('Party', party);
  out += line('Agency', booking.agency.name);

  for (const f of booking.flights) {
    const num = f.flightNumber.toUpperCase().startsWith(f.carrierCode.toUpperCase())
      ? f.flightNumber
      : `${f.carrierCode}${f.flightNumber}`;
    out += `Flight: ${num} ${f.carrierName}, ${f.depAirportName || f.depAirport} ${formatTime(f.depTime)} ${formatDayMonth(f.depTime)}`;
    out += ` → ${f.arrAirportName || f.arrAirport} ${formatTime(f.arrTime)} ${formatDayMonth(f.arrTime)}`;
    if (f.depTerminal) out += `, departs terminal ${f.depTerminal}`;
    if (f.baggageAllowance) out += `, baggage ${f.baggageAllowance}`;
    out += '\n';
  }

  for (const h of booking.hotels) {
    const board = formatBoard(h.boardBasis);
    out += `Hotel: ${h.name}, ${[h.resort, h.city, h.country].filter(Boolean).join(', ')}`;
    out += `, ${formatDate(h.checkIn)} to ${formatDate(h.checkOut)} (${h.nights} nights)`;
    if (h.roomName) out += `, room "${h.roomName}"`;
    if (board) out += `, ${board.toLowerCase()}`;
    out += '\n';
    if (h.specialRequests) out += `Hotel special requests logged: ${h.specialRequests}\n`;
  }

  for (const x of booking.airportExtras) {
    out += `Airport extra: ${x.type} — ${x.name} at ${x.airport} on ${formatDayMonth(x.date)}${x.time ? ` ${x.time}` : ''}\n`;
  }

  for (const e of booking.experiences ?? []) {
    out += `Booked ${e.kind}: ${e.title}${e.supplier ? ` with ${e.supplier}` : ''} on ${formatDayMonth(e.startDate)}${e.time ? ` at ${e.time}` : ''}\n`;
  }

  if (!(booking.experiences ?? []).some((e) => e.kind === 'transfer')) {
    out += 'No airport transfer is booked.\n';
  }
  if (booking.documents.length) {
    out += line('Documents available in the app', booking.documents.map((d) => d.name).join(', '));
  }
  return out;
}

function destinationBlock(place: PlaceView | null | undefined, booking: Booking): string {
  if (!place) return '';
  let out = `\n## ${place.breadcrumb || place.name}\n`;
  if (place.tagline?.value) out += line('In a line', place.tagline.value);

  const WANTED: Array<[string, string]> = [
    ['overview', 'Overview'],
    ['what-makes-it-special', 'What makes it special'],
    ['character', 'Character'],
    ['things-to-do', 'Things to do'],
    ['beaches', 'Beaches'],
    ['food', 'Food and drink'],
    ['getting-there', 'Getting there'],
    ['getting-around', 'Getting around'],
    ['nearby-excursions', 'Nearby excursions'],
    ['best-time', 'Best time to visit'],
    ['practical', 'Practical info'],
    ['visa', 'Visa advisory'],
    ['health', 'Health notes'],
  ];
  for (const [key, label] of WANTED) {
    const section = place.sections.find((s) => s.key === key && s.body);
    if (section) out += `\n### ${label} (${section.from})\n${trim(section.body, 1100)}\n`;
  }

  if (place.highlights.length) {
    out += `\n### Highlights\n`;
    for (const h of place.highlights.slice(0, 6)) out += `- ${h.title}: ${h.description}\n`;
  }

  // What is actually on while they are there, and what is not.
  if (place.events.length) {
    const months = new Set(monthsOfTrip(booking.tripStart, booking.tripEnd));
    const during = place.events.filter((e) => e.months?.some((m) => months.has(m)));
    const other = place.events.filter((e) => !during.includes(e));
    if (during.length) {
      out += `\n### On while they are there\n`;
      for (const e of during) out += `- ${e.name} (${e.monthLabel}): ${e.description}\n`;
    }
    if (other.length) {
      out += `\n### On at other times of year (NOT during their trip)\n`;
      for (const e of other.slice(0, 6)) out += `- ${e.name} (${e.monthLabel}): ${e.description}\n`;
    }
  }

  const climate = place.climate;
  if (climate?.tempC) {
    const months = monthsOfTrip(booking.tripStart, booking.tripEnd);
    const readings = months
      .map((m) => `${MONTHS[m]} ${climate.tempC?.[m]}°C${climate.rainfallMm ? `, ${climate.rainfallMm[m]}mm rain` : ''}`)
      .join('; ');
    if (readings) out += `\n### Typical weather for their dates\n${readings} (long-term averages, not a forecast)\n`;
  }

  return out;
}

function brainBlock(brain: BrainFacts | null | undefined): string {
  if (!brain) return '';
  // No product name in the heading: the model quotes headings back, and the
  // traveller's app is the agency's, not "Luna Brain".
  let out = '\n## VERIFIED COUNTRY FACTS\n';
  out += line('Currency', brain.currency);
  out += line('Languages', brain.languages);
  out += line('Time zone', brain.timeZone);
  out += line('Dialling code', brain.diallingCode);
  out += line('Emergency number', brain.emergencyNumber);
  out += line('Driving side', brain.drivingSide);
  out += line('Plug and voltage', [brain.voltage, brain.plugType].filter(Boolean).join(' · '));
  out += line('UK visa', brain.ukVisaRequired);
  out += line('Tap water safe', brain.tapWaterSafe);
  out += line('FCDO status', brain.fcdoStatus);
  out += line('Vaccinations', brain.vaccinations);
  out += line('British embassy', brain.ukEmbassy);
  out += line('Best months', brain.bestMonths);
  out += line('Last verified', brain.lastVerified);
  return out.trim() === '## VERIFIED COUNTRY FACTS' ? '' : out;
}

function knowledgeBlock(items: KnowledgeItem[] | undefined): string {
  if (!items?.length) return '';
  let out = '\n## VERIFIED ANSWERS (destination knowledge base)\n';
  for (const item of items.slice(0, 6)) {
    out += `\n### ${item.question}\n${trim(item.answer, 900)}\n`;
    if (item.lastVerified) out += `(checked ${item.lastVerified})\n`;
  }
  return out;
}

/**
 * The whole grounding pack.
 *
 * Roughly 4–8k characters for a well-populated destination, which is a cheap
 * prompt and leaves the model no room to wander.
 */
export function buildLunaContext(input: ContextInput): string {
  return [
    tripBlock(input.booking),
    destinationBlock(input.place, input.booking),
    brainBlock(input.brain),
    knowledgeBlock(input.knowledge),
  ]
    .filter(Boolean)
    .join('\n')
    .trim();
}

/**
 * Things that must never reach the model, checked rather than assumed.
 *
 * Used by the tests, and by the route as a last guard before sending. A leak
 * here would be a customer's name or booking reference sitting in a third
 * party's logs, so it is worth paying for the belt as well as the braces.
 */
export function forbiddenStrings(booking: Booking): string[] {
  const out: string[] = [booking.leadEmail];
  for (const t of booking.travellers) {
    out.push(`${t.firstName} ${t.lastName}`);
    if (t.lastName.length > 3) out.push(t.lastName);
  }
  for (const f of booking.flights) if (f.pnr) out.push(f.pnr);
  return out.filter((s) => typeof s === 'string' && s.trim().length > 2);
}
