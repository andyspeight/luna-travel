/**
 * Push handling for the service worker.
 *
 * A PLAIN STATIC FILE WITH A STABLE NAME, imported by the generated sw.js via
 * workbox's importScripts. It used to be next-pwa's "custom worker", which
 * compiles to a CONTENT-HASHED filename — and that quietly broke push on every
 * deploy that changed it: a phone still holding the previous sw.js would
 * importScripts a hash that no longer existed, the import would 404, and a
 * service worker whose importScripts fails does not start AT ALL. The server
 * would report the push as sent and the device would silently drop it.
 *
 * A stable path cannot go stale: an older sw.js still resolves it, and picks up
 * the current contents while it is at it. Served no-cache (see next.config.js)
 * so a change here reaches devices promptly.
 *
 * This is the half of push that runs ON THE DEVICE, with the app closed. The
 * server posts an encrypted payload to the push service; the OS wakes this
 * worker; showNotification is what actually puts something on the lock screen.
 * Without this file the subscription would exist and nothing would ever appear.
 */

self.addEventListener('push', (event) => {
  // A push with no payload still has to show SOMETHING: every browser requires
  // a visible notification for a push it woke us for, and staying silent gets
  // the origin's push permission revoked.
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {};
  }

  const title = data.title || 'Your trip';
  event.waitUntil(
    agencyLook().then((look) =>
      self.registration.showNotification(title, notificationOptions(data, look)),
    ),
  );
});

/**
 * The agency's own icon and badge, left in Cache Storage by the app
 * (components/app-identity) the last time it was open. The neutral plane when
 * there is none, or what is there is not one of ours.
 *
 * The badge is the small monochrome mark Android shows in the status bar. It
 * was the full-colour "LT" square, which Android flattens to a plain white
 * blob; it is now the app's letter, or the plane.
 */
const DEFAULT_LOOK = {
  icon: '/api/app/icon?p=1b2b5b&a=00b4d8&s=192',
  badge: '/api/app/icon?p=1b2b5b&a=00b4d8&s=96&b=1',
};

function ours(v) {
  return typeof v === 'string' && v.indexOf('/api/app/icon?') === 0;
}

function agencyLook() {
  if (!self.caches) return Promise.resolve(DEFAULT_LOOK);
  return caches
    .open('app-identity')
    .then((c) => c.match('/__app-identity.json'))
    .then((r) => (r ? r.json() : null))
    .then((j) => ({
      icon: j && ours(j.icon) ? j.icon : DEFAULT_LOOK.icon,
      badge: j && ours(j.badge) ? j.badge : DEFAULT_LOOK.badge,
    }))
    .catch(() => DEFAULT_LOOK);
}

function notificationOptions(data, look) {
  return {
    body: data.body || '',
    icon: look.icon,
    badge: look.badge,
    // Same tag collapses repeats — five gate changes are one row, not five.
    tag: data.tag || 'luna-travel',
    renotify: true,
    // Urgent ones (a gate change, a delay) buzz and stay on screen until
    // acknowledged. Ordinary ones behave like any other message, because a
    // product that treats everything as urgent gets muted.
    requireInteraction: !!data.urgent,
    vibrate: data.urgent ? [200, 100, 200] : undefined,
    data: { url: data.url || '/' },
  };
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = (event.notification.data && event.notification.data.url) || '/';

  // Focus an already-open window rather than stacking another copy of the app,
  // and navigate it to the notification's destination.
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          if ('navigate' in client) {
            return client.navigate(target).then((c) => (c ? c.focus() : undefined));
          }
          return client.focus();
        }
      }
      return self.clients.openWindow ? self.clients.openWindow(target) : undefined;
    }),
  );
});
