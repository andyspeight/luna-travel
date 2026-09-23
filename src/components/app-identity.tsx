'use client';

/**
 * Makes the page, and so anything a traveller installs from it, the agency's
 * app: the title, the name iOS puts under the home-screen icon, the icon itself
 * and the Android manifest.
 *
 * These live in <head>, which the server renders once for everybody, before it
 * knows whose trip this is. So they start as the app's defaults and are
 * pointed at the agency's own as soon as a real trip has loaded, which is
 * before the "Add to home screen" moment on the reveal screen. They are put
 * back after every navigation, because a route change can re-render the head.
 *
 * The push worker cannot see the page, so the icon for notifications is left
 * for it in Cache Storage (public/push-sw.js reads it).
 *
 * The demo keeps the defaults: it is our showcase, not an agency's app.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { appNameOf } from '@/lib/app-name';
import { iconSpecFor, iconUrl, manifestUrl } from '@/lib/app-icon';

/** Where the push worker looks for the agency's icon. */
export const IDENTITY_CACHE = 'app-identity';
export const IDENTITY_KEY = '/__app-identity.json';

function setLink(rel: string, href: string, extra?: Record<string, string>) {
  let el = document.head.querySelector<HTMLLinkElement>(`link[rel="${rel}"]`);
  if (!el) {
    el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
  }
  if (el.getAttribute('href') !== href) el.setAttribute('href', href);
  for (const [k, v] of Object.entries(extra || {})) el.setAttribute(k, v);
}

function setMeta(name: string, content: string) {
  let el = document.head.querySelector<HTMLMetaElement>(`meta[name="${name}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
  }
  if (el.content !== content) el.content = content;
}

export function AppIdentity() {
  const { booking, source } = useBooking();
  const pathname = usePathname();
  const agency = booking?.agency;
  const live = source === 'live' && !!agency;
  const name = live ? appNameOf(agency) : '';
  const spec = live ? iconSpecFor(agency) : null;
  const key = spec ? `${name}|${spec.initial}|${spec.primary}|${spec.accent}|${spec.imageUrl ?? ''}` : '';

  useEffect(() => {
    if (!spec || !name) return;
    document.title = name;
    setMeta('apple-mobile-web-app-title', name);
    setMeta('application-name', name);
    setLink('apple-touch-icon', iconUrl(spec, 180), { sizes: '180x180' });
    setLink('manifest', manifestUrl(spec, name));

    try {
      if ('caches' in window) {
        const body = JSON.stringify({ name, icon: iconUrl(spec, 192) });
        void caches
          .open(IDENTITY_CACHE)
          .then((c) => c.put(IDENTITY_KEY, new Response(body, { headers: { 'Content-Type': 'application/json' } })))
          .catch(() => {});
      }
    } catch {
      /* the notification keeps the default icon */
    }
    // `key` stands for spec and name; the pathname puts it all back after a
    // navigation has re-rendered the head.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);

  return null;
}
