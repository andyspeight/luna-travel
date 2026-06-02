'use client';

import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { useFlightLive } from '@/lib/use-flight-live';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
import {
  IconPlane,
  IconCheck,
  IconClock,
  IconBaggage,
  IconTicket,
  IconUsers,
  IconNavigate,
} from '@/components/icons';
import { findFlight } from '@/lib/booking-helpers';
import { formatDate, formatTime, formatDuration, formatCabin, formatTerminal } from '@/lib/format';
import type { FlightLiveStatus, FlightStatusCode } from '@/types/booking';

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const flight = findFlight(booking, params.id);
  const { getLive } = useFlightLive();
  const live = flight ? getLive(flight.id) : undefined;

  if (!flight) {
    return (
      <>
        <NavBar title="Flight" backLabel="Back" />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">Flight not found.</p>
          <button
            onClick={() => router.replace('/itinerary')}
            className="mt-4 text-teal-dark hover:underline text-sm"
          >
            Back to itinerary
          </button>
        </main>
      </>
    );
  }

  // Live overlay (only present on a real lt_session booking with coverage).
  const liveStatus = live?.statusCode;

  // Online check-in: prefer live signal, fall back to the booked 24h heuristic.
  const checkInOpenLive = liveStatus === 'CheckIn';
  const checkInOpenHeuristic =
    new Date(flight.depTime).getTime() - Date.now() < 24 * 60 * 60 * 1000 &&
    new Date(flight.depTime).getTime() > Date.now();
  const checkInOpen = checkInOpenLive || checkInOpenHeuristic;

  // Live times that differ from the booked schedule.
  const depRevised = differsFromScheduled(live?.estDepTime ?? live?.actualDepTime, flight.depTime);
  const arrRevised = differsFromScheduled(live?.estArrTime ?? live?.actualArrTime, flight.arrTime);

  // Live terminal/gate (flag when the live terminal differs from booked).
  const depTerminalLive = live?.depTerminalLive;
  const depTerminalChanged =
    !!depTerminalLive && !!flight.depTerminal && depTerminalLive !== flight.depTerminal;

  return (
    <PageEnter>
    <main className="pb-6">
      {/* Hero with carrier branding */}
      <section
        className="relative pt-2 px-5 pb-6 text-white"
        style={{
          background:
            'linear-gradient(135deg, #0B1D3E 0%, #1B2B5B 50%, #2A3F7A 100%)',
        }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 85% 10%, rgba(0,180,216,0.45), transparent 50%)',
          }}
        />

        <div className="relative">
          <NavBar
            title={flight.flightNumber}
            backLabel="Trip"
            variant="dark"
          />

          {/* Carrier */}
          <div className="flex items-center gap-3 mt-3 mb-4">
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

          {/* Live status pill — only when we have a live overlay */}
          {liveStatus && liveStatus !== 'Unknown' && (
            <div className="flex items-center gap-2 mb-4">
              <StatusPill status={liveStatus} />
              {live?.lastUpdated && (
                <span className="text-[10px] opacity-60">
                  Updated {formatTime(live.lastUpdated)}
                </span>
              )}
            </div>
          )}

          {/* Route */}
          <div className="grid grid-cols-[1fr_auto_1fr] gap-3 items-end mb-5">
            <div>
              <div className="text-[42px] font-bold tracking-tighter leading-none">
                {flight.depAirport}
              </div>
              <div className="text-[10px] opacity-75 uppercase tracking-wider mt-1">
                {flight.depAirportName}
              </div>
              <div className="text-[22px] font-semibold tabular tracking-tight mt-2">
                {depRevised ? (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="line-through opacity-50 text-[15px]">
                      {formatTime(flight.depTime)}
                    </span>
                    <span className="text-warning">{formatTime(depRevised)}</span>
                  </span>
                ) : (
                  formatTime(flight.depTime)
                )}
              </div>
              <div className="text-[11px] opacity-70 mt-0.5">
                {formatDate(flight.depTime, { weekday: 'short', day: 'numeric', month: 'short' })}
                {flight.depTerminal && <span> · {formatTerminal(flight.depTerminal)}</span>}
              </div>
            </div>

            <div className="relative h-12 flex flex-col items-center justify-end pb-1">
              <div className="w-20 h-px bg-white/35 relative">
                <IconPlane
                  size={22}
                  className="absolute -top-2.5 left-1/2 -translate-x-1/2 text-teal-light"
                />
              </div>
              <div className="text-[10px] opacity-75 mt-1 tracking-wide">
                {formatDuration(flight.durationMinutes)}
              </div>
            </div>

            <div className="text-right">
              <div className="text-[42px] font-bold tracking-tighter leading-none">
                {flight.arrAirport}
              </div>
              <div className="text-[10px] opacity-75 uppercase tracking-wider mt-1">
                {flight.arrAirportName}
              </div>
              <div className="text-[22px] font-semibold tabular tracking-tight mt-2">
                {arrRevised ? (
                  <span className="inline-flex items-baseline gap-1.5">
                    <span className="line-through opacity-50 text-[15px]">
                      {formatTime(flight.arrTime)}
                    </span>
                    <span className="text-warning">{formatTime(arrRevised)}</span>
                  </span>
                ) : (
                  formatTime(flight.arrTime)
                )}
              </div>
              <div className="text-[11px] opacity-70 mt-0.5">
                {formatDate(flight.arrTime, { weekday: 'short', day: 'numeric', month: 'short' })}
                {flight.arrTerminal && <span> · {formatTerminal(flight.arrTerminal)}</span>}
              </div>
            </div>
          </div>

          {/* Meta strip */}
          <div className="grid grid-cols-3 gap-3 pt-4 border-t border-white/15">
            {flight.aircraft && (
              <MetaCell label="Aircraft" value={flight.aircraft} />
            )}
            {flight.baggageAllowance && (
              <MetaCell label="Baggage" value={flight.baggageAllowance} />
            )}
            {flight.pnr && <MetaCell label="PNR" value={flight.pnr} />}
          </div>
        </div>
      </section>

      <div className="px-5 pt-4 space-y-3">
        {/* Live now — gate, terminal, belt. Only renders when live data exists
            and has something worth showing. Honours "no invented fallbacks". */}
        {live && hasLiveDetail(live) && (
          <Panel title="Live now" icon={<IconClock size={14} />}>
            <ul className="divide-y divide-line-light text-sm">
              {live.depGate && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Gate</span>
                  <span className="text-ink font-semibold tabular">{live.depGate}</span>
                </li>
              )}
              {depTerminalLive && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Departure terminal</span>
                  <span className="text-ink font-medium">
                    {formatTerminal(depTerminalLive)}
                    {depTerminalChanged && (
                      <span className="ml-2 text-[10px] font-semibold uppercase tracking-wide text-warning">
                        Changed
                      </span>
                    )}
                  </span>
                </li>
              )}
              {live.checkInDesk && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Check-in desk</span>
                  <span className="text-ink font-medium">{live.checkInDesk}</span>
                </li>
              )}
              {live.boardingAt && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Boarding</span>
                  <span className="text-ink font-medium tabular">{formatTime(live.boardingAt)}</span>
                </li>
              )}
              {live.baggageBelt && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Baggage belt</span>
                  <span className="text-ink font-semibold tabular">{live.baggageBelt}</span>
                </li>
              )}
            </ul>
          </Panel>
        )}

        {/* Travellers & seats */}
        <Panel title="Travellers & seats" icon={<IconUsers size={14} />}>
          <ul className="divide-y divide-line-light">
            {booking.travellers.map((t) => {
              const seat = flight.seats?.[t.id];
              return (
                <li key={t.id} className="flex items-center justify-between py-2.5">
                  <span className="text-sm text-ink font-medium">
                    {t.title ? `${t.title} ` : ''}
                    {t.firstName} {t.lastName}
                  </span>
                  {seat ? (
                    <span className="text-xs font-bold text-teal-dark dark:text-teal-light bg-teal/10 px-2 py-1 rounded-md tabular">
                      {seat}
                    </span>
                  ) : (
                    <span className="text-xs text-ink-3">Not yet assigned</span>
                  )}
                </li>
              );
            })}
          </ul>
        </Panel>

        {/* Primary action */}
        <ActionButton icon={<IconCheck size={18} />}>
          Check in for this flight
        </ActionButton>

        {/* Status */}
        <Panel title="Status" icon={<IconClock size={14} />}>
          <ul className="divide-y divide-line-light text-sm">
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Online check-in</span>
              <span className={checkInOpen ? 'text-success font-semibold' : 'text-ink font-medium'}>
                {checkInOpen
                  ? `Open · closes ${formatTime(flight.depTime)}`
                  : `Opens 24h before · ${formatDate(flight.depTime, { day: 'numeric', month: 'short' })}`}
              </span>
            </li>
            {flight.depTerminal && (
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Departure terminal</span>
                <span className="text-ink font-medium">{formatTerminal(flight.depTerminal)}</span>
              </li>
            )}
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Cabin</span>
              <span className="text-ink font-medium">{formatCabin(flight.cabin)}</span>
            </li>
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Duration</span>
              <span className="text-ink font-medium">
                {formatDuration(flight.durationMinutes)}
              </span>
            </li>
          </ul>
        </Panel>

        {/* Baggage */}
        {flight.baggageAllowance && (
          <Panel title="Baggage allowance" icon={<IconBaggage size={14} />}>
            <p className="text-sm text-ink-2 leading-relaxed">
              {flight.baggageAllowance}
            </p>
          </Panel>
        )}

        {/* Booking ref */}
        <Panel title="Booking" icon={<IconTicket size={14} />}>
          <ul className="divide-y divide-line-light text-sm">
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Booking reference</span>
              <span className="text-ink font-medium tabular">{booking.reference}</span>
            </li>
            {flight.pnr && (
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Airline PNR</span>
                <span className="text-ink font-medium tabular">{flight.pnr}</span>
              </li>
            )}
          </ul>
        </Panel>

        <ActionButton variant="secondary" icon={<IconNavigate size={18} />}>
          View at {flight.depAirport} airport
        </ActionButton>
      </div>
    </main>
    </PageEnter>
  );
}

/** True if the live value exists and is a different clock time to the booked one. */
function differsFromScheduled(liveIso: string | undefined, bookedIso: string): string | undefined {
  if (!liveIso) return undefined;
  const a = new Date(liveIso).getTime();
  const b = new Date(bookedIso).getTime();
  if (Number.isNaN(a) || Number.isNaN(b)) return undefined;
  // Only treat as "revised" if it moves by a minute or more.
  return Math.abs(a - b) >= 60 * 1000 ? liveIso : undefined;
}

/** Does the live overlay carry anything worth showing in the Live panel? */
function hasLiveDetail(live: FlightLiveStatus): boolean {
  return !!(
    live.depGate ||
    live.depTerminalLive ||
    live.checkInDesk ||
    live.boardingAt ||
    live.baggageBelt
  );
}

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

function StatusPill({ status }: { status: FlightStatusCode }) {
  const s = STATUS_STYLES[status];
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold uppercase tracking-wide ${s.cls}`}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {s.label}
    </span>
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

function Panel({
  title,
  icon,
  children,
}: {
  title: string;
  icon?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section className="bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
