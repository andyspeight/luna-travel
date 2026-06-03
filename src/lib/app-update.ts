/**
 * Single source of truth for the app version and the force-update routine.
 *
 * Shared by the auto-update pill (version-check.tsx) and the manual
 * "Check for updates" row in the Me section, so the two can never drift apart.
 * Bump APP_VERSION on every release, alongside public/version.json.
 */
export const APP_VERSION = '0.14.10';

/** The version published to the server, or null if it can't be read. */
export async function getLatestVersion(): Promise<string | null> {
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { version?: string };
    return data.version ?? null;
  } catch {
    return null;
  }
}

/**
 * Force the installed PWA onto the freshest build: drop the service worker,
 * wipe its caches, then navigate to a cache-busted URL so the document is
 * fetched from the network rather than the browser's disk cache. A plain
 * reload() can re-serve the stale shell and loop, which is the bug this avoids.
 */
export async function forceAppUpdate(): Promise<void> {
  try {
    if (typeof navigator !== 'undefined' && 'serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if (typeof window !== 'undefined' && 'caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } catch {
    /* best effort — still navigate below */
  } finally {
    const sep = window.location.search ? '&' : '?';
    window.location.replace(
      `${window.location.pathname}${window.location.search}${sep}_v=${Date.now()}`,
    );
  }
}
