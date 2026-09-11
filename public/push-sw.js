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
  const options = {
    body: data.body || '',
    icon: '/icons/icon-192.png',
    badge: '/icons/icon-192.png',
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

  event.waitUntil(self.registration.showNotification(title, options));
});

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
