/**
 * Custom service-worker additions, compiled by @ducanh2912/next-pwa and
 * imported into the generated sw.js.
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
