'use client';

/**
 * FlightCard — the traveller-facing flight presentation, shared by the real
 * flight detail page (/flight/[id]) and the admin test rig so they render
 * pixel-identically. Driven by a booked FlightLeg plus an optional live
 * overlay; with no overlay it renders booked-only, exactly as before.
 *
 * Owns: the hero (carrier, status pill, route, revised times, meta strip),
 * the "Live now" panel, and the "Aircraft & tracking" panel.
 */

import { IconPlane } from '@/components/icons';
import { FlightStatusLine } from '@/components/flight-status-line';
import { formatDate, formatTime, formatDuration, formatCabin, formatTerminal } from '@/lib/format';
import type { FlightLeg, FlightLiveStatus, FlightStatusCode } from '@/types/booking';

/**
 * Every one of these was white on its fill, which measured between 2.15:1 and
 * 3.76:1 — so "Delayed" and "Cancelled", the two words on this screen a
 * traveller most needs to read, were the least legible things on it.
 *
 * The fills keep their colour; the text on them is the one that passes. On
 * teal that is decided at theme time, because teal is whatever the agency
 * chose and white on a pale brand is unreadable.
 */
const STATUS_STYLES: Record<FlightStatusCode, { label: string; cls: string }> = {
  Scheduled: { label: 'Scheduled', cls: 'bg-white/15 text-white' },
  CheckIn: { label: 'Check-in open', cls: 'bg-teal text-teal-on' },
  Boarding: { label: 'Boarding', cls: 'bg-teal text-teal-on' },
  GateClosed: { label: 'Gate closed', cls: 'bg-warning text-semantic-on' },
  Departed: { label: 'Departed', cls: 'bg-teal-dark text-white' },
  Delayed: { label: 'Delayed', cls: 'bg-warning text-semantic-on' },
  Approaching: { label: 'Approaching', cls: 'bg-teal-dark text-white' },
  Landed: { label: 'Landed', cls: 'bg-success text-semantic-on' },
  Cancelled: { label: 'Cancelled', cls: 'bg-danger text-semantic-on' },
  Diverted: { label: 'Diverted', cls: 'bg-danger text-semantic-on' },
  CancelledUncertain: { label: 'Possible disruption', cls: 'bg-warning text-semantic-on' },
  Unknown: { label: '', cls: 'hidden' },
};

