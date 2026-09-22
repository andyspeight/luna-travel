'use client';

/**
 * Can somebody help me, right now?
 *
 * The review's sixth point. The app had the agency's phone number and email
 * and nothing else, so a family standing in an airport at 6am could not tell
 * whether they were about to be helped in two minutes or three hours — and
 * had no way to judge whether this was worth the out-of-hours line.
 *
 * So the card leads with the answer to that question, and the emergency route
 * is always visible rather than being the reward for scrolling.
 *
 * WHAT IT WILL NOT DO IS INVENT A PROMISE. Hours and reply times are the
 * agency's own words, set by them in the portal. An agency that has said
 * nothing gets a card with no timing on it at all — contact details and the
 * emergency number, and no claim about when anybody will answer. A made-up
 * "9 to 5" is worse than silence, because somebody plans around it.
 */

import Link from 'next/link';
import type { Agency } from '@/types/booking';
import { supportState, supportLabel } from '@/lib/support-hours';
import { IconPhone, IconMail, IconChat, IconWarning, IconChevR } from '@/components/icons';

export function SupportCard({
  agency,
  now = new Date(),
  compact = false,
}: {
  agency: Agency;
  now?: Date;
  /** The home-screen variant: the state and one way in, nothing else. */
  compact?: boolean;
}) {
  const state = supportState(agency.supportHours, now);
  const hours = supportLabel(state);
  const open = state.kind === 'open';

  const tel = (n?: string) => (n ? `tel:${n.replace(/\s/g, '')}` : undefined);
  const callHref = tel(agency.phone);
  const emergencyHref = tel(agency.emergencyPhone);

  if (compact) {
    return (
      <Link
        href="/help"
        className="mb-4 flex items-center gap-3 rounded-2xl border border-line-light bg-surface px-4 py-3 min-h-[44px]"
      >
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light">
          <IconChat size={17} />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-[14px] font-semibold text-ink">
            Help from {agency.name || 'your travel team'}
          </span>
          <span className="block truncate text-[12px] text-ink-2">
            {hours ?? (agency.replyWithin ? `Replies ${agency.replyWithin}` : 'Message, call or email')}
          </span>
        </span>
        <IconChevR size={16} className="flex-none text-ink-3" />
      </Link>
    );
  }

  return (
    <section className="overflow-hidden rounded-2xl border border-line-light bg-surface">
      <div className="p-4">
        <h2 className="text-[15px] font-semibold text-ink">
          {agency.name || 'Your travel team'}
        </h2>

        {/* The answer to the actual question, or nothing. */}
        {hours && (
          <p className="mt-1.5 flex items-center gap-1.5 text-[13px]">
            <span
              aria-hidden
              className={`h-2 w-2 rounded-full ${open ? 'bg-success' : 'bg-ink-3'}`}
            />
            <span className={open ? 'font-medium text-success-ink' : 'text-ink-2'}>{hours}</span>
          </p>
        )}
        {agency.replyWithin && (
          <p className="mt-1 text-[13px] text-ink-2">Messages answered {agency.replyWithin}.</p>
        )}
        {!hours && !agency.replyWithin && (
          <p className="mt-1 text-[13px] text-ink-2">
            Message them here, or call during their working hours.
          </p>
        )}
      </div>

      <div className="divide-y divide-line-light border-t border-line-light">
        <Row
          href="/me"
          icon={<IconChat size={17} />}
          title="Send a message"
          sub="Stays with your booking, so they have the details"
        />
        {callHref && (
          <Row href={callHref} icon={<IconPhone size={17} />} title="Call" sub={agency.phone} />
        )}
        {agency.email && (
          <Row
            href={`mailto:${agency.email}`}
            icon={<IconMail size={17} />}
            title="Email"
            sub={agency.email}
          />
        )}
      </div>

      {/* Always visible, never the reward for scrolling. The whole reason a
          traveller needs to know the office is shut is to decide whether to
          use this instead. */}
      {emergencyHref && (
        <a
          href={emergencyHref}
          className="flex min-h-[44px] items-center gap-3 border-t border-line-light bg-warning/10 px-4 py-3"
        >
          <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-warning/20 text-warning-ink">
            <IconWarning size={17} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[14px] font-semibold text-ink">
              Urgent, any time of day
            </span>
            <span className="block truncate text-[12px] text-ink-2">{agency.emergencyPhone}</span>
          </span>
          <IconChevR size={16} className="flex-none text-ink-3" />
        </a>
      )}
    </section>
  );
}

function Row({
  href,
  icon,
  title,
  sub,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  const external = href.startsWith('tel:') || href.startsWith('mailto:');
  const body = (
    <>
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-xl bg-teal/10 text-teal-dark dark:text-teal-light">
        {icon}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[14px] font-medium text-ink">{title}</span>
        {sub && <span className="block truncate text-[12px] text-ink-2">{sub}</span>}
      </span>
      <IconChevR size={16} className="flex-none text-ink-3" />
    </>
  );
  const cls = 'flex min-h-[44px] items-center gap-3 px-4 py-3';
  return external ? (
    <a href={href} className={cls}>
      {body}
    </a>
  ) : (
    <Link href={href} className={cls}>
      {body}
    </Link>
  );
}
