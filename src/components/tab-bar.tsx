'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useCover } from '@/lib/cover-context';
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

  // Splash is showing → hide the tab bar so the cover is truly full-bleed.
  const splashShowing = pathname === '/' && coverEnabled && !coverDismissed;
  if (splashShowing) return null;

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
          return (
            <li key={href}>
              <Link
                href={href}
                aria-current={isActive ? 'page' : undefined}
                className={[
                  'flex flex-col items-center justify-center gap-0.5 pt-2 pb-3 min-h-[56px]',
                  'transition-colors',
                  isActive
                    ? 'text-navy dark:text-teal-light'
                    : 'text-ink-3 hover:text-ink-2',
                ].join(' ')}
              >
                <Icon size={22} />
                <span className="text-[10px] font-medium tracking-wide">{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
