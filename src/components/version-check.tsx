'use client';

import { useEffect, useState } from 'react';
import { APP_VERSION, getLatestVersion, forceAppUpdate } from '@/lib/app-update';

const STORAGE_KEY = 'luna-travel.dismissed-version';

/**
 * Lightweight PWA update pill.
 *
 * Checks the server's published version on mount (and every 5 minutes) and, if
 * it's newer than this bundle's APP_VERSION, shows a small "New version" pill.
 * Tapping it runs the shared forceAppUpdate() routine — the same one behind the
 * manual "Check for updates" control in the Me section.
 */
export function VersionCheck() {
  const [newVersion, setNewVersion] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const check = async () => {
      const latest = await getLatestVersion();
      if (cancelled || !latest) return;
      if (latest !== APP_VERSION) {
        const dismissed = window.localStorage.getItem(STORAGE_KEY);
        if (dismissed !== latest) setNewVersion(latest);
      }
    };

    check();
    const id = window.setInterval(check, 5 * 60 * 1000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

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
        onClick={() => void forceAppUpdate()}
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
