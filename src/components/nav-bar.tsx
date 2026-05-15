'use client';

import { useRouter } from 'next/navigation';
import { IconChevL } from './icons';

interface NavBarProps {
  title: string;
  backLabel?: string;
  action?: { label: string; onClick: () => void };
  /** Apply when nav sits over a dark hero — text becomes white */
  variant?: 'light' | 'dark';
}

export function NavBar({ title, backLabel = 'Back', action, variant = 'light' }: NavBarProps) {
  const router = useRouter();
  const dark = variant === 'dark';

  return (
    <header
      className={[
        'sticky top-0 z-30 h-12 px-2 flex items-center justify-between',
        'border-b',
        dark
          ? 'bg-transparent border-transparent text-white'
          : 'glass border-line-light text-ink',
      ].join(' ')}
      style={{ paddingTop: 'var(--safe-top)' }}
    >
      <button
        type="button"
        onClick={() => router.back()}
        className={[
          'inline-flex items-center gap-0.5 px-2 py-2 -ml-1 rounded-lg text-base font-medium',
          dark ? 'text-white' : 'text-teal-dark',
        ].join(' ')}
      >
        <IconChevL size={20} />
        <span>{backLabel}</span>
      </button>

      <h1
        className={[
          'absolute left-1/2 -translate-x-1/2 text-[15px] font-semibold truncate max-w-[55%]',
          dark ? 'text-white' : 'text-ink',
        ].join(' ')}
      >
        {title}
      </h1>

      <div className="min-w-[60px] flex justify-end">
        {action ? (
          <button
            type="button"
            onClick={action.onClick}
            className={[
              'px-2 py-2 rounded-lg text-sm font-medium',
              dark ? 'text-white' : 'text-teal-dark',
            ].join(' ')}
          >
            {action.label}
          </button>
        ) : (
          <span aria-hidden className="px-2 py-2" />
        )}
      </div>
    </header>
  );
}
