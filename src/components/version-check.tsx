'use client';

import { useEffect, useState } from 'react';

const CURRENT_VERSION = '0.6.1'; // bumped when we ship a new sprint
const STORAGE_KEY = 'luna-travel.dismissed-version';

/**
 * Lightweight PWA cache-bust check.
 *
 * Fetches /version.json on mount (bypassing the service worker cache) and, if
 * the server version is newer than the bundle's CURRENT_VERSION, shows a tiny
 * "New version" pill at the top. Tap → service worker is unregistered + reload.
 *
 * Designed so it never bothers the user unless there's genuinely a new build —
 * crucial for the show, where we'll be pushing fixes during the day.
 */
export function VersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      try {
        // Bypass SW cache with a cachebusting query param
        const res = await fetch(`/version.json?t=${Date.now()}`, {
          cache: 'no-store',
        });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string };
        if (cancelled || !data.version) return;
        if (data.version !== CURRENT_VERSION) {
          const dismissed = window.localStorage.getItem(STORAGE_KEY);
          if (dismissed !== data.version) {
            setNewVersion(data.version);
          }
        }
      } catch {
        /* offline or fetch failed — silent */
      }
    };

    // Check on mount, then again every 5 minutes
    check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  const reload = async () => {
    try {
      if ('serviceWorker' in navigator) {
        const regs = await navigator.serviceWorker.getRegistrations();
        await Promise.all(regs.map((r) => r.unregister()));
      }
      if ('caches' in window) {
        const keys = await caches.keys();
        await Promise.all(keys.map((k) => caches.delete(k)));
      }
    } catch {
      /* ignore */
    } finally {
      window.location.reload();
    }
  };

  const dismiss = () => {
    if (newVersion) {
      try {
        window.localStorage.setItem(STORAGE_KEY, newVersion);
      } catch {
        /* ignore */
      }
    }
    setNewVersion(null);
  };

  if (!newVersion) return null;

  return (
    <div
      className="fixed left-3 right-3 z-[60] flex items-center gap-2 px-3 py-2 rounded-full bg-navy text-white shadow-lg animate-slide-up"
      style={{ top: 'calc(var(--safe-top) + 0.5rem)' }}
      role="status"
    >
      <span className="w-2 h-2 rounded-full bg-teal-light animate-pulse flex-shrink-0" />
      <span className="text-xs font-medium flex-1">New version available</span>
      <button
        type="button"
        onClick={reload}
        className="text-xs font-semibold px-2.5 py-1 rounded-full bg-white/15 hover:bg-white/25"
      >
        Refresh
      </button>
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="text-white/70 hover:text-white text-base leading-none w-5 h-5 flex items-center justify-center"
      >
        ×
      </button>
    </div>
  );
}
