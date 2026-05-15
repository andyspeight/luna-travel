'use client';

import Link from 'next/link';
import { useBooking } from '@/lib/booking-context';
import { useTheme } from '@/lib/theme-context';
import { useCover } from '@/lib/cover-context';
import { PageEnter } from '@/components/page-enter';
import {
  IconSun,
  IconMoon,
  IconUsers,
  IconPhone,
  IconMail,
  IconBell,
  IconHelp,
  IconLogOut,
  IconChevR,
  IconExternal,
  IconWarning,
  IconShield2,
  IconPin,
} from '@/components/icons';
import { initials } from '@/lib/format';

export default function MePage() {
  const { booking } = useBooking();
  const { theme, toggle } = useTheme();
  const { coverEnabled, toggle: toggleCover } = useCover();
  const lead = booking.travellers.find((t) => t.isLead) ?? booking.travellers[0];

  return (
    <PageEnter>
      <main className="px-5 pt-2 pb-6">
        <header className="py-3">
          <h1 className="text-[28px] font-bold tracking-tight text-ink leading-none">Me</h1>
        </header>

        {/* Identity card */}
        <section className="mt-2 p-4 rounded-3xl bg-surface border border-line-light flex items-center gap-3.5">
          <span className="w-14 h-14 rounded-full bg-gradient-to-br from-navy to-teal-dark text-white font-bold text-lg flex items-center justify-center flex-shrink-0 shadow-sm">
            {initials(lead.firstName, lead.lastName)}
          </span>
          <div className="flex-1 min-w-0">
            <div className="text-base font-semibold text-ink truncate">
              {lead.title ? `${lead.title} ` : ''}
              {lead.firstName} {lead.lastName}
            </div>
            <div className="text-xs text-ink-2 truncate">{booking.leadEmail}</div>
            <div className="text-[11px] text-ink-3 mt-0.5">
              Lead traveller · {booking.reference}
            </div>
          </div>
        </section>

        {/* Travellers shortcut */}
        <List>
          <ListLink
            href="/travellers"
            icon={<IconUsers size={18} />}
            title="Travellers"
            sub={`${booking.travellers.length} on this booking`}
          />
        </List>

        {/* Agency contact */}
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mt-6 mb-2 px-1">
          Your agent
        </h2>
        <section className="rounded-2xl bg-surface border border-line-light overflow-hidden">
          <div
            className="p-4 text-white relative"
            style={{
              background:
                'linear-gradient(135deg, #1B2B5B 0%, #2A3F7A 100%)',
            }}
          >
            <div
              aria-hidden
              className="absolute inset-0"
              style={{
                background:
                  'radial-gradient(ellipse at 85% 20%, rgba(0,180,216,0.35), transparent 50%)',
              }}
            />
            <div className="relative">
              <div className="text-base font-semibold">{booking.agency.name}</div>
              {booking.agency.atolNumber && (
                <div className="text-[11px] opacity-80 inline-flex items-center gap-1 mt-0.5">
                  <IconShield2 size={11} /> {booking.agency.atolNumber}
                </div>
              )}
              {booking.agency.website && (
                <div className="text-[11px] opacity-80 mt-1">
                  {booking.agency.website}
                </div>
              )}
            </div>
          </div>
          <div className="divide-y divide-line-light">
            <ContactRow
              href={`tel:${booking.agency.phone.replace(/\s/g, '')}`}
              icon={<IconPhone size={16} />}
              label="Call"
              value={booking.agency.phone}
            />
            <ContactRow
              href={`mailto:${booking.agency.email}`}
              icon={<IconMail size={16} />}
              label="Email"
              value={booking.agency.email}
            />
            {booking.agency.emergencyPhone && (
              <ContactRow
                href={`tel:${booking.agency.emergencyPhone.replace(/\s/g, '')}`}
                icon={<IconWarning size={16} />}
                label="24h emergency"
                value={booking.agency.emergencyPhone}
                emphasised
              />
            )}
          </div>
        </section>

        {/* Settings */}
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-ink-3 mt-6 mb-2 px-1">
          Settings
        </h2>
        <List>
          <ListToggle
            on={coverEnabled}
            onChange={toggleCover}
            icon={<IconPin size={18} />}
            title="Cover mode"
            sub="Open the app on a destination splash"
          />
          <ListAction
            onClick={() => toggle()}
            icon={theme === 'dark' ? <IconSun size={18} /> : <IconMoon size={18} />}
            title="Appearance"
            sub={theme === 'dark' ? 'Dark mode' : 'Light mode'}
          />
          <ListLink
            href="/notifications"
            icon={<IconBell size={18} />}
            title="Notifications"
            sub="Trip updates, check-in reminders, weather"
          />
          <ListAction
            icon={<IconHelp size={18} />}
            title="Help &amp; FAQ"
            sub="Ask Luna, or contact your agent"
          />
        </List>

        {/* Sign out */}
        <List>
          <ListLink
            href="/welcome"
            icon={<IconLogOut size={18} />}
            title="Sign out"
            destructive
          />
        </List>

        <p className="text-center text-[11px] text-ink-3 mt-6">
          Luna Travel · v0.5 prototype · {booking.agency.name}
        </p>
      </main>
    </PageEnter>
  );
}

