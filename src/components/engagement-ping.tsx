'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

/**
 * Fires a lightweight "app opened" ping so the admin can report real
 * active-user and install numbers. No UI.
 *
 * - Only on traveller routes (skips admin, onboarding and system pages).
 * - Debounced to once per 10 minutes per device (sessionStorage), matching
 *   the server-side throttle, so a tab switch doesn't spam.
 * - Sends whether the app is running "installed" (standalone display mode).
 * - Fires on first mount, when the app returns to the foreground, and on the
 *   browser's appinstalled event. All failures are swallowed.
 */

const LAST_KEY = 'lt.ping.last';
const MIN_GAP_MS = 10 * 60 * 1000;
const SKIP_PREFIXES = ['/admin', '/welcome', '/install', '/offline', '/review', '/signin'];

function isStandalone(): boolean {
  try {
    if (window.matchMedia && window.matchMedia('(display-mode: standalone)').matches) return true;
    // iOS Safari
    if ((window.navigator as unknown as { standalone?: boolean }).standalone === true) return true;
    if (document.referrer.startsWith('android-app://')) return true;
  } catch {
    /* ignore */
  }
  return false;
}

export function EngagementPing() {
  const pathname = usePathname();

  useEffect(() => {
    if (SKIP_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + '/') || pathname.startsWith(p))) {
      return;
    }

    const send = (force = false) => {
      try {
        if (!force) {
          const last = Number(sessionStorage.getItem(LAST_KEY) || 0);
          if (Date.now() - last < MIN_GAP_MS) return;
        }
        sessionStorage.setItem(LAST_KEY, String(Date.now()));
      } catch {
        /* sessionStorage unavailable — still attempt the ping */
      }
      fetch('/api/traveller/ping', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ standalone: isStandalone() }),
        keepalive: true,
      }).catch(() => {
        /* telemetry is best-effort */
      });
    };

    send();

    const onVisible = () => {
      if (document.visibilityState === 'visible') send();
    };
    const onInstalled = () => send(true);

    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('appinstalled', onInstalled);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('appinstalled', onInstalled);
    };
  }, [pathname]);

  return null;
}
