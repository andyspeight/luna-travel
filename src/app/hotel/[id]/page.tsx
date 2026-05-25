'use client';

import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
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
import { formatBoard, formatDate, formatTime } from '@/lib/format';
import { destinationHero } from '@/lib/hero';

export default function HotelDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
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
          <ActionButton icon={<IconNavigate size={18} />}>Open in Maps</ActionButton>
          <ActionButton variant="secondary" icon={<IconInfo size={18} />}>
            Hotel info & policies
          </ActionButton>
        </div>
      </div>
    </main>
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