/** Grouped list with single rounded shell. */
function List({ children }: { children: React.ReactNode }) {
  return (
    <section className="mt-3 rounded-2xl bg-surface border border-line-light overflow-hidden">
      <div className="divide-y divide-line-light">{children}</div>
    </section>
  );
}

function ListLink({
  href,
  icon,
  title,
  sub,
  destructive,
}: {
  href: string;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  destructive?: boolean;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
    >
      <span
        className={[
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          destructive
            ? 'bg-danger/10 text-danger'
            : 'bg-teal/10 text-teal-dark dark:text-teal-light',
        ].join(' ')}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={['text-sm font-medium', destructive ? 'text-danger' : 'text-ink'].join(' ')}>
          {title}
        </div>
        {sub && <div className="text-xs text-ink-2 mt-0.5">{sub}</div>}
      </div>
      {!destructive && <IconChevR size={18} className="text-ink-3 flex-shrink-0" />}
    </Link>
  );
}

function ListAction({
  onClick,
  icon,
  title,
  sub,
  destructive,
}: {
  onClick?: () => void;
  icon: React.ReactNode;
  title: string;
  sub?: string;
  destructive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
    >
      <span
        className={[
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          destructive ? 'bg-danger/10 text-danger' : 'bg-teal/10 text-teal-dark dark:text-teal-light',
        ].join(' ')}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className={['text-sm font-medium', destructive ? 'text-danger' : 'text-ink'].join(' ')}>
          {title}
        </div>
        {sub && <div className="text-xs text-ink-2 mt-0.5">{sub}</div>}
      </div>
      {!destructive && <IconChevR size={18} className="text-ink-3 flex-shrink-0" />}
    </button>
  );
}

function ListToggle({
  on,
  onChange,
  icon,
  title,
  sub,
}: {
  on: boolean;
  onChange: () => void;
  icon: React.ReactNode;
  title: string;
  sub?: string;
}) {
  return (
    <button
      type="button"
      onClick={onChange}
      role="switch"
      aria-checked={on}
      className="w-full flex items-center gap-3 p-4 hover:bg-surface-2 transition-colors text-left"
    >
      <span className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 bg-teal/10 text-teal-dark dark:text-teal-light">
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-sm font-medium text-ink">{title}</div>
        {sub && <div className="text-xs text-ink-2 mt-0.5">{sub}</div>}
      </div>
      <span
        aria-hidden
        className={[
          'relative inline-flex h-7 w-12 flex-shrink-0 rounded-full transition-colors',
          on ? 'bg-teal' : 'bg-surface-3',
        ].join(' ')}
      >
        <span
          className={[
            'absolute top-0.5 h-6 w-6 rounded-full bg-white shadow-sm transition-transform',
            on ? 'translate-x-[22px]' : 'translate-x-0.5',
          ].join(' ')}
        />
      </span>
    </button>
  );
}

function ContactRow({
  href,
  icon,
  label,
  value,
  emphasised,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  value: string;
  emphasised?: boolean;
}) {
  return (
    <a
      href={href}
      className={[
        'flex items-center gap-3 p-3.5 hover:bg-surface-2 transition-colors',
        emphasised ? 'bg-danger/5' : '',
      ].join(' ')}
    >
      <span
        className={[
          'w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0',
          emphasised
            ? 'bg-danger/10 text-danger'
            : 'bg-teal/10 text-teal-dark dark:text-teal-light',
        ].join(' ')}
      >
        {icon}
      </span>
      <div className="flex-1 min-w-0">
        <div className="text-[11px] uppercase tracking-wider font-semibold text-ink-3">
          {label}
        </div>
        <div className="text-sm font-medium text-ink truncate">{value}</div>
      </div>
      <IconExternal size={14} className="text-ink-3 flex-shrink-0" />
    </a>
  );
}
