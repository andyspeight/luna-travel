'use client';

import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
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
import { formatDate, formatTime, formatDuration, formatCabin } from '@/lib/format';

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const flight = findFlight(booking, params.id);

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

  const checkInOpen =
    new Date(flight.depTime).getTime() - Date.now() < 24 * 60 * 60 * 1000 &&
    new Date(flight.depTime).getTime() > Date.now();

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
          <div className="flex items-center gap-3 mt-3 mb-5">
            <span className="w-10 h-10 rounded-lg bg-white text-navy font-extrabold text-[15px] flex items-center justify-center">
              {flight.carrierCode}
            </span>
            <div>
              <div className="text-sm font-semibold">{flight.carrierName}</div>
              <div className="text-xs opacity-75">
                Flight {flight.flightNumber} · {formatCabin(flight.cabin)}
              </div>
            </div>
          </div>

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
                {formatTime(flight.depTime)}
              </div>
              <div className="text-[11px] opacity-70 mt-0.5">
                {formatDate(flight.depTime, { weekday: 'short', day: 'numeric', month: 'short' })}
                {flight.depTerminal && <span> · T{flight.depTerminal}</span>}
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
                {formatTime(flight.arrTime)}
              </div>
              <div className="text-[11px] opacity-70 mt-0.5">
                {formatDate(flight.arrTime, { weekday: 'short', day: 'numeric', month: 'short' })}
                {flight.arrTerminal && <span> · T{flight.arrTerminal}</span>}
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
                <span className="text-ink font-medium">{flight.depTerminal}</span>
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
