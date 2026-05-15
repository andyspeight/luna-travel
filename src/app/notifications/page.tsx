'use client';

import { useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import {
  IconBell,
  IconPlane,
  IconBed,
  IconLounge,
  IconChat,
  IconWarning,
  IconShield2,
  IconPin,
} from '@/components/icons';
import { formatDayMonth } from '@/lib/format';

interface NotificationPreference {
  id: string;
  title: string;
  description: string;
  enabled: boolean;
  icon: React.ReactNode;
}

interface SamplePush {
  id: string;
  category: string;
  title: string;
  body: string;
  when: string;
}

export default function NotificationsPage() {
  const { booking } = useBooking();

  const [prefs, setPrefs] = useState<NotificationPreference[]>([
    {
      id: 'flight',
      title: 'Flight updates',
      description: 'Check-in opens, gate changes, delays, baggage',
      enabled: true,
      icon: <IconPlane size={18} />,
    },
    {
      id: 'hotel',
      title: 'Hotel reminders',
      description: 'Check-in/out times, hotel messages',
      enabled: true,
      icon: <IconBed size={18} />,
    },
    {
      id: 'extras',
      title: 'Airport extras',
      description: 'Lounge access, parking, fast track',
      enabled: true,
      icon: <IconLounge size={18} />,
    },
    {
      id: 'luna',
      title: 'From Luna',
      description: 'Trip tips, destination weather, packing nudges',
      enabled: true,
      icon: <IconChat size={18} />,
    },
    {
      id: 'urgent',
      title: 'Urgent only',
      description: 'Override quiet hours for cancellations and safety',
      enabled: true,
      icon: <IconWarning size={18} />,
    },
  ]);

  const toggle = (id: string) => {
    setPrefs((prev) =>
      prev.map((p) => (p.id === id ? { ...p, enabled: !p.enabled } : p))
    );
  };

  const samples = sampleNotifications(booking);

  return (
    <>
      <NavBar title="Notifications" backLabel="Me" />
      <PageEnter>
        <main className="px-5 pt-2 pb-6">
          <header className="py-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
              Notifications
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">
              We&rsquo;ll only send you what matters for this trip.
            </p>
          </header>

          {/* Preferences */}
          <section className="mt-4 rounded-2xl bg-surface border border-line-light overflow-hidden">
            <div className="divide-y divide-line-light">
              {prefs.map((p) => (
                <PrefRow key={p.id} pref={p} onToggle={() => toggle(p.id)} />
              ))}
            </div>
          </section>

          <p className="text-[11px] text-ink-3 mt-3 px-1 leading-relaxed">
            Quiet hours: 22:00 – 07:00 in your destination&rsquo;s time zone.
            Urgent notifications (cancellations, safety) override quiet hours.
          </p>

          {/* Preview */}
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mt-7 mb-2 px-1">
            What they&rsquo;ll look like
          </h2>
          <p className="text-xs text-ink-2 px-1 mb-3 leading-relaxed">
            A few examples from your {booking.destinationLabel} trip:
          </p>

          <ul className="space-y-2.5">
            {samples.map((s) => (
              <li key={s.id}>
                <PushPreview push={s} />
              </li>
            ))}
          </ul>

          <p className="text-[11px] text-ink-3 mt-5 px-1 inline-flex items-start gap-1.5 leading-relaxed">
            <IconShield2 size={12} className="flex-shrink-0 mt-0.5" />
            <span>Push tokens are stored encrypted. You can disable any category here at any time.</span>
          </p>
        </main>
      </PageEnter>
    </>
  );
}

function PrefRow({
  pref,
  onToggle,
}: {
  pref: NotificationPreference;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      role="switch"
      aria-checked={pref.enabled}
      className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal/10 text-teal-dark dark:text-teal-light">
        {pref.icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink">{pref.title}</div>
        <div className="text-xs text-ink-2 mt-0.5">{pref.description}</div>
      </div>
      <span
        aria-hidden
        className={[
          'relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors',
          pref.enabled ? 'bg-teal' : 'bg-surface-3',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            pref.enabled ? 'translate-x-[22px]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

/**
 * Faithful iOS-style notification preview — looks the same as a real lock-screen
 * push, so the demo doesn't need any imagination.
 */
function PushPreview({ push }: { push: SamplePush }) {
  return (
    <div className="rounded-2xl px-3.5 py-3 bg-surface border border-line-light shadow-sm">
      <div className="flex items-center gap-2 mb-1">
        <span
          aria-hidden
          className="w-5 h-5 rounded-md bg-gradient-to-br from-navy to-teal flex-shrink-0"
        />
        <span className="text-[10px] font-semibold uppercase tracking-[0.06em] text-ink-2">
          Luna Travel
        </span>
        <span className="ml-auto text-[10px] text-ink-3">{push.when}</span>
      </div>
      <div className="text-sm font-semibold text-ink leading-snug">{push.title}</div>
      <div className="text-xs text-ink-2 mt-0.5 leading-snug">{push.body}</div>
    </div>
  );
}

function sampleNotifications(booking: ReturnType<typeof useBooking>['booking']): SamplePush[] {
  const out: SamplePush[] = [];

  // Flight check-in opening
  const firstFlight = booking.flights[0];
  if (firstFlight) {
    out.push({
      id: 'n1',
      category: 'flight',
      title: 'Online check-in is open ✈️',
      body: `${firstFlight.carrierName} ${firstFlight.flightNumber} to ${firstFlight.arrCity} opens for check-in. Tap to claim your seats together.`,
      when: 'now',
    });
  }

  // Lounge confirmation
  const lounge = booking.airportExtras.find((x) => x.type === 'lounge');
  if (lounge) {
    out.push({
      id: 'n2',
      category: 'extras',
      title: `${lounge.name} confirmed`,
      body: `You're sorted before the gate — ${lounge.guests ?? 'all'} guests, ${formatDayMonth(lounge.date)}.`,
      when: 'yesterday',
    });
  }

  // Weather nudge
  out.push({
    id: 'n3',
    category: 'luna',
    title: `${booking.destinationLabel} weather looks lovely`,
    body: '31° and clear all week. Want a swimwear packing nudge?',
    when: '2h ago',
  });

  // Hotel check-in
  const hotel = booking.hotels[0];
  if (hotel) {
    out.push({
      id: 'n4',
      category: 'hotel',
      title: `Arriving at ${hotel.name}?`,
      body: 'Check-in is from 15:00. Early arrivals can drop bags at reception.',
      when: 'tomorrow',
    });
  }

  // Trip nearing
  out.push({
    id: 'n5',
    category: 'luna',
    title: '24 hours to go ✨',
    body: `Quick reminder: passport, sunglasses, the docs are in the app — happy travels, ${
      (booking.travellers.find((t) => t.isLead) ?? booking.travellers[0]).firstName
    }.`,
    when: 'in 2 weeks',
  });

  return out;
}
