/** @type {import('next').NextConfig} */
const withPWAInit = require('@ducanh2912/next-pwa').default;

const withPWA = withPWAInit({
  dest: 'public',
  register: true,
  disable: process.env.NODE_ENV === 'development',
  workboxOptions: {
    skipWaiting: true,
    // Stable path, deliberately not next-pwa's hashed custom worker — see the
    // note at the top of public/push-sw.js. A hashed name breaks push for any
    // device still holding the previous sw.js.
    importScripts: ['/push-sw.js'],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/fonts\.(?:googleapis|gstatic)\.com\/.*/i,
        handler: 'CacheFirst',
        options: {
          cacheName: 'google-fonts',
          expiration: { maxEntries: 4, maxAgeSeconds: 365 * 24 * 60 * 60 },
        },
      },
      {
        urlPattern: /\.(?:eot|otf|ttc|ttf|woff|woff2|font.css)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'static-font-assets' },
      },
      {
        urlPattern: /\.(?:jpg|jpeg|gif|png|svg|ico|webp)$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'static-image-assets' },
      },
      {
        urlPattern: /\/_next\/data\/.+\/.+\.json$/i,
        handler: 'StaleWhileRevalidate',
        options: { cacheName: 'next-data' },
      },
      {
        urlPattern: /\.(?:json|xml|csv)$/i,
        handler: 'NetworkFirst',
        options: { cacheName: 'static-data-assets' },
      },
      {
        // The PDF.js worker. Cached on first use rather than precached: it is
        // over a megabyte, and a traveller who never opens a document should
        // not pay for it at install. Once it is cached, document previews keep
        // working with no network at all — which is the point of serving it
        // ourselves instead of from a CDN.
        urlPattern: /\/pdf\.worker\.min\.js$/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'pdf-worker',
          expiration: { maxEntries: 2, maxAgeSeconds: 30 * 24 * 60 * 60 },
        },
      },
      {
        // THE APP ITSELF, so the documents above are reachable.
        //
        // Caching the files was only half of it: with no rule for navigations,
        // opening the app with no signal failed at the first request and the
        // traveller never got as far as the documents that were sitting on
        // their phone. An /offline page existed but nothing ever routed to it.
        //
        // NetworkFirst, not CacheFirst: online they must get the real page,
        // because a stale shell is how a traveller sees yesterday's flight
        // status. The short timeout is for the case that actually matters —
        // airport wifi that accepts the connection and then does nothing.
        urlPattern: ({ request }) => request.mode === 'navigate',
        handler: 'NetworkFirst',
        options: {
          cacheName: 'pages',
          networkTimeoutSeconds: 4,
          expiration: { maxEntries: 40, maxAgeSeconds: 30 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [200] },
        },
      },
      {
        // TRAVEL DOCUMENTS. The whole promise of the app on a travel day is
        // that the tickets open in a terminal with no signal, and until now
        // nothing stored them: the rules above cover fonts, images and JSON,
        // and a booking's documents arrive through this proxy as a PDF.
        //
        // Same-origin and session-gated, so what lands here is the
        // traveller's own file on the traveller's own device — which is the
        // point, and also why it is worth saying out loud: these persist
        // until the entries below expire or the browser data is cleared.
        //
        // StaleWhileRevalidate rather than CacheFirst: an agency can replace
        // a voucher after it is issued, and the traveller should get the new
        // one next time they have signal without losing the old one in the
        // meantime.
        //
        // lib/offline-docs.ts fills this deliberately rather than waiting for
        // a tap, because a rule only ever catches what was asked for.
        urlPattern: /\/api\/traveller\/document/i,
        handler: 'StaleWhileRevalidate',
        options: {
          cacheName: 'traveller-documents',
          // A long trip with a big party, kept for a season either side of it.
          expiration: { maxEntries: 60, maxAgeSeconds: 180 * 24 * 60 * 60 },
          cacheableResponse: { statuses: [200] },
        },
      },
    ],
  },
  // Cache pages as the traveller moves through the app, so a screen they
  // opened at home is there in the terminal.
  cacheOnFrontEndNav: true,
  // The last resort: a page never visited while online still gets something
  // that explains itself rather than the browser's dinosaur.
  fallbacks: { document: '/offline' },
  // Kept out of the precache manifest; the runtimeCaching rule above owns it.
  publicExcludes: ['!noprecache/**/*', '!pdf.worker.min.js'],
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // The home-screen icon route reads its font from disk; make sure the file
  // travels with the function.
  outputFileTracingIncludes: {
    '/api/app/icon': ['./src/assets/fonts/**/*'],
  },
  async headers() {
    return [
      {
        // The push handler must never be served stale: the service worker
        // imports it by a fixed path, so a cached copy would pin old behaviour
        // on a device indefinitely.
        source: '/push-sw.js',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' }],
      },
    ];
  },
  webpack(config) {
    // PDF.js ships one bundle for browsers and Node, and its Node half requires
    // 'canvas'. That branch is unreachable in a browser, but webpack still has
    // to resolve it, so the build fails on a package we neither have nor want.
    // Aliasing it to false is the resolution PDF.js documents for bundlers.
    config.resolve.alias = { ...(config.resolve.alias || {}), canvas: false };
    return config;
  },
};

module.exports = withPWA(nextConfig);
