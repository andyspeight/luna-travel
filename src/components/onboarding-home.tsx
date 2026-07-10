'use client';

import Link from 'next/link';
import { PageEnter } from '@/components/page-enter';
import { IconPlane, IconDoc, IconChat, IconChevR } from '@/components/icons';

/**
 * First-run home for a visitor with no trip yet (no lt_session, no demo trip
 * selected). Replaces the old behaviour of showing a fake demo booking to
 * anyone who opened the app. The real way in is the booking link an agent
 * sends; "Find my trip" is the self-service fallback.
 */
export function OnboardingHome() {
  return (
    <PageEnter>
      <main className="min-h-[100dvh] flex flex-col px-6 pt-12 pb-10">
        <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-navy to-teal text-white font-bold text-2xl flex items-center justify-center shadow-lg mb-6">
            L
          </div>

          <h1 className="font-serif text-[36px] leading-[1.1] text-ink">
            Your trip, <em className="not-italic italic text-teal-dark dark:text-teal-light">in your pocket</em>.
          </h1>
          <p className="text-sm text-ink-2 mt-3 leading-relaxed">
            Luna Travel keeps everything about your holiday in one place — flights and
            live status, hotels, documents, a destination guide, and a direct line to
            your travel agent.
          </p>

          <ul className="mt-7 space-y-3">
            <Feature icon={<IconPlane size={18} />} text="Live flight status, gates and times" />
            <Feature icon={<IconDoc size={18} />} text="Tickets, vouchers and travel documents" />
            <Feature icon={<IconChat size={18} />} text="Messages and help from your agent" />
          </ul>

          <div className="mt-9 rounded-2xl bg-surface border border-line-light p-4">
            <div className="text-sm font-semibold text-ink">Add your trip</div>
            <p className="text-[13px] text-ink-2 mt-1 leading-relaxed">
              Open the booking link your travel agent sent you — it adds your trip
              automatically. Or find it with your booking reference.
            </p>
            <Link
              href="/welcome"
              className="mt-3 inline-flex items-center justify-center gap-1.5 w-full h-12 rounded-xl bg-navy text-white dark:bg-teal dark:text-navy-dark font-semibold text-[15px] active:scale-[0.98] transition-transform"
            >
              Find my trip
              <IconChevR size={18} />
            </Link>
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-3 mt-8">
          Haven&rsquo;t booked yet? Speak to your travel agent to get started.
        </p>
      </main>
    </PageEnter>
  );
}

function Feature({ icon, text }: { icon: React.ReactNode; text: string }) {
  return (
    <li className="flex items-center gap-3">
      <span className="w-9 h-9 rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light flex items-center justify-center flex-shrink-0">
        {icon}
      </span>
      <span className="text-sm text-ink-2">{text}</span>
    </li>
  );
}
