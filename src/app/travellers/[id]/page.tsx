'use client';

import { useParams, useRouter } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { ActionButton } from '@/components/action-button';
import {
  IconUser,
  IconShield,
  IconInfo,
  IconPlane,
  IconLock,
} from '@/components/icons';
import { travellerById } from '@/lib/booking-helpers';
import { initials, formatCabin } from '@/lib/format';

export default function TravellerDetailPage() {
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const { booking } = useBooking();
  const t = travellerById(booking, params.id);

  if (!t) {
    return (
      <>
        <NavBar title="Traveller" backLabel="Back" />
        <main className="px-5 pt-12 text-center">
          <p className="text-ink-2">Traveller not found.</p>
          <button
            onClick={() => router.replace('/travellers')}
            className="mt-4 text-teal-dark hover:underline text-sm"
          >
            Back to travellers
          </button>
        </main>
      </>
    );
  }

  // Seat assignments across flights for this traveller
  const seatRows = booking.flights
    .map((f) => ({
      flight: f.flightNumber,
      route: `${f.depAirport} → ${f.arrAirport}`,
      cabin: f.cabin,
      seat: f.seats?.[t.id],
    }))
    .filter((row) => row.seat);

  const ageLabel =
    t.type === 'adult'
      ? 'Adult'
      : t.type === 'child'
        ? `Child${t.age ? `, age ${t.age}` : ''}`
        : `Infant${t.age ? `, age ${t.age}` : ''}`;

  return (
    <>
      <NavBar title={t.firstName} backLabel="Travellers" />
      <PageEnter>
        <main className="px-5 pt-2 pb-6">
          {/* Identity card */}
          <section className="mt-3 p-5 rounded-3xl bg-surface border border-line-light text-center">
            <span className="inline-flex w-20 h-20 rounded-full bg-gradient-to-br from-navy to-teal-dark text-white font-bold text-2xl items-center justify-center mb-3 shadow-sm">
              {initials(t.firstName, t.lastName)}
            </span>
            <h1 className="font-serif text-[26px] leading-tight text-ink">
              {t.title ? `${t.title} ` : ''}
              {t.firstName} {t.lastName}
            </h1>
            <div className="mt-1.5 flex justify-center gap-1.5 flex-wrap">
              {t.isLead && (
                <span className="text-[10px] px-2 py-0.5 rounded-md bg-gold/15 text-amber-700 dark:text-gold font-semibold uppercase tracking-wider">
                  Lead traveller
                </span>
              )}
              <span className="text-[10px] px-2 py-0.5 rounded-md bg-surface-3 text-ink-2 font-semibold uppercase tracking-wider">
                {ageLabel}
              </span>
            </div>
          </section>

          {/* Passport */}
          <Panel title="Identity" icon={<IconShield size={14} />}>
            <ul className="divide-y divide-line-light text-sm">
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Title</span>
                <span className="text-ink font-medium">{t.title ?? '—'}</span>
              </li>
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">First name</span>
                <span className="text-ink font-medium">{t.firstName}</span>
              </li>
              <li className="py-2.5 flex justify-between">
                <span className="text-ink-2">Last name</span>
                <span className="text-ink font-medium">{t.lastName}</span>
              </li>
              {t.passportNationality && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Passport</span>
                  <span className="text-ink font-medium">
                    {t.passportNationality}
                  </span>
                </li>
              )}
              {t.type !== 'adult' && t.age !== undefined && (
                <li className="py-2.5 flex justify-between">
                  <span className="text-ink-2">Age at travel</span>
                  <span className="text-ink font-medium">{t.age}</span>
                </li>
              )}
            </ul>
          </Panel>

          {/* Privacy note */}
          <div className="mt-3 px-4 py-3 rounded-xl bg-teal/5 border border-teal/15 text-[11px] text-ink-2 inline-flex items-start gap-2 leading-relaxed">
            <IconLock size={13} className="text-teal-dark dark:text-teal-light flex-shrink-0 mt-0.5" />
            <span>
              Identity details are end-to-end encrypted and never shared with
              third parties. Your agent can update them with your permission.
            </span>
          </div>

          {/* Seats across flights */}
          {seatRows.length > 0 && (
            <Panel title="Seats" icon={<IconPlane size={14} />}>
              <ul className="divide-y divide-line-light text-sm">
                {seatRows.map((row) => (
                  <li key={row.flight} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="text-ink font-medium truncate">
                        {row.flight} · {row.route}
                      </div>
                      <div className="text-[11px] text-ink-3 mt-0.5">
                        {formatCabin(row.cabin)}
                      </div>
                    </div>
                    <span className="text-xs font-bold text-teal-dark dark:text-teal-light bg-teal/10 px-2 py-1 rounded-md tabular flex-shrink-0">
                      {row.seat}
                    </span>
                  </li>
                ))}
              </ul>
            </Panel>
          )}

          {/* Edit hint */}
          <div className="mt-4">
            <ActionButton variant="secondary" icon={<IconInfo size={16} />}>
              Request a change via your agent
            </ActionButton>
          </div>
        </main>
      </PageEnter>
    </>
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
    <section className="mt-4 bg-surface border border-line-light rounded-2xl p-4">
      <h3 className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-3">
        {icon}
        {title}
      </h3>
      {children}
    </section>
  );
}
