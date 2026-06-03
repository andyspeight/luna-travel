'use client';

import Link from 'next/link';
import type { Booking, Hotel, FlightLeg } from '@/types/booking';
import { buildTimeline, type TimelineEvent } from '@/lib/booking-helpers';
import { destinationHero } from '@/lib/hero';
import { useI18n } from '@/lib/locale-context';
import { formatDate, formatTime } from '@/lib/format';
import {
  IconPlane,
  IconBed,
  IconLounge,
  IconCar,
  IconFastTrack,
  IconPin,
  IconChevR,
} from '@/components/icons';

/**
 * Storyboard — the image-led, day-by-day visual itinerary.
 *
 * Renders EVERY day of the trip from start to end, themes each day to where
 * the traveller actually is that day (the hotel in residence, or the country
 * they're travelling through), and gives each day a clear headline so the
 * sequence reads at a glance. Built over the same canonical timeline as the
 * Itinerary list, so event order can never diverge from it.
 */

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
    d.getUTCDate(),
  ).padStart(2, '0')}`;
}

/** Inclusive list of YYYY-MM-DD keys from start to end (UTC). */
function eachDay(startIso: string, endIso: string): string[] {
  const s = new Date(startIso);
  const e = new Date(endIso);
  let cur = Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate());
  const last = Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate());
  const out: string[] = [];
  let guard = 0;
  while (cur <= last && guard < 400) {
    const d = new Date(cur);
    out.push(
      `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}-${String(
        d.getUTCDate(),
      ).padStart(2, '0')}`,
    );
    cur += 86_400_000;
    guard += 1;
  }
  return out;
}

/** The hotel the traveller is resident in on a given day (check-in..check-out inclusive). */
function hotelForDay(booking: Booking, day: string): Hotel | undefined {
  return booking.hotels.find((h) => dayKey(h.checkIn) <= day && day <= dayKey(h.checkOut));
}

/**
 * Compact IATA → ISO-2 lookup so a pure travel day can be themed to the right
 * country instead of falling back to the destination. Unknown airports fall
 * back gracefully to the trip's primary country, so it never breaks.
 */
const IATA_COUNTRY: Record<string, string> = {
  LHR: 'GB', LGW: 'GB', STN: 'GB', LTN: 'GB', LCY: 'GB', SEN: 'GB', MAN: 'GB', BHX: 'GB',
  EDI: 'GB', GLA: 'GB', BRS: 'GB', NCL: 'GB', LPL: 'GB', LBA: 'GB', EMA: 'GB', BFS: 'GB',
  BHD: 'GB', ABZ: 'GB', CWL: 'GB', DSA: 'GB', NWI: 'GB', EXT: 'GB',
  DUB: 'IE', ORK: 'IE', SNN: 'IE',
  MAD: 'ES', BCN: 'ES', AGP: 'ES', PMI: 'ES', ALC: 'ES', TFS: 'ES', TFN: 'ES', LPA: 'ES',
  ACE: 'ES', FUE: 'ES', IBZ: 'ES', MAH: 'ES', VLC: 'ES', SVQ: 'ES',
  LIS: 'PT', OPO: 'PT', FAO: 'PT', FNC: 'PT', PDL: 'PT',
  CDG: 'FR', ORY: 'FR', NCE: 'FR', LYS: 'FR', MRS: 'FR',
  FCO: 'IT', MXP: 'IT', LIN: 'IT', VCE: 'IT', NAP: 'IT', BLQ: 'IT', CTA: 'IT', PMO: 'IT',
  ATH: 'GR', HER: 'GR', RHO: 'GR', CFU: 'GR', JTR: 'GR', JMK: 'GR', SKG: 'GR', KGS: 'GR', ZTH: 'GR',
  AMS: 'NL', FRA: 'DE', MUC: 'DE', BER: 'DE', DUS: 'DE', HAM: 'DE',
  ZRH: 'CH', GVA: 'CH', VIE: 'AT', SZG: 'AT',
  IST: 'TR', SAW: 'TR', AYT: 'TR', DLM: 'TR', BJV: 'TR', ADB: 'TR',
  HRG: 'EG', SSH: 'EG', CAI: 'EG',
  DXB: 'AE', AUH: 'AE', SHJ: 'AE', DOH: 'QA', MLE: 'MV',
  JFK: 'US', EWR: 'US', LGA: 'US', LAX: 'US', MCO: 'US', MIA: 'US', SFO: 'US', LAS: 'US', BOS: 'US', ORD: 'US',
  BKK: 'TH', DMK: 'TH', HKT: 'TH', SIN: 'SG', HKG: 'HK',
  MRU: 'MU', CMB: 'LK', BGI: 'BB', MBJ: 'JM', KIN: 'JM',
  CUN: 'MX', PUJ: 'DO', SID: 'CV', BVC: 'CV',
  RAK: 'MA', AGA: 'MA', TUN: 'TN', MIR: 'TN', DJE: 'TN',
  LCA: 'CY', PFO: 'CY', MLA: 'MT', DBV: 'HR', SPU: 'HR', ZAG: 'HR',
  TGD: 'ME', TIV: 'ME', KEF: 'IS',
};

export function Storyboard({ booking }: { booking: Booking }) {
  const events = buildTimeline(booking);

  // Group events by UTC day (events are already globally time-sorted).
  const byDay = new Map<string, TimelineEvent[]>();
  for (const e of events) {
    const k = dayKey(e.date);
    const list = byDay.get(k) ?? [];
    list.push(e);
    byDay.set(k, list);
  }

  // Derive the day range from the events themselves, using the same UTC day
  // keys the Itinerary list groups by. This keeps the storyboard's days lined
  // up exactly with the timeline and avoids a phantom leading day when
  // tripStart is a timestamp that sits on the other side of midnight UTC.
  const sortedKeys = Array.from(byDay.keys()).sort();
  const start = sortedKeys[0] || booking.tripStart || '';
  const end = sortedKeys[sortedKeys.length - 1] || booking.tripEnd || '';
  const dayList = start && end ? eachDay(start, end) : [];

  if (dayList.length === 0) {
    return (
      <div className="mt-6 p-6 rounded-2xl bg-surface border border-line-light text-center">
        <p className="text-sm text-ink-2">No events on this trip yet.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 pt-1">
      {dayList.map((day, i) => (
        <DayScene
          key={day}
          booking={booking}
          dayIso={day}
          dayNumber={i + 1}
          events={byDay.get(day) ?? []}
        />
      ))}
    </div>
  );
}

function DayScene({
  booking,
  dayIso,
  dayNumber,
  events,
}: {
  booking: Booking;
  dayIso: string;
  dayNumber: number;
  events: TimelineEvent[];
}) {
  const { t } = useI18n();

  const dayHotel = hotelForDay(booking, dayIso);

  // Flights that touch this day (depart or arrive).
  const dayFlights = booking.flights.filter(
    (f) => dayKey(f.depTime) === dayIso || dayKey(f.arrTime) === dayIso,
  );
  const arrivingToday = dayFlights.filter((f) => dayKey(f.arrTime) === dayIso);
  const repFlight: FlightLeg | undefined =
    arrivingToday[arrivingToday.length - 1] ?? dayFlights[dayFlights.length - 1];

  // Theme: hotel in residence wins; else the country of the day's flight; else
  // the trip's primary destination.
  let cc = booking.primaryCountryCode;
  if (dayHotel) {
    cc = dayHotel.countryCode;
  } else if (repFlight) {
    const airport = arrivingToday.length ? repFlight.arrAirport : repFlight.depAirport;
    cc = IATA_COUNTRY[airport] ?? booking.primaryCountryCode;
  }
  const hero = destinationHero(cc);

  const hasCheckIn = events.some((e) => e.kind === 'hotel-checkin');
  const hasCheckOut = events.some((e) => e.kind === 'hotel-checkout');
  const hasFlight = events.some((e) => e.kind === 'flight');

  // A clear, descriptive headline so every day reads at a glance.
  let headline: string;
  if (hasCheckIn && dayHotel) {
    headline = `Arrive · ${dayHotel.resort || dayHotel.city || dayHotel.country}`;
  } else if (hasCheckOut) {
    headline = 'Departure';
  } else if (!dayHotel && hasFlight) {
    headline = 'Travel day';
  } else if (dayHotel) {
    headline = 'At leisure';
  } else {
    headline = booking.destinationLabel;
  }

  // Location line under the headline — where you are that day.
  let locationLabel: string;
  if (dayHotel) {
    locationLabel = [dayHotel.resort, dayHotel.city, dayHotel.country].filter(Boolean).join(' · ');
  } else if (repFlight) {
    const dep = repFlight.depCity || repFlight.depAirport;
    const arr = repFlight.arrCity || repFlight.arrAirport;
    locationLabel = `${dep} → ${arr}`;
  } else {
    locationLabel = booking.destinationLabel;
  }

  const hasEvents = events.length > 0;

  return (
    <article className="rounded-3xl overflow-hidden shadow-sm border border-line-light">
      <div className="relative min-h-[220px] p-4 text-white" style={{ background: hero.gradient }}>
        {hero.image && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `center/cover no-repeat url("${hero.image}")` }}
          />
        )}
        <div aria-hidden className="absolute inset-0" style={{ background: hero.glow }} />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(15,23,42,0.10) 0%, transparent 30%, rgba(15,23,42,0.72) 100%)',
          }}
        />

        {/* Day chip + date */}
        <div className="relative flex items-center justify-between">
          <span className="inline-flex items-center gap-1.5 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
            {t('itin.day')} {dayNumber}
          </span>
          <span className="text-[11px] opacity-90 tracking-wide">
            {formatDate(dayIso, { weekday: 'short', day: 'numeric', month: 'short' })}
          </span>
        </div>

        {/* Headline + location + events */}
        <div className="relative mt-auto pt-20">
          <h3 className="font-serif text-2xl leading-tight drop-shadow-sm">
            <em>{headline}</em>
          </h3>
          {locationLabel && (
            <div className="mt-1 inline-flex items-center gap-1.5 text-[12px] opacity-90">
              <IconPin size={13} />
              <span className="truncate">{locationLabel}</span>
            </div>
          )}

          <ul className="mt-3 space-y-1.5">
            {hasEvents ? (
              events.map((e) => (
                <li key={e.id}>
                  <Link
                    href={e.href}
                    className="group flex items-center gap-2.5 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-sm px-3 py-2 transition-colors"
                  >
                    <span className="flex-shrink-0 opacity-90">{kindGlyph(e.kind)}</span>
                    <span className="text-xs tabular opacity-90 flex-shrink-0 w-11">
                      {formatTime(e.date)}
                    </span>
                    <span className="text-[13px] font-medium truncate flex-1">{e.title}</span>
                    <IconChevR size={15} className="opacity-70 flex-shrink-0" />
                  </Link>
                </li>
              ))
            ) : dayHotel ? (
              <li>
                <Link
                  href={`/hotel/${dayHotel.id}`}
                  className="group flex items-center gap-2.5 rounded-xl bg-white/12 hover:bg-white/20 backdrop-blur-sm px-3 py-2 transition-colors"
                >
                  <span className="flex-shrink-0 opacity-90">
                    <IconBed size={15} />
                  </span>
                  <span className="text-[13px] font-medium truncate flex-1">{dayHotel.name}</span>
                  <IconChevR size={15} className="opacity-70 flex-shrink-0" />
                </Link>
              </li>
            ) : null}
          </ul>
        </div>
      </div>
    </article>
  );
}

function kindGlyph(k: TimelineEvent['kind']) {
  switch (k) {
    case 'flight':
      return <IconPlane size={15} />;
    case 'hotel-checkin':
    case 'hotel-checkout':
      return <IconBed size={15} />;
    case 'lounge':
      return <IconLounge size={15} />;
    case 'parking':
      return <IconCar size={15} />;
    case 'fast-track':
      return <IconFastTrack size={15} />;
    default:
      return <IconPin size={15} />;
  }
}