function differsFromScheduled(liveIso: string | undefined, bookedIso: string): string | undefined {
  if (!liveIso) return undefined;
  const a = new Date(liveIso).getTime();
  const b = new Date(bookedIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  return Math.abs(a - b) >= 60 * 1000 ? liveIso : undefined;
}

function hasLiveDetail(live: FlightLiveStatus): boolean {
  return !!(live.depGate || live.depTerminalLive || live.checkInDesk || live.boardingAt || live.baggageBelt);
}

function hasAircraftDetail(live: FlightLiveStatus): boolean {
  return !!(live.aircraftModel || live.aircraftReg || (live.liveLat != null && live.liveLon != null));
}

export function StatusPill({ status }: { status: FlightStatusCode }) {
  const s = STATUS_STYLES[status];
  if (!s || status === 'Unknown') return null;
  return (
    <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${s.cls}`}>
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </span>
  );
}

export interface FreshnessControls {
  online: boolean;
  refreshing: boolean;
  failed: boolean;
  onRefresh: () => void;
}


export function FlightHero({
  flight,
  live,
  freshness,
  navOverlay = false,
}: {
  flight: FlightLeg;
  live?: FlightLiveStatus;
  /**
   * True where the page floats its back bar over this hero, which the flight
   * screen does and the admin rig does not. Without the clearance the bar
   * printed straight across the airline's name — "Trip" over "Etihad
   * Airways" — on every visit.
   */
  navOverlay?: boolean;
  /** Omitted by the admin test rig: it simulates its payload, so it shows
   *  the same sentence a traveller sees but has nothing real to refetch. */
  freshness?: FreshnessControls;
}) {
  const liveStatus = live?.statusCode;
  const depRevised = differsFromScheduled(live?.estDepTime ?? live?.actualDepTime, flight.depTime);
  const arrRevised = differsFromScheduled(live?.estArrTime ?? live?.actualArrTime, flight.arrTime);

  return (
    <section
      className={`relative px-5 pb-6 text-white ${navOverlay ? 'pt-16' : 'pt-2'}`}
      style={{ background: 'linear-gradient(135deg, #0B1D3E 0%, #1B2B5B 50%, #2A3F7A 100%)' }}
    >
      <div
        aria-hidden
        className="absolute inset-0"
        style={{ background: 'radial-gradient(ellipse at 85% 10%, rgba(0,180,216,0.45), transparent 50%)' }}
      />
      <div className="relative">
        <div className="flex items-center gap-3 mb-4">
          <span className="w-10 h-10 rounded-lg bg-white text-navy font-extrabold text-[15px] flex items-center justify-center">
            {flight.carrierCode}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-sm font-semibold">{flight.carrierName}</div>
            <div className="text-xs opacity-75">
              Flight {flight.flightNumber} · {formatCabin(flight.cabin)}
            </div>
          </div>
        </div>

        {/* The status and its age travel together, always. A word like
            "Departed" with no age looks current whatever time it was taken,
            and the age line appears even with no status at all — silence
            leaves the traveller unable to tell working from broken. */}
        <div className="mb-4 space-y-1.5">
          {liveStatus && liveStatus !== 'Unknown' && <StatusPill status={liveStatus} />}
          <FlightStatusLine live={live} variant="dark" {...freshness} />
        </div>

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start mb-5">
          <Endpoint
            code={flight.depAirport}
            name={flight.depAirportName}
            time={formatTime(flight.depTime)}
            revised={depRevised ? formatTime(depRevised) : undefined}
            dateLine={formatDate(flight.depTime, { weekday: 'short', day: 'numeric', month: 'short' })}
            terminal={flight.depTerminal ? formatTerminal(flight.depTerminal) : undefined}
          />
          <div className="flex flex-col items-center justify-center pt-[60px]">
            <IconPlane size={20} className="text-teal-light mb-1.5" />
            <div className="w-16 h-px bg-white/35" />
            <div className="text-[10px] opacity-75 mt-1.5 tracking-wide whitespace-nowrap">
              {formatDuration(flight.durationMinutes)}
            </div>
          </div>
          <Endpoint
            align="right"
            code={flight.arrAirport}
            name={flight.arrAirportName}
            time={formatTime(flight.arrTime)}
            revised={arrRevised ? formatTime(arrRevised) : undefined}
            dateLine={formatDate(flight.arrTime, { weekday: 'short', day: 'numeric', month: 'short' })}
            terminal={flight.arrTerminal ? formatTerminal(flight.arrTerminal) : undefined}
          />
        </div>

        {(flight.aircraft || flight.baggageAllowance || flight.pnr) && (
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/15">
            {flight.aircraft && <MetaCell label="Aircraft" value={flight.aircraft} />}
            {flight.baggageAllowance && <MetaCell label="Baggage" value={flight.baggageAllowance} />}
            {flight.pnr && <MetaCell label="PNR" value={flight.pnr} />}
          </div>
        )}
      </div>
    </section>
  );
}

export function LiveNowPanel({ flight, live }: { flight: FlightLeg; live?: FlightLiveStatus }) {
  if (!live || !hasLiveDetail(live)) return null;
  const depTerminalLive = live.depTerminalLive;
  const depTerminalChanged = !!depTerminalLive && !!flight.depTerminal && depTerminalLive !== flight.depTerminal;

  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">Live now</h3>
      <ul className="divide-y divide-line-light text-sm">
        {live.depGate && <Row label="Gate"><span className="font-semibold tabular">{live.depGate}</span></Row>}
        {depTerminalLive && (
          <Row label="Departure terminal">
            {formatTerminal(depTerminalLive)}
            {depTerminalChanged && (
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-warning-ink">Changed</span>
            )}
          </Row>
        )}
        {live.checkInDesk && <Row label="Check-in desk">{live.checkInDesk}</Row>}
        {live.boardingAt && <Row label="Boarding"><span className="tabular">{formatTime(live.boardingAt)}</span></Row>}
        {live.baggageBelt && <Row label="Baggage belt"><span className="font-semibold tabular">{live.baggageBelt}</span></Row>}
      </ul>
    </section>
  );
}

/** Aircraft type, registration, and live position when airborne. */
export function AircraftPanel({ live }: { live?: FlightLiveStatus }) {
  if (!live || !hasAircraftDetail(live)) return null;
  const airborne = live.liveLat != null && live.liveLon != null;

  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">Aircraft &amp; tracking</h3>
      <ul className="divide-y divide-line-light text-sm">
        {live.aircraftModel && <Row label="Aircraft"><span className="font-medium">{live.aircraftModel}</span></Row>}
        {live.aircraftReg && <Row label="Registration"><span className="tabular">{live.aircraftReg}</span></Row>}
        {airborne && live.liveAltitudeFt != null && (
          <Row label="Altitude"><span className="tabular">{Math.round(live.liveAltitudeFt).toLocaleString()} ft</span></Row>
        )}
        {airborne && live.liveSpeedKt != null && (
          <Row label="Ground speed"><span className="tabular">{Math.round(live.liveSpeedKt)} kts</span></Row>
        )}
        {airborne && (
          <Row label="Position">
            <span className="tabular text-ink-2">
              {live.liveLat!.toFixed(2)}, {live.liveLon!.toFixed(2)}
            </span>
          </Row>
        )}
      </ul>
    </section>
  );
}

function Endpoint({
  code, name, time, revised, dateLine, terminal, align = 'left',
}: {
  code: string; name?: string; time: string; revised?: string;
  dateLine: string; terminal?: string; align?: 'left' | 'right';
}) {
  return (
    <div className={align === 'right' ? 'text-right' : ''}>
      <div className="text-[42px] font-bold tracking-tighter leading-none">{code}</div>
      {name && <div className="text-[10px] opacity-75 uppercase tracking-wider mt-1 leading-tight">{name}</div>}
      <div className="text-[22px] font-semibold tabular tracking-tight mt-2">
        {revised ? (
          <span className="inline-flex items-baseline gap-1.5">
            <span className="line-through opacity-50 text-[15px]">{time}</span>
            <span className="text-warning-ink">{revised}</span>
          </span>
        ) : (
          time
        )}
      </div>
      <div className="text-[11px] opacity-70 mt-0.5">
        {dateLine}
        {terminal && <span> · {terminal}</span>}
      </div>
    </div>
  );
}

function MetaCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[10px] opacity-70 uppercase tracking-wider mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold leading-tight">{value}</div>
    </div>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <li className="py-2.5 flex justify-between">
      <span className="text-ink-2">{label}</span>
      <span className="text-ink font-medium">{children}</span>
    </li>
  );
}
