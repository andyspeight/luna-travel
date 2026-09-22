'use client';

/**
 * How current the flight information is, and a way to ask again.
 *
 * Shared by the flight screen and the travel-day card deliberately. The two
 * used to word this differently — one printed a bare "Updated 09:12" only when
 * it happened to have a timestamp, the other claimed it was "checking again"
 * while nothing was checking — and two answers to "how old is this" is worse
 * than either answer alone.
 *
 * The sentence itself is decided in lib/flight-freshness, where it can be
 * argued with in a test. This only draws it.
 */

import { describeFreshness } from '@/lib/flight-freshness';
import { IconRefresh } from '@/components/icons';

export function FlightStatusLine({
  live,
  online = true,
  refreshing = false,
  failed = false,
  onRefresh,
  variant = 'dark',
  className = '',
  now,
}: {
  live?: { lastUpdated?: string | null } | null;
  online?: boolean;
  refreshing?: boolean;
  failed?: boolean;
  /** Omitted where there is nothing real to refetch, e.g. the admin rig. */
  onRefresh?: () => void;
  variant?: 'dark' | 'light';
  className?: string;
  now?: number;
}) {
  const line = describeFreshness({ live, online, checking: refreshing, failed, now });
  const dark = variant === 'dark';

  const text = line.tone === 'warn'
    ? dark ? 'text-amber-300' : 'text-warning-ink'
    : dark ? 'text-white/60' : 'text-ink-2';

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {/* aria-live so a traveller using a screen reader hears the result of
          their own press, rather than the line changing silently. */}
      <span className={`text-[12px] leading-snug ${text}`} aria-live="polite">
        {line.text}
      </span>

      {line.canRefresh && onRefresh && (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          // Padded to a 44px touch area without a 44px-looking button: the
          // label is small on purpose, the target is not.
          className={`-my-2.5 -mr-2 inline-flex min-h-[44px] items-center gap-1 px-2 py-2.5 text-[12px] font-semibold ${
            dark ? 'text-white/85' : 'text-teal-dark'
          } disabled:opacity-50`}
        >
          <IconRefresh size={13} />
          Refresh
        </button>
      )}
    </div>
  );
}
