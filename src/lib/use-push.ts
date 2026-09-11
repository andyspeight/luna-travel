'use client';

/**
 * Web Push — client side.
 *
 * Three facts drive the whole design here:
 *
 *  1. YOU GET ONE ASK. If a traveller taps "Don't allow", the browser
 *     remembers and the page can never prompt again on that device — only the
 *     traveller can undo it in browser settings. So requestPermission() must
 *     only ever be called from a deliberate tap on something that has already
 *     explained why, never on page load.
 *  2. ON iOS IT ONLY WORKS INSTALLED. iOS supports web push from 16.4, but
 *     only for a PWA added to the home screen — a Safari tab gets nothing. So
 *     for iPhone users "add to home screen" is a hard prerequisite, not a nice
 *     touch, and the UI has to say so rather than offering a button that
 *     cannot work.
 *  3. Permission is per-origin, and the subscription is per-device.
 */

import { useCallback, useEffect, useState } from 'react';

export type PushPermission = 'default' | 'granted' | 'denied' | 'unsupported';

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4);
  const normalised = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/');
  const raw = window.atob(normalised);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i);
  return out;
}

export interface PushState {
  /** Browser-level permission, or 'unsupported' where there is no Push API. */
  permission: PushPermission;
  /** True once this device has a subscription registered with us. */
  subscribed: boolean;
  /** iOS outside an installed PWA: push cannot work until they install. */
  needsInstallFirst: boolean;
  busy: boolean;
  /** Ask for permission and register. Must be called from a user gesture. */
  enable: () => Promise<boolean>;
  disable: () => Promise<void>;
}

export function usePush(): PushState {
  const [permission, setPermission] = useState<PushPermission>('default');
  const [subscribed, setSubscribed] = useState(false);
  const [needsInstallFirst, setNeedsInstallFirst] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const supported =
      typeof window !== 'undefined' &&
      'serviceWorker' in navigator &&
      'PushManager' in window &&
      'Notification' in window;

    const ua = typeof navigator !== 'undefined' ? navigator.userAgent : '';
    // iPadOS reports as "Macintosh", so a touch check tells it from a real Mac.
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (ua.includes('Macintosh') && typeof document !== 'undefined' && 'ontouchend' in document);
    const isStandalone =
      typeof window !== 'undefined' &&
      (window.matchMedia?.('(display-mode: standalone)').matches ||
        (navigator as unknown as { standalone?: boolean }).standalone === true);

    if (!supported) {
      // On iOS the Push API is simply absent in a Safari tab — that is not a
      // dead end, it is "install first", and saying so is the difference
      // between a useful prompt and a broken-looking one.
      setPermission('unsupported');
      setNeedsInstallFirst(isIOS && !isStandalone);
      return;
    }

    setPermission(Notification.permission as PushPermission);
    setNeedsInstallFirst(isIOS && !isStandalone);

    navigator.serviceWorker.ready
      .then((reg) => reg.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub))
      .catch(() => setSubscribed(false));
  }, []);

  const enable = useCallback(async (): Promise<boolean> => {
    const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
    if (!key) {
      console.error('[push] NEXT_PUBLIC_VAPID_PUBLIC_KEY is not set');
      return false;
    }
    setBusy(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as PushPermission);
      if (result !== 'granted') return false;

      const reg = await navigator.serviceWorker.ready;
      // Reuse an existing subscription where there is one: re-subscribing
      // returns the same endpoint anyway, and this avoids a needless round trip.
      const existing = await reg.pushManager.getSubscription();
      const sub =
        existing ??
        (await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(key),
        }));

      const res = await fetch('/api/traveller/push', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON()),
      });
      if (!res.ok) throw new Error('save_failed');

      setSubscribed(true);
      return true;
    } catch (e) {
      console.error('[push] enable failed', e instanceof Error ? e.message : e);
      return false;
    } finally {
      setBusy(false);
    }
  }, []);

  const disable = useCallback(async () => {
    setBusy(true);
    try {
      const reg = await navigator.serviceWorker.ready;
      const sub = await reg.pushManager.getSubscription();
      if (sub) {
        await fetch(`/api/traveller/push?endpoint=${encodeURIComponent(sub.endpoint)}`, {
          method: 'DELETE',
        });
        await sub.unsubscribe();
      }
      setSubscribed(false);
    } catch (e) {
      console.error('[push] disable failed', e instanceof Error ? e.message : e);
    } finally {
      setBusy(false);
    }
  }, []);

  return { permission, subscribed, needsInstallFirst, busy, enable, disable };
}
