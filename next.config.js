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
    ],
  },
  // Kept out of the precache manifest; the runtimeCaching rule above owns it.
  publicExcludes: ['!noprecache/**/*', '!pdf.worker.min.js'],
});

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
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
