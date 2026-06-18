'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
import { MapSheet } from '@/components/map-sheet';
import {
  IconPin,
  IconStar,
  IconBed,
  IconUsers,
  IconClock,
  IconNavigate,
  IconInfo,
  IconCheck,
} from '@/components/icons';
import { findHotel } from '@/lib/booking-helpers';
import { PhotoGallery } from '@/components/photo-gallery';
import { formatBoard, formatDate, formatTime } from '@/lib/format';
import { destinationHero } from '@/lib/hero';
import type { Hotel } from '@/types/booking';

export default function HotelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const [showMap, setShowMap] = useState(false);
  const [showInfo, setShowInfo] = useState(false);
  const hotel = findHotel(booking, params.id);

  if (!hotel) {
    return (
      <>
        <NavBar title="Hotel" backLabel="Back" />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">Hotel not found.</p>
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

  const board = formatBoard(hotel.boardBasis);
  const hero = destinationHero(hotel.countryCode);
  const adults = booking.travellers.filter((t) => t.type === 'adult').length;
  const children = booking.travellers.filter((t) => t.type === 'child').length;

  return (
    <PageEnter>
    <main className="pb-6">
      {/* Hero */}
      <section className="relative h-60 text-white" style={{ background: hero.gradient }}>
        {hero.image && (
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: `center/cover no-repeat url("${hero.image}")` }}
          />
        )}
        <div
          aria-hidden
          className="absolute inset-0"
          style={{ background: hero.glow }}
        />
        <div
          aria-hidden
          className="absolute inset-x-0 bottom-0 h-24"
          style={{
            background:
              'linear-gradient(180deg, transparent 0%, rgba(11,29,62,0.55) 100%)',
          }}
        />
        <div className="relative">
          <NavBar title=" " backLabel="Trip" variant="dark" />
        </div>
        <div className="absolute right-4 top-16 z-10">
          <span className="inline-flex items-center gap-1.5 bg-white/95 text-navy px-2.5 py-1 rounded-full text-[11px] font-semibold">
            <IconCheck size={12} />
            Confirmed
          </span>
        </div>
      </section>

      <div className="px-5 -mt-2">
        {hotel.photos && hotel.photos.length > 0 && (
          <PhotoGallery photos={hotel.photos} className="mb-3 pt-1" />
        )}
        {/* Stars */}
        {hotel.stars && hotel.stars > 0 && (
          <div className="flex items-center gap-0.5 text-gold mb-1">
            {Array.from({ length: hotel.stars }).map((_, i) => (
              <IconStar key={i} size={14} />
            ))}
          </div>
        )}

        {/* Name & location */}
        <h1 className="font-serif text-[28px] leading-tight text-ink mt-1">
          {hotel.name}
        </h1>
        <div className="mt-1.5 text-sm text-ink-2 inline-flex items-center gap-1.5">
          <IconPin size={14} />
          <span>
            {[hotel.resort, hotel.city, hotel.country].filter(Boolean).join(' · ')}
          </span>
        </div>

        {/* Stat strip */}
        <div className="grid grid-cols-3 gap-2 mt-4">
          <Stat
            icon={<IconBed size={16} />}
            value={`${hotel.nights} night${hotel.nights === 1 ? '' : 's'}`}
            label="Stay"
          />
          <Stat
            icon={<IconUsers size={16} />}
            value={`${booking.travellers.length} guest${booking.travellers.length === 1 ? '' : 's'}`}
            label={
              children > 0
                ? `${adults} adult${adults === 1 ? '' : 's'} · ${children} child${children === 1 ? '' : 'ren'}`
                : 'Party'
            }
          />
          {board && <Stat icon={<IconInfo size={16} />} value={board} label="Board" />}
        </div>

        {/* Check-in/out info */}
        <section className="mt-4 bg-surface border border-line-light rounded-2xl p-4">
          <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
            <IconClock size={14} />
            Stay
          </h3>
          <ul className="divide-y divide-line-light text-sm">
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Check in</span>
              <span className="text-ink font-medium">
                {formatDate(hotel.checkIn, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                {formatTime(hotel.checkIn)}
              </span>
            </li>
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Check out</span>
              <span className="text-ink font-medium">
                {formatDate(hotel.checkOut, { weekday: 'short', day: 'numeric', month: 'short' })} ·{' '}
                {formatTime(hotel.checkOut)}
              </span>
            </li>
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Room</span>
              <span className="text-ink font-medium text-right max-w-[60%]">
                {hotel.roomName}
              </span>
            </li>
            {hotel.hotelReference && (
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Hotel reference</span>
                <span className="text-ink font-medium tabular">{hotel.hotelReference}</span>
              </li>
            )}
          </ul>
        </section>

        {/* Special requests */}
        {hotel.specialRequests && (
          <section className="mt-3 bg-surface border border-line-light rounded-2xl p-4">
            <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-2">
              <IconInfo size={14} />
              Special requests
            </h3>
            <p className="text-sm text-ink-2 leading-relaxed">{hotel.specialRequests}</p>
            <p className="text-[11px] text-ink-3 mt-2 italic">
              Requests, not guarantees — hotel will do their best on arrival.
            </p>
          </section>
        )}

        {/* Location & actions */}
        <div className="mt-4 space-y-3">
          <ActionButton icon={<IconNavigate size={18} />} onClick={() => setShowMap(true)}>
            Open in Maps
          </ActionButton>
          <ActionButton
            variant="secondary"
            icon={<IconInfo size={18} />}
            onClick={() => setShowInfo(true)}
          >
            Hotel info &amp; policies
          </ActionButton>
        </div>
      </div>
    </main>

    {showMap && (
      <MapSheet
        title={hotel.name}
        subtitle={[hotel.resort, hotel.city, hotel.country].filter(Boolean).join(', ')}
        lat={hotel.lat}
        lng={hotel.lng}
        query={[hotel.name, hotel.resort, hotel.city, hotel.country].filter(Boolean).join(', ')}
        onClose={() => setShowMap(false)}
      />
    )}
    {showInfo && <HotelInfoSheet hotel={hotel} board={board} onClose={() => setShowInfo(false)} />}
    </PageEnter>
  );
}

function Stat({
  icon,
  value,
  label,
}: {
  icon: React.ReactNode;
  value: string;
  label: string;
}) {
  return (
    <div className="bg-surface border border-line-light rounded-2xl p-3 text-center">
      <div className="w-7 h-7 mx-auto mb-1.5 rounded-lg bg-teal/10 text-navy dark:text-teal-light flex items-center justify-center">
        {icon}
      </div>
      <div className="text-[13px] font-bold text-ink leading-tight">{value}</div>
      <div className="text-[10px] text-ink-3 uppercase tracking-wider mt-0.5">{label}</div>
    </div>
  );
}

/**
 * In-app "Hotel info & policies" sheet. Shows the real stay details we hold
 * (times, board, room, reference, requests) plus standard, universally-true
 * policy notes. We never fabricate supplier specifics (amenities, descriptions).
 */
function HotelInfoSheet({
  hotel,
  board,
  onClose,
}: {
  hotel: Hotel;
  board: string | null;
  onClose: () => void;
}) {
  const rows: { label: string; value: string }[] = [
    { label: 'Check-in from', value: formatTime(hotel.checkIn) },
    { label: 'Check-out by', value: formatTime(hotel.checkOut) },
  ];
  if (board) rows.push({ label: 'Board', value: board });
  rows.push({ label: 'Room', value: hotel.roomName });
  if (hotel.hotelReference) rows.push({ label: 'Hotel reference', value: hotel.hotelReference });

  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 animate-fade-in"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label="Hotel info and policies"
    >
      <div
        className="w-full sm:max-w-md max-h-[92vh] overflow-y-auto bg-surface rounded-t-3xl sm:rounded-3xl p-5 animate-slide-up shadow-xl"
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: 'calc(1.5rem + var(--safe-bottom))' }}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3/40" />
        <h2 className="text-base font-semibold text-ink mb-0.5">Hotel info &amp; policies</h2>
        <p className="text-xs text-ink-2 mb-4">{hotel.name}</p>

        <ul className="divide-y divide-line-light text-sm rounded-2xl border border-line-light px-4">
          {rows.map((r) => (
            <li key={r.label} className="py-2.5 flex justify-between gap-3">
              <span className="text-ink-2 flex-shrink-0">{r.label}</span>
              <span className="text-ink font-medium text-right">{r.value}</span>
            </li>
          ))}
        </ul>

        {hotel.specialRequests && (
          <div className="mt-3 rounded-2xl border border-line-light p-4">
            <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1">
              Special requests
            </div>
            <p className="text-sm text-ink-2 leading-relaxed">{hotel.specialRequests}</p>
          </div>
        )}

        <div className="mt-3 rounded-2xl bg-surface-2 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-2">
            Good to know
          </div>
          <ul className="space-y-1.5 text-[13px] text-ink-2 leading-relaxed list-disc pl-4">
            <li>Photo ID and the lead guest&rsquo;s booking reference may be requested at check-in.</li>
            <li>Special requests are subject to availability and are not guaranteed.</li>
            <li>Check-in and check-out times are set by the hotel and can vary with room readiness.</li>
          </ul>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-full mt-4 h-10 text-sm font-medium text-ink-2 hover:text-ink"
        >
          Close
        </button>
      </div>
    </div>
  );
}
