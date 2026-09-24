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
 * The demo keeps the defaults: it is our showcase, not an agency's app. So do
 * the agency portal and admin, which a browser signed in as a traveller as
 * well would otherwise have retitled with the traveller's app name.
 *
 * The server already links the agency's manifest for a signed-in traveller
 * (api/app/manifest/current); pointing at the same manifest by its full
 * description here covers the first visit, before that has been saved.
 */

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useBooking } from '@/lib/booking-context';
import { appNameOf } from '@/lib/app-name';
import { iconSpecFor, iconUrl, manifestUrl, badgeUrl } from '@/lib/app-icon';

/** Screens that are not a traveller's app, and keep their own title. */
const NOT_THE_APP = ['/agency', '/admin', '/demo'];

/** Where the push worker looks for the agency's icon. */
export const IDENTITY_CACHE = 'app-identity';
export const IDENTITY_KEY = '/__app-identity.json';

/*
 * Each setter writes only what differs, and every element that matches, not
 * just the first. That makes them safe to run again whenever the head
 * changes: a second pass finds nothing to do.
 */
function setLink(rel: string, href: string, extra?: Record<string, string>) {
  const found = Array.from(document.head.querySelectorAll<HTMLLinkElement>(`link[rel="${rel}"]`));
  if (!found.length) {
    const el = document.createElement('link');
    el.rel = rel;
    document.head.appendChild(el);
    found.push(el);
  }
  for (const el of found) {
    if (el.getAttribute('href') !== href) el.setAttribute('href', href);
    for (const [k, v] of Object.entries(extra || {})) if (el.getAttribute(k) !== v) el.setAttribute(k, v);
  }
}

function setMeta(name: string, content: string) {
  const found = Array.from(document.head.querySelectorAll<HTMLMetaElement>(`meta[name="${name}"]`));
  if (!found.length) {
    const el = document.createElement('meta');
    el.name = name;
    document.head.appendChild(el);
    found.push(el);
  }
  for (const el of found) if (el.content !== content) el.content = content;
}

export function AppIdentity() {
  const { booking, source } = useBooking();
  const pathname = usePathname();
  const agency = booking?.agency;
  const live = source === 'live' && !!agency && !NOT_THE_APP.some((p) => pathname?.startsWith(p));
  const name = live ? appNameOf(agency) : '';
  const spec = live ? iconSpecFor(agency) : null;
  const key = spec ? `${name}|${spec.initial}|${spec.primary}|${spec.accent}|${spec.imageUrl ?? ''}` : '';

  useEffect(() => {
    if (!spec || !name) return;
    const apply = () => {
      if (document.title !== name) document.title = name;
      setMeta('apple-mobile-web-app-title', name);
      setMeta('application-name', name);
      setLink('apple-touch-icon', iconUrl(spec, 180), { sizes: '180x180' });
      setLink('icon', iconUrl(spec, 192), { sizes: '192x192', type: 'image/png' });
      setLink('manifest', manifestUrl(spec, name));
    };
    apply();

    // The page's own head can be re-rendered after this has run: React
    // finishing the page's metadata a moment after the trip has loaded put
    // the title back to "Your trip" about one load in four (24 Sep 2026). So
    // whenever the head changes, the agency's name and icons go back in.
    // apply() writes only what differs, so its own writes end the loop.
    const watch = new MutationObserver(apply);
    watch.observe(document.head, {
      subtree: true,
      childList: true,
      characterData: true,
      attributes: true,
      attributeFilter: ['href', 'content'],
    });

    try {
      if ('caches' in window) {
        const body = JSON.stringify({ name, icon: iconUrl(spec, 192), badge: badgeUrl(spec) });
        void caches
          .open(IDENTITY_CACHE)
          .then((c) => c.put(IDENTITY_KEY, new Response(body, { headers: { 'Content-Type': 'application/json' } })))
          .catch(() => {});
      }
    } catch {
      /* the notification keeps the default icon */
    }
    return () => watch.disconnect();
    // `key` stands for spec and name; the pathname puts it all back after a
    // navigation has re-rendered the head.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, pathname]);

  return null;
}
