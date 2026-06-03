'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { useFlightLive } from '@/lib/use-flight-live';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
import { MapSheet } from '@/components/map-sheet';
import { FlightHero, LiveNowPanel } from '@/components/flight-card';
import {
  IconCheck,
  IconClock,
  IconBaggage,
  IconTicket,
  IconUsers,
  IconNavigate,
} from '@/components/icons';
import { findFlight } from '@/lib/booking-helpers';
import { formatDate, formatTime, formatDuration, formatCabin, formatTerminal } from '@/lib/format';

// Online check-in genuinely happens on the airline's own site, so this is the
// one action that intentionally opens externally. Known carriers map directly;
// anything else falls back to a search that lands on the airline check-in page.
const CHECKIN_URLS: Record<string, string> = {
  BA: 'https://www.britishairways.com/travel/olci/public/en_gb',
  EY: 'https://www.etihad.com/en/manage/check-in',
  EK: 'https://www.emirates.com/english/manage-booking/online-check-in/',
  U2: 'https://www.easyjet.com/en/login',
  LS: 'https://www.jet2.com/bookings/login',
  FR: 'https://www.ryanair.com/gb/en/check-in',
  VS: 'https://www.virginatlantic.com/gb/en/my-booking',
  QR: 'https://www.qatarairways.com/en/manage-booking.html',
};

function checkInUrl(carrierCode: string, carrierName: string): string {
  return (
    CHECKIN_URLS[carrierCode] ??
    `https://www.google.com/search?q=${encodeURIComponent(`${carrierName} online check in`)}`
  );
}

export default function FlightDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const flight = findFlight(booking, params.id);
  const { getLive } = useFlightLive();
  const live = flight ? getLive(flight.id) : undefined;
  const [showMap, setShowMap] = useState(false);

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

  const liveStatus = live?.statusCode;
  const checkInOpenLive = liveStatus === 'CheckIn';
  const checkInOpenHeuristic =
    new Date(flight.depTime).getTime() - Date.now() < 24 * 60 * 60 * 1000 &&
    new Date(flight.depTime).getTime() > Date.now();
  const checkInOpen = checkInOpenLive || checkInOpenHeuristic;

  return (
    <PageEnter>
      <main className="pb-6">
        {/* Hero with NavBar overlaid */}
        <div className="relative">
          <div
            className="absolute top-0 inset-x-0 z-10 px-5 pt-2"
            style={{ background: 'transparent' }}
          >
            <NavBar title={flight.flightNumber} backLabel="Trip" variant="dark" />
          </div>
          <FlightHero flight={flight} live={live} />
        </div>

        <div className="px-5 pt-4 space-y-3">
          {/* Live now (shared component; renders nothing without live detail) */}
          <LiveNowPanel flight={flight} live={live} />

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

          <ActionButton
            icon={<IconCheck size={18} />}
            onClick={() =>
              window.open(
                checkInUrl(flight.carrierCode, flight.carrierName),
                '_blank',
                'noopener,noreferrer',
              )
            }
          >
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
                <span className="text-ink font-medium">{formatDuration(flight.durationMinutes)}</span>
              </li>
            </ul>
          </Panel>

          {flight.baggageAllowance && (
            <Panel title="Baggage allowance" icon={<IconBaggage size={14} />}>
              <p className="text-sm text-ink-2 leading-relaxed">{flight.baggageAllowance}</p>
            </Panel>
          )}

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

          <ActionButton
            variant="secondary"
            icon={<IconNavigate size={18} />}
            onClick={() => setShowMap(true)}
          >
            View at {flight.depAirport} airport
          </ActionButton>
        </div>
      </main>

      {showMap && (
        <MapSheet
          title={flight.depAirportName || `${flight.depAirport} airport`}
          subtitle={flight.depCity}
          query={`${flight.depAirportName || flight.depAirport} airport`}
          onClose={() => setShowMap(false)}
        />
      )}
    </PageEnter>
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
