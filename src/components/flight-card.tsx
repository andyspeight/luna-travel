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
import { formatDate, formatTime, formatDuration, formatCabin, formatTerminal } from '@/lib/format';
import type { FlightLeg, FlightLiveStatus, FlightStatusCode } from '@/types/booking';

const STATUS_STYLES: Record<FlightStatusCode, { label: string; cls: string }> = {
  Scheduled: { label: 'Scheduled', cls: 'bg-white/15 text-white' },
  CheckIn: { label: 'Check-in open', cls: 'bg-teal text-white' },
  Boarding: { label: 'Boarding', cls: 'bg-teal text-white' },
  GateClosed: { label: 'Gate closed', cls: 'bg-warning text-white' },
  Departed: { label: 'Departed', cls: 'bg-teal-dark text-white' },
  Delayed: { label: 'Delayed', cls: 'bg-warning text-white' },
  Approaching: { label: 'Approaching', cls: 'bg-teal-dark text-white' },
  Landed: { label: 'Landed', cls: 'bg-success text-white' },
  Cancelled: { label: 'Cancelled', cls: 'bg-danger text-white' },
  Diverted: { label: 'Diverted', cls: 'bg-danger text-white' },
  CancelledUncertain: { label: 'Possible disruption', cls: 'bg-warning text-white' },
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

export function FlightHero({ flight, live }: { flight: FlightLeg; live?: FlightLiveStatus }) {
  const liveStatus = live?.statusCode;
  const depRevised = differsFromScheduled(live?.estDepTime ?? live?.actualDepTime, flight.depTime);
  const arrRevised = differsFromScheduled(live?.estArrTime ?? live?.actualArrTime, flight.arrTime);

  return (
    <section
      className="relative pt-2 px-5 pb-6 text-white"
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

        {liveStatus && liveStatus !== 'Unknown' && (
          <div className="flex items-center gap-2 mb-4">
            <StatusPill status={liveStatus} />
            {live?.lastUpdated && (
              <span className="text-[10px] opacity-60">Updated {formatTime(live.lastUpdated)}</span>
            )}
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-start mb-5">
          <Endpoint
            code={flight.depAirport}
            name={flight.depAirportName}
            time={formatTime(flight.depTime)}
            revised={depRevised ? formatTime(depRevised) : undefined}
            dateLine={formatDate(flight.depTime, { weekday: 'short', day: 'numeric', month: 'short' })}
            terminal={flight.depTerminal ? formatTerminal(flight.depTerminal) : undefined}
          />
          <div className="relative h-12 flex flex-col items-center justify-center pt-6">
            <div className="w-20 h-px bg-white/35 relative">
              <IconPlane size={22} className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-teal-light" />
            </div>
            <div className="text-[10px] opacity-75 mt-1 tracking-wide">
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
              <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-warning">Changed</span>
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
            <span className="text-warning">{revised}</span>
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
