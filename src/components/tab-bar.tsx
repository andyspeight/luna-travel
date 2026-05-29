'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCover } from '@/lib/cover-context';
import { useAgentMessages } from '@/lib/use-agent-messages';
import { IconHome, IconCalendar, IconDoc, IconChat, IconUser } from './icons';

const TABS = [
  { href: '/', label: 'Trip', icon: IconHome },
  { href: '/itinerary', label: 'Itinerary', icon: IconCalendar },
  { href: '/documents', label: 'Docs', icon: IconDoc },
  { href: '/luna', label: 'Luna', icon: IconChat },
  { href: '/me', label: 'Me', icon: IconUser },
];

export function TabBar() {
  const pathname = usePathname();
  const { coverEnabled, coverDismissed } = useCover();
  const { unreadCount } = useAgentMessages();

  // Splash is showing → hide the tab bar so the cover is truly full-bleed.
  const splashShowing = pathname === '/' && coverEnabled && !coverDismissed;
  if (splashShowing) return null;

  // Booth-display and onboarding screens are standalone (no trip context yet)
  // — hide the tab bar so they read as self-contained surfaces.
  if (pathname === '/install' || pathname === '/welcome') return null;

  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-40 glass border-t border-line"
      style={{ paddingBottom: 'var(--safe-bottom)' }}
      aria-label="Main navigation"
    >
      <ul className="grid grid-cols-5">
        {TABS.map(({ href, label, icon: Icon }) => {
          const isActive =
            href === '/' ? pathname === '/' : pathname.startsWith(href);
          const showBadge = href === '/me' && unreadCount > 0;
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                aria-label={showBadge ? `${label}, ${unreadCount} unread message${unreadCount === 1 ? '' : 's'}` : undefined}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 pt-2 pb-3 min-h-[56px]',
                  'transition-colors',
                  isActive
                    ? 'text-navy dark:text-teal-light'
                    : 'text-ink-3 hover:text-ink-2',
                ].join(' ')}
              >
                <span className="relative inline-flex">
                  <Icon size={22} />
                  {showBadge && (
                    <span className="absolute -top-1.5 -right-2.5 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center leading-none ring-2 ring-surface">
                      {unreadCount > 9 ? '9+' : unreadCount}
                    </span>
                  )}
                </span>
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
