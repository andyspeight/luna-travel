'use client';

/**
 * The home screen on the day you fly.
 *
 * The screen used to show a countdown until the trip was over, which meant it
 * looked the same on the sofa six weeks out as it did in the departures hall —
 * the moment the app is most useful and has the least time to be read. A
 * countdown reading "0 days" is not what somebody standing under a departure
 * board needs.
 *
 * So on a travel day it leads with the flight: where to go, when to be there,
 * and the documents. Everything a traveller reaches for between the taxi and
 * the gate, without a tap.
 *
 * WHAT IT WILL NOT DO IS GUESS. A terminal, a gate or a boarding time appears
 * only when the airline has actually filed it — an empty row is honest, and a
 * gate that turns out to be wrong sends somebody to the far end of an airport.
 * Same for the status: it carries the time it was taken, and says plainly when
 * that is old or when there is no signal to refresh it, rather than showing a
 * reassuring word of unknown age.
 */

import Link from 'next/link';
import type { FlightLeg, FlightLiveStatus } from '@/types/booking';
import { formatTime, formatDayMonth } from '@/lib/format';
import { freshness } from '@/lib/trip-phase';
import { StatusPill } from '@/components/flight-card';
import { IconDoc, IconChevR, IconPlane } from '@/components/icons';

/** A live value wins over the booked one, but only when it exists. */
function pick(live: string | undefined, booked: string | undefined): string | null {
  const v = (live ?? booked ?? '').trim();
  return v && v.toLowerCase() !== 'unknown' ? v : null;
}

export function TravelDayCard({
  flight,
  live,
  isReturn,
  destination,
  docsLine,
  docsWarn,
  online,
  now = Date.now(),
}: {
  flight: FlightLeg;
  live?: FlightLiveStatus;
  isReturn: boolean;
  destination: string;
  /** The offline-documents sentence, already decided by lib/offline-docs. */
  docsLine: string | null;
  docsWarn: boolean;
  online: boolean;
  now?: number;
}) {
  const depTime = live?.estDepTime || live?.actualDepTime || flight.depTime;
  const arrTime = live?.estArrTime || live?.actualArrTime || flight.arrTime;

  const terminal = pick(live?.depTerminalLive, flight.depTerminal);
  const gate = pick(live?.depGate, undefined);
  const boarding = live?.boardingAt ? formatTime(live.boardingAt) : null;

  const state = freshness(live?.lastUpdated, now);
  const updated = live?.lastUpdated ? formatTime(live.lastUpdated) : null;

  return (
    <section className="mb-5 rounded-3xl overflow-hidden border border-line-light bg-surface-2 shadow-sm">
      {/* ── The flight ── */}
      <div
        className="px-5 pt-4 pb-5 text-white"
        style={{ background: 'linear-gradient(135deg, #0B1D3E 0%, #1B2B5B 55%, #2A3F7A 100%)' }}
      >
        <div className="flex items-center justify-between gap-3">
          <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-white/60">
            {isReturn ? 'Flight home' : 'Outbound flight'}
          </span>
          {live?.statusCode && <StatusPill status={live.statusCode} />}
        </div>

        <div className="mt-4 flex items-start justify-between gap-3">
          <Endpoint
            time={formatTime(depTime)}
            place={flight.depCity || flight.depAirportName}
            sub={`${formatDayMonth(depTime)} · ${flight.depAirport}`}
          />
          <div className="pt-3 text-white/35" aria-hidden>
            <IconPlane size={18} />
          </div>
          <Endpoint
            time={formatTime(arrTime)}
            place={flight.arrCity || flight.arrAirportName}
            sub={`${formatDayMonth(arrTime)} · ${flight.arrAirport}`}
            align="right"
          />
        </div>

        {/* Only what the airline has actually filed. */}
        {(terminal || gate) && (
          <div className="mt-5 pt-4 border-t border-white/15 flex gap-10">
            {terminal && <Fact label="Terminal" value={terminal} />}
            {gate && <Fact label="Gate" value={gate} />}
          </div>
        )}

        <p className="mt-4 text-[12px] text-white/60 leading-snug">
          {boarding && <>Boarding from {boarding} · </>}
          Times local to each airport
        </p>

        {/* How old this is, and why — never a bare status. */}
        <p className="mt-1 text-[12px] leading-snug">
          {!online ? (
            <span className="text-amber-300">
              Offline{updated ? ` · last updated ${updated}` : ' · not updated yet'}
            </span>
          ) : state === 'live' && updated ? (
            <span className="text-white/60">Updated {updated}</span>
          ) : state === 'stale' && updated ? (
            <span className="text-amber-300">Last updated {updated} · checking again</span>
          ) : (
            <span className="text-white/60">Live updates not available for this flight</span>
          )}
        </p>
      </div>

      {/* ── The documents ── */}
      <div className="p-4">
        <Link
          href="/documents"
          className="flex items-center gap-3 w-full rounded-2xl bg-navy px-4 py-3.5 text-white"
        >
          <IconDoc size={18} />
          <span className="flex-1 text-[15px] font-semibold">Open travel documents</span>
          <IconChevR size={16} />
        </Link>
        {docsLine && (
          <p className={`mt-2.5 text-[12.5px] ${docsWarn ? 'text-warning' : 'text-ink-2'}`}>
            {docsLine}
          </p>
        )}
      </div>

      <span className="sr-only">
        {isReturn ? 'Flying home' : `Flying to ${destination}`} today.
      </span>
    </section>
  );
}

function Endpoint({
  time,
  place,
  sub,
  align = 'left',
}: {
  time: string;
  place: string;
  sub: string;
  align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="font-serif text-[30px] leading-none tabular-nums">{time}</div>
      <div className="mt-1.5 text-[14px] font-medium leading-tight">{place}</div>
      <div className="mt-0.5 text-[11.5px] text-white/60">{sub}</div>
    </div>
  );
}

function Fact({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] uppercase tracking-wide text-white/50">{label}</div>
      <div className="mt-0.5 text-[22px] font-bold leading-none tabular-nums">{value}</div>
    </div>
  );
}
