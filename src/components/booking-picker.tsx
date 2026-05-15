'use client';

import { useEffect, useRef, useState } from 'react';
import { useBooking } from '@/lib/booking-context';
import { useTheme } from '@/lib/theme-context';
import { useCover } from '@/lib/cover-context';
import { IconCheck, IconSun, IconMoon } from './icons';

/**
 * Hidden demo picker. Long-press (700ms) on the logo opens a modal listing the
 * available mock bookings plus a theme toggle. For the show, tells the demoer
 * what they are looking at without disrupting the production-feel UI.
 */
export function BookingPicker({ children }: { children: React.ReactNode }) {
  const { booking, setBookingByRef, allBookings } = useBooking();
  const { theme, toggle } = useTheme();
  const { coverEnabled, reset: resetCover } = useCover();
  const [open, setOpen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const fired = useRef(false);

  const onPointerDown = () => {
    fired.current = false;
    timer.current = setTimeout(() => {
      fired.current = true;
      setOpen(true);
      // Subtle haptic if supported
      if ('vibrate' in navigator) navigator.vibrate(15);
    }, 700);
  };

  const onPointerUp = () => {
    if (timer.current) clearTimeout(timer.current);
  };

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onPointerDown={onPointerDown}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onPointerLeave={onPointerUp}
        onClick={(e) => {
          if (fired.current) e.preventDefault();
        }}
        aria-label="Open demo controls (long press)"
        className="touch-manipulation focus:outline-none focus-visible:outline-2 focus-visible:outline-teal rounded-xl"
      >
        {children}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center sm:justify-center bg-black/50 animate-fade-in"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Demo controls"
        >
          <div
            className="w-full sm:max-w-md bg-surface rounded-t-3xl sm:rounded-3xl p-4 pb-8 animate-slide-up shadow-xl"
            onClick={(e) => e.stopPropagation()}
            style={{ paddingBottom: 'calc(2rem + var(--safe-bottom))' }}
          >
            <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-ink-3/40" />
            <h2 className="text-lg font-semibold text-ink mb-1">Demo controls</h2>
            <p className="text-xs text-ink-2 mb-4">
              For the booth — switch booking or theme.
            </p>

            <div className="space-y-2 mb-4">
              {allBookings.map((b) => {
                const active = b.reference === booking.reference;
                return (
                  <button
                    key={b.reference}
                    type="button"
                    onClick={() => {
                      setBookingByRef(b.reference);
                      // If cover mode is on, re-arm the splash for the new trip
                      if (coverEnabled) resetCover();
                      setOpen(false);
                    }}
                    className={[
                      'w-full flex items-center gap-3 p-3 rounded-xl border text-left transition-colors',
                      active
                        ? 'bg-teal/5 border-teal/40'
                        : 'bg-surface-2 border-line hover:border-ink-3/40',
                    ].join(' ')}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-ink">{b.destinationLabel}</div>
                      <div className="text-xs text-ink-2 truncate">
                        {b.travellers[0].firstName} {b.travellers[0].lastName} ·{' '}
                        {b.durationLabel} · {b.reference}
                      </div>
                    </div>
                    {active && (
                      <span className="text-teal-dark dark:text-teal-light">
                        <IconCheck size={18} />
                      </span>
                    )}
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => toggle()}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl bg-surface-2 border border-line hover:border-ink-3/40 text-sm font-medium text-ink"
            >
              {theme === 'dark' ? <IconSun size={16} /> : <IconMoon size={16} />}
              Switch to {theme === 'dark' ? 'light' : 'dark'} mode
            </button>
          </div>
        </div>
      )}
    </>
  );
}
