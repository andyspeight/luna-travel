'use client';

import { useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import {
  IconCoin,
  IconClock,
  IconInfo,
  IconWarning,
  IconShield,
  IconPin,
} from '@/components/icons';
import { destinationHero } from '@/lib/hero';
import { getDestinationGuide } from '@/data/destinations';

const TABS = ['Overview', 'Essentials', 'Visa & safety', 'Insider tips'] as const;
type Tab = (typeof TABS)[number];

export default function DestinationGuidePage() {
  const { booking } = useBooking();
  const guide = getDestinationGuide(booking.primaryCountryCode);
  const hero = destinationHero(booking.primaryCountryCode);
  const [tab, setTab] = useState<Tab>('Overview');

  if (!guide) {
    return (
      <>
        <NavBar title="Destination" backLabel="Trip" />
        <PageEnter>
          <main className="px-5 pt-12 text-center">
            <p className="text-ink-2">
              Destination guide for {booking.destinationLabel} is coming soon.
            </p>
          </main>
        </PageEnter>
      </>
    );
  }

  return (
    <PageEnter>
      <main className="pb-6">
        {/* Hero */}
        <section
          className="relative h-72 text-white"
          style={{ background: hero.gradient }}
        >
          <div
            aria-hidden
            className="absolute inset-0"
            style={{ background: hero.glow }}
          />
          <div
            aria-hidden
            className="absolute inset-x-0 bottom-0 h-32"
            style={{
              background:
                'linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.6) 100%)',
            }}
          />
          <div className="relative">
            <NavBar title=" " backLabel="Trip" variant="dark" />
          </div>
          <div className="absolute bottom-5 left-5 right-5 z-10">
            <div className="text-[11px] uppercase tracking-[0.18em] text-white/85 inline-flex items-center gap-1.5 mb-2">
              <IconPin size={12} />
              {guide.region}
            </div>
            <h1 className="font-serif text-[40px] leading-none tracking-tight">
              <em>{guide.name}</em>
            </h1>
            <p className="text-sm text-white/85 mt-1.5">{guide.weatherSummary}</p>
          </div>
        </section>

        {/* Tabs */}
        <div className="sticky top-0 z-20 bg-surface border-b border-line-light">
          <div className="flex gap-1.5 px-4 py-2.5 overflow-x-auto scrollbar-none">
            {TABS.map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className={[
                  'px-3.5 py-1.5 rounded-full text-xs font-semibold whitespace-nowrap transition-colors',
                  tab === t
                    ? 'bg-navy text-white dark:bg-teal dark:text-navy-dark'
                    : 'bg-surface-3 text-ink-2 hover:text-ink',
                ].join(' ')}
              >
                {t}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pt-4">
          {tab === 'Overview' && (
            <>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.introduction}
              </p>
              <h2 className="text-base font-semibold text-ink mt-5 mb-2">
                Why we love it
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.whyWeLoveIt}
              </p>

              {/* Quick facts */}
              <div className="grid grid-cols-2 gap-2 mt-5">
                <Fact icon={<IconCoin size={14} />} label="Currency" value={guide.currency} />
                <Fact icon={<IconClock size={14} />} label="Time zone" value={guide.timeZone} />
                <Fact
                  icon={<IconInfo size={14} />}
                  label="Languages"
                  value={guide.languages.join(' · ')}
                />
                <Fact icon={<IconInfo size={14} />} label="Weather" value={guide.weatherSummary} />
              </div>
            </>
          )}

          {tab === 'Essentials' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2">
                The basics
              </h2>
              <div className="space-y-2">
                <EssentialRow
                  icon={<IconCoin size={14} />}
                  label="Currency"
                  value={guide.currency}
                />
                <EssentialRow
                  icon={<IconClock size={14} />}
                  label="Time zone"
                  value={guide.timeZone}
                />
                <EssentialRow
                  icon={<IconInfo size={14} />}
                  label="Languages"
                  value={guide.languages.join(', ')}
                />
                <EssentialRow
                  icon={<IconInfo size={14} />}
                  label="Weather"
                  value={guide.weatherSummary}
                />
                {guide.emergencyNumber && (
                  <EssentialRow
                    icon={<IconWarning size={14} />}
                    label="Emergency"
                    value={guide.emergencyNumber}
                  />
                )}
              </div>
            </>
          )}

          {tab === 'Visa & safety' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2 inline-flex items-center gap-1.5">
                <IconShield size={16} />
                Entry requirements
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.visaSummary}
              </p>

              {guide.emergencyNumber && (
                <>
                  <h2 className="text-base font-semibold text-ink mt-5 mb-2 inline-flex items-center gap-1.5">
                    <IconWarning size={16} />
                    In case of emergency
                  </h2>
                  <div className="p-4 rounded-2xl bg-danger/5 border border-danger/15">
                    <div className="text-[11px] uppercase tracking-wider font-semibold text-danger mb-1">
                      Emergency number
                    </div>
                    <a
                      href={`tel:${guide.emergencyNumber.replace(/[^\d+]/g, '')}`}
                      className="text-base font-semibold text-ink"
                    >
                      {guide.emergencyNumber}
                    </a>
                  </div>
                </>
              )}

              <p className="text-[11px] text-ink-3 italic mt-4">
                Always check the latest FCDO travel advice before you travel.
                Your agent can confirm specifics.
              </p>
            </>
          )}

          {tab === 'Insider tips' && (
            <>
              <h2 className="text-base font-semibold text-ink mb-2">
                What we&rsquo;d tell a friend
              </h2>
              <p className="text-sm text-ink-2 leading-relaxed">
                {guide.insiderTips}
              </p>
            </>
          )}
        </div>
      </main>
    </PageEnter>
  );
}

function Fact({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="p-3 rounded-xl bg-surface border border-line-light">
      <div className="w-7 h-7 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center mb-2">
        {icon}
      </div>
      <div className="text-[10px] uppercase tracking-wider text-ink-3 mb-0.5">{label}</div>
      <div className="text-[13px] font-semibold text-ink leading-snug">{value}</div>
    </div>
  );
}

function EssentialRow({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-3 p-3.5 rounded-2xl bg-surface border border-line-light">
      <span className="w-8 h-8 rounded-lg bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">
          {label}
        </div>
        <div className="text-sm font-medium text-ink mt-0.5">{value}</div>
      </div>
    </div>
  );
}
