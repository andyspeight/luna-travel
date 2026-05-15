'use client';

import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { IconChevR, IconInfo } from '@/components/icons';
import { initials } from '@/lib/format';

export default function TravellersPage() {
  const { booking } = useBooking();
  const adults = booking.travellers.filter((t) => t.type === 'adult').length;
  const children = booking.travellers.filter((t) => t.type === 'child').length;
  const infants = booking.travellers.filter((t) => t.type === 'infant').length;

  const summary = [
    adults && `${adults} adult${adults === 1 ? '' : 's'}`,
    children && `${children} child${children === 1 ? '' : 'ren'}`,
    infants && `${infants} infant${infants === 1 ? '' : 's'}`,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <>
      <NavBar title="Travellers" backLabel="Me" />
      <PageEnter>
        <main className="px-5 pt-2 pb-6">
          <header className="py-3">
            <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">
              Your party
            </h1>
            <p className="text-sm text-ink-2 mt-1.5">
              {booking.travellers.length} traveller
              {booking.travellers.length === 1 ? '' : 's'} · {summary}
            </p>
          </header>

          <ul className="space-y-2 mt-4">
            {booking.travellers.map((t) => (
              <li key={t.id}>
                <Link
                  href={`/travellers/${t.id}`}
                  className="flex items-center gap-3 p-3.5 rounded-2xl bg-surface border border-line-light hover:shadow-sm transition-shadow"
                >
                  <span className="w-12 h-12 rounded-full bg-gradient-to-br from-navy to-teal-dark text-white font-bold text-base flex items-center justify-center flex-shrink-0">
                    {initials(t.firstName, t.lastName)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[15px] font-semibold text-ink">
                      {t.title ? `${t.title} ` : ''}
                      {t.firstName} {t.lastName}
                    </div>
                    <div className="flex flex-wrap gap-1.5 mt-1">
                      {t.isLead && <Tag tone="lead">Lead</Tag>}
                      <Tag>
                        {t.type === 'adult'
                          ? 'Adult'
                          : t.type === 'child'
                            ? `Child${t.age ? ` · ${t.age}` : ''}`
                            : `Infant${t.age ? ` · ${t.age}` : ''}`}
                      </Tag>
                      {t.passportNationality && (
                        <Tag>{t.passportNationality} passport</Tag>
                      )}
                    </div>
                  </div>
                  <IconChevR size={18} className="text-ink-3 flex-shrink-0" />
                </Link>
              </li>
            ))}
          </ul>

          {/* Combined special requests across all hotels */}
          {booking.hotels.some((h) => h.specialRequests) && (
            <section className="mt-6">
              <h2 className="text-sm font-semibold text-ink tracking-tight px-1 mb-2">
                Special requests
              </h2>
              <div className="space-y-2">
                {booking.hotels
                  .filter((h) => h.specialRequests)
                  .map((h) => (
                    <article
                      key={h.id}
                      className="p-4 rounded-2xl bg-surface border border-line-light"
                    >
                      <div className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mb-1.5 inline-flex items-center gap-1.5">
                        <IconInfo size={13} />
                        {h.name}
                      </div>
                      <p className="text-sm text-ink-2 leading-relaxed">
                        {h.specialRequests}
                      </p>
                    </article>
                  ))}
                <p className="text-[11px] text-ink-3 italic px-1 mt-2">
                  Requests, not guarantees — hotels do their best on arrival.
                </p>
              </div>
            </section>
          )}
        </main>
      </PageEnter>
    </>
  );
}

function Tag({
  children,
  tone = 'default',
}: {
  children: React.ReactNode;
  tone?: 'default' | 'lead';
}) {
  return (
    <span
      className={[
        'text-[10px] px-2 py-0.5 rounded-md font-semibold uppercase tracking-wider',
        tone === 'lead'
          ? 'bg-gold/15 text-amber-700 dark:text-gold'
          : 'bg-surface-3 text-ink-2',
      ].join(' ')}
    >
      {children}
    </span>
  );
}
