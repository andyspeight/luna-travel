'use client';

/**
 * /help — the one screen that answers "how do I get hold of someone?"
 *
 * The review's sixth point: support was reachable, but only if you knew to
 * look under "Me", and once you found a phone number nothing told you whether
 * anybody would pick it up. The important thing is not the number, it is
 * knowing whether to wait or to use the out-of-hours line.
 *
 * Luna sits below the humans on purpose. It is genuinely faster for "what is
 * my baggage allowance", and genuinely the wrong answer for "our flight has
 * been cancelled", so it is offered as the quick option rather than as the
 * front door.
 */

import { useBooking } from '@/lib/booking-context';
import { NavBar } from '@/components/nav-bar';
import { PageEnter } from '@/components/page-enter';
import { SupportCard } from '@/components/support-card';
import Link from 'next/link';
import { IconChat, IconChevR } from '@/components/icons';

export default function HelpPage() {
  const { booking } = useBooking();

  return (
    <PageEnter>
      <NavBar title="Help" backLabel="Back" />
      <main className="px-5 pb-8 pt-2">
        <h1 className="font-serif text-[28px] leading-tight text-ink">Get help</h1>
        <p className="mt-1.5 text-sm text-ink-2">
          Your booking is with {booking.agency.name || 'your travel agency'}. They can see
          everything on it.
        </p>

        <div className="mt-4">
          <SupportCard agency={booking.agency} />
        </div>

        {/* The quick answer, clearly labelled as what it is. */}
        <h2 className="mt-6 mb-2 px-1 text-[11px] font-semibold uppercase tracking-wider text-ink-3">
          Quick answers
        </h2>
        <Link
          href="/luna"
          className="flex min-h-[44px] items-center gap-3 rounded-2xl border border-line-light bg-surface px-4 py-3"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light">
            <IconChat size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-medium text-ink">Ask Luna</span>
            <span className="block text-[12px] text-ink-2">
              Instant, and reads your booking — but it is not your travel agent
            </span>
          </span>
          <IconChevR size={16} className="flex-none text-ink-3" />
        </Link>
      </main>
    </PageEnter>
  );
}
