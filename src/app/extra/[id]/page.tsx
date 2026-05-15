'use client';

import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { ActionButton } from '@/components/action-button';
import { PageEnter } from '@/components/page-enter';
import {
  IconLounge,
  IconCar,
  IconFastTrack,
  IconUsers,
  IconClock,
  IconInfo,
  IconTicket,
  IconNavigate,
  IconPin,
} from '@/components/icons';
import { findExtra } from '@/lib/booking-helpers';
import { formatDate, formatTime } from '@/lib/format';

export default function ExtraDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const extra = findExtra(booking, params.id);

  if (!extra) {
    return (
      <>
        <NavBar title="Extra" backLabel="Back" />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">Item not found.</p>
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

  const meta = extraMeta(extra.type);

  return (
    <PageEnter>
    <main className="pb-6">
      <section
        className="relative pt-2 px-5 pb-8 text-white"
        style={{ background: meta.gradient }}
      >
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 85% 10%, rgba(255,255,255,0.18), transparent 50%)',
          }}
        />
        <div className="relative">
          <NavBar title=" " backLabel="Trip" variant="dark" />
          <div className="mt-3 mb-1 inline-flex items-center gap-2 bg-white/20 backdrop-blur px-2.5 py-1 rounded-full text-[11px] font-semibold uppercase tracking-wide">
            {meta.icon}
            {meta.label}
          </div>
          <h1 className="font-serif text-[28px] leading-tight mt-2">{extra.name}</h1>
          <p className="text-sm opacity-90 mt-1">
            {formatDate(extra.date, { weekday: 'long', day: 'numeric', month: 'long' })} ·{' '}
            {formatTime(extra.date)} · {extra.airport}
          </p>
        </div>
      </section>

      <div className="px-5 -mt-4 space-y-3">
        <Panel title="Details" icon={<IconInfo size={14} />}>
          <ul className="divide-y divide-line-light text-sm">
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2 inline-flex items-center gap-1.5">
                <IconClock size={13} /> Date
              </span>
              <span className="text-ink font-medium">
                {formatDate(extra.date, { weekday: 'short', day: 'numeric', month: 'short' })}
              </span>
            </li>
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2 inline-flex items-center gap-1.5">
                <IconClock size={13} /> Time
              </span>
              <span className="text-ink font-medium tabular">{formatTime(extra.date)}</span>
            </li>
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2 inline-flex items-center gap-1.5">
                <IconPin size={13} /> Airport
              </span>
              <span className="text-ink font-medium">{extra.airport}</span>
            </li>
            {extra.guests && (
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2 inline-flex items-center gap-1.5">
                  <IconUsers size={13} /> Guests
                </span>
                <span className="text-ink font-medium">{extra.guests}</span>
              </li>
            )}
          </ul>
        </Panel>

        {extra.notes && (
          <Panel title="Notes" icon={<IconInfo size={14} />}>
            <p className="text-sm text-ink-2 leading-relaxed">{extra.notes}</p>
          </Panel>
        )}

        <Panel title="Booking" icon={<IconTicket size={14} />}>
          <ul className="divide-y divide-line-light text-sm">
            <li className="py-2.5 flex justify-between">
              <span className="text-ink-2">Booking reference</span>
              <span className="text-ink font-medium tabular">{booking.reference}</span>
            </li>
          </ul>
        </Panel>

        <ActionButton icon={<IconNavigate size={18} />}>
          Find it at {extra.airport}
        </ActionButton>
      </div>
    </main>
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

function extraMeta(type: string) {
  switch (type) {
    case 'lounge':
      return {
        label: 'Airport lounge',
        icon: <IconLounge size={14} />,
        gradient: 'linear-gradient(135deg, #1B2B5B 0%, #0096B7 100%)',
      };
    case 'parking':
      return {
        label: 'Airport parking',
        icon: <IconCar size={14} />,
        gradient: 'linear-gradient(135deg, #0F766E 0%, #0EA5E9 100%)',
      };
    case 'fast-track':
      return {
        label: 'Security fast track',
        icon: <IconFastTrack size={14} />,
        gradient: 'linear-gradient(135deg, #C2410C 0%, #F59E0B 100%)',
      };
    default:
      return {
        label: 'Extra',
        icon: <IconInfo size={14} />,
        gradient: 'linear-gradient(135deg, #475569 0%, #94A3B8 100%)',
      };
  }
}
